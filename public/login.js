(()=>{
 const content=document.querySelector('#auth-content'),tabs=[document.querySelector('#signin-tab'),document.querySelector('#signup-tab')];
 let submitting=false;
 function destination(){try{const url=new URL(new URLSearchParams(location.search).get('next')||'/dashboard',location.origin);if(url.origin===location.origin&&url.pathname==='/dashboard'){const pages=['overview','homes','saved','requests','leases','ledger','messages','documents','applications','team','settings','account','my-applications','tours','signatures','searches','contractors','reports','agent-profiles','integrations'];const hash=url.hash||(pages.includes(location.hash.slice(1))?location.hash:'');return url.pathname+url.search+hash;}}catch{}return '/dashboard';}
 function render(mode,update=true){
  mode=mode==='signup'?'signup':'signin';const email=content.querySelector('[name="email"]')?.value||'';
  content.replaceChildren(document.querySelector('#'+mode+'-template').content.cloneNode(true));content.classList.toggle('signup-content',mode==='signup');content.setAttribute('aria-labelledby',mode+'-tab');
  tabs.forEach((tab,index)=>{const selected=index===(mode==='signup'?1:0);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  document.title=(mode==='signup'?'Create tenant account':'Sign in')+' | Come Together';
  if(update){const url=new URL(location.href);if(mode==='signup')url.searchParams.set('mode','signup');else url.searchParams.delete('mode');history.replaceState(null,'','/login'+url.search);}
  const form=content.querySelector('form');form.elements.email.value=email;
  content.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>render(button.dataset.authMode));
  const toggle=document.querySelector(mode==='signup'?'#toggle-signup-password':'#toggle-password');toggle.onclick=event=>{const show=form.elements.password.type==='password';for(const name of mode==='signup'?['password','confirmation']:['password'])form.elements[name].type=show?'text':'password';event.currentTarget.textContent=show?'Hide':'Show';event.currentTarget.setAttribute('aria-pressed',String(show));event.currentTarget.setAttribute('aria-label',(show?'Hide':'Show')+(mode==='signup'?' passwords':' password'));};
  if(mode==='signin')document.querySelector('#help-toggle').onclick=event=>{const help=document.querySelector('#login-help');help.hidden=!help.hidden;event.currentTarget.setAttribute('aria-expanded',String(!help.hidden));};
  form.onsubmit=async event=>{
   event.preventDefault();if(submitting)return;const signup=mode==='signup',error=content.querySelector(signup?'#signup-error':'#login-error'),button=form.querySelector('button[type="submit"]');error.textContent='';
   const data=Object.fromEntries(new FormData(form));if(signup){data.consent=form.elements.consent.checked;if(data.password!==data.confirmation){error.textContent='Passwords do not match.';return;}}
   submitting=true;tabs.forEach(tab=>tab.disabled=true);content.querySelectorAll('[data-auth-mode]').forEach(control=>control.disabled=true);button.disabled=true;button.textContent=signup?'Creating your account…':'Signing in…';
   try{const response=await fetch(signup?'/api/signup':'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to complete your request.');window.location.assign(signup?'/dashboard':destination());}
   catch(err){if(form.isConnected)error.textContent=err instanceof TypeError?'Connection interrupted. Please try again.':err.message;}
   finally{submitting=false;tabs.forEach(tab=>tab.disabled=false);content.querySelectorAll('[data-auth-mode]').forEach(control=>control.disabled=false);button.disabled=false;button.textContent=signup?'Create tenant account →':'Sign in →';}
  };
 }
 tabs.forEach((tab,index)=>{tab.onclick=()=>render(index?'signup':'signin');tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?1:1-index;render(target?'signup':'signin');tabs[target].focus();};});
 window.addEventListener('popstate',()=>render(new URLSearchParams(location.search).get('mode'),false));
 document.querySelector('#login-year').textContent=new Date().getFullYear();render(new URLSearchParams(location.search).get('mode'),false);
})();
