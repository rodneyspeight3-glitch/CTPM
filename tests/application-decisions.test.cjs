const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs'),{rentalApplication}=require('./rental-fixtures.cjs'),inventory=require('./listing-fixtures.cjs');
async function setup(){
 const app=await fixture({SMTP_ENABLED:'false'}),cookies={},users={};
 const call=(url,{method='GET',data,cookie=cookies.admin,origin=app.base}={})=>fetch(app.base+url,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(data||{})})});
 const json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json();},post=(url,data,cookie=cookies.admin)=>call(url,{method:'POST',data,cookie});
 const login=async email=>{const response=await post('/api/login',{email,password:app.credentials.password},'');assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};cookies.admin=await login(app.credentials.email);
 for(const role of ['agent','tenant','other']){users[role]=(await json(await post('/api/admin/users',{name:'Decision '+role,email:role+'-decision@example.test',password:app.credentials.password,role:role==='agent'?'agent':'tenant'}))).user;cookies[role]=await login(users[role].email);}
 const property=(await json(await post('/api/properties',inventory[0]))).property;
 const create=async(index,{listed=true,email=users.tenant.email}={})=>{const receipt=await json(await post(listed?'/api/vacancies/'+property.id+'/applications':'/api/open-applications',rentalApplication({email,requestedAddress:index+' Decision Avenue'}),''));const application=(await json(await call('/api/applications'))).applications.find(a=>a.reference===receipt.reference);return {application,token:receipt.trackingUrl.split('=')[1]};};
 const detail=async id=>(await json(await call('/api/applications/'+id))).application;
 return {app,cookies,users,call,json,post,property,create,detail};
}
test('agents and admins confirm approvals and rejections, preserve private notes and history, and publish decisions only through authorized tracking',async()=>{
 const s=await setup();try{
  let index=0;const cases=[];
  for(const role of ['admin','agent'])for(const status of ['Approved','Rejected']){
   const {application:a,token}=await s.create(++index,{listed:index===1});const path='/api/applications/'+a.id+'/status',input={status,note:'PRIVATE REVIEW '+index,expectedUpdatedAt:a.updated_at,confirmDecision:true};assert.equal((await s.post('/api/application-receipts/claim',{token},s.cookies.tenant)).status,200);
   assert.equal((await s.post(path,input,'')).status,401);assert.equal((await s.post(path,input,s.cookies.tenant)).status,403);
   assert.equal((await s.call(path,{method:'POST',data:input,cookie:s.cookies[role],origin:'https://evil.example'})).status,403);
   assert.equal((await s.post(path,{...input,confirmDecision:false},s.cookies[role])).status,400);assert.equal((await s.post(path,{...input,confirmDecision:'true'},s.cookies[role])).status,400);
   assert.equal((await s.post(path,{status,note:'PRIVATE',confirmDecision:true},s.cookies[role])).status,409);
   assert.equal((await s.post(path,{...input,expectedUpdatedAt:'stale'},s.cookies[role])).status,409);assert.equal((await s.detail(a.id)).reviewEvents.length,1);
   const result=await s.post(path,input,s.cookies[role]);assert.equal(result.status,200);assert.equal((await result.json()).application.status,status);
   const detail=await s.detail(a.id);assert.equal(detail.staff_note,input.note);assert.equal(detail.reviewEvents.length,2);assert.equal(detail.reviewEvents[0].status,status);assert.equal(detail.reviewEvents[0].staff_name,role==='admin'?'Company Administrator':'Decision agent');assert.ok(detail.updated_at>a.updated_at);
   assert.equal((await s.post('/api/application-receipts/claim',{token},s.cookies.tenant)).status,200);
   const receipt=await s.json(await s.post('/api/application-receipts/status',{token},''));assert.equal(receipt.status,status);assert.doesNotMatch(JSON.stringify(receipt),/PRIVATE REVIEW|staff_name|reviewEvents|staff_note|monthlyIncome|creditScore/);
   assert.equal((await s.post('/api/applications/'+a.id+'/withdraw',{reason:'Cannot replace a completed decision'},s.cookies.tenant)).status,409);cases.push({id:a.id,status});
  }
  const mine=(await s.json(await s.call('/api/my-applications',{cookie:s.cookies.tenant}))).applications;assert.equal(mine.length,4);assert.doesNotMatch(JSON.stringify(mine),/PRIVATE REVIEW|staff_note|reviewEvents|staff_name/);assert.equal((await s.json(await s.call('/api/my-applications',{cookie:s.cookies.other}))).applications.length,0);assert.equal((await s.call('/api/applications/'+cases[0].id,{cookie:s.cookies.tenant})).status,403);
  const notifications=(await s.json(await s.call('/api/notifications',{cookie:s.cookies.tenant}))).notifications;assert.ok(notifications.some(n=>n.title==='Your application was rejected'));assert.doesNotMatch(JSON.stringify(notifications),/PRIVATE REVIEW/);
  const vacancies=(await s.json(await s.call('/api/vacancies',{cookie:''}))).properties;assert.ok(vacancies.some(p=>p.id===s.property.id));assert.equal((await s.json(await s.call('/api/leases'))).leases.length,0);
  await s.app.stop();s.app.base=await s.app.start();for(const item of cases){const detail=await s.detail(item.id);assert.equal(detail.status,item.status);assert.equal(detail.reviewEvents.length,2);}
 }finally{await s.app.cleanup();}
});
test('stale decisions cannot overwrite staff work and closed, withdrawn or decided reviews must be reopened before a new decision',async()=>{
 const s=await setup();try{
  const {application:a}=await s.create(10),path='/api/applications/'+a.id+'/status';
  await s.json(await s.post(path,{status:'Reviewing',note:'Agent reviewed',expectedUpdatedAt:a.updated_at},s.cookies.agent));
  assert.equal((await s.post(path,{status:'Approved',note:'STALE NOTE',expectedUpdatedAt:a.updated_at,confirmDecision:true})).status,409);assert.equal((await s.detail(a.id)).staff_note,'Agent reviewed');
  let current=await s.detail(a.id);await s.json(await s.post(path,{status:'Approved',note:'Approval note',expectedUpdatedAt:current.updated_at,confirmDecision:true}));current=await s.detail(a.id);
  assert.equal((await s.post(path,{status:'Rejected',note:'Direct replacement',expectedUpdatedAt:current.updated_at,confirmDecision:true})).status,409);
  await s.json(await s.post(path,{status:'Reviewing',note:'Reopened for correction',expectedUpdatedAt:current.updated_at}));current=await s.detail(a.id);
  await s.json(await s.post(path,{status:'Rejected',note:'Corrected decision',expectedUpdatedAt:current.updated_at,confirmDecision:true},s.cookies.agent));current=await s.detail(a.id);assert.deepEqual(current.reviewEvents.map(e=>e.status),['Rejected','Reviewing','Approved','Reviewing','Submitted']);
  assert.equal((await s.post(path,{status:'Rejected',note:'No latest version'})).status,409);
  await s.json(await s.post(path,{status:'Rejected',note:'Private note changed',expectedUpdatedAt:current.updated_at}));assert.equal((await s.detail(a.id)).staff_note,'Private note changed');
  for(const status of ['Closed','Withdrawn']){const {application:other}=await s.create(status,{listed:false});const update='/api/applications/'+other.id+'/status';await s.json(await s.post(update,{status,note:'Legacy status retained'}));const version=(await s.detail(other.id)).updated_at;assert.equal((await s.post(update,{status:'Approved',note:'',confirmDecision:true,expectedUpdatedAt:version})).status,409);assert.equal((await s.detail(other.id)).status,status);}
  assert.equal((await s.post(path,{status:'approve',note:''})).status,400);
 }finally{await s.app.cleanup();}
});
