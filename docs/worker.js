function dostep(num, multiplier, offset) {
    return (num % 2n == 0) ? num / 2n : (multiplier * num) + offset
}

function collatz(start, multiplier, offset, maxsteps) {
    let seq = new Array(maxsteps + 1n).fill(null);
    let visited = new Map(); // Guardar índice de primer encuentro

    seq[0] = start
    visited.set(start, 0)

    let next = dostep(start, multiplier, offset)
    seq[1] = next
    visited.set(next, 1)

    for (let i = 2; i < maxsteps + 1n; i++) {
        next = dostep(next, multiplier, offset)
        seq[i] = next
        if (visited.has(next)) {
            // Bucle detectado
            return {
                seq: seq.slice(0, i + 1),
                loopStart: visited.get(next),
                hasLoop: true
            }
        }
        visited.set(next, i)
    }
    // Se agotaron los pasos sin detectar bucle
    return {
        seq: seq,
        loopStart: -1,
        hasLoop: false
    }
}


self.addEventListener('message', function (e) {
    let result = collatz(e.data.startNum, e.data.multiplier, e.data.offset, e.data.maxsteps)
    postMessage({ 'seq': result.seq, 'loopStart': result.loopStart, 'hasLoop': result.hasLoop, 'base': e.data.base })
}, false)