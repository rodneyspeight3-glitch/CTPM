const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('properties and maintenance enforce roles, isolate tenants, and survive server restart',async()=>{
 const app=await fixture();let base=app.base;
 const request=(url,{method='GET',data,cookie,origin=base}={})=>fetch(base+url,{method,headers:{...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(url,cookie,data,origin)=>request(url,{method:'POST',cookie,data,origin});
 const login=async user=>{const r=await post('/api/login',null,user);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const property={name:'Willow <test>',address:'123 Test Street',area:'Downtown',price:1250.50,beds:2,baths:1.5,size:1000,type:'APARTMENT',image:1,available:true};
 const issue={title:'Leaking faucet <test>',description:'Kitchen faucet drips.',location:'123 Test Street, Unit 2',category:'Plumbing',priority:'Urgent'};
 try{
  const admin=await login(app.credentials);
  const accounts={};
  for(const [name,role] of [['agent','agent'],['tenant','tenant'],['other','tenant']]){
   const user={name,email:name+'@example.test',role,password:app.credentials.password};
   const r=await post('/api/admin/users',admin,user);assert.equal(r.status,201);
   accounts[name]=await login(user);
  }
  for(const url of ['/api/properties','/api/requests'])assert.equal((await request(url)).status,401);
  assert.equal((await post('/api/properties',accounts.tenant,property)).status,403);
  assert.equal((await post('/api/properties',accounts.agent,property,'https://evil.example')).status,403);
  for(const [key,value] of [['price',-1],['beds',1.1],['size','1000'],['image',4],['type','invalid'],['name',' '],['address','x'.repeat(251)],['price',null]])assert.equal((await post('/api/properties',admin,{...property,[key]:value})).status,400,key);
  const p=await post('/api/properties',accounts.agent,property);assert.equal(p.status,201);const saved=(await p.json()).property;
  assert.equal(saved.name,property.name);
  assert.equal((await post('/api/properties',admin,{...property,name:'Admin home'})).status,201);
  assert.equal((await (await request('/api/properties',{cookie:accounts.tenant})).json()).properties.length,0);
  assert.equal((await post('/api/requests',admin,issue)).status,403);
  for(const changes of [{title:' '},{category:'Bogus'},{priority:'Emergency'},{location:''},{description:'x'.repeat(2001)}])assert.equal((await post('/api/requests',accounts.tenant,{...issue,...changes})).status,400);
  assert.equal((await post('/api/requests',accounts.tenant,{...issue,propertyId:99999})).status,404);
  const r=await post('/api/requests',accounts.tenant,{...issue,propertyId:saved.id,tenant_id:999,status:'Completed'});assert.equal(r.status,201);
  const created=(await r.json()).request;assert.equal(created.status,'Submitted');assert.equal(created.tenant_name,'tenant');
  const list=async cookie=>(await (await request('/api/requests',{cookie})).json()).requests;
  assert.equal((await list(accounts.other)).length,0);
  assert.equal((await list(accounts.agent)).length,1);
  assert.equal((await post(`/api/requests/${created.id}/status`,accounts.tenant,{status:'Completed',note:'forged'})).status,403);
  assert.equal((await post(`/api/requests/${created.id}/cancel`,accounts.other,{})).status,404);
  assert.equal((await post(`/api/requests/${created.id}/status`,accounts.agent,{status:'Bogus',note:''})).status,400);
  assert.equal((await post(`/api/requests/${created.id}/status`,accounts.agent,{status:'In progress',note:'Plumber scheduled.'},'https://evil.example')).status,403);
  assert.equal((await post(`/api/requests/${created.id}/status`,accounts.agent,{status:'In progress',note:'Plumber scheduled.'})).status,200);
  assert.equal((await post(`/api/requests/${created.id}/cancel`,accounts.tenant,{})).status,409);
  assert.equal((await list(accounts.tenant))[0].staff_note,'Plumber scheduled.');
  assert.equal((await post(`/api/requests/${created.id}/status`,admin,{status:'Completed',note:'Repair complete.'})).status,200);
  const second=(await (await post('/api/requests',accounts.tenant,issue)).json()).request;
  assert.equal((await post(`/api/requests/${second.id}/cancel`,accounts.tenant,{})).status,200);
  assert.equal((await post(`/api/requests/${second.id}/status`,admin,{status:'In progress',note:''})).status,409);
  await app.stop();base=await app.start();
  const persisted=await list(accounts.tenant);assert.equal(persisted.length,2);assert.equal(persisted[0].status,'Cancelled');assert.equal(persisted[1].status,'Completed');assert.equal(persisted[1].staff_note,'Repair complete.');
  assert.equal((await (await request('/api/properties',{cookie:admin})).json()).properties.length,2);
  assert.equal((await request('/api/session',{cookie:admin})).status,200);
 }finally{await app.cleanup();}
});
test('tenant dashboard inventory contains only homes on their active leases while public vacancies and staff portfolios remain available',async()=>{
 const app=await fixture({SMTP_ENABLED:'false'});try{
  const post=(path,data,cookie='')=>fetch(app.base+path,{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)}),json=async response=>{assert.ok(response.ok,await response.clone().text());return response.json();},get=(path,cookie='')=>fetch(app.base+path,{headers:{Cookie:cookie}});
  const login=await post('/api/login',app.credentials),admin=login.headers.get('set-cookie').split(';')[0],users=[];
  for(const name of ['resident','other'])users.push((await json(await post('/api/admin/users',{name,email:name+'@example.test',password:app.credentials.password,role:'tenant'},admin))).user);
  const session=await post('/api/login',{email:users[0].email,password:app.credentials.password}),tenant=session.headers.get('set-cookie').split(';')[0],inventory=require('./listing-fixtures.cjs'),properties=[];
  for(const p of inventory.slice(0,3))properties.push((await json(await post('/api/properties',p,admin))).property);
  assert.equal((await json(await get('/api/properties',tenant))).properties.length,0);assert.equal((await json(await get('/api/vacancies'))).properties.length,3);
  for(const [index,user]of users.entries())await json(await post('/api/leases',{tenantId:user.id,propertyId:properties[index].id,startsOn:'2099-01-01',endsOn:'2099-12-31',monthlyRent:1700,deposit:0,notes:''},admin));
  for(const url of ['/api/properties','/api/properties?tenantId='+users[1].id])assert.deepEqual((await json(await get(url,tenant))).properties.map(p=>p.id),[properties[0].id]);
  assert.equal((await json(await get('/api/properties',admin))).properties.length,3);assert.deepEqual((await json(await get('/api/vacancies'))).properties.map(p=>p.id),[properties[2].id]);
 }finally{await app.cleanup();}
});
