(()=>{
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.propertyAgentMarkup=(property,{detail=false,staff=false}={})=>{
  const agents=property.agents||[],unavailable=staff?(property.unavailableAgents||[]):[];
  if(!agents.length)return `<div class="property-agent-list"><p class="property-agent-heading">${unavailable.length?'Agent assignment needs review':'Managed by the property team'}</p>${unavailable.length?'<p class="property-agent-note">'+unavailable.map(a=>e(a.name)).join(', ')+' · unavailable account. An administrator can update this property’s agents.</p>':''}${detail?'<a class="text-link" href="/#contact">Contact management →</a>':''}</div>`;
  return `<section class="property-agent-list" aria-label="Agents in charge"><p class="property-agent-heading">${agents.length===1?'Agent in charge':'Agents in charge'}</p>${agents.map(a=>`<div class="property-agent-row">${a.hasPhoto?`<img class="property-agent-avatar" src="/agent-photos/${a.id}?v=${encodeURIComponent(a.updated_at||'')}" alt="${e(a.name)}" loading="lazy">`:`<span class="property-agent-avatar property-agent-initials" aria-hidden="true">${e(a.name.split(/\s+/).slice(0,2).map(n=>n[0]||'').join(''))}</span>`}<div class="property-agent-copy"><a class="property-agent-name" href="/agents#agent-${a.id}">${e(a.name)}</a><span>${e(a.title)}</span>${detail?`<div class="property-agent-contact">${a.email?`<a href="mailto:${encodeURIComponent(a.email)}">${e(a.email)}</a>`:''}${a.phone?`<a href="tel:${a.phone.replace(/[^+\d]/g,'')}">${e(a.phone)}</a>`:''}${!a.email&&!a.phone?'<a href="/#contact">Contact management →</a>':''}</div>`:''}</div></div>`).join('')}${unavailable.length?'<p class="property-agent-note">'+unavailable.map(a=>e(a.name)).join(', ')+' · unavailable account; review assignments in Edit property.</p>':''}</section>`;
 };
 const states=new WeakMap();
 window.setupPropertyAgentEditor=(form,property)=>{
  const admin=currentUser?.role==='admin',host=document.createElement('fieldset');host.className='property-agent-chooser';
  if(!admin){host.innerHTML='<legend>Agent in charge</legend><p class="form-note">'+(property?'Editing a property keeps its existing agent assignments. Administrators manage the assigned team.':'You will automatically be assigned as the agent in charge of this property.')+'</p>'+(property?window.propertyAgentMarkup(property,{staff:true}):'');form.querySelector('#property-error').before(host);return;}
  const state={ready:false};states.set(form,state);const submit=form.querySelector('button');submit.disabled=true;
  host.innerHTML='<legend>Agents in charge</legend><p class="form-note">Choose the agents responsible for this property. With no selection, the property team is shown.</p><p class="agent-options-status" role="status">Loading agents…</p><div class="property-agent-options"></div>';form.querySelector('#property-error').before(host);
  fetch('/api/agents').then(async response=>{if(!response.ok)throw Error();return response.json();}).then(({agents})=>{
   if(document.querySelector('#property-form')!==form)return;
   const selected=new Set(property?.assignedAgentIds||[]),options=[...agents,...(property?.unavailableAgents||[]).filter(a=>!agents.some(active=>active.id===a.id)).map(a=>({...a,unavailable:true}))];
   host.querySelector('.property-agent-options').innerHTML=options.map(a=>`<label class="property-agent-option"><input type="checkbox" data-property-agent-id="${a.id}"${selected.has(a.id)?' checked':''}><span>${e(a.name)}${a.unavailable?' · inactive / unavailable':''}</span></label>`).join('');host.querySelector('.agent-options-status').textContent=options.length?'Only public agent profiles appear on property listings.':'No agents yet. Create an agent in Manage accounts before assigning one.';state.ready=true;submit.disabled=false;
  }).catch(()=>{if(document.querySelector('#property-form')===form)host.querySelector('.agent-options-status').textContent='Agents could not be loaded. Close and reopen this editor to try again; existing assignments have not changed.';});
 };
 window.propertyAgentSubmission=form=>{
  if(currentUser?.role!=='admin')return {};
  if(!states.get(form)?.ready)throw Error('Wait for the agent list to load, or close and reopen the property editor.');
  return {agentIds:[...form.querySelectorAll('[data-property-agent-id]:checked')].map(el=>Number(el.dataset.propertyAgentId))};
 };
})();
