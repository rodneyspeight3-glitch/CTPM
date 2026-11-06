let currentUser;
async function api(url,options={}){
 const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 const result=await response.json();
 if(response.status===401){window.location.replace('/login');throw new Error('Please sign in again.');}
 if(!response.ok)throw new Error(result.error||'Unable to complete request.');
 return result;
}
window.loadTeam=async()=>{try{const {users}=await api('/api/admin/users');$('#team-list').innerHTML=users.map(user=>`<article class="request-row"><h3>${escapeHTML(user.name)}</h3><p>${escapeHTML(user.email)}</p><div class="request-meta"><span>${escapeHTML(user.role.toUpperCase())} · ${user.active?'Active':'Disabled'}</span><button class="text-link" data-edit-account="${user.id}">Edit account</button></div></article>`).join('');$('#team-error').textContent='';}catch(error){$('#team-error').textContent=error.message;}};
function showCreateAccount(role='tenant'){
 openModal('<p class="eyebrow">ADMINISTRATOR ACCESS</p><h2>Bring your people together.</h2><form id="create-user-form"><label>Full name<input name="name" required maxlength="100" autocomplete="name"></label><label>Email address<input name="email" type="email" required maxlength="254" autocomplete="off"></label><label>Account type<select name="role"><option value="tenant">Tenant</option><option value="agent">Agent</option><option value="admin">Admin</option></select></label><label>Initial password<input name="password" type="password" required minlength="16" maxlength="128" autocomplete="new-password"></label><p class="form-note">Use at least 16 characters. Share these credentials securely; no email is sent.</p><p id="create-user-error" role="alert"></p><button class="button green">Create account →</button></form>');
 $('#create-user-form').elements.role.value=role;
 $('#create-user-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{await api('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});closeModal();await window.loadTeam();toast('Account created. Share credentials securely.');}catch(error){$('#create-user-error').textContent=error.message;}finally{button.disabled=false;}};
};
$('#create-account').onclick=()=>showCreateAccount();
$('#create-agent').onclick=()=>showCreateAccount('agent');
const signOut=async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});window.location.replace('/login');}catch(error){toast(error.message);}};
$('#logout').onclick=signOut;$('#logout-side').onclick=signOut;
$('#password-form').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.target));if(data.newPassword!==data.confirmation){$('#password-error').textContent='New passwords do not match.';return;}const button=event.target.querySelector('button');button.disabled=true;try{await api('/api/password',{method:'POST',body:JSON.stringify(data)});window.location.replace('/login');}catch(error){$('#password-error').textContent=error.message;}finally{button.disabled=false;}};
(async()=>{try{
 const {user}=await api('/api/session');currentUser=user;
 $('#add-property').hidden=user.role==='tenant';
 $('#applications-nav').hidden=user.role==='tenant';
 $('#settings-nav').hidden=user.role==='tenant';
 document.querySelectorAll('[data-staff-only]').forEach(el=>el.hidden=user.role==='tenant');
 for(const id of ['#new-request','#notice-request','#request-page-button'])$(id).hidden=user.role!=='tenant';
 if(user.role!=='tenant')$('#requests .page-heading p:not(.eyebrow)').textContent='Track tenant requests and share updates with residents.';
 $('#account-name').textContent=user.name;$('#account-role').textContent=user.role[0].toUpperCase()+user.role.slice(1)+' account';
 $('#account-detail').textContent=user.email+' · '+user.role;
 document.querySelectorAll('.avatar').forEach(el=>el.textContent=user.name[0].toUpperCase());
 $('#team-nav').hidden=user.role!=='admin';
 if(user.role!=='tenant'){
  $('.workspace-label').textContent='YOUR MANAGEMENT SPACE';$('#portal-title').textContent=user.role==='admin'?'Admin portal':'Agent portal';
  $('.page-heading .eyebrow').textContent='YOUR MANAGEMENT WORKSPACE';
  $('#overview h1').textContent='Welcome back, '+user.name.split(' ')[0]+'.';
  $('#overview .page-heading p:not(.eyebrow)').textContent=user.role==='admin'?'Bring your team and residents together. Manage account access and explore your property portfolio.':'Your property portfolio and resident resources, together in one workspace.';
  $('#new-request').hidden=true;
 }
 await Promise.all([loadHomes(),loadRequests(),loadApplications(),loadSettings(true),loadOperations()]);
 go(location.hash.slice(1)||'overview',false);
}catch(error){toast(error.message);}})();
