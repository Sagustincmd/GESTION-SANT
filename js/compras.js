// compras.js — Compras y presupuesto

// COMPRAS

async function cargarCompras() {
  // Cargar datos necesarios
  if (!allVentas.length) allVentas = await sb('ventas?select=*') || [];
  if (!allProductos.length) allProductos = await sb('productos?select=*') || [];

  // Cargar compras desde Supabase
  const data = await sb('compras?select=*&order=fecha.desc') || [];
  todasCompras = data;

  // Calcular presupuesto = costo de lo vendido este mes
  const mes = thisMonth();
  const ventasMes = allVentas.filter(v => v.fecha && v.fecha.startsWith(mes));
  compPresupuesto = ventasMes.reduce((s,v) => s+(v.costo||0)*(v.qty||1), 0);

  // Set fecha default
  document.getElementById('comp-fecha').value = today();

  actualizarPresupuestoBanner();
  renderComprasHistorial();
  renderRecomendaciones();
}

function actualizarPresupuestoBanner() {
  const mes = thisMonth();
  const gastadoMes = todasCompras
    .filter(c => c.fecha && c.fecha.startsWith(mes))
    .reduce((s,c) => s+(c.inversion_total||0), 0);
  const disponible = compPresupuesto - gastadoMes;
  const pct = compPresupuesto > 0 ? Math.min(100, Math.round(gastadoMes/compPresupuesto*100)) : 0;

  document.getElementById('comp-presupuesto-total').textContent = fmt(compPresupuesto);
  document.getElementById('comp-gastado').textContent = fmt(gastadoMes);
  document.getElementById('comp-presupuesto-disp').textContent = fmt(Math.max(0, disponible));
  document.getElementById('comp-presupuesto-disp').style.color = disponible < 0 ? 'var(--red)' : 'var(--green)';
  document.getElementById('comp-pct-uso').textContent = pct + '% utilizado';

  const barra = document.getElementById('comp-barra-uso');
  barra.style.width = pct + '%';
  barra.style.background = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';

  const alertaEl = document.getElementById('comp-alerta-texto');
  if (pct >= 100) alertaEl.innerHTML = '<span style="color:var(--yellow);font-weight:600">⚠ Superado — exceso acumulado al próximo mes</span>';
  else if (pct >= 80) alertaEl.innerHTML = '<span style="color:var(--yellow);font-weight:600">⚠ Cerca del límite</span>';
  else alertaEl.textContent = '';
}

function compSelQty(qty, btn) {
  document.querySelectorAll('.comp-qty-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'var(--surface2)';
    b.style.color = 'var(--text2)';
  });
  btn.style.borderColor = 'var(--green)';
  btn.style.background = 'var(--green-bg)';
  btn.style.color = 'var(--green)';
  if (qty > 0) document.getElementById('comp-qty').value = qty;
  compCalcuar();
}

