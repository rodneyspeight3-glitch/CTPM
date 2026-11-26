const {admin,fail,digest,transaction,rateLimit}=require('./service-utils');
const kind='lease-thanksgiving';
const subject='Happy Thanksgiving from Come Together Property Management';
const body='Happy Thanksgiving!\n\nWishing you and your loved ones a warm, joyful day filled with gratitude, good food, and special moments together.\n\nThank you for being part of our Come Together community. We are grateful for the opportunity to serve you and help make home feel like home.\n\nMay your holiday be full of warmth, laughter, and wonderful memories.\n\nWarm wishes,\nCome Together Property Management';
const exists=(db,name)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const address=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
function campaign(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(Date.now()).map(p=>[p.type,p.value]));
 const year=Number(parts.year),day=1+(4-new Date(Date.UTC(year,10,1)).getUTCDay()+7)%7+21;
 return {campaign:'thanksgiving-'+year,year,open:parts.month==='11'&&Number(parts.day)===day,expiresAt:Date.UTC(year,10,day+1,8)};
}
function authorize(db,user){admin(user);if(!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role='admin'").get(user.id))fail('Administrator access changed.',403);}
function recipients(db){
 const items=[];
 const add=(source,r)=>{const recipient=r.email.trim().toLowerCase();if(address(recipient)&&!db.prepare("SELECT 1 FROM users WHERE lower(trim(email))=? AND role='tenant' AND (active=0 OR email_notifications=0)").get(recipient))items.push({source,id:r.id,recipient});};
 if(exists(db,'leases'))for(const r of db.prepare("SELECT l.id,u.email FROM leases l JOIN users u ON u.id=l.tenant_id JOIN properties p ON p.id=l.property_id WHERE l.status='Active' AND p.archived=0 AND p.is_preview=0 AND u.role='tenant' AND u.active=1 AND u.email_verified_at IS NOT NULL AND u.email_notifications=1").all())add('account',r);
 // A lease invitation does not override an applicant's email-update preference.
 if(exists(db,'applicant_lease_offers'))for(const r of db.prepare("SELECT o.id,o.values_json,a.email FROM applicant_lease_offers o JOIN applications a ON a.id=o.application_id JOIN properties p ON p.id=o.property_id LEFT JOIN leases l ON l.id=o.lease_id WHERE o.status IN ('Pending','Signed') AND o.revoked_at IS NULL AND (o.status='Signed' OR o.expires_at>?) AND (o.lease_id IS NULL OR l.status='Active') AND a.status='Approved' AND a.email_updates=1 AND p.archived=0 AND p.is_preview=0 AND o.id=(SELECT MAX(x.id) FROM applicant_lease_offers x WHERE x.application_id=o.application_id)").all(Date.now())){
  let values;try{values=JSON.parse(r.values_json);}catch{continue;}
  if(typeof values.tenantEmail==='string'&&values.tenantEmail.trim().toLowerCase()===r.email.trim().toLowerCase())add('applicant',r);
 }
 return items.sort((a,b)=>(a.source+':'+a.id).localeCompare(b.source+':'+b.id));
}
function createLeaseGreetings(db,{enqueue,emailCapability}){
 const prefix=year=>kind+':'+year+':';
 const rows=year=>db.prepare('SELECT recipient,status,sent_at,last_error,status_snapshot FROM email_outbox WHERE kind=? AND event_key LIKE ? ORDER BY id').all(kind,prefix(year)+'%');
 function preview(user){authorize(db,user);const c=campaign(),items=recipients(db);return {...c,subject,body,items,agreementCount:items.length,recipientCount:new Set(items.map(x=>x.recipient)).size,audienceHash:digest(JSON.stringify(items)),alreadyQueued:rows(c.year).length>0};}
 function status(user,value){
  authorize(db,user);if(typeof value!=='string'||!/^thanksgiving-\d{4}$/.test(value))fail('Use a valid Thanksgiving campaign.');const year=Number(value.slice(-4)),messages=rows(year);if(!messages.length)fail('Thanksgiving greeting batch not found.',404);
  const counts={};for(const r of messages)counts[r.status]=(counts[r.status]||0)+1;
  return {campaign:value,subject,recipientCount:messages.length,counts,deliveries:messages.map(r=>({recipient:r.recipient,status:r.status,sentAt:r.sent_at,error:r.last_error||''}))};
 }
 function queue(user,input){
  authorize(db,user);if(input.confirm!==true)fail('Confirm sending this one-time Thanksgiving greeting.');const c=campaign();if(input.campaign!==c.campaign)fail('Use the current Thanksgiving campaign.');
  if(rows(c.year).length)return status(user,c.campaign);
  const audience=preview(user);if(input.audienceHash!==audience.audienceHash)fail('Lease recipients changed. Refresh the greeting audience.',409);if(!audience.items.length)fail('No lease recipients have email updates enabled.',409);if(audience.recipientCount>250)fail('Review a smaller greeting audience first.');
  if(!c.open)fail('Thanksgiving greetings can only be sent on Thanksgiving in California.',409);const capability=emailCapability();if(!capability.available)fail(capability.message,503);
  rateLimit(db,'lease-greeting-batch',user.id,3,3600000);
  const groups=new Map();for(const item of audience.items){if(!groups.has(item.recipient))groups.set(item.recipient,[]);groups.get(item.recipient).push(item);}
  transaction(db,()=>{for(const [to,targets] of groups)enqueue({to,subject,body,kind,key:prefix(c.year)+digest(to),expiresAt:c.expiresAt,statusSnapshot:JSON.stringify({version:1,actorId:user.id,campaign:c.campaign,targets})});});
  return status(user,c.campaign);
 }
 function allowed(row){
  try{const meta=JSON.parse(row.status_snapshot),c=campaign();if(meta.version!==1||meta.campaign!==c.campaign||!c.open||!Array.isArray(meta.targets))return false;
   if(!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role='admin'").get(meta.actorId))return false;
   const current=recipients(db);return meta.targets.some(target=>target.recipient===row.recipient&&current.some(item=>item.source===target.source&&item.id===target.id&&item.recipient===row.recipient));
  }catch{return false;}
 }
 return {preview,queue,status,allowed};
}
module.exports={createLeaseGreetings};
