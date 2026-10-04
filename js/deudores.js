// deudores.js — Deudores y fiado

// DEUDORES

async function cargarDeudores() {
  document.getElementById('deu-fecha').value = today();
  const suf = esAdmin ? '' : '&sucursal=eq.' + currentSucursal;
  allDeudores = await sb('deudores?select=*&order=registrado_en.desc' + suf) || [];
  allDeudoresPagos = await sb('deudores_pagos?select=*&order=fecha.desc') || [];
  renderDeudores();
}

function getDeuEstado(d) {
  const restante = (d.monto_original||0) - (d.pagado||0);
  if (restante <= 0) return 'saldado';
  const dias = Math.floor((new Date() - new Date(d.fecha)) / (1000*60*60*24));
  if (dias > 30) return 'vencido';
  return 'pendiente';
}

function setDeuFiltro(f, btn) {
  deuFiltro = f;
  document.querySelectorAll('#deu-filtros .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDeudores();
}

function renderDeudores() {
  const activos = allDeudores.filter(d => getDeuEstado(d) !== 'saldado');
  const totalDeuda = activos.reduce((s,d) => s+((d.monto_original||0)-(d.pagado||0)), 0);
  const vencidos = allDeudores.filter(d => getDeuEstado(d) === 'vencido').length;
  const mes = thisMonth();
  const cobradoMes = allDeudoresPagos.filter(p => p.fecha && p.fecha.startsWith(mes)).reduce((s,p) => s+(p.monto||0), 0);

  document.getElementById('deu-total').textContent = fmt(totalDeuda);
  document.getElementById('deu-count').textContent = activos.length + ' deudores activos';
  document.getElementById('deu-cobrado').textContent = fmt(cobradoMes);
  document.getElementById('deu-vencidas').textContent = vencidos;

  let lista = [...allDeudores];
  if (deuFiltro !== 'todos') lista = lista.filter(d => getDeuEstado(d) === deuFiltro);

  const el = document.getElementById('deu-lista');
  if (!lista.length) { el.innerHTML = '<div class="loading">Sin deudores en esta categoría</div>'; return; }

  el.innerHTML = lista.map(d => {
    const restante = (d.monto_original||0) - (d.pagado||0);
    const pct = d.monto_original > 0 ? Math.round((d.pagado||0)/d.monto_original*100) : 0;
    const estado = getDeuEstado(d);
    const estadoBadge = estado === 'saldado' ? 'badge-green">✓ Saldado' : estado === 'vencido' ? 'badge-red">⚠ Vencido' : 'badge-yellow">Pendiente';
    const barraColor = estado === 'saldado' ? 'var(--green)' : estado === 'vencido' ? 'var(--red)' : 'var(--yellow)';
    const dias = Math.floor((new Date() - new Date(d.fecha)) / (1000*60*60*24));
    const pagosDeudor = allDeudoresPagos.filter(p => p.deudor_id === d.id);

    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:16px;font-weight:700">${d.nombre||''}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${d.producto||''} · hace ${dias} días${d.notas?' · '+d.notas:''}</div>
        </div>
        <span class="badge ${estadoBadge}</span>
      </div>
      <div style="background:var(--surface2);border-radius:4px;height:6px;margin:8px 0;overflow:hidden">
        <div style="height:100%;border-radius:4px;background:${barraColor};width:${pct}%;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:12px">
        <span>Pagado: <strong style="color:var(--green);font-family:var(--mono)">${fmt(d.pagado||0)}</strong></span>
        <span>${pct}%</span>
        <span>Restante: <strong style="color:var(--red);font-family:var(--mono)">${fmt(restante)}</strong></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:13px;margin-bottom:12px">
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:2px">Deuda original</div><div style="font-family:var(--mono);font-weight:600">${fmt(d.monto_original)}</div></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:2px">Pagos realizados</div><div style="font-family:var(--mono);font-weight:600">${pagosDeudor.length}</div></div>
        <div><div style="font-size:11px;color:var(--text3);margin-bottom:2px">Último pago</div><div style="font-family:var(--mono);font-weight:600">${pagosDeudor.length ? pagosDeudor[0].fecha : '—'}</div></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${estado !== 'saldado' ? `<button class="btn btn-primary btn-sm" onclick="abrirPagoDeudor('${d.id}','${(d.nombre||'').replace(/'/g,"\'")}',${restante})">💰 Registrar pago</button>` : ''}
        ${pagosDeudor.length ? `<div style="margin-top:8px;width:100%;border-top:1px solid var(--border);padding-top:8px">
          ${pagosDeudor.slice(0,3).map(p => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border)"><span style="color:var(--text3)">${p.fecha} · ${p.notas||'Pago'}</span><span style="font-family:var(--mono);color:var(--green);font-weight:600">${fmt(p.monto)}</span></div>`).join('')}
        </div>` : ''}
        <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="eliminarDeudor('${d.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function agregarDeuda() {
  const nombre = document.getElementById('deu-nombre').value.trim();
  const monto = +document.getElementById('deu-monto').value || 0;
  if (!nombre || !monto) { toast('Completá nombre y monto', 'error'); return; }
  const deuda = {
    id: crypto.randomUUID(),
    nombre,
    producto: document.getElementById('deu-producto').value.trim(),
    monto_original: monto,
    pagado: 0,
    fecha: document.getElementById('deu-fecha').value,
    notas: document.getElementById('deu-notas').value.trim(),
    sucursal: currentSucursal,
    registrado_en: new Date().toISOString()
  };
  await sb('deudores', { method: 'POST', body: deuda, prefer: 'return=minimal' });
  toast('Deuda registrada ✓');
  ['deu-nombre','deu-producto','deu-notas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('deu-monto').value = '';
  cargarDeudores();
}

function abrirPagoDeudor(id, nombre, restante) {
  document.getElementById('dpago-id').value = id;
  document.getElementById('dpago-nombre').value = nombre;
  document.getElementById('dpago-restante').value = fmt(restante);
  document.getElementById('dpago-monto').value = '';
  document.getElementById('dpago-fecha').value = today();
  document.getElementById('dpago-notas').value = '';
  document.getElementById('modal-deudor-pago').style.display = 'flex';
}

function cerrarModalDeudor() {
  document.getElementById('modal-deudor-pago').style.display = 'none';
}

async function registrarPagoDeudor() {
  const id = document.getElementById('dpago-id').value;
  const monto = +document.getElementById('dpago-monto').value || 0;
  const fecha = document.getElementById('dpago-fecha').value;
  const notas = document.getElementById('dpago-notas').value;
  if (!monto) { toast('Ingresá el monto', 'error'); return; }

  const deudor = allDeudores.find(d => d.id === id);
  if (!deudor) return;

  const nuevoPagado = Math.min(deudor.monto_original, (deudor.pagado||0) + monto);
  await sb('deudores?id=eq.'+id, { method: 'PATCH', body: { pagado: nuevoPagado }, prefer: 'return=minimal' });

  const pago = {
    id: crypto.randomUUID(),
    deudor_id: id,
    monto, fecha, notas,
    registrado_en: new Date().toISOString()
  };
  await sb('deudores_pagos', { method: 'POST', body: pago, prefer: 'return=minimal' });

  cerrarModalDeudor();
  toast('Pago registrado ✓');
  cargarDeudores();
}

async function eliminarDeudor(id) {
  if (!confirm('¿Eliminar este deudor?')) return;
  await sb('deudores?id=eq.'+id, { method: 'DELETE' });
  await sb('deudores_pagos?deudor_id=eq.'+id, { method: 'DELETE' });
  toast('Deudor eliminado');
  cargarDeudores();
}