function compCalcuar() {
  const precioReal = +document.getElementById('comp-precio-real').value || 0;
  const cotizacion = +document.getElementById('comp-cotizacion').value || 0;
  const qty = +document.getElementById('comp-qty').value || 0;
  const fleteReal = +document.getElementById('comp-flete').value || 0;
  const modelo = document.getElementById('comp-modelo').value.trim().toLowerCase();

  if (!precioReal || !cotizacion || !qty) {
    document.getElementById('comp-calc').style.display = 'none';
    return;
  }

  const costoParAR = precioReal * cotizacion;
  const fleteParAR = fleteReal * cotizacion;
  const fleteTotalAR = fleteParAR * qty;
  const costoFinal = costoParAR + fleteParAR;
  const inversion = costoFinal * qty;

  document.getElementById('cc-par-ar').textContent = fmt(costoParAR);
  document.getElementById('cc-flete-par').textContent = fmt(fleteParAR);
  document.getElementById('cc-flete-total').textContent = fmt(fleteTotalAR);
  document.getElementById('cc-costo-final').textContent = fmt(costoFinal);
  document.getElementById('cc-inversion').textContent = fmt(inversion);
  document.getElementById('comp-calc').style.display = 'block';

  // Alerta vs velocidad de ventas del modelo
  if (modelo) {
    const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
    const ventasModelo = allVentas.filter(v =>
      (v.producto_nombre||'').toLowerCase().includes(modelo) &&
      v.fecha && new Date(v.fecha) >= hace30
    );
    const ventasMes = ventasModelo.reduce((s,v) => s+(v.qty||1), 0);
    const alertaEl = document.getElementById('cc-alerta-modelo');
    if (ventasMes > 0) {
      alertaEl.style.display = 'block';
      if (qty < ventasMes * 0.8) {
        alertaEl.style.background = 'var(--yellow-bg)';
        alertaEl.style.color = 'var(--yellow)';
        alertaEl.textContent = '⚠ Compra baja — vendiste ' + ventasMes + ' pares este modelo en 30 días';
      } else if (qty > ventasMes * 2) {
        alertaEl.style.background = 'var(--red-bg)';
        alertaEl.style.color = 'var(--red)';
        alertaEl.textContent = '⚠ Compra alta — vendiste ' + ventasMes + ' pares este modelo en 30 días';
      } else {
        alertaEl.style.background = 'var(--green-bg)';
        alertaEl.style.color = 'var(--green)';
        alertaEl.textContent = '✓ Compra acorde — vendiste ' + ventasMes + ' pares este modelo en 30 días';
      }
    } else {
      alertaEl.style.display = 'none';
    }
  }

  // Alerta vs presupuesto — acumulado histórico
  const mesActual = thisMonth();
  const gastadoMes = todasCompras.filter(c => c.fecha && c.fecha.startsWith(mesActual)).reduce((s,c) => s+(c.inversion_total||0), 0);
  const disponible = compPresupuesto - gastadoMes;
  const alertaPres = document.getElementById('cc-alerta-presupuesto');
  alertaPres.style.display = 'block';
  if (compPresupuesto > 0) {
    if (disponible < 0) {
      // Ya estamos pasados, mostrar saldo a favor del mes anterior
      alertaPres.style.background = 'var(--yellow-bg)';
      alertaPres.style.color = 'var(--yellow)';
      alertaPres.textContent = '⚠ Ya superaste el presupuesto del mes por ' + fmt(Math.abs(disponible)) + '. Este gasto se descuenta del próximo mes.';
    } else if (inversion > disponible) {
      alertaPres.style.background = 'var(--yellow-bg)';
      alertaPres.style.color = 'var(--yellow)';
      alertaPres.textContent = '⚠ Superás el presupuesto del mes por ' + fmt(inversion - disponible) + '. El exceso se acumula al próximo mes.';
    } else {
      alertaPres.style.background = 'var(--green-bg)';
      alertaPres.style.color = 'var(--green)';
      alertaPres.textContent = '✓ Dentro del presupuesto — te quedan ' + fmt(disponible - inversion) + ' después de esta compra';
    }
  } else {
    alertaPres.style.background = 'var(--surface2)';
    alertaPres.style.color = 'var(--text3)';
    alertaPres.textContent = 'Sin ventas este mes para calcular presupuesto';
  }
}

