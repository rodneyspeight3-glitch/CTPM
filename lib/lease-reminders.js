const {digest,admin,fail}=require('./service-utils');
const address=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const exists=(db,name)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
function pendingLeaseSigners(db){
 const items=[];
 if(exists(db,'applicant_lease_offers'))for(const r of db.prepare("SELECT o.id,o.document_hash,o.values_json,a.email FROM applicant_lease_offers o JOIN applications a ON a.id=o.application_id JOIN properties p ON p.id=o.property_id WHERE o.status='Pending' AND o.revoked_at IS NULL AND o.lease_id IS NULL AND o.expires_at>? AND a.status='Approved' AND p.archived=0 AND p.is_preview=0 AND o.id=(SELECT MAX(x.id) FROM applicant_lease_offers x WHERE x.application_id=o.application_id)").all(Date.now())){
  const v=JSON.parse(r.values_json),recipient=r.email.trim().toLowerCase();if(address(recipient)&&typeof v.tenantEmail==='string'&&v.tenantEmail.trim().toLowerCase()===recipient)items.push({source:'applicant',id:r.id,documentHash:r.document_hash,recipient,name:v.tenantName||''});
 }
 if(exists(db,'signature_requests'))for(const r of db.prepare("SELECT s.id,s.document_hash,u.email,u.name FROM signature_requests s JOIN leases l ON l.id=s.lease_id JOIN users u ON u.id=s.tenant_id WHERE s.status='Pending' AND l.status='Active' AND u.active=1 AND u.role='tenant' AND u.email_verified_at IS NOT NULL AND u.email_notifications=1").all()){
  const recipient=r.email.trim().toLowerCase();if(address(recipient))items.push({source:'account',id:r.id,documentHash:r.document_hash,recipient,name:r.name});
 }
 return items.sort((a,b)=>(a.source+':'+a.id).localeCompare(b.source+':'+b.id));
}
function leaseReminderAudience(db,user){admin(user);const actor=db.prepare("SELECT id FROM users WHERE id=? AND role='admin' AND active=1").get(user.id);if(!actor)fail('Administrator access changed.',403);const items=pendingLeaseSigners(db);return {items,agreementCount:items.length,recipientCount:new Set(items.map(x=>x.recipient)).size,audienceHash:digest(JSON.stringify(items)),timeZone:'America/Los_Angeles'};}
function leaseReminderAllowed(db,row){
 try{
  const meta=JSON.parse(row.status_snapshot);if(meta.version!==1||meta.scheduledFor>Date.now()||!Array.isArray(meta.targets))return false;
  if(!db.prepare("SELECT id FROM users WHERE id=? AND role='admin' AND active=1").get(meta.actorId))return false;
  const current=pendingLeaseSigners(db);return meta.targets.some(target=>current.some(item=>item.source===target.source&&item.id===target.id&&item.documentHash===target.documentHash&&item.recipient===row.recipient));
 }catch{return false;}
}
module.exports={leaseReminderAudience,leaseReminderAllowed};
