const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const {rentalApplication,pdf}=require('./rental-fixtures.cjs');
const inventory=require('./listing-fixtures.cjs');
test('complete applications and uploads validate atomically, remain private, survive restart, and support audited document removal',async()=>{
 const app=await fixture();let base=app.base;
 const call=(path,cookie,method='GET',data,origin=base)=>fetch(base+path,{method,headers:{Cookie:cookie||'',Origin:origin,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(path,cookie,data,origin)=>call(path,cookie,'POST',data,origin);
 const login=async data=>{const r=await post('/api/login',null,data);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const get=async(path,cookie)=>{const r=await call(path,cookie);assert.equal(r.status,200);return r.json();};
 try{
  const admin=await login(app.credentials),cookies={};
  for(const role of ['agent','tenant']){const u={name:role,email:role+'@example.test',password:app.credentials.password,role};assert.equal((await post('/api/admin/users',admin,u)).status,201);cookies[role]=await login(u);}
  const property=(await (await post('/api/properties',admin,inventory[0])).json()).property,url='/api/vacancies/'+property.id+'/applications',data=rentalApplication({name:'Applicant <script>alert(1)</script>',hasPets:true,petDetails:'One indoor cat <test>'});
  const badDoc=changes=>({...data.documents[0],...changes});
  for(const changes of [{currentAddress:''},{leaseDuration:''},{creditScore:299},{creditScore:851},{creditScore:'700'},{monthlyIncome:-1},{monthlyIncome:0.001},{rentInterruption:''},{employer:''},{landlordPhone:'abc'},{evicted:'false'},{bankruptcy:undefined},{smokes:null},{hasPets:undefined},{petDetails:''},{documents:[]},{documents:[data.documents[0]]},{documents:[badDoc({kind:'additional'}),badDoc({kind:'income'})]},{documents:[badDoc({mime:'text/html'}),data.documents[1]]},{documents:[badDoc({data:Buffer.from('<script>bad</script>').toString('base64')}),data.documents[1]]},{documents:[badDoc({data:Buffer.alloc(2097153,65).toString('base64')}),data.documents[1]]},{documents:Array(6).fill(data.documents[0])},{documents:[badDoc({name:'bad\r\nname.pdf'}),data.documents[1]]}]){
   const result=await post(url,null,{...data,...changes});assert.equal(result.status,400,JSON.stringify(Object.keys(changes)));
  }
  assert.equal((await get('/api/applications',admin)).applications.length,0);
  assert.equal((await post(url,null,data)).status,200);
  const list=(await get('/api/applications',cookies.agent)).applications;assert.equal(list.length,1);assert.equal(list[0].document_count,2);assert.equal('details' in list[0],false);assert.equal('documents' in list[0],false);
  const id=list[0].id,fullPath='/api/applications/'+id;
  const detail=(await get(fullPath,admin)).application;
  assert.equal(detail.form_version,2);assert.equal(detail.details.monthlyIncomeCents,450025);assert.equal(detail.details.creditScore,700);assert.equal(detail.details.petDetails,'One indoor cat <test>');assert.equal('data' in detail.documents[0],false);
  const download='/api/application-documents/'+detail.documents[0].id+'/download',remove=download.replace('/download','/delete');
  for(const path of [fullPath,download]){assert.equal((await call(path)).status,401);assert.equal((await call(path,cookies.tenant)).status,403);}
  assert.equal((await post(remove,cookies.tenant,{reason:'No longer needed'})).status,403);
  assert.equal((await post(remove,admin,{reason:'No longer needed'},'https://evil.example')).status,403);
  for(const staff of [admin,cookies.agent]){const r=await call(download,staff);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('content-disposition'),/^attachment;/);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),pdf);}
  assert.equal((await call(download,cookies.agent,'HEAD')).status,200);
  const repeated=await post(url,null,rentalApplication({name:'Overwritten',documents:[badDoc({name:'replacement.pdf'}),data.documents[1]]}));assert.equal(repeated.status,200);assert.deepEqual(Object.keys(await repeated.json()),['message']);
  const unchanged=(await get(fullPath,admin)).application;assert.equal(unchanged.name,data.name);assert.equal(unchanged.documents.length,2);assert.equal(unchanged.documents[0].name,'test-income.pdf');
  // First-time renters, non-employed applicants, and unknown credit scores can still apply.
  assert.equal((await post(url,null,rentalApplication({email:'first-rental@example.test',creditScore:null,creditScoreUnknown:true,employer:'N/A',jobTitle:'N/A',employmentLength:'N/A',monthlyIncome:0,landlordName:'N/A',landlordPhone:'N/A',leavingReason:'First rental'}))).status,200);
  await app.stop();base=await app.start();
  assert.equal((await get(fullPath,admin)).application.documents.length,2);assert.deepEqual(Buffer.from(await (await call(download,admin)).arrayBuffer()),pdf);
  assert.equal((await post(remove,admin,{reason:''})).status,400);assert.equal((await call(download,admin)).status,200);
  assert.equal((await post(remove,cookies.agent,{reason:'Review complete; retention period ended.'})).status,200);
  assert.equal((await call(download,admin)).status,404);
  const after=(await get(fullPath,admin)).application;assert.equal(after.documents.length,1);assert.equal(after.documentEvents.length,1);assert.equal(after.documentEvents[0].reason,'Review complete; retention period ended.');assert.equal(after.name,data.name);
  await app.stop();base=await app.start();assert.equal((await get(fullPath,admin)).application.documentEvents.length,1);assert.equal((await call(download,admin)).status,404);
 }finally{await app.cleanup();}
});
test('pre-existing applications migrate without losing contact details or staff reviews',()=>{
 const {DatabaseSync}=require('node:sqlite'),{createManagement}=require('../lib/management'),{createVacancies}=require('../lib/vacancies'),db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT); INSERT INTO users VALUES(1,'Admin');");createManagement(db);
  db.prepare('INSERT INTO properties(name,area,address,price,beds,baths,size,type,image,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('Legacy home','Town','1 Test Lane',1000,2,1,900,'HOUSE',1,1,'2026-01-01');
  db.exec(`CREATE TABLE applications(id INTEGER PRIMARY KEY,property_id INTEGER NOT NULL REFERENCES properties(id),name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,phone TEXT NOT NULL,move_in TEXT NOT NULL,occupants INTEGER NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Submitted',staff_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),UNIQUE(property_id,email));
  INSERT INTO applications VALUES(1,1,'Earlier Applicant','earlier@example.test','202-555-0100','2099-01-01',2,'Earlier message','Reviewing','Keep this note','2026-01-01','2026-01-02',1);`);
  for(let i=0;i<2;i++){const service=createVacancies(db),a=service.application({role:'admin'},1);assert.equal(a.form_version,1);assert.deepEqual(a.details,{});assert.equal(a.name,'Earlier Applicant');assert.equal(a.staff_note,'Keep this note');assert.equal(a.status,'Reviewing');assert.deepEqual(a.documents,[]);}
 }finally{db.close();}
});
