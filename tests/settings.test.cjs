const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('staff can change contact and payment settings; tenants read them privately; stale edits cannot overwrite changes',async()=>{
 const app=await fixture();let base=app.base;
 const call=(path,{cookie,method='GET',data,origin=base}={})=>fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(path,cookie,data,origin)=>call(path,{method:'POST',cookie,data,origin});
 const login=async user=>{const r=await post('/api/login',null,user);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 try{
  const admin=await login(app.credentials),cookies={};
  for(const role of ['agent','tenant']){const user={name:role,email:role+'@example.test',role,password:app.credentials.password};assert.equal((await post('/api/admin/users',admin,user)).status,201);cookies[role]=await login(user);}
  assert.equal((await call('/api/settings')).status,401);
  const initial=(await (await call('/api/settings',{cookie:admin})).json()).settings;
  assert.equal(initial.revision,0);
  const data={...initial,companyName:'Updated Company <test>',contactEmail:'management@example.test',contactPhone:'202-555-0101',paymentLabel:'Rent instructions',paymentUrl:'https://payments.example.test/residents',paymentAccountName:'Property Management',paymentBankName:'Example Bank',paymentAccountDetails:'Use your unit number as the reference.',paymentInstructions:'Pay using the approved portal.'};
  assert.equal((await post('/api/settings',cookies.tenant,data)).status,403);
  assert.equal((await post('/api/settings',admin,data,'https://evil.example')).status,403);
  for(const change of [{companyName:''},{contactEmail:'bad'},{contactPhone:'invalid'},{paymentUrl:'javascript:alert(1)'},{paymentUrl:'http://payments.example.test'},{paymentUrl:'https://user:secret@example.test'},{paymentInstructions:'x'.repeat(3001)}])assert.equal((await post('/api/settings',admin,{...data,...change})).status,400);
  const saved=await post('/api/settings',admin,data);assert.equal(saved.status,200);const settings=(await saved.json()).settings;assert.equal(settings.revision,1);
  const tenantView=(await (await call('/api/settings',{cookie:cookies.tenant})).json()).settings;assert.equal(tenantView.paymentInstructions,data.paymentInstructions);
  const publicInfo=(await (await call('/api/company')).json()).company;
  assert.deepEqual(Object.keys(publicInfo).sort(),['companyName','contactEmail','contactPhone']);assert.equal(publicInfo.contactEmail,data.contactEmail);
  assert.equal((await post('/api/settings',cookies.agent,{...data,paymentInstructions:'Stale update'})).status,409);
  assert.equal((await post('/api/settings',cookies.agent,{...settings,paymentInstructions:'Updated by agent.'})).status,200);
  await app.stop();base=await app.start();
  const persisted=(await (await call('/api/settings',{cookie:admin})).json()).settings;assert.equal(persisted.paymentInstructions,'Updated by agent.');assert.equal(persisted.revision,2);
 }finally{await app.cleanup();}
});
