// Configuración del panel
function toggleConfig() {
    const panel = document.getElementById('config-panel');
    panel.classList.toggle('active');
}

// Configuración del Gauge
const gaugeConfig = {
    minValue: 0,
    maxValue: 100,
    startAngle: -90,  // Comienza en la parte inferior izquierda
    endAngle: 90,     // Termina en la parte inferior derecha (semicírculo)
    colorRanges: [
        { from: 0, to: 33, color: '#ef5350' },      // Rojo
        { from: 33, to: 66, color: '#ffb74d' },     // Naranja
        { from: 66, to: 100, color: '#66bb6a' }     // Verde
    ]
};

let currentValue = 0;
let targetValue = null;
let worksheet = null;

// Inicializar la extensión de Tableau
tableau.extensions.initializeAsync({ configure: configure }).then(() => {
    console.log('Tableau Extension initialized');
    
    // Obtener la primera hoja de trabajo
    const dashboardContent = tableau.extensions.dashboardContent.dashboard;
    worksheet = dashboardContent.worksheets[0];
    
    // Cargar datos iniciales
    loadData();
    
    // Escuchar cambios en los filtros y datos
    worksheet.addEventListener(tableau.TableauEventType.FilterChanged, loadData);
    worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, loadData);
    
}, (err) => {
    console.error('Error initializing extension:', err);
    showError('Error initializing Tableau extension: ' + err.message);
});

// Función de configuración (opcional)
function configure() {
    const popupUrl = window.location.href.replace('gauge-chart.html', 'gauge-config.html');
    tableau.extensions.ui.displayDialogAsync(popupUrl, '', { height: 400, width: 500 }).then(() => {
        loadData();
    }).catch((error) => {
        console.log('Dialog closed', error);
    });
}

// Cargar datos desde Tableau
async function loadData() {
    try {
        if (!worksheet) {
            showError('No worksheet found');
            return;
        }

        // Obtener los datos resumidos
        const dataTable = await worksheet.getSummaryDataAsync();
        
        if (!dataTable || dataTable.data.length === 0) {
            showError('No data available. Please add measures to your worksheet.');
            return;
        }

        // Extraer columnas
        const columns = dataTable.columns;
        
        // Buscar columnas de Valor y Target
        let valueColumnIndex = -1;
        let targetColumnIndex = -1;
        
        // Intentar identificar las columnas automáticamente
        for (let i = 0; i < columns.length; i++) {
            const fieldName = columns[i].fieldName.toLowerCase();
            
            // Primera columna numérica es el valor
            if (valueColumnIndex === -1 && columns[i].dataType === tableau.DataType.Float || 
                columns[i].dataType === tableau.DataType.Int) {
                valueColumnIndex = i;
            }
            // Segunda columna numérica o columna con "target" en el nombre
            else if (valueColumnIndex !== -1 && 
                    (columns[i].dataType === tableau.DataType.Float || 
                     columns[i].dataType === tableau.DataType.Int)) {
                targetColumnIndex = i;
            }
            
            if (fieldName.includes('target') || fieldName.includes('objetivo') || 
                fieldName.includes('goal') || fieldName.includes('meta')) {
                targetColumnIndex = i;
            }
        }

        if (valueColumnIndex === -1) {
            showError('Please add at least one measure to your worksheet');
            return;
        }

        // Obtener valores (usar la primera fila de datos)
        const firstRow = dataTable.data[0];
        currentValue = parseFloat(firstRow[valueColumnIndex].value) || 0;
        
        if (targetColumnIndex !== -1 && firstRow[targetColumnIndex]) {
            targetValue = parseFloat(firstRow[targetColumnIndex].value) || null;
        }

        // Calcular min y max automáticamente
        let allValues = dataTable.data.map(row => parseFloat(row[valueColumnIndex].value) || 0);
        if (targetValue !== null) {
            allValues.push(targetValue);
        }
        
        gaugeConfig.minValue = Math.min(0, ...allValues) * 0.9;
        gaugeConfig.maxValue = Math.max(...allValues) * 1.2;

        // Renderizar el gauge
        renderGauge();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Error loading data: ' + error.message);
    }
}

