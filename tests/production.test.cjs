const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
test('production startup, database health, revision, secure cookies, pages, and payment privacy work',async()=>{
 const revision='a'.repeat(40),origin='https://ctpm.example.test';
 const app=await fixture({NODE_ENV:'production',APP_ORIGIN:origin,RENDER_GIT_COMMIT:revision});
 try{
  const health=await fetch(app.base+'/health');assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:'ok',revision});
  for(const path of ['/login','/vacancies','/style.css?v=5','/settings.js?v=5','/vacancies.js?v=5','/api/company'])assert.equal((await fetch(app.base+path)).status,200,path);
  const root=await fetch(app.base+'/',{redirect:'manual'});assert.equal(root.status,302);assert.equal(root.headers.get('location'),'/login');
  const login=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(app.credentials)});assert.equal(login.status,200);
  const setCookie=login.headers.get('set-cookie');for(const attribute of ['Secure','HttpOnly','SameSite=Lax'])assert.ok(setCookie.includes(attribute));
  const cookie=setCookie.split(';')[0];assert.equal((await fetch(app.base+'/',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(app.base+'/api/settings')).status,401);
  assert.equal((await fetch(app.base+'/api/settings',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(app.base+'/api/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
 }finally{await app.cleanup();}
});
