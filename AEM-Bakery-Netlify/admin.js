/* AEM Bakery — owner dashboard */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => '$' + Number(v || 0).toFixed(2);
const src = i => /^(https?:|data:)/.test(i || '') ? i : 'assets/' + String(i || '').replace(/^assets\//, '');
const ic = (n, cls = '') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const db = window.AEMDB;
const C = window.AEM_SUPABASE || {};
const SITE = C.siteUrl || '';
const CATS = Object.fromEntries(Object.entries(window.AEM_CATEGORIES || { rolls: { label: 'Cinnamon rolls' }, treats: { label: 'Cookies and treats' }, bakes: { label: 'Breads and cakes' } }).map(([k, v]) => [k, v.label]));
const STATUS = { new: 'New', confirmed: 'Confirmed', baking: 'Baking', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
const NEXT = { new: ['confirmed', 'Confirm order'], confirmed: ['baking', 'Start baking'], baking: ['ready', 'Mark as ready'], ready: ['completed', 'Mark as completed'] };
const OPEN = o => !['completed', 'cancelled'].includes(o.status);
const PICKUP_ADDR = '17955 Roanoke Street NW, Ramsey, MN 55303';

let products = [], orders = [], settings = {}, manifest = [], library = [];
let tab = 'home', oFilter = 'open', oQuery = '', oSort = 'new', openOrder = null;
let cFilter = 'all', pQuery = '', page = null, cQuery = '';
let pending = {};            // website content edits not yet saved
let setDirty = false, work = null;  // settings edits

/* ---------------- small helpers ---------------- */
const isoDay = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = n => isoDay(new Date(Date.now() + n * 864e5));
const dayName = d => { if (!d) return 'No date'; if (d === isoDay()) return 'Today'; if (d === addDays(1)) return 'Tomorrow'; if (d === addDays(-1)) return 'Yesterday'; return new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
const longDay = d => d ? new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; const n = Math.floor(s / 86400); return n === 1 ? 'yesterday' : n < 7 ? n + ' days ago' : new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const win = w => w ? String(w).split(' (')[0] : '';
const winTime = w => (String(w || '').match(/\((.*)\)/) || [])[1] || '';
const itemCount = o => (o.items || []).reduce((n, i) => n + (i.qty || 0), 0);
const pill = s => `<span class="pill s-${esc(s)}">${STATUS[s] || esc(s)}</span>`;
const pageFile = key => key.split('.')[0] + '.html';
const siteHref = f => SITE || f;

function toast(msg, bad) {
  const t = $('[data-toast]'); t.innerHTML = (bad ? ic('x') : ic('check')) + `<span>${esc(msg)}</span>`;
  t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}
function ask(title, text, ok = 'OK', danger = false) {
  const d = $('#confirm'); $('[data-confirm-title]').textContent = title; $('[data-confirm-text]').textContent = text;
  const b = $('[data-confirm-ok]'); b.textContent = ok; b.classList.toggle('danger', danger);
  d.returnValue = ''; d.showModal();
  return new Promise(res => d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true }));
}
const dirtyHere = () => (tab === 'content' && Object.keys(pending).length) || (tab === 'settings' && setDirty);

/* ---------------- start ---------------- */
async function start() {
  if (db.mode === 'static') { $('#setup').hidden = false; return; }
  if (db.mode === 'demo') $('#demo-banner').hidden = false;
  const session = await db.session();
  if (!session) { $('#login').hidden = false; $('[name=email]', $('#login')).focus(); return; }
  $('#login').hidden = true; $('#app').hidden = false;
  $$('[data-site-link]').forEach(a => { if (SITE) a.href = SITE; });
  const email = await db.user?.();
  $('[data-account-email]').textContent = email ? `Signed in as ${email}.` : db.mode === 'demo' ? 'Preview mode, no sign-in needed.' : 'Signed in.';
  const [m, l] = await Promise.all([fetch('content-manifest.json').then(r => r.json()).catch(() => []), fetch('assets-list.json').then(r => r.json()).catch(() => [])]);
  manifest = m; library = l;
  await Promise.all([loadProducts(), loadOrders(), loadSettings()]);
  db.onOrders(async () => {
    const before = new Set(orders.map(o => o.id)); await loadOrders();
    const fresh = orders.filter(o => !before.has(o.id));
    if (fresh.length && before.size) { toast(`New order from ${fresh[0].name}`); document.title = '● New order | Dashboard'; setTimeout(() => { document.title = 'Dashboard | AEM Bakery'; }, 8000); }
  });
  db.onMenu(async () => { await Promise.all([loadProducts(), loadSettings()]); });
  setInterval(() => { if (tab === 'orders' || tab === 'home') draw(); }, 60000);
  go(location.hash.slice(1) || 'home', { force: true });
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, err = $('[data-login-error]'); err.hidden = true;
  const b = $('button[type=submit]', f); b.disabled = true; b.textContent = 'Signing in…';
  try { await db.signIn(f.email.value.trim(), f.password.value); $('#login').hidden = true; start(); }
  catch { err.textContent = 'That email and password don’t match. Try again.'; err.hidden = false; }
  b.disabled = false; b.textContent = 'Sign in';
});
document.addEventListener('click', async e => { if (e.target.closest('[data-signout]')) { if (dirtyHere() && !await ask('Leave without saving?', 'You have changes that aren’t saved yet.', 'Sign out', true)) return; pending = {}; setDirty = false; await db.signOut(); location.reload(); } });