// Renderizar el Gauge Chart
function renderGauge() {
    const container = document.getElementById('gauge-container');
    const svg = d3.select('#gauge-svg');
    
    // Limpiar SVG anterior
    svg.selectAll('*').remove();
    
    // Dimensiones
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;
    const radius = Math.min(width, height) * 0.4;
    const centerX = width / 2;
    const centerY = height * 0.65;
    
    // Grupo principal
    const g = svg.append('g')
        .attr('transform', `translate(${centerX}, ${centerY})`);
    
    // Escalas
    const angleScale = d3.scaleLinear()
        .domain([gaugeConfig.minValue, gaugeConfig.maxValue])
        .range([gaugeConfig.startAngle, gaugeConfig.endAngle])
        .clamp(true);
    
    // Arco generator
    const arc = d3.arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius)
        .startAngle(d => d.startAngle * Math.PI / 180)
        .endAngle(d => d.endAngle * Math.PI / 180);
    
    // Dibujar secciones de color
    gaugeConfig.colorRanges.forEach(range => {
        const rangeMin = Math.max(range.from, gaugeConfig.minValue);
        const rangeMax = Math.min(range.to, gaugeConfig.maxValue);
        
        if (rangeMax > rangeMin) {
            g.append('path')
                .datum({
                    startAngle: angleScale(rangeMin),
                    endAngle: angleScale(rangeMax)
                })
                .attr('class', 'gauge-arc')
                .attr('d', arc)
                .attr('fill', range.color)
                .attr('opacity', 0.8);
        }
    });
    
    // Línea de fondo (marco exterior)
    g.append('path')
        .datum({
            startAngle: gaugeConfig.startAngle,
            endAngle: gaugeConfig.endAngle
        })
        .attr('d', arc)
        .attr('fill', 'none')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 2);
    
    // Marca del Target (si existe)
    if (targetValue !== null && targetValue >= gaugeConfig.minValue && targetValue <= gaugeConfig.maxValue) {
        const targetAngle = angleScale(targetValue) * Math.PI / 180;
        const innerR = radius * 0.65;
        const outerR = radius * 1.05;
        
        g.append('line')
            .attr('class', 'target-marker')
            .attr('x1', Math.cos(targetAngle) * innerR)
            .attr('y1', Math.sin(targetAngle) * innerR)
            .attr('x2', Math.cos(targetAngle) * outerR)
            .attr('y2', Math.sin(targetAngle) * outerR);
        
        // Etiqueta del target
        g.append('text')
            .attr('class', 'gauge-label')
            .attr('x', Math.cos(targetAngle) * (radius * 1.15))
            .attr('y', Math.sin(targetAngle) * (radius * 1.15))
            .attr('dy', '0.35em')
            .text(`Target: ${formatNumber(targetValue)}`)
            .attr('font-size', '11px')
            .attr('fill', '#333');
    }
    
    // Aguja (needle)
    const needleLength = radius * 0.65;
    const needleAngle = angleScale(currentValue) * Math.PI / 180;
    
    const needleGroup = g.append('g')
        .attr('class', 'gauge-needle');
    
    // Triángulo de la aguja
    needleGroup.append('path')
        .attr('d', `M -3 0 L 0 ${-needleLength} L 3 0 Z`)
        .attr('fill', '#333')
        .attr('transform', `rotate(${angleScale(currentValue)})`);
    
    // Centro de la aguja
    needleGroup.append('circle')
        .attr('r', 8)
        .attr('fill', '#333');
    
    needleGroup.append('circle')
        .attr('r', 5)
        .attr('fill', '#fff');
    
    // Valor actual (texto central)
    g.append('text')
        .attr('class', 'gauge-text')
        .attr('y', 15)
        .text(formatNumber(currentValue));
    
    // Etiquetas min/max
    const labelRadius = radius * 1.15;
    
    g.append('text')
        .attr('class', 'gauge-label')
        .attr('x', Math.cos(gaugeConfig.startAngle * Math.PI / 180) * labelRadius)
        .attr('y', Math.sin(gaugeConfig.startAngle * Math.PI / 180) * labelRadius)
        .attr('dy', '1em')
        .text(formatNumber(gaugeConfig.minValue));
    
    g.append('text')
        .attr('class', 'gauge-label')
        .attr('x', Math.cos(gaugeConfig.endAngle * Math.PI / 180) * labelRadius)
        .attr('y', Math.sin(gaugeConfig.endAngle * Math.PI / 180) * labelRadius)
        .attr('dy', '1em')
        .text(formatNumber(gaugeConfig.maxValue));
}

// Formatear números
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toFixed(0);
    }
}

// Mostrar mensaje de error
function showError(message) {
    const container = document.getElementById('gauge-container');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// Redimensionar cuando cambia el tamaño de la ventana
window.addEventListener('resize', () => {
    if (currentValue !== null) {
        renderGauge();
    }
});