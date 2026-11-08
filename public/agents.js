(()=>{
 const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const root=document.querySelector('#agent-directory');if(!root)return;
 fetch('/api/agents').then(async response=>{if(!response.ok)throw Error();return response.json();}).then(({agents})=>{
  root.innerHTML=agents.length?agents.map(a=>`<article class="agent-card" id="agent-${a.id}"><div class="agent-portrait">${window.agentPortraitMarkup(a)}</div><div class="agent-copy"><p class="eyebrow">${escape(a.title)}</p><h3>${escape(a.name)}</h3>${a.areas?`<p class="agent-area">${escape(a.areas)}</p>`:''}${a.bio?`<p class="agent-bio">${escape(a.bio)}</p>`:'<p class="agent-bio">Here to help with your next home and everyday property questions.</p>'}<div class="agent-contact">${a.email?`<a class="text-link" href="mailto:${escape(a.email)}">Email agent →</a>`:''}${a.phone?`<a class="text-link" href="tel:${a.phone.replace(/[^+\d]/g,'')}">${escape(a.phone)}</a>`:''}${!a.email&&!a.phone?'<a class="text-link" href="/#contact">Contact management →</a>':''}</div></div></article>`).join(''):'<div class="empty-state"><h3>Your property team will appear here.</h3><p>Contact management for help with available homes and property questions.</p></div>';
  window.dispatchEvent(new Event('agents:loaded'));
  if(location.hash)document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'});
 }).catch(()=>{root.innerHTML='<p role="alert">The agent directory is temporarily unavailable. Please refresh this page.</p>';});
})();
