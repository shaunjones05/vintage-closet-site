/* First-party analytics: no email, IP, full referrer URL, or arbitrary query strings. */
(() => {
  if(window.vcpAnalytics || !['vintageclosetpdx.com','www.vintageclosetpdx.com'].includes(location.hostname)) return;
  if(navigator.doNotTrack==='1' || navigator.globalPrivacyControl) return;
  const endpoint='https://backend-pi-dusky-32.vercel.app/api/analytics-event';
  try {
    if(localStorage.getItem('vcp_analytics_opt_out')==='1') return;
    const uuid=()=>crypto.randomUUID();
    let visitor=localStorage.getItem('vcp_analytics_visitor');
    if(!visitor){visitor=uuid();localStorage.setItem('vcp_analytics_visitor',visitor);}
    let state; try{state=JSON.parse(sessionStorage.getItem('vcp_analytics_session'));}catch{}
    if(!state || Date.now()-state.last>1800000) state={id:uuid(),previous:null,referrer:document.referrer};
    const query=new URLSearchParams(location.search);
    const productId=query.get('id');
    let path=location.pathname+(location.pathname==='/product.html' && /^[\w-]{1,100}$/.test(productId||'') ? '?id='+productId : query.get('archive')==='1' ? '?archive=1' : '');
    let source='';try{source=new URL(state.referrer).origin;}catch{}
    if(/admin|dashboard|import|order-status|debug/i.test(path)) return;
    const send=(event,product)=>{
      try {
        if(localStorage.getItem('vcp_analytics_opt_out')==='1') return;
        if(Date.now()-state.last>1800000) {state={id:uuid(),previous:null,referrer:''};source='';}
        state.last=Date.now();sessionStorage.setItem('vcp_analytics_session',JSON.stringify(state));
        const body={id:uuid(),event,visitor_id:visitor,session_id:state.id,path,previous_path:state.previous,referrer:source,
          product_code:String(product||new URLSearchParams(location.search).get('id')||''),device:/Mobi/i.test(navigator.userAgent)?'mobile':/Tablet|iPad/i.test(navigator.userAgent)?'tablet':'desktop'};
        fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,credentials:'omit'}).catch(()=>{});
      }catch{}
    };
    window.vcpAnalytics={track:send}; send('page_view');
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-cat]');
      if(!button)return;
      const next='/?category='+encodeURIComponent(button.dataset.cat);
      if(path===next)return;
      path=next;send('page_view');state.previous=path;sessionStorage.setItem('vcp_analytics_session',JSON.stringify(state));
    });
    state.previous=path;sessionStorage.setItem('vcp_analytics_session',JSON.stringify(state));
  }catch{/* Storage restrictions must never interrupt shopping. */}
})();
