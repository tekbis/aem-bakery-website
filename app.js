/* AEM Bakery — site behaviour: navigation, catalogue, cart, checkout, forms, homepage hero. */
const AEM_START = () => {
'use strict';
const live = []; // re-render hooks for live menu updates
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

/* stock photos: fall back to a bundled photo if the remote one can't load */
const useFallback = im => { if (im.dataset.fallback && !im.dataset.fellBack) { im.dataset.fellBack = '1'; im.src = im.dataset.fallback; } };
$$('img[data-fallback]').forEach(im => { if (im.complete && im.naturalWidth === 0) useFallback(im); else im.addEventListener('error', () => useFallback(im), { once: true }); });
const products = window.AEM_PRODUCTS || [];
const CATS = window.AEM_CATEGORIES || {};
const CFG = window.AEM_CONFIG || { email: 'AEMBakery@gmail.com', leadTimeHours: 6 };
const giftItem = id => { const v = Number(String(id).split('-')[1]); return v >= 5 ? { id, name: `eGift Card ($${v})`, price: v, category: 'gift', image: 'logo-badge.webp', tagline: 'Sent by email', description: '' } : undefined; };
const basketItem = id => { const c = Number(String(id).split('-')[1]); return c > 0 ? { id, name: 'Holiday basket', price: c / 100, category: 'basket', image: 'studio-cookies.webp', tagline: '', description: '' } : undefined; };
const holidayItems = window.AEM_HOLIDAY_ITEMS || (window.AEM_HOLIDAY_ITEMS = []);
const byId = id => products.find(p => p.id === id) || holidayItems.find(p => p.id === id) || (String(id).startsWith('egift-') ? giftItem(id) : String(id).startsWith('hbasket-') ? basketItem(id) : undefined);
const money = v => '$' + Number(v).toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = p => /^(https?:|data:)/.test(p.image || '') ? p.image : 'assets/' + p.image;
const icon = d => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  minus: icon('<path d="M5 12h14"/>'),
  bag: icon('<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  clock: icon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  pin: icon('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
  card: icon('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17M7 15h3"/>')
};

/* ---------------- storage (wrapped: private windows can throw) ---------------- */
const store = {
  mem: {},
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return this.mem[k] ?? fallback; } },
  set(k, v) { this.mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  session(k, v) { try { if (v === undefined) { const r = sessionStorage.getItem(k); return r ? JSON.parse(r) : null; } sessionStorage.setItem(k, JSON.stringify(v)); } catch { return null; } }
};

/* ---------------- cart ---------------- */
const CART_KEY = 'aem-cart-v1';
let cart = store.get(CART_KEY, []).filter(l => byId(l.id) && l.qty > 0);
const keyOf = l => l.id + '::' + (l.opt || '');
const cartQty = () => cart.reduce((n, l) => n + l.qty, 0);
const cartTotal = () => cart.reduce((n, l) => n + l.qty * byId(l.id).price, 0);
function saveCart() { store.set(CART_KEY, cart); renderCart(); }
function addToCart(id, qty = 1, opt = '', o = {}) {
  const line = cart.find(l => keyOf(l) === id + '::' + opt);
  if (line) line.qty = Math.min(99, line.qty + qty); else cart.push({ id, qty, opt });
  saveCart();
  $$('[data-cart-count]').forEach(el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
  if (!o.silent) { const p = byId(id); toast(p.name, { image: img(p), sub: (qty > 1 ? qty + ' × ' : '') + money(p.price) + (opt && !id.startsWith('egift-') ? ' · ' + opt : '') }); }
}
function setQty(key, qty) {
  if (qty <= 0) cart = cart.filter(l => keyOf(l) !== key);
  else { const l = cart.find(x => keyOf(x) === key); if (l) l.qty = Math.min(99, qty); }
  saveCart();
}
function lineHTML(l, editable = true) {
  const p = byId(l.id); const k = esc(keyOf(l));
  return `<li class="cart-item"><img src="${img(p)}" alt="" loading="lazy"><div><h3>${esc(p.name)}</h3>${l.opt ? `<span class="opt">${esc(l.opt)}</span>` : ''}${editable ? `<div class="qty qty--sm"><button type="button" data-qty="${k}" data-delta="-1" aria-label="One fewer ${esc(p.name)}">${ICON.minus}</button><input value="${l.qty}" inputmode="numeric" aria-label="Quantity of ${esc(p.name)}" data-qty-input="${k}"><button type="button" data-qty="${k}" data-delta="1" aria-label="One more ${esc(p.name)}">${ICON.plus}</button></div><button type="button" class="remove" data-remove="${k}">Remove</button>` : `<span class="t-small">Qty ${l.qty} × ${money(p.price)}</span>`}</div><span class="line-price">${money(p.price * l.qty)}</span></li>`;
}
function renderCart() {
  const before = cart.length; cart = cart.filter(l => byId(l.id)); if (cart.length !== before) store.set(CART_KEY, cart);
  $$('[data-cart-count]').forEach(el => el.textContent = cartQty());
  $$('[data-cart-qty]').forEach(el => el.textContent = cartQty());
  $$('[data-cart-subtotal]').forEach(el => el.textContent = money(cartTotal()));
  const list = $('[data-cart-items]');
  if (list) {
    list.innerHTML = cart.length ? cart.map(l => lineHTML(l)).join('') : `<li class="cart-empty"><img src="assets/studio-cookies.webp" alt=""><strong>Your order is empty</strong>Fresh bakes are a tap away.<br><a class="btn" href="shop.html">Browse the shop</a></li>`;
    $('[data-cart-foot]').hidden = !cart.length;
  }
  const summary = $('[data-summary-items]');
  if (summary) summary.innerHTML = cart.length ? cart.map(l => lineHTML(l)).join('') : `<li class="cart-empty"><strong>Your order is empty</strong><a class="btn" href="shop.html">Browse the shop</a></li>`;
  const place = $('[data-place-order]'); if (place) place.disabled = !cart.length;
}
document.addEventListener('click', e => {
  const q = e.target.closest('[data-qty]');
  if (q) { const l = cart.find(x => keyOf(x) === q.dataset.qty); if (l) setQty(q.dataset.qty, l.qty + Number(q.dataset.delta)); return; }
  const r = e.target.closest('[data-remove]');
  if (r) setQty(r.dataset.remove, 0);
});
document.addEventListener('change', e => {
  const input = e.target.closest('[data-qty-input]');
  if (input) setQty(input.dataset.qtyInput, Math.max(0, parseInt(input.value, 10) || 0));
});

/* ---------------- overlays: cart drawer + nav drawer ---------------- */
const backdrop = $('[data-backdrop]');
const cartEl = $('#cart');
const navEl = $('#nav-drawer');
const menuBtn = $('.menu-btn');
let lastFocus = null;
/* scroll lock that keeps the page exactly where it was (iOS/Android safe) */
let lockY = 0, isLocked = false;
function lockScroll() { if (isLocked) return; isLocked = true; lockY = window.scrollY; document.body.style.cssText += `;position:fixed;top:${-lockY}px;left:0;right:0;width:100%`; document.body.classList.add('locked'); }
function unlockScroll() { if (!isLocked) return; isLocked = false; ['position','top','left','right','width'].forEach(p => document.body.style.removeProperty(p)); document.body.classList.remove('locked'); const html = document.documentElement, prev = html.style.scrollBehavior; html.style.scrollBehavior = 'auto'; window.scrollTo(0, lockY); html.style.scrollBehavior = prev; }
function openPanel(el) {
  closePanels(false);
  lastFocus = document.activeElement;
  el.classList.add('open'); el.removeAttribute('inert'); el.setAttribute('aria-hidden', 'false');
  backdrop?.classList.add('show'); lockScroll();
  if (el === navEl) menuBtn?.setAttribute('aria-expanded', 'true');
  setTimeout(() => el.querySelector('button, a')?.focus({ preventScroll: true }), 50);
}
function closePanels(restore = true) {
  [cartEl, navEl].forEach(el => { if (!el) return; el.classList.remove('open'); el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); });
  backdrop?.classList.remove('show'); unlockScroll();
  menuBtn?.setAttribute('aria-expanded', 'false');
  if (restore && lastFocus) lastFocus.focus?.({ preventScroll: true });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-open-cart]')) { e.preventDefault(); hideToast(); if (location.pathname.endsWith('checkout.html')) return; openPanel(cartEl); }
  if (e.target.closest('[data-close-cart],[data-close-nav],[data-backdrop]')) closePanels();
});
menuBtn?.addEventListener('click', () => openPanel(navEl));
$$('#nav-drawer a').forEach(a => a.addEventListener('click', () => closePanels(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanels(); closeMega(); } });
window.matchMedia('(min-width:1001px)').addEventListener('change', e => { if (e.matches && navEl?.classList.contains('open')) closePanels(false); });

