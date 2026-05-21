/**
 * Web Worker para el cálculo en paralelo del Fractal de Collatz Generalizado
 */

self.onmessage = function(event) {
    const {
        width, height, startRow, endRow,
        rMin, rMax, iMin, iMax,
        maxIter, escapeThreshold,
        multiplier, offset
    } = event.data;

    const rowPixels = (endRow - startRow) * width * 4;
    const imageData = new Uint8ClampedArray(rowPixels);

    const rWidth = rMax - rMin;
    const iHeight = iMax - iMin;

    // Forzar valores correctos si llegan indefinidos
    const q = (multiplier !== undefined) ? multiplier : 3;
    const p = (offset !== undefined) ? offset : 1;

    // Constantes matemáticas precalculadas para optimizar el bucle
    const k1_r = 2 * (1 + q);
    const k2_r = 2 * (q - 1);
    const two_p = 2 * p;

    let index = 0;

    for (let y = startRow; y < endRow; y++) {
        const ci = iMin + (y / height) * iHeight;

        for (let x = 0; x < width; x++) {
            const cr = rMin + (x / width) * rWidth;

            let zr = cr;
            let zi = ci;
            let iter = 0;

            // Bucle de escape clásico
            while (iter < maxIter && (zr * zr + zi * zi) < escapeThreshold) {
                const pi_zr = Math.PI * zr;
                const pi_zi = Math.PI * zi;

                // Coseno complejo: cos(z) = cos(x)cosh(y) - i sin(x)sinh(y)
                const cos_r = Math.cos(pi_zr) * Math.cosh(pi_zi);
                const cos_i = -Math.sin(pi_zr) * Math.sinh(pi_zi);

                // Término A: 2(1+q)z + 2p
                const linear_r = k1_r * zr + two_p;
                const linear_i = k1_r * zi;

                // Término B: 2(q-1)z + 2p
                const factor_r = k2_r * zr + two_p;
                const factor_i = k2_r * zi;

                // Multiplicación compleja: B * cos(pi * z)
                const prod_r = factor_r * cos_r - factor_i * cos_i;
                const prod_i = factor_r * cos_i + factor_i * cos_r;

                // Siguiente iteración: f(z) = 0.25 * (A - B*cos)
                const next_zr = 0.25 * (linear_r - prod_r);
                const next_zi = 0.25 * (linear_i - prod_i);

                // Evitar que los valores colapsen a NaN en zonas de escape crítico
                if (isNaN(next_zr) || isNaN(next_zi)) break;

                zr = next_zr;
                zi = next_zi;
                iter++;
            }

            // --- CORRECCIÓN DE PALETA DE COLORES (Contraste Limpio) ---
            // --- NUEVA PALETA NEÓN: AZULES, MORADOS Y VERDES ELÉCTRICOS ---
            if (iter === maxIter) {
                // Núcleo atrapado: Negro matemático puro para el conjunto
                imageData[index] = 0;       // R
                imageData[index + 1] = 5;   // G
                imageData[index + 2] = 10;  // B
                imageData[index + 3] = 255; // A
            } else {
                // Mapeo cíclico/logarítmico para resaltar cambios sutiles en 5n y 7n
                // Usamos funciones trigonométricas basadas en la iteración para crear bandas de color
                const factor = iter / maxIter;

                // Tonos púrpuras, azules y verdes usando ondas desfasadas
                const r = Math.floor(Math.sin(factor * Math.PI * 2) * 127 + 128);
                const g = Math.floor(Math.sin(factor * Math.PI * 4 + 1.5) * 80 + 100);
                const b = Math.floor(Math.cos(factor * Math.PI * 1.5) * 155 + 100);

                // Inyectamos los colores neón
                imageData[index] = Math.max(0, Math.min(255, r - 50));  // R (Toques púrpuras)
                imageData[index + 1] = Math.max(0, Math.min(255, g));      // G (Transición verde/cian)
                imageData[index + 2] = Math.max(0, Math.min(255, b));      // B (Azul dominante de fondo)
                imageData[index + 3] = 255;
            }
            index += 4;
        }
    }

    self.postMessage({ startRow, endRow, imageData });
};
