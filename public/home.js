(()=>{
 // Keep previously shared portal bookmarks working after the public home page launch.
 const portalPages=['saved','overview','homes','requests','leases','ledger','messages','documents','applications','team','settings','account'];
 if(portalPages.includes(location.hash.slice(1))){location.replace('/dashboard'+location.hash);return;}
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const price=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
 document.querySelector('#home-sample-properties').innerHTML=window.CTPM_SAMPLE_PROPERTIES.map(p=>`<article class="property-card"><div class="property-image"><img src="/images/home-${p.image}.jpg" alt="Illustrative photograph for sample ${escape(p.name)}" loading="lazy"><span class="property-badge">SAMPLE · ${escape(p.type)}</span></div><div class="property-body"><div class="property-top"><h3>${escape(p.name)}</h3><strong>${price(p.price)}<small> / mo*</small></strong></div><p class="location">${escape(p.area)}</p><div class="property-footer"><span>${p.beds===0?'Studio':p.beds+' beds'}</span><span>${p.baths} baths</span><span>${escape(p.size)} sq ft</span></div><p class="sample-note">*Illustrative price. Fictional property, not available for applications.</p></div></article>`).join('');
 window.addEventListener('vacancies:loaded',event=>{document.querySelector('#available-total').textContent=event.detail.count;});
 window.addEventListener('company:loaded',event=>{
  const company=event.detail;document.querySelectorAll('[data-company-name]').forEach(el=>el.textContent=company.companyName);
  const panel=document.querySelector('#home-contact-details');if(!company.contactEmail&&!company.contactPhone)return;
  panel.replaceChildren();for(const [label,href] of [[company.contactEmail,company.contactEmail?'mailto:'+company.contactEmail:''],[company.contactPhone,company.contactPhone?'tel:'+company.contactPhone.replace(/[^+\d]/g,''):'']]){if(!label)continue;const p=document.createElement('p'),a=document.createElement('a');a.textContent=label;a.href=href;p.append(a);panel.append(p);}
 });
})();
