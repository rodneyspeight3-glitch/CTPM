const {randomUUID}=require('node:crypto');
const {createMailer,mailError}=require('./mailer');
const {automatedSenderName,automatedHeaders,automatedText,automatedFrom}=require('./email-format');
const {stamp,today,publicOrigin,id,admin,fail,transaction,installationId,migrate,rateLimit}=require('./service-utils');
function createNotifications(db,{sendMail,mailer=createMailer()}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL,event_key TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,event_key));
 CREATE TABLE IF NOT EXISTS email_outbox(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,created_at TEXT NOT NULL,sent_at TEXT,provider_id TEXT,event_key TEXT NOT NULL UNIQUE);`);
 migrate(db,'email_outbox','expires_at','INTEGER');
 migrate(db,'email_outbox','application_id','INTEGER REFERENCES applications(id)');
 migrate(db,'email_outbox','status_snapshot',"TEXT NOT NULL DEFAULT ''");
 migrate(db,'email_outbox','last_error',"TEXT NOT NULL DEFAULT ''");
 migrate(db,'email_outbox','unsubscribe_url',"TEXT NOT NULL DEFAULT ''");
 db.exec('CREATE INDEX IF NOT EXISTS email_outbox_sent_at ON email_outbox(status,sent_at)');
 const instance=installationId(db);
 const dailyLimit=()=>mailer.status().host==='smtp.gmail.com'?400:null;
 const sentLastDay=()=>db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Sent' AND sent_at>=?").get(new Date(Date.now()-86400000).toISOString()).n;
 const configured=()=>!!sendMail||(process.env.SMTP_ENABLED==='true'?mailer.configured()&&!!publicOrigin():!!(process.env.ALLOW_PAID_INTEGRATIONS==='true'&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&publicOrigin()));
 function enqueue({userId=null,to,subject,body,kind='transactional',key,expiresAt=null,applicationId=null,unsubscribeUrl='',statusSnapshot=''}){db.prepare('INSERT INTO email_outbox(user_id,recipient,subject,body,kind,available_at,created_at,event_key,expires_at,application_id,unsubscribe_url,status_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING').run(userId,to,subject,body,kind,Date.now(),stamp(),key||randomUUID(),expiresAt,applicationId,unsubscribeUrl,statusSnapshot);}
 function notify(userId,{kind,title,body='Open your dashboard for details.',link='/dashboard',key,emailDelivery=true}){
  const user=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(userId);if(!user)return;
  const inserted=db.prepare('INSERT INTO notifications(user_id,kind,title,body,link,event_key,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING').run(userId,kind,title,body,link,key,stamp());
  if(inserted.changes&&emailDelivery&&user.email_verified_at&&user.email_notifications&&configured())enqueue({userId,to:user.email,subject:title,body:body+'\n\n'+publicOrigin()+link,kind:'notification',key:'notice:'+userId+':'+key});
 }
 let draining=false,blockedUntil=0,verifying=false;
 async function drain(){if(draining||verifying||!configured()||Date.now()<blockedUntil)return;draining=true;try{
  let sentThisMinute=process.env.SMTP_ENABLED==='true'?db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Sent' AND sent_at>=?").get(new Date(Date.now()-60000).toISOString()).n:0;
  const cap=process.env.SMTP_ENABLED==='true'?dailyLimit():null;let sentThisDay=cap?sentLastDay():0;
  for(const row of db.prepare("SELECT * FROM email_outbox WHERE status='Pending' AND available_at<=? ORDER BY id LIMIT 10").all(Date.now())){
   if(process.env.SMTP_ENABLED==='true'&&(sentThisMinute>=10||(cap&&sentThisDay>=cap)))break;
   const application=row.application_id?db.prepare('SELECT email,email_updates,status FROM applications WHERE id=?').get(row.application_id):null;
   const user=row.user_id?db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id):null;
   if((row.application_id&&(!application?.email_updates||application.email!==row.recipient||(row.kind==='application-progress'&&row.status_snapshot!==application.status)))||(row.expires_at&&row.expires_at<=Date.now())||(row.user_id&&(!user?.active||user.email!==row.recipient||(row.kind==='notification'&&(!user.email_verified_at||!user.email_notifications))))){db.prepare("UPDATE email_outbox SET status='Cancelled',body='',unsubscribe_url='' WHERE id=?").run(row.id);continue;}
   try{const text=automatedText(row.body);let result;if(sendMail)result=await sendMail({to:row.recipient,subject:row.subject,text,headers:automatedHeaders,key:row.event_key,unsubscribeUrl:row.unsubscribe_url});else if(process.env.SMTP_ENABLED==='true')result=await mailer.send({to:row.recipient,subject:row.subject,text,key:'ctpm-'+instance+'-'+row.id,unsubscribeUrl:row.unsubscribe_url});else{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ctpm-'+instance+'-'+row.id},body:JSON.stringify({from:automatedFrom(process.env.EMAIL_FROM),to:[row.recipient],subject:row.subject,text,headers:{...automatedHeaders,...(row.unsubscribe_url?{'List-Unsubscribe':'<'+row.unsubscribe_url+'>'}:{})}}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Email provider did not accept delivery.');result=await response.json();
   }
   db.prepare("UPDATE email_outbox SET status='Sent',sent_at=?,provider_id=?,body='',unsubscribe_url='',last_error='' WHERE id=?").run(stamp(),result?.id||'',row.id);sentThisMinute++;sentThisDay++;
   }catch(error){const attempts=row.attempts+1,code=mailError(error),terminal=['AUTHENTICATION_FAILED','TLS_FAILED','DELIVERY_REJECTED'].includes(code);db.prepare('UPDATE email_outbox SET attempts=?,status=?,available_at=?,last_error=? WHERE id=?').run(attempts,terminal||attempts>=6?'Failed':'Pending',Date.now()+Math.min(3600000,30000*2**attempts),code,row.id);if(['AUTHENTICATION_FAILED','TLS_FAILED'].includes(code)){blockedUntil=Date.now()+15*60000;break;}}
  }
  db.prepare("DELETE FROM email_outbox WHERE status IN ('Sent','Cancelled') AND created_at<?").run(new Date(Date.now()-90*86400000).toISOString());
 }finally{draining=false;}}
 function staffNotice(notice){for(const user of db.prepare("SELECT id FROM users WHERE active=1 AND role IN ('admin','agent')").all())notify(user.id,notice);}
 function reminders(){const day=today(),soon=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const rentRecipients=new Set();for(const row of db.prepare("SELECT c.id,c.due_on,l.tenant_id FROM rent_charges c JOIN leases l ON l.id=c.lease_id WHERE c.due_on<=? AND c.amount_cents>COALESCE((SELECT SUM(p.amount_cents) FROM rent_payments p WHERE p.charge_id=c.id AND p.voided_at IS NULL),0)-COALESCE((SELECT SUM(r.amount_cents) FROM payment_refunds r JOIN rent_payments p ON p.id=r.payment_id WHERE p.charge_id=c.id AND p.voided_at IS NULL),0)").all(new Date(Date.now()+3*86400000).toISOString().slice(0,10))){
   if(rentRecipients.has(row.tenant_id))continue;rentRecipients.add(row.tenant_id);const overdue=row.due_on<day;notify(row.tenant_id,{kind:'rent',title:overdue?'Rent balance needs attention':'Upcoming rent due',body:'Please review your rent ledger and approved payment instructions.',link:'/dashboard#ledger',key:'rent:'+day});
  }
  for(const lease of db.prepare("SELECT id,tenant_id FROM leases WHERE status='Active' AND ends_on BETWEEN ? AND ?").all(day,soon)){const notice={kind:'lease',title:'Your lease end date is approaching',body:'Review your lease and contact management about the next steps.',link:'/dashboard#leases',key:'lease:'+lease.id+':'+day.slice(0,7)};notify(lease.tenant_id,notice);staffNotice({...notice,title:'A lease end date is approaching'});}
 }
 return {configured,enqueue,notify,staffNotice,drain,reminders,
  async startupCheck(){if(process.env.SMTP_ENABLED!=='true'||!configured())return {status:'not_configured'};verifying=true;try{await mailer.verify();console.log('SMTP startup check: verified');return {status:'verified'};}catch(error){const code=mailError(error);blockedUntil=Date.now()+(['AUTHENTICATION_FAILED','TLS_FAILED'].includes(code)?15*60000:60000);console.warn('SMTP startup check: '+code);return {status:'failed',code};}finally{verifying=false;}},
  retryFailed(user){admin(user);rateLimit(db,'email-retry',user.id,3,3600000);const rows=db.prepare("SELECT id FROM email_outbox WHERE status='Failed' AND created_at>=? AND (expires_at IS NULL OR expires_at>?) ORDER BY id DESC LIMIT 20").all(new Date(Date.now()-7*86400000).toISOString(),Date.now());transaction(db,()=>{for(const row of rows)db.prepare("UPDATE email_outbox SET status='Pending',attempts=0,available_at=?,last_error='' WHERE id=?").run(Date.now(),row.id);});blockedUntil=0;return {message:rows.length+' recent failed email(s) queued for another attempt. Expired, unsubscribed, changed, and superseded messages are checked before sending.'};},
  async verifySmtp(user){admin(user);rateLimit(db,'smtp-connection-check',user.id,5,3600000);try{const result=await mailer.verify();blockedUntil=0;return result;}catch(error){fail(error.code==='SMTP_NOT_CONFIGURED'?error.message:'SMTP check failed: '+mailError(error)+'. Check the sender mailbox settings in Render.',503);}},
  readAll(user){db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?').run(stamp(),user.id);return {ok:true};},
  list(user){return db.prepare('SELECT id,kind,title,body,link,created_at,read_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id);},
  read(user,value){const r=db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').run(stamp(),id(value),user.id);if(!r.changes)fail('Notification not found.',404);return {ok:true};},
  deliveryStatus(user){admin(user);return {configured:configured(),provider:process.env.SMTP_ENABLED==='true'?mailer.status().provider:configured()?'Resend':'Not connected',smtp:{...mailer.status(),noReply:true,senderName:automatedSenderName,dailyLimit:dailyLimit(),sentLast24h:sentLastDay(),retryAfter:blockedUntil>Date.now()?new Date(blockedUntil).toISOString():null},senderConfigured:process.env.SMTP_ENABLED==='true'?mailer.status().senderConfigured:!!process.env.EMAIL_FROM,publicUrlConfigured:!!publicOrigin(),counts:db.prepare('SELECT status,COUNT(*) AS total FROM email_outbox GROUP BY status').all(),recentFailures:db.prepare("SELECT kind,last_error,attempts,created_at FROM email_outbox WHERE status='Failed' ORDER BY id DESC LIMIT 10").all()};}
 };
}
module.exports={createNotifications};
