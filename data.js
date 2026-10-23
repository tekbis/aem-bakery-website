/* AEM Bakery — data layer shared by the website and the owner dashboard.
   Modes:
     supabase — live data from Supabase (set url + anonKey in config.js)
     demo     — data kept in this browser only (config.js demo:true), for previews
     static   — products.js only (no dashboard)                                    */
(() => {
'use strict';
const C = window.AEM_SUPABASE || {};
const FROSTING = { label: 'Frosting style', choices: ['Frost right out of the oven (warm and melty)', 'Frost after cooling (thick and swirled)', 'No frosting'] };
const DEFAULT_SETTINGS = {
  lead_time_hours: 6,
  accepting_orders: true,
  announcement: 'Baked fresh to order. Pickup or delivery.',
  basket_price: 5,
  basket_capacity: 12,
  payment_url: '',
  prep_tiers: [{ items: 12, hours: 24 }, { items: 36, hours: 48 }],
  delivery_enabled: true,
  delivery_zones: [
    { name: 'Ramsey and Anoka', zips: '55303', fee: 5 },
    { name: 'Nearby towns', zips: '55304, 55316, 55327, 55330, 55433, 55448', fee: 10 }
  ],
  free_delivery_over: 0,
  content: {}
};
const mode = C.url && C.anonKey && window.supabase ? 'supabase' : (C.demo ? 'demo' : 'static');
const listeners = { menu: [], orders: [] };
const emit = (k, ...a) => listeners[k].forEach(f => { try { f(...a); } catch (e) { console.error(e); } });

/* row <-> product */
const toRow = (p, i = 0) => ({ id: p.id, name: p.name, price: Number(p.price), category: p.category, image: p.image, tagline: p.tagline || '', description: p.description || '', badge: p.badge || null, has_frosting_options: !!(p.options || p.has_frosting_options), in_basket: !!(p.inBasket || p.in_basket), active: p.active !== false, sort: p.sort ?? (i + 1) * 10 });
const toProduct = r => ({ id: r.id, name: r.name, price: Number(r.price), category: r.category, image: r.image, tagline: r.tagline, description: r.description, badge: r.badge || undefined, options: r.has_frosting_options ? FROSTING : undefined, inBasket: !!r.in_basket, active: r.active, sort: r.sort });
const STATIC_ROWS = [...(window.AEM_PRODUCTS || []), ...(window.AEM_HOLIDAY_ITEMS || [])].map(toRow);

/* ---------------- backends ---------------- */
let sb = null;
if (mode === 'supabase') sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true } });

