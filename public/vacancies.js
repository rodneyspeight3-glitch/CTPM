const select=selector=>document.querySelector(selector);
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
let vacancies=[];
async function vacancyAPI(url,options={}){
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to complete your request.');return data;
}
function renderVacancies(){
 const query=select('#vacancy-search').value.toLowerCase();
 const visible=vacancies.filter(p=>(p.name+' '+p.area).toLowerCase().includes(query));
 select('#vacancy-list').innerHTML=visible.length?visible.map(p=>`<article class="property-card"><div class="property-image"><img src="/images/home-${p.image}.jpg" alt="Illustrative photograph for ${escapeText(p.name)}"><span class="property-badge">AVAILABLE · ${escapeText(p.type)}</span></div><div class="property-body"><div class="property-top"><h3>${escapeText(p.name)}</h3><strong>${formatMoney(p.price)}<small> / mo</small></strong></div><p class="location">${escapeText(p.area)} · ${escapeText(p.address)}</p><div class="property-footer"><span>${p.beds} beds</span><span>${p.baths} baths</span><span>${p.size} sq ft</span></div><div class="listing-actions"><button class="button green" data-apply="${p.id}">Apply for this home →</button></div></div></article>`).join(''):'<div class="empty-state dashboard-empty"><h3>No available homes match your search.</h3><p>Check back for new vacancies.</p></div>';
}
async function loadVacancies(){
 try{vacancies=(await vacancyAPI('/api/vacancies')).properties;renderVacancies();select('#vacancies-error').textContent='';return true;}catch(error){select('#vacancies-error').textContent=error.message;return false;}
}
const dialog=select('#application-modal');let applicationFocus;
select('#close-application').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>applicationFocus?.focus());
function applyFor(p){
 applicationFocus=document.activeElement;
 select('#application-content').innerHTML=`<p class="eyebrow">VACANCY APPLICATION</p><h2 id="application-title">Apply for ${escapeText(p.name)}</h2><p>${escapeText(p.address)} · ${formatMoney(p.price)} / month</p><form id="vacancy-application-form"><label>Full name<input name="name" autocomplete="name" required maxlength="100"></label><label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" required maxlength="40"></label><div class="form-columns"><label>Preferred move-in date<input name="moveIn" type="date" min="${new Date().toISOString().slice(0,10)}" required></label><label>Number of occupants<input name="occupants" type="number" min="1" max="50" step="1" required></label></div><label>Message for management (optional)<textarea name="message" maxlength="2000" placeholder="Questions about the home or your preferred move-in date"></textarea></label><p class="form-note">Your details are stored with your application and visible to agents and administrators. Do not send SSNs, bank information, identity documents, or passwords. This form does not create a tenant account or reserve a property.</p><label class="consent-label"><input name="consent" type="checkbox" required><span>I agree that management may contact me about this application using the details provided.</span></label><p id="application-error" role="alert"></p><button class="button green">Submit application →</button></form>`;
 dialog.showModal();
 select('#vacancy-application-form').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
  const data=Object.fromEntries(new FormData(event.target));data.occupants=Number(data.occupants);data.consent=event.target.elements.consent.checked;
  try{const result=await vacancyAPI('/api/vacancies/'+p.id+'/applications',{method:'POST',body:JSON.stringify(data)});select('#application-content').innerHTML=`<h2 id="application-title">Application received.</h2><div class="application-success"><p>${escapeText(result.message)}</p></div>`;history.replaceState(null,'','/vacancies');}
  catch(error){select('#application-error').textContent=error.message;button.disabled=false;}
 };
}
select('#vacancy-search').oninput=renderVacancies;
select('#refresh-vacancies').onclick=loadVacancies;
document.addEventListener('click',event=>{const button=event.target.closest('[data-apply]');if(!button)return;const p=vacancies.find(p=>p.id===Number(button.dataset.apply));if(p)applyFor(p);});
(async()=>{if(!await loadVacancies())return;const id=new URLSearchParams(location.search).get('property');if(!id)return;const p=vacancies.find(p=>p.id===Number(id));if(p)applyFor(p);else select('#vacancies-error').textContent='That property is no longer available. Browse the current vacancies below.';})();
