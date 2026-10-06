// movimientos.js — Historial de stock

// MOVIMIENTOS
async function registrarMovimiento(productoId, productoNombre, tipo, qty, referenciaId, notas) {
  const mov = {
    id: crypto.randomUUID(),
    producto_id: productoId,
    producto_nombre: productoNombre,
    tipo, qty,
    referencia_id: referenciaId,
    referencia_tipo: tipo,
    fecha: today(),
    notas: notas || '',
    sucursal: currentSucursal,
    registrado_en: new Date().toISOString()
  };
  await sb('movimientos', { method: 'POST', body: mov, prefer: 'return=minimal' });
}

async function cargarMovimientos() {
  const data = await sb('movimientos?select=*&order=registrado_en.desc') || [];
  renderMovimientos(data);
}

function setMovFiltro(f, btn) {
  movFiltro = f;
  document.querySelectorAll('#page-movimientos .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarMovimientos();
}

function renderMovimientos(data) {
  const iconos = { venta:'🛒', compra:'📦', devolucion:'↩', ajuste:'✏' };
  const colores = { venta:'var(--red-bg)', compra:'var(--green-bg)', devolucion:'var(--blue-bg)', ajuste:'var(--purple-bg)' };
  const filtrados = movFiltro === 'todos' ? data : data.filter(m => m.tipo === movFiltro);
  const el = document.getElementById('mov-tbody');
  if (!filtrados.length) { el.innerHTML = '<div class="loading">Sin movimientos en esta categoría</div>'; return; }
  el.innerHTML = filtrados.map(m => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px">
      <div style="width:36px;height:36px;border-radius:8px;background:${colores[m.tipo]||'var(--surface2)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${iconos[m.tipo]||'•'}</div>
      <div style="flex:1">
        <strong>${m.producto_nombre||''}</strong>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${m.tipo} · ${m.fecha||''} · ${m.notas||''}</div>
      </div>
      <div style="font-family:var(--mono);font-weight:700;color:${m.tipo==='venta'?'var(--red)':'var(--green)'}">${m.tipo==='venta'?'−':'+'}${Math.abs(m.qty||1)}</div>
    </div>`).join('');
}
