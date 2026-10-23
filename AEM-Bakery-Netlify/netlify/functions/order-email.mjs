// Sends the customer an order confirmation email.
// It switches on when these environment variables are set in Netlify
// (Site configuration > Environment variables):
//   RESEND_API_KEY             from resend.com (free plan is enough)
//   EMAIL_FROM                 e.g. "AEM Bakery <orders@yourdomain.com>" (a domain verified in Resend)
//   SUPABASE_URL               same URL as in config.js
//   SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API > service_role (keep it secret, never put it in config.js)
// The function only emails the address saved on a real, recent order, and only once per order,
// so it can't be used to send email to anyone else.
const money = v => '$' + Number(v || 0).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async (req) => {
  const { RESEND_API_KEY, EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!RESEND_API_KEY || !EMAIL_FROM || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Response.json({ sent: false, reason: 'not configured' });
  let ref;
  try { ({ ref } = await req.json()); } catch { return new Response('Bad request', { status: 400 }); }
  if (!/^AEM-[A-Z0-9]{3,10}$/.test(ref || '')) return new Response('Bad request', { status: 400 });

  const db = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const r = await db(`orders?ref=eq.${encodeURIComponent(ref)}&select=*&limit=1`);
  const [o] = r.ok ? await r.json() : [];
  if (!o || o.confirmation_sent || Date.now() - new Date(o.created_at) > 30 * 60e3) return Response.json({ sent: false });

  const when = o.pickup_date ? new Date(o.pickup_date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  const rows = o.items.map(i => `<tr><td style="padding:6px 0">${i.qty} × ${esc(i.name)}${i.opt ? `<br><small style="color:#667085">${esc(i.opt)}</small>` : ''}</td><td style="padding:6px 0;text-align:right">${money(i.price * i.qty)}</td></tr>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1d2939">
    <h2 style="color:#173a5e">Thank you, ${esc(String(o.name).split(' ')[0])}!</h2>
    <p>We’ve received your order <b>${esc(o.ref)}</b>. It will be ${o.fulfilment === 'Delivery' ? 'delivered' : 'ready for pickup'} on <b>${esc(when)}</b>${o.pickup_window ? ', ' + esc(o.pickup_window) : ''}.</p>
    ${o.fulfilment === 'Delivery' && o.address ? `<p>Delivery address: ${esc(o.address)}</p>` : '<p>Pickup: 17955 Roanoke Street NW, Ramsey, MN 55303</p>'}
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e7ec;border-bottom:1px solid #e4e7ec;margin:16px 0">${rows}
      ${Number(o.delivery_fee) ? `<tr><td style="padding:6px 0">Delivery</td><td style="padding:6px 0;text-align:right">${money(o.delivery_fee)}</td></tr>` : ''}
      <tr><td style="padding:8px 0"><b>Total</b></td><td style="padding:8px 0;text-align:right"><b>${money(o.total)}</b></td></tr></table>
    <p>Questions? Just reply to this email.</p><p>AEM Bakery<br>Ramsey, Minnesota</p></div>`;

  const send = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [o.email], reply_to: 'AEMBakery@gmail.com', subject: `Your AEM Bakery order ${o.ref}`, html }) });
  if (!send.ok) return Response.json({ sent: false, reason: 'email failed' }, { status: 502 });
  await db(`orders?id=eq.${o.id}`, { method: 'PATCH', body: JSON.stringify({ confirmation_sent: true }) });
  return Response.json({ sent: true });
};
