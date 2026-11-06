let properties=window.CTPM_SAMPLE_PROPERTIES.map(p=>({...p}));
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const escapeHTML = text => String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let requests=[];
const sampleProperties = [...properties];
async function loadHomes(){
 const result=await api('/api/properties');
 properties=[...result.properties,...sampleProperties];
 updateBedroomOptions();renderDashboard();renderHomes();
}
async function loadRequests(){
 try{requests=(await api('/api/requests')).requests;renderRequests();renderDashboard();$('#requests-error').textContent='';}
 catch(error){$('#requests-error').textContent=error.message;}
}
function go(page,updateHash=true){
 if(typeof currentUser==='undefined'||!currentUser)return;
 const labels={overview:'Dashboard',homes:'Find a home',requests:'Maintenance',documents:'Resources',team:'Manage accounts',applications:'Applications',settings:'Management settings',leases:'Leases',ledger:'Rent ledger',messages:'Messages',account:'My account'};
 if(!Object.hasOwn(labels,page)||(page==='team'&&currentUser.role!=='admin')||(['applications','settings'].includes(page)&&currentUser.role==='tenant')){page='overview';history.replaceState(null,'','#overview');}
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page);
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
 $('#crumb').textContent=labels[page];
 if(updateHash&&location.hash!=='#'+page)history.pushState(null,'','#'+page);
 if(page==='overview'){loadOperations().catch(error=>toast(error.message));loadHomes().catch(error=>toast(error.message));loadRequests();if(currentUser.role!=='tenant')loadApplications();}
 if(['leases','ledger','messages'].includes(page))loadOperations().catch(error=>toast(error.message));
 if(page==='applications')loadApplications();
 if(page==='requests')loadRequests();
 if(page==='homes')loadHomes().catch(error=>toast(error.message));
 if(page==='settings')loadSettings(true).catch(error=>{$('#settings-error').textContent=error.message;});
 if(page==='team')window.loadTeam?.();
 window.scrollTo({top:0,behavior:'smooth'});
}
window.addEventListener('hashchange',()=>go(location.hash.slice(1)||'overview',false));
document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>go(el.dataset.page));document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
function propertyPhoto(p){return p.photoUpdated?'/property-photos/'+p.id+'?v='+encodeURIComponent(p.photoUpdated):'/images/home-'+p.image+'.jpg';}
function card(p){return `<article class="property-card"><div class="property-image"><img src="${propertyPhoto(p)}" alt="${p.photoUpdated?'Property photograph for':'Illustrative photograph for'} ${escapeHTML(p.name)}" loading="lazy"><span class="property-badge">${escapeHTML(p.type)}</span></div><div class="property-body"><div class="property-top"><h3>${escapeHTML(p.name)}</h3><strong>${money(p.price)}<small> / mo</small></strong></div><p class="location">⌖ ${escapeHTML(p.area)}${p.sample?' · Sample listing':''}</p><div class="property-footer"><span>${p.beds} beds</span><span>•</span><span>${p.baths} baths</span><span>•</span><span>${escapeHTML(p.size)} sq ft</span><button data-property="${p.id}" aria-label="View ${escapeHTML(p.name)}">→</button></div><div class="listing-actions">${p.sample?'<span>Sample · not accepting applications</span>':`<span class="availability-label">${p.archived?'Archived':p.available?'Available':'Unavailable'}</span>${p.available?`<a class="text-link" href="/vacancies?property=${p.id}">Apply for this home →</a>`:''}${typeof currentUser!=='undefined'&&['agent','admin'].includes(currentUser?.role)?`<button class="text-link" data-edit-property="${p.id}">Edit property</button><button class="text-link" data-photo-property="${p.id}">Change photo</button>${!p.archived?`<button class="text-link" data-set-availability="${p.id}" data-available="${!p.available}">Mark ${p.available?'unavailable':'available'}</button>`:''}<button class="text-link" data-archive-property="${p.id}" data-archived="${!p.archived}">${p.archived?'Restore':'Archive'}</button>`:''}`}</div></div></article>`;}
function updateBedroomOptions(){const selected=$('#beds').value;const values=[...new Set(properties.map(p=>p.beds))].sort((a,b)=>a-b);$('#beds').innerHTML='<option value="all">Any bedrooms</option>'+values.map(n=>`<option value="${n}">${n===0?'Studio':n+' bedroom'+(n===1?'':'s')}</option>`).join('');$('#beds').value=values.includes(Number(selected))&&selected!=='all'?selected:'all';}
function renderHomes(){const query=$('#search').value.toLowerCase(),beds=$('#beds').value;const filtered=properties.filter(p=>(!p.sample||$('#show-samples').checked)&&(!p.archived||$('#portfolio-filter').value==='archived'||$('#portfolio-filter').value==='all')&&($('#portfolio-filter').value!=='archived'||p.archived)&&(p.name+' '+p.area).toLowerCase().includes(query)&&(beds==='all'||p.beds===Number(beds)));$('#all-homes').innerHTML=filtered.map(card).join('');$('#empty-homes').hidden=filtered.length>0;}
renderHomes();$('#search').oninput=renderHomes;$('#beds').onchange=renderHomes;$('#show-samples').onchange=renderHomes;$('#portfolio-filter').onchange=renderHomes;
const modal=$('#modal');let previousFocus;
function openModal(content){previousFocus=document.activeElement;$('#modal-content').innerHTML=content;if(!modal.open)modal.showModal();}
function closeModal(){modal.close();previousFocus?.focus();}
$('#close-modal').onclick=closeModal;modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function contact(){openModal('<p class="eyebrow">COME TOGETHER PROPERTY MANAGEMENT LLC</p><h2>Let’s connect.</h2><p>Thanks for your interest in our community. Company contact details and inquiry delivery have not been configured yet.</p><p style="margin-top:15px">This contact panel does not send inquiries. For maintenance, use Maintenance to submit a request to your management team.</p>');}
$('#contact-main').onclick=contact;$('#contact-side').onclick=contact;
$('#payment').onclick=()=>openModal('<p class="eyebrow">RENT & PAYMENTS</p><h2>A little peace of mind.</h2><p>Online payments will be available when your property manager connects a secure payment provider and verifies your resident account.</p><p style="margin-top:15px">No payment is due in this demo. Always confirm payment instructions directly with your property manager.</p>');
$('#notifications').onclick=()=>openModal('<p class="eyebrow">YOU’RE ALL CAUGHT UP</p><h2>Welcome, neighbor.</h2><p>Check Maintenance for the latest request status and updates from your management team.</p>');
document.addEventListener('click',e=>{const target=e.target.closest('[data-property]');if(!target)return;const p=properties.find(p=>p.id===Number(target.dataset.property));if(!p)return;openModal(`<p class="eyebrow">${p.sample?'SAMPLE LISTING':'PROPERTY'} · ${escapeHTML(p.type)}</p><h2>${escapeHTML(p.name)}</h2><p>${escapeHTML(p.area)}</p>${p.address?`<p>${escapeHTML(p.address)}</p>`:''}<img class="modal-photo" src="${propertyPhoto(p)}" alt="${p.photoUpdated?'Property photograph':'Illustrative home photograph'}"><h3>${money(p.price)} / month</h3><p>${p.beds} bedrooms · ${p.baths} bathrooms · ${escapeHTML(p.size)} sq ft</p><p style="margin-top:15px">${p.sample?'This sample listing demonstrates the property browsing experience; pricing and availability are illustrative.':(p.available?'Available for applications. ':'Currently unavailable. ')+(p.photoUpdated?'Photo supplied by management.':'The photograph is an illustration, not a photo of this property.')}</p>${!p.sample&&p.available?`<p><a class="button green" href="/vacancies?property=${p.id}">Apply for this home →</a></p>`:''}<button class="button green" id="property-contact">Contact management →</button>`);$('#property-contact').onclick=contact;});
function newRequest(){
 if(currentUser?.role!=='tenant')return;
 const listings=properties.filter(p=>!p.sample);
 openModal(`<p class="eyebrow">WE’RE HERE TO HELP</p><h2>What needs a little care?</h2><p>Your request is saved securely and shared with agents and administrators.</p><form id="request-form"><label>Property (optional)<select name="propertyId"><option value="">Other / not listed</option>${listings.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}</select></label><label>Property address and unit<input name="location" required maxlength="250" placeholder="Street address, apartment or unit"></label><label>Issue title<input name="title" required maxlength="100" placeholder="For example, leaking kitchen faucet"></label><label>Category<select name="category"><option>Plumbing</option><option>Heating & cooling</option><option>Electrical</option><option>Appliances</option><option>Other</option></select></label><label>Priority<select name="priority"><option>Routine</option><option>Urgent</option></select></label><label>Tell us a little more<textarea name="description" required maxlength="2000" placeholder="Where is the issue, and when did it start?"></textarea></label><p class="form-note">For immediate danger, call 911. Urgent requests do not dispatch emergency services. Do not include passwords or access codes.</p><button class="button green" type="submit">Submit request →</button><p id="form-error" role="alert"></p></form>`);
 $('#request-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;const data=Object.fromEntries(new FormData(e.target));data.propertyId=data.propertyId?Number(data.propertyId):null;
 try{await api('/api/requests',{method:'POST',body:JSON.stringify(data)});closeModal();$('#request-status').value='all';go('requests');toast('Maintenance request submitted.');}catch(error){$('#form-error').textContent=error.message;}finally{button.disabled=false;}};
}
['#new-request','#notice-request','#request-page-button'].forEach(id=>$(id).onclick=newRequest);
function renderRequests(){
 const staff=currentUser?.role!=='tenant';
 $('#request-count').textContent=requests.filter(r=>['Submitted','In progress'].includes(r.status)).length;
 const filter=$('#request-status').value;
 const visible=requests.filter(r=>filter==='all'||r.status===filter);
 $('#requests-list').innerHTML=visible.length?visible.map(r=>`<article class="request-row"><p class="eyebrow">${escapeHTML(r.status.toUpperCase())} · ${escapeHTML(r.priority.toUpperCase())}</p><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.description)}</p><p class="request-location">${r.property_name?escapeHTML(r.property_name)+' · ':''}${escapeHTML(r.location)}</p>${staff?`<p>Submitted by ${escapeHTML(r.tenant_name)}</p>`:''}${r.staff_note?`<div class="resident-update"><strong>Management update</strong><p>${escapeHTML(r.staff_note)}</p></div>`:''}<div class="request-meta"><span>${escapeHTML(r.category)}</span><span>Updated ${escapeHTML(new Date(r.updated_at).toLocaleString())}</span>${staff&&r.status!=='Cancelled'?`<button class="text-link" data-update-request="${r.id}">Update request</button>`:''}${!staff&&r.status==='Submitted'?`<button class="text-link" data-cancel-request="${r.id}">Cancel request</button>`:''}</div></article>`).join(''):`<div class="empty-state"><p class="eyebrow">${filter==='all'?'A FRESH START':'NO MATCHES'}</p><h3>No maintenance requests${filter==='all'?' yet':' with this status'}.</h3><p>${staff?'Requests submitted by tenants will appear here.':'Submit a request when something needs attention.'}</p></div>`;
}
$('#request-status').onchange=renderRequests;
$('#refresh-requests').onclick=loadRequests;
document.addEventListener('click',async e=>{
 const cancel=e.target.closest('[data-cancel-request]');
 if(cancel){cancel.disabled=true;try{await api('/api/requests/'+cancel.dataset.cancelRequest+'/cancel',{method:'POST',body:'{}'});await loadRequests();toast('Request cancelled.');}catch(error){toast(error.message);}finally{cancel.disabled=false;}return;}
 const target=e.target.closest('[data-update-request]');if(!target)return;
 const r=requests.find(r=>r.id===Number(target.dataset.updateRequest));if(!r)return;
 openModal(`<p class="eyebrow">MAINTENANCE TRACKING</p><h2>${escapeHTML(r.title)}</h2><form id="update-request-form"><label>Status<select name="status">${['Submitted','In progress','Completed'].map(s=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}</select></label><label>Update for the resident<textarea name="note" maxlength="2000">${escapeHTML(r.staff_note)}</textarea></label><p class="form-note">This note is visible to the tenant. Do not include internal or sensitive information.</p><p id="update-request-error" role="alert"></p><button class="button green">Save update →</button></form>`);
 $('#update-request-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{await api('/api/requests/'+r.id+'/status',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});closeModal();await loadRequests();toast('Request updated.');}catch(error){$('#update-request-error').textContent=error.message;}finally{button.disabled=false;}};
});
function propertyForm(property=null){
 if(!['agent','admin'].includes(currentUser?.role))return;
 openModal(`<p class="eyebrow">YOUR PROPERTY PORTFOLIO</p><h2>${property?'Edit property.':'Add a property.'}</h2><form id="property-form"><label>Property name<input name="name" required maxlength="100"></label><label>Neighborhood<input name="area" required maxlength="100"></label><label>Street address<input name="address" required maxlength="250"></label><div class="form-columns"><label>Monthly rent ($)<input name="price" type="number" min="0" max="1000000" step="0.01" required></label><label>Bedrooms<input name="beds" type="number" min="0" max="50" step="1" required></label><label>Bathrooms<input name="baths" type="number" min="0.5" max="50" step="0.5" required></label><label>Square feet<input name="size" type="number" min="1" max="1000000" step="1" required></label></div><label>Property type<select name="type"><option value="SINGLE-FAMILY HOME">Single-family home</option><option value="APARTMENT">Apartment</option><option value="CONDO">Condo</option><option value="TOWNHOUSE">Townhouse</option></select></label><label>Availability<select name="available"><option value="false">Unavailable — keep off dashboard</option><option value="true">Available — publish and accept applications</option></select></label><label>Illustrative photo<select name="image"><option value="1">House exterior</option><option value="2">Living space</option><option value="3">Home interior</option></select></label><p class="form-note">Available properties appear on the dashboard and public vacancies page with an application form. Photos are illustrations.</p><p id="property-error" role="alert"></p><button class="button green">Save property →</button></form>`);
 if(property)for(const key of ['name','area','address','price','beds','baths','size','type','image','available'])$('#property-form').elements[key].value=property[key];
 $('#property-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;const data=Object.fromEntries(new FormData(event.target));for(const key of ['price','beds','baths','size','image'])data[key]=Number(data[key]);data.available=data.available==='true';try{await api(property?'/api/properties/'+property.id+'/edit':'/api/properties',{method:'POST',body:JSON.stringify(data)});closeModal();$('#search').value='';$('#beds').value='all';go('homes');toast(property?'Property updated.':'Property added.');}catch(error){$('#property-error').textContent=error.message;}finally{button.disabled=false;}};
};
$('#add-property').onclick=()=>propertyForm();
$('#dashboard-add-property').onclick=()=>{go('homes');propertyForm();};
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4000);}
$('#today').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'}).format(new Date());$('#year').textContent=new Date().getFullYear();

