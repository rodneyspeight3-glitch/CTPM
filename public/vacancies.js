const select=selector=>document.querySelector(selector);
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
let vacancies=[];
async function vacancyAPI(url,options={}){
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to complete your request.');return data;
}
function renderVacancies(){
 const query=select('#vacancy-search').value.toLowerCase();
 const beds=select('#vacancy-beds').value,budget=select('#vacancy-budget').value,sort=select('#vacancy-sort').value;
 const visible=vacancies.filter(p=>(p.name+' '+p.area).toLowerCase().includes(query)&&(beds==='all'||p.beds===Number(beds))&&(budget===''||p.price<=Number(budget)));
 if(sort==='price-low')visible.sort((a,b)=>a.price-b.price);if(sort==='price-high')visible.sort((a,b)=>b.price-a.price);if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name));
 select('#vacancy-results').textContent=visible.length+' of '+vacancies.length+' available homes';
 select('#vacancy-list').innerHTML=visible.length?visible.map(p=>`<article class="property-card"><div class="property-image"><img src="${p.photoUpdated?'/property-photos/'+p.id+'?v='+encodeURIComponent(p.photoUpdated):'/images/home-'+p.image+'.jpg'}" alt="${p.photoUpdated?'Property photograph for':'Illustrative photograph for'} ${escapeText(p.name)}"><span class="property-badge">AVAILABLE · ${escapeText(p.type)}</span></div><div class="property-body"><div class="property-top"><h3>${escapeText(p.name)}</h3><strong>${formatMoney(p.price)}<small> / mo</small></strong></div><p class="location">${escapeText(p.area)} · ${escapeText(p.address)}</p>${p.description?`<p class="listing-description">${escapeText(p.description.slice(0,140))}${p.description.length>140?'…':''}</p>`:''}<div class="amenity-tags">${(p.amenities||[]).slice(0,3).map(a=>`<span>${escapeText(a)}</span>`).join('')}</div><div class="property-footer"><span>${p.beds} beds</span><span>${p.baths} baths</span><span>${p.size} sq ft</span></div><div class="listing-actions"><button class="text-link" data-details="${p.id}">View details</button><button class="button green" data-apply="${p.id}">Apply for this home →</button></div></div></article>`).join(''):'<div class="empty-state dashboard-empty"><h3>No available homes match your search.</h3><p>Check back for new vacancies.</p></div>';
}
async function loadVacancies(){
 try{vacancies=(await vacancyAPI('/api/vacancies')).properties;const selected=select('#vacancy-beds').value;const beds=[...new Set(vacancies.map(p=>p.beds))].sort((a,b)=>a-b);select('#vacancy-beds').innerHTML='<option value="all">Any bedrooms</option>'+beds.map(n=>`<option value="${n}">${n===0?'Studio':n+' bedroom'+(n===1?'':'s')}</option>`).join('');select('#vacancy-beds').value=selected!=='all'&&beds.includes(Number(selected))?selected:'all';renderVacancies();select('#vacancies-error').textContent='';window.dispatchEvent(new CustomEvent('vacancies:loaded',{detail:{count:vacancies.length}}));return true;}catch(error){select('#vacancies-error').textContent=error.message;return false;}
}
const dialog=select('#application-modal');let applicationFocus;
select('#close-application').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>applicationFocus?.focus());
function applyFor(p){
 if(!dialog.open)applicationFocus=document.activeElement;
 select('#application-content').innerHTML=`<p class="eyebrow">RENTAL APPLICATION FORM</p><h2 id="application-title">Apply for ${escapeText(p.name)}</h2><p>${escapeText(p.address)} · ${formatMoney(p.price)} / month</p><form id="vacancy-application-form">${rentalApplicationMarkup()}<p id="application-error" role="alert"></p><p id="application-progress" role="status"></p><div class="application-submit-row"><button type="submit" class="button green">Submit application →</button><button type="button" class="text-link" id="cancel-application">Cancel</button></div></form>`;
 const form=select('#vacancy-application-form');prepareRentalApplication(form);select('#cancel-application').onclick=()=>dialog.close();
 if(!dialog.open)dialog.showModal();
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;select('#application-error').textContent='';select('#application-progress').textContent='Preparing and submitting your documents…';
  try{const data=await rentalApplicationData(form);const result=await vacancyAPI('/api/vacancies/'+p.id+'/applications',{method:'POST',body:JSON.stringify(data)});if(select('#vacancy-application-form')!==form)return;select('#application-content').innerHTML=`<h2 id="application-title">Application received.</h2><div class="application-success"><p>${escapeText(result.message)}</p></div>`;const current=new URL(location.href);current.searchParams.delete('property');history.replaceState(null,'',current.pathname+current.search+current.hash);}
  catch(error){if(select('#vacancy-application-form')!==form)return;select('#application-error').textContent=error.message;select('#application-progress').textContent='';button.disabled=false;}
 };
}
select('#vacancy-search').oninput=renderVacancies;
select('#vacancy-beds').onchange=renderVacancies;select('#vacancy-budget').oninput=renderVacancies;select('#vacancy-sort').onchange=renderVacancies;select('#clear-vacancy-filters').onclick=()=>{select('#vacancy-search').value='';select('#vacancy-beds').value='all';select('#vacancy-budget').value='';select('#vacancy-sort').value='newest';renderVacancies();};
select('#refresh-vacancies').onclick=loadVacancies;
document.addEventListener('click',event=>{const button=event.target.closest('[data-apply],[data-details]');if(!button)return;const p=vacancies.find(p=>p.id===Number(button.dataset.apply||button.dataset.details));if(p){if(button.dataset.apply)applyFor(p);else showPropertyDetails(p);}});
(async()=>{if(!await loadVacancies())return;const params=new URLSearchParams(location.search),id=params.get('property')||params.get('listing');if(!id)return;const p=vacancies.find(p=>p.id===Number(id));if(p){if(params.has('property'))applyFor(p);else showPropertyDetails(p);}else select('#vacancies-error').textContent='That property is no longer available. Browse the current vacancies below.';})();

