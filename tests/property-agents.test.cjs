const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fixture}=require('./fixture.cjs'),inventory=require('./listing-fixtures.cjs');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3X8AAAAASUVORK5CYII=';
async function setup(){const app=await fixture({SMTP_ENABLED:'false'}),cookies={},users={};const call=(url,{method='GET',data,cookie=cookies.admin}={})=>fetch(app.base+url,{method,headers:{Origin:app.base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(data||{})})});const login=async email=>{const r=await call('/api/login',{method:'POST',data:{email,password:app.credentials.password},cookie:''});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};cookies.admin=await login(app.credentials.email);const post=async(url,data,cookie=cookies.admin)=>{const r=await call(url,{method:'POST',data,cookie});return {status:r.status,data:await r.json()};};for(const role of ['alpha','beta','tenant']){const u=(await post('/api/admin/users',{name:'Test '+role,email:role+'-private@example.test',password:app.credentials.password,role:role==='tenant'?'tenant':'agent'})).data.user;users[role]=u;cookies[role]=await login(u.email);}return {app,call,post,cookies,users};}
test('agent-created properties assign their creator; admin co-agents persist and public DTOs contain only public profile fields',async()=>{
 const s=await setup();try{
  await s.post('/api/admin/agents/'+s.users.alpha.id+'/profile',{displayName:'Alex <public>',title:'Leasing agent',bio:'Public biography',email:'alex-public@example.test',phone:'+1 555 010 1234',areas:'Cedar'});
  await s.post('/api/admin/agents/'+s.users.alpha.id+'/photo',{mime:'image/png',data:png});
  let created=await s.post('/api/properties',inventory[0],s.cookies.alpha);assert.equal(created.status,201);let property=created.data.property;assert.deepEqual(property.assignedAgentIds,[s.users.alpha.id]);assert.equal(property.agents[0].name,'Alex <public>');assert.equal(property.agents[0].email,'alex-public@example.test');assert.equal(property.agents[0].hasPhoto,1);
  const peerEdit=await s.post('/api/properties/'+property.id+'/edit',{...inventory[0],name:'Edited by another agent'},s.cookies.beta);assert.equal(peerEdit.status,200);assert.deepEqual(peerEdit.data.property.assignedAgentIds,[s.users.alpha.id]);
  for(const who of ['alpha','beta'])assert.equal((await s.post('/api/properties/'+property.id+'/edit',{...inventory[0],agentIds:[s.users.beta.id]},s.cookies[who])).status,403);
  assert.equal((await s.post('/api/properties',inventory[0],s.cookies.tenant)).status,403);
  let changed=await s.post('/api/properties/'+property.id+'/edit',{...inventory[0],agentIds:[s.users.alpha.id,s.users.beta.id]});assert.equal(changed.status,200);assert.equal(changed.data.property.agents.length,2);
  const response=await s.call('/api/vacancies',{cookie:''}),publicData=await response.json();property=publicData.properties.find(p=>p.id===property.id);assert.equal(property.agents.length,2);assert.equal(property.assignedAgentIds,undefined);assert.equal(property.unavailableAgents,undefined);assert.doesNotMatch(JSON.stringify(property),/alpha-private|beta-private|password_hash|photo_data|created_by/);
  assert.deepEqual(Object.keys(property.agents[0]).sort(),['areas','bio','email','hasPhoto','id','name','phone','title','updated_at'].sort());
  const before=(await(await s.call('/api/properties')).json()).properties.length;
  for(const ids of [[s.users.tenant.id],[999999],[s.users.alpha.id,s.users.alpha.id],['2']])assert.equal((await s.post('/api/properties',{...inventory[0],agentIds:ids})).status,400);
  assert.equal((await(await s.call('/api/properties')).json()).properties.length,before);
  await s.app.stop();s.app.base=await s.app.start();const nextCookie=await fetch(s.app.base+'/api/login',{method:'POST',headers:{Origin:s.app.base,'Content-Type':'application/json'},body:JSON.stringify(s.app.credentials)});const persisted=await(await fetch(s.app.base+'/api/properties',{headers:{Cookie:nextCookie.headers.get('set-cookie').split(';')[0]}})).json();assert.equal(persisted.properties[0].agents.length,2);
 }finally{await s.app.cleanup();}
});
test('reassignment refreshes saved-home agents, unavailable agents disappear publicly, and failed photo edits roll back assignments',async()=>{
 const s=await setup();try{
  const media=Array.from({length:9},(_,i)=>({mime:'image/png',data:png,caption:'Test photo '+i}));let property=(await s.post('/api/properties',{...inventory[0],media},s.cookies.alpha)).data.property;
  assert.equal((await s.post('/api/properties/'+property.id+'/save',{saved:true},s.cookies.tenant)).status,200);
  const failed=await s.post('/api/properties/'+property.id+'/edit',{...inventory[0],agentIds:[s.users.beta.id],media:media.slice(0,2)});assert.ok([400,409].includes(failed.status));assert.deepEqual((await(await s.call('/api/properties')).json()).properties[0].assignedAgentIds,[s.users.alpha.id]);
  const changed=await s.post('/api/properties/'+property.id+'/edit',{...inventory[0],available:false,agentIds:[s.users.beta.id]});assert.equal(changed.status,200);
  let saved=(await(await s.call('/api/saved-homes',{cookie:s.cookies.tenant})).json()).properties[0];assert.equal(saved.available,false);assert.equal(saved.agents[0].id,s.users.beta.id);assert.equal(saved.assignedAgentIds,undefined);
  await s.post('/api/admin/users/'+s.users.beta.id,{name:s.users.beta.name,email:s.users.beta.email,role:'agent',active:false});
  saved=(await(await s.call('/api/saved-homes',{cookie:s.cookies.tenant})).json()).properties[0];assert.deepEqual(saved.agents,[]);assert.equal(saved.unavailableAgents,undefined);
  property=(await(await s.call('/api/properties')).json()).properties[0];assert.deepEqual(property.assignedAgentIds,[s.users.beta.id]);assert.equal(property.unavailableAgents[0].id,s.users.beta.id);
  assert.equal((await s.post('/api/properties',{...inventory[0],agentIds:[s.users.beta.id]})).status,400);
  const showcase=await s.post('/api/properties',{...inventory[0],name:'Concept property',available:false,isPreview:true,agentIds:[s.users.alpha.id]});assert.equal(showcase.status,201);assert.equal((await(await s.call('/api/showcase',{cookie:''})).json()).properties[0].agents[0].id,s.users.alpha.id);assert.equal((await s.post('/api/properties/'+showcase.data.property.id+'/delete',{})).status,200);
 }finally{await s.app.cleanup();}
});
test('the legacy creator backfill is one-time and never restores an assignment an administrator changed or removed',async()=>{
 const {createAuth}=require('../lib/auth'),{createManagement}=require('../lib/management');const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-agent-migration-')),file=path.join(directory,'test.sqlite');let auth;
 try{
  auth=await createAuth(file);const password='Test-only long password 123456789',admin=await auth.addUser({name:'Admin',email:'migration-admin@example.test',role:'admin',password}),agent=await auth.addUser({name:'Original agent',email:'migration-agent@example.test',role:'agent',password}),other=await auth.addUser({name:'Next agent',email:'migration-next@example.test',role:'agent',password});
  auth.db.exec('CREATE TABLE properties(id INTEGER PRIMARY KEY,name TEXT,area TEXT,address TEXT,price REAL,beds INTEGER,baths REAL,size INTEGER,type TEXT,image INTEGER,created_by INTEGER,created_at TEXT)');const p=inventory[0];auth.db.prepare('INSERT INTO properties VALUES(1,?,?,?,?,?,?,?,?,?,?,?)').run(p.name,p.area,p.address,p.price,p.beds,p.baths,p.size,p.type,p.image,agent.id,'2026-01-01');
  let management=createManagement(auth.db);assert.deepEqual(management.listProperties(admin)[0].assignedAgentIds,[agent.id]);management.editProperty(admin,1,{...p,agentIds:[other.id]});assert.equal(auth.db.prepare('SELECT created_by FROM properties').get().created_by,agent.id);auth.db.close();auth=await createAuth(file);management=createManagement(auth.db);assert.deepEqual(management.listProperties(admin)[0].assignedAgentIds,[other.id]);management.editProperty(admin,1,{...p,agentIds:[]});auth.db.close();auth=await createAuth(file);management=createManagement(auth.db);assert.deepEqual(management.listProperties(admin)[0].assignedAgentIds,[]);assert.equal(auth.db.prepare('SELECT COUNT(*) AS n FROM property_agent_migrations').get().n,1);
 }finally{auth?.db.close();fs.rmSync(directory,{recursive:true,force:true});}
});
