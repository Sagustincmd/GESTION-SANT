// controlstock.js — Control de stock físico

let csConteo = {}; // { id: cantidad_escaneada }
let csFiltro = 'todos';
let csTimer = null;

async function cargarControlStock() {
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];
  document.getElementById('cs-input').focus();
  renderResumen();
}

function procesarScanStock() {
  clearTimeout(csTimer);
  csTimer = setTimeout(() => {
    const codigo = document.getElementById('cs-input').value.trim();
    if (!codigo) return;
    const prod = allProductos.find(p => generarCodigo(p.id) === codigo);
    const ultimoEl = document.getElementById('cs-ultimo');
    if (prod) {
      csConteo[prod.id] = (csConteo[prod.id] || 0) + 1;
      ultimoEl.innerHTML = `<span style="color:var(--green)">✓ ${prod.modelo} T${prod.talle} — conteo: ${csConteo[prod.id]}</span>`;
      renderResumen();
    } else {
      ultimoEl.innerHTML = `<span style="color:var(--red)">✗ Código no encontrado: ${codigo}</span>`;
    }
    document.getElementById('cs-input').value = '';
  }, 200);
}

function renderResumen() {
  const ids = Object.keys(csConteo);
  const vacioEl = document.getElementById('cs-resumen-vacio');
  const resEl = document.getElementById('cs-resumen');
  if (!ids.length) {
    vacioEl.style.display = 'block';
    resEl.innerHTML = '';
    return;
  }
  vacioEl.style.display = 'none';
  resEl.innerHTML = ids.map(id => {
    const p = allProductos.find(x => x.id === id);
    if (!p) return '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface2);border-radius:8px">
      <div>
        <div style="font-size:13px;font-weight:600">${p.modelo} T${p.talle}</div>
        <div style="font-size:11px;color:var(--text3)">${p.marca||''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:14px;font-weight:700;font-family:var(--mono)">${csConteo[id]}</span>
        <button onclick="quitarDelConteo('${id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>
      </div>
    </div>`;
  }).join('');
}

function quitarDelConteo(id) {
  delete csConteo[id];
  renderResumen();
}

function limpiarConteo() {
  if (!Object.keys(csConteo).length) return;
  if (!confirm('¿Limpiar todo el conteo?')) return;
  csConteo = {};
  renderResumen();
  document.getElementById('cs-diferencias-wrap').style.display = 'none';
  document.getElementById('cs-diferencias-empty').style.display = 'block';
}

function verDiferencias() {
  const rows = allProductos.map(p => ({
    id: p.id,
    modelo: p.modelo,
    talle: p.talle,
    marca: p.marca||'',
    sistema: p.stock || 0,
    conteo: csConteo[p.id] !== undefined ? csConteo[p.id] : null
  })).filter(r => r.conteo !== null);

  if (!rows.length) { toast('No hay productos escaneados', 'error'); return; }

  rows.sort((a, b) => Math.abs(b.conteo - b.sistema) - Math.abs(a.conteo - a.sistema));
  document.getElementById('cs-diferencias-wrap').style.display = 'block';
  document.getElementById('cs-diferencias-empty').style.display = 'none';
  renderTablaDifs(rows);
}

function renderTablaDifs(rows) {
  const filtered = csFiltro === 'dif' ? rows.filter(r => r.conteo !== r.sistema)
    : csFiltro === 'ok' ? rows.filter(r => r.conteo === r.sistema)
    : rows;

  document.getElementById('cs-tabla-body').innerHTML = filtered.map(r => {
    const dif = r.conteo - r.sistema;
    const color = dif === 0 ? 'var(--green)' : dif > 0 ? 'var(--blue)' : 'var(--red)';
    const signo = dif > 0 ? '+' : '';
    return `<tr>
      <td>${r.modelo} T${r.talle}</td>
      <td style="font-family:var(--mono);text-align:center">${r.sistema}</td>
      <td style="font-family:var(--mono);text-align:center">${r.conteo}</td>
      <td style="font-family:var(--mono);text-align:center;color:${color};font-weight:700">${signo}${dif}</td>
      <td><button onclick="quitarDelConteo('${r.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px">✕</button></td>
    </tr>`;
  }).join('');
}

function filtrarDifs(f) {
  csFiltro = f;
  document.querySelectorAll('#cs-f-todos,#cs-f-dif,#cs-f-ok').forEach(b => b.classList.remove('active'));
  document.getElementById('cs-f-' + f).classList.add('active');
  verDiferencias();
}

async function confirmarConteo() {
  const ids = Object.keys(csConteo);
  if (!ids.length) { toast('No hay conteo para confirmar', 'error'); return; }
  if (!confirm('¿Actualizar el stock en el sistema con estos valores?')) return;

  let ok = 0;
  for (const id of ids) {
    await sb('productos?id=eq.' + id, { method: 'PATCH', body: { stock: csConteo[id] }, prefer: 'return=minimal' });
    const p = allProductos.find(x => x.id === id);
    if (p) p.stock = csConteo[id];
    ok++;
  }
  toast('Stock actualizado: ' + ok + ' productos');
  csConteo = {};
  renderResumen();
  document.getElementById('cs-diferencias-wrap').style.display = 'none';
  document.getElementById('cs-diferencias-empty').style.display = 'block';
}
