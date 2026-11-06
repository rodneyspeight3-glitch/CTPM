const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {fixture}=require('./fixture.cjs');
const {rentalApplication,pdf}=require('./rental-fixtures.cjs');
const inventory=require('./listing-fixtures.cjs');
const image={mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=',caption:'Test photograph'};
async function setup(overrides={}){
 const app=await fixture(overrides);const call=(url,cookie,method='GET',data)=>fetch(app.base+url,{method,headers:{Cookie:cookie||'',Origin:app.base,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(url,cookie,data={})=>call(url,cookie,'POST',data),json=async r=>{assert.ok(r.ok,(await r.clone().text())+' '+r.url);return r.json();};
 const login=async credentials=>{const r=await post('/api/login',null,credentials);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];},admin=await login(app.credentials),users={},cookies={admin};
 for(const role of ['agent','tenant','other']){const data={name:'Test '+role,email:role+'@example.test',role:role==='agent'?'agent':'tenant',password:app.credentials.password};users[role]=(await json(await post('/api/admin/users',admin,data))).user;cookies[role]=await login(data);}
 return {...app,call,post,json,login,admin,users,cookies,get:async(url,cookie)=>json(await call(url,cookie))};
}
test('address applications retain private receipts, prevent duplicate claims, support matching, follow-ups and applicant withdrawal',async()=>{
 const a=await setup();const {post,get,call,json,admin,cookies,users}=a;
 try{
  assert.equal((await post('/api/open-applications',null,rentalApplication())).status,400);
  const input=rentalApplication({email:users.tenant.email,requestedAddress:'  42 Test Road, Unit 2  '}),receipt=await json(await post('/api/open-applications',null,input)),token=new URLSearchParams(receipt.trackingUrl.split('#')[1]).get('receipt');assert.match(receipt.reference,/^APP-[A-F0-9]{12}$/);
  const duplicate=await json(await post('/api/open-applications',null,{...input,name:'Do not overwrite'})),duplicateToken=new URLSearchParams(duplicate.trackingUrl.split('#')[1]).get('receipt');assert.notEqual(receipt.reference,duplicate.reference);
  const apps=(await get('/api/applications',admin)).applications;assert.equal(apps.length,1);const app=apps[0];assert.equal(app.property_id,null);assert.equal(app.requested_address,'42 Test Road, Unit 2');assert.equal(app.origin,'address');
  const status=await json(await post('/api/application-receipts/status',null,{token}));assert.equal(status.reference,receipt.reference);assert.equal(status.status,'Submitted');for(const field of ['name','email','phone','details','staff_note','documents'])assert.equal(field in status,false);
  assert.equal((await post('/api/application-receipts/status',null,{token:receipt.reference})).status,404);
  assert.equal((await get('/api/my-applications',cookies.tenant)).applications.length,0);
  assert.equal((await post('/api/application-receipts/claim',cookies.other,{token})).status,400);
  assert.equal((await post('/api/application-receipts/claim',cookies.tenant,{token:duplicateToken})).status,400);
  assert.equal((await post('/api/application-receipts/claim',cookies.tenant,{token})).status,200);
  assert.equal((await get('/api/my-applications',cookies.tenant)).applications.length,1);
  const property=(await json(await post('/api/properties',admin,inventory[0]))).property;
  assert.equal((await post('/api/applications/'+app.id+'/match',cookies.tenant,{propertyId:property.id})).status,403);
  await json(await post('/api/applications/'+app.id+'/match',cookies.agent,{propertyId:property.id}));await json(await post('/api/applications/'+app.id+'/follow-up',admin,{priority:'Urgent',followUpOn:'2099-01-10'}));
  const detail=(await get('/api/applications/'+app.id,admin)).application;assert.equal(detail.requested_address,'42 Test Road, Unit 2');assert.equal(detail.origin,'address');assert.equal(detail.property_id,property.id);assert.equal(detail.priority,'Urgent');
  const cal=await call('/api/applications/'+app.id+'/calendar',admin);assert.match(await cal.text(),/DTSTART;VALUE=DATE:20990110/);assert.equal((await call('/api/applications/'+app.id+'/calendar',cookies.tenant)).status,403);
  const exported=await get('/api/account/personal-export',cookies.tenant);assert.equal(exported.applications.length,1);for(const term of ['password_hash','staff_note','code_hash','session_id'])assert.equal(JSON.stringify(exported).includes(term),false);
  await json(await post('/api/applications/'+app.id+'/withdraw',cookies.tenant,{reason:'Changed moving plans'}));assert.equal((await json(await post('/api/application-receipts/status',null,{token}))).status,'Withdrawn');assert.equal((await post('/api/applications/'+app.id+'/withdraw',cookies.tenant,{reason:'Again'})).status,409);assert.equal((await get('/api/applications/'+app.id,admin)).application.reviewEvents[0].status,'Withdrawn');
  const db=new DatabaseSync(a.databasePath);assert.equal(db.prepare('SELECT token_hash FROM application_receipts WHERE application_id=?').get(app.id).token_hash.includes(token),false);db.prepare('UPDATE application_receipts SET expires_at=0').run();db.close();assert.equal((await post('/api/application-receipts/status',null,{token})).status,404);assert.equal((await get('/api/my-applications',cookies.tenant)).applications.length,1);
 }finally{await a.cleanup();}
});
test('management identity is separate from email verification and recovery codes reset access once without paid integrations',async()=>{
 const a=await setup({ALLOW_PAID_INTEGRATIONS:'false',RESEND_API_KEY:'synthetic-not-real',EMAIL_FROM:'test@example.test',STRIPE_SECRET_KEY:'sk_test_synthetic_not_real',STRIPE_WEBHOOK_SECRET:'whsec_synthetic_not_real',PUBLIC_APP_URL:'https://ctpm.example.test'});const {post,get,json,admin,cookies,users,call}=a;
 try{
  assert.deepEqual(await get('/api/access-status'),{emailEnabled:false,freeMode:true});assert.equal((await get('/api/integrations',admin)).payments.checkoutEnabled,false);
  assert.equal((await post('/api/admin/identity/'+users.tenant.id,cookies.agent,{method:'In person',note:'Test confirmation'})).status,403);
  await json(await post('/api/admin/identity/'+users.tenant.id,admin,{method:'Known resident',note:'Synthetic identity confirmation'}));const session=await get('/api/session',cookies.tenant);assert.equal(session.user.identityConfirmed,true);assert.equal(session.user.emailVerified,false);
  const property=(await json(await post('/api/properties',admin,inventory[0]))).property,starts=new Date(Date.now()+86400000).toISOString(),ends=new Date(Date.now()+90000000).toISOString(),slot=(await json(await post('/api/tour-slots',admin,{propertyId:property.id,startsAt:starts,endsAt:ends}))).id;
  assert.equal((await post('/api/tours',cookies.tenant,{slotId:slot})).status,201);
  const lease=(await json(await post('/api/leases',admin,{tenantId:users.tenant.id,propertyId:property.id,startsOn:new Date().toISOString().slice(0,10),endsOn:'2099-01-01',monthlyRent:1800,deposit:1000,notes:'Synthetic identity signing test'}))).lease;
  const {PDFDocument}=require('pdf-lib'),document=await PDFDocument.create();document.addPage().drawText('Artificial agreement for isolated testing');const upload=await json(await post('/api/leases/'+lease.id+'/documents',admin,{name:'test.pdf',data:Buffer.from(await document.save()).toString('base64')}));const signature=await json(await post('/api/signatures',admin,{documentId:upload.document.id,title:'Synthetic lease'})),requests=(await get('/api/signatures',cookies.tenant)).requests,signing=requests.find(r=>r.id===signature.id);await json(await post('/api/signatures/'+signature.id+'/sign',cookies.tenant,{name:users.tenant.name,consent:true,documentHash:signing.document_hash}));assert.equal((await get('/api/signatures/'+signature.id+'/evidence',cookies.tenant)).evidence.identityMethod,'Confirmed by management');

  assert.equal((await post('/api/account/recovery-codes',cookies.tenant,{currentPassword:'wrong'})).status,403);
  const codes=await json(await post('/api/account/recovery-codes',cookies.tenant,{currentPassword:a.credentials.password}));assert.equal(codes.codes.length,8);assert.equal((await get('/api/account/recovery-codes',cookies.tenant)).remaining,8);
  const db=new DatabaseSync(a.databasePath);assert.equal(db.prepare('SELECT code_hash FROM recovery_codes').get().code_hash.includes(codes.codes[0]),false);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,0);db.close();
  const next='New test recovery password 123456789',recovery={email:users.tenant.email,code:codes.codes[0],password:next,confirmation:next};assert.equal((await post('/api/account/recover-with-code',null,{...recovery,code:'incorrect'})).status,400);await json(await post('/api/account/recover-with-code',null,recovery));assert.equal((await call('/api/session',cookies.tenant)).status,401);assert.equal((await post('/api/account/recover-with-code',null,recovery)).status,400);assert.equal((await post('/api/login',null,{email:users.tenant.email,password:a.credentials.password})).status,401);const newCookie=await a.login({email:users.tenant.email,password:next});assert.equal((await get('/api/account/recovery-codes',newCookie)).remaining,0);
 }finally{await a.cleanup();}
});
test('portfolio photo saves roll back together, preserve existing photos, and validate ordering and staff-only controls',async()=>{
 const a=await setup();const {post,get,json,admin,cookies}=a;
 try{
  assert.equal((await post('/api/properties',cookies.tenant,{...inventory[0],media:[image]})).status,403);
  const first=(await json(await post('/api/properties',cookies.agent,{...inventory[0],description:'Test house with a bright living area',amenities:['Parking'],media:[image,{...image,caption:'Second photo'},{...image,caption:'Third photo'}],coverIndex:1}))).property;
  assert.ok(first.photoUpdated);let media=await get('/api/properties/'+first.id+'/media',admin);assert.equal(media.photos.length,2);assert.equal(media.photos[0].caption,image.caption);
  await json(await post('/api/properties/'+first.id+'/gallery-order',admin,{ids:media.photos.map(p=>p.id).reverse()}));media=await get('/api/properties/'+first.id+'/media',admin);assert.equal(media.photos[0].caption,'Third photo');assert.equal((await post('/api/properties/'+first.id+'/gallery-order',admin,{ids:[999999]})).status,409);assert.equal((await post('/api/gallery/'+media.photos[0].id+'/cover',admin)).status,200);
  for(let i=0;i<6;i++)await json(await post('/api/properties/'+first.id+'/gallery',admin,image));
  assert.equal((await post('/api/properties/'+first.id+'/edit',admin,{...inventory[0],name:'Should roll back',media:[image,image],coverIndex:0})).status,409);assert.equal((await get('/api/properties',admin)).properties.find(p=>p.id===first.id).name,first.name);
  const before=(await get('/api/properties',admin)).properties.length;assert.equal((await post('/api/properties',admin,{...inventory[0],media:[image,{...image,mime:'text/html'}]})).status,400);assert.equal((await get('/api/properties',admin)).properties.length,before);
  assert.equal((await get('/api/portfolio/quality',cookies.agent)).properties.find(p=>p.id===first.id).score,100);
 }finally{await a.cleanup();}
});
test('workspace recurrence, targeted notices, calendars, private attachments and consistent backups support handover without leaking records',async()=>{
 const a=await setup();const {post,get,json,call,admin,cookies,users}=a;const today=new Date().toISOString().slice(0,10);
 try{
  const property=(await json(await post('/api/properties',admin,inventory[0]))).property;
  await json(await post('/api/workspace/plans',cookies.agent,{title:'Test annual inspection',propertyId:property.id,intervalDays:90,nextDue:today,assigneeId:users.agent.id}));const workspace=await get('/api/workspace',admin);assert.equal(workspace.tasks.length,1);assert.ok(workspace.plans[0].next_due>today);await json(await post('/api/workspace/plans/'+workspace.plans[0].id,admin,{title:'Test annual inspection',propertyId:property.id,intervalDays:90,nextDue:today,assigneeId:users.agent.id,active:true}));assert.equal((await get('/api/workspace',admin)).tasks.length,1);
  assert.equal((await call('/api/workspace',cookies.tenant)).status,403);assert.match(await (await call('/api/calendar',cookies.agent)).text(),/Test annual inspection/);assert.doesNotMatch(await (await call('/api/calendar',cookies.tenant)).text(),/Test annual inspection/);
  await json(await post('/api/community',admin,{title:'Private resident update',body:'Synthetic notice',audience:'residents',targetUserId:users.tenant.id,pinned:true,expiresOn:''}));await json(await post('/api/community',admin,{title:'Team-only update',body:'Private staff content',audience:'staff',pinned:false,expiresOn:''}));assert.equal((await get('/api/community',cookies.tenant)).notices.length,1);assert.equal((await get('/api/community',cookies.other)).notices.length,0);assert.equal((await get('/api/community',cookies.agent)).notices.length,2);assert.equal((await post('/api/community',cookies.tenant,{title:'No'})).status,403);
  const req=(await json(await post('/api/requests',cookies.tenant,{title:'Artificial tap repair',description:'Synthetic issue',location:'Test unit',category:'Plumbing',priority:'Routine',propertyId:property.id}))).request;
  assert.equal((await call('/api/work-orders/'+req.id,cookies.other)).status,404);const work=await call('/api/work-orders/'+req.id,cookies.tenant);assert.match(Buffer.from(await work.arrayBuffer()).toString('ascii',0,5),/%PDF-/);
  const expense=(await json(await post('/api/expenses',admin,{propertyId:property.id,category:'Repairs',payee:'Test Vendor',amount:50,paidOn:today,description:'Synthetic payment'}))).id,file=(await json(await post('/api/expense-files/'+expense,cookies.agent,{name:'test-receipt.pdf',mime:'application/pdf',data:pdf.toString('base64')}))).id;
  assert.equal((await call('/api/expense-attachments/'+file+'/download',cookies.tenant)).status,403);assert.deepEqual(Buffer.from(await (await call('/api/expense-attachments/'+file+'/download',admin)).arrayBuffer()),pdf);
  assert.equal((await post('/api/handover/backup',cookies.agent,{currentPassword:a.credentials.password})).status,403);assert.equal((await post('/api/handover/backup',admin,{currentPassword:'wrong'})).status,403);const snapshot=await post('/api/handover/backup',admin,{currentPassword:a.credentials.password});assert.equal(snapshot.status,200);assert.match(snapshot.headers.get('cache-control'),/no-store/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-restoration-'));try{const restoredPath=path.join(dir,'restored.sqlite');fs.writeFileSync(restoredPath,Buffer.from(await snapshot.arrayBuffer()));const restored=new DatabaseSync(restoredPath);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM users').get().n,4);assert.deepEqual(Buffer.from(restored.prepare('SELECT data FROM expense_files').get().data),pdf);restored.close();}finally{fs.rmSync(dir,{recursive:true,force:true});}
  await json(await post('/api/expense-attachments/'+file+'/remove',admin,{reason:'Test retention completed'}));assert.equal((await call('/api/expense-attachments/'+file+'/download',admin)).status,404);assert.equal((await get('/api/handover',admin)).report.database.ok,true);assert.equal((await call('/api/handover',cookies.tenant)).status,403);assert.ok((await get('/api/handover/audit',admin)).events.length>0);await json(await post('/api/handover/checklist',admin,{key:'backup',done:true}));assert.equal((await get('/api/handover',admin)).report.checklist[0].done,1);
  await json(await post('/api/notifications/read-all',cookies.tenant));assert.ok((await get('/api/notifications',cookies.tenant)).notifications.every(n=>n.read_at));assert.ok((await get('/api/notifications',cookies.agent)).notifications.some(n=>!n.read_at));
 }finally{await a.cleanup();}
});
test('legacy required-property migration preserves application IDs, binary files, events, indexes and foreign keys across restarts',()=>{
 const {createManagement}=require('../lib/management'),{createVacancies}=require('../lib/vacancies'),db=new DatabaseSync(':memory:');try{
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO users VALUES(1,'Test Admin');");createManagement(db);db.prepare('INSERT INTO properties(name,area,address,price,beds,baths,size,type,image,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('Legacy home','Town','1 Test Lane',1000,2,1,900,'HOUSE',1,1,'2026-01-01');
 db.exec("CREATE TABLE applications(id INTEGER PRIMARY KEY,property_id INTEGER NOT NULL REFERENCES properties(id),name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,phone TEXT NOT NULL,move_in TEXT NOT NULL,occupants INTEGER NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Submitted',staff_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),UNIQUE(property_id,email)); INSERT INTO applications VALUES(25,1,'Earlier Applicant','earlier@example.test','202-555-0100','2099-01-01',2,'Earlier message','Reviewing','Keep note','2026-01-01','2026-01-02',1); CREATE TABLE application_documents(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),kind TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT NOT NULL); CREATE INDEX legacy_email_lookup ON applications(email); CREATE TABLE application_events(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),status TEXT NOT NULL,note TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL); INSERT INTO application_events VALUES(12,25,'Reviewing','Retain event',1,'2026-01-02');");db.prepare('INSERT INTO application_documents VALUES(8,25,?,?,?,?,?)').run('income','retained.pdf','application/pdf',pdf,'2026-01-01');
 for(let i=0;i<2;i++){const service=createVacancies(db),app=service.application({role:'admin'},25);assert.equal(app.id,25);assert.equal(app.staff_note,'Keep note');assert.equal(app.documents[0].id,8);assert.equal(app.reviewEvents[0].note,'Retain event');assert.deepEqual(Buffer.from(db.prepare('SELECT data FROM application_documents').get().data),pdf);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='legacy_email_lookup'").get());assert.equal(db.prepare('PRAGMA table_info(applications)').all().find(c=>c.name==='property_id').notnull,0);}
 }finally{db.close();}
});
