// scanner.js — Escáner de códigos y generador de etiquetas

let scannerProductos = [];

async function cargarScanner() {
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];
  // Generar productos demo con codigos
  scannerProductos = allProductos.slice(0, 8).map((p, i) => ({
    ...p,
    codigo: '789000000' + String(i+1).padStart(4,'0')
  }));
  // Render chips demo
  document.getElementById('scan-chips').innerHTML = scannerProductos.map(p =>
    `<span class="prod-chip" onclick="simularScan('${p.codigo}')">${p.modelo} T${p.talle} ${p.color||''}</span>`
  ).join('');
  document.getElementById('scan-input').focus();
}

function simularScan(codigo) {
  document.getElementById('scan-input').value = codigo;
  procesarScan();
}

let scanTimer = null;
document.addEventListener('input', e => {
  if (e.target.id === 'scan-input') {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (document.getElementById('scan-input').value.length >= 8) procesarScan();
    }, 200);
  }
});

function procesarScan() {
  const codigo = document.getElementById('scan-input').value.trim();
  if (!codigo) return;
  const prod = scannerProductos.find(p => p.codigo === codigo);
  const resEl = document.getElementById('scan-resultado');
  const boxEl = document.getElementById('scan-resultado-box');
  resEl.style.display = 'block';
  if (prod) {
    boxEl.style.borderColor = 'var(--green)';
    document.getElementById('scan-nombre').textContent = prod.modelo;
    document.getElementById('scan-detalle').textContent = prod.marca + ' · T' + prod.talle + ' · ' + (prod.color||'');
    document.getElementById('scan-precio').textContent = fmt(prod.precio);
    document.getElementById('scan-stock').textContent = 'Stock: ' + (prod.stock||0) + ' unidades';
  } else {
    boxEl.style.borderColor = 'var(--red)';
    document.getElementById('scan-nombre').textContent = 'Producto no encontrado';
    document.getElementById('scan-detalle').textContent = 'Código: ' + codigo;
    document.getElementById('scan-precio').textContent = '—';
    document.getElementById('scan-stock').textContent = '';
  }
  setTimeout(() => document.getElementById('scan-input').value = '', 1000);
}

// ETIQUETAS
function buscarParaEtiqueta() {
  const q = document.getElementById('etiq-search').value;
  if (q.length < 2) { document.getElementById('etiq-lista').innerHTML = ''; return; }
  const matches = allProductos.filter(p => matchTerminos(p, q)).slice(0, 8);
  document.getElementById('etiq-lista').innerHTML = matches.map(p =>
    `<div class="etiq-item" onclick="seleccionarEtiqueta('${p.id}')">
      <strong>${p.modelo}</strong> — T${p.talle} ${p.color||''}
      <span style="float:right;color:var(--text3);font-size:12px">${p.marca||''}</span>
    </div>`
  ).join('');
}

function seleccionarEtiqueta(id) {
  const p = allProductos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('etiq-search').value = p.modelo + ' T' + p.talle;
  document.getElementById('etiq-lista').innerHTML = '';
  document.getElementById('etiq-marca-r').textContent = p.marca || '';
  document.getElementById('etiq-modelo-r').textContent = p.modelo || '';
  document.getElementById('etiq-detalle-r').textContent = 'T' + (p.talle||'') + ' · ' + (p.color||'');
  const codigo = '789' + p.id.replace(/[^0-9]/g,'').slice(0,10).padEnd(10,'0');
  JsBarcode('#etiq-barcode', codigo, {
    format: 'CODE128', width: 1.5, height: 40,
    displayValue: true, fontSize: 10, margin: 4,
    lineColor: '#000', background: '#fff'
  });
  // Agregar a scannerProductos para poder escanear
  if (!scannerProductos.find(x => x.id === id)) {
    scannerProductos.push({ ...p, codigo });
    document.getElementById('scan-chips').innerHTML += `<span class="prod-chip" onclick="simularScan('${codigo}')" style="border-color:var(--green);color:var(--green)">★ ${p.modelo} T${p.talle}</span>`;
  }
  document.getElementById('etiq-preview').style.display = 'block';
}

function imprimirEtiqueta() {
  const marca = document.getElementById('etiq-marca-r').textContent;
  const modelo = document.getElementById('etiq-modelo-r').textContent;
  const detalle = document.getElementById('etiq-detalle-r').textContent;
  const barcodeSvg = document.getElementById('etiq-barcode').outerHTML;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    @page { size: 58mm 38mm; margin: 0 !important; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { margin: 0 !important; padding: 0 !important; }
    body { width: 58mm; height: 38mm; overflow: hidden; font-family: Arial, sans-serif; background: #fff; margin: 0 !important; padding: 0 !important; }
    .etiqueta { width: 58mm; height: 38mm; text-align: center; padding: 1mm 2mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0; }
    .marca { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 1px; color: #666; line-height: 1.2; }
    .modelo { font-size: 10pt; font-weight: 700; color: #000; margin: 0.5mm 0; line-height: 1.2; }
    .detalle { font-size: 7.5pt; color: #444; margin-bottom: 1mm; line-height: 1.2; }
    svg { width: 52mm !important; height: 18mm !important; display: block; margin: 0 auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
  </head><body>
  <div class="etiqueta">
    <div class="marca">${marca}</div>
    <div class="modelo">${modelo}</div>
    <div class="detalle">${detalle}</div>
    ${barcodeSvg}
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// INIT
window.addEventListener('load', async () => {
  const { data } = await sbClient.auth.getSession();
  if (data.session) mostrarApp(data.session.user);
});
