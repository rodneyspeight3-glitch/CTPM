(()=>{
 const e=escapeHTML,state={q:'',status:'',kind:'',from:'',to:'',page:1,seq:0,detailSeq:0};
 const names={Sent:'Sent',Pending:'Queued',Failed:'Failed',Cancelled:'Cancelled',Expired:'Expired'};
 const page=document.createElement('section');page.id='email-history';page.className='page service-page';page.hidden=true;
 page.innerHTML='<div class="page-heading"><div><p class="eyebrow">A CLEARER PICTURE OF EVERY SEND</p><h1>Email history.</h1><p>Recipients, messages, and delivery results from your property portal.</p></div><button type="button" class="text-link" id="email-history-refresh">Refresh history</button></div><p class="email-history-note">Sent means the email server accepted the message. It does not confirm inbox delivery or that someone opened it.</p><p class="service-error" id="email-history-error" role="alert"></p><div id="email-history-body"></div>';
 document.getElementById('account').before(page);
 const nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.dataset.page='email-history';nav.dataset.staffOnly='';nav.hidden=true;nav.innerHTML='<span aria-hidden="true">✉</span> Email history';nav.onclick=()=>go('email-history');document.querySelector('.sidebar [data-page="messages"]').after(nav);
 const badge=status=>'<span class="email-history-badge" data-status="'+e(status)+'">'+e(names[status]||status)+'</span>';
 const when=value=>value?serviceDate(value):'Not sent';
 function bound(value,next=false){if(!value)return '';const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d+(next?1:0));return date.toISOString();}
 function query(){const q=new URLSearchParams({page:state.page,limit:25});for(const key of ['q','status','kind'])if(state[key])q.set(key,state[key]);if(state.from)q.set('since',bound(state.from));if(state.to)q.set('until',bound(state.to,true));return q;}
 async function load(){
  if(!serviceStaff())return;const seq=++state.seq,root=document.getElementById('email-history-body'),error=document.getElementById('email-history-error'),refresh=document.getElementById('email-history-refresh');error.textContent='';root.setAttribute('aria-busy','true');refresh.disabled=true;
  if(!root.children.length)root.innerHTML='<p role="status">Loading email history…</p>';
  try{const data=await api('/api/email-history?'+query());if(seq!==state.seq||page.hidden)return;state.page=data.page;draw(data);}
  catch(err){if(seq===state.seq&&!page.hidden){error.textContent=err.message;root.innerHTML='<p>Email history could not be loaded. Use Refresh history to try again.</p>';}}
  finally{if(seq===state.seq){root.removeAttribute('aria-busy');refresh.disabled=false;}}
 }
 function draw(data){
  const total=Object.values(data.counts).reduce((a,b)=>a+b,0),tiles=[['','All emails',total],['Sent','Sent',data.counts.Sent],['Pending','Queued',data.counts.Pending],['Failed','Failed',data.counts.Failed]],root=document.getElementById('email-history-body');
  root.innerHTML='<div class="email-history-metrics">'+tiles.map(([status,label,n])=>'<button type="button" data-email-status="'+status+'" aria-pressed="'+(state.status===status)+'"><span>'+label+'</span><strong>'+n+'</strong></button>').join('')+'</div>'+`
   <form id="email-history-filters" class="email-history-form">
    <label class="email-history-search">Search email history<input type="search" name="q" maxlength="160" placeholder="Recipient email or subject" value="${e(state.q)}"></label>
    <label>Delivery status<select name="status"><option value="">All statuses</option>${Object.entries(names).map(([value,label])=>`<option value="${value}" ${state.status===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <label>Email category<select name="kind"><option value="">All categories</option>${data.categories.map(c=>`<option value="${e(c.kind)}" ${state.kind===c.kind?'selected':''}>${e(c.label)}</option>`).join('')}</select></label>
    <label>Created from<input type="date" name="from" value="${e(state.from)}"></label><label>Created through<input type="date" name="to" value="${e(state.to)}"></label>
    <div class="email-history-filter-actions"><button class="button green" type="submit">Apply filters</button><button type="button" class="text-link" id="email-history-clear">Clear filters</button></div>
   </form>
   <p id="email-history-results" class="results-caption" role="status">${data.total?'Showing '+((data.page-1)*data.limit+1)+'–'+Math.min(data.page*data.limit,data.total)+' of '+data.total+' emails. Newest first.':'No emails match these filters.'}</p>
   <div class="email-history-list">${data.messages.length?data.messages.map(m=>`<article class="email-history-row"><div class="email-history-copy"><p class="email-history-category">${e(m.category)}</p><h3>${e(m.subject)}</h3><p>To: <span>${e(m.recipient)}</span></p>${m.errorMessage?`<p class="email-history-failure">${e(m.errorMessage)}</p>`:''}</div><div class="email-history-meta">${badge(m.status)}<p>${m.sentAt?'Sent':'Created'}<time datetime="${e(m.sentAt||m.createdAt)}">${e(when(m.sentAt||m.createdAt))}</time></p></div><button type="button" class="text-link" data-email-details="${m.id}" aria-label="View email details for ${e(m.recipient)}: ${e(m.subject)}">View details →</button></article>`).join(''):serviceEmpty('A clear inbox view.','Emails recorded by this app appear here. Try another search or clear your filters.')}</div>
   <div class="email-history-pagination"><button type="button" class="button cream" id="email-history-previous" ${data.page===1?'disabled':''}>← Previous</button><p>Page ${data.page} of ${data.pages}</p><button type="button" class="button cream" id="email-history-next" ${data.page===data.pages?'disabled':''}>Next →</button></div>
   <p class="email-history-note">Times follow your display preferences. Date filters use your device’s local calendar. Sent and cancelled records are kept for ${data.retentionDays} days. Emails sent outside this app are not included.</p>`;
  const form=document.getElementById('email-history-filters');form.onsubmit=event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));if(values.from&&values.to&&values.from>values.to){document.getElementById('email-history-error').textContent='Choose an end date on or after the start date.';return;}Object.assign(state,values,{page:1});load();};
  document.getElementById('email-history-clear').onclick=()=>{Object.assign(state,{q:'',status:'',kind:'',from:'',to:'',page:1});load();};
  root.querySelectorAll('[data-email-status]').forEach(button=>button.onclick=()=>{state.status=button.dataset.emailStatus;state.page=1;load();});
  const turn=async step=>{state.page+=step;await load();if(!page.hidden)document.getElementById('email-history-results')?.scrollIntoView({block:'start'});};
  document.getElementById('email-history-previous').onclick=()=>turn(-1);document.getElementById('email-history-next').onclick=()=>turn(1);
  root.querySelectorAll('[data-email-details]').forEach(button=>button.onclick=()=>details(button));
 }
 async function details(button){
  const seq=++state.detailSeq;button.disabled=true;
  try{const {message:m}=await api('/api/email-history/'+button.dataset.emailDetails);if(seq!==state.detailSeq||page.hidden||!button.isConnected)return;
   const preview=m.previewStatus==='available'?'<pre class="email-history-preview">'+e(m.preview)+'</pre><p class="form-note">Links and private references are omitted from this preview.</p>':m.previewStatus==='restricted'?'<p class="email-history-note">Account verification and password recovery emails show delivery details only. Their message content and private links are not available here.</p>':'<p class="email-history-note">A message preview was not retained for this email. Its delivery details are available above.</p>';
   openModal('<div class="email-history-detail"><p class="eyebrow">EMAIL RECORD #'+m.id+'</p><h2>'+e(m.subject)+'</h2>'+badge(m.status)+'<dl class="application-facts">'+[['Recipient',m.recipient],['Category',m.category],['Created',when(m.createdAt)],['Sent',when(m.sentAt)],['Send attempts',m.attempts],...(m.status==='Pending'?[['Available to send',when(m.availableAt)]]:[]),...(m.expiresAt?[['Send window ends',when(m.expiresAt)]]:[])].map(([label,value])=>'<div><dt>'+e(label)+'</dt><dd>'+e(value)+'</dd></div>').join('')+'</dl>'+(m.errorMessage?'<p class="email-history-note">'+e(m.errorMessage)+' <code>'+e(m.error)+'</code></p>':'')+'<h3>Message preview</h3>'+preview+'<p class="form-note">Sent records show server acceptance. Inbox placement and read status are not tracked.</p></div>');
  }catch(err){if(!page.hidden)document.getElementById('email-history-error').textContent=err.message;}finally{button.disabled=false;}
 }
 document.getElementById('email-history-refresh').onclick=load;servicePages['email-history']=load;
})();
