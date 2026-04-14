/**
 * Minimal Supabase REST client for Cloudflare Pages Functions.
 * Uses service role key — bypasses RLS. Never expose to browser.
 */
export function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=representation',
  };
  return {
    async select(table, filters = '') {
      const r = await fetch(`${url}/rest/v1/${table}?${filters}`, { headers });
      if (!r.ok) { const e = await r.text().catch(()=>''); throw new Error(e.includes('message') ? JSON.parse(e).message||'Database error' : 'Database error'); }
      return r.json();
    },
    async insert(table, data) {
      const r = await fetch(`${url}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(data) });
      if (!r.ok) { const e = await r.text().catch(()=>''); throw new Error(e.includes('message') ? JSON.parse(e).message||'Database error' : 'Database error'); }
      return r.json();
    },
    async update(table, filters, data) {
      const r = await fetch(`${url}/rest/v1/${table}?${filters}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
      if (!r.ok) { const e = await r.text().catch(()=>''); throw new Error(e.includes('message') ? JSON.parse(e).message||'Database error' : 'Database error'); }
      return r.json();
    },
  };
}

export function isAdmin(request, env) {
  const secret = request.headers.get('X-Admin-Secret');
  return secret && secret === env.ADMIN_SECRET;
}

export function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export function errRes(msg, status = 400) {
  return jsonRes({ error: msg }, status);
}

export function optionsRes() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    },
  });
}
