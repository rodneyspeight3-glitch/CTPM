const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('tenant registration creates only tenant access; shared login detects roles and protects return destinations',async()=>{
 const app=await fixture();
 const call=(path,{method='GET',data,cookie,origin=app.base}={})=>fetch(app.base+path,{method,redirect:'manual',headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const post=(path,data,cookie,origin)=>call(path,{method:'POST',data,cookie,origin});
 const credentials={name:'New tenant <test>',email:'new-tenant@example.test',password:'A private tenant passphrase 123',confirmation:'A private tenant passphrase 123',consent:true};
 try{
  for(const path of ['/','/home'])assert.equal((await call(path)).status,200,path);
  const signupAlias=await call('/signup');assert.equal(signupAlias.status,302);assert.equal(signupAlias.headers.get('location'),'/login?mode=signup');
  const gateway=await call('/dashboard?newProperty=1');assert.equal(gateway.status,302);assert.equal(new URL(gateway.headers.get('location'),app.base).searchParams.get('next'),'/dashboard?newProperty=1');
  assert.equal((await post('/api/signup',credentials,null,'https://evil.example')).status,403);
  for(const [i,changes] of [{confirmation:'wrong'},{consent:false},{password:'short',confirmation:'short'},{email:'invalid'},{name:' '}].entries())assert.equal((await post('/api/signup',{...credentials,email:'invalid-'+i+'@example.test',...changes})).status,400);
  const signup=await post('/api/signup',{...credentials,role:'admin',active:true});assert.equal(signup.status,201);const user=(await signup.json()).user;assert.equal(user.role,'tenant');assert.equal('password_hash' in user,false);
  const cookie=signup.headers.get('set-cookie').split(';')[0];assert.equal((await (await call('/api/session',{cookie})).json()).user.name,credentials.name);
  assert.equal((await call('/api/admin/users',{cookie})).status,403);
  assert.equal((await post('/api/signup',{...credentials,email:'another@example.test'},cookie)).status,409);
  assert.equal((await post('/api/signup',credentials)).status,409);
  const admin=await post('/api/login',{email:app.credentials.email,password:app.credentials.password});assert.equal(admin.status,200);assert.equal((await admin.json()).user.role,'admin');const adminCookie=admin.headers.get('set-cookie').split(';')[0];
  const agentUser={name:'Agent',email:'new-agent@example.test',password:app.credentials.password,role:'agent'};assert.equal((await post('/api/admin/users',agentUser,adminCookie)).status,201);
  const agent=await post('/api/login',{email:agentUser.email,password:agentUser.password});assert.equal(agent.status,200);assert.equal((await agent.json()).user.role,'agent');
  const existingSettings=(await (await call('/api/settings',{cookie:adminCookie})).json()).settings;
  assert.equal((await post('/api/settings',{...existingSettings,paymentAccountDetails:'Assigned-resident payment reference'},adminCookie)).status,200);
  const prospectSettings=(await (await call('/api/settings',{cookie})).json()).settings;
  assert.equal(prospectSettings.paymentsRestricted,true);assert.equal(prospectSettings.paymentAccountDetails,'');
  const propertyResponse=await post('/api/properties',{name:'Assigned home',address:'101 Test Road',area:'Test district',price:1000,beds:2,baths:1,size:1000,type:'APARTMENT',image:1,available:true},adminCookie);
  const property=(await propertyResponse.json()).property;
  const year=new Date().getUTCFullYear();assert.equal((await post('/api/leases',{propertyId:property.id,tenantId:user.id,startsOn:year+'-01-01',endsOn:year+'-12-31',monthlyRent:1000,deposit:0,notes:''},adminCookie)).status,201);
  const assignedSettings=(await (await call('/api/settings',{cookie})).json()).settings;
  assert.equal(assignedSettings.paymentsRestricted,false);assert.equal(assignedSettings.paymentAccountDetails,'Assigned-resident payment reference');
  const badNext=await call('/login?next='+encodeURIComponent('https://evil.example'),{cookie:adminCookie});assert.equal(badNext.status,302);assert.equal(badNext.headers.get('location'),'/dashboard');
  const goodNext=await call('/login?next='+encodeURIComponent('/dashboard?newProperty=1#homes'),{cookie:adminCookie});assert.equal(goodNext.headers.get('location'),'/dashboard?newProperty=1#homes');
  for(let i=0;i<5;i++)assert.equal((await post('/api/signup',{...credentials,email:'rate-test@example.test',consent:false})).status,400);
  assert.equal((await post('/api/signup',{...credentials,email:'rate-test@example.test',consent:false})).status,429);
  await app.stop();const base=await app.start();const persisted=await fetch(base+'/api/session',{headers:{Cookie:cookie}});assert.equal(persisted.status,200);assert.equal((await persisted.json()).user.role,'tenant');
 }finally{await app.cleanup();}
});