/* ---------------- mega menu ---------------- */
const navItem = $('.nav-item');
const trigger = $('.nav-trigger');
let megaTimer;
function openMega() { clearTimeout(megaTimer); navItem?.classList.add('open'); trigger?.setAttribute('aria-expanded', 'true'); }
function closeMega() { navItem?.classList.remove('open'); trigger?.setAttribute('aria-expanded', 'false'); }
if (navItem) {
  const fine = window.matchMedia('(hover:hover)');
  navItem.addEventListener('mouseenter', () => fine.matches && openMega());
  navItem.addEventListener('mouseleave', () => { if (fine.matches) megaTimer = setTimeout(closeMega, 160); });
  trigger.addEventListener('click', () => navItem.classList.contains('open') ? closeMega() : openMega());
  navItem.addEventListener('focusout', e => { if (!navItem.contains(e.relatedTarget)) closeMega(); });
  document.addEventListener('click', e => { if (!navItem.contains(e.target)) closeMega(); });
}

/* ---------------- header state ---------------- */
const header = $('.site-header');
let ticking = false;
function onScroll() {
  if (isLocked) { ticking = false; return; }
  header?.classList.toggle('is-scrolled', window.scrollY > 8);
  parallax();
  ticking = false;
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

/* ---------------- photo band parallax ---------------- */
const bands = $$('[data-parallax]');
function parallax() {
  if (reduced.matches) return;
  bands.forEach(b => {
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    const im = b.querySelector('img'); if (im) im.style.transform = `translate3d(0,${(-10 + p * 14).toFixed(2)}%,0)`;
  });
}
onScroll();

/* ---------------- toast ---------------- */
const toastEl = $('.toast');
let toastTimer;
function toast(msg, o = {}) {
  if (!toastEl) return;
  const isCart = !!o.image;
  toastEl.classList.toggle('toast--cart', isCart);
  $('[data-toast-title]', toastEl).textContent = isCart ? 'Added to cart' : '';
  $('[data-toast-text]', toastEl).textContent = msg;
  $('[data-toast-sub]', toastEl).textContent = o.sub || '';
  const im = $('[data-toast-img]', toastEl); if (isCart) im.src = o.image;
  toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, isCart ? 4200 : 3800);
}
toastEl?.addEventListener('mouseenter', () => clearTimeout(toastTimer));
toastEl?.addEventListener('mouseleave', () => { toastTimer = setTimeout(hideToast, 1800); });
function hideToast() { toastEl?.classList.remove('show'); }
document.addEventListener('click', e => { if (e.target.closest('[data-toast-close]')) hideToast(); });

/* ---------------- product cards ---------------- */
function card(p) {
  return `<article class="card">
    <div class="card-media">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <button type="button" data-view="${p.id}" aria-label="View details for ${esc(p.name)}"><img src="${img(p)}" alt="${esc(p.name)}" loading="lazy"></button>
      <button type="button" class="quick-add" data-add="${p.id}" aria-label="Add ${esc(p.name)} to your order">${ICON.plus}<span class="qa-label">Add</span></button>
    </div>
    <div class="card-body">
      <div class="card-title"><h3><button type="button" data-view="${p.id}">${esc(p.name)}</button></h3><span class="price">${money(p.price)}</span></div>
      <p>${esc(p.tagline)}</p>
    </div>
  </article>`;
}
document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) {
    if (byId(add.dataset.add)?.options) { openProduct(add.dataset.add, add); return; }
    addToCart(add.dataset.add, 1);
    if (add.classList.contains('quick-add')) {
      add.classList.add('added'); add.innerHTML = `${ICON.check}<span class="qa-label">Added</span>`;
      setTimeout(() => { add.classList.remove('added'); add.innerHTML = `${ICON.plus}<span class="qa-label">Add</span>`; }, 1600);
    }
    return;
  }
  const view = e.target.closest('[data-view]');
  if (view) openProduct(view.dataset.view, view);
});

/* homepage grid + scroller */
const homeGrid = $('[data-products="home"]');
if (homeGrid) {
  let homeCat = 'all';
  const draw = cat => { homeCat = cat; const best = products.filter(p => p.badge).concat(products.filter(p => !p.badge)).slice(0, 8); homeGrid.innerHTML = (cat === 'all' ? best : products.filter(p => p.category === cat).slice(0, 8)).map(card).join(''); };
  live.push(() => draw(homeCat));
  $$('[data-home-filter]').forEach(b => b.addEventListener('click', () => {
    $$('[data-home-filter]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(b.dataset.homeFilter);
  }));
  draw('all');
}
const scroller = $('[data-products="rolls-scroller"]');
if (scroller) {
  const drawRolls = () => { scroller.innerHTML = products.filter(p => p.category === 'rolls').map(card).join(''); };
  drawRolls(); live.push(drawRolls);
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => scroller.scrollBy({ left: Number(b.dataset.scroll) * scroller.clientWidth * .8, behavior: reduced.matches ? 'auto' : 'smooth' })));
}