(async()=>{try{const {company}=await vacancyAPI('/api/company');window.dispatchEvent(new CustomEvent('company:loaded',{detail:company}));const footer=select('#public-contact');footer.textContent=company.companyName;for(const [text,href] of [[company.contactEmail,company.contactEmail?'mailto:'+company.contactEmail:''],[company.contactPhone,company.contactPhone?'tel:'+company.contactPhone.replace(/[^+\d]/g,''):'']]){if(!text)continue;const a=document.createElement('a');a.textContent=text;a.href=href;footer.append(a);}}catch{select('#public-contact').textContent='Contact management through your resident portal.';}})();

function showPropertyDetails(p){
 if(!dialog.open)applicationFocus=document.activeElement;
 const link=new URL('/vacancies?listing='+p.id,location.origin).href;
 select('#application-content').innerHTML=`<p class="eyebrow">AVAILABLE · ${escapeText(p.type)}</p><h2 id="application-title">${escapeText(p.name)}</h2><p>${escapeText(p.address)} · ${escapeText(p.area)}</p><img class="modal-photo" src="${p.photoUpdated?'/property-photos/'+p.id+'?v='+encodeURIComponent(p.photoUpdated):'/images/home-'+p.image+'.jpg'}" alt="${p.photoUpdated?'Property photograph':'Illustrative photograph'}"><h3>${formatMoney(p.price)} / month</h3><div class="property-detail-grid"><p>${p.beds===0?'Studio':p.beds+' bedrooms'}</p><p>${p.baths} bathrooms</p><p>${p.size} square feet</p><p>${escapeText(p.type)}</p></div>${!p.photoUpdated?'<p class="form-note">The photograph is an illustration. Confirm property details with management.</p>':''}${p.description?`<p class="property-long-description">${escapeText(p.description)}</p>`:''}<div class="amenity-tags">${(p.amenities||[]).map(a=>`<span>${escapeText(a)}</span>`).join('')}</div><button class="button green" data-apply="${p.id}">Apply for this home →</button><label class="share-link">Share this property<input id="property-share-link" value="${escapeText(link)}" readonly><button class="text-link" id="copy-property-link" type="button">Copy property link</button></label><p id="property-share-status" role="status"></p>`;
 if(!dialog.open)dialog.showModal();
 select('#copy-property-link').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(link);select('#property-share-status').textContent='Property link copied.';}catch{select('#property-share-link').focus();select('#property-share-link').select();select('#property-share-status').textContent='Select and copy the property link above.';}};
}
