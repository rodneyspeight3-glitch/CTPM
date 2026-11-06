const {rentalApplication}=require('./rental-fixtures.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
test('public vacancy applications and staff reviews enforce availability and privacy and persist',async()=>{
 const app=await fixture();let base=app.base;
 const call=(url,{cookie,method='GET',data,origin=base}={})=>fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(url,cookie,data,origin)=>call(url,{method:'POST',cookie,data,origin});
 const login=async credentials=>{const r=await post('/api/login',null,credentials);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 try{
  const admin=await login(app.credentials);
  const cookies={admin};
  for(const role of ['tenant','agent']){const user={name:role,email:role+'@example.test',password:app.credentials.password,role};assert.equal((await post('/api/admin/users',admin,user)).status,201);cookies[role]=await login(user);}
  const properties=[];
  for(const [i,property] of inventory.entries()){const r=await post('/api/properties',i%2?admin:cookies.agent,property);assert.equal(r.status,201);properties.push((await r.json()).property);}
  const available=await (await call('/api/vacancies')).json();assert.equal(available.properties.length,4);
  assert.equal(available.properties.some(p=>p.name==='Occupied home'),false);
  assert.equal('created_by' in available.properties[0],false);
  assert.equal((await (await call('/api/properties',{cookie:cookies.tenant})).json()).properties.length,4);
  assert.equal((await (await call('/api/properties',{cookie:admin})).json()).properties.length,5);
  assert.equal((await post('/api/properties',admin,{...inventory[0],available:'true'})).status,400);
  const id=properties[0].id,closedId=properties[4].id;
  const applicant=rentalApplication({name:'New Applicant <test>',email:'applicant@example.test',phone:'+1 (202) 555-0123',moveIn:'2099-01-15',occupants:2,message:'Interested in this home.',consent:true});
  const url='/api/vacancies/'+id+'/applications';
  assert.equal((await call('/vacancies')).status,200);
  assert.equal((await post(url,null,applicant,'https://evil.example')).status,403);
  for(const changes of [{name:' '},{email:'invalid'},{phone:'abc'},{moveIn:'2000-01-01'},{moveIn:'2099-02-30'},{occupants:0},{occupants:'2'},{message:'x'.repeat(2001)},{consent:false}])assert.equal((await post(url,null,{...applicant,...changes})).status,400);
  assert.equal((await post('/api/vacancies/'+closedId+'/applications',null,applicant)).status,409);
  assert.equal((await post('/api/vacancies/999999/applications',null,applicant)).status,409);
  const receipt=await post(url,null,applicant);assert.equal(receipt.status,200);assert.deepEqual(Object.keys(await receipt.json()),['message','reference','trackingUrl']);
  assert.equal((await post(url,null,{...applicant,name:'Changed name'})).status,200);
  assert.equal((await call('/api/applications')).status,401);
  assert.equal((await call('/api/applications',{cookie:cookies.tenant})).status,403);
  const apps=(await (await call('/api/applications',{cookie:cookies.agent})).json()).applications;
  assert.equal(apps.length,1);assert.equal(apps[0].name,applicant.name);assert.equal(apps[0].status,'Submitted');
  const update='/api/applications/'+apps[0].id+'/status';
  assert.equal((await post(update,cookies.tenant,{status:'Closed',note:''})).status,403);
  assert.equal((await post(update,admin,{status:'Bogus',note:''})).status,400);
  assert.equal((await post(update,cookies.agent,{status:'Reviewing',note:'Contact applicant.'})).status,200);
  assert.equal((await post('/api/properties/'+id+'/availability',cookies.tenant,{available:false})).status,403);
  assert.equal((await post('/api/properties/'+id+'/availability',admin,{available:'false'})).status,400);
  assert.equal((await post('/api/properties/'+id+'/availability',cookies.agent,{available:false})).status,200);
  assert.equal((await post(url,null,{...applicant,email:'another@example.test'})).status,409);
  assert.equal((await (await call('/api/vacancies')).json()).properties.length,3);
  await app.stop();base=await app.start();
  const stored=(await (await call('/api/applications',{cookie:admin})).json()).applications;
  assert.equal(stored[0].status,'Reviewing');assert.equal(stored[0].staff_note,'Contact applicant.');assert.equal(stored[0].property_available,0);
  assert.equal((await post('/api/properties/'+id+'/availability',admin,{available:true})).status,200);
  assert.equal((await (await call('/api/vacancies')).json()).properties.length,4);
  let rateLimited=false;
  for(let i=0;i<201;i++){if((await post(url,null,applicant)).status===429){rateLimited=true;break;}}
  assert.equal(rateLimited,true);
 }finally{await app.cleanup();}
});
test('legacy properties migrate without publishing old inventory or losing data',()=>{
 const {DatabaseSync}=require('node:sqlite');
 const {createManagement}=require('../lib/management');
 const {createVacancies}=require('../lib/vacancies');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO users VALUES(1,'Existing admin');
   CREATE TABLE properties(id INTEGER PRIMARY KEY,name TEXT,area TEXT,address TEXT,price REAL,beds INTEGER,baths REAL,size INTEGER,type TEXT,image INTEGER,created_by INTEGER,created_at TEXT);
   INSERT INTO properties VALUES(1,'Existing home','Existing area','Existing address',1000,2,1,900,'APARTMENT',1,1,'2026-01-01');`);
  for(let i=0;i<2;i++){
   const management=createManagement(db),vacancies=createVacancies(db);
   assert.equal(management.listProperties({role:'admin'})[0].available,false);
   assert.equal(vacancies.listVacancies().length,0);
   assert.equal(db.prepare('SELECT name FROM users').get().name,'Existing admin');
   assert.equal(db.prepare('SELECT name FROM properties').get().name,'Existing home');
  }
 }finally{db.close();}
});
