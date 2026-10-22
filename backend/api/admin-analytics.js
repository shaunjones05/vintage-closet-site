const {createClient}=require('@supabase/supabase-js');
const {authorized,summarize}=require('../lib/analytics');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='POST') return res.status(405).end();
  if(!authorized(req.headers['x-import-password'],process.env.IMPORT_PASSWORD)) return res.status(401).json({error:'Invalid admin password.'});
  const days=Number(req.body?.days ?? 7);
  if(![1,7,30,90].includes(days)) return res.status(400).json({error:'Choose 1, 7, 30, or 90 days.'});
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const now=new Date(), since=new Date(now.getTime()-days*86400000).toISOString();
    const rows=[]; let truncated=false;
    for(let offset=0;offset<50000;offset+=1000){
      const {data,error}=await db.from('analytics_events').select('id,event,visitor_id,session_id,path,previous_path,referrer,product_code,device,created_at').gte('created_at',since).lte('created_at',now.toISOString()).order('created_at').order('id').range(offset,offset+999);
      if(error) throw error;
      rows.push(...data); if(data.length<1000) break; if(offset===49000) truncated=true;
    }
    return res.status(200).json({...summarize(rows,days,now),days,since,until:now.toISOString(),truncated,enabled:process.env.ANALYTICS_ENABLED==='true'});
  }catch{return res.status(503).json({error:'Analytics is not ready. Check the analytics database setup.'});}
};
