/**
 * Fractal de Collatz en el Plano Complejo - Web Worker
 * Calcula la magnitud de iteraciones para cada píxel paralelamente en la GPU/CPU
 *
 * Fórmula: f(z) = 0.25 * (1 + 4z - (1 + 2z) * cos(π * z))
 * Criterio de escape: |z|² > 10000
 */

/**
 * Calcula el coseno de un número complejo
 * cos(x + iy) = cos(x)*cosh(y) - i*sin(x)*sinh(y)
 *
 * @param {Object} z - {real: x, imag: y}
 * @returns {Object} {real, imag} - resultado del coseno
 */
function complexCos(z) {
    const { real: x, imag: y } = z;
    const cosX = Math.cos(x);
    const sinX = Math.sin(x);
    const coshY = Math.cosh(y);
    const sinhY = Math.sinh(y);

    return {
        real: cosX * coshY,
        imag: -sinX * sinhY
    };
}

/**
 * Suma dos números complejos
 * @param {Object} z1 - {real, imag}
 * @param {Object} z2 - {real, imag}
 * @returns {Object} z1 + z2
 */
function complexAdd(z1, z2) {
    return {
        real: z1.real + z2.real,
        imag: z1.imag + z2.imag
    };
}

/**
 * Resta dos números complejos
 * @param {Object} z1 - {real, imag}
 * @param {Object} z2 - {real, imag}
 * @returns {Object} z1 - z2
 */
function complexSub(z1, z2) {
    return {
        real: z1.real - z2.real,
        imag: z1.imag - z2.imag
    };
}

/**
 * Multiplica dos números complejos
 * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 * @param {Object} z1 - {real, imag}
 * @param {Object} z2 - {real, imag}
 * @returns {Object} z1 * z2
 */
function complexMul(z1, z2) {
    const { real: a, imag: b } = z1;
    const { real: c, imag: d } = z2;
    return {
        real: a * c - b * d,
        imag: a * d + b * c
    };
}

/**
 * Multiplica un número complejo por un escalar
 * @param {Object} z - {real, imag}
 * @param {number} scalar
 * @returns {Object} z * scalar
 */
function complexScalarMul(z, scalar) {
    return {
        real: z.real * scalar,
        imag: z.imag * scalar
    };
}

/**
 * Calcula la magnitud al cuadrado de un número complejo
 * |z|² = x² + y²
 * @param {Object} z - {real, imag}
 * @returns {number} |z|²
 */
function complexMagnitudeSq(z) {
    return z.real * z.real + z.imag * z.imag;
}

/**
 * Aplica una iteración de la función de Collatz compleja
 * f(z) = 0.25 * (1 + 4z - (1 + 2z) * cos(π * z))
 *
 * @param {Object} z - {real, imag}
 * @returns {Object} f(z)
 */
function collatzComplexStep(z) {
    // 1 + 4z
    const one = { real: 1, imag: 0 };
    const four = { real: 4, imag: 0 };
    const fourZ = complexMul(four, z);
    const part1 = complexAdd(one, fourZ); // 1 + 4z

    // 1 + 2z
    const two = { real: 2, imag: 0 };
    const twoZ = complexMul(two, z);
    const part2 = complexAdd(one, twoZ); // 1 + 2z

    // cos(π * z)
    const pi = Math.PI;
    const piZ = complexScalarMul(z, pi);
    const cosPiZ = complexCos(piZ);

    // (1 + 2z) * cos(π * z)
    const part3 = complexMul(part2, cosPiZ);

    // 1 + 4z - (1 + 2z) * cos(π * z)
    const part4 = complexSub(part1, part3);

    // 0.25 * (...)
    const result = complexScalarMul(part4, 0.25);

    return result;
}

/**
 * Calcula el número de iteraciones hasta escape para un punto en el plano complejo
 *
 * @param {number} x - coordenada real
 * @param {number} y - coordenada imaginaria
 * @param {number} maxIterations - límite de iteraciones
 * @param {number} escapeThreshold - umbral de escape (|z|²)
 * @returns {number} iteraciones hasta escape (o maxIterations si no escapa)
 */
function calculateIterations(x, y, maxIterations, escapeThreshold) {
    let z = { real: x, imag: y };

    for (let i = 0; i < maxIterations; i++) {
        const magSq = complexMagnitudeSq(z);
        if (magSq > escapeThreshold) {
            return i; // Escapó en iteración i
        }
        z = collatzComplexStep(z);
    }

    return maxIterations; // No escapó
}

/**
 * Renderiza una banda de píxeles del fractal
 * Worker recibe: {width, height, startRow, endRow, rMin, rMax, iMin, iMax, maxIter, escapeThreshold}
 */
self.addEventListener('message', function (event) {
    const {
        width,
        height,
        startRow,
        endRow,
        rMin, // Mínimo real (x)
        rMax, // Máximo real (x)
        iMin, // Mínimo imaginario (y)
        iMax, // Máximo imaginario (y)
        maxIter,
        escapeThreshold
    } = event.data;

    // Calcula el tamaño de cada píxel en el plano complejo
    const rStep = (rMax - rMin) / width;
    const iStep = (iMax - iMin) / height;

    // Array para almacenar los datos: [r, g, b, a, r, g, b, a, ...]
    const imageData = new Uint8ClampedArray((endRow - startRow) * width * 4);
    let pixelIndex = 0;

    // Itera sobre cada píxel en la banda
    for (let row = startRow; row < endRow; row++) {
        for (let col = 0; col < width; col++) {
            // Convierte coordenadas de píxeles a coordenadas del plano complejo
            const realCoord = rMin + col * rStep;
            const imagCoord = iMin + row * iStep; // Y crece hacia abajo, pero invierte para que aumente hacia arriba

            // Calcula iteraciones
            const iterations = calculateIterations(
                realCoord,
                imagCoord,
                maxIter,
                escapeThreshold
            );

            // Mapea iteraciones a color usando paleta eléctrica
            let r, g, b;
            if (iterations === maxIter) {
                // Punto no escapó (atractor) - negro
                r = 0;
                g = 0;
                b = 0;
            } else {
                // Gradiente basado en iteraciones: azul marino → azul neón → blanco
                const t = iterations / maxIter; // Normalizado [0, 1]

                if (t < 0.3) {
                    // Azul marino profundo (0x001a33)
                    r = Math.floor(0 + t / 0.3 * 0);
                    g = Math.floor(26 + t / 0.3 * 50);
                    b = Math.floor(51 + t / 0.3 * 100);
                } else if (t < 0.6) {
                    // Transición a azul neón
                    const t2 = (t - 0.3) / 0.3;
                    r = Math.floor(0 + t2 * 50);
                    g = Math.floor(76 + t2 * 180);
                    b = Math.floor(151 + t2 * 100);
                } else if (t < 0.85) {
                    // Azul neón a cian
                    const t3 = (t - 0.6) / 0.25;
                    r = Math.floor(50 + t3 * 50);
                    g = Math.floor(255 + t3 * 0);
                    b = Math.floor(251 + t3 * 0);
                } else {
                    // Cian a blanco brillante
                    const t4 = (t - 0.85) / 0.15;
                    r = Math.floor(100 + t4 * 155);
                    g = Math.floor(255);
                    b = Math.floor(251 + t4 * 4);
                }
            }

            // Escribe píxel RGBA
            imageData[pixelIndex++] = r;
            imageData[pixelIndex++] = g;
            imageData[pixelIndex++] = b;
            imageData[pixelIndex++] = 255; // Alpha = opaco
        }
    }

    // Envía resultado al hilo principal
    self.postMessage({
        startRow,
        endRow,
        imageData
    });
});

