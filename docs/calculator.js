var seq_var = []
var loopPoint = -1

const worker = new Worker("worker.js");
worker.onmessage = function (event) {
  seq_var = event.data.seq
  loopPoint = event.data.hasLoop ? event.data.loopStart : -1
  console.timeEnd('Calculation done')
  grab('#seq').innerHTML = `<table><th>Steps</th><th>Number</th><th>Base ${event.data.base}</th></table>`
  grab('#calculateBTN').value = 'Calculate'
  grab('#calculateBTN').disabled = false;

  // Log para debugging
  console.log(`Cálculo completado - Bucle encontrado: ${event.data.hasLoop}, Pasos: ${seq_var.length - 1}`)

  tableWorker.postMessage({
    'seq': seq_var.slice(0, 100),
    'next': 100,
    'base': event.data.base,
    'loopPoint': loopPoint >= 0 ? loopPoint : seq_var.length
  });
  summarize();
  grab('#button-container').style.display = 'flex';
};

const tableWorker = new Worker("table.js");
const MAX_VISIBLE_TABLES = 5;
tableWorker.onmessage = function (event) {
  let newtablestr = event.data.tablestr
  addTable(newtablestr)
  if (event.data.next >= seq_var.length) {
    grab('#loader').style.display = 'none';
  }
  window.onscroll = () => {
    grab('#backToTop').style.marginRight = window.pageYOffset < 16 ? '-5rem' : '0'
    if ((window.innerHeight + window.pageYOffset + 100) >= document.body.offsetHeight) {
      for (table of document.querySelectorAll('#seq > table')) {
        if (table.style.display == 'none') {
          table.style.display = 'table'
          break
        }
      }
      if (event.data.next < seq_var.length) {
        tableWorker.postMessage({
          'seq': seq_var.slice(event.data.next, event.data.next + 100),
          'next': event.data.next + 100,
          'base': event.data.base,
          'loopPoint': event.data.loopPoint
        })
      }
      else {
        grab('#loader').style.display = 'none';
      }
    }
  };
}

function extractParams(ids) {
  let parameters = {}
  for (id of ids) {
    let rawnumberstr = grab(id).value.trim();
    let numberstr = rawnumberstr.replace(/[^\d-]/g, '');

    // Evita múltiples signos negativos
    if (numberstr.split('-').filter(x => x === '').length > 1) {
        numberstr = numberstr.replace(/-+/g, '-');
    }

    // Remueve ceros al inicio preservando el signo
    if (numberstr.startsWith('-')) {
      numberstr = '-' + numberstr.slice(1).replace(/^0+/, '') || '-0';
    } else {
      numberstr = numberstr.replace(/^0+/, '') || '0';
    }

    try {
      parameters[id.slice(1)] = BigInt(numberstr)
    } catch (err) {
      if (id == '#offset' || id == '#base') {
        parameters[id.slice(1)] = 0n;
      }
      else {
        showError(id)
        return null
      }
    }
  }
  if (parameters.base <= 36 && parameters.base >= 2) {
    return parameters
  }
  grab('#baseLimit').style.color = '#f22';
  showError('#base')
  setTimeout(() => { grab('#baseLimit').style.color = '#bbb' }, 2000)
  return null
}

function addTable(tablestr) {
  grab("#seq").style.display = 'block';
  grab('#seq > table').style.display = 'table';
  let faketable = document.createElement('table')
  faketable.style.display = 'none';
  faketable.innerHTML = tablestr;
  grab('#seq').appendChild(faketable)

  // Limita tablas visibles a MAX_VISIBLE_TABLES
  const tables = document.querySelectorAll('#seq > table');
  if (tables.length > MAX_VISIBLE_TABLES) {
    tables[0].style.display = 'none';
  }

  if (tables.length <= 2) {
    faketable.style.display = 'table';
  }
}

var seq_num = []
function safeNumberConversion(bigintValue) {
  const MAX_SAFE = Number.MAX_SAFE_INTEGER;
  if (bigintValue <= MAX_SAFE) {
    return Number(bigintValue);
  }
  // Para valores muy grandes, usa logaritmo en base 10
  const str = bigintValue.toString();
  const exponent = str.length - 1;
  const mantissa = parseInt(str.slice(0, 6)) / 100000;
  return mantissa * Math.pow(10, exponent);
}

