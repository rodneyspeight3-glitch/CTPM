/* Browser-only planning helpers. No personal application answers or documents are saved. */
(()=>{
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('ctpm-home-'+key))??fallback;}catch{return fallback;}};
 const write=(key,value)=>{try{localStorage.setItem('ctpm-home-'+key,JSON.stringify(value));return true;}catch{return false;}};
 const remove=key=>{try{localStorage.removeItem('ctpm-home-'+key);}catch{}};
 const download=(name,content,type)=>{const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 // Neutralize spreadsheet formulas as well as quoting commas, quotes and newlines.
 const csv=rows=>rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^(?:\s*[=+@-]|[\t\r\n])/u,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const print=(title,lines)=>{
  document.querySelector('#home-print-sheet')?.remove();
  const sheet=document.createElement('section');sheet.id='home-print-sheet';
  const heading=document.createElement('h1');heading.textContent=title;sheet.append(heading);
  for(const line of lines){const p=document.createElement('p');p.textContent=line;sheet.append(p);}
  document.body.append(sheet);document.body.classList.add('home-printing');
  const clean=()=>{document.body.classList.remove('home-printing');sheet.remove();};
  window.addEventListener('afterprint',clean,{once:true});try{window.print();}finally{setTimeout(clean,1000);}
 };
 window.HomeTools={escape,money,read,write,remove,download,csv,print};
})();
