const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('shared login enforces roles, persists accounts, protects admin routes, and revokes sessions',async()=>{
 const app=await fixture();let base=app.base;
 const request=(url,{method='GET',data,cookie,origin=base}={})=>fetch(base+url,{method,redirect:'manual',headers:{...(method==='POST'?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
 const signIn=async(credentials)=>{const response=await request('/api/login',{method:'POST',data:credentials});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 try{
  assert.equal((await request('/')).status,302);
  assert.equal((await request('/api/session')).status,401);
  assert.equal((await request('/health')).status,200);
  assert.equal((await request('/api/login',{method:'POST',data:app.credentials,origin:'https://attacker.example'})).status,403);
  assert.equal((await request('/api/login',{method:'POST',data:{...app.credentials,role:'tenant'}})).status,401);
  assert.equal((await request('/api/login',{method:'POST',data:{...app.credentials,password:'wrong'}})).status,401);
  const admin=await signIn(app.credentials);
  const session=await request('/api/session',{cookie:admin});assert.equal((await session.json()).user.role,'admin');
  const users=[{name:'Test Resident',email:'tenant@example.test',password:app.credentials.password,role:'tenant'},{name:'Test Agent',email:'agent@example.test',password:app.credentials.password,role:'agent'}];
  for(const user of users){const created=await request('/api/admin/users',{method:'POST',cookie:admin,data:user});assert.equal(created.status,201);assert.equal('password_hash' in (await created.json()).user,false);}
  assert.equal((await request('/api/admin/users',{method:'POST',cookie:admin,data:users[0]})).status,409);
  for(const user of users){
   const cookie=await signIn(user);assert.equal((await request('/api/admin/users',{cookie})).status,403);
   assert.equal((await request('/api/admin/users',{method:'POST',cookie,data:{...user,email:'new@example.test',role:'admin'}})).status,403);
   assert.equal((await request('/api/login',{method:'POST',data:{...user,role:'admin'}})).status,401);
   const logout=await request('/api/logout',{method:'POST',cookie,data:{}});assert.equal(logout.status,200);
   assert.equal((await request('/api/session',{cookie})).status,401);
  }
  const tenant=await signIn(users[0]);const otherSession=await signIn(users[0]);
  const changed=await request('/api/password',{method:'POST',cookie:tenant,data:{currentPassword:users[0].password,newPassword:'A different long test password 123'}});assert.equal(changed.status,200);
  assert.equal((await request('/api/session',{cookie:otherSession})).status,401);
  assert.equal((await request('/api/login',{method:'POST',data:users[0]})).status,401);
  await app.stop();base=await app.start();
  assert.equal((await request('/api/session',{cookie:admin})).status,200);
  const list=await (await request('/api/admin/users',{cookie:admin})).json();assert.equal(list.users.length,3);
  const newTenant=await signIn({...users[0],password:'A different long test password 123'});assert.ok(newTenant);
  for(let i=0;i<10;i++)await request('/api/login',{method:'POST',data:{email:'absent@example.test',password:'wrong',role:'tenant'}});
  assert.equal((await request('/api/login',{method:'POST',data:{email:'absent@example.test',password:'wrong',role:'tenant'}})).status,429);
 }finally{await app.cleanup();}
});
