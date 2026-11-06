const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
test('saved homes are tenant-only, private, persistent, and do not expose private property changes',async()=>{
 const app=await fixture();let base=app.base;
 const call=(path,{cookie,method='GET',data,origin=base}={})=>fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(path,cookie,data,origin)=>call(path,{method:'POST',cookie,data,origin});
 const login=async user=>{const r=await post('/api/login',null,user);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 try{
  const admin=await login(app.credentials),cookies={};
  for(const [name,role] of [['agent','agent'],['tenant','tenant'],['other','tenant']]){const user={name,email:name+'@example.test',role,password:app.credentials.password};assert.equal((await post('/api/admin/users',admin,user)).status,201);cookies[name]=await login(user);}
  const created=await post('/api/properties',cookies.agent,inventory[0]);assert.equal(created.status,201);const property=(await created.json()).property;
  assert.equal((await post('/api/properties',cookies.tenant,inventory[0])).status,403);
  assert.equal((await post('/api/properties',null,inventory[0])).status,401);
  const url='/api/properties/'+property.id+'/save';
  assert.equal((await call('/api/saved-homes')).status,401);
  assert.equal((await call('/api/saved-homes',{cookie:admin})).status,403);
  assert.equal((await post(url,cookies.agent,{saved:true})).status,403);
  assert.equal((await post(url,cookies.tenant,{saved:'true'})).status,400);
  assert.equal((await post(url,cookies.tenant,{saved:true},'https://evil.example')).status,403);
  assert.equal((await post(url,cookies.tenant,{saved:true})).status,200);
  assert.equal((await post(url,cookies.tenant,{saved:true})).status,200);
  let saved=(await (await call('/api/saved-homes',{cookie:cookies.tenant})).json()).properties;
  assert.equal(saved.length,1);assert.equal(saved[0].available,true);
  assert.equal((await (await call('/api/saved-homes?userId=1',{cookie:cookies.other})).json()).properties.length,0);
  assert.equal((await post('/api/properties/'+property.id+'/edit',admin,{...inventory[0],available:false,name:'Private updated name',address:'Private updated address',price:9999})).status,200);
  saved=(await (await call('/api/saved-homes',{cookie:cookies.tenant})).json()).properties;
  assert.equal(saved[0].available,false);assert.equal(saved[0].name,inventory[0].name);assert.equal(saved[0].address,inventory[0].address);assert.equal(saved[0].price,inventory[0].price);
  assert.equal((await post(url,cookies.other,{saved:true})).status,409);
  await app.stop();base=await app.start();
  assert.equal((await (await call('/api/saved-homes',{cookie:cookies.tenant})).json()).properties.length,1);
  assert.equal((await post(url,cookies.tenant,{saved:false})).status,200);
  assert.equal((await (await call('/api/saved-homes',{cookie:cookies.tenant})).json()).properties.length,0);
 }finally{await app.cleanup();}
});
