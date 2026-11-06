const form=document.querySelector('#login-form');
const button=document.querySelector('#sign-in');
const error=document.querySelector('#login-error');
document.querySelector('#login-year').textContent=new Date().getFullYear();
document.querySelector('#toggle-password').onclick=e=>{const input=form.elements.password;const show=input.type==='password';input.type=show?'text':'password';e.currentTarget.textContent=show?'Hide':'Show';e.currentTarget.setAttribute('aria-label',show?'Hide password':'Show password');e.currentTarget.setAttribute('aria-pressed',String(show));};
document.querySelector('#help-toggle').onclick=e=>{const help=document.querySelector('#login-help');help.hidden=!help.hidden;e.currentTarget.setAttribute('aria-expanded',String(!help.hidden));};
form.onsubmit=async event=>{
 event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Signing in…';
 try{
  const data=Object.fromEntries(new FormData(form));
  const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Unable to sign in. Please try again.');
  let target='/dashboard';try{const next=new URL(new URLSearchParams(location.search).get('next')||'/dashboard',location.origin);if(next.origin===location.origin&&next.pathname==='/dashboard')target=next.pathname+next.search+next.hash;}catch{}
  window.location.assign(target);
 }catch(err){error.textContent=err instanceof TypeError?'Connection interrupted. Please try again.':err.message;}
 finally{button.disabled=false;button.innerHTML='Sign in <span>→</span>';}
};
