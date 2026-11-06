(()=>{
 const portalPages=['saved','overview','homes','requests','leases','ledger','messages','documents','applications','team','settings','account','my-applications','tours','signatures','searches','contractors','reports','agent-profiles','integrations'];
 if(portalPages.includes(location.hash.slice(1))){location.replace('/dashboard'+location.hash);return;}
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const price=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
 (async()=>{const grid=document.querySelector('#home-showcase-properties');try{const response=await fetch('/api/showcase');if(!response.ok)throw Error();const {properties}=await response.json();if(!properties.length){grid.closest('section').hidden=true;return;}
  grid.innerHTML=properties.map(p=>`<article class="property-card"><div class="property-image"><img src="${p.photoUpdated?'/property-photos/'+p.id+'?v='+encodeURIComponent(p.photoUpdated):'/images/home-'+p.image+'.jpg'}" alt="${p.photoUpdated?'Showcase photograph':'Illustrative photograph'} of ${escape(p.name)}" loading="lazy"><span class="property-badge">SHOWCASE · ${escape(p.type)}</span></div><div class="property-body"><div class="property-top"><h3>${escape(p.name)}</h3><strong>${price(p.price)}<small> / mo*</small></strong></div><p class="location">${escape(p.area)}</p><p class="listing-description">${escape(p.description||'')}</p><div class="amenity-tags">${(p.amenities||[]).map(a=>`<span>${escape(a)}</span>`).join('')}</div><div class="property-footer"><span>${p.beds===0?'Studio':p.beds+' beds'}</span><span>${p.baths} baths</span><span>${escape(p.size)} sq ft</span></div><p class="showcase-note">Showcase home. Details and availability are not confirmed; not accepting applications.</p></div></article>`).join('');
 }catch{grid.innerHTML='<p>The home collection is temporarily unavailable. Please try again later.</p>';}})();
 window.addEventListener('vacancies:loaded',event=>{document.querySelector('#available-total').textContent=event.detail.count;});
 window.addEventListener('company:loaded',event=>{
  const company=event.detail;document.querySelectorAll('[data-company-name]').forEach(el=>el.textContent=company.companyName);
  const panel=document.querySelector('#home-contact-details');if(!company.contactEmail&&!company.contactPhone)return;
  panel.replaceChildren();for(const [label,href] of [[company.contactEmail,company.contactEmail?'mailto:'+company.contactEmail:''],[company.contactPhone,company.contactPhone?'tel:'+company.contactPhone.replace(/[^+\d]/g,''):'']]){if(!label)continue;const p=document.createElement('p'),a=document.createElement('a');a.textContent=label;a.href=href;p.append(a);panel.append(p);}
 });
})();
