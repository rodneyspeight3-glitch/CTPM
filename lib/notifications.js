const {randomUUID}=require('node:crypto');
const {createMailer,mailError}=require('./mailer');
const {automatedSenderName,automatedHeaders,automatedText,automatedFrom}=require('./email-format');
const {leaseReminderAudience,leaseReminderAllowed}=require('./lease-reminders');
const {createLeaseGreetings}=require('./lease-greetings');
const {createEmailHistory,emailPreview}=require('./email-history');
const {createEmailCampaigns}=require('./email-campaigns');
const {createEmailWriting}=require('./email-writing');
const {createAiTools}=require('./ai-tools');
const {stamp,today,publicOrigin,id,admin,fail,transaction,installationId,migrate,rateLimit,digest}=require('./service-utils');
function createNotifications(db,{sendMail,mailer=createMailer()}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL,event_key TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,event_key));
 CREATE TABLE IF NOT EXISTS email_outbox(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,created_at TEXT NOT NULL,sent_at TEXT,provider_id TEXT,event_key TEXT NOT NULL UNIQUE);`);
 migrate(db,'email_outbox','expires_at','INTEGER');
 migrate(db,'email_outbox','application_id','INTEGER REFERENCES applications(id)');
 migrate(db,'email_outbox','status_snapshot',"TEXT NOT NULL DEFAULT ''");
 migrate(db,'email_outbox','last_error',"TEXT NOT NULL DEFAULT ''");
 migrate(db,'email_outbox','unsubscribe_url',"TEXT NOT NULL DEFAULT ''");
 db.exec('CREATE INDEX IF NOT EXISTS email_outbox_sent_at ON email_outbox(status,sent_at)');
 const history=createEmailHistory(db);
 const instance=installationId(db);
 const dailyLimit=()=>mailer.status().host==='smtp.gmail.com'?400:null;
 const sentLastDay=()=>db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Sent' AND sent_at>=?").get(new Date(Date.now()-86400000).toISOString()).n;
 const smtpSelected=()=>mailer.status().source==='dashboard'||process.env.SMTP_ENABLED==='true';
 const smtpEnabled=()=>mailer.status().source==='dashboard'?mailer.status().enabled:process.env.SMTP_ENABLED==='true';
 const configured=()=>process.env.EMAIL_DELIVERY_DISABLED!=='true'&&(!!sendMail||(smtpSelected()?mailer.configured()&&!!publicOrigin():!!(process.env.ALLOW_PAID_INTEGRATIONS==='true'&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&publicOrigin())));
 function enqueue({userId=null,to,subject,body,kind='transactional',key,expiresAt=null,applicationId=null,unsubscribeUrl='',statusSnapshot='',availableAt=Date.now()}){db.prepare('INSERT INTO email_outbox(user_id,recipient,subject,body,kind,available_at,created_at,event_key,expires_at,application_id,unsubscribe_url,status_snapshot,history_preview) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING').run(userId,to,subject,body,kind,availableAt,stamp(),key||randomUUID(),expiresAt,applicationId,unsubscribeUrl,statusSnapshot,emailPreview(kind,body));}
 const leaseGreetings=createLeaseGreetings(db,{enqueue,emailCapability});
 const campaigns=createEmailCampaigns(db,{enqueue,emailCapability,sender:()=>({...mailer.status(),from:mailer.sender?.()||''})}),writing=createEmailWriting(db),aiTools=createAiTools(db);
 function notify(userId,{kind,title,body='Open your dashboard for details.',link='/dashboard',key,emailDelivery=true}){
  const user=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(userId);if(!user)return;
  const inserted=db.prepare('INSERT INTO notifications(user_id,kind,title,body,link,event_key,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING').run(userId,kind,title,body,link,key,stamp());
  if(inserted.changes&&emailDelivery&&user.email_verified_at&&user.email_notifications&&configured())enqueue({userId,to:user.email,subject:title,body:body+'\n\n'+publicOrigin()+link,kind:'notification',key:'notice:'+userId+':'+key});
 }
 let draining=false,blockedUntil=0,verifying=false,lastFailure='',settingsGeneration=0;
 function emailCapability(){
  if(process.env.EMAIL_DELIVERY_DISABLED==='true')return {available:false,code:'DELIVERY_LOCKED',message:'Automatic email is disabled by the hosting administrator for this environment. Private links and email drafts are available.'};
  if(!publicOrigin())return {available:false,code:'PUBLIC_URL_MISSING',message:'The portal address needs to be configured before automatic email can be sent.'};
  if(!configured()){
   if(smtpSelected()){const c=mailer.status();if(c.source==='dashboard'&&!c.enabled&&!c.storageProblem)return {available:false,code:'AUTOMATIC_EMAIL_OFF',message:'Automatic email is paused in Admin Built-in services. Private links and email drafts are available.'};return {available:false,code:c.problem?'SENDER_SETTINGS_INVALID':'SENDER_SETUP_NEEDED',message:c.problem||'Automatic email setup is incomplete. A private link and your email app are available now.'};}
   return {available:false,code:'AUTOMATIC_EMAIL_OFF',message:'Automatic email can be connected later. Share the private link or open a draft in your email app.'};
  }
  if(verifying)return {available:false,code:'CHECKING_SENDER',message:'Checking the automatic email connection. You can share the private link now.'};
  if(blockedUntil>Date.now())return {available:false,code:lastFailure||'DELIVERY_PAUSED',message:'Automatic email needs a connection check. Share a private link or use your email app while the sender is checked.'};
  return {available:true,code:'READY',message:'The sender is configured. A confirmed invitation will be queued; delivery is shown separately.'};
 }
 function applicationEmailAllowed(row,application){
  if(!row.application_id)return true;if(!application||application.email!==row.recipient)return false;
  if(row.kind==='applicant-lease'){
   if(application.status!=='Approved'||!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='applicant_lease_offers'").get())return false;
   return !!db.prepare("SELECT o.id FROM applicant_lease_offers o JOIN users u ON u.id=o.email_authorized_by WHERE o.email_key=? AND o.application_id=? AND o.email_authorized_at IS NOT NULL AND u.active=1 AND u.role IN ('admin','agent') AND o.status IN ('Pending','Signed') AND o.revoked_at IS NULL AND o.expires_at>? AND json_extract(o.values_json,'$.tenantEmail')=? COLLATE NOCASE").get(row.event_key,row.application_id,Date.now(),row.recipient);
  }
  return !!application.email_updates&&(row.kind!=='application-progress'||row.status_snapshot===application.status);
 }
 async function drain(){if(draining||verifying||!configured()||Date.now()<blockedUntil)return;draining=true;try{
  for(const row of db.prepare("SELECT * FROM email_outbox WHERE status='Pending' AND available_at<=? ORDER BY id LIMIT 10").all(Date.now())){
   if(!configured()||verifying||Date.now()<blockedUntil)break;
   if(smtpEnabled()){const minute=db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Sent' AND sent_at>=?").get(new Date(Date.now()-60000).toISOString()).n,cap=dailyLimit();if(minute>=10||(cap&&sentLastDay()>=cap))break;}
   const application=row.application_id?db.prepare('SELECT email,email_updates,status FROM applications WHERE id=?').get(row.application_id):null;
   const user=row.user_id?db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id):null;
   if((row.kind==='staff-message'&&!campaigns.allowed(row))||(row.kind==='lease-thanksgiving'&&!leaseGreetings.allowed(row))||(row.kind==='lease-signing-reminder'&&!leaseReminderAllowed(db,row))||(!applicationEmailAllowed(row,application))||(row.expires_at&&row.expires_at<=Date.now())||(row.user_id&&(!user?.active||user.email!==row.recipient||(row.kind==='notification'&&(!user.email_verified_at||!user.email_notifications))))){db.prepare("UPDATE email_outbox SET status='Cancelled',body='',unsubscribe_url='' WHERE id=?").run(row.id);continue;}
   const generation=settingsGeneration;try{const text=automatedText(row.body);let result;if(sendMail)result=await sendMail({to:row.recipient,subject:row.subject,text,headers:automatedHeaders,key:row.event_key,unsubscribeUrl:row.unsubscribe_url});else if(smtpSelected())result=await mailer.send({to:row.recipient,subject:row.subject,text,key:'ctpm-'+instance+'-'+row.id,unsubscribeUrl:row.unsubscribe_url});else{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ctpm-'+instance+'-'+row.id},body:JSON.stringify({from:automatedFrom(process.env.EMAIL_FROM),to:[row.recipient],subject:row.subject,text,headers:{...automatedHeaders,...(row.unsubscribe_url?{'List-Unsubscribe':'<'+row.unsubscribe_url+'>'}:{})}}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Email provider did not accept delivery.');result=await response.json();
   }
   db.prepare("UPDATE email_outbox SET status='Sent',sent_at=?,provider_id=?,body='',unsubscribe_url='',last_error='' WHERE id=?").run(stamp(),result?.id||'',row.id);
   }catch(error){const attempts=row.attempts+1,code=mailError(error),terminal=['AUTHENTICATION_FAILED','TLS_FAILED','SMTP_HOST_BLOCKED','DELIVERY_REJECTED'].includes(code);db.prepare('UPDATE email_outbox SET attempts=?,status=?,available_at=?,last_error=? WHERE id=?').run(attempts,terminal||attempts>=6?'Failed':'Pending',Date.now()+Math.min(3600000,30000*2**attempts),code,row.id);if(generation===settingsGeneration&&['AUTHENTICATION_FAILED','TLS_FAILED','SMTP_HOST_BLOCKED'].includes(code)){lastFailure=code;blockedUntil=Date.now()+15*60000;break;}}
  }
  db.prepare("DELETE FROM email_outbox WHERE status IN ('Sent','Cancelled') AND created_at<?").run(new Date(Date.now()-90*86400000).toISOString());
 }finally{draining=false;}}
 function staffNotice(notice){for(const user of db.prepare("SELECT id FROM users WHERE active=1 AND role IN ('admin','agent')").all())notify(user.id,notice);}
 function reminders(){const day=today(),soon=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const rentRecipients=new Set();for(const row of db.prepare("SELECT c.id,c.due_on,l.tenant_id FROM rent_charges c JOIN leases l ON l.id=c.lease_id WHERE c.due_on<=? AND c.amount_cents>COALESCE((SELECT SUM(p.amount_cents) FROM rent_payments p WHERE p.charge_id=c.id AND p.voided_at IS NULL),0)-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r JOIN rent_payments p ON p.id=r.payment_id WHERE p.charge_id=c.id AND p.voided_at IS NULL),0)").all(new Date(Date.now()+3*86400000).toISOString().slice(0,10))){
   if(rentRecipients.has(row.tenant_id))continue;rentRecipients.add(row.tenant_id);const overdue=row.due_on<day;notify(row.tenant_id,{kind:'rent',title:overdue?'Rent balance needs attention':'Upcoming rent due',body:'Please review your rent ledger and approved payment instructions.',link:'/dashboard#ledger',key:'rent:'+day});
  }
  for(const lease of db.prepare("SELECT id,tenant_id,tenancy_type FROM leases WHERE status='Active' AND ends_on BETWEEN ? AND ?").all(day,soon)){const notice={kind:'lease',title:lease.tenancy_type==='yearly'?'Your yearly renewal review is approaching':'Your lease end date is approaching',body:'Review your lease and contact management about the next steps.',link:'/dashboard#leases',key:'lease:'+lease.id+':'+day.slice(0,7)};notify(lease.tenant_id,notice);staffNotice({...notice,title:lease.tenancy_type==='yearly'?'A yearly renewal review is approaching':'A lease end date is approaching'});}
 }
 const testKey=(user,requestId)=>{admin(user);if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId))fail('Use a valid test request reference.');return 'smtp-test:'+user.id+':'+requestId;};
 function smtpTestStatus(user,requestId){
  const row=db.prepare("SELECT recipient,status,sent_at,last_error,expires_at FROM email_outbox WHERE event_key=? AND kind='smtp-test'").get(testKey(user,requestId));if(!row)fail('Test email not found.',404);
  return {requestId,recipient:row.recipient,status:row.status==='Pending'&&row.expires_at<=Date.now()?'Expired':row.status,sentAt:row.sent_at,error:row.last_error||''};
 }
 function queueSmtpTest(user,input){
  const key=testKey(user,input.requestId),recipient=typeof input.recipient==='string'?input.recipient.trim().toLowerCase():'';
  if(recipient.length>254||!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient))fail('Enter one valid recipient email address.');
  if(input.confirmSend!==true)fail('Confirm that one real test email should be sent to this recipient.');
  const previous=db.prepare('SELECT recipient FROM email_outbox WHERE event_key=?').get(key);
  if(previous){if(previous.recipient!==recipient)fail('This test reference belongs to a different recipient.',409);return smtpTestStatus(user,input.requestId);}
  const capability=emailCapability();if(!smtpSelected()||!capability.available)fail('Save, verify and enable the SMTP sender before sending a test. '+capability.message,503);
  rateLimit(db,'smtp-test-user',user.id,3,3600000);rateLimit(db,'smtp-test-installation',instance,10,3600000);
  enqueue({to:recipient,subject:'Come Together Property Management — test email',body:'This is the plain-text test email requested for Come Together Property Management.\n\nYour configured company mailbox sent this test to check the portal email connection.\n\nVisit your property portal at '+publicOrigin()+'.\n\nNo action is required.',kind:'smtp-test',key,expiresAt:Date.now()+15*60000});
  return smtpTestStatus(user,input.requestId);
 }
 const reminderPrefix=(user,requestId)=>{admin(user);if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId))fail('Use a valid reminder request reference.');return 'lease-reminder:'+user.id+':'+requestId+':';};
 function leaseReminderStatus(user,requestId){
  leaseReminderAudience(db,user);const rows=db.prepare("SELECT recipient,status,sent_at,last_error,status_snapshot FROM email_outbox WHERE kind='lease-signing-reminder' AND event_key LIKE ? ORDER BY id").all(reminderPrefix(user,requestId)+'%');if(!rows.length)fail('Reminder batch not found.',404);
  const meta=JSON.parse(rows[0].status_snapshot),counts={};for(const row of rows)counts[row.status]=(counts[row.status]||0)+1;
  return {requestId,scheduledFor:new Date(meta.scheduledFor).toISOString(),timeZone:'America/Los_Angeles',recipientCount:rows.length,agreementCount:rows.reduce((n,r)=>n+JSON.parse(r.status_snapshot).targets.length,0),counts,deliveries:rows.map(r=>({recipient:r.recipient,status:r.status,sentAt:r.sent_at,error:r.last_error||''}))};
 }
 function queueLeaseReminders(user,input){
  const prefix=reminderPrefix(user,input.requestId),scheduledFor=Date.parse(input.scheduledFor);
  if(input.confirm!==true||input.timeZone!=='America/Los_Angeles')fail('Confirm this one-time lease reminder and its California schedule.');
  if(!Number.isFinite(scheduledFor))fail('Choose a valid scheduled time.');
  const existing=db.prepare("SELECT status_snapshot FROM email_outbox WHERE kind='lease-signing-reminder' AND event_key LIKE ? LIMIT 1").get(prefix+'%');
  if(existing){const meta=JSON.parse(existing.status_snapshot);if(meta.scheduledFor!==scheduledFor||meta.audienceHash!==input.audienceHash)fail('This reminder request already has different recipients or timing.',409);return leaseReminderStatus(user,input.requestId);}
  if(scheduledFor<Date.now()+60000||scheduledFor>Date.now()+30*86400000)fail('Schedule the reminder between one minute and 30 days from now.');
  const audience=leaseReminderAudience(db,user);if(input.audienceHash!==audience.audienceHash)fail('Pending signatures changed. Refresh the reminder audience.',409);if(!audience.items.length)fail('No eligible pending lease signatures need a reminder.',409);if(audience.items.length>250)fail('Review a smaller reminder audience first.');
  const capability=emailCapability();if(!capability.available)fail(capability.message,503);
  rateLimit(db,'lease-reminder-batch',user.id,3,3600000);
  const groups=new Map();for(const item of audience.items){if(!groups.has(item.recipient))groups.set(item.recipient,[]);groups.get(item.recipient).push(item);}
  transaction(db,()=>{for(const [to,targets] of groups){
   const accountOnly=targets.every(t=>t.source==='account'),instructions=accountOnly?'Sign in to your portal and open Lease signing:\n'+publicOrigin()+'/dashboard#signatures':'Use your private lease invitation link to review the complete agreement and sign when you are ready. If you need your link, please contact management through the website:\n'+publicOrigin()+'/#contact';
   enqueue({to,subject:'A friendly reminder to sign your lease | Come Together',body:'Hello,\n\nThis is a friendly reminder that a lease agreement is awaiting your review and signature.\n\n'+instructions+'\n\nIf you have questions or need corrections, please contact management before signing. If you have already completed signing, thank you — no further action is needed.\n\nCome Together Property Management',kind:'lease-signing-reminder',key:prefix+digest(to),availableAt:scheduledFor,expiresAt:scheduledFor+6*3600000,statusSnapshot:JSON.stringify({version:1,actorId:user.id,scheduledFor,audienceHash:audience.audienceHash,targets})});
  }});return leaseReminderStatus(user,input.requestId);
 }
 function cancelLeaseReminders(user,requestId,input){leaseReminderStatus(user,requestId);if(input.confirm!==true)fail('Confirm cancellation of unsent reminders.');db.prepare("UPDATE email_outbox SET status='Cancelled',body='',unsubscribe_url='' WHERE kind='lease-signing-reminder' AND event_key LIKE ? AND status IN ('Pending','Failed')").run(reminderPrefix(user,requestId)+'%');return leaseReminderStatus(user,requestId);}
 return {smtpSettingsChanged(){settingsGeneration++;verifying=false;blockedUntil=0;lastFailure='';mailer.close?.();},configured,emailCapability,enqueue,notify,staffNotice,drain,reminders,
  history,campaigns,writing,aiTools,
  leaseGreetings,
  leaseReminderAudience:user=>leaseReminderAudience(db,user),queueLeaseReminders,leaseReminderStatus,cancelLeaseReminders,
  queueSmtpTest,smtpTestStatus,
  async startupCheck(){if(!smtpEnabled()||!configured())return {status:'not_configured'};const generation=settingsGeneration;verifying=true;try{await mailer.verify();if(generation!==settingsGeneration)return {status:'settings_changed'};lastFailure='';console.log('SMTP startup check: verified');return {status:'verified'};}catch(error){if(generation!==settingsGeneration)return {status:'settings_changed'};const code=mailError(error);lastFailure=code;blockedUntil=Date.now()+(['AUTHENTICATION_FAILED','TLS_FAILED','SMTP_HOST_BLOCKED'].includes(code)?15*60000:60000);console.warn('SMTP startup check: '+code);return {status:'failed',code};}finally{verifying=false;}},
  retryFailed(user){admin(user);rateLimit(db,'email-retry',user.id,3,3600000);const rows=db.prepare("SELECT id FROM email_outbox WHERE status='Failed' AND created_at>=? AND (expires_at IS NULL OR expires_at>?) ORDER BY id DESC LIMIT 20").all(new Date(Date.now()-7*86400000).toISOString(),Date.now());transaction(db,()=>{for(const row of rows)db.prepare("UPDATE email_outbox SET status='Pending',attempts=0,available_at=?,last_error='' WHERE id=?").run(Date.now(),row.id);});blockedUntil=0;return {message:rows.length+' recent failed email(s) queued for another attempt. Expired, unsubscribed, changed, and superseded messages are checked before sending.'};},
  async verifySmtp(user){admin(user);rateLimit(db,'smtp-connection-check',user.id,5,3600000);try{const result=await mailer.verify();lastFailure='';blockedUntil=0;return result;}catch(error){fail(error.code==='SMTP_NOT_CONFIGURED'?error.message:'SMTP check failed: '+mailError(error)+'. Check the sender mailbox settings in Admin Built-in services.',503);}},
  readAll(user){db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?').run(stamp(),user.id);return {ok:true};},
  list(user){return db.prepare("SELECT id,kind,title,body,link,created_at,read_at FROM notifications WHERE user_id=? AND (kind<>'lease-view' OR EXISTS(SELECT 1 FROM users u WHERE u.id=notifications.user_id AND u.active=1 AND u.role IN ('admin','agent'))) ORDER BY id DESC LIMIT 100").all(user.id);},
  read(user,value){const r=db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=? AND (kind<>'lease-view' OR EXISTS(SELECT 1 FROM users u WHERE u.id=notifications.user_id AND u.active=1 AND u.role IN ('admin','agent')))").run(stamp(),id(value),user.id);if(!r.changes)fail('Notification not found.',404);return {ok:true};},
  deliveryStatus(user){admin(user);return {capability:emailCapability(),configured:configured(),provider:smtpSelected()?mailer.status().provider:configured()?'Resend':'Not connected',smtp:{...mailer.status(),noReply:true,senderName:automatedSenderName,dailyLimit:dailyLimit(),sentLast24h:sentLastDay(),retryAfter:blockedUntil>Date.now()?new Date(blockedUntil).toISOString():null},senderConfigured:smtpEnabled()?mailer.status().senderConfigured:!!process.env.EMAIL_FROM,publicUrlConfigured:!!publicOrigin(),counts:db.prepare('SELECT status,COUNT(*) AS total FROM email_outbox GROUP BY status').all(),recentFailures:db.prepare("SELECT kind,last_error,attempts,created_at FROM email_outbox WHERE status='Failed' ORDER BY id DESC LIMIT 10").all()};}
 };
}
module.exports={createNotifications};
