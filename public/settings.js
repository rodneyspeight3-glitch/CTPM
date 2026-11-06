let companySettings=null;
function fillSettings(settings){
 const form=$('#settings-form');
 for(const key of ['companyName','contactEmail','contactPhone','paymentLabel','paymentUrl','paymentAccountName','paymentBankName','paymentAccountDetails','paymentInstructions'])form.elements[key].value=settings[key];
 form.dataset.revision=settings.revision;
 $('#settings-updated').textContent=settings.updatedAt?'Last updated '+new Date(settings.updatedAt).toLocaleString():'No management details have been saved yet.';
}
async function loadSettings(fill=false){
 const form=$('#settings-form');if(fill)form.inert=true;
 try{const {settings}=await api('/api/settings');companySettings=settings;
 if(fill)fillSettings(settings);return settings;
 }finally{if(fill)form.inert=!form.dataset.revision;}
}
$('#reload-settings').onclick=async()=>{try{await loadSettings(true);$('#settings-error').textContent='';toast('Current settings loaded.');}catch(error){$('#settings-error').textContent=error.message;}};
$('#settings-form').onsubmit=async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button[type="submit"]');button.disabled=true;$('#settings-error').textContent='';
 const data=Object.fromEntries(new FormData(form));data.revision=Number(form.dataset.revision);
 try{const result=await api('/api/settings',{method:'POST',body:JSON.stringify(data)});companySettings=result.settings;fillSettings(companySettings);toast('Management details saved.');}
 catch(error){$('#settings-error').textContent=error.message;}finally{button.disabled=false;}
};
function contactDetails(settings){
 return `${settings.contactEmail?`<p><a class="text-link" href="mailto:${escapeHTML(settings.contactEmail)}">Email ${escapeHTML(settings.contactEmail)}</a></p>`:''}${settings.contactPhone?`<p><a class="text-link" href="tel:${escapeHTML(settings.contactPhone.replace(/[^+\d]/g,''))}">Call ${escapeHTML(settings.contactPhone)}</a></p>`:''}${!settings.contactEmail&&!settings.contactPhone?'<p>Management has not added contact details yet. Maintenance requests can still be submitted through Maintenance.</p>':''}`;
}
contact=async()=>{
 openModal('<h2>Contact management.</h2><p>Loading contact details…</p>');
 try{const settings=await loadSettings();if(!modal.open)return;$('#modal-content').innerHTML=`<p class="eyebrow">${escapeHTML(settings.companyName)}</p><h2>Let’s connect.</h2><div class="contact-details">${contactDetails(settings)}</div><p class="form-note">Email opens your email app. For immediate danger, call 911.</p>`;}
 catch(error){if(modal.open)$('#modal-content').innerHTML=`<h2>Contact management.</h2><p role="alert">${escapeHTML(error.message)}</p>`;}
};
$('#contact-main').onclick=contact;$('#contact-side').onclick=contact;
$('#payment').onclick=async()=>{
 openModal('<h2>Rent & payments.</h2><p>Loading payment details…</p>');
 try{const settings=await loadSettings();if(!modal.open)return;
 const hasPayment=settings.paymentUrl||settings.paymentInstructions||settings.paymentAccountName||settings.paymentBankName||settings.paymentAccountDetails;
 $('#modal-content').innerHTML=`<p class="eyebrow">${escapeHTML(settings.companyName)}</p><h2>${escapeHTML(settings.paymentLabel||'Rent & payments.')}</h2>${hasPayment?`${settings.paymentAccountName?`<p><strong>Account holder:</strong> ${escapeHTML(settings.paymentAccountName)}</p>`:''}${settings.paymentBankName?`<p><strong>Bank / provider:</strong> ${escapeHTML(settings.paymentBankName)}</p>`:''}${settings.paymentAccountDetails?`<div class="payment-instructions"><strong>Account / reference details</strong><p>${escapeHTML(settings.paymentAccountDetails)}</p></div>`:''}${settings.paymentInstructions?`<div class="payment-instructions"><strong>Payment instructions</strong><p>${escapeHTML(settings.paymentInstructions)}</p></div>`:''}${settings.paymentUrl?`<p><a class="button green" id="payment-portal" href="${escapeHTML(settings.paymentUrl)}" target="_blank" rel="noopener noreferrer">Open ${escapeHTML(new URL(settings.paymentUrl).hostname)} →</a></p>`:''}<p class="form-note">Follow your lease and verify changed payment instructions directly with management. Payment processing and receipts are handled by your provider.</p>`:'<p>Management has not added payment details yet. Contact your property manager for approved payment instructions.</p>'}${contactDetails(settings)}${settings.updatedAt?`<p class="form-note">Details updated ${escapeHTML(new Date(settings.updatedAt).toLocaleString())}</p>`:''}`;
 }catch(error){if(modal.open)$('#modal-content').innerHTML=`<h2>Rent & payments.</h2><p role="alert">${escapeHTML(error.message)}</p>`;}
};
$('#notifications').onclick=async()=>{
 await Promise.all([loadRequests(),loadApplications()]);
 const staff=['agent','admin'].includes(currentUser?.role),open=requests.filter(r=>['Submitted','In progress'].includes(r.status)).length;
 openModal(`<p class="eyebrow">YOUR LATEST ACTIVITY</p><h2>Community updates.</h2><p>${open} open maintenance request${open===1?'':'s'}${staff?' across the community':''}.</p>${staff?`<p>${applications.filter(a=>a.status!=='Closed').length} active vacancy applications.</p>`:''}<div class="notification-actions"><button class="button green" id="notification-maintenance">View maintenance →</button>${staff?'<button class="button green" id="notification-applications">View applications →</button>':''}</div>`);
 $('#notification-maintenance').onclick=()=>{closeModal();go('requests');};
 if($('#notification-applications'))$('#notification-applications').onclick=()=>{closeModal();go('applications');};
};
