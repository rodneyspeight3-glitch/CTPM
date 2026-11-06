const {randomUUID}=require('node:crypto');
const {stamp,today,publicOrigin,id,admin,fail,transaction,installationId,migrate}=require('./service-utils');
function createNotifications(db,{sendMail}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT NOT NULL,event_key TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,event_key));
 CREATE TABLE IF NOT EXISTS email_outbox(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),recipient TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,created_at TEXT NOT NULL,sent_at TEXT,provider_id TEXT,event_key TEXT NOT NULL UNIQUE);`);
 migrate(db,'email_outbox','expires_at','INTEGER');
 const instance=installationId(db);
 const configured=()=>!!sendMail||!!(process.env.ALLOW_PAID_INTEGRATIONS==='true'&&process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&publicOrigin());
 function enqueue({userId=null,to,subject,body,kind='transactional',key,expiresAt=null}){db.prepare('INSERT INTO email_outbox(user_id,recipient,subject,body,kind,available_at,created_at,event_key,expires_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING').run(userId,to,subject,body,kind,Date.now(),stamp(),key||randomUUID(),expiresAt);}
 function notify(userId,{kind,title,body='Open your dashboard for details.',link='/dashboard',key}){
  const user=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(userId);if(!user)return;
  const inserted=db.prepare('INSERT INTO notifications(user_id,kind,title,body,link,event_key,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING').run(userId,kind,title,body,link,key,stamp());
  if(inserted.changes&&user.email_verified_at&&user.email_notifications&&configured())enqueue({userId,to:user.email,subject:title,body:body+'\n\n'+publicOrigin()+link,kind:'notification',key:'notice:'+userId+':'+key});
 }
 let draining=false;
 async function drain(){if(draining||!configured())return;draining=true;try{
  for(const row of db.prepare("SELECT * FROM email_outbox WHERE status='Pending' AND available_at<=? ORDER BY id LIMIT 10").all(Date.now())){
   const user=row.user_id?db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id):null;
   if((row.expires_at&&row.expires_at<=Date.now())||(row.user_id&&(!user?.active||user.email!==row.recipient||(row.kind==='notification'&&(!user.email_verified_at||!user.email_notifications))))){db.prepare("UPDATE email_outbox SET status='Cancelled',body='' WHERE id=?").run(row.id);continue;}
   try{let result;if(sendMail)result=await sendMail({to:row.recipient,subject:row.subject,text:row.body,key:row.event_key});else{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'ctpm-'+instance+'-'+row.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[row.recipient],subject:row.subject,text:row.body}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Email provider did not accept delivery.');result=await response.json();
   }
   db.prepare("UPDATE email_outbox SET status='Sent',sent_at=?,provider_id=?,body='' WHERE id=?").run(stamp(),result?.id||'',row.id);
   }catch{const attempts=row.attempts+1;db.prepare('UPDATE email_outbox SET attempts=?,status=?,available_at=? WHERE id=?').run(attempts,attempts>=6?'Failed':'Pending',Date.now()+Math.min(3600000,30000*2**attempts),row.id);}
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
  readAll(user){db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?').run(stamp(),user.id);return {ok:true};},
  list(user){return db.prepare('SELECT id,kind,title,body,link,created_at,read_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id);},
  read(user,value){const r=db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?').run(stamp(),id(value),user.id);if(!r.changes)fail('Notification not found.',404);return {ok:true};},
  deliveryStatus(user){admin(user);return {configured:configured(),provider:'Resend',senderConfigured:!!process.env.EMAIL_FROM,publicUrlConfigured:!!publicOrigin(),counts:db.prepare('SELECT status,COUNT(*) AS total FROM email_outbox GROUP BY status').all()};}
 };
}
module.exports={createNotifications};
