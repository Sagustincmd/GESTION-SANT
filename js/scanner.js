// scanner.js — Escáner y etiquetas

// Genera un código de barras estable y único a partir del ID del producto
function generarCodigo(id) {
  // Hash simple pero consistente: siempre da el mismo número para el mismo id
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  }
  const n = Math.abs(h) % 10000000000;
  return '789' + String(n).padStart(10, '0');
}

// SCANNER

async function cargarScanner() {
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];
  // Generar productos demo con codigos estables
  scannerProductos = allProductos.slice(0, 8).map(p => ({
    ...p,
    codigo: generarCodigo(p.id)
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

document.addEventListener('input', e => {
  if (e.target.id === 'scan-input') {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (document.getElementById('scan-input').value.length >= 8) procesarScan();
    }, 200);
  }
});

async function procesarScan() {
  const codigo = document.getElementById('scan-input').value.trim();
  if (!codigo) return;
  const resEl = document.getElementById('scan-resultado');
  const boxEl = document.getElementById('scan-resultado-box');
  resEl.style.display = 'block';

  // Buscar primero en todos los productos cargados usando código generado
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];
  const prod = allProductos.find(p => generarCodigo(p.id) === codigo);

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

// ETIQUETAS — Cola de impresión masiva
let colaEtiquetas = []; // [{ id, modelo, marca, talle, color, cantidad }]

function buscarParaEtiqueta() {
  const q = document.getElementById('etiq-search').value;
  if (q.length < 2) { document.getElementById('etiq-lista').innerHTML = ''; return; }
  const matches = allProductos.filter(p => matchTerminos(p, q)).slice(0, 8);
  document.getElementById('etiq-lista').innerHTML = matches.map(p =>
    `<div class="etiq-item" onclick="agregarALaCola('${p.id}')">
      <strong>${p.modelo}</strong> — T${p.talle} ${p.color||''}
      <span style="float:right;color:var(--text3);font-size:12px">${p.marca||''}</span>
    </div>`
  ).join('');
}

function agregarALaCola(id) {
  const p = allProductos.find(x => x.id === id);
  if (!p) return;
  const existente = colaEtiquetas.find(x => x.id === id);
  if (existente) {
    existente.cantidad++;
  } else {
    colaEtiquetas.push({ id: p.id, modelo: p.modelo, marca: p.marca||'', talle: p.talle||'', color: p.color||'', cantidad: 1 });
  }
  document.getElementById('etiq-search').value = '';
  document.getElementById('etiq-lista').innerHTML = '';
  const codigo = generarCodigo(p.id);
  if (!scannerProductos.find(x => x.id === id)) {
    scannerProductos.push({ ...p, codigo });
    document.getElementById('scan-chips').innerHTML += `<span class="prod-chip" onclick="simularScan('${codigo}')" style="border-color:var(--green);color:var(--green)">★ ${p.modelo} T${p.talle}</span>`;
  }
  renderCola();
  toast('Agregado a la cola: ' + p.modelo);
}

function quitarDeCola(id) {
  colaEtiquetas = colaEtiquetas.filter(x => x.id !== id);
  renderCola();
}

function renderCola() {
  const vacioEl = document.getElementById('etiq-cola-vacia');
  const colaEl = document.getElementById('etiq-cola');
  if (!colaEtiquetas.length) {
    vacioEl.style.display = 'block';
    colaEl.innerHTML = '';
    return;
  }
  vacioEl.style.display = 'none';
  colaEl.innerHTML = colaEtiquetas.map(item =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg2);border-radius:8px">
      <div>
        <div style="font-size:13px;font-weight:600">${item.modelo}</div>
        <div style="font-size:11px;color:var(--text3)">${item.marca} · T${item.talle}${item.color ? ' · '+item.color : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="cambiarCantidad('${item.id}',-1)" style="background:var(--bg3);border:none;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px">−</button>
        <span style="font-size:14px;font-weight:700;min-width:20px;text-align:center">${item.cantidad}</span>
        <button onclick="cambiarCantidad('${item.id}',1)" style="background:var(--bg3);border:none;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px">+</button>
        <button onclick="quitarDeCola('${item.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;padding:2px 4px">✕</button>
      </div>
    </div>`
  ).join('');
}

function cambiarCantidad(id, delta) {
  const item = colaEtiquetas.find(x => x.id === id);
  if (!item) return;
  item.cantidad = Math.max(1, item.cantidad + delta);
  renderCola();
}

function limpiarCola() {
  if (!colaEtiquetas.length) return;
  colaEtiquetas = [];
  renderCola();
}

function imprimirTodas() {
  if (!colaEtiquetas.length) { toast('La cola está vacía', 'error'); return; }

  let etiquetasHtml = '';
  for (const item of colaEtiquetas) {
    const codigo = generarCodigo(item.id);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(svgNS, 'svg');
    svgEl.setAttribute('id', '_tmp_bc_' + item.id);
    document.body.appendChild(svgEl);
    JsBarcode('#_tmp_bc_' + item.id, codigo, {
      format: 'CODE128', width: 1.5, height: 40,
      displayValue: true, fontSize: 10, margin: 4,
      lineColor: '#000', background: '#fff'
    });
    const barcodeSvg = svgEl.outerHTML;
    document.body.removeChild(svgEl);

    for (let i = 0; i < item.cantidad; i++) {
      etiquetasHtml += `<div class="etiqueta">
        <div class="marca">${item.marca}</div>
        <div class="modelo">${item.modelo}</div>
        <div class="detalle">T${item.talle}${item.color ? ' · '+item.color : ''}</div>
        ${barcodeSvg}
      </div>`;
    }
  }

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    @page { size: 50mm 25mm; margin: 0 !important; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { margin: 0 !important; padding: 0 !important; }
    body { font-family: Arial, sans-serif; background: #fff; margin: 0 !important; padding: 0 !important; }
    .etiqueta { width: 50mm; height: 25mm; text-align: center; padding: 0.5mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; }
    .marca { font-size: 5.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #666; line-height: 1.1; }
    .modelo { font-size: 7.5pt; font-weight: 700; color: #000; margin: 0.2mm 0; line-height: 1.1; }
    .detalle { font-size: 6.5pt; color: #444; margin-bottom: 0.3mm; line-height: 1.1; }
    svg { width: 47mm !important; height: 12mm !important; display: block; margin: 0 auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
  </head><body>${etiquetasHtml}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
