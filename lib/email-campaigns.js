const {verifyPassword}=require('./auth');
const {staff,fail,digest,transaction,rateLimit}=require('./service-utils');
const {leaseGreetingRecipients}=require('./lease-greetings');
const scopes=['everyone','leases','tenants','applicants','team'];
function createEmailCampaigns(db,{enqueue,emailCapability,sender}){
 function actor(user){staff(user);const row=db.prepare("SELECT * FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(user.id);if(!row)fail('Staff access changed. Sign in again.',403);return row;}
 function recipients(scope){
  if(!scopes.includes(scope))fail('Choose an email audience.');if(scope==='leases')return leaseGreetingRecipients(db);
  const items=[],add=(source,r)=>{const recipient=r.email.trim().toLowerCase();if(recipient.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(recipient)&&!db.prepare("SELECT id FROM users WHERE lower(trim(email))=? AND (active=0 OR email_notifications=0)").get(recipient))items.push({source,id:r.id,recipient});};
  if(['everyone','tenants','team'].includes(scope))for(const row of db.prepare("SELECT id,email FROM users WHERE active=1 AND email_verified_at IS NOT NULL AND email_notifications=1"+(scope==='tenants'?" AND role='tenant'":scope==='team'?" AND role IN ('admin','agent')":'')).all())add('user',row);
  if(['everyone','applicants'].includes(scope))for(const row of db.prepare("SELECT a.id,a.email FROM applications a LEFT JOIN properties p ON p.id=a.property_id WHERE a.email_updates=1 AND a.status IN ('Submitted','Reviewing','Contacted','Approved') AND (p.id IS NULL OR (p.archived=0 AND p.is_preview=0))").all())add('applicant',row);
  return items.sort((a,b)=>(a.source+':'+a.id).localeCompare(b.source+':'+b.id));
 }
 function senderHash(){const s=sender();return digest(JSON.stringify([s.source,s.revision,s.host,s.from]));}
 function audience(user,scope='everyone'){actor(user);const items=recipients(scope),capability=emailCapability();return {scope,items,recipientCount:new Set(items.map(i=>i.recipient)).size,audienceHash:digest(JSON.stringify({scope,items})),senderHash:senderHash(),sender:sender().from||'',capability,maxRecipients:250};}
 const prefix=(user,requestId)=>{actor(user);if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId))fail('Use a valid email send reference.');return 'staff-email:'+user.id+':'+requestId+':';};
 function status(user,requestId){const rows=db.prepare("SELECT recipient,status,sent_at,last_error FROM email_outbox WHERE kind='staff-message' AND event_key LIKE ? ORDER BY id").all(prefix(user,requestId)+'%');if(!rows.length)fail('Email send not found.',404);const counts={};for(const r of rows)counts[r.status]=(counts[r.status]||0)+1;return {requestId,recipientCount:rows.length,counts};}
 async function queue(user,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter an email send request.');
  const before=actor(user),key=prefix(user,input.requestId);if(input.confirmSend!==true)fail('Review the message and recipients, then confirm sending.');
  rateLimit(db,'staff-email-password',user.id,12,3600000);if(typeof input.currentPassword!=='string'||input.currentPassword.length>128||!await verifyPassword(input.currentPassword,before.password_hash))fail('Confirm your current account password.',403);if(actor(user).password_hash!==before.password_hash)fail('Your account changed. Sign in again.',403);
  if(typeof input.subject!=='string'||!input.subject.trim()||input.subject.trim().length>150||/[\r\n\x00]/.test(input.subject))fail('Enter an email subject of 1–150 characters on one line.');if(typeof input.message!=='string'||!input.message.trim()||input.message.trim().length>10000||input.message.includes('\0'))fail('Enter a message of 1–10,000 characters.');
  const subject=input.subject.trim(),message=input.message.trim(),contentHash=digest(JSON.stringify([input.scope,subject,message])),existing=db.prepare("SELECT status_snapshot FROM email_outbox WHERE kind='staff-message' AND event_key LIKE ? LIMIT 1").get(key+'%');
  if(existing){if(JSON.parse(existing.status_snapshot).contentHash!==contentHash)fail('This send reference already belongs to another message.',409);return status(user,input.requestId);}
  const a=audience(user,input.scope);if(a.audienceHash!==input.audienceHash||a.senderHash!==input.senderHash)fail('The audience or sender changed. Review the recipients again.',409);if(!a.recipientCount)fail('No recipients in this audience have email updates enabled.',409);if(a.recipientCount>a.maxRecipients)fail('Choose an audience with no more than '+a.maxRecipients+' recipients.');if(!a.capability.available)fail(a.capability.message,503);
  rateLimit(db,'staff-email-batch',user.id,3,3600000);rateLimit(db,'staff-email-installation','all',6,3600000);
  const groups=new Map();for(const item of a.items){if(!groups.has(item.recipient))groups.set(item.recipient,[]);groups.get(item.recipient).push(item);}
  transaction(db,()=>{for(const [to,targets] of groups)enqueue({to,subject,body:message,kind:'staff-message',key:key+digest(to),expiresAt:Date.now()+86400000,statusSnapshot:JSON.stringify({version:1,actorId:user.id,scope:a.scope,contentHash,targets})});});return status(user,input.requestId);
 }
 function allowed(row){try{const meta=JSON.parse(row.status_snapshot);if(meta.version!==1||!Array.isArray(meta.targets)||!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(meta.actorId))return false;const current=recipients(meta.scope);return meta.targets.some(t=>t.recipient===row.recipient&&current.some(i=>i.source===t.source&&i.id===t.id&&i.recipient===row.recipient));}catch{return false;}}
 return {audience,queue,status,allowed};
}
module.exports={createEmailCampaigns};