/* sample orders so the dashboard preview isn't empty (preview mode only) */
function sampleOrders() {
  const P = id => STATIC_ROWS.find(p => p.id === id) || STATIC_ROWS[0];
  const day = n => { const d = new Date(Date.now() + n * 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const ago = m => new Date(Date.now() - m * 6e4).toISOString();
  const line = (id, qty, opt = '') => { const p = P(id); return { id: p.id, name: p.name, qty, price: Number(p.price), opt }; };
  const mk = (o, items, fee = 0) => ({ id: 'sample-' + o.ref, delivery_fee: fee, total: items.reduce((n, i) => n + i.qty * i.price, 0) + fee, items, ...o });
  return [
    mk({ ref: 'AEM-7K2QD', name: 'Emily Carter', email: 'emily@example.com', phone: '(612) 555-0142', fulfilment: 'Pickup', pickup_date: day(1), pickup_window: 'Afternoon (12pm–4pm)', notes: 'Birthday treat, please write “Happy 30th Sam” on the box if you can.', status: 'new', created_at: ago(12) }, [line('vanilla-bean-cinnamon-rolls', 1, 'Frost after cooling (thick and swirled)'), line('chocolate-chip-toffee-cookies', 2)]),
    mk({ ref: 'AEM-7K1ZP', name: 'Marcus Lee', email: 'marcus@example.com', phone: '(763) 555-0199', fulfilment: 'Delivery', address: '6120 Alpine Dr NW, Ramsey, 55303', pickup_date: day(0), pickup_window: 'Evening (4pm–7pm)', status: 'baking', created_at: ago(300) }, [line('strawberry-cinnamon-rolls', 2, 'Frost right out of the oven (warm and melty)'), line('mini-french-baguettes', 1)], 5),
    mk({ ref: 'AEM-7JX4M', name: 'Priya Shah', email: 'priya@example.com', phone: '(651) 555-0110', fulfilment: 'Pickup', pickup_date: day(3), pickup_window: 'Morning (9am–12pm)', status: 'confirmed', created_at: ago(1500) }, [line('brown-butter-banana-cake-with-caramel-cream-cheese-frosting', 1), line('rice-crispy-bars', 1)]),
    mk({ ref: 'AEM-7JQ8B', name: 'Hannah Olson', email: 'hannah@example.com', phone: '(763) 555-0175', fulfilment: 'Pickup', pickup_date: day(-1), pickup_window: 'Afternoon (12pm–4pm)', status: 'completed', created_at: ago(3200) }, [line('biscoff-cinnamon-rolls', 1, 'No frosting'), line('maple-cinnamon-scones-with-maple-frosting', 1)])
  ];
}
const demo = {
  KEY: 'aem-demo-db',
  load() { try { const d = JSON.parse(localStorage.getItem(this.KEY)); if (d && d.products) { if (!d.basketSeeded) { d.basketSeeded = true; d.products.forEach(p => { const r = STATIC_ROWS.find(x => x.id === p.id); if (r && r.in_basket && p.in_basket === undefined) p.in_basket = true; }); this.save(d); }
      if (!d.holidaySeeded) { d.holidaySeeded = true; STATIC_ROWS.filter(r => r.category === 'holiday' && !d.products.some(p => p.id === r.id)).forEach(r => d.products.push(r)); this.save(d); } return d; } } catch {} return { products: STATIC_ROWS, holidaySeeded: true, basketSeeded: true, settings: { ...DEFAULT_SETTINGS }, orders: sampleOrders() }; },
  save(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch {} }
};

const api = {
  mode,
  async products({ all = false } = {}) {
    let rows;
    if (mode === 'supabase') { const { data, error } = await sb.from('products').select('*').order('sort'); if (error) throw error; rows = data; }
    else if (mode === 'demo') rows = demo.load().products;
    else rows = STATIC_ROWS;
    rows = [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    return all ? rows : rows.filter(r => r.active !== false);
  },
  async settings() {
    if (mode === 'supabase') { const { data, error } = await sb.from('settings').select('*'); if (error) throw error; const s = { ...DEFAULT_SETTINGS }; data.forEach(r => { s[r.key] = r.value; }); return s; }
    if (mode === 'demo') return { ...DEFAULT_SETTINGS, ...demo.load().settings };
    return { ...DEFAULT_SETTINGS };
  },
  async placeOrder(o) {
    if (mode === 'supabase') { const { error } = await sb.from('orders').insert({ ...o, status: 'new' }); if (error) throw error; return; }
    if (mode === 'demo') { const d = demo.load(); d.orders.unshift({ id: crypto.randomUUID?.() || String(Date.now()), created_at: new Date().toISOString(), status: 'new', ...o }); demo.save(d); emit('orders'); }
  },
  /* owner-only */
  async signIn(email, password) { if (mode !== 'supabase') return { ok: true }; const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return { ok: true }; },
  async signOut() { if (mode === 'supabase') await sb.auth.signOut(); },
  async session() { if (mode !== 'supabase') return { demo: true }; const { data } = await sb.auth.getSession(); return data.session; },
  async orders() {
    if (mode === 'supabase') { const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(500); if (error) throw error; return data; }
    return demo.load().orders;
  },
  async updateOrder(id, patch) {
    if (mode === 'supabase') { const { error } = await sb.from('orders').update(patch).eq('id', id); if (error) throw error; return; }
    const d = demo.load(); const o = d.orders.find(x => x.id === id); Object.assign(o, patch); demo.save(d); emit('orders');
  },
  async saveProduct(row) {
    row = { ...row, price: Number(row.price), updated_at: new Date().toISOString() };
    if (mode === 'supabase') { const { error } = await sb.from('products').upsert(row); if (error) throw error; return; }
    const d = demo.load(); const i = d.products.findIndex(p => p.id === row.id); if (i >= 0) d.products[i] = { ...d.products[i], ...row }; else d.products.push(row); demo.save(d); emit('menu');
  },
  async deleteProduct(id) {
    if (mode === 'supabase') { const { error } = await sb.from('products').delete().eq('id', id); if (error) throw error; return; }
    const d = demo.load(); d.products = d.products.filter(p => p.id !== id); demo.save(d); emit('menu');
  },
  async saveSetting(key, value) {
    if (mode === 'supabase') { const { error } = await sb.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }); if (error) throw error; return; }
    const d = demo.load(); d.settings = { ...d.settings, [key]: value }; demo.save(d); emit('menu');
  },
  async upload(file) {
    if (mode === 'supabase') {
      const path = Date.now() + '-' + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: false }); if (error) throw error;
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }
    return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  },
  onMenu(f) { listeners.menu.push(f); },
  onOrders(f) { listeners.orders.push(f); },
  async user() { if (mode !== 'supabase') return null; const { data } = await sb.auth.getUser(); return data.user?.email || null; },
  DEFAULT_SETTINGS,
  toProduct
};