function summarize() {
  if (seq_num.length == 0) {
    seq_num = seq_var.map((value) => safeNumberConversion(value))
  }
  grab('#summary tr:nth-child(3) v').textContent = seq_num.length - 1;
  [multiplier, offset] = grab('#summary tr:nth-child(2) v').textContent.split('n')
  multiplier = BigInt(multiplier)
  offset = BigInt(offset)
  grab('#converge-loop').style.display = 'none'
  grab('#converge-unknown').style.display = 'none'
  grab('#converge-inf').style.display = 'none'

  // Verifica si hay bucle (loopPoint >= 0 significa que se encontró un bucle)
  if (loopPoint >= 0 && loopPoint < seq_var.length - 1) {
    console.log(`Bucle detectado en índice ${loopPoint}`)
    console.log(seq_num.slice(loopPoint, -1))
    loopMin = Math.min(...seq_num.slice(loopPoint, -1)).toString(36)
    grab('#converge-loop').style.display = 'flex'
    grab('#converge-loop > span:nth-child(2) v').textContent = seq_num.length - loopPoint - 1
    grab('#converge-loop > span:nth-child(3) v').textContent = `${multiplier.toString(36)}${offset<0 ? '' : '+'}${offset.toString(36)}_${loopMin}`
  } else if ((multiplier + offset) % 2n == 1n) {
    console.log('Formato diverge al infinito (multiplicador + offset es impar)')
    grab('#converge-inf').style.display = 'flex'
  } else {
    console.log('No se pudo determinar convergencia - se agotaron los pasos sin encontrar bucle')
    grab('#converge-unknown').style.display = 'flex'
  }

}

function renderChart() {
  console.time('comp')
  if (seq_num.length == 0) {
    seq_num = seq_var.map((value) => safeNumberConversion(value))
  }
  console.timeEnd('comp')
  let seq = seq_var;
  // Si no hay bucle, usa la longitud de la secuencia como loopPoint
  let effectiveLoopPoint = loopPoint >= 0 ? loopPoint : seq.length
  
  let ctx = document.createElement('canvas')
  ctx.style.display = 'none';
  let xData = new Array(seq.length).fill()
  xData = xData.map((value, index) => { return (index)})

  // Si hay bucle, muestra la parte antes del bucle
  // Si no, muestra toda la secuencia
  let yData = loopPoint >= 0 ? seq_num.slice(0, loopPoint + 1) : seq_num

  // Si hay bucle, muestra la parte del bucle
  // Si no, dejar vacío
  let loopData = loopPoint >= 0 ? new Array(loopPoint).fill().concat(seq_num.slice(loopPoint)) : []

  // Línea de conexión del bucle (solo si hay bucle)
  let loopJoin = new Array(seq.length).fill();
  if (loopPoint >= 0) {
    loopJoin[loopPoint] = seq_num[loopPoint]
    loopJoin[seq.length-1] = seq_num[seq.length-1]
  }
  
  let data = {
    labels: xData,
    datasets: [{
      label: 'Steps',
      data: yData,
      fill: false,
      borderColor: 'rgb(46, 204, 113)',
      tension: 0,
      pointRadius: 0,
      pointHitRadius: 2,
      borderWidth: 1
    }, {
      label: 'Loop Steps',
      data: loopData,
      fill: false,
      borderColor: 'rgb(244, 96, 54)',
      tension: 0,
      pointRadius: 0,
      pointHitRadius: 2,
      borderWidth: 2
    }, {
      label: 'Loop Back',
      data: loopJoin,
      fill: false,
      spanGaps: true,
      borderColor: 'rgb(230, 126, 34)',
      tension: 0,
      pointRadius: 0,
      pointHitRadius: 2,
      borderWidth: 2
    }]
  }
  let myChart = new Chart(ctx, {
    type: 'line',
    data: data
  });
  myChart.options.scales['y'].ticks = {
    callback: function (value, index, values) {
      let order = Math.floor(Math.log10(Math.abs(value)))
      return order > 4 ? (value / 10 ** order).toFixed(1) + 'e' + order : value;
    }
  }
  myChart.options.plugins.legend.display = false;
  grab('#chart').innerHTML = '';
  grab('#chart').appendChild(ctx)
  ctx.style.display = 'block';
  grab("#chart").style.display = 'block'
  grab('#renderBTN').disabled = false
  grab('#renderBTN > b').textContent = 'Render Chart'
}