/* holiday specials grid */
const holGrid = $('[data-products="holiday"]');
if (holGrid) { const drawHol = () => { holGrid.innerHTML = holidayItems.map(card).join('') || '<p class="empty">Holiday specials are coming soon.</p>'; }; drawHol(); live.push(drawHol); }

/* shop */
const shopGrid = $('[data-products="shop"]');
if (shopGrid) {
  const params = new URLSearchParams(location.search);
  let cat = ['rolls', 'treats', 'bakes'].includes(params.get('category')) ? params.get('category') : 'all';
  let query = params.get('q') || '';
  let sort = 'featured';
  const search = $('#shop-search'); search.value = query;
  const render = () => {
    const q = query.toLowerCase().trim();
    let list = products.filter(p => (cat === 'all' || p.category === cat) && (p.name + ' ' + p.tagline + ' ' + p.description).toLowerCase().includes(q));
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    shopGrid.innerHTML = list.map(card).join('');
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'bake' : 'bakes'}${cat !== 'all' ? ' in ' + CATS[cat].label.toLowerCase() : ''}`;
    $('#shop-empty').hidden = list.length > 0;
    $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.filter === cat));
  };
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
    cat = b.dataset.filter;
    const u = new URL(location.href); cat === 'all' ? u.searchParams.delete('category') : u.searchParams.set('category', cat);
    history.replaceState({}, '', u); render();
  }));
  search.addEventListener('input', () => { query = search.value; render(); });
  $('#shop-sort').addEventListener('change', e => { sort = e.target.value; render(); });
  render(); live.push(render);
}

/* ---------------- product dialog ---------------- */
const dialog = $('#product-dialog');
let dialogTrigger = null;
function openProduct(id, trigger) {
  const p = byId(id); if (!p || !dialog) return;
  dialogTrigger = trigger;
  $('[data-dialog-content]', dialog).innerHTML = `<div class="pd-grid">
    <div class="pd-media"><img src="${img(p)}" alt="${esc(p.name)}"></div>
    <div class="pd-body">
      <span class="kicker">${esc(CATS[p.category]?.label || '')}</span>
      <h2 id="pd-title">${esc(p.name)}</h2>
      <div class="pd-price">${money(p.price)}</div>
      <p>${esc(p.description)}</p>
      ${p.options ? `<div class="option-group" role="radiogroup" aria-label="${esc(p.options.label)}"><span>${esc(p.options.label)}</span><div class="choice-grid">${p.options.choices.map((c, i) => `<label class="choice"><input type="radio" name="pd-opt" value="${esc(c)}"${i === 1 ? ' checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div></div>` : ''}
      <div class="pd-buy">
        <div class="qty"><button type="button" data-pd-step="-1" aria-label="One fewer">${ICON.minus}</button><input value="1" inputmode="numeric" aria-label="Quantity" data-pd-qty><button type="button" data-pd-step="1" aria-label="One more">${ICON.plus}</button></div>
        <button type="button" class="btn" data-pd-add="${p.id}">${ICON.bag}Add to order</button>
      </div>
      <ul class="pd-meta">
        <li>${ICON.clock}<span>${p.category === 'holiday' ? 'Handmade in small batches for the holidays. Ready for pickup or delivery December 20–23.' : `Baked fresh after we confirm your order. Allow at least ${CFG.leadTimeHours} hours.`}</span></li>
        <li>${ICON.pin}<span>Pickup at ${esc(CFG.pickupAddress || 'Ramsey, Minnesota')}.</span></li>
        <li>${ICON.card}<span>Secure online payment at checkout. Allergy questions? <a class="link" href="contact.html">Ask us first</a>.</span></li>
      </ul>
    </div></div>`;
  dialog.showModal();
}
dialog?.addEventListener('click', e => {
  if (e.target === dialog || e.target.closest('[data-close-dialog]')) dialog.close();
  const step = e.target.closest('[data-pd-step]');
  if (step) { const i = $('[data-pd-qty]', dialog); i.value = Math.min(99, Math.max(1, (parseInt(i.value, 10) || 1) + Number(step.dataset.pdStep))); }
  const add = e.target.closest('[data-pd-add]');
  if (add) { addToCart(add.dataset.pdAdd, Math.max(1, parseInt($('[data-pd-qty]', dialog).value, 10) || 1), $('input[name=pd-opt]:checked', dialog)?.value || ''); dialog.close(); }
});
dialog?.addEventListener('close', () => dialogTrigger?.focus?.());

/* ---------------- Netlify form helper ---------------- */
async function submitNetlify(form) {
  if (location.protocol === 'file:') throw new Error('offline-preview');
  const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
  if (!res.ok) throw new Error('status ' + res.status);
}
function openMail(subject, body) {
  const a = document.createElement('a');
  a.href = `mailto:${CFG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.body.appendChild(a); a.click(); a.remove();
}
function showError(form, msg) { const el = $('[data-form-error]', form); if (el) { el.textContent = msg; el.classList.add('show'); el.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' }); } }
function clearError(form) { $('[data-form-error]', form)?.classList.remove('show'); }

/* ---------------- checkout ---------------- */
const checkoutForm = $('#checkout-form');
if (checkoutForm) {
  const date = $('#pickup-date');
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const hasBasket = () => cart.some(l => l.id.startsWith('hbasket-') || byId(l.id)?.category === 'holiday');
  /* prep time grows with order size (rules set in the dashboard) */
  const bakeCount = () => cart.filter(l => !l.id.startsWith('egift-') && !l.id.startsWith('hbasket-') && byId(l.id)?.category !== 'holiday').reduce((n, l) => n + l.qty, 0);
  const prepHours = () => { const n = bakeCount(); let h = Number(CFG.leadTimeHours) || 6; (CFG.prepTiers || []).forEach(t => { if (n > Number(t.items)) h = Math.max(h, Number(t.hours) || 0); }); return h; };
  const fmtLong = d => new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const syncDate = () => {
    const h = prepHours(), earliest = new Date(Date.now() + h * 3600e3);
    const minIso = iso(earliest);
    date.min = minIso;
    if (!date.value || date.value < minIso) date.value = h <= 24 && minIso === iso(new Date()) ? iso(new Date(Date.now() + 864e5)) : minIso;
    const hint = $('[data-prep-hint]');
    date.max = '';
    if (hasBasket()) { date.min = '2026-12-20'; date.max = '2026-12-23'; if (date.value < '2026-12-20' || date.value > '2026-12-23') date.value = '2026-12-20'; if (hint) hint.textContent = 'Holiday orders are ready December 20–23.'; }
    else if (hint) { const big = h > (Number(CFG.leadTimeHours) || 6); hint.textContent = big ? `Your order has ${bakeCount()} bakes, so we need ${h >= 24 && h % 24 === 0 ? (h / 24) + (h === 24 ? ' day’s' : ' days’') : h + ' hours’'} notice. The earliest date is ${fmtLong(minIso)}.` : `Everything is baked fresh, so we need at least ${h} hours’ notice.`; }
    const r = $('[data-co-ready]');
    if (r && date.value) { const w = checkoutForm.pickup_window?.value || ''; const del = checkoutForm.fulfilment.value === 'Delivery'; r.hidden = false; r.innerHTML = `${ICON.clock || ''}<span>Your order will be ${del ? 'delivered' : 'ready for pickup'} <b>${fmtLong(date.value)}${w ? ', ' + esc(w.split(' (')[0].toLowerCase()) + ' ' + esc((w.match(/\((.*)\)/) || [])[1] || '') : ''}</b>.</span>`; }
  };
  /* delivery fee by ZIP code (areas set in the dashboard) */
  const zones = () => (CFG.deliveryZones || []).map(z => ({ ...z, list: String(z.zips || '').split(/[^0-9]+/).filter(Boolean), fee: Number(z.fee) || 0 }));
  const zoneFor = zip => { const z5 = String(zip || '').trim().slice(0, 5); return z5.length === 5 ? zones().find(z => z.list.includes(z5)) || null : undefined; };
  const isDelivery = () => checkoutForm.fulfilment.value === 'Delivery';
  const deliveryFee = () => {
    if (!isDelivery()) return 0;
    const z = zoneFor(checkoutForm.zip.value); if (!z) return null;
    if (CFG.freeDeliveryOver && cartTotal() >= CFG.freeDeliveryOver) return 0;
    return z.fee;
  };
  const grand = () => cartTotal() + (deliveryFee() || 0);
  const items = $('[data-co-items]');
  const drawSummary = () => {
    items.innerHTML = cart.length ? cart.map(l => { const p = byId(l.id); return `<li><span class="co-thumb"><img src="${img(p)}" alt=""><b>${l.qty}</b></span><span class="co-item-t"><strong>${esc(p.name)}</strong>${l.opt ? `<small>${esc(l.opt)}</small>` : ''}</span><span class="co-item-p">${money(p.price * l.qty)}</span></li>`; }).join('') : `<li class="co-empty">Your cart is empty. <a class="link" href="shop.html">Browse the bakes</a></li>`;
    $('[data-place-order]').disabled = !cart.length;
    const fee = deliveryFee(), zs = zones();
    $('[data-co-ship-label]').textContent = isDelivery() ? 'Delivery' : 'Pickup';
    $('[data-co-ship]').textContent = !isDelivery() ? 'Free' : fee === null ? (zs.length ? 'Enter ZIP code' : 'Confirmed by email') : fee === 0 ? 'Free' : money(fee);
    $$('[data-co-grand]').forEach(el => el.textContent = money(grand()));
    const from = $('[data-co-del-from]');
    if (from) { const fees = zs.map(z => z.fee); from.textContent = !fees.length ? 'Confirmed by email' : Math.min(...fees) === Math.max(...fees) ? money(fees[0]) : 'From ' + money(Math.min(...fees)); }
    syncDate();
  };
  live.push(drawSummary);
  const _rc = renderCart; renderCart = function () { _rc(); drawSummary(); };
  drawSummary();
  const zipMsg = $('[data-zip-msg]');
  const checkZip = (final) => {
    if (!isDelivery() || !zones().length) { zipMsg.textContent = ''; checkoutForm.zip.setCustomValidity(''); return; }
    const v = checkoutForm.zip.value, z = zoneFor(v);
    if (z === undefined) { checkoutForm.zip.setCustomValidity(v ? 'zip' : ''); zipMsg.textContent = ''; zipMsg.className = 'field-msg'; }
    else if (z === null) { checkoutForm.zip.setCustomValidity('nozone'); zipMsg.className = 'field-msg bad'; zipMsg.innerHTML = 'Sorry, we don’t deliver to this ZIP code yet. Choose pickup, or <a class="link" href="contact.html">ask us</a>.'; if (final) checkoutForm.zip.closest('.field')?.classList.add('bad'); }
    else { checkoutForm.zip.setCustomValidity(''); zipMsg.className = 'field-msg ok'; const free = CFG.freeDeliveryOver && cartTotal() >= CFG.freeDeliveryOver; zipMsg.textContent = `We deliver here: ${free ? 'free delivery' : money(z.fee) + ' delivery'}.`; checkoutForm.zip.closest('.field')?.classList.remove('bad'); }
  };
  const syncFulfil = () => {
    const delivery = isDelivery();
    if (CFG.deliveryEnabled === false) { const d = checkoutForm.querySelector('input[name=fulfilment][value=Delivery]'); if (d) { d.closest('.co-opt').hidden = true; if (d.checked) checkoutForm.querySelector('input[name=fulfilment][value=Pickup]').checked = true; } }
    $$('[data-delivery-only]', checkoutForm).forEach(el => { el.hidden = !delivery; ['address', 'city', 'zip'].forEach(n => { checkoutForm[n].required = delivery; }); });
    $('[data-date-label]', checkoutForm).textContent = delivery ? 'Delivery date' : 'Pickup date';
    checkZip(); drawSummary();
  };
  checkoutForm.addEventListener('change', e => { if (e.target.name === 'fulfilment') syncFulfil(); if (e.target.name === 'pickup_date' || e.target.name === 'pickup_window') syncDate(); });
  checkoutForm.zip.addEventListener('input', () => { checkZip(); drawSummary(); });
  checkoutForm.zip.addEventListener('blur', () => checkZip(true));
  live.push(syncFulfil);
  syncFulfil();
  checkoutForm.addEventListener('click', e => {
    if (e.target.closest('[data-co-apt]')) { e.target.closest('[data-co-apt]').hidden = true; const f = $('[data-co-apt-field]', checkoutForm); f.hidden = false; f.querySelector('input').focus(); }
    if (e.target.closest('[data-co-note]')) { e.target.closest('[data-co-note]').hidden = true; const f = $('[data-co-note-field]', checkoutForm); f.hidden = false; f.querySelector('textarea').focus(); }
  });
  const tog = $('[data-co-toggle]'), sum = $('#co-summary');
  tog?.addEventListener('click', () => { const open = sum.classList.toggle('open'); tog.setAttribute('aria-expanded', open); $('[data-co-toggle-label]').textContent = open ? 'Hide order summary' : 'Show order summary'; });
  // validate each field when the customer leaves it
  checkoutForm.addEventListener('focusout', e => { const f = e.target; if (f.matches('input,select,textarea') && f.value) f.closest('.field')?.classList.toggle('bad', !f.checkValidity()); });
  checkoutForm.addEventListener('input', e => { const fld = e.target.closest('.field'); if (fld?.classList.contains('bad') && e.target.checkValidity()) fld.classList.remove('bad'); });
  const msgFor = f => ({ email: 'Enter a valid email, like name@example.com.', name: 'Enter your full name.', phone: 'Enter a phone number.', address: 'Enter your street address.', city: 'Enter your city.', zip: f.validationMessage === 'nozone' ? 'Sorry, we don’t deliver to that ZIP code yet. Choose pickup or contact us.' : 'Enter a 5-digit ZIP code.', pickup_date: f.value && f.max && f.value > f.max ? 'Holiday orders are ready December 20–23. Choose one of those dates.' : f.value && f.value < f.min ? `For this order, the earliest date is ${fmtLong(f.min)}.` : 'Choose a date.' })[f.name] || 'Please complete this field.';
  checkoutForm.addEventListener('submit', async e => {
    e.preventDefault(); clearError(checkoutForm);
    if (!cart.length) return showError(checkoutForm, 'Your cart is empty. Add a bake from the shop first.');
    if (CFG.acceptingOrders === false) return showError(checkoutForm, 'We’re not taking new orders right now. Please check back soon or email us.');
    const bad = [...checkoutForm.querySelectorAll('input,select,textarea')].filter(f => !f.closest('[hidden]') && !f.checkValidity());
    $$('.field.bad', checkoutForm).forEach(f => f.classList.remove('bad'));
    if (bad.length) { bad.forEach(f => f.closest('.field')?.classList.add('bad')); showError(checkoutForm, msgFor(bad[0])); bad[0].focus(); return; }
    const ref = 'AEM-' + Date.now().toString(36).slice(-5).toUpperCase();
    const lines = cart.map(l => { const p = byId(l.id); return `${l.qty} × ${p.name}${l.opt ? ' (' + l.opt + ')' : ''} — ${money(p.price * l.qty)}`; });
    const fee = deliveryFee() || 0, total = grand();
    if (isDelivery()) lines.push(`Delivery — ${fee ? money(fee) : 'free'}`);
    checkoutForm.order_ref.value = ref; checkoutForm.order_items.value = lines.join('\n'); checkoutForm.order_total.value = money(total);
    const btn = $('[data-place-order]'); btn.disabled = true; btn.querySelector('span').textContent = 'Placing order…';
    const fd = new FormData(checkoutForm);
    const address = [fd.get('address'), fd.get('address2'), fd.get('city'), fd.get('zip')].filter(Boolean).join(', ');
    const record = { ref, items: cart.map(l => ({ ...l })), total, delivery_fee: fee, name: fd.get('name'), email: fd.get('email'), date: fd.get('pickup_date'), window: fd.get('pickup_window'), fulfilment: fd.get('fulfilment'), via: 'site' };
    let saved = false;
    if (window.AEMDB && AEMDB.mode !== 'static') {
      try {
        await AEMDB.placeOrder({ ref, name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), fulfilment: fd.get('fulfilment'), address: address || null, pickup_date: fd.get('pickup_date') || null, pickup_window: fd.get('pickup_window'), notes: fd.get('notes') || null, items: cart.map(l => { const p = byId(l.id); return { id: l.id, name: p.name, qty: l.qty, price: p.price, opt: l.opt || '' }; }), delivery_fee: fee, total });
        saved = true;
        if (AEMDB.mode === 'supabase') fetch('/.netlify/functions/order-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }) }).catch(() => {});
      } catch (err) { console.warn('Dashboard save failed', err); }
    }
    try { await submitNetlify(checkoutForm); saved = true; }
    catch (err) {
      if (!saved) {
        record.via = 'email';
        openMail(`New order ${ref}`, `Hi AEM Bakery,\n\nI'd like to place an order.\n\n${lines.join('\n')}\nTotal: ${money(total)}\n\n${fd.get('fulfilment')}: ${fd.get('pickup_date')}, ${fd.get('pickup_window')}${address ? '\nDelivery address: ' + address : ''}\nName: ${fd.get('name')}\nPhone: ${fd.get('phone')}\nEmail: ${fd.get('email')}\nNotes: ${fd.get('notes') || '-'}\n\nOrder ref: ${ref}`);
      }
    }
    // Payment: when a payment link is configured, send the customer to it.
    if (CFG.paymentUrl) { store.session('aem-last-order', record); cart = []; saveCart(); location.href = CFG.paymentUrl.replace('{ref}', encodeURIComponent(ref)).replace('{total}', total.toFixed(2)); return; }
    store.session('aem-last-order', record);
    cart = []; saveCart();
    setTimeout(() => { location.href = 'order-confirmed.html'; }, record.via === 'email' ? 900 : 0);
  });
}

/* ---------------- confirmation ---------------- */
if (document.body.dataset.page === 'confirmed') {
  const o = store.session('aem-last-order');
  if (o) {
    $('[data-confirm-title]').textContent = `Thank you, ${String(o.name || '').split(' ')[0] || 'friend'}!`;
    if (o.via === 'email') $('[data-confirm-lede]').textContent = 'Your email app has opened with your order filled in. Press send and we’ll reply to confirm your pickup time.';
    else $('[data-confirm-lede]').textContent = `We’ve got your ${o.fulfilment === 'Delivery' ? 'delivery request' : 'pickup order'} for ${new Date(o.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${String(o.window).toLowerCase()}. We’ll email ${o.email} to confirm before we start baking.`;
    const ref = $('[data-confirm-ref]'); ref.hidden = false; ref.textContent = 'Order ' + o.ref;
    $('[data-confirm-summary]').hidden = false;
    $('[data-confirm-items]').innerHTML = o.items.filter(l => byId(l.id)).map(l => lineHTML(l, false)).join('');
    $('[data-confirm-total]').textContent = money(o.total);
  }
}

/* ---------------- contact + newsletter ---------------- */
const contactForm = $('#contact-form');
contactForm?.addEventListener('submit', async e => {
  e.preventDefault(); clearError(contactForm);
  if (!contactForm.checkValidity()) { showError(contactForm, 'Please add your name, a valid email and a message.'); contactForm.querySelector(':invalid')?.focus(); return; }
  const btn = contactForm.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
  const fd = new FormData(contactForm);
  try { await submitNetlify(contactForm); toast('Message sent. We’ll reply by email.'); }
  catch { openMail('AEM Bakery — ' + fd.get('topic'), `${fd.get('message')}\n\nName: ${fd.get('name')}\nEmail: ${fd.get('email')}`); toast('Your email app opened with your message. Press send to finish.'); }
  contactForm.reset(); btn.disabled = false; btn.textContent = 'Send message';
});
$$('[data-newsletter]').forEach(f => f.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('[data-newsletter-msg]');
  if (!f.checkValidity()) { msg.textContent = 'Please enter a valid email address.'; return; }
  try { await submitNetlify(f); msg.textContent = 'You’re on the list. Thank you!'; f.reset(); }
  catch { msg.textContent = 'Sign-up works once the site is live on Netlify.'; }
}));
$$('form[data-simple-form]').forEach(f => f.addEventListener('submit', async e => {
  e.preventDefault(); clearError(f);
  if (!f.checkValidity()) { showError(f, 'Please fill in the highlighted fields.'); f.querySelector(':invalid')?.focus(); return; }
  const btn = f.querySelector('[type=submit]'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
  const fd = new FormData(f);
  try { await submitNetlify(f); }
  catch { openMail(f.dataset.subject || 'AEM Bakery request', [...fd.entries()].filter(([k]) => !['form-name', 'bot-field'].includes(k)).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('\n')); }
  const ok = $('[data-form-success]', f); if (ok) { ok.classList.add('show'); ok.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' }); }
  f.reset(); btn.disabled = false; btn.textContent = label;
}));
$$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

renderCart();

/* ---------------- live menu updates from the owner dashboard ---------------- */
const applyAnnouncement = () => { const u = $('.utility-mid'); if (u && CFG.announcement) u.textContent = CFG.announcement; };
applyAnnouncement();
const closedNote = () => { const f = $('#checkout-form'); if (!f) return; let n = $('[data-closed-note]', f); if (CFG.acceptingOrders === false) { if (!n) { n = document.createElement('div'); n.className = 'form-error show'; n.dataset.closedNote = ''; n.textContent = 'We’re not taking new orders right now. Please check back soon.'; f.prepend(n); } } else n?.remove(); };
closedNote();
if (window.AEMDB && AEMDB.mode !== 'static') AEMDB.onMenu(async () => { try { await AEMDB.reload(); } catch {} applyAnnouncement(); closedNote(); live.forEach(f => f()); renderCart(); });

/* ---------------- holiday basket builder (several baskets at once) ---------------- */
const bb = document.getElementById('basket-builder');
if (bb) {
  const basePrice = () => Number(CFG.basketPrice ?? 5);
  const capacity = () => Number(CFG.basketCapacity) || 0;
  const KEY = 'aem-baskets-v2';
  const items = () => [...holidayItems, ...products.filter(p => p.inBasket)];
  const hById = id => items().find(p => p.id === id);
  let baskets = store.get(KEY, null) || [{ label: '', items: {} }];
  let cur = 0, filter = 'all';
  const save = () => store.set(KEY, baskets);
  const count = b => Object.values(b.items).reduce((n, q) => n + q, 0);
  const totalOf = b => basePrice() + Object.entries(b.items).reduce((t, [id, q]) => t + (hById(id)?.price || 0) * q, 0);
  const title = b => b.label.trim() ? `For ${b.label.trim()}` : 'Your basket';
  const BASKET_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h16l-1.6 9H5.6L4 10Z"/><path d="m8 10 3-6M16 10l-3-6"/></svg>';
  const $b = s => bb.querySelector(s);
  const err = $b('[data-bb-error]');
  function draw() {
    const b = baskets[cur];
    const tabs = $b('[data-bb-tabs]');
    tabs.classList.toggle('solo', baskets.length === 1);
    tabs.innerHTML = (baskets.length > 1 ? baskets.map((x, i) => `<button type="button" role="tab" class="bb-tab${i === cur ? ' on' : ''}" aria-selected="${i === cur}" data-bb-go="${i}"><span class="bb-ic">${BASKET_IC}</span><span class="bb-tab-t">${esc(title(x))}<small>${count(x)} ${count(x) === 1 ? 'item' : 'items'}</small></span></button>`).join('') : '') + `<button type="button" class="bb-tab bb-tab--add" data-bb-new><span class="bb-plus">+</span>Add another basket</button>`;
    const on = tabs.querySelector('.bb-tab.on'); if (on) tabs.scrollTo({ left: on.offsetLeft - 16, behavior: reduced.matches ? 'auto' : 'smooth' });
    $b('[data-bb-label]').value = b.label;
    $b('[data-bb-list]').innerHTML = [...holidayItems.map(p => [p, holidayItems[0] === p ? 'Holiday specials' : '']), ...products.filter(p => p.inBasket).map((p, i) => [p, i === 0 ? 'Favorites from the bakery' : ''])].map(([p, head]) => { const q = b.items[p.id] || 0; return `${head ? `<li class="bb-group">${head}</li>` : ''}<li class="bb-item${q ? ' on' : ''}"><img src="${img(p)}" alt="" loading="lazy"><div><strong>${esc(p.name)}</strong>${p.tagline ? `<small>${esc(p.tagline)}</small>` : ''}<span>${money(p.price)}</span></div><div class="qty qty--sm"><button type="button" data-bb-q="${p.id}" data-d="-1" aria-label="One fewer ${esc(p.name)}"${q ? '' : ' disabled'}>${ICON.minus}</button><output>${q}</output><button type="button" data-bb-q="${p.id}" data-d="1" aria-label="One more ${esc(p.name)}">${ICON.plus}</button></div></li>`; }).join('') || '<li class="bb-none">Holiday basket items are coming soon. Check back shortly, or <a class="link" href="contact.html">ask us</a>.</li>';
    $b('[data-bb-all]').innerHTML = baskets.map((x, i) => { const ent = Object.entries(x.items).filter(([id]) => hById(id)); return `<li class="${i === cur ? 'on' : ''}"><div class="bb-all-head"><button type="button" data-bb-go="${i}">${esc(title(x))}</button><span>${money(totalOf(x))}</span></div><p>${ent.length ? ent.map(([id, q]) => `${q} × ${esc(hById(id).name)}`).join(', ') : '<em>Empty. Tap + on any item.</em>'}</p>${baskets.length > 1 ? `<button type="button" class="bb-remove" data-bb-del="${i}">Remove</button>` : ''}</li>`; }).join('');
    const cap = capacity(), c = count(b);
    $b('[data-bb-cap]').hidden = !cap;
    if (cap) {
      $b('[data-bb-cap-text]').textContent = `${c} of ${cap} items`;
      $b('[data-bb-cap-left]').textContent = c >= cap ? 'Full' : `${cap - c} left`;
      $b('[data-bb-cap-bar]').style.width = Math.min(100, c / cap * 100) + '%';
      $b('[data-bb-cap]').classList.toggle('full', c >= cap);
      $b('[data-bb-full]').hidden = c < cap;
      $$('[data-bb-q][data-d="1"]', bb).forEach(x => { x.disabled = c >= cap; });
    } else $b('[data-bb-full]').hidden = true;
    $b('[data-bb-base]').textContent = money(basePrice());
    $b('[data-bb-grand]').textContent = money(baskets.filter(x => count(x)).reduce((t, x) => t + totalOf(x), 0));
    const n = baskets.filter(x => count(x)).length;
    $b('[data-bb-add]').textContent = n > 1 ? `Add ${n} baskets to cart` : 'Add basket to cart';
    save();
  }
  bb.addEventListener('click', e => {
    const b = baskets[cur];
    const q = e.target.closest('[data-bb-q]');
    if (q) {
      const d = Number(q.dataset.d), cap = capacity();
      if (d > 0 && cap && count(b) >= cap) { err.textContent = 'This basket is full. Start another basket to add more.'; err.classList.add('show'); return; }
      const id = q.dataset.bbQ, v = Math.max(0, Math.min(99, (b.items[id] || 0) + d)); if (v) b.items[id] = v; else delete b.items[id]; err.classList.remove('show'); draw();
      return;
    }
    const go = e.target.closest('[data-bb-go]'); if (go) { cur = Number(go.dataset.bbGo); draw(); return; }
    if (e.target.closest('[data-bb-new]')) { baskets.push({ label: '', items: {} }); cur = baskets.length - 1; draw(); setTimeout(() => $b('[data-bb-label]').focus({ preventScroll: true }), 50); bb.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' }); return; }
    const del = e.target.closest('[data-bb-del]'); if (del) { baskets.splice(Number(del.dataset.bbDel), 1); cur = Math.min(cur, baskets.length - 1); draw(); return; }
    if (e.target.closest('[data-bb-add]')) {
      const ready = baskets.filter(x => count(x));
      if (!ready.length) { err.textContent = 'Add at least one bake to your basket first.'; err.classList.add('show'); return; }
      ready.forEach(x => { const i = baskets.indexOf(x); const desc = Object.entries(x.items).map(([id, q]) => `${q} × ${hById(id).name}`).join(', '); addToCart('hbasket-' + Math.round(totalOf(x) * 100), 1, `Basket ${i + 1}${x.label.trim() ? ' for ' + x.label.trim() : ''}: ${desc}`, { silent: true }); });
      toast(ready.length > 1 ? `${ready.length} holiday baskets added` : 'Holiday basket added', { image: 'assets/studio-cookies.webp', sub: money(ready.reduce((t, x) => t + totalOf(x), 0)) });
      baskets = [{ label: '', items: {} }]; cur = 0; draw();
      $b('[data-bb-checkout]').hidden = false;
    }
  });
  $b('[data-bb-label]').addEventListener('input', e => { baskets[cur].label = e.target.value; const t = bb.querySelector('.bb-all li.on .bb-all-head button'); if (t) t.textContent = title(baskets[cur]); const tt = bb.querySelector('.bb-tab.on .bb-tab-t'); if (tt) tt.firstChild.textContent = title(baskets[cur]); save(); });
  draw(); live.push(() => { baskets.forEach(x => Object.keys(x.items).forEach(id => { if (!hById(id)) delete x.items[id]; })); draw(); });
}

/* ---------------- eGift Cards page ---------------- */
const gf = document.getElementById('gift-form');
if (gf) {
  const other = $('[data-other-amount]', gf), custom = gf.custom, preview = $('[data-gc-preview]');
  const q = new URLSearchParams(location.search).get('amount');
  if (q) { const r = gf.querySelector(`input[name=amount][value="${q === 'other' ? 'other' : Number(q)}"]`); if (r) r.checked = true; }
  const amount = () => { const v = gf.querySelector('input[name=amount]:checked')?.value; return v === 'other' ? Math.round(Number(custom.value) || 0) : Number(v); };
  const sync = () => { const isOther = gf.querySelector('input[name=amount]:checked')?.value === 'other'; other.hidden = !isOther; custom.required = isOther; const a = amount(); preview.textContent = a ? '$' + a : 'eGift Card'; };
  gf.addEventListener('change', sync); custom.addEventListener('input', sync); sync();
  gf.addEventListener('click', e => { const st = e.target.closest('[data-gc-step]'); if (st) { gf.qty.value = Math.min(20, Math.max(1, (parseInt(gf.qty.value, 10) || 1) + Number(st.dataset.gcStep))); } });
  let action = 'add';
  $$('[data-gc-action]', gf).forEach(b => b.addEventListener('click', () => { action = b.dataset.gcAction; }));
  gf.addEventListener('submit', e => {
    e.preventDefault(); clearError(gf);
    const a = amount();
    if (!(a >= 5 && a <= 1000)) return showError(gf, 'Choose an amount, or enter a custom amount between $5 and $1,000.');
    if (!gf.checkValidity()) { showError(gf, 'Please add the recipient’s name and email, and your name.'); gf.querySelector(':invalid')?.focus(); return; }
    const opt = `To ${gf.to_name.value.trim()} (${gf.to_email.value.trim()}) from ${gf.from_name.value.trim()}${gf.note.value.trim() ? ' — “' + gf.note.value.trim() + '”' : ''}`;
    addToCart('egift-' + a, Math.max(1, parseInt(gf.qty.value, 10) || 1), opt);
    if (action === 'buy') location.href = 'checkout.html';
    else { gf.reset(); gf.querySelector('input[value="50"]').checked = true; sync(); }
  });
}

/* ---------------- scroll reveal (one motion language, respects reduced motion) ---------------- */
if (!reduced.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-motion');
  const sel = '.section-head, .card, .cat-tile, .tip, .step, .value, .story-media, .story-copy, .fulfil-media, .fulfil-item, .faq-list details, .gift, .mosaic figure, .timeline li, .contact-card, .form-card, .panel, .dates .date-card, .photo-band blockquote, .cta-band .wrap > *';
  const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -40px 0px', threshold: 0 });
  const prime = (root = document) => {
    $$(sel, root).forEach(el => {
      if (el.classList.contains('reveal') || el.closest('.hero, .cart, .pd, .nav-drawer, .mega, .scroller')) return;
      const sib = el.parentElement ? Array.from(el.parentElement.children).filter(c => c.matches(sel)) : [];
      el.style.setProperty('--d', Math.min(sib.indexOf(el), 5) * 80 + 'ms');
      el.classList.add('reveal'); io.observe(el);
    });
  };
  prime();
  /* safety net: never leave on-screen content hidden */
  let sweep; addEventListener('scroll', () => { clearTimeout(sweep); sweep = setTimeout(() => $$('.reveal:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); }), 150); }, { passive: true });
  $$('[data-products]').forEach(g => new MutationObserver(() => prime(g)).observe(g, { childList: true }));
}

/* ---------------- homepage hero (original behaviour, unchanged) ---------------- */
const hero=$('.hero');
if(hero){const slides=[
 {word:'happiness.',description:'Soft cinnamon swirls. Generous vanilla frosting.',name:'Vanilla bean cinnamon rolls',category:'THE COMFORT CLASSIC',price:'$12',slug:'vanilla-bean-cinnamon-rolls',background:'#D5E5EF',accent:'#a17b4f'},
 {word:'sweetness.',description:'Golden edges. Chocolate chips. A little toffee crunch.',name:'Chocolate chip toffee cookies',category:'A LITTLE COOKIE HAPPINESS',price:'$3',slug:'chocolate-chip-toffee-cookies',background:'#FFF9EF',accent:'#a16e42'},
 {word:'comfort.',description:'Golden crust. Soft centers. Simply homemade.',name:'Mini French baguettes',category:'GOOD BREAD. GOOD COMPANY.',price:'$8',slug:'mini-french-baguettes',background:'#E7F0F6',accent:'#5b8ea8'},
 {word:'joy.',description:'Brown butter banana cake. Caramel cream cheese frosting.',name:'Brown butter banana cake',category:'MAKE A LITTLE MOMENT OF IT',price:'$15',slug:'brown-butter-banana-cake-with-caramel-cream-cheese-frosting',background:'#F8F2E7',accent:'#a27268'}
];let active=0,timer=null,paused=reduced.matches;const mobile=window.matchMedia('(max-width:700px)');function setSlide(index){active=(index+slides.length)%slides.length;const s=slides[active];$('#hero-description').textContent=s.description;$('#hero-name').textContent=s.name;$('#hero-price').textContent=s.price;$('#hero-order').href='shop.html#item-'+s.slug;hero.style.setProperty('--hero-bg',s.background);hero.dataset.activeSlide=String(active);$('.orbit-pointer').style.transform=`rotate(${(mobile.matches?[-40,-18,18,40]:[-56,-18,18,56])[active]}deg)`;$$('.hero-product').forEach((img,i)=>{img.classList.toggle('active',i===active);img.setAttribute('aria-hidden',i!==active)});$$('[data-slide]').forEach((button,i)=>{button.classList.toggle('selected',i===active);button.setAttribute('aria-pressed',i===active)});$('#slide-count').innerHTML=`0${active+1} <i>/ 04</i>`;}function restart(){clearInterval(timer);if(!paused&&!document.hidden&&!hero.contains(document.activeElement))timer=setInterval(()=>setSlide(active+1),7500)}function change(delta){setSlide(active+delta);restart()}function updatePause(){const b=$('#pause');b.innerHTML=paused?'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z"/></svg>':'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';b.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow');b.setAttribute('aria-pressed',paused)}$$('[data-slide]').forEach(button=>{button.addEventListener('click',()=>{setSlide(Number(button.dataset.slide));restart()});button.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();change(event.key==='ArrowRight'?1:-1);$$('[data-slide]')[active].focus()}})});$('#prev').addEventListener('click',()=>change(-1));$('#next').addEventListener('click',()=>change(1));$('#pause').addEventListener('click',()=>{paused=!paused;updatePause();restart()});hero.addEventListener('focusin',()=>clearInterval(timer));hero.addEventListener('focusout',event=>{if(!hero.contains(event.relatedTarget))restart()});document.addEventListener('visibilitychange',restart);mobile.addEventListener('change',()=>setSlide(active));reduced.addEventListener('change',()=>{paused=reduced.matches;updatePause();restart()});setSlide(0);updatePause();restart();}


/* hero "Order now": buy on this site instead of leaving for the old store */
document.getElementById('hero-order')?.addEventListener('click', e => {
  const id = (e.currentTarget.getAttribute('href') || '').split('item-').pop();
  if (byId(id)) { e.preventDefault(); openProduct(id, e.currentTarget); }
});

/* hero arrows sit level with the photo in the stacked phone layout */
const placeHeroArrows = () => {
  const h = document.querySelector('.hero-3d'), st = h?.querySelector('.hero-stage'); if (!h || !st) return;
  const y = matchMedia('(max-width:700px)').matches ? (st.getBoundingClientRect().top - h.getBoundingClientRect().top + st.offsetHeight / 2 - 21) + 'px' : '';
  ['prev', 'next'].forEach(id => { const b = document.getElementById(id); if (b) b.style.setProperty('top', y, y ? 'important' : ''); });
};
addEventListener('resize', placeHeroArrows); addEventListener('load', placeHeroArrows); setTimeout(placeHeroArrows, 100);
document.fonts?.ready.then(placeHeroArrows);

/* hero: replay the name/price animation on every slide change */
const heroAnim = document.querySelector('.hero-3d');
if (heroAnim) {
  const mp = heroAnim.querySelector('.minimal-product');
  new MutationObserver(() => { mp.classList.remove('swap'); void mp.offsetWidth; mp.classList.add('swap'); }).observe(heroAnim, { attributes: true, attributeFilter: ['data-active-slide'] });
}

/* hero: swipe left/right on phones */
const heroSwipe = document.querySelector('.hero-minimal');
if (heroSwipe) {
  let sx = 0, sy = 0;
  heroSwipe.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  heroSwipe.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && !e.target.closest('a,button')) document.getElementById(dx < 0 ? 'next' : 'prev')?.click();
  }, { passive: true });
}

/* ---------------- homepage hero: 3D depth ---------------- */
const hero3d = $('.hero-3d');
if (hero3d) {
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)');
  const loop = () => {
    cx += (tx - cx) * .08; cy += (ty - cy) * .08;
    hero3d.style.setProperty('--mx', cx.toFixed(4)); hero3d.style.setProperty('--my', cy.toFixed(4));
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .001 ? requestAnimationFrame(loop) : null;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  hero3d.addEventListener('pointermove', e => {
    if (reduced.matches || !fine.matches) return;
    const r = hero3d.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2; kick();
  });
  hero3d.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  // scroll: the stage tips back as you scroll away
  const onHeroScroll = () => { if (reduced.matches || !fine.matches) return; const p = Math.min(1, Math.max(0, scrollY / hero3d.offsetHeight)); hero3d.style.setProperty('--sy', p.toFixed(3)); };
  window.addEventListener('scroll', () => requestAnimationFrame(onHeroScroll), { passive: true });
  // slide turn: mark the outgoing bake so it swings away in 3D
  let prev = hero3d.dataset.activeSlide;
  new MutationObserver(() => {
    const now = hero3d.dataset.activeSlide; if (now === prev) return;
    const items = $$('.hero-product', hero3d);
    items.forEach(el => el.classList.remove('leaving', 'from-left'));
    const forward = (Number(now) - Number(prev) + 4) % 4 === 1 || (Number(now) > Number(prev) && !((Number(prev) - Number(now) + 4) % 4 === 1));
    const out = items[Number(prev)]; if (out) { out.classList.add('leaving'); if (!forward) out.classList.add('from-left'); }
    hero3d.classList.toggle('backward', !forward);
    prev = now;
  }).observe(hero3d, { attributes: true, attributeFilter: ['data-active-slide'] });
}
};
(window.AEMDB ? window.AEMDB.ready : Promise.resolve()).then(AEM_START);
