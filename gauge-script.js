// Configuración del Gauge (Se mantiene igual)
const gaugeConfig = {
    minValue: 0,
    maxValue: 100,
    startAngle: -180, // Ajustado para semicírculo superior 
    endAngle: 0,
    colorRanges: [
        { from: 0, to: 33, color: '#ef5350' },
        { from: 33, to: 66, color: '#ffb74d' },
        { from: 66, to: 100, color: '#66bb6a' }
    ]
};

let currentValue = 0;
let targetValue = null;

// 1. INICIALIZACIÓN (Cambio clave para Viz Extensions)
tableau.extensions.initializeAsync().then(() => {
    // En Viz Extensions usamos worksheetContent, NO dashboardContent
    const worksheet = tableau.extensions.worksheetContent.worksheet;
    
    loadData();

    // Listeners para reaccionar a filtros o cambios de datos
    worksheet.addEventListener(tableau.TableauEventType.FilterChanged, loadData);
    worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, loadData);
});

async function loadData() {
    try {
        const worksheet = tableau.extensions.worksheetContent.worksheet;
        const dataTable = await worksheet.getSummaryDataAsync();
        
        if (!dataTable || dataTable.data.length === 0) {
            showError('Arrastra una medida a la tarjeta de Marcas.');
            return;
        }

        // 2. IDENTIFICACIÓN DE COLUMNAS (Basado en tu lógica)
        const columns = dataTable.columns;
        let valueIdx = 0; // Por defecto la primera columna
        let targetIdx = columns.length > 1 ? 1 : -1;

        // Extraer datos de la primera fila
        const firstRow = dataTable.data[0];
        currentValue = parseFloat(firstRow[valueIdx].value) || 0;
        
        if (targetIdx !== -1) {
            targetValue = parseFloat(firstRow[targetIdx].value) || null;
        } else {
            targetValue = 100; // Valor por defecto si no hay target
        }

        // 3. ESCALA DINÁMICA
        gaugeConfig.maxValue = targetValue > currentValue ? targetValue * 1.1 : currentValue * 1.1;
        
        renderGauge();
        
    } catch (error) {
        console.error(error);
        showError('Error al cargar datos: ' + error.message);
    }
}

// 4. RENDERIZADO (Mejorado para centrado)
function renderGauge() {
    const svg = d3.select('#gauge-svg');
    svg.selectAll('*').remove();
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const radius = Math.min(width, height) * 0.45;
    
    // El centro del semicírculo
    const centerX = width / 2;
    const centerY = height * 0.7; 

    const g = svg.append('g')
        .attr('transform', `translate(${centerX}, ${centerY})`);

    const angleScale = d3.scaleLinear()
        .domain([gaugeConfig.minValue, gaugeConfig.maxValue])
        .range([gaugeConfig.startAngle, gaugeConfig.endAngle]);

    const arc = d3.arc()
        .innerRadius(radius * 0.6)
        .outerRadius(radius);

    // Dibujar fondo gris
    g.append('path')
        .datum({startAngle: gaugeConfig.startAngle * Math.PI/180, endAngle: gaugeConfig.endAngle * Math.PI/180})
        .attr('d', arc)
        .attr('fill', '#f0f0f0');

    // Dibujar progreso (Verde)
    g.append('path')
        .datum({
            startAngle: gaugeConfig.startAngle * Math.PI/180, 
            endAngle: angleScale(currentValue) * Math.PI/180
        })
        .attr('d', arc)
        .attr('fill', '#66bb6a');

    // AGUJA
    const needleAngle = angleScale(currentValue);
    g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(needleAngle * Math.PI/180) * radius)
        .attr('y2', Math.sin(needleAngle * Math.PI/180) * radius)
        .attr('stroke', '#333')
        .attr('stroke-width', 4);

    // TEXTO
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 40)
        .attr('font-size', '24px')
        .attr('font-weight', 'bold')
        .text(formatNumber(currentValue));
}

function formatNumber(num) {
    return num.toLocaleString();
}

function showError(msg) {
    document.getElementById('gauge-container').innerHTML = `<div class="error-message">${msg}</div>`;
}

window.addEventListener('resize', renderGauge);
