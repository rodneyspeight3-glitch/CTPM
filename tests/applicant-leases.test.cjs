const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),{PDFDocument}=require('pdf-lib'),{createHash}=require('node:crypto');
const {fixture}=require('./fixture.cjs'),{rentalApplication}=require('./rental-fixtures.cjs'),inventory=require('./listing-fixtures.cjs'),company=require('../lib/company-lease-template');
async function setup(){
 const app=await fixture({SMTP_ENABLED:'false'});let cookie='';const call=(path,{method='GET',data,session=cookie,origin=app.base}={})=>fetch(app.base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session}:{})},...(method==='GET'?{}:{body:JSON.stringify(data||{})})}),post=(path,data={},session=cookie)=>call(path,{method:'POST',data,session}),json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json();};
 const auth=await post('/api/login',app.credentials,'');cookie=auth.headers.get('set-cookie').split(';')[0];const agent=(await json(await post('/api/admin/users',{name:'Leasing Agent',email:'leasing@example.test',password:app.credentials.password,role:'agent'}))).user,login=await post('/api/login',{email:agent.email,password:app.credentials.password},''),agentCookie=login.headers.get('set-cookie').split(';')[0];
 const property=(await json(await post('/api/properties',inventory[0]))).property,receipt=await json(await post('/api/vacancies/'+property.id+'/applications',rentalApplication({name:'Future Resident',email:'future-resident@example.test',leaseDuration:'12 months'}),''));let application=(await json(await call('/api/applications'))).applications[0];await json(await post('/api/applications/'+application.id+'/status',{status:'Approved',note:'Reviewed for an account-free agreement',confirmDecision:true,expectedUpdatedAt:application.updated_at},agentCookie));
 const path='/api/lease-preparations/'+application.id,detail=()=>call(path).then(json),save=async(extra={})=>{const {preparation:p}=await detail();return (await json(await post(path+'/save',{revision:p.revision,source:'template',values:{...p.values,deposit:600,agreementDate:'2099-01-01',managerPhone:'555-0101',noticeContactName:'Leasing office',tenancyType:'fixed',tenancyTerms:'A fixed term from 2099-01-15 through 2100-01-14.',parkingTerms:'One reserved space',paymentInstructions:'Contact management for approved payment instructions.',...extra}}))).preparation;};
 const send=async(extra={})=>{const {preparation:p}=await detail();return (await json(await post(path+'/send',{revision:p.revision,confirm:true,delivery:'applicant',...extra},agentCookie))).preparation;},guest=(action,data={})=>post('/api/applicant-leases/'+action,data,''),db=()=>{const connection=new DatabaseSync(app.databasePath);connection.exec('PRAGMA busy_timeout=5000');return connection;};
 return {app,call,post,json,path,detail,save,send,guest,property,application,agentCookie,db};
}
const token=result=>result.trackingUrl.split('=')[1];
async function uploadedApplicant(s,name,email,bytes){
 const receipt=await s.json(await s.post('/api/open-applications',rentalApplication({name,email,requestedAddress:s.property.address}),''));
 const application=(await s.json(await s.call('/api/applications'))).applications.find(a=>a.reference===receipt.reference);
 await s.json(await s.post('/api/applications/'+application.id+'/status',{status:'Approved',note:'Independently reviewed applicant',confirmDecision:true,expectedUpdatedAt:application.updated_at},s.agentCookie));
 const path='/api/lease-preparations/'+application.id;let p=(await s.json(await s.call(path))).preparation;
 p=(await s.json(await s.post(path+'/save',{revision:p.revision,source:'upload',values:{...p.values,propertyId:s.property.id,propertyAddress:s.property.address,monthlyRent:1650,deposit:500}},s.agentCookie))).preparation;
 p=(await s.json(await s.post(path+'/upload',{revision:p.revision,name:email.split('@')[0]+'.pdf',data:bytes.toString('base64')},s.agentCookie))).preparation;
 return {application,path,preparation:p,name,email,bytes};
}
async function uploadedPdf(label){const pdf=await PDFDocument.create();pdf.addPage().drawText(label);return Buffer.from(await pdf.save());}
async function inviteUploaded(s,applicant){return (await s.json(await s.post(applicant.path+'/send',{revision:applicant.preparation.revision,confirm:true,delivery:'applicant'},s.agentCookie))).preparation;}
async function signInvitation(s,sent,name,email){const link=token(sent),opened=(await s.json(await s.guest('open',{token:link}))).agreement;return s.guest('sign',{token:link,name,email,documentHash:opened.documentHash,consent:true,reviewed:true});}
test('first invitation opens alert active staff once, stay private to staff, and preserve per-user read state across repeat opens and replacement links',async()=>{
 const s=await setup();try{
  const {user:tenant}=await s.json(await s.post('/api/admin/users',{name:'Notification Resident',email:'notice-resident@example.test',password:s.app.credentials.password,role:'tenant'}));
  const login=await s.post('/api/login',{email:tenant.email,password:s.app.credentials.password},''),tenantCookie=login.headers.get('set-cookie').split(';')[0];
  await s.save();const sent=await s.send(),link=token(sent);
  const views=async session=>(await s.json(await s.call('/api/notifications',{session}))).notifications.filter(n=>n.kind==='lease-view');
  assert.equal((await views()).length,0);assert.equal((await s.guest('open',{token:'a'.repeat(64)})).status,404);
  await s.call(s.path+'/preview');await s.call(s.path+'/invitation-original');assert.equal((await views()).length,0);
  const responses=await Promise.all([s.guest('open',{token:link}),s.guest('open',{token:link}),s.guest('open',{token:link})]);assert.ok(responses.every(r=>r.status===200));
  const admin=await views(),agent=await views(s.agentCookie);assert.equal(admin.length,1);assert.equal(agent.length,1);
  for(const notice of [...admin,...agent]){assert.equal(notice.title,'Lease invitation opened');assert.match(notice.body,/Future Resident/);assert.ok(notice.body.includes(s.property.address));assert.ok(notice.link.includes('leaseApplication='+s.application.id));assert.ok(notice.link.endsWith('#leases'));assert.equal(notice.read_at,null);assert.ok(!JSON.stringify(notice).includes(link));}
  assert.deepEqual(await views(tenantCookie),[]);assert.equal((await s.call('/api/notifications',{session:''})).status,401);
  assert.equal((await s.post('/api/notifications/'+admin[0].id+'/read',{},tenantCookie)).status,404);
  await s.json(await s.post('/api/notifications/'+admin[0].id+'/read'));assert.ok((await views())[0].read_at);assert.equal((await views(s.agentCookie))[0].read_at,null);
  const viewedAt=(await s.detail()).preparation.invitation.viewedAt;await s.guest('open',{token:link});assert.equal((await views()).length,1);assert.ok((await views())[0].read_at);assert.equal((await s.detail()).preparation.invitation.viewedAt,viewedAt);
  const invitation=(await s.detail()).preparation.invitation,rotated=await s.json(await s.post(s.path+'/invitation-link',{offerId:invitation.id,expectedUpdatedAt:invitation.updatedAt,confirm:true}));
  assert.equal((await s.guest('open',{token:link})).status,404);await s.json(await s.guest('open',{token:token(rotated)}));assert.equal((await views()).length,1);
  const current=(await s.detail()).preparation.invitation;await s.json(await s.post(s.path+'/withdraw-invitation',{offerId:current.id,expectedUpdatedAt:current.updatedAt,confirm:true,reason:'Prepare another applicant-specific agreement'}));
  await s.save();const next=await s.send();await s.json(await s.guest('open',{token:token(next)}));assert.equal((await views()).length,2);assert.equal((await views()).filter(n=>!n.read_at).length,1);
  await s.app.stop();s.app.base=await s.app.start();assert.equal((await views()).length,2);assert.equal((await views(s.agentCookie)).filter(n=>!n.read_at).length,2);
  const db=s.db();try{db.prepare("UPDATE users SET role='tenant' WHERE email='leasing@example.test'").run();}finally{db.close();}
  assert.deepEqual(await views(s.agentCookie),[]);assert.equal((await s.post('/api/notifications/'+agent[0].id+'/read',{},s.agentCookie)).status,404);assert.equal((await views()).length,2);
 }finally{await s.app.cleanup();}
});
test('a first-open notification is atomic with the view record and dashboard alerts never queue an email',async()=>{
 const s=await setup();try{
  await s.save();const sent=await s.send(),link=token(sent),connection=s.db();
  try{connection.exec("CREATE TRIGGER fail_lease_view_notice_for_test BEFORE INSERT ON notifications WHEN NEW.kind='lease-view' BEGIN SELECT RAISE(ABORT,'isolated notification failure'); END;");}finally{connection.close();}
  assert.equal((await s.guest('open',{token:link})).status,500);assert.equal((await s.detail()).preparation.invitation.viewedAt,null);
  const check=s.db();try{assert.equal(check.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind='lease-view'").get().n,0);check.exec('DROP TRIGGER fail_lease_view_notice_for_test');}finally{check.close();}
  await s.app.stop();const db=s.db();try{
   db.prepare("UPDATE users SET email_verified_at=?,email_notifications=1 WHERE role IN ('admin','agent')").run(new Date().toISOString());
   const {createNotifications}=require('../lib/notifications'),{createApplicantLeases}=require('../lib/applicant-leases'),notices=createNotifications(db,{sendMail:async()=>{throw Error('Dashboard alerts must not send email');}}),offers=createApplicantLeases(db,notices),before=db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n;
   offers.open({token:link},{socket:{remoteAddress:'127.0.0.1'}});assert.equal(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind='lease-view'").get().n,2);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,before);
  }finally{db.close();}
 }finally{await s.app.cleanup();}
});
test('the supplied lease becomes a private editable 61-clause template and account-free invitations neither create accounts nor activate leases',async()=>{
 const s=await setup();try{
  const {preparation:p,sourceTemplate}=await s.detail();assert.equal(p.values.tenantId,null);for(let n=1;n<=61;n++)assert.match(sourceTemplate.body,new RegExp('(?:^|\\n\\n)'+n+'\\.'));assert.equal(p.values.terms,company.body);assert.doesNotMatch(company.body,/GRICELDA|LETA STEVENS|BRANDON HALEY|424 N Palm|765.543|619.967|December 15th|2,500/);assert.match(company.body,/Megan's Law/);assert.match(company.body,/Lead Warning/);
  assert.equal((await s.post(s.path+'/send',{revision:p.revision,confirm:true,delivery:'applicant'})).status,400);await s.save();const [a,b]=await Promise.all([s.send(),s.send()]),sent=a.trackingUrl?a:b,link=token(sent);assert.equal(a.invitation.id,b.invitation.id);assert.equal(a.invitation.delivery.status,'Not queued');assert.equal((await s.json(await s.call('/api/leases'))).leases.length,0);assert.equal((await s.json(await s.call('/api/admin/users'))).users.length,2);
  const connection=s.db();try{const row=connection.prepare('SELECT * FROM applicant_lease_offers').get();assert.equal(row.token_hash,createHash('sha256').update(link).digest('hex'));assert.ok(!JSON.stringify({...row,original_data:null}).includes(link));assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM applicant_lease_offers').get().n,1);}finally{connection.close();}
  const opened=await s.json(await s.guest('open',{token:link}));assert.equal(opened.agreement.canSign,true);assert.equal(opened.agreement.tenantName,'Future Resident');assert.doesNotMatch(JSON.stringify(opened),/PRIVATE|staff_note|created_by|token_hash|application_id/);const original=await s.guest('original',{token:link});assert.equal(original.status,200);assert.match(original.headers.get('cache-control'),/no-store/);assert.ok((await PDFDocument.load(await original.arrayBuffer())).getPageCount()>2);
  for(const bad of ['', 'a'.repeat(64),link.slice(0,63)])assert.equal((await s.guest('open',{token:bad})).status,404);assert.equal((await s.call('/api/applicant-leases/open',{method:'POST',data:{token:link},session:'',origin:'https://attacker.example'})).status,403);assert.equal((await s.call(s.path,{session:''})).status,401);
  assert.equal((await s.post(s.path+'/save',{revision:(await s.detail()).preparation.revision,source:'template',values:(await s.detail()).preparation.values})).status,409);assert.equal((await s.detail()).preparation.state,'Applicant invited');
 }finally{await s.app.cleanup();}
});
test('private-link signatures require consent and matching document details; a signed yearly agreement later attaches to the matching account without a second signature',async()=>{
 const s=await setup();try{
  await s.save({tenancyType:'yearly',tenancyTerms:'A periodic, year-to-year tenancy beginning January 15, 2099 until terminated in accordance with applicable law.'});const sent=await s.send(),link=token(sent),opened=(await s.json(await s.guest('open',{token:link}))).agreement,body={token:link,name:'Future Resident',email:'future-resident@example.test',reviewed:true,consent:true,documentHash:opened.documentHash};
  for(const wrong of [{name:'Somebody Else'},{email:'other@example.test'},{consent:false},{reviewed:false},{documentHash:'bad'}])assert.equal((await s.guest('sign',{...body,...wrong})).status,400);
  const results=await Promise.all([s.guest('sign',body),s.guest('sign',body)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const original=Buffer.from(await(await s.guest('original',{token:link})).arrayBuffer()),signed=Buffer.from(await(await s.guest('signed',{token:link})).arrayBuffer());assert.ok((await PDFDocument.load(signed)).getPageCount()>(await PDFDocument.load(original)).getPageCount());let detail=await s.detail();assert.equal(detail.preparation.invitation.status,'Signed');assert.match(detail.preparation.invitation.identityMethod,/not independently verified/);
  await s.app.stop();s.app.base=await s.app.start();assert.equal((await s.detail()).preparation.invitation.status,'Signed');const tenant=(await s.json(await s.post('/api/admin/users',{name:'Future Resident',email:'future-resident@example.test',password:s.app.credentials.password,role:'tenant'}))).user,other=(await s.json(await s.post('/api/admin/users',{name:'Other Resident',email:'other@example.test',password:s.app.credentials.password,role:'tenant'}))).user;
  detail=await s.detail();assert.equal((await s.post(s.path+'/send',{revision:detail.preparation.revision,confirm:true,delivery:'account',tenantId:other.id})).status,400);const assigned=(await s.json(await s.post(s.path+'/send',{revision:detail.preparation.revision,confirm:true,delivery:'account',tenantId:tenant.id}))).preparation||null;
  const p=assigned||(await s.detail()).preparation;assert.ok(p.lease_id);const lease=(await s.json(await s.call('/api/leases'))).leases[0];assert.equal(lease.tenancy_type,'yearly');const request=(await s.json(await s.call('/api/signatures'))).requests[0];assert.equal(request.status,'Signed');assert.match(request.identity_method,/not independently verified/);const {evidence}=await s.json(await s.call('/api/signatures/'+request.id+'/evidence'));assert.equal(evidence.verifiedEmail,null);assert.equal(evidence.signerName,'Future Resident');assert.match(evidence.identityMethod,/Private invitation link/);assert.deepEqual(Buffer.from(await(await s.call('/api/lease-documents/'+request.signed_document_id+'/download')).arrayBuffer()),signed);assert.equal((await s.json(await s.call('/api/vacancies',{session:''}))).properties.some(p=>p.id===s.property.id),false);
  await s.json(await s.post('/api/ledger',{leaseId:lease.id,period:'2101-01',dueOn:'2101-01-01',amount:1650}));assert.match(await(await s.call('/api/lease-calendar/'+lease.id)).text(),/Yearly renewal review/);await s.json(await s.post('/api/leases/'+lease.id+'/review-date',{reviewOn:'2101-01-14',expectedReviewOn:lease.ends_on}));assert.equal((await s.post('/api/leases/'+lease.id+'/review-date',{reviewOn:'2102-01-14',expectedReviewOn:lease.ends_on})).status,409);
  await s.json(await s.post(s.path+'/send',{revision:p.revision,confirm:true,delivery:'account',tenantId:tenant.id}));assert.equal((await s.json(await s.call('/api/leases'))).leases.length,1);assert.equal((await s.json(await s.call('/api/signatures'))).requests.length,1);
 }finally{await s.app.cleanup();}
});
test('staff can replace or withdraw links; expiry, stale changes and changed approval stop applicant actions without discarding document history',async()=>{
 const s=await setup();try{
  await s.save();const sent=await s.send(),old=token(sent);let i=(await s.detail()).preparation.invitation;const rotated=await s.json(await s.post(s.path+'/invitation-link',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:true})),link=token(rotated);assert.notEqual(link,old);assert.equal((await s.guest('open',{token:old})).status,404);assert.equal((await s.post(s.path+'/withdraw-invitation',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:true,reason:'Stale review'})).status,409);
  let app=(await s.json(await s.call('/api/applications/'+s.application.id))).application;await s.json(await s.post('/api/applications/'+app.id+'/status',{status:'Reviewing',note:'Recheck',expectedUpdatedAt:app.updated_at}));const opened=(await s.json(await s.guest('open',{token:link}))).agreement;assert.equal(opened.canSign,false);assert.equal((await s.guest('sign',{token:link,name:'Future Resident',email:'future-resident@example.test',documentHash:opened.documentHash,consent:true,reviewed:true})).status,409);
  i=(await s.detail()).preparation.invitation;await s.json(await s.post(s.path+'/withdraw-invitation',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:true,reason:'Revise agreement details'}));assert.equal((await s.guest('original',{token:link})).status,404);assert.equal((await s.call(s.path+'/invitation-original')).status,200);
  app=(await s.json(await s.call('/api/applications/'+app.id))).application;await s.json(await s.post('/api/applications/'+app.id+'/status',{status:'Approved',note:'Reviewed again',expectedUpdatedAt:app.updated_at,confirmDecision:true}));await s.save();const next=await s.send(),nextToken=token(next);const connection=s.db();try{connection.prepare('UPDATE applicant_lease_offers SET expires_at=0 WHERE id=?').run(next.invitation.id);}finally{connection.close();}assert.equal((await s.guest('open',{token:nextToken})).status,404);assert.equal((await s.detail()).preparation.invitation.status,'Expired');const expired=(await s.detail()).preparation.invitation;assert.equal((await s.post(s.path+'/invitation-link',{offerId:expired.id,expectedUpdatedAt:expired.updatedAt,confirm:true})).status,409);await s.save({deposit:750});const newest=await s.send();assert.equal((await s.call(s.path+'/invitation-original?offerId='+sent.invitation.id)).status,200);assert.ok((await s.detail()).invitationHistory.length>=3);assert.notEqual(token(newest),nextToken);await s.json(await s.guest('decline',{token:token(newest),reason:'I need a different term.'}));assert.equal((await s.detail()).preparation.invitation.status,'Declined');assert.equal((await s.guest('sign',{token:token(newest)})).status,409);
 }finally{await s.app.cleanup();}
});
test('same-address applicants retain separate uploaded PDFs, private signatures and staff-only records before and after home assignment',async()=>{
 const s=await setup();try{
  let p=await s.save();const firstBytes=await uploadedPdf('First applicant original agreement');
  p=(await s.json(await s.post(s.path+'/upload',{revision:p.revision,name:'first-applicant.pdf',data:firstBytes.toString('base64')}))).preparation;
  const first=await s.send(),firstToken=token(first),secondBytes=await uploadedPdf('Second applicant original agreement');
  const secondApplicant=await uploadedApplicant(s,'Other Resident','other@example.test',secondBytes),second=await inviteUploaded(s,secondApplicant),secondToken=token(second);
  assert.notEqual(first.invitation.id,second.invitation.id);assert.notEqual(firstToken,secondToken);assert.equal((await s.call(s.path+'/invitation-original?offerId='+second.invitation.id)).status,404);
  for(const [sent,name,bytes]of [[first,'Future Resident',firstBytes],[second,'Other Resident',secondBytes]]){
   const {agreement}=await s.json(await s.guest('open',{token:token(sent)}));assert.equal(agreement.tenantName,name);assert.equal(agreement.canSign,true);
   assert.equal(Object.keys(agreement).some(key=>/other|applicants|count|invitations/i.test(key)),false);
   assert.deepEqual(Buffer.from(await(await s.guest('original',{token:token(sent)})).arrayBuffer()),bytes);
  }
  assert.equal((await signInvitation(s,first,'Future Resident','future-resident@example.test')).status,200);
  assert.equal((await s.json(await s.guest('open',{token:secondToken}))).agreement.canSign,true);
  assert.equal((await signInvitation(s,second,'Other Resident','other@example.test')).status,200);
  assert.equal((await s.detail()).preparation.invitation.status,'Signed');
  assert.equal((await s.json(await s.call(secondApplicant.path))).preparation.invitation.status,'Signed');
  const tenant=(await s.json(await s.post('/api/admin/users',{name:'Future Resident',email:'future-resident@example.test',password:s.app.credentials.password,role:'tenant'}))).user;
  const tenantLogin=await s.post('/api/login',{email:tenant.email,password:s.app.credentials.password},''),tenantCookie=tenantLogin.headers.get('set-cookie').split(';')[0];
  for(const url of ['/api/lease-preparations',secondApplicant.path,secondApplicant.path+'/invitation-original',secondApplicant.path+'/invitation-signed'])assert.equal((await s.call(url,{session:tenantCookie})).status,403);
  assert.equal((await s.call('/api/lease-preparations',{session:''})).status,401);
  assert.equal((await s.post('/api/leases',{tenantId:tenant.id,propertyId:s.property.id,startsOn:'2099-01-15',endsOn:'2100-01-14',monthlyRent:1650,deposit:0,notes:'',applicantOfferId:first.invitation.id})).status,409);
  const current=(await s.detail()).preparation;
  const assigned=(await s.json(await s.post(s.path+'/send',{revision:current.revision,confirm:true,delivery:'account',tenantId:tenant.id}))).preparation;
  assert.ok(assigned.lease_id);assert.equal((await s.json(await s.call('/api/leases'))).leases.length,1);
  const thirdBytes=await uploadedPdf('Third applicant original agreement after home assignment');
  const thirdApplicant=await uploadedApplicant(s,'Third Resident','third@example.test',thirdBytes),third=await inviteUploaded(s,thirdApplicant);
  assert.equal((await s.json(await s.guest('open',{token:token(third)}))).agreement.canSign,true);
  assert.equal((await signInvitation(s,third,'Third Resident','third@example.test')).status,200);
  for(const path of ['/api/leases','/api/signatures']){const own=await s.json(await s.call(path,{session:tenantCookie}));assert.doesNotMatch(JSON.stringify(own),/Other Resident|Third Resident|other@example.test|third@example.test/);}
  assert.equal((await s.post(secondApplicant.path+'/upload',{revision:secondApplicant.preparation.revision,name:'replacement.pdf',data:thirdBytes.toString('base64')})).status,409);
  for(const session of [undefined,s.agentCookie]){
   const {preparations}=await s.json(await s.call('/api/lease-preparations',{session}));assert.equal(preparations.length,3);assert.ok(preparations.every(row=>row.invitation.status==='Signed'));
  }
  await s.app.stop();s.app.base=await s.app.start();
  for(const [path,original]of [[s.path,firstBytes],[secondApplicant.path,secondBytes],[thirdApplicant.path,thirdBytes]]){
   const detail=await s.json(await s.call(path));assert.equal(detail.preparation.invitation.status,'Signed');
   assert.deepEqual(Buffer.from(await(await s.call(path+'/invitation-original')).arrayBuffer()),original);
   assert.ok((await PDFDocument.load(await(await s.call(path+'/invitation-signed')).arrayBuffer())).getPageCount()>1);
  }
  const own=(await s.json(await s.guest('open',{token:firstToken,applicationId:secondApplicant.application.id}))).agreement;assert.equal(own.tenantName,'Future Resident');assert.ok(!JSON.stringify(own).includes('Other Resident'));
 }finally{await s.app.cleanup();}
});
test('different applicants can sign concurrently for one address while duplicate signatures on the same invitation are still rejected',async()=>{
 const s=await setup();try{
  await s.save();const first=await s.send(),other=await uploadedApplicant(s,'Concurrent Resident','concurrent@example.test',await uploadedPdf('Concurrent applicant private agreement')),second=await inviteUploaded(s,other);
  const responses=await Promise.all([signInvitation(s,first,'Future Resident','future-resident@example.test'),signInvitation(s,second,other.name,other.email)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  const {preparations}=await s.json(await s.call('/api/lease-preparations'));assert.equal(preparations.filter(p=>p.invitation.status==='Signed').length,2);
  assert.equal((await s.json(await s.call('/api/leases'))).leases.length,0);
  assert.equal((await signInvitation(s,first,'Future Resident','future-resident@example.test')).status,409);
  assert.equal((await s.guest('signed',{token:token(first)})).status,200);assert.equal((await s.guest('signed',{token:token(second)})).status,200);
 }finally{await s.app.cleanup();}
});
test('all 50 states and DC have separate editable templates; jurisdiction changes and missing state review block generated sends',async()=>{
 const s=await setup();try{
  const {jurisdictions}=await s.detail();assert.equal(jurisdictions.length,51);assert.equal(new Set(jurisdictions.map(x=>x.code)).size,51);
  for(const state of jurisdictions){const {template}=await s.json(await s.call('/api/lease-template?state='+state.code));assert.equal(template.state_code,state.code);assert.equal(template.sourceTemplate.stateCode,state.code);if(state.code!=='CA'){assert.match(template.body,/\{\{stateSpecificTerms\}\}/);assert.doesNotMatch(template.body,/Megan's Law|laws of the State of California|\$100\.00/);}}
  assert.equal((await s.call('/api/lease-template?state=ZZ')).status,400);const before=(await s.json(await s.call('/api/lease-template?state=NY'))).template,tx=(await s.json(await s.call('/api/lease-template?state=TX'))).template;
  await s.json(await s.post('/api/lease-template',{stateCode:'TX',revision:tx.revision,title:'Texas company wording',body:tx.body+'\nCompany-provided extra term.'}));assert.equal((await s.json(await s.call('/api/lease-template?state=NY'))).template.body,before.body);assert.equal((await s.post('/api/lease-template',{stateCode:'TX',revision:tx.revision,title:'Stale Texas wording',body:'Stale'})).status,409);
  let p=await s.save({stateCode:'TX',termsStateCode:'CA'});assert.equal((await s.post(s.path+'/send',{revision:p.revision,confirm:true,delivery:'applicant'})).status,400);p=await s.save({stateCode:'TX',termsStateCode:'TX',terms:tx.body,stateSpecificTerms:'',stateReviewConfirmed:false});assert.equal((await s.post(s.path+'/send',{revision:p.revision,confirm:true,delivery:'applicant'})).status,400);
  p=await s.save({stateCode:'TX',termsStateCode:'TX',terms:tx.body,stateSpecificTerms:'Company-reviewed property-specific notice, deposit handling, entry, utility, insurance and disclosure terms are incorporated here for this isolated test.',stateReviewConfirmed:true});const result=await s.send(),opened=(await s.json(await s.guest('open',{token:token(result)}))).agreement;assert.equal(opened.stateName,'Texas');assert.equal(opened.tenancyType,'fixed');
 }finally{await s.app.cleanup();}
});
test('optional invitation email uses the configured outbox, cancels replaced links and stops delivery after approval changes without exposing SMTP secrets',async()=>{
 const s=await setup();const previous=process.env.PUBLIC_APP_URL;try{
  await s.save();await s.app.stop();process.env.PUBLIC_APP_URL='http://127.0.0.1:3000';const connection=s.db();try{
   const messages=[],{createNotifications}=require('../lib/notifications'),{createApplicantLeases}=require('../lib/applicant-leases'),{transaction}=require('../lib/service-utils');const notices=createNotifications(connection,{sendMail:async message=>{messages.push(message);return {id:'isolated-mail-provider'};}}),offers=createApplicantLeases(connection,notices),user=connection.prepare("SELECT id,role FROM users WHERE role='admin'").get(),app=connection.prepare('SELECT * FROM applications WHERE id=?').get(s.application.id),row=connection.prepare('SELECT * FROM lease_preparations WHERE application_id=?').get(app.id),pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
   assert.equal(connection.prepare('SELECT email_updates FROM applications WHERE id=?').get(app.id).email_updates,0);assert.throws(()=>transaction(connection,()=>offers.create(user,app,row,bytes,{email:true})),/Confirm that the applicant/);const first=transaction(connection,()=>offers.create(user,app,row,bytes,{email:true,consent:true}));assert.equal(first.invitation.delivery.status,'Pending');const firstToken=token(first),rotated=offers.link(user,app.id,{offerId:first.invitation.id,expectedUpdatedAt:first.invitation.updatedAt,confirm:true,email:true,emailConsent:true});await notices.drain();assert.equal(messages.length,1);assert.match(messages[0].text,new RegExp(token(rotated)));assert.ok(!messages[0].text.includes(firstToken));assert.equal(offers.dto(offers.latest(app.id)).delivery.status,'Sent');
   const current=offers.latest(app.id);offers.link(user,app.id,{offerId:current.id,expectedUpdatedAt:current.updated_at,confirm:true,email:true,emailConsent:true});connection.prepare("UPDATE applications SET status='Reviewing' WHERE id=?").run(app.id);await notices.drain();assert.equal(messages.length,1);assert.equal(offers.dto(offers.latest(app.id)).delivery.status,'Cancelled');
  }finally{connection.close();}
 }finally{if(previous===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=previous;await s.app.cleanup();}
});
test('documented staff closure releases an unassigned signed agreement without requiring an account or erasing its original and signed copies',async()=>{
 const s=await setup();try{
  await s.save();const result=await s.send(),link=token(result),opened=(await s.json(await s.guest('open',{token:link}))).agreement;await s.json(await s.guest('sign',{token:link,name:'Future Resident',email:'future-resident@example.test',documentHash:opened.documentHash,reviewed:true,consent:true}));let i=(await s.detail()).preparation.invitation;
  await s.json(await s.post(s.path+'/withdraw-invitation',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:true,reason:'Disable public link while reviewing closure'}));assert.equal((await s.guest('signed',{token:link})).status,404);assert.equal((await s.detail()).preparation.invitation.status,'Signed');assert.equal((await s.call(s.path+'/invitation-signed')).status,200);i=(await s.detail()).preparation.invitation;
  assert.equal((await s.post(s.path+'/close-invitation',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:false,reason:'Documented outcome'})).status,400);await s.json(await s.post(s.path+'/close-invitation',{offerId:i.id,expectedUpdatedAt:i.updatedAt,confirm:true,reason:'Management recorded the agreed closure in this isolated test'},s.agentCookie));assert.equal((await s.detail()).preparation.invitation.status,'Closed');assert.equal((await s.call(s.path+'/invitation-signed?offerId='+i.id)).status,200);assert.equal((await s.json(await s.call('/api/admin/users'))).users.length,2);await s.save({deposit:800});const fresh=await s.send();assert.ok(fresh.trackingUrl);assert.equal((await s.detail()).invitationHistory.length,2);
 }finally{await s.app.cleanup();}
});
