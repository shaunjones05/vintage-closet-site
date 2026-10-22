(() => {
  const section=document.createElement('section'); section.id='analytics';section.className='tab';
  section.innerHTML=`<div class="card"><div class="toolbar"><div><h2>Site analytics</h2><p class="muted">Understand visits, popular pieces, and where shoppers go next.</p></div><div class="actions"><label>Time range<select id="analytics-days"><option value="1">Last 24 hours</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><button id="analytics-refresh">Refresh</button></div></div><p id="analytics-status" role="status" aria-live="polite"></p><p class="muted">Visitors are estimated browsers, not identified people. Sources describe the first recorded event per session in the selected range. Counts exclude opted-out visits and may miss blocked tracking. Dates use Pacific time.</p></div><div id="analytics-results"></div>`;
  document.getElementById('app').append(section);
  const button=document.createElement('button'); button.textContent='Analytics'; button.dataset.tab='analytics';document.querySelector('.tabs').append(button);
  button.onclick=()=>{document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s===section));load();};
  const style=document.createElement('style');style.textContent='.analytics-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.analytics-stat strong{display:block;font-size:30px}.analytics-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}.analytics-columns .card{min-width:0} .analytics-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}.analytics-row span{overflow-wrap:anywhere}.analytics-bar{height:7px;background:#805a38;border-radius:4px;margin-top:5px}@media(max-width:700px){.analytics-columns{grid-template-columns:1fr}.tabs{flex-wrap:wrap}}';document.head.append(style);
  let generation=0;
  function table(title,rows){const max=Math.max(1,...rows.map(r=>r.count));return `<section class="card"><h2>${esc(title)}</h2>${rows.length?rows.map(r=>`<div class="analytics-row"><span>${esc(r.label)}<div class="analytics-bar" style="width:${Math.max(1,r.count/max*100)}%"></div></span><strong>${Number(r.count).toLocaleString()}</strong></div>`).join(''):'<p class="muted">No activity recorded in this range.</p>'}</section>`;}
  async function load(){
    const token=++generation;const message=document.getElementById('analytics-status'),results=document.getElementById('analytics-results');
    results.replaceChildren();message.textContent='Loading analytics…';
    try{
      const data=await api('/api/admin-analytics',{days:Number(document.getElementById('analytics-days').value)});
      if(token!==generation || !password)return;
      message.textContent=(data.enabled?'Tracking is enabled. ':'Tracking is paused. ')+(data.truncated?'Showing the first 50,000 events only. Choose a shorter range.':'Updated '+new Date(data.until).toLocaleTimeString()+'.');
      const stats=[['Estimated visitors',data.visitors],['Sessions',data.sessions],['Page views',data.page_views],['Add-to-cart events',data.add_to_cart],['Checkout starts',data.checkout_start]];
      results.innerHTML=`<div class="analytics-stats">${stats.map(([label,value])=>`<div class="card analytics-stat"><span>${esc(label)}</span><strong>${value.toLocaleString()}</strong></div>`).join('')}</div>${table('Page views by date',data.daily)}<div class="analytics-columns">${table('Popular pages',data.pages)}${table('Traffic sources · sessions',data.sources)}${table('Popular products · page views',data.products)}${table('Navigation paths · page views',data.paths)}${table('Devices · page views',data.devices)}</div><p class="muted">Add-to-cart and checkout starts are event counts, not purchases or a conversion rate. Detailed activity begins after tracking is enabled.</p>`;
    }catch(e){if(token===generation){message.textContent=e.message;results.replaceChildren();}}
  }
  document.getElementById('analytics-days').onchange=load;document.getElementById('analytics-refresh').onclick=load;
  document.getElementById('lock-btn').addEventListener('click',()=>{generation++;document.getElementById('analytics-results').replaceChildren();document.getElementById('analytics-status').textContent='';});
})();
