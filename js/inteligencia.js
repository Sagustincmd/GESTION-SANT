// inteligencia.js — Reposición, rotación, análisis y recomendaciones

async function cargarReposicion() {
  document.getElementById('repo-loading').style.display = 'block';
  ['repo-urgente','repo-prioridad','repo-normal'].forEach(id => document.getElementById(id).innerHTML = '');
  const suf = esAdmin ? '' : '&sucursal=eq.' + currentSucursal;
  allProductos = await sb('productos?select=*' + suf) || [];
  allVentas = await sb('ventas?select=*' + suf) || [];
  const hace90 = new Date(); hace90.setDate(hace90.getDate()-90);
  const velMap = {};
  allVentas.filter(v => v.fecha && new Date(v.fecha) >= hace90).forEach(v => { velMap[v.producto_id] = (velMap[v.producto_id]||0)+(v.qty||1); });
  const urgente=[], prioridad=[], normal=[];
  allProductos.forEach(p => {
    const stock = p.stock||0, ventasMes = (velMap[p.id]||0)/3, minimo = Math.max(1, Math.ceil(ventasMes*1.5));
    if (stock === 0) urgente.push({...p, ventasMes, minimo});
    else if (stock < minimo) { if (stock <= Math.ceil(minimo*0.4)) prioridad.push({...p, ventasMes, minimo}); else normal.push({...p, ventasMes, minimo}); }
  });
  const renderRepo = (items, tipo) => {
    if (!items.length) return '';
    const titles = {urgente:'🔴 Urgente — Sin stock', prioridad:'🟡 Prioridad — Stock crítico', normal:'🟢 Normal — Stock bajo'};
    const clss = {urgente:'repo-urgente', prioridad:'repo-prioridad', normal:'repo-normal'};
    return `<div class="repo-section-title ${clss[tipo]}">${titles[tipo]} <span style="opacity:.6;font-weight:400">(${items.length})</span></div>` + items.map(p => `<div class="repo-item"><div class="repo-item-info"><strong>${p.modelo} — T${p.talle} ${p.color||''}</strong><span>${p.marca||''} · Costo: ${fmt(p.costo)} · Precio: ${fmt(p.precio)}</span></div><div class="repo-item-meta"><strong>${p.stock} en stock</strong>Mínimo: ${p.minimo} | Ventas/mes: ${p.ventasMes.toFixed(1)}</div></div>`).join('');
  };
  document.getElementById('repo-urgente').innerHTML = renderRepo(urgente,'urgente');
  document.getElementById('repo-prioridad').innerHTML = renderRepo(prioridad,'prioridad');
  document.getElementById('repo-normal').innerHTML = renderRepo(normal,'normal');
  document.getElementById('repo-loading').style.display = 'none';
}

