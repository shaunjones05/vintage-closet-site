const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.log(JSON.stringify({ ok: false, reason: 'NO_ENV_LOCAL' }, null, 2));
  process.exit(0);
}

const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  if (!line || /^\s*#/.test(line)) continue;
  const i = line.indexOf('=');
  if (i === -1) continue;
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  env[k] = v;
}

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(JSON.stringify({ ok: false, reason: 'MISSING_ENV_KEYS' }, null, 2));
  process.exit(0);
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const required = ['inventory', 'orders'];
  const tables = [];

  for (const name of required) {
    const { error, count } = await sb.from(name).select('*', { count: 'exact', head: true });
    tables.push({ table: name, ok: !error, error: error ? error.message : null, count: count ?? null });
  }

  const { data, error } = await sb.from('orders').select('*').limit(1);
  const cols = !error && data && data[0] ? Object.keys(data[0]) : [];

  console.log(JSON.stringify({ ok: true, tables, ordersColumnsSample: cols }, null, 2));
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
