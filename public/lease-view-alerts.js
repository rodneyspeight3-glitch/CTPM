(()=>{
 const panel=document.createElement('section');panel.id='lease-view-alerts';panel.className='notice-card lease-view-alerts';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');$('.main-shell>main').prepend(panel);
 let last='',refreshing=false;
 window.renderLeaseViewAlerts=notifications=>{
  if(!serviceStaff()){panel.hidden=true;panel.replaceChildren();last='';return;}
  const unread=notifications.filter(n=>n.kind==='lease-view'&&!n.read_at),key=JSON.stringify(unread);
  if(key===last)return;last=key;panel.hidden=!unread.length;
  if(!unread.length){panel.replaceChildren();return;}
  panel.innerHTML=`<p class="eyebrow">PRIVATE LEASE ACTIVITY</p><h2>${unread.length===1?'A lease invitation was opened':unread.length+' lease invitations were opened'}</h2><p class="form-note">First opens of private invitations. Opening a link does not confirm the agreement was read or signed.</p>${unread.slice(0,5).map(n=>`<article class="notification-row unread lease-view-alert-row"><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.body)}</p><time datetime="${escapeHTML(n.created_at)}">${escapeHTML(serviceDate(n.created_at))}</time><div class="lease-view-alert-actions"><button class="text-link" data-open-notification="${n.id}" data-notification-link="${escapeHTML(n.link)}">Review lease →</button><button class="text-link" data-read-notification="${n.id}">Mark read</button></div></article>`).join('')}${unread.length>5?'<p class="form-note">More opened invitations are in your notification bell.</p>':''}`;
 };
 async function refresh(){if(refreshing||document.hidden||!serviceStaff())return;refreshing=true;try{await refreshServiceNotifications();}catch{}finally{refreshing=false;}}
 setInterval(refresh,10000);
 window.addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',refresh);
 const overview=servicePages.overview;
 servicePages.overview=async()=>{if(overview)await overview();await refresh();};
 refresh();
})();
