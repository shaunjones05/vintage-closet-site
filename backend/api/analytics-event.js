const { createClient } = require('@supabase/supabase-js');
const { ORIGINS, normalize } = require('../lib/analytics');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('Vary','Origin');
  const origin=req.headers.origin;
  if(!ORIGINS.includes(origin)) return res.status(403).json({error:'Origin not allowed.'});
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).end();
  if(process.env.ANALYTICS_ENABLED!=='true') return res.status(204).end();
  if(req.headers.dnt==='1' || req.headers['sec-gpc']==='1' || /bot|crawler|spider|headless/i.test(req.headers['user-agent']||'')) return res.status(204).end();
  if(!String(req.headers['content-type']||'').startsWith('application/json')) return res.status(415).end();
  if(Number(req.headers['content-length'])>4096) return res.status(413).end();
  const row=normalize(req.body);
  if(!row) return res.status(400).json({error:'Invalid event.'});
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const {count,error:limitError}=await db.from('analytics_events').select('id',{count:'exact',head:true}).eq('session_id',row.session_id).gte('created_at',new Date(Date.now()-3600000).toISOString());
    if(limitError) throw limitError;
    if(count>=300) return res.status(429).end();
    const {error}=await db.from('analytics_events').upsert(row,{onConflict:'id',ignoreDuplicates:true});
    if(error) throw error;
    return res.status(204).end();
  } catch { return res.status(503).json({error:'Analytics temporarily unavailable.'}); }
};
module.exports.config={api:{bodyParser:{sizeLimit:'4kb'}}};
