/**
 * Fractal de Collatz en el Plano Complejo - Controlador Principal
 * Gestiona el canvas, coordina workers y maneja interacción del usuario
 * 
 * OPTIMIZADO PARA MOBILE-FIRST
 */

class CollatzFractalRenderer {
    constructor(canvasId, numWorkers = null) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Detecta si es dispositivo móvil
        this.isMobile = this.detectMobile();
        
        // Ajusta workers según dispositivo
        if (numWorkers === null) {
            this.numWorkers = this.isMobile ? 2 : 4;
        } else {
            this.numWorkers = numWorkers;
        }
        
        // Estado del plano complejo
        this.rMin = -2.0;
        this.rMax = 2.0;
        this.iMin = -1.0;
        this.iMax = 1.0;
        
        // Parámetros de renderizado optimizados para móvil
        this.maxIterations = this.isMobile ? 50 : 100;
        this.escapeThreshold = 10000;
        this.workers = [];
        this.pendingTasks = 0;
        
        // Para almacenar la imagen renderizada
        this.imageData = null;
        
        // Estado de renderizado
        this.isRendering = false;
        this.renderStartTime = 0;
        
        // Inicializa workers
        this.initWorkers();
        
        // Configura eventos de interacción
        this.setupInteraction();
        
        console.log(`✓ CollatzFractalRenderer inicializado`);
        console.log(`  Dispositivo: ${this.isMobile ? '📱 MOBILE' : '💻 DESKTOP'}`);
        console.log(`  Workers: ${this.numWorkers}`);
        console.log(`  Iteraciones iniciales: ${this.maxIterations}`);
    }
    
    /**
     * Detecta si es dispositivo móvil
     */
    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        const isSmallScreen = window.innerWidth < 768;
        return isMobileUA || isSmallScreen;
    }

    /**
     * Inicializa el pool de Web Workers
     */
    initWorkers() {
        for (let i = 0; i < this.numWorkers; i++) {
            const worker = new Worker('fractal-worker.js');
            worker.onmessage = (event) => this.onWorkerMessage(event);
            this.workers.push(worker);
        }
    }

    /**
     * Maneja mensajes de workers completados
     */
    onWorkerMessage(event) {
        const { startRow, endRow, imageData } = event.data;

        // Copia datos a la imagen principal
        const rowPixels = (endRow - startRow) * this.canvas.width * 4;
        const startPixel = startRow * this.canvas.width * 4;

        for (let i = 0; i < rowPixels; i++) {
            this.imageData.data[startPixel + i] = imageData[i];
        }

        this.pendingTasks--;

        // Si todos los workers terminaron, dibuja el resultado
        if (this.pendingTasks === 0) {
            this.finalizeRendering();
        }
    }

    /**
     * Finaliza el renderizado y dibuja en el canvas
     */
    finalizeRendering() {
        const elapsed = Date.now() - this.renderStartTime;
        
        this.ctx.putImageData(this.imageData, 0, 0);
        this.isRendering = false;
        
        // Actualiza el status
        if (document.getElementById('fractal-status')) {
            document.getElementById('fractal-status').textContent = `✓ Listo (${elapsed}ms)`;
            document.getElementById('fractal-status').style.color = '#2ecc71';
        }
        
        console.log(`✓ Fractal renderizado en ${elapsed}ms`);
    }

    /**
     * Renderiza el fractal completo
     */
    render() {
        if (this.isRendering) {
            console.warn('⚠️ Ya hay un renderizado en progreso...');
            return;
        }

        this.isRendering = true;
        this.renderStartTime = Date.now();

        // Actualiza status
        if (document.getElementById('fractal-status')) {
            document.getElementById('fractal-status').textContent = '⟳ Renderizando...';
            document.getElementById('fractal-status').style.color = '#f39c12';
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        console.log(`⟳ Renderizando fractal: ${width}x${height}, ${this.maxIterations} iter, ${this.numWorkers} workers`);

        // Crea el buffer de imagen
        this.imageData = this.ctx.createImageData(width, height);

        // Divide el trabajo entre workers
        const rowsPerTask = Math.ceil(height / this.numWorkers);
        this.pendingTasks = this.numWorkers;

        for (let i = 0; i < this.numWorkers; i++) {
            const startRow = i * rowsPerTask;
            const endRow = Math.min((i + 1) * rowsPerTask, height);

            if (startRow >= height) break;

            // Envía tarea al worker
            this.workers[i].postMessage({
                width,
                height,
                startRow,
                endRow,
                rMin: this.rMin,
                rMax: this.rMax,
                iMin: this.iMin,
                iMax: this.iMax,
                maxIter: this.maxIterations,
                escapeThreshold: this.escapeThreshold
            });
        }
    }

    /**
     * Configura eventos de interacción (zoom, pan)
     */
    setupInteraction() {
        // Click para zoom in
        this.canvas.addEventListener('click', (e) => {
            if (!this.isRendering) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.zoomIn(x, y);
            }
        });

        // Rueda del ratón para zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (!this.isRendering) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (e.deltaY < 0) {
                    this.zoomIn(x, y);
                } else {
                    this.zoomOut(x, y);
                }
            }
        });
    }

    /**
     * Zoom in en una posición del canvas
     * @param {number} canvasX - Posición X en el canvas
     * @param {number} canvasY - Posición Y en el canvas
     */
    zoomIn(canvasX, canvasY) {
        const zoomFactor = 0.5;
        this.zoomAt(canvasX, canvasY, zoomFactor);
    }

    /**
     * Zoom out en una posición del canvas
     * @param {number} canvasX - Posición X en el canvas
     * @param {number} canvasY - Posición Y en el canvas
     */
    zoomOut(canvasX, canvasY) {
        const zoomFactor = 2.0;
        this.zoomAt(canvasX, canvasY, zoomFactor);
    }

    /**
     * Aplica zoom en una coordenada específica del canvas
     * @param {number} canvasX - Posición X en pixels del canvas
     * @param {number} canvasY - Posición Y en pixels del canvas
     * @param {number} factor - Factor de zoom (< 1 = zoom in, > 1 = zoom out)
     */
    zoomAt(canvasX, canvasY, factor) {
        // Convierte coordenadas de píxeles a coordenadas del plano complejo
        const rWidth = this.rMax - this.rMin;
        const iHeight = this.iMax - this.iMin;

        const clickRealCoord = this.rMin + (canvasX / this.canvas.width) * rWidth;
        const clickImagCoord = this.iMin + (canvasY / this.canvas.height) * iHeight;

        // Calcula nuevo rango
        const newRWidth = rWidth * factor;
        const newIHeight = iHeight * factor;

        this.rMin = clickRealCoord - (newRWidth / 2);
        this.rMax = clickRealCoord + (newRWidth / 2);
        this.iMin = clickImagCoord - (newIHeight / 2);
        this.iMax = clickImagCoord + (newIHeight / 2);

        this.render();
    }

    /**
     * Restablece la vista al estado inicial
     */
    reset() {
        this.rMin = -2.0;
        this.rMax = 2.0;
        this.iMin = -1.0;
        this.iMax = 1.0;
        this.render();
    }

    /**
     * Ajusta la resolución del canvas
     * @param {number} width - Ancho en píxeles
     * @param {number} height - Alto en píxeles
     */
    setResolution(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.render();
    }

    /**
     * Configura el número máximo de iteraciones
     * @param {number} maxIter
     */
    setMaxIterations(maxIter) {
        this.maxIterations = Math.max(10, Math.min(1000, maxIter));
        this.render();
    }
}

