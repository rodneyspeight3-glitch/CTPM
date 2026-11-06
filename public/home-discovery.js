/* Optional home-page search layer; /vacancies keeps its existing controls. */
(()=>{
 const {escape:e,money,read,write,remove,download,csv,print}=window.HomeTools;
 const $=id=>document.getElementById(id),panel=document.querySelector('.home-filter-panel');
 let properties=[],limit=12,unit='month';
 const ids=value=>Array.isArray(value)?[...new Set(value.filter(n=>Number.isSafeInteger(n)&&n>0))].slice(0,100):[];
 let saved=new Set(ids(read('saved',[]))),recent=ids(read('recent',[])).slice(0,5);
 panel.insertAdjacentHTML('beforeend',`<details class="home-advanced"><summary>Make it your kind of home <span>More filters & a quick match</span></summary><div class="home-form-grid">
 <label>Property type<select id="home-type"><option value="">Any type</option></select></label><label>Neighborhood<select id="home-area"><option value="">Any neighborhood</option></select></label>
 <label>Minimum bathrooms<select id="home-baths"><option value="">Any bathrooms</option><option value="1">1+</option><option value="1.5">1.5+</option><option value="2">2+</option><option value="3">3+</option></select></label>
 <label>Minimum space (sq ft)<input id="home-size" type="number" min="0" max="100000" placeholder="Any size"></label><label>Minimum monthly rent ($)<input id="home-min-rent" type="number" min="0" max="10000000" step="0.01" placeholder="No minimum"></label>
 <label class="home-check"><input id="home-photos" type="checkbox">Actual property photographs only</label></div><fieldset class="home-amenities"><legend>Must-have amenities <small>Homes must include every selection</small></legend><div id="home-amenities"></div></fieldset>
 <form id="home-match" class="home-match"><h3>Find your starting point ✦</h3><p>Three preferences. A search built around you.</p><div class="home-form-grid"><label>Bedrooms<select name="beds"><option value="">Any bedrooms</option><option value="0">Studio</option><option value="1">1 bedroom</option><option value="2">2 bedrooms</option><option value="3">3 bedrooms</option><option value="4">4 bedrooms</option></select></label><label>Monthly rent ceiling ($)<input name="budget" type="number" min="0" max="10000000" step="0.01"></label><label>Space to stretch (sq ft)<input name="size" type="number" min="0" max="100000"></label></div><button class="button green" type="submit">Build my search →</button><p id="home-match-note" role="status"></p></form></details>
 <div class="home-search-tools"><button id="home-share-search" type="button">Share search</button><button id="home-save-search" type="button">Remember search</button><button id="home-restore-search" type="button">Restore search</button><button id="home-forget-search" type="button">Forget search</button></div><label id="home-share-fallback" hidden>Search link<input readonly id="home-search-link"></label><p id="home-search-status" class="home-note" role="status"></p>`);
 $('vacancy-sort').insertAdjacentHTML('beforeend','<option value="size-high">Space: largest first</option><option value="baths-high">Bathrooms: most first</option>');
 $('vacancy-results').insertAdjacentHTML('beforebegin',`<div id="home-filter-chips" class="home-chips" aria-label="Active search filters"></div><div class="home-list-toolbar"><label class="home-check"><input id="home-saved-only" type="checkbox">My shortlist <span id="home-saved-count">0</span></label><div><label>Rent shown by<select id="home-rent-unit"><option value="month">Month</option><option value="year">Year</option><option value="week">Week (estimate)</option></select></label><button id="home-view-toggle" type="button" aria-pressed="false">Compact view</button></div></div><p id="home-updated" class="home-note"></p><p id="home-unit-note" class="home-note" hidden>Weekly rent is monthly rent × 12 ÷ 52. Annual rent is monthly rent × 12. Utilities, deposits and fees are excluded; confirm lease terms with management.</p>`);
 $('vacancy-list').insertAdjacentHTML('afterend',`<div class="home-load-more"><button class="button green" id="home-load-more" type="button" hidden>Show more homes</button><p id="home-page-count" class="home-note"></p></div><details class="home-shortlist"><summary>Your home shortlist <span id="home-shortlist-total">0 homes</span></summary><p class="home-note">Saved on this browser only, separate from your tenant account. No application has been submitted.</p><div id="home-shortlist-homes"></div><div class="home-search-tools"><button id="home-export-saved">Download shortlist</button><button id="home-print-saved">Print shortlist</button><button id="home-clean-saved">Remove unavailable saves</button><button id="home-clear-saved">Clear shortlist</button></div><p id="home-saved-status" role="status"></p></details><section id="home-recent" class="home-recent" hidden aria-labelledby="home-recent-title"><div><h3 id="home-recent-title">Worth another look</h3><button id="home-clear-recent" type="button">Clear recently viewed</button></div><div id="home-recent-homes"></div></section>`);
 const fields={'home-type':'type','home-area':'area','home-baths':'baths','home-size':'size','home-min-rent':'minRent','home-photos':'photos','home-saved-only':'savedOnly','vacancy-search':'q','vacancy-beds':'beds','vacancy-budget':'budget','vacancy-sort':'sort'};
 const changes=()=>{limit=12;window.renderVacancies?.();};
 const value=id=>$(id).type==='checkbox'?$(id).checked:$(id).value;
 const state=()=>({...Object.fromEntries(Object.entries(fields).map(([id,key])=>[key,value(id)])),amenities:[...document.querySelectorAll('[data-home-amenity]:checked')].map(el=>el.value),unit});
 let pending=new URLSearchParams(location.search);
 function applyState(data){
  if(!data||typeof data!=='object'||Array.isArray(data))return;
  for(const [id,key] of Object.entries(fields)){
   const el=$(id),v=data[key];if(v===undefined)continue;
   if(el.type==='checkbox')el.checked=v===true||v==='1';
   else if(typeof v==='string'&&v.length<=150){
    if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===v))el.value=v;}
    else if(el.type==='number'){if(v===''||(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=10000000))el.value=v;}
    else el.value=v;
   }
  }
  if(Array.isArray(data.amenities))for(const el of document.querySelectorAll('[data-home-amenity]'))el.checked=data.amenities.includes(el.value);
  if(['month','week','year'].includes(data.unit)){unit=data.unit;$('home-rent-unit').value=unit;}
  changes();
 }
 function refreshSaved(){
  $('home-saved-count').textContent=saved.size;$('home-shortlist-total').textContent=saved.size+' home'+(saved.size===1?'':'s');
  const active=properties.filter(p=>saved.has(p.id)),unavailable=saved.size-active.length;
  $('home-shortlist-homes').innerHTML=active.length?active.map(p=>`<div class="home-saved-row"><button type="button" data-details="${p.id}">${e(p.name)}</button><span>${money(p.price)} / month · ${e(p.area)}</span><button type="button" data-home-save="${p.id}" aria-label="Remove ${e(p.name)} from shortlist">Remove</button></div>`).join(''):'<p>Tap Save on a home to build your shortlist.</p>';
  if(unavailable)$('home-shortlist-homes').insertAdjacentHTML('beforeend',`<p>${unavailable} saved home${unavailable===1?' is':'s are'} no longer publicly available. Management can confirm current availability.</p>`);
  $('home-export-saved').disabled=$('home-print-saved').disabled=!active.length;$('home-clean-saved').disabled=!unavailable;
 }
 function refreshRecent(){
  const active=recent.map(id=>properties.find(p=>p.id===id)).filter(Boolean);$('home-recent').hidden=!recent.length;
  $('home-recent-homes').innerHTML=active.length?active.map(p=>`<button type="button" data-details="${p.id}"><span>${e(p.name)}</span><small>${money(p.price)} / month</small></button>`).join(''):'<p class="home-note">Previously viewed homes are not currently publicly available.</p>';
 }
 const persistSaved=()=>{const ok=write('saved',[...saved]);$('home-saved-status').textContent=ok?'Shortlist saved on this browser.':'Browser storage is unavailable. Your shortlist lasts until you leave this page.';};
 function chips(){
  const data=state(),labels={type:'Type',area:'Neighborhood',baths:'Minimum bathrooms',size:'Minimum sq ft',minRent:'Minimum rent',q:'Search',beds:'Bedrooms',budget:'Maximum rent',photos:'Actual photos',savedOnly:'Shortlist only'};
  const active=Object.entries(fields).filter(([,key])=>labels[key]&&data[key]!==''&&data[key]!==false&&!(key==='beds'&&data[key]==='all'));
  $('home-filter-chips').innerHTML=active.map(([id,key])=>`<button type="button" data-remove-filter="${id}" aria-label="Remove ${e(labels[key])} filter">${e(labels[key])}${data[key]===true?'':': '+e(data[key])} <span aria-hidden="true">×</span></button>`).join('')+data.amenities.map(a=>`<button type="button" data-remove-amenity="${e(a)}">${e(a)} <span aria-hidden="true">×</span></button>`).join('');
 }
 window.homeDiscovery={
  setProperties(list){
   properties=list;
   for(const [id,key,label] of [['home-type','type','Any type'],['home-area','area','Any neighborhood']]){
    const selected=$(id).value,options=[...new Set(properties.map(p=>p[key]))].sort();
    $(id).innerHTML=`<option value="">${label}</option>`+options.map(v=>`<option value="${e(v)}">${e(v)}</option>`).join('');if(options.includes(selected))$(id).value=selected;
   }
   const selected=new Set(state().amenities),amenities=[...new Set(properties.flatMap(p=>p.amenities||[]))].sort();
   $('home-amenities').innerHTML=amenities.length?amenities.map(a=>`<label class="home-check"><input type="checkbox" data-home-amenity value="${e(a)}"${selected.has(a)?' checked':''}>${e(a)}</label>`).join(''):'<p class="home-note">Amenity filters appear when available homes include amenity details.</p>';
   if(pending){const data=Object.fromEntries(pending);data.amenities=pending.getAll('amenity');pending=null;applyState(data);}
   $('home-updated').textContent='Availability checked '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+'. Refresh for the latest listings.';
   refreshSaved();refreshRecent();
  },
  filter(list){
   const s=state();let result=list.filter(p=>(!s.type||p.type===s.type)&&(!s.area||p.area===s.area)&&(!s.baths||p.baths>=Number(s.baths))&&(!s.size||p.size>=Number(s.size))&&(!s.minRent||p.price>=Number(s.minRent))&&(!s.photos||!!p.photoUpdated)&&(!s.savedOnly||saved.has(p.id))&&s.amenities.every(a=>(p.amenities||[]).includes(a)));
   if(s.sort==='size-high')result.sort((a,b)=>b.size-a.size);if(s.sort==='baths-high')result.sort((a,b)=>b.baths-a.baths);return result;
  },
  page:list=>list.slice(0,limit),
  rent:p=>money(unit==='year'?p.price*12:unit==='week'?p.price*12/52:p.price),
  rentUnit:()=>unit==='year'?'yr':unit==='week'?'wk*':'mo',
  saveButton:p=>`<button class="text-link" type="button" data-home-save="${p.id}" aria-pressed="${saved.has(p.id)}">${saved.has(p.id)?'♥ Saved':'♡ Save'}</button>`,
  afterRender(total){chips();$('home-load-more').hidden=total<=limit;$('home-page-count').textContent=total>12?'Showing '+Math.min(limit,total)+' of '+total+' matching homes':'';$('home-unit-note').hidden=unit==='month';},
  clear(){for(const id of ['home-type','home-area','home-baths','home-size','home-min-rent'])$(id).value='';$('home-photos').checked=$('home-saved-only').checked=false;document.querySelectorAll('[data-home-amenity]').forEach(el=>el.checked=false);limit=12;},
  viewed(id){recent=[id,...recent.filter(n=>n!==id)].slice(0,5);write('recent',recent);refreshRecent();}
 };
 for(const id of Object.keys(fields).filter(id=>id.startsWith('home-')))$(id).addEventListener(['home-size','home-min-rent'].includes(id)?'input':'change',changes);
 $('home-amenities').addEventListener('change',changes);
 document.addEventListener('click',event=>{
  const save=event.target.closest('[data-home-save]');if(save){const id=Number(save.dataset.homeSave);if(!properties.some(p=>p.id===id))return;if(saved.has(id))saved.delete(id);else if(saved.size<100)saved.add(id);else{$('home-saved-status').textContent='Keep up to 100 homes in this browser shortlist.';return;}persistSaved();refreshSaved();changes();document.querySelector(`[data-home-save="${id}"]`)?.focus({preventScroll:true});}
  const chip=event.target.closest('[data-remove-filter]');if(chip){const el=$(chip.dataset.removeFilter);if(el.type==='checkbox')el.checked=false;else el.value=el.id==='vacancy-beds'?'all':'';changes();$('vacancy-search').focus({preventScroll:true});}
  const amenity=event.target.closest('[data-remove-amenity]');if(amenity){for(const el of document.querySelectorAll('[data-home-amenity]'))if(el.value===amenity.dataset.removeAmenity)el.checked=false;changes();}
 });
 $('home-load-more').onclick=()=>{limit+=12;window.renderVacancies();};
 $('home-rent-unit').onchange=event=>{unit=event.target.value;changes();};
 $('home-view-toggle').onclick=event=>{const compact=$('vacancy-list').classList.toggle('home-compact');event.currentTarget.setAttribute('aria-pressed',String(compact));event.currentTarget.textContent=compact?'Card view':'Compact view';};
 $('home-save-search').onclick=()=>{$('home-search-status').textContent=write('search',state())?'Search remembered on this browser. Use Restore search whenever you return.':'This browser cannot remember searches.';};
 $('home-restore-search').onclick=()=>{const data=read('search',null);if(!data){$('home-search-status').textContent='Remember a search first.';return;}applyState(data);$('home-search-status').textContent='Your remembered search is restored.';};
 $('home-forget-search').onclick=()=>{remove('search');$('home-search-status').textContent='Remembered search removed.';};
 $('home-share-search').onclick=async()=>{
  const url=new URL('/',location.origin),s=state();url.hash='available';for(const [key,val] of Object.entries(s)){if(key==='savedOnly')continue;if(key==='amenities')for(const a of val)url.searchParams.append('amenity',a);else if(val!==''&&val!==false&&!(key==='beds'&&val==='all'))url.searchParams.set(key,val===true?'1':val);}
  try{await navigator.clipboard.writeText(url.href);$('home-search-status').textContent='Search link copied. Your browser shortlist is excluded.';}catch{$('home-share-fallback').hidden=false;$('home-search-link').value=url.href;$('home-search-link').focus();$('home-search-link').select();$('home-search-status').textContent='Copy the search link above.';}
 };
 $('home-clear-saved').onclick=()=>{saved.clear();persistSaved();refreshSaved();changes();};
 $('home-clean-saved').onclick=()=>{saved=new Set([...saved].filter(id=>properties.some(p=>p.id===id)));persistSaved();refreshSaved();changes();};
 $('home-export-saved').onclick=()=>download('my-home-shortlist.csv',csv([['Home','Address','Neighborhood','Monthly rent USD','Bedrooms','Bathrooms','Sq ft','Property link'],...properties.filter(p=>saved.has(p.id)).map(p=>[p.name,p.address,p.area,p.price,p.beds,p.baths,p.size,new URL('/vacancies?listing='+p.id,location.origin).href])]),'text/csv;charset=utf-8');
 $('home-print-saved').onclick=()=>print('My home shortlist',properties.filter(p=>saved.has(p.id)).map(p=>`${p.name} · ${p.address} · ${p.area} · ${money(p.price)} / month · ${p.beds} bedrooms · ${p.baths} bathrooms · ${p.size} sq ft`));
 $('home-clear-recent').onclick=()=>{recent=[];remove('recent');refreshRecent();};
 $('home-match').onsubmit=event=>{event.preventDefault();const requestedBeds=event.currentTarget.elements.beds.value;if(requestedBeds!==''&&![...$('vacancy-beds').options].some(o=>o.value===requestedBeds)){$('home-match-note').textContent='No current homes have that bedroom count. Choose another preference or try again later.';return;}window.homeDiscovery.clear();$('vacancy-search').value='';$('vacancy-beds').value='all';$('vacancy-sort').value='newest';$('vacancy-budget').value=event.currentTarget.elements.budget.value;$('home-size').value=event.currentTarget.elements.size.value;const beds=event.currentTarget.elements.beds.value;if([...$('vacancy-beds').options].some(o=>o.value===beds))$('vacancy-beds').value=beds;else if(beds!==''){$('home-match-note').textContent='No current homes have that bedroom count. Choose another preference or try again later.';return;}changes();$('home-match-note').textContent='Your preferences are applied to current available homes. Adjust any filter to keep exploring.';};
})();