function showError(id) {
  grab(id).classList = 'error'
  setTimeout(() => { grab(id).classList = '' }, 2000)
}

function calculate() {
  let parameters = extractParams(['#startNum', '#multiplier', '#offset', '#maxsteps', '#base'])
  seq_num = []
  seq_var = []
  
  if (parameters == null) {
    grab('#calculateBTN').disabled = false;
    grab('#calculateBTN').value = 'Calculate';
    return;
  }
  
  console.time('Calculation done')
  console.log(parameters)
  worker.postMessage(parameters)
  grab('#calculateBTN').disabled = true
  grab('#calculateBTN').value = 'Calculating'
  grab('#loader').style.display = 'flex';
  grab('#summary tr:nth-child(1) v').textContent = parameters.startNum
  grab('#summary tr:nth-child(2) v').textContent = `${parameters.multiplier}n${parameters.offset < 0 ? '' : '+'}${parameters.offset}`
}

grab = (query) => { return document.querySelector(query) }

grab('#calculateBTN').addEventListener('click', () => {
  grab('#button-container').style.display = 'none';
  grab('#loader').style.display = 'none';
  try {
    grab("#seq").innerHTML = ''
    grab("#seq").style.display = 'none';
    grab("#chart").innerHTML = ''
    grab("#chart").style.display = 'none';
  } catch { }
  calculate()
})

grab('#startNum').addEventListener('keydown', (e) => {
  if (e.key == 'Enter') {
    grab('#calculateBTN').click()
    e.preventDefault();
  }
});

grab('#renderBTN').addEventListener('click', () => {
  console.time('Rendered Chart')
  grab('#renderBTN').disabled = true
  grab('#renderBTN > b').textContent = 'Rendering'

  try {
    setTimeout(() => {
      renderChart()
      console.timeEnd('Rendered Chart')
    }, 50);
  } catch (error) {
    console.error('Error al renderizar el gráfico:', error)
    grab('#renderBTN').disabled = false
    grab('#renderBTN > b').textContent = 'Error - Try Again'
    setTimeout(() => {
      grab('#renderBTN > b').textContent = 'Render Chart'
    }, 3000)
  }
});

grab('#downloadBTN').addEventListener('click', () => {
  console.time('Downloaded CSV')
  grab('#downloadBTN').disabled = true
  grab('#downloadBTN > b').textContent = 'Downloading'
  setTimeout(() => {
    downloadCSV()
    console.timeEnd('Downloaded CSV')
  }, 50);
});

// When the user clicks on the button, scroll to the top of the document
grab('#backToTop').addEventListener('click', () => {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
});

grab('#summaryBTN').addEventListener('click', () => {
  console.log('clicked o summary')
  grab('#summary-bg').style.display = 'flex';
});

grab('#summary-top > span').addEventListener('click', () => {
  grab('#summary-bg').style.display = 'none';
});

grab('#summary-bg').addEventListener('click', () => {
  if (grab('#summary:hover') == null) {
    grab('#summary-bg').style.display = 'none';
  }
});

for (tooltip of document.querySelectorAll('tooltip')) {
  content = tooltip.innerHTML;
  tooltip.innerHTML = `<span class="material-icons">info</span>
  <span>${content}</span>`
}

function downloadCSV() {
  let csvText = seq_var.join('%0A')
  let element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + csvText);
  element.setAttribute('download', 'collatz.csv');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  grab('#downloadBTN > b').textContent = 'Download'
  grab('#downloadBTN').disabled = false;
}