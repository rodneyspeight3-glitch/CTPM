(()=>{
 window.celebratePortal=()=>{
  const root=document.documentElement;if(root.dataset.motion==='reduced'||root.dataset.quiet==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.querySelector('.portal-moment')?.remove();const moment=document.createElement('div');moment.className='portal-moment';moment.setAttribute('aria-hidden','true');for(let i=0;i<9;i++){const spark=document.createElement('span');spark.className='moment-spark moment-spark-'+i;moment.append(spark);}document.body.append(moment);setTimeout(()=>moment.remove(),1100);
 };
 window.addEventListener('appearance:changed',()=>{if(document.documentElement.dataset.motion==='reduced'||document.documentElement.dataset.quiet==='true')document.querySelector('.portal-moment')?.remove();});
})();