// ANALISIS
async function cargarAnalisis() {
  const suf = esAdmin ? '' : '&sucursal=eq.' + currentSucursal;
  allProductos = await sb('productos?select=*' + suf) || [];
  allVentas = await sb('ventas?select=*' + suf) || [];
  const vendidos = new Set(allVentas.map(v => v.producto_id));
  const sinMov = allProductos.filter(p => (p.stock||0) > 0 && !vendidos.has(p.id));
  document.getElementById('anal-sinmov').innerHTML = sinMov.length ? sinMov.map(p => `<tr><td><strong>${p.modelo}</strong></td><td class="mono">${p.talle}</td><td>${p.color||''}</td><td class="mono">${p.stock}</td><td><span class="badge badge-red">Nunca vendido</span></td><td class="mono red">−${fmt((p.costo||0)*(p.stock||0))}</td></tr>`).join('') : '<tr><td colspan="6" class="loading">¡Sin productos estancados! 🎉</td></tr>';
  const meses = [...new Set(allVentas.map(v => v.fecha ? v.fecha.substring(0,7) : null).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('anal-mes');
  sel.innerHTML = meses.map(m => `<option value="${m}">${m}</option>`).join('');
  cargarConcentracion();
}

function cargarConcentracion() {
  const mes = document.getElementById('anal-mes').value;
  const ventasMes = allVentas.filter(v => v.fecha && v.fecha.startsWith(mes));
  const totalMes = ventasMes.reduce((s,v)=>s+(v.total||0),0);
  const map = {};
  ventasMes.forEach(v => {
    const prod = allProductos.find(p => p.id === v.producto_id);
    const k = `${v.producto_nombre}||${prod?.talle||''}||${prod?.color||''}`;
    if (!map[k]) map[k] = { nombre: v.producto_nombre, talle: prod?.talle||'', color: prod?.color||'', units:0, total:0, ganancia:0 };
    map[k].units+=v.qty||1; map[k].total+=v.total||0; map[k].ganancia+=(v.total||0)-(v.costo||0)*(v.qty||1);
  });
  const rows = Object.values(map).sort((a,b)=>b.total-a.total);
  document.getElementById('anal-concentracion').innerHTML = rows.length ? rows.map(r => `<tr><td><strong>${r.nombre}</strong></td><td class="mono">${r.talle}</td><td>${r.color}</td><td class="mono">${r.units}</td><td class="mono green">${fmt(r.total)}</td><td class="mono ${r.ganancia>=0?'green':'red'}">${fmt(r.ganancia)}</td><td class="mono">${totalMes>0?Math.round(r.total/totalMes*100):0}%</td></tr>`).join('') : '<tr><td colspan="7" class="loading">Sin ventas en este mes</td></tr>';
}

function exportarPDF() {
  const mes = document.getElementById('anal-mes').value;
  const ventasMes = allVentas.filter(v => v.fecha && v.fecha.startsWith(mes));
  const totalMes = ventasMes.reduce((s,v)=>s+(v.total||0),0);
  const ganTotalMes = ventasMes.reduce((s,v)=>s+(v.total||0)-(v.costo||0)*(v.qty||1),0);
  const map = {};
  ventasMes.forEach(v => { const prod = allProductos.find(p => p.id === v.producto_id); const k = `${v.producto_nombre}||${prod?.talle||''}||${prod?.color||''}`; if (!map[k]) map[k]={nombre:v.producto_nombre,talle:prod?.talle||'',color:prod?.color||'',units:0,total:0,ganancia:0}; map[k].units+=v.qty||1; map[k].total+=v.total||0; map[k].ganancia+=(v.total||0)-(v.costo||0)*(v.qty||1); });
  const rows = Object.values(map).sort((a,b)=>b.total-a.total);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin-bottom:4px}.sub{color:#666;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f5f5f5;padding:8px 12px;text-align:left;border-bottom:2px solid #ddd;font-size:11px;text-transform:uppercase;letter-spacing:1px}td{padding:7px 12px;border-bottom:1px solid #eee}.right{text-align:right}.total-row{font-weight:700;background:#f9f9f9}.green{color:#16a34a}.red{color:#dc2626}</style></head><body><h1>Santos Brother — Concentración de Ventas</h1><div class="sub">Mes: ${mes} · Total: ${fmt(totalMes)} · Ganancia: ${fmt(ganTotalMes)}</div><table><thead><tr><th>Modelo</th><th>Talle</th><th>Color</th><th class="right">Unidades</th><th class="right">Total $</th><th class="right">Ganancia $</th><th class="right">%</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.nombre}</td><td>${r.talle}</td><td>${r.color}</td><td class="right">${r.units}</td><td class="right green">${fmt(r.total)}</td><td class="right ${r.ganancia>=0?'green':'red'}">${fmt(r.ganancia)}</td><td class="right">${totalMes>0?Math.round(r.total/totalMes*100):0}%</td></tr>`).join('')}<tr class="total-row"><td colspan="3">TOTAL</td><td class="right">${rows.reduce((s,r)=>s+r.units,0)}</td><td class="right green">${fmt(totalMes)}</td><td class="right ${ganTotalMes>=0?'green':'red'}">${fmt(ganTotalMes)}</td><td class="right">100%</td></tr></tbody></table></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500);
}





// HOME CHARTS
let intelTabActual = 'repo';
let rotacionChartsInit = false;

function setIntelTab(tab, btn) {
  intelTabActual = tab;
  document.querySelectorAll('#page-inteligencia .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['repo','rotacion','sinmov','recomendaciones'].forEach(t => {
    const el = document.getElementById('itab-' + t);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'rotacion') renderRotacion();
  if (tab === 'sinmov') renderSinMov();
  if (tab === 'recomendaciones') renderRecomendaciones();
}

async function cargarInteligencia() {
  const suf = esAdmin ? '' : '&sucursal=eq.' + currentSucursal;
  allProductos = await sb('productos?select=*' + suf) || [];
  allVentas = await sb('ventas?select=*' + suf) || [];
  renderIntelRepo();
  renderSinMov();
}

function renderIntelRepo() {
  const hace90 = new Date(); hace90.setDate(hace90.getDate()-90);
  const velMap = {};
  allVentas.filter(v => v.fecha && new Date(v.fecha) >= hace90).forEach(v => {
    velMap[v.producto_id] = (velMap[v.producto_id]||0)+(v.qty||1);
  });
  const urgente=[], prioridad=[], normal=[];
  allProductos.forEach(p => {
    const stock = p.stock||0, ventasMes = (velMap[p.id]||0)/3, minimo = Math.max(1, Math.ceil(ventasMes*1.5));
    if (stock === 0) urgente.push({...p, ventasMes, minimo});
    else if (stock < minimo) { if (stock <= Math.ceil(minimo*0.4)) prioridad.push({...p, ventasMes, minimo}); else normal.push({...p, ventasMes, minimo}); }
  });

  const renderCol = (items, tipo) => {
    const titles = {urgente:'🔴 Urgente — Sin stock', prioridad:'🟡 Prioridad — Crítico', normal:'🟢 Normal — Bajo'};
    const clss = {urgente:'repo-urgente', prioridad:'repo-prioridad', normal:'repo-normal'};
    if (!items.length) return `<div class="repo-section-title ${clss[tipo]}">${titles[tipo]} (0)</div><div style="color:var(--text3);font-size:13px;padding:12px">Sin productos en esta categoría</div>`;
    return `<div class="repo-section-title ${clss[tipo]}">${titles[tipo]} (${items.length})</div>` +
      items.slice(0,5).map(p => `<div class="repo-item" style="flex-direction:column;align-items:flex-start;gap:4px">
        <strong style="font-size:13px">${p.modelo} T${p.talle} ${p.color||''}</strong>
        <span style="font-size:11px;color:var(--text3)">${p.marca||''} · Stock: ${p.stock} · Mín: ${p.minimo} · ${p.ventasMes.toFixed(1)}/mes</span>
      </div>`).join('') + (items.length > 5 ? `<div style="text-align:center;padding:8px;font-size:12px;color:var(--text3)">+ ${items.length-5} más</div>` : '');
  };

  document.getElementById('intel-urgente').innerHTML = renderCol(urgente, 'urgente');
  document.getElementById('intel-prioridad').innerHTML = renderCol(prioridad, 'prioridad');
  document.getElementById('intel-normal').innerHTML = renderCol(normal, 'normal');
  document.getElementById('intel-repo-loading').style.display = 'none';
}

function renderRotacion() {
  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const ventasR = allVentas.filter(v => v.fecha && new Date(v.fecha) >= hace30);
  const modeloMap = {};
  ventasR.forEach(v => {
    const k = (v.producto_nombre||'').toUpperCase().split(' T')[0].trim();
    if (!k) return;
    if (!modeloMap[k]) modeloMap[k] = { qty:0, marca:'' };
    modeloMap[k].qty += v.qty||1;
  });
  const top = Object.entries(modeloMap).sort((a,b)=>b[1].qty-a[1].qty).slice(0,8);

  // Rotacion table
  const marcaMap = {};
  ventasR.forEach(v => {
    const prod = allProductos.find(p => p.id === v.producto_id);
    const marca = prod?.marca || 'Otra';
    if (!marcaMap[marca]) marcaMap[marca] = 0;
    marcaMap[marca] += v.qty||1;
  });

  document.getElementById('intel-rotacion-tbody').innerHTML = top.map(([modelo, d], i) => {
    const stockActual = allProductos.filter(p => (p.modelo||'').toUpperCase().includes(modelo)).reduce((s,p)=>s+(p.stock||0),0);
    const diasStock = d.qty > 0 ? Math.round(stockActual / (d.qty/30)) : 999;
    const rotacion = d.qty >= 30 ? 'badge-red">Alta' : d.qty >= 15 ? 'badge-yellow">Media' : 'badge-green">Baja';
    return `<tr>
      <td class="mono" style="color:var(--text3)">${i+1}</td>
      <td><strong>${modelo}</strong></td>
      <td class="mono">${d.qty}</td>
      <td class="mono">${stockActual}</td>
      <td class="mono">${diasStock < 999 ? diasStock + ' días' : '—'}</td>
      <td><span class="badge ${rotacion}</span></td>
    </tr>`;
  }).join('');

  if (rotacionChartsInit) return;
  rotacionChartsInit = true;
  setTimeout(() => {
    const cfg2 = { responsive:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:'#71717a'},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#71717a'},grid:{color:'#2a2a2a'}}} };
    new Chart(document.getElementById('chart-rotacion'), { type:'bar', data:{labels:top.map(([k])=>k.slice(0,10)), datasets:[{data:top.map(([,d])=>d.qty), backgroundColor:'rgba(34,197,94,.7)', borderColor:'#22c55e', borderWidth:1, borderRadius:4}]}, options:cfg2 });
    const marcas = Object.entries(marcaMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    new Chart(document.getElementById('chart-marcas'), { type:'bar', data:{labels:marcas.map(([k])=>k), datasets:[{data:marcas.map(([,v])=>v), backgroundColor:'rgba(96,165,250,.7)', borderColor:'#60a5fa', borderWidth:1, borderRadius:4}]}, options:cfg2 });
  }, 100);
}

function renderSinMov() {
  const vendidos = new Set(allVentas.map(v => v.producto_id));
  const sinMov = allProductos.filter(p => (p.stock||0) > 0 && !vendidos.has(p.id));
  document.getElementById('intel-sinmov-tbody').innerHTML = sinMov.length
    ? sinMov.map(p => `<tr>
        <td><strong>${p.modelo}</strong></td><td class="mono">${p.talle}</td><td>${p.color||''}</td>
        <td class="mono">${p.stock}</td><td><span class="badge badge-red">Nunca vendido</span></td>
        <td class="mono red">−${fmt((p.costo||0)*(p.stock||0))}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="loading">¡Sin productos estancados! 🎉</td></tr>';
}

function renderRecomendaciones() {
  const mes = thisMonth();
  const ventasMes = allVentas.filter(v => v.fecha && v.fecha.startsWith(mes));
  const costosMes = ventasMes.reduce((s,v) => s+(v.costo||0)*(v.qty||1), 0);
  const gastadoCompras = 0; // would come from compras table
  const disponible = costosMes - gastadoCompras;

  const hace30 = new Date(); hace30.setDate(hace30.getDate()-30);
  const velMap = {};
  allVentas.filter(v => v.fecha && new Date(v.fecha) >= hace30).forEach(v => {
    const k = (v.producto_nombre||'').toUpperCase().split(' T')[0].trim();
    if (!k) return;
    if (!velMap[k]) velMap[k] = { qty:0, costo:0 };
    velMap[k].qty += v.qty||1;
    velMap[k].costo = v.costo||0;
  });

  const sinStock = allProductos.filter(p => (p.stock||0) === 0);
  document.getElementById('intel-presupuesto-disp').textContent = fmt(disponible);
  document.getElementById('intel-urgentes-count').textContent = sinStock.length;

  const top = Object.entries(velMap).sort((a,b)=>b[1].qty-a[1].qty).slice(0,8);
  let invSug = 0;
  document.getElementById('intel-recom-tbody').innerHTML = top.map(([modelo, d]) => {
    const stockActual = allProductos.filter(p => (p.modelo||'').toUpperCase().includes(modelo)).reduce((s,p)=>s+(p.stock||0),0);
    const semana = Math.ceil(d.qty/4);
    const comprar = stockActual < semana ? 'x6' : stockActual < semana*2 ? 'x6' : '—';
    const prioridad = stockActual === 0 ? 'badge-red">Urgente' : stockActual < semana ? 'badge-yellow">Prioridad' : 'badge-green">Normal';
    invSug += stockActual < semana ? (d.costo * 6) : 0;
    return `<tr>
      <td><strong>${modelo}</strong></td>
      <td class="mono">${d.qty}</td>
      <td class="mono ${stockActual===0?'red':''}">${stockActual}</td>
      <td class="mono green">${comprar}</td>
      <td><span class="badge ${prioridad}</span></td>
    </tr>`;
  }).join('');
  document.getElementById('intel-inversion-sug').textContent = fmt(invSug);
}

// DEVOLUCIONES