async function guardarCompra() {
  const modelo = document.getElementById('comp-modelo').value.trim();
  const marca = document.getElementById('comp-marca').value.trim();
  const fecha = document.getElementById('comp-fecha').value;
  const qty = +document.getElementById('comp-qty').value || 0;
  const precioReal = +document.getElementById('comp-precio-real').value || 0;
  const cotizacion = +document.getElementById('comp-cotizacion').value || 0;
  const fleteReal = +document.getElementById('comp-flete').value || 0;
  const notas = document.getElementById('comp-notas').value.trim();

  if (!modelo || !fecha || !qty || !precioReal || !cotizacion) {
    toast('Completá modelo, fecha, cantidad, precio y cotización', 'error'); return;
  }

  const costoParAR = precioReal * cotizacion;
  const fleteParAR = fleteReal * cotizacion;
  const costoFinal = costoParAR + fleteParAR;
  const inversionTotal = costoFinal * qty;

  const compra = {
    id: crypto.randomUUID(),
    fecha, modelo, marca, qty,
    precio_real: precioReal,
    cotizacion,
    flete_real: fleteReal,
    flete_par_ar: fleteParAR,
    costo_par_ar: costoParAR,
    costo_final: costoFinal,
    inversion_total: inversionTotal,
    notas,
    registrado_en: new Date().toISOString()
  };

  await sb('compras', { method: 'POST', body: compra, prefer: 'return=minimal' });
  todasCompras.unshift(compra);
  toast('Compra registrada ✓');

  // Limpiar form
  ['comp-modelo','comp-marca','comp-notas'].forEach(id => document.getElementById(id).value = '');
  ['comp-precio-real','comp-cotizacion','comp-flete'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('comp-qty').value = '6';
  document.getElementById('comp-calc').style.display = 'none';

  actualizarPresupuestoBanner();
  renderComprasHistorial();
}

function renderComprasHistorial() {
  const mesFiltro = document.getElementById('comp-mes-filter').value;
  const meses = [...new Set(todasCompras.map(c => c.fecha ? c.fecha.substring(0,7) : null).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('comp-mes-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los meses</option>' + meses.map(m => `<option value="${m}" ${m===current?'selected':''}>${m}</option>`).join('');

  const filtradas = mesFiltro ? todasCompras.filter(c => c.fecha && c.fecha.startsWith(mesFiltro)) : todasCompras;
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);

  const tbody = document.getElementById('comp-historial-tbody');
  if (!filtradas.length) { tbody.innerHTML = '<tr><td colspan="11" class="loading">Sin compras registradas</td></tr>'; return; }

  tbody.innerHTML = filtradas.map(c => {
    const ventasModelo = allVentas.filter(v =>
      (v.producto_nombre||'').toLowerCase().includes((c.modelo||'').toLowerCase()) &&
      v.fecha && new Date(v.fecha) >= hace30
    ).reduce((s,v) => s+(v.qty||1), 0);
    let vsTag = '';
    if (ventasModelo > 0) {
      if (c.qty < ventasModelo * 0.8) vsTag = '<span class="badge badge-yellow">Compra baja</span>';
      else if (c.qty > ventasModelo * 2) vsTag = '<span class="badge badge-red">Compra alta</span>';
      else vsTag = '<span class="badge badge-green">OK</span>';
    }
    return `<tr>
      <td>${c.fecha||''}</td>
      <td><strong>${c.modelo||''}</strong></td>
      <td>${c.marca||''}</td>
      <td class="mono"><span class="badge badge-gray">x${c.qty}</span></td>
      <td class="mono blue">R$${(c.precio_real||0).toLocaleString('es-AR')}</td>
      <td class="mono" style="color:var(--text3)">$${(c.cotizacion||0).toLocaleString('es-AR')}</td>
      <td class="mono">R$${(c.flete_real||0).toLocaleString('es-AR')}</td>
      <td class="mono yellow">${fmt(c.costo_final)}</td>
      <td class="mono green">${fmt(c.inversion_total)}</td>
      <td>${vsTag}</td>
      <td><button class="btn btn-danger btn-sm" onclick="eliminarCompra('${c.id}')">✕</button></td>
    </tr>`;
  }).join('');

  const totalPares = filtradas.reduce((s,c)=>s+c.qty,0);
  const totalInversion = filtradas.reduce((s,c)=>s+(c.inversion_total||0),0);
  const totEl = document.getElementById('comp-historial-totales');
  totEl.style.display = 'flex';
  totEl.innerHTML = `
    <span>Compras: <strong style="font-family:var(--mono)">${filtradas.length}</strong></span>
    <span>Pares: <strong style="font-family:var(--mono)">${totalPares}</strong></span>
    <span>Inversión: <strong style="color:var(--green);font-family:var(--mono)">${fmt(totalInversion)}</strong></span>`;
}

async function eliminarCompra(id) {
  if (!confirm('¿Eliminar esta compra?')) return;
  await sb('compras?id=eq.'+id, { method: 'DELETE' });
  todasCompras = todasCompras.filter(c => c.id !== id);
  toast('Compra eliminada');
  actualizarPresupuestoBanner();
  renderComprasHistorial();
}

function renderRecomendaciones() {
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const ventasRecientes = allVentas.filter(v => v.fecha && new Date(v.fecha) >= hace30);

  // Agrupar por modelo
  const modeloMap = {};
  ventasRecientes.forEach(v => {
    const k = (v.producto_nombre||'').toUpperCase().split(' T')[0].trim();
    if (!k) return;
    if (!modeloMap[k]) modeloMap[k] = { qty: 0, total: 0 };
    modeloMap[k].qty += v.qty||1;
    modeloMap[k].total += v.total||0;
  });

  const top = Object.entries(modeloMap).sort((a,b) => b[1].qty - a[1].qty).slice(0, 6);
  const el = document.getElementById('comp-recomendaciones');

  if (!top.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">Sin datos de ventas suficientes</div>'; return; }

  el.innerHTML = top.map(([modelo, d], i) => {
    const semana = Math.ceil(d.qty / 4);
    const urgencia = i < 2 ? 'red' : i < 4 ? 'yellow' : 'green';
    const label = i < 2 ? 'Alta rotación' : i < 4 ? 'Media rotación' : 'Normal';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div>
        <strong>${modelo}</strong>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${d.qty} pares vendidos en 30 días</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--mono);font-weight:700;color:var(--${urgencia})">~${semana}/semana</div>
        <span class="badge badge-${urgencia === 'red' ? 'red' : urgencia === 'yellow' ? 'yellow' : 'green'}" style="font-size:10px">${label}</span>
      </div>
    </div>`;
  }).join('');
}