/* ---------------- navigation ---------------- */
const TITLES = { home: 'Home', orders: 'Orders', products: 'Products', content: 'Website', settings: 'Settings' };
async function go(t, o = {}) {
  if (!TITLES[t]) t = 'home';
  if (t === tab && !o.force) return;
  if (!o.force && dirtyHere() && !await ask('Discard unsaved changes?', 'You changed things on this page but didn’t save them.', 'Discard', true)) return;
  if (tab === 'content' && t !== 'content') pending = {};
  if (tab === 'settings' && t !== 'settings') { setDirty = false; work = null; }
  tab = t;
  $$('[data-tab]').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.toggleAttribute('aria-current', b.dataset.tab === t); });
  $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== t; });
  $('[data-mtitle]').textContent = TITLES[t];
  history.replaceState(null, '', '#' + t);
  draw(); savebar(); scrollTo(0, 0);
}
function draw() { ({ home: drawHome, orders: drawOrders, products: drawProducts, content: drawContent, settings: drawSettings })[tab](); }
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab]'); if (t) { go(t.dataset.tab); return; }
  const g = e.target.closest('[data-go]');
  if (g) {
    if (g.dataset.filter) { oFilter = g.dataset.filter; openOrder = null; }
    await go(g.dataset.go);
    if (g.hasAttribute('data-new-product')) openProduct(null);
    if (g.dataset.focus) { const el = $('#set-' + g.dataset.focus); el?.scrollIntoView({ block: 'start', behavior: 'smooth' }); setTimeout(() => el?.querySelector('input')?.focus({ preventScroll: true }), 350); }
    if (g.dataset.open) { openOrder = g.dataset.open; drawOrders(); }
  }
});
addEventListener('beforeunload', e => { if (Object.keys(pending).length || setDirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- store open / paused ---------------- */
function drawStore() {
  const on = settings.accepting_orders !== false;
  $$('.store-state').forEach(b => { b.classList.toggle('off', !on); });
  $$('[data-store-label]').forEach(s => s.textContent = on ? 'Taking orders' : 'Orders paused');
  $('[data-paused-bar]').hidden = on;
}
document.addEventListener('click', async e => {
  if (!e.target.closest('[data-store-toggle]')) return;
  const on = settings.accepting_orders !== false;
  if (on && !await ask('Pause new orders?', 'Customers will still see your website and menu, but checkout will be closed until you turn orders back on.', 'Pause orders')) return;
  try { await db.saveSetting('accepting_orders', !on); settings.accepting_orders = !on; drawStore(); if (tab === 'settings' && !setDirty) drawSettings(); toast(on ? 'Orders paused' : 'Taking orders again'); }
  catch { toast('Couldn’t change that. Check your connection.', true); }
});

/* ---------------- home ---------------- */
function drawHome() {
  const h = new Date().getHours();
  $('[data-greet]').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('[data-today]').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const today = isoDay(), wk = Date.now() - 7 * 864e5;
  const fresh = orders.filter(o => o.status === 'new');
  const due = orders.filter(o => OPEN(o) && o.pickup_date === today);
  const week = orders.filter(o => o.status !== 'cancelled' && new Date(o.created_at) >= wk);
  const onMenu = products.filter(p => p.active !== false).length;
  $('[data-stats]').innerHTML = `
    <button class="stat${fresh.length ? ' hot' : ''}" data-go="orders" data-filter="new"><span>New orders</span><b>${fresh.length}</b><small>${fresh.length ? 'Waiting for you to confirm' : 'All caught up'}</small></button>
    <button class="stat" data-go="orders" data-filter="open"><span>Due today</span><b>${due.length}</b><small>${due.length ? due.reduce((n, o) => n + itemCount(o), 0) + ' items to bake' : 'Nothing due today'}</small></button>
    <div class="stat"><span>Sales, last 7 days</span><b>${money(week.reduce((n, o) => n + Number(o.total || 0), 0)).replace(/\.00$/, '')}</b><small>${week.length} ${week.length === 1 ? 'order' : 'orders'}</small></div>
    <button class="stat" data-go="products"><span>On the menu</span><b>${onMenu}</b><small>of ${products.length} products</small></button>`;
  $('[data-home-new]').innerHTML = fresh.length ? fresh.slice(0, 5).map(o => `<li><button class="mini" data-go="orders" data-filter="new" data-open="${esc(o.id)}"><b>${esc(o.name)}</b><small>${esc(o.fulfilment)} · ${dayName(o.pickup_date)}${o.pickup_window ? ', ' + esc(win(o.pickup_window).toLowerCase()) : ''} · ${ago(o.created_at)}</small><strong>${money(o.total)}</strong></button></li>`).join('')
    : `<li class="empty"><b>You’re all caught up</b>New orders will show up here.</li>`;
  const soon = orders.filter(o => OPEN(o) && o.pickup_date && o.pickup_date >= today && o.pickup_date <= addDays(7)).sort((a, b) => (a.pickup_date + winTime(a.pickup_window)).localeCompare(b.pickup_date + winTime(b.pickup_window)));
  const byDay = {}; soon.forEach(o => (byDay[o.pickup_date] = byDay[o.pickup_date] || []).push(o));
  $('[data-home-upcoming]').innerHTML = soon.length ? Object.entries(byDay).map(([d, list]) => `<div class="day"><h3>${dayName(d)}</h3>${list.map(o => `<button class="mini" data-go="orders" data-filter="open" data-open="${esc(o.id)}"><b>${esc(o.name)}</b><small>${esc(win(o.pickup_window))} · ${itemCount(o)} items · ${STATUS[o.status]}</small><strong>${o.fulfilment === 'Delivery' ? ic('truck') : ic('pin')}</strong></button>`).join('')}</div>`).join('')
    : `<p class="empty"><b>Nothing in the next 7 days</b>Confirmed orders will be listed by day.</p>`;
  drawStore();
}

/* ---------------- orders ---------------- */
async function loadOrders() { orders = (await db.orders()).map(o => ({ ...o, items: o.items || [] })); drawBadges(); if (tab === 'orders' || tab === 'home') draw(); }
function drawBadges() { const n = orders.filter(o => o.status === 'new').length; $$('[data-new-count]').forEach(b => { b.textContent = n; b.hidden = !n; }); }
function drawOrders() {
  const counts = { open: orders.filter(OPEN).length, all: orders.length }; Object.keys(STATUS).forEach(k => counts[k] = orders.filter(o => o.status === k).length);
  const tabs = [['open', 'Open'], ['new', 'New'], ['confirmed', 'Confirmed'], ['baking', 'Baking'], ['ready', 'Ready'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']];
  $('[data-status-tabs]').innerHTML = tabs.map(([k, l]) => `<button role="tab" aria-selected="${oFilter === k}" class="${oFilter === k ? 'on' : ''}" data-of="${k}">${l}<em>${counts[k]}</em></button>`).join('');
  const q = oQuery.trim().toLowerCase();
  let list = orders.filter(o => (oFilter === 'all' || (oFilter === 'open' ? OPEN(o) : o.status === oFilter)) && (!q || [o.name, o.email, o.ref, o.phone].join(' ').toLowerCase().includes(q)));
  list = oSort === 'due' ? list.sort((a, b) => String(a.pickup_date || '9').localeCompare(String(b.pickup_date || '9')) || winTime(a.pickup_window).localeCompare(winTime(b.pickup_window))) : list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $('[data-order-list]').innerHTML = list.length ? list.map(o => `<button class="o-row${openOrder === o.id ? ' on' : ''}" data-open-order="${esc(o.id)}">
      <span class="who">${esc(o.name)}</span><span class="amt">${money(o.total)}</span>
      <span class="meta">${o.fulfilment === 'Delivery' ? 'Delivery' : 'Pickup'} <b>${dayName(o.pickup_date)}</b>${o.pickup_window ? ', ' + esc(win(o.pickup_window).toLowerCase()) : ''} · ${itemCount(o)} items</span>${pill(o.status)}
      <span class="ago">${esc(o.ref)} · ${ago(o.created_at)}</span></button>`).join('')
    : `<div class="empty"><b>${orders.length ? 'No orders here' : 'No orders yet'}</b>${orders.length ? (q ? 'Try a different search.' : 'Try another tab.') : 'They’ll appear here the moment a customer checks out.'}</div>`;
  drawOrder();
}
function itemsHTML(o) {
  return (o.items || []).map(i => {
    if (String(i.id).startsWith('hbasket-')) {
      const [head, ...rest] = String(i.opt || '').split(': ');
      return `<li class="basket"><span class="q">${i.qty}×</span><div><b>${ic('basket')} ${esc(head || 'Holiday basket')}</b><ul>${rest.join(': ').split(', ').filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><span>${money(i.price * i.qty)}</span></li>`;
    }
    const gift = String(i.id).startsWith('egift-');
    return `<li><span class="q">${i.qty}×</span><div><b>${esc(i.name)}</b>${i.opt ? `<small>${esc(i.opt)}</small>` : ''}${gift ? '<small>eGift Card: send it to the customer by email</small>' : ''}</div><span>${money(i.price * i.qty)}</span></li>`;
  }).join('');
}
function emailLink(o) {
  const first = String(o.name || '').split(' ')[0] || 'there';
  const del = o.fulfilment === 'Delivery';
  const when = `${longDay(o.pickup_date)}${o.pickup_window ? ', ' + String(o.pickup_window).toLowerCase() : ''}`;
  const lines = (o.items || []).map(i => `${i.qty} × ${String(i.id).startsWith('hbasket-') ? (i.opt || 'Holiday basket') : i.name}${i.opt && !String(i.id).startsWith('hbasket-') ? ' (' + i.opt + ')' : ''}`).join('\n');
  const body = o.status === 'ready'
    ? `Hi ${first},\n\nGood news: your order ${o.ref} is ${del ? 'on its way' : 'ready for pickup'}!\n\n${del ? 'Delivering to: ' + (o.address || '') : 'Pickup: ' + PICKUP_ADDR}\n\nThank you,\nAEM Bakery`
    : `Hi ${first},\n\nThank you for your order! It’s confirmed for ${del ? 'delivery' : 'pickup'} on ${when}.\n\n${lines}\n${Number(o.delivery_fee) ? 'Delivery: ' + money(o.delivery_fee) + '\n' : ''}Total: ${money(o.total)}\n\n${del ? 'Delivering to: ' + (o.address || '') : 'Pickup: ' + PICKUP_ADDR}\n\nOrder number: ${o.ref}\n\nThank you,\nAEM Bakery`;
  return `mailto:${encodeURIComponent(o.email)}?subject=${encodeURIComponent('Your AEM Bakery order ' + o.ref)}&body=${encodeURIComponent(body)}`;
}
function drawOrder() {
  const o = orders.find(x => x.id === openOrder), box = $('[data-order-detail]');
  $('.orders').classList.toggle('open', !!o);
  if (!o) { box.innerHTML = `<div class="od-empty"><div>${ic('orders')}<b>Select an order</b><br>Its details will show here.</div></div>`; return; }
  const del = o.fulfilment === 'Delivery', nx = NEXT[o.status], sub = (o.items || []).reduce((n, i) => n + i.price * i.qty, 0), fee = Number(o.delivery_fee) || 0;
  box.innerHTML = `
    <header class="od-h"><button class="icon-btn back" data-close-order aria-label="Back to orders">${ic('back')}</button>
      <div class="grow"><h2>${esc(o.name)}</h2><p>${esc(o.ref)} · placed ${new Date(o.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div>${pill(o.status)}</header>
    <div class="od-next">${nx ? `<button class="btn primary" data-set-status="${nx[0]}">${ic('check')}${nx[1]}</button>` : ''}
      <select class="select" data-status-select aria-label="Change status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${k === o.status ? ' selected' : ''}>${k === o.status ? 'Status: ' : 'Mark as '}${l}</option>`).join('')}</select></div>
    <section class="od-sec"><h3>${del ? 'Delivery' : 'Pickup'}</h3><div class="od-facts">
      <div class="fact">${ic('clock')}<div><b>${esc(dayName(o.pickup_date))}</b>${esc(o.pickup_window || '')}</div></div>
      <div class="fact">${ic(del ? 'truck' : 'pin')}<div>${del ? `<b>Deliver to</b><a href="https://maps.google.com/?q=${encodeURIComponent(o.address || '')}" target="_blank" rel="noopener">${esc(o.address || 'No address given')}</a>` : `<b>Pickup at home</b>${PICKUP_ADDR}`}</div></div>
    </div></section>
    <section class="od-sec"><h3>Customer</h3><div class="od-facts">
      <div class="fact">${ic('mail')}<div><b>Email</b><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></div></div>
      ${o.phone ? `<div class="fact">${ic('phone')}<div><b>Phone</b><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div></div>` : ''}
    </div></section>
    ${o.notes ? `<section class="od-sec"><h3>Note from customer</h3><p class="note">${esc(o.notes)}</p></section>` : ''}
    <section class="od-sec"><h3>Items (${itemCount(o)})</h3><ul class="items">${itemsHTML(o)}</ul>
      <div class="sums"><div><span>Subtotal</span><span>${money(sub)}</span></div>${del ? `<div><span>Delivery</span><span>${fee ? money(fee) : 'Free'}</span></div>` : ''}<div class="tot"><span>Total</span><span>${money(o.total)}</span></div></div></section>
    <section class="od-sec od-actions"><a class="btn" href="${emailLink(o)}">${ic('mail')}${o.status === 'ready' ? 'Email: it’s ready' : 'Email confirmation'}</a>${o.phone ? `<a class="btn" href="tel:${esc(o.phone)}">${ic('phone')}Call</a>` : ''}<button class="btn" data-print>${ic('print')}Print</button></section>`;
}
async function setStatus(o, s) {
  if (s === 'cancelled' && !await ask('Cancel this order?', `${o.name}’s order ${o.ref} will be marked as cancelled. Let them know by email.`, 'Cancel order', true)) { drawOrder(); return; }
  const prev = o.status; o.status = s; drawOrders(); drawBadges();
  try { await db.updateOrder(o.id, { status: s }); toast(`${o.ref} marked as ${STATUS[s].toLowerCase()}`); }
  catch { o.status = prev; drawOrders(); drawBadges(); toast('Couldn’t update the order. Check your connection.', true); }
}
document.addEventListener('click', e => {
  const of = e.target.closest('[data-of]'); if (of) { oFilter = of.dataset.of; drawOrders(); return; }
  const op = e.target.closest('[data-open-order]'); if (op) { openOrder = op.dataset.openOrder; drawOrders(); if (innerWidth <= 1024) scrollTo(0, 0); return; }
  if (e.target.closest('[data-close-order]')) { openOrder = null; drawOrders(); return; }
  if (e.target.closest('[data-print]')) { print(); return; }
  const ss = e.target.closest('[data-set-status]'); if (ss) { const o = orders.find(x => x.id === openOrder); if (o) setStatus(o, ss.dataset.setStatus); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-status-select]')) { const o = orders.find(x => x.id === openOrder); if (o && e.target.value !== o.status) setStatus(o, e.target.value); } });
$('[data-order-search]').addEventListener('input', e => { oQuery = e.target.value; drawOrders(); });
$('[data-order-sort]').addEventListener('change', e => { oSort = e.target.value; drawOrders(); });

/* ---------------- products ---------------- */
async function loadProducts() { products = await db.products({ all: true }); if (tab === 'products' || tab === 'home') draw(); }
function drawProducts() {
  $('[data-cat-tabs]').innerHTML = [['all', 'All', products.length], ...Object.entries(CATS).map(([k, l]) => [k, l, products.filter(p => p.category === k).length]), ['hidden', 'Hidden', products.filter(p => p.active === false).length]]
    .map(([k, l, c]) => `<button class="${cFilter === k ? 'on' : ''}" data-cf="${k}">${esc(l)}<em>${c}</em></button>`).join('');
  const q = pQuery.trim().toLowerCase();
  const list = products.filter(p => (cFilter === 'all' || (cFilter === 'hidden' ? p.active === false : p.category === cFilter)) && (!q || (p.name + ' ' + (p.tagline || '')).toLowerCase().includes(q)));
  $('[data-product-list]').innerHTML = `<div class="t-head"><span></span><span>Product</span><span>Category</span><span>Price</span><span>On the menu</span><span></span></div>` + (list.length ? list.map(p => `
    <div class="p-row${p.active === false ? ' off' : ''}" data-edit-prod="${esc(p.id)}" tabindex="0" role="button" aria-label="Edit ${esc(p.name)}">
      <img src="${esc(src(p.image))}" alt="" loading="lazy">
      <span class="p-name"><b>${esc(p.name)}</b><small>${esc(p.tagline || '')}</small></span>
      <span class="p-cat">${esc(CATS[p.category] || p.category)}${p.badge ? ` · ${esc(p.badge)}` : ''}${p.in_basket && p.category !== 'holiday' ? ' · In baskets' : ''}</span>
      <span class="p-price">${money(p.price)}</span>
      <label class="p-on" data-stop><span class="switch"><input type="checkbox" data-toggle-prod="${esc(p.id)}"${p.active !== false ? ' checked' : ''} aria-label="${esc(p.name)} on the menu"><i></i></span><span>${p.active !== false ? 'On' : 'Hidden'}</span></label>
      ${ic('chev')}</div>`).join('') : `<div class="empty"><b>No products found</b>${q ? 'Try a different search.' : 'Add your first product.'}</div>`);
}
document.addEventListener('click', e => {
  const cf = e.target.closest('[data-cf]'); if (cf) { cFilter = cf.dataset.cf; drawProducts(); return; }
  if (e.target.closest('[data-stop]')) return;
  const ep = e.target.closest('[data-edit-prod]'); if (ep) { openProduct(products.find(p => p.id === ep.dataset.editProd)); return; }
  if (e.target.closest('[data-new-product]') && !e.target.closest('[data-go]')) openProduct(null);
});
document.addEventListener('keydown', e => { const ep = e.target.closest?.('[data-edit-prod]'); if (ep && (e.key === 'Enter' || e.key === ' ') && e.target === ep) { e.preventDefault(); ep.click(); } });
document.addEventListener('change', async e => {
  const t = e.target.closest('[data-toggle-prod]'); if (!t) return;
  const p = products.find(x => x.id === t.dataset.toggleProd); if (!p) return;
  const on = t.checked; p.active = on; drawProducts();
  try { await db.saveProduct({ ...p, active: on }); toast(on ? `${p.name} is back on the menu` : `${p.name} is hidden from the website`); }
  catch { p.active = !on; drawProducts(); toast('Couldn’t save. Check your connection.', true); }
});
$('[data-prod-search]').addEventListener('input', e => { pQuery = e.target.value; drawProducts(); });

const sheet = $('#prod-sheet'), pf = $('[data-prod-form]'); let editing = null, snap = '';
const ser = () => JSON.stringify([...new FormData(pf)].concat([['a', pf.active.checked], ['f', pf.has_frosting_options.checked], ['b', pf.in_basket.checked]]));
const catHelp = () => { const h = pf.category.value === 'holiday'; $('[data-cat-help]').textContent = h ? 'Shown in Holiday specials and inside holiday baskets, not in the daily shop.' : 'Shown in the daily shop.'; pf.has_frosting_options.closest('.switch-row').hidden = h; $('[data-basket-row]').hidden = h; };
pf.category.addEventListener('change', catHelp);
pf.category.innerHTML = Object.entries(CATS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
function openProduct(p) {
  editing = p;
  const d = p || { name: '', price: '', category: cFilter in CATS ? cFilter : 'rolls', image: 'studio-rolls.webp', tagline: '', description: '', badge: '', active: true, has_frosting_options: false };
  $('#prod-sheet-title').textContent = p ? 'Edit product' : 'New product';
  pf.name.value = d.name; pf.price.value = d.price === '' ? '' : Number(d.price).toFixed(2); pf.category.value = d.category; pf.image.value = d.image;
  pf.tagline.value = d.tagline || ''; pf.description.value = d.description || ''; pf.badge.value = d.badge || '';
  pf.active.checked = d.active !== false; pf.has_frosting_options.checked = !!d.has_frosting_options; pf.in_basket.checked = !!d.in_basket;
  catHelp(); $('[data-prod-photo]').src = src(d.image); $('[data-prod-delete]').hidden = !p; $('[data-prod-error]').hidden = true;
  $$('.fld.bad', pf).forEach(f => f.classList.remove('bad'));
  snap = ser(); sheet.showModal(); if (!p) setTimeout(() => pf.name.focus(), 50);
}
async function closeSheet() { if (ser() !== snap && !await ask('Discard changes?', 'Your changes to this product won’t be saved.', 'Discard', true)) return; sheet.close(); }
sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); if (e.target.closest('[data-sheet-close]')) closeSheet(); });
$('[data-prod-pick]').addEventListener('click', () => pickPhoto(url => { pf.image.value = url.replace(/^assets\//, ''); $('[data-prod-photo]').src = src(url); }));
pf.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('[data-prod-error]'); err.hidden = true; $$('.fld.bad', pf).forEach(f => f.classList.remove('bad'));
  const bad = [];
  if (!pf.name.value.trim()) bad.push([pf.name, 'Give the product a name.']);
  if (pf.price.value === '' || Number(pf.price.value) < 0) bad.push([pf.price, 'Enter a price, like 12.00.']);
  if (bad.length) { bad.forEach(([f]) => f.closest('.fld').classList.add('bad')); err.textContent = bad[0][1]; err.hidden = false; bad[0][0].focus(); return; }
  const slug = pf.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = editing ? editing.id : (products.some(p => p.id === slug) ? slug + '-' + Date.now().toString(36).slice(-4) : slug || 'bake-' + Date.now().toString(36));
  const row = { ...(editing || { sort: (Math.max(0, ...products.map(p => p.sort || 0)) + 10) }), id, name: pf.name.value.trim(), price: Number(pf.price.value), category: pf.category.value, image: pf.image.value, tagline: pf.tagline.value.trim(), description: pf.description.value.trim(), badge: pf.badge.value.trim() || null, active: pf.active.checked, has_frosting_options: pf.has_frosting_options.checked, in_basket: pf.category.value !== 'holiday' && pf.in_basket.checked };
  const b = $('button[type=submit]', pf); b.disabled = true; b.textContent = 'Saving…';
  try {
    await db.saveProduct(row);
    const i = products.findIndex(p => p.id === id); if (i >= 0) products[i] = row; else products.push(row);
    snap = ser(); sheet.close(); drawProducts();
    toast(row.active ? `${row.name} saved and live` : `${row.name} saved (hidden)`);
  } catch { err.textContent = 'Couldn’t save. Check your connection and try again.'; err.hidden = false; }
  b.disabled = false; b.textContent = 'Save';
});
$('[data-prod-delete]').addEventListener('click', async () => {
  if (!editing) return;
  if (!await ask(`Delete “${editing.name}”?`, 'This removes it for good. To hide it for now, switch off “On the menu” instead.', 'Delete', true)) return;
  try { await db.deleteProduct(editing.id); products = products.filter(p => p.id !== editing.id); snap = ser(); sheet.close(); drawProducts(); toast('Product deleted'); }
  catch { toast('Couldn’t delete. Check your connection.', true); }
});

/* ---------------- photo picker ---------------- */
const picker = $('#photo-picker'); let pickCb = null;
function pickPhoto(cb) { pickCb = cb; $('[data-library]').innerHTML = library.map(a => `<button type="button" data-lib="${esc(a)}" aria-label="Use this photo"><img src="${esc(a)}" alt="" loading="lazy"></button>`).join(''); picker.showModal(); }
picker.addEventListener('click', e => {
  if (e.target === picker || e.target.closest('[data-pp-close]')) { picker.close(); return; }
  const l = e.target.closest('[data-lib]'); if (l) { pickCb?.(l.dataset.lib); picker.close(); }
});
$('[data-upload]').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose a photo file.', true); return; }
  if (file.size > 5e6) { toast('That photo is over 5 MB. Please choose a smaller one.', true); return; }
  toast('Uploading…');
  try { const url = await db.upload(file); pickCb?.(url); picker.close(); toast('Photo uploaded'); } catch { toast('Upload failed. Try a smaller photo.', true); }
});

/* ---------------- website content ---------------- */
async function loadSettings() {
  settings = await db.settings(); drawStore();
  if (tab === 'settings' && !setDirty) drawSettings();
  if (tab === 'content') drawContent();
}
const curVal = m => m.key in pending ? (pending[m.key] ?? m.default) : ((settings.content || {})[m.key] ?? m.default);
function drawContent() {
  const pages = [...new Set(manifest.map(m => m.page))];
  page = page || pages[0];
  const pend = p => manifest.filter(m => m.page === p && m.key in pending).length;
  $('[data-pages]').innerHTML = pages.map(p => `<button class="${page === p && !cQuery ? 'on' : ''}" data-pg="${esc(p)}">${esc(p)}${pend(p) ? `<em>${pend(p)}</em>` : ''}</button>`).join('');
  $('[data-pages-select]').innerHTML = pages.map(p => `<option value="${esc(p)}"${page === p ? ' selected' : ''}>${esc(p)}${pend(p) ? ` (${pend(p)} unsaved)` : ''}</option>`).join('');
  const saved = settings.content || {}, q = cQuery.trim().toLowerCase();
  const items = manifest.filter(m => q ? (String(curVal(m)).toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) : m.page === page);
  const groups = {}; items.forEach(m => { const g = (q ? m.page + ' · ' : '') + m.section; (groups[g] = groups[g] || []).push(m); });
  const file = q ? null : pageFile((manifest.find(m => m.page === page) || { key: 'index.0' }).key);
  $('[data-content-list]').innerHTML = (q ? `<div class="c-top"><h2>${items.length} ${items.length === 1 ? 'match' : 'matches'} for “${esc(cQuery.trim())}”</h2></div>` : `<div class="c-top"><h2>${esc(page)}</h2><a class="btn sm" href="${esc(siteHref(file))}" target="_blank" rel="noopener">${ic('ext')}View page</a></div>`) +
    (Object.entries(groups).map(([g, list]) => `<div class="card sec"><div class="card-h"><h2>${esc(g)}</h2></div><div class="sec-b">${list.map(m => {
      const v = curVal(m), isPend = m.key in pending, edited = m.key in saved;
      const tag = isPend ? '<span class="tag unsaved">Not saved</span>' : edited ? '<span class="tag edited">Edited</span>' : '';
      const reset = (edited || isPend) && v !== m.default ? `<button class="ci-reset" data-ci-reset="${m.key}">Use original</button>` : (isPend ? `<button class="ci-reset" data-ci-undo="${m.key}">Undo</button>` : '');
      if (m.type === 'image') return `<div class="ci ci-img${isPend ? ' changed' : ''}"><img src="${esc(v)}" alt=""><div><span class="ci-l">Photo ${tag}${reset}</span><span class="alt">${esc(m.label === 'Photo' ? '' : m.label)}</span><button class="btn sm" data-ci-photo="${m.key}">${ic('image')}Replace photo</button></div></div>`;
      const long = String(m.default).length > 60 || String(v).length > 60;
      return `<div class="ci${isPend ? ' changed' : ''}"><span class="ci-l">${esc(m.label)} ${tag}${reset}</span>${long ? `<textarea rows="${Math.min(6, Math.ceil(String(v).length / 70) + 1)}" data-ci="${m.key}">${esc(v)}</textarea>` : `<input data-ci="${m.key}" value="${esc(v)}">`}</div>`;
    }).join('')}</div></div>`).join('') || `<div class="card empty"><b>Nothing found</b>Try different words.</div>`);
  savebar();
}
const markField = (key) => { const el = $(`[data-ci="${key}"]`)?.closest('.ci'); if (el && !el.classList.contains('changed')) { el.classList.add('changed'); const l = $('.ci-l', el); if (!$('.tag.unsaved', l)) { $('.tag', l)?.remove(); l.insertAdjacentHTML('beforeend', '<span class="tag unsaved">Not saved</span>'); } } };
document.addEventListener('input', e => {
  const t = e.target.closest('[data-ci]'); if (!t) return;
  const m = manifest.find(x => x.key === t.dataset.ci), saved = (settings.content || {})[m.key] ?? m.default;
  if (t.value === saved) { delete pending[m.key]; t.closest('.ci').classList.remove('changed'); $('.tag.unsaved', t.closest('.ci'))?.remove(); }
  else { pending[m.key] = t.value; markField(m.key); }
  savebar(); const pe = $(`[data-pg="${CSS.escape(m.page)}"]`); if (pe) { const n = manifest.filter(x => x.page === m.page && x.key in pending).length; pe.innerHTML = esc(m.page) + (n ? `<em>${n}</em>` : ''); }
});
document.addEventListener('click', e => {
  const pg = e.target.closest('[data-pg]'); if (pg) { page = pg.dataset.pg; cQuery = ''; $('[data-content-search]').value = ''; drawContent(); scrollTo(0, 0); return; }
  const rs = e.target.closest('[data-ci-reset]'); if (rs) { const m = manifest.find(x => x.key === rs.dataset.ciReset); const saved = (settings.content || {})[m.key]; if (saved === undefined) delete pending[m.key]; else pending[m.key] = null; drawContent(); return; }
  const un = e.target.closest('[data-ci-undo]'); if (un) { delete pending[un.dataset.ciUndo]; drawContent(); return; }
  const ph = e.target.closest('[data-ci-photo]'); if (ph) { const k = ph.dataset.ciPhoto; pickPhoto(url => { const m = manifest.find(x => x.key === k); const saved = (settings.content || {})[k] ?? m.default; if (url === saved) delete pending[k]; else pending[k] = url; drawContent(); }); }
});
$('[data-pages-select]').addEventListener('change', e => { page = e.target.value; cQuery = ''; $('[data-content-search]').value = ''; drawContent(); });
$('[data-content-search]').addEventListener('input', e => { cQuery = e.target.value; drawContent(); });
async function saveContent() {
  const c = { ...(settings.content || {}) };
  for (const [k, v] of Object.entries(pending)) { const m = manifest.find(x => x.key === k); if (v === null || (m && v === m.default)) delete c[k]; else { if (!String(v).trim()) throw new Error('empty'); c[k] = String(v).trim(); } }
  await db.saveSetting('content', c); settings.content = c; pending = {};
}

/* ---------------- settings ---------------- */
const SF = () => $('[data-settings-form]');
function drawSettings() {
  const f = SF(), s = settings, D = db.DEFAULT_SETTINGS || {};
  work = { prep_tiers: JSON.parse(JSON.stringify(s.prep_tiers ?? D.prep_tiers ?? [])), delivery_zones: JSON.parse(JSON.stringify(s.delivery_zones ?? D.delivery_zones ?? [])) };
  f.accepting_orders.checked = s.accepting_orders !== false;
  f.announcement.value = s.announcement || '';
  f.lead_time_hours.value = s.lead_time_hours ?? 6;
  f.delivery_enabled.checked = s.delivery_enabled !== false;
  f.free_delivery_over.value = Number(s.free_delivery_over) || 0;
  f.basket_price.value = s.basket_price ?? 5;
  f.basket_capacity.value = s.basket_capacity ?? 12;
  f.payment_url.value = s.payment_url || '';
  drawRules(); drawZones(); annPreview(); payState();
  setDirty = false; savebar();
}
function drawRules() {
  $('[data-prep-rules]').innerHTML = work.prep_tiers.map((t, i) => `<div class="rule"><label class="fld">Orders with more than<span class="unit"><input type="number" min="1" max="999" value="${esc(t.items)}" data-rule="${i}" data-k="items" inputmode="numeric"><em>items</em></span></label><label class="fld">need at least<span class="unit"><input type="number" min="1" max="336" value="${esc(t.hours)}" data-rule="${i}" data-k="hours" inputmode="numeric"><em>hours</em></span></label><button type="button" class="icon-btn" data-del-rule="${i}" aria-label="Remove rule">${ic('trash')}</button></div>`).join('') || '<p class="muted">No extra rules. Every order uses the minimum notice.</p>';
}
function drawZones() {
  $('[data-zones]').innerHTML = work.delivery_zones.map((z, i) => `<div class="zone">
    <label class="fld z-name">Area name<input value="${esc(z.name)}" data-zone="${i}" data-k="name" placeholder="e.g. Ramsey"></label>
    <label class="fld z-zips">ZIP codes<input value="${esc(z.zips)}" data-zone="${i}" data-k="zips" placeholder="55303, 55304" inputmode="numeric"></label>
    <label class="fld z-fee">Fee<span class="unit pre"><em>$</em><input type="number" min="0" step="0.5" value="${esc(z.fee)}" data-zone="${i}" data-k="fee"></span></label>
    <button type="button" class="icon-btn" data-del-zone="${i}" aria-label="Remove area">${ic('trash')}</button></div>`).join('') || '<p class="muted">No delivery areas yet. Add one so customers can choose delivery.</p>';
}
const annPreview = () => { $('[data-ann-preview]').textContent = SF().announcement.value || ' '; };
const payState = () => { const v = SF().payment_url.value.trim(), el = $('[data-pay-state]'); el.className = 'pay-state ' + (v ? 'on' : 'off'); el.innerHTML = v ? `${ic('check')}Online payment is on` : `${ic('clock')}Not connected yet. Checkout still works and you’ll get every order by email.`; };
const touch = () => { setDirty = true; savebar(); };
SF().addEventListener('input', e => {
  const r = e.target.closest('[data-rule]'); if (r) work.prep_tiers[r.dataset.rule][r.dataset.k] = Number(r.value);
  const z = e.target.closest('[data-zone]'); if (z) work.delivery_zones[z.dataset.zone][z.dataset.k] = z.dataset.k === 'fee' ? Number(z.value) : z.value;
  if (e.target.name === 'announcement') annPreview();
  if (e.target.name === 'payment_url') payState();
  touch();
});
SF().addEventListener('change', touch);
SF().addEventListener('click', e => {
  if (e.target.closest('[data-add-rule]')) { const last = work.prep_tiers[work.prep_tiers.length - 1]; work.prep_tiers.push({ items: last ? last.items * 2 : 12, hours: last ? last.hours + 24 : 24 }); drawRules(); touch(); }
  const dr = e.target.closest('[data-del-rule]'); if (dr) { work.prep_tiers.splice(+dr.dataset.delRule, 1); drawRules(); touch(); }
  if (e.target.closest('[data-add-zone]')) { work.delivery_zones.push({ name: '', zips: '', fee: 5 }); drawZones(); touch(); setTimeout(() => $$('[data-zone][data-k=name]').pop()?.focus(), 30); }
  const dz = e.target.closest('[data-del-zone]'); if (dz) { work.delivery_zones.splice(+dz.dataset.delZone, 1); drawZones(); touch(); }
});
SF().addEventListener('submit', e => { e.preventDefault(); save(); });
async function saveSettings() {
  const f = SF();
  const url = f.payment_url.value.trim();
  if (url && !/^https:\/\/\S+$/.test(url)) throw new Error('The payment link must start with https://');
  const zones = work.delivery_zones.map(z => ({ name: String(z.name || '').trim(), zips: String(z.zips || '').split(/[^0-9]+/).filter(Boolean).join(', '), fee: Math.max(0, Number(z.fee) || 0) })).filter(z => z.zips);
  const badZip = zones.flatMap(z => z.zips.split(', ')).find(z => z.length !== 5);
  if (badZip) throw new Error(`“${badZip}” isn’t a 5-digit ZIP code.`);
  if (f.delivery_enabled.checked && !zones.length) throw new Error('Add at least one delivery area with a ZIP code, or turn off delivery.');
  const tiers = work.prep_tiers.filter(t => t.items > 0 && t.hours > 0).sort((a, b) => a.items - b.items);
  const vals = {
    accepting_orders: f.accepting_orders.checked, announcement: f.announcement.value.trim(),
    lead_time_hours: Math.max(1, Number(f.lead_time_hours.value) || 6), prep_tiers: tiers,
    delivery_enabled: f.delivery_enabled.checked, delivery_zones: zones, free_delivery_over: Math.max(0, Number(f.free_delivery_over.value) || 0),
    basket_price: Math.max(0, Number(f.basket_price.value) || 0), basket_capacity: Math.max(0, Math.round(Number(f.basket_capacity.value) || 0)),
    payment_url: url
  };
  const changed = Object.entries(vals).filter(([k, v]) => JSON.stringify(settings[k]) !== JSON.stringify(v));
  for (const [k, v] of changed) await db.saveSetting(k, v);
  Object.assign(settings, vals); drawStore();
}

/* ---------------- save bar ---------------- */
function savebar() {
  const n = Object.keys(pending).length, show = (tab === 'content' && n) || (tab === 'settings' && setDirty);
  $('[data-savebar]').hidden = !show;
  if (show) $('[data-savebar-text]').textContent = tab === 'content' ? `${n} unsaved ${n === 1 ? 'change' : 'changes'}` : 'Unsaved changes';
}
async function save() {
  const b = $('[data-save]'); b.disabled = true; b.textContent = 'Saving…';
  try {
    if (tab === 'content') { await saveContent(); drawContent(); toast('Saved. Your website is updated.'); }
    if (tab === 'settings') { await saveSettings(); drawSettings(); toast('Settings saved'); }
  } catch (x) { toast(x.message && !/fetch|network/i.test(x.message) ? (x.message === 'empty' ? 'Text can’t be empty. Use “Use original” to restore it.' : x.message) : 'Couldn’t save. Check your connection and try again.', true); }
  b.disabled = false; b.textContent = 'Save'; savebar();
}
$('[data-save]').addEventListener('click', save);
$('[data-discard]').addEventListener('click', () => { if (tab === 'content') { pending = {}; drawContent(); } if (tab === 'settings') drawSettings(); savebar(); });
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && !$('[data-savebar]').hidden) { e.preventDefault(); save(); } });

start().catch(e => { console.error(e); toast('Something went wrong loading the dashboard. Reload the page.', true); });
})();