let applications=[];
function renderDashboard(){
 const available=properties.filter(p=>!p.sample&&p.available);
 $('#featured').innerHTML=available.length?available.map(card).join(''):'<div class="empty-state dashboard-empty"><h3>No available homes right now.</h3><p>Check back for new vacancies.</p></div>';
 $('#available-count').textContent=available.length;
 $('#portfolio-count').textContent=properties.filter(p=>!p.sample).length;
 $('#maintenance-open').textContent=requests.filter(r=>['Submitted','In progress'].includes(r.status)).length;
 $('#applications-pending').textContent=applications.filter(a=>a.status!=='Closed').length;
 $('#notifications i').hidden=!requests.some(r=>['Submitted','In progress'].includes(r.status))&&!applications.some(a=>a.status!=='Closed')&&!conversations.some(c=>c.status==='Open');
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-set-availability]');if(!button)return;
 button.disabled=true;try{await api('/api/properties/'+button.dataset.setAvailability+'/availability',{method:'POST',body:JSON.stringify({available:button.dataset.available==='true'})});await loadHomes();toast('Property availability updated.');}catch(error){toast(error.message);}finally{button.disabled=false;}
});
async function loadApplications(){
 if(!['agent','admin'].includes(currentUser?.role))return;
 try{applications=(await api('/api/applications')).applications;renderApplications();renderDashboard();$('#applications-error').textContent='';}catch(error){$('#applications-error').textContent=error.message;}
}
function renderApplications(){
 const visible=applications.filter(a=>$('#application-status').value==='all'||a.status===$('#application-status').value);
 $('#applications-list').innerHTML=visible.length?visible.map(a=>`<article class="request-row"><p class="eyebrow">${escapeHTML(a.status.toUpperCase())} · ${a.property_available?'AVAILABLE PROPERTY':'UNAVAILABLE PROPERTY'}</p><h3>${escapeHTML(a.name)} · ${escapeHTML(a.property_name)}</h3><p>${escapeHTML(a.email)} · ${escapeHTML(a.phone)}</p><p>Preferred move-in: ${escapeHTML(a.move_in)} · Household: ${a.occupants}</p><p>${escapeHTML(a.message)}</p>${a.staff_note?`<div class="resident-update"><strong>Staff note</strong><p>${escapeHTML(a.staff_note)}</p></div>`:''}<div class="request-meta"><span>Submitted ${escapeHTML(new Date(a.created_at).toLocaleString())}</span><button class="text-link" data-review-application="${a.id}">Review application</button></div></article>`).join(''):'<div class="empty-state"><h3>No matching applications.</h3><p>Applications submitted through available property listings will appear here.</p></div>';
}
$('#application-status').onchange=renderApplications;
$('#refresh-applications').onclick=loadApplications;
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-review-application]');if(!button)return;
 const a=applications.find(a=>a.id===Number(button.dataset.reviewApplication));if(!a)return;
 openModal(`<p class="eyebrow">VACANCY APPLICATION</p><h2>${escapeHTML(a.name)}</h2><p>${escapeHTML(a.property_name)}</p><form id="review-application-form"><label>Status<select name="status">${['Submitted','Reviewing','Contacted','Closed'].map(status=>`<option${status===a.status?' selected':''}>${status}</option>`).join('')}</select></label><label>Staff note<textarea name="note" maxlength="2000">${escapeHTML(a.staff_note)}</textarea></label><p class="form-note">Status and notes are for staff tracking. This does not send email, create a tenant account, or reserve a property.</p><p id="review-application-error" role="alert"></p><button class="button green">Save review →</button></form>`);
 $('#review-application-form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;try{await api('/api/applications/'+a.id+'/status',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeModal();await loadApplications();toast('Application review updated.');}catch(error){$('#review-application-error').textContent=error.message;}finally{submit.disabled=false;}};
});
