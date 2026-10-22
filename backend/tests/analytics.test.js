const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {authorized,normalize,page,summarize}=require('../lib/analytics');
const {randomUUID}=require('node:crypto');
test('admin authorization fails closed',()=>{assert.equal(authorized(undefined,undefined),false);assert.equal(authorized('bad','secret'),false);assert.equal(authorized('secret','secret'),true);});
test('strip personal query strings and reject private pages',()=>{
 assert.equal(page('/product.html?id=TEE-1&email=private@example.com'),'/product.html?id=TEE-1');
 assert.equal(page('/index.html?archive=1&token=secret'),'/?archive=1');
 assert.equal(page('/?category=New%20Arrivals&email=private'),'/?category=New%20Arrivals');
 for(const path of ['/admin-orders.html','/dashboard.html','/order-status.html?token=x','//evil.com','/import-listings.html'])assert.equal(page(path),null);
});
test('validate events and omit unapproved fields',()=>{
 const input={id:randomUUID(),visitor_id:randomUUID(),session_id:randomUUID(),event:'page_view',path:'/',referrer:'https://instagram.com/a?secret=x',email:'private',device:'desktop'};
 assert.equal(normalize(input).referrer,'instagram.com');assert.equal(normalize(input).email,undefined);
 assert.equal(normalize({...input,event:'purchase'}),null);assert.equal(normalize({...input,session_id:'invalid'}),null);
});
test('aggregate distinct browsers, sessions, sources, navigation and zero days',()=>{
 const now=new Date('2026-10-22T02:00:00Z');
 const base={created_at:now.toISOString(),visitor_id:'one',session_id:'s',device:'mobile',referrer:'instagram.com'};
 const data=summarize([{...base,event:'page_view',path:'/'},{...base,event:'page_view',path:'/product.html?id=A',product_code:'A',previous_path:'/'},{...base,event:'add_to_cart',path:'/product.html?id=A'}],7,now);
 assert.equal(data.visitors,1);assert.equal(data.sessions,1);assert.equal(data.page_views,2);assert.equal(data.add_to_cart,1);assert.equal(data.daily.length,7);assert.equal(data.sources[0].count,1);assert.equal(data.products[0].label,'A');assert.equal(data.paths.length,1);
});
const tracker=fs.readFileSync(require.resolve('../../js/analytics.js'),'utf8');
function runTracker(overrides={}){
 const data=new Map(),requests=[],listeners={};
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const ctx={window:{},location:{hostname:'vintageclosetpdx.com',pathname:'/',search:''},navigator:{userAgent:'Desktop'},localStorage:storage,sessionStorage:storage,crypto:{randomUUID},URL,URLSearchParams,Date,document:{referrer:'https://instagram.com/',addEventListener:(name,cb)=>listeners[name]=cb},fetch:(_url,opts)=>{requests.push(JSON.parse(opts.body));return Promise.resolve({});},...overrides};
 vm.runInNewContext(tracker,ctx);return {ctx,requests,listeners};
}
test('tracker records category paths and sends no password',()=>{
 const {ctx,requests,listeners}=runTracker();assert.equal(requests.length,1);
 listeners.click({target:{closest:()=>({dataset:{cat:'Tees'}})}});assert.equal(requests[1].path,'/?category=Tees');assert.equal(requests[1].previous_path,'/');
 ctx.window.vcpAnalytics.track('add_to_cart','TEE-1');assert.equal(requests[2].product_code,'TEE-1');assert.equal(requests[2].password,undefined);
});
test('privacy preferences and unavailable storage never interrupt the page',()=>{
 assert.equal(runTracker({navigator:{doNotTrack:'1'}}).requests.length,0);
 assert.equal(runTracker({navigator:{globalPrivacyControl:true}}).requests.length,0);
 assert.equal(runTracker({localStorage:{getItem:()=>{throw Error('blocked');}}}).requests.length,0);
 assert.equal(runTracker({localStorage:{getItem:()=> '1'}}).requests.length,0);
});
function handler(file,db){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve(file),'utf8'),{module,require:name=>name==='@supabase/supabase-js'?{createClient:()=>db}:require(name==='../lib/analytics'?'../lib/analytics':name),process:{env:{IMPORT_PASSWORD:'secret',ANALYTICS_ENABLED:'true'}},Date,Buffer,console});
 return module.exports;
}
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test('unauthenticated reports and invalid origins never reach database',async()=>{
 const db={from(){throw Error('must not query');}};
 const admin=handler('../api/admin-analytics.js',db), res=response();
 await admin({method:'POST',headers:{},body:{days:7}},res);assert.equal(res.code,401);assert.match(res.headers['Cache-Control'],/no-store/);
 const ingest=handler('../api/analytics-event.js',db), rejected=response();
 await ingest({method:'POST',headers:{origin:'https://evil.example'}},rejected);assert.equal(rejected.code,403);
});
test('authorized empty report works, invalid range rejected',async()=>{
 const query={select(){return this;},gte(){return this;},lte(){return this;},order(){return this;},range:async()=>({data:[],error:null})};
 const admin=handler('../api/admin-analytics.js',{from:()=>query});
 const res=response();await admin({method:'POST',headers:{'x-import-password':'secret'},body:{days:7}},res);assert.equal(res.code,200);assert.equal(res.body.page_views,0);
 const bad=response();await admin({method:'POST',headers:{'x-import-password':'secret'},body:{days:999}},bad);assert.equal(bad.code,400);
});
test('ingestion stores only normalized events and rejects a full session',async()=>{
 let stored;
 const query={select(){return this;},eq(){return this;},gte:async()=>({count:0,error:null}),upsert:async(row)=>{stored=row;return {error:null};}};
 const input={id:randomUUID(),visitor_id:randomUUID(),session_id:randomUUID(),event:'page_view',path:'/product.html?id=TEE-1&token=private',referrer:'https://instagram.com/path?secret=x',device:'mobile'};
 const ingest=handler('../api/analytics-event.js',{from:()=>query});
 const req={method:'POST',headers:{origin:'https://vintageclosetpdx.com','content-type':'application/json'},body:input};
 const res=response();await ingest(req,res);assert.equal(res.code,204);assert.equal(stored.path,'/product.html?id=TEE-1');assert.equal(stored.referrer,'instagram.com');
 query.gte=async()=>({count:300,error:null});const limited=response();await ingest(req,limited);assert.equal(limited.code,429);
});
