// inventario.js — Gestión de inventario

// INVENTARIO
async function cargarInventario() {
  initInvTalles();
  const endpoint = esAdmin ? 'productos?select=*&order=modelo.asc' : 'productos?select=*&order=modelo.asc&sucursal=eq.' + currentSucursal;
  const data = await sb(endpoint);
  allProductos = data || []; invFiltrado = [...allProductos];
  document.getElementById('inv-count').textContent = allProductos.length + ' productos';
  renderInventario();
}

function matchTerminos(p, q) {
  const terminos = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const campos = [p.modelo||'', p.marca||'', p.color||'', String(p.talle||'')].map(c => c.toLowerCase());
  return terminos.every(t => campos.some(c => c.includes(t)));
}

function filtrarInventario() {
  const q = document.getElementById('inv-search').value;
  invFiltrado = q.trim() ? allProductos.filter(p => matchTerminos(p, q)) : [...allProductos];
  renderInventario();
}

function renderInventario() {
  const tbody = document.getElementById('inv-tbody');
  if (!invFiltrado.length) { tbody.innerHTML = '<tr><td colspan="11" class="loading">Sin resultados</td></tr>'; return; }
  tbody.innerHTML = invFiltrado.map(p => {
    const margen = p.precio > 0 ? Math.round((p.precio - p.costo) / p.precio * 100) : 0;
    const estado = p.stock <= 0 ? '<span class="badge badge-red">Sin stock</span>' : p.stock <= 2 ? '<span class="badge badge-yellow">Bajo</span>' : '<span class="badge badge-green">OK</span>';
    const fotos = p.fotos && p.fotos.length ? p.fotos : [];
    const fotosHtml = fotos.length
      ? `<div style="display:flex;gap:4px;align-items:center">
          ${fotos.slice(0,3).map(url => `<img src="${url}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="verFotos('${p.id}')">`).join('')}
          ${fotos.length < 3 ? `<button class="btn btn-secondary btn-sm" onclick="subirFotos('${p.id}')" title="Agregar fotos">+</button>` : ''}
        </div>`
      : `<button class="btn btn-secondary btn-sm" onclick="subirFotos('${p.id}')">📷 Subir</button>`;
    return `<tr>
      <td><strong>${p.modelo||''}</strong></td><td>${p.marca||''}</td><td>${p.color||''}</td>
      <td class="mono">${p.talle||''}</td><td class="mono">${fmt(p.costo)}</td><td class="mono">${fmt(p.precio)}</td>
      <td class="mono ${margen>0?'green':'red'}">${margen}%</td>
      <td><div class="stock-edit">
        <input type="number" data-id="${p.id}" class="stock-input" value="${p.stock||0}" min="0" style="width:60px;padding:4px 6px;font-size:13px">
        <button class="btn btn-secondary btn-sm" onclick="actualizarStockBtn(this)">✓</button>
      </div></td>
      <td>${estado}</td>
      <td>${fotosHtml}</td>
      <td style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm" onclick="abrirEditar('${p.id}')">✏</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarProducto('${p.id}')">✕</button>
      </td></tr>`;
  }).join('');
}

async function subirFotos(id) {
  const p = allProductos.find(x => x.id === id);
  const fotosActuales = (p && p.fotos) ? [...p.fotos] : [];
  const restantes = 3 - fotosActuales.length;
  if (restantes <= 0) { toast('Ya tiene 3 fotos. Editá el producto para reemplazarlas.', 'error'); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  const _url = SB_URL, _key = SB_KEY;
  input.onchange = async () => {
    const archivos = Array.from(input.files).slice(0, restantes);
    if (!archivos.length) return;
    toast('Subiendo fotos...');
    const sbClient = window.supabase.createClient(_url, _key);
    for (const archivo of archivos) {
      const ext = archivo.name.split('.').pop();
      const path = id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
      const { error } = await sbClient.storage.from('fotos-productos').upload(path, archivo, { upsert: true });
      if (!error) {
        const { data } = sbClient.storage.from('fotos-productos').getPublicUrl(path);
        fotosActuales.push(data.publicUrl);
      }
    }
    await sb('productos?id=eq.' + id, { method: 'PATCH', body: { fotos: fotosActuales }, prefer: 'return=minimal' });
    if (p) p.fotos = fotosActuales;
    toast('✓ ' + archivos.length + ' foto' + (archivos.length > 1 ? 's' : '') + ' guardada' + (archivos.length > 1 ? 's' : ''));
    renderInventario();
  };
  input.click();
}

function verFotos(id) {
  const p = allProductos.find(x => x.id === id);
  if (!p || !p.fotos || !p.fotos.length) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;cursor:pointer';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = p.fotos.map(url =>
    `<img src="${url}" style="max-height:80vh;max-width:30vw;border-radius:10px;object-fit:contain">`
  ).join('') + `<button style="position:fixed;top:20px;right:20px;background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:15px">✕ Cerrar</button>`;
  document.body.appendChild(overlay);
}

// CARGA MASIVA

function initInvTalles() {
  const grid = document.getElementById('inv-talles-grid');
  if (!grid || grid.children.length > 0) return;
  INV_TALLES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'inv-talle-card';
    card.dataset.talle = t;
    card.innerHTML = `<div class="t-num">${t}</div><div class="t-qty"><input type="number" class="inv-qty-input" value="1" min="1" onclick="event.stopPropagation()"><div style="font-size:9px;color:var(--text3);margin-top:2px">pares</div></div>`;
    card.addEventListener('click', () => { card.classList.toggle('selected'); });
    grid.appendChild(card);
  });
}

function invSelRango(desde, hasta) {
  document.querySelectorAll('.inv-talle-card').forEach(c => {
    if (+c.dataset.talle >= desde && +c.dataset.talle <= hasta) c.classList.add('selected');
  });
  aplicarInvQtyDefault();
}

function invDeselTodos() {
  document.querySelectorAll('.inv-talle-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('inv-resumen').style.display = 'none';
  document.getElementById('inv-btn-guardar').style.display = 'none';
}

function aplicarInvQtyDefault() {
  const qty = +document.getElementById('inv-qty-default').value || 1;
  document.querySelectorAll('.inv-talle-card.selected .inv-qty-input').forEach(inp => inp.value = qty);
}

function invGetSeleccionados() {
  const items = [];
  document.querySelectorAll('.inv-talle-card.selected').forEach(c => {
    items.push({ talle: c.dataset.talle, qty: +c.querySelector('.inv-qty-input').value || 1 });
  });
  return items;
}

function invPrevisualizar() {
  const items = invGetSeleccionados();
  if (!items.length) { toast('Seleccioná al menos un talle', 'error'); return; }
  const modelo = document.getElementById('inv-modelo').value.trim() || '—';
  const marca = document.getElementById('inv-marca').value.trim() || '—';
  const color = document.getElementById('inv-color').value.trim() || '—';
  const costo = +document.getElementById('inv-costo').value || 0;
  const precio = +document.getElementById('inv-precio').value || 0;
  const margen = precio > 0 ? Math.round((precio-costo)/precio*100) : 0;
  const totalQty = items.reduce((s,i) => s+i.qty, 0);
  document.getElementById('inv-resumen-items').innerHTML = items.map(i =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="color:var(--text2)">${modelo} T${i.talle} ${color} — ${marca}</span>
      <span style="display:flex;gap:12px"><span style="color:var(--text3)">$${costo.toLocaleString('es-AR')} → $${precio.toLocaleString('es-AR')} (${margen}%)</span><strong style="color:var(--green);font-family:var(--mono)">${i.qty} par${i.qty>1?'es':''}</strong></span>
    </div>`).join('');
  document.getElementById('inv-resumen-total').textContent = totalQty + ' pares totales';
  document.getElementById('inv-resumen').style.display = 'block';
  document.getElementById('inv-btn-guardar').style.display = 'flex';
}

async function guardarMercaderia() {
  const items = invGetSeleccionados();
  if (!items.length) return;
  const modelo = document.getElementById('inv-modelo').value.trim();
  if (!modelo) { toast('Ingresá el nombre del modelo', 'error'); return; }
  const marca = document.getElementById('inv-marca').value.trim();
  const color = document.getElementById('inv-color').value.trim();
  const costo = +document.getElementById('inv-costo').value || 0;
  const precio = +document.getElementById('inv-precio').value || 0;

  document.getElementById('inv-btn-guardar').style.display = 'none';
  document.getElementById('inv-guardando').style.display = 'block';

  let creados = 0;
  for (const item of items) {
    const prod = {
      id: crypto.randomUUID(), modelo, marca, color,
      talle: item.talle, costo, precio, stock: item.qty,
      sucursal: currentSucursal,
      creado_en: new Date().toISOString()
    };
    try {
      await sb('productos', { method: 'POST', body: prod, prefer: 'return=minimal' });
      creados++;
    } catch(e) { console.error(e); }
  }

  document.getElementById('inv-guardando').style.display = 'none';
  toast(`✓ ${creados} productos guardados correctamente`);

  // Reset form
  ['inv-modelo','inv-marca','inv-color'].forEach(id => document.getElementById(id).value = '');
  ['inv-costo','inv-precio'].forEach(id => document.getElementById(id).value = '0');
  document.getElementById('inv-qty-default').value = '1';
  invDeselTodos();
  cargarInventario();
}

async function actualizarStock(id, val) {
  await sb('productos?id=eq.' + id, { method: 'PATCH', body: { stock: val }, prefer: 'return=minimal' });
  const p = allProductos.find(x => x.id === id); if (p) p.stock = val;
  toast('Stock actualizado ✓'); renderInventario();
}

async function actualizarStockBtn(btn) {
  const input = btn.previousElementSibling;
  const id = input.dataset.id;
  const val = +input.value || 0;
  await actualizarStock(id, val);
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  await sb('productos?id=eq.' + id, { method: 'DELETE' });
  toast('Producto eliminado'); cargarInventario();
}

// EDITAR
function abrirEditar(id) {
  const p = allProductos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('edit-id').value = p.id;
  document.getElementById('edit-modelo').value = p.modelo || '';
  document.getElementById('edit-marca').value = p.marca || '';
  document.getElementById('edit-color').value = p.color || '';
  document.getElementById('edit-talle').value = p.talle || '';
  document.getElementById('edit-costo').value = p.costo || 0;
  document.getElementById('edit-precio').value = p.precio || 0;
  document.getElementById('edit-stock').value = p.stock || 0;
  document.getElementById('modal-editar').classList.add('open');
}

function cerrarEditar() {
  document.getElementById('modal-editar').classList.remove('open');
}

async function guardarEditar() {
  const id = document.getElementById('edit-id').value;
  const datos = {
    modelo: document.getElementById('edit-modelo').value.trim(),
    marca: document.getElementById('edit-marca').value.trim(),
    color: document.getElementById('edit-color').value.trim(),
    talle: document.getElementById('edit-talle').value.trim(),
    costo: +document.getElementById('edit-costo').value || 0,
    precio: +document.getElementById('edit-precio').value || 0,
    stock: +document.getElementById('edit-stock').value || 0,
  };
  await sb('productos?id=eq.' + id, { method: 'PATCH', body: datos, prefer: 'return=minimal' });
  toast('Producto actualizado ✓');
  cerrarEditar();
  cargarInventario();
}