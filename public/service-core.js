const servicePages={},serviceState={};
const servicePost=(path,data={})=>api(path,{method:'POST',body:JSON.stringify(data)});
const serviceEmpty=(title,body)=>`<div class="empty-state"><h3>${escapeHTML(title)}</h3><p>${escapeHTML(body)}</p></div>`;
const serviceDate=value=>window.portalFormatDate?window.portalFormatDate(value):new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const serviceToday=()=>new Date().toISOString().slice(0,10);
const serviceStaff=()=>['admin','agent'].includes(currentUser?.role);
function serviceVerifyCard(){return `<div class="notice-card service-callout"><p class="eyebrow">YOUR SECURE SPACE</p><h3>Confirm your identity to continue.</h3><p>Ask management to confirm your resident identity before booking viewings or signing a lease. Use your private receipt to claim an application.</p><button class="button green" data-service-go="account">Open My account →</button></div>`;}
function serviceRequireVerified(){if(currentUser.emailVerified||currentUser.identityConfirmed)return true;openModal(serviceVerifyCard());return false;}
function serviceModal(title,fields,submit,buttonLabel='Save changes'){
 openModal(`<p class="eyebrow">COME TOGETHER</p><h2>${escapeHTML(title)}</h2><form id="service-form">${fields}<p id="service-form-error" role="alert"></p><button class="button green" type="submit">${escapeHTML(buttonLabel)} →</button></form>`);
 const form=$('#service-form');form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await submit(Object.fromEntries(new FormData(form)),form);if(form.isConnected)closeModal();}catch(error){if(form.isConnected)$('#service-form-error').textContent=error.message;}finally{button.disabled=false;}};return form;
}
async function serviceFile(file,max=2097152){if(!file||!file.size||file.size>max)throw Error('Choose a file up to '+max/1048576+' MB.');return {name:file.name,mime:file.type,data:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read that file. Please select it again.'));reader.readAsDataURL(file);})};}
async function serviceProperties(available=false){const {properties}=await api('/api/properties');return properties.filter(p=>!p.isPreview&&!p.archived&&(!available||p.available));}
const serviceOptions=properties=>properties.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');
function serviceError(page,error){const target=document.querySelector('#'+page+' .service-error');if(target)target.textContent=error.message;else toast(error.message);}
async function loadServicePage(page){if(servicePages[page]){const error=document.querySelector('#'+page+' .service-error');if(error)error.textContent='';try{await servicePages[page]();}catch(e){serviceError(page,e);}}}
document.addEventListener('click',event=>{const button=event.target.closest('[data-service-go]');if(button){if(modal.open)closeModal();go(button.dataset.serviceGo);}});
window.loadServicePage=loadServicePage;

window.refreshPageSwitcher=page=>{const select=$('#page-switcher');if(!select)return;select.innerHTML=[...document.querySelectorAll('.sidebar .nav-item')].filter(button=>!button.hidden).map(button=>{const copy=button.cloneNode(true);copy.querySelectorAll('span,b').forEach(el=>el.remove());return `<option value="${button.dataset.page}">${escapeHTML(copy.textContent.trim())}</option>`;}).join('');select.value=page;select.onchange=()=>go(select.value);};