// Instancia global del renderizador
let fractalRenderer = null;

/**
 * Inicializa el fractal al cargar la página
 * OPTIMIZADO PARA NUEVAS DIMENSIONES (MÁXIMO 1200px)
 */
function initFractal() {
    const canvas = document.getElementById('fractal-canvas');
    if (!canvas) {
        console.warn('Canvas de fractal no encontrado');
        return;
    }

    // Detecta dispositivo móvil
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
    ) || window.innerWidth < 768;

    // Adapta resolución según dispositivo
    let canvasWidth, canvasHeight;

    if (isMobile) {
        // MOBILE: Resolución baja para fluidez
        const maxWidth = Math.min(window.innerWidth - 20, 400);
        const maxHeight = 250;
        canvasWidth = maxWidth;
        canvasHeight = maxHeight;
        console.log(`📱 MODO MOBILE: ${canvasWidth}x${canvasHeight}`);
    } else {
        // DESKTOP: Resolución ampliada sincronizada con el nuevo CSS de 1200px
        const container = document.getElementById('fractal-container');
        if (container) {
            // Permitimos que crezca hasta 1200px (restando un pequeño margen)
            canvasWidth = Math.min(container.offsetWidth - 20, 1200);
            // Mantenemos la proporción perfecta 2:1 calculando la mitad del ancho
            canvasHeight = canvasWidth / 2;
        } else {
            canvasWidth = 1200;
            canvasHeight = 600;
        }
        console.log(`💻 MODO DESKTOP: ${canvasWidth}x${canvasHeight}`);
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Crea el renderizador
    const numWorkers = isMobile ? 2 : 4;
    fractalRenderer = new CollatzFractalRenderer('fractal-canvas', numWorkers);

    // Renderiza por primera vez
    fractalRenderer.render();

    // Configura controles
    const resetBtn = document.getElementById('fractal-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => fractalRenderer.reset());
    }

    const renderBtn = document.getElementById('fractal-render-btn');
    if (renderBtn) {
        renderBtn.addEventListener('click', () => fractalRenderer.render());
    }

    const iterInput = document.getElementById('fractal-iterations-input');
    if (iterInput) {
        // Para mobile, limita iteraciones máximas
        if (isMobile) {
            iterInput.max = '200';
            iterInput.value = '50';
        }
        iterInput.addEventListener('change', (e) => {
            const newIter = parseInt(e.target.value);
            console.log(`Cambiando iteraciones a ${newIter}`);
            fractalRenderer.setMaxIterations(newIter);
        });
    }

    console.log(`✓ Fractal inicializado para ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
}

// Inicializa al cargar el DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFractal);
} else {
    initFractal();
}

