const {rentalApplication}=require('./rental-fixtures.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('showcase homes are persistent editable inventory; staff deletion is permanent and linked history is protected',async()=>{
 const app=await fixture({SEED_SHOWCASE_PROPERTIES:'1'});let base=app.base;
 const call=(path,{cookie,method='GET',data,origin=base}={})=>fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(path,cookie,data,origin)=>call(path,{method:'POST',cookie,data,origin});
 const login=async user=>{const r=await post('/api/login',null,user);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const get=async(path,cookie)=>{const r=await call(path,{cookie});assert.equal(r.status,200);return r.json();};
 try{
  const admin=await login(app.credentials),cookies={};
  for(const role of ['agent','tenant']){const u={name:role,email:role+'@example.test',password:app.credentials.password,role};assert.equal((await post('/api/admin/users',admin,u)).status,201);cookies[role]=await login(u);}
  let homes=(await get('/api/properties',cookies.agent)).properties;assert.equal(homes.length,6);assert.equal(homes.every(p=>p.isPreview&&!p.available),true);assert.equal(homes.every(p=>!/sample/i.test(p.name)),true);
  const collection=(await get('/api/showcase')).properties;assert.equal(collection.length,6);assert.equal('address' in collection[0],false);assert.equal(collection.every(p=>p.description&&p.amenities.length),true);
  assert.equal((await get('/api/vacancies')).properties.length,0);assert.equal((await get('/api/properties',cookies.tenant)).properties.length,0);
  const one=homes[0],two=homes[1],convert=homes[2];
  assert.equal((await post('/api/properties/'+one.id+'/delete',null,{})).status,401);
  assert.equal((await post('/api/properties/'+one.id+'/delete',cookies.tenant,{})).status,403);
  assert.equal((await post('/api/properties/'+one.id+'/delete',admin,{},'https://evil.example')).status,403);
  assert.equal((await post('/api/properties/'+one.id+'/availability',admin,{available:true})).status,409);
  assert.equal((await post('/api/properties/'+convert.id+'/edit',admin,{...convert,isPreview:false,available:true})).status,400);
  const edited=await post('/api/properties/'+convert.id+'/edit',cookies.agent,{...convert,isPreview:false,available:true,address:'500 Verified Test Avenue',description:'Sunny home with a garden.',amenities:['Garden','Parking']});assert.equal(edited.status,200);
  const vacancy=(await get('/api/vacancies')).properties[0];assert.equal(vacancy.name,convert.name);assert.equal(vacancy.description,'Sunny home with a garden.');assert.deepEqual(vacancy.amenities,['Garden','Parking']);
  assert.equal((await post('/api/properties/'+convert.id+'/edit',admin,{...convert,address:'500 Verified Test Avenue',description:'x'.repeat(3001)})).status,400);
  assert.equal((await post('/api/properties/'+one.id+'/delete',cookies.agent,{})).status,200);
  assert.equal((await post('/api/properties/'+two.id+'/delete',admin,{})).status,200);
  assert.equal((await get('/api/showcase')).properties.length,3);
  const application=rentalApplication({name:'Applicant',email:'applicant@example.test',phone:'202-555-0123',moveIn:'2099-01-01',occupants:1,message:'Interested',consent:true});
  assert.equal((await post('/api/vacancies/'+convert.id+'/applications',null,application)).status,200);
  assert.equal((await post('/api/properties/'+convert.id+'/delete',admin,{})).status,409);
  await app.stop();base=await app.start();homes=(await get('/api/properties',admin)).properties;
  assert.equal(homes.length,4);assert.equal(homes.some(p=>p.id===one.id||p.id===two.id),false);assert.equal((await get('/api/showcase')).properties.length,3);
 }finally{await app.cleanup();}
});