/* ---------------- live updates ---------------- */
if (mode === 'supabase') {
  sb.channel('aem-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => emit('menu'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => emit('menu'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => emit('orders', p))
    .subscribe();
} else if (mode === 'demo') {
  addEventListener('storage', e => { if (e.key === demo.KEY) { emit('menu'); emit('orders'); } });
}

/* ---------------- website: load the live menu before the page script runs ---------------- */
async function loadSite() {
  const [rows, s] = await Promise.all([api.products(), api.settings()]);
  const list = window.AEM_PRODUCTS || (window.AEM_PRODUCTS = []);
  list.splice(0, list.length, ...rows.filter(r => r.category !== 'holiday').map(toProduct));
  const hol = window.AEM_HOLIDAY_ITEMS || (window.AEM_HOLIDAY_ITEMS = []);
  hol.splice(0, hol.length, ...rows.filter(r => r.category === 'holiday').map(toProduct));
  const cfg = window.AEM_CONFIG || (window.AEM_CONFIG = {});
  cfg.leadTimeHours = Number(s.lead_time_hours) || 6;
  cfg.acceptingOrders = s.accepting_orders !== false;
  cfg.announcement = s.announcement;
  cfg.basketPrice = Number(s.basket_price ?? 5);
  cfg.basketCapacity = Number(s.basket_capacity) || 0;
  cfg.paymentUrl = s.payment_url || '';
  cfg.prepTiers = Array.isArray(s.prep_tiers) ? s.prep_tiers : [];
  cfg.deliveryEnabled = s.delivery_enabled !== false;
  cfg.deliveryZones = Array.isArray(s.delivery_zones) ? s.delivery_zones : [];
  cfg.freeDeliveryOver = Number(s.free_delivery_over) || 0;
  api.content = s.content || {};
  applyContent();
}
/* page text and photos edited in the dashboard */
function applyContent() {
  const c = api.content || {};
  document.querySelectorAll('[data-edit]').forEach(el => {
    const k = el.dataset.edit;
    if (el.dataset.orig === undefined) el.dataset.orig = el.tagName === 'IMG' ? el.getAttribute('src') : el.textContent;
    const v = c[k];
    if (el.tagName === 'IMG') { const src = v || el.dataset.orig; if (el.getAttribute('src') !== src) el.src = src; }
    else { const t = (v ?? el.dataset.orig); if (el.textContent !== t) el.textContent = t; }
  });
}
api.applyContent = applyContent;
api.ready = mode === 'static' ? Promise.resolve()
  : Promise.race([loadSite(), new Promise(r => setTimeout(r, 4000))]).catch(e => console.warn('Live menu unavailable, using built-in menu.', e));
api.reload = loadSite;
window.AEMDB = api;
})();
