const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAuth}=require('../lib/auth'),{createMailer}=require('../lib/mailer'),{createNotifications}=require('../lib/notifications'),{fixture}=require('./fixture.cjs');
const holiday=Date.parse('2026-11-26T19:00:00Z');
async function unit(t){
 t.mock.timers.enable({apis:['Date'],now:holiday});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-greetings-')),auth=await createAuth(path.join(dir,'app.sqlite')),db=auth.db,password='Synthetic greeting administrator password 123';
 db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT; ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 0; CREATE TABLE properties(id INTEGER PRIMARY KEY,archived INTEGER,is_preview INTEGER); CREATE TABLE applications(id INTEGER PRIMARY KEY,email TEXT,status TEXT,email_updates INTEGER); CREATE TABLE applicant_lease_offers(id INTEGER PRIMARY KEY,application_id INTEGER,property_id INTEGER,values_json TEXT,status TEXT,revoked_at TEXT,lease_id INTEGER,expires_at INTEGER); CREATE TABLE leases(id INTEGER PRIMARY KEY,tenant_id INTEGER,property_id INTEGER,status TEXT); INSERT INTO properties VALUES(1,0,0),(2,0,1),(3,1,0);");
 const admin=await auth.addUser({name:'Greeting Admin',email:'admin@example.test',role:'admin',password}),tenant=await auth.addUser({name:'Resident',email:'resident@example.test',role:'tenant',password});
 db.prepare('UPDATE users SET email_verified_at=?,email_notifications=1 WHERE id=?').run(new Date().toISOString(),tenant.id);db.prepare("INSERT INTO leases VALUES(1,?,1,'Active')").run(tenant.id);
 for(let id=1;id<=2;id++){db.prepare("INSERT INTO applications VALUES(?,'applicant@example.test','Approved',1)").run(id);db.prepare('INSERT INTO applicant_lease_offers VALUES(?,?,1,?,?,NULL,NULL,?)').run(id,id,JSON.stringify({tenantEmail:'Applicant@example.test'}),id===1?'Pending':'Signed',holiday+(id===1?86400000:-86400000));}
 const previous=process.env.PUBLIC_APP_URL;process.env.PUBLIC_APP_URL='https://ctpm.example.test';const messages=[],mailer=createMailer({settingsSource:()=>({source:'dashboard',revision:1,env:{SMTP_ENABLED:'true',SMTP_HOST:'mail.spacemail.com',SMTP_PORT:'465',SMTP_USER:'sender@example.test',SMTP_FROM:'sender@example.test',SMTP_PASSWORD:'synthetic-greeting-password'}}),transportFactory:()=>({sendMail:async m=>{messages.push(m);return {messageId:'synthetic-greeting'}},close(){}})}),notices=createNotifications(db,{mailer});
 const input=()=>{const a=notices.leaseGreetings.preview(admin);return {confirm:true,campaign:a.campaign,audienceHash:a.audienceHash};};
 t.after(()=>{mailer.close();db.close();fs.rmSync(dir,{recursive:true,force:true});if(previous===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=previous;});return {db,auth,admin,tenant,password,notices,messages,input};
}
test('Thanksgiving greetings include active leases and signed invites, privately deduplicate mailboxes and remain idempotent across administrators',async t=>{
 const u=await unit(t),before=u.db.prepare('SELECT * FROM applicant_lease_offers').all(),input=u.input(),g=u.notices.leaseGreetings;
 assert.equal(g.preview(u.admin).agreementCount,3);assert.equal(g.preview(u.admin).recipientCount,2);assert.equal(g.preview(u.admin).expiresAt,Date.parse('2026-11-27T08:00:00Z'));
 assert.deepEqual(g.queue(u.admin,input).counts,{Pending:2});assert.equal(g.preview(u.admin).alreadyQueued,true);
 const other=await u.auth.addUser({name:'Other Admin',email:'other@example.test',role:'admin',password:u.password});assert.equal(g.queue(other,input).recipientCount,2);
 await u.notices.drain();assert.deepEqual(g.status(u.admin,input.campaign).counts,{Sent:2});assert.equal(g.queue(u.admin,input).recipientCount,2);await u.notices.drain();assert.equal(u.messages.length,2);
 for(const m of u.messages){assert.equal(typeof m.to.address,'string');assert.equal(m.cc,undefined);assert.equal(m.bcc,undefined);assert.equal(m.subject,'Happy Thanksgiving from Come Together Property Management');assert.match(m.text,/warm, joyful day/);assert.match(m.text,/Please do not reply/);assert.ok(!m.text.includes('private lease invitation'));}
 assert.deepEqual(u.db.prepare('SELECT * FROM applicant_lease_offers').all(),before);assert.equal(u.db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE body<>''").get().n,0);
});
test('greeting audience excludes opt-outs, unverified or inactive accounts, revoked and declined offers, expired pending offers and ended leases',async t=>{
 const u=await unit(t),g=u.notices.leaseGreetings;
 u.db.prepare('UPDATE users SET email_notifications=0 WHERE id=?').run(u.tenant.id);assert.equal(g.preview(u.admin).recipientCount,1);
 u.db.prepare('UPDATE users SET email_notifications=1,email_verified_at=NULL WHERE id=?').run(u.tenant.id);assert.equal(g.preview(u.admin).recipientCount,1);
 u.db.prepare('UPDATE users SET email_verified_at=?,active=0 WHERE id=?').run(new Date().toISOString(),u.tenant.id);assert.equal(g.preview(u.admin).recipientCount,1);
 u.db.prepare('UPDATE users SET active=1 WHERE id=?').run(u.tenant.id);u.db.exec("UPDATE leases SET status='Ended'; UPDATE applicant_lease_offers SET status='Declined' WHERE id=2; UPDATE applicant_lease_offers SET expires_at=0 WHERE id=1;");assert.equal(g.preview(u.admin).recipientCount,0);
 u.db.exec("UPDATE applicant_lease_offers SET status='Signed',revoked_at='revoked';");assert.equal(g.preview(u.admin).recipientCount,0);
 u.db.exec("UPDATE applicant_lease_offers SET revoked_at=NULL; UPDATE applications SET email_updates=0;");assert.equal(g.preview(u.admin).recipientCount,0);
 u.db.exec("UPDATE applications SET email_updates=1; UPDATE properties SET archived=1;");assert.equal(g.preview(u.admin).recipientCount,0);
 u.db.exec("UPDATE properties SET archived=0,is_preview=1;");assert.equal(g.preview(u.admin).recipientCount,0);
});
test('preferences, recipient changes and authorizer access are rechecked before greeting delivery',async t=>{
 const u=await unit(t),g=u.notices.leaseGreetings,input=u.input();g.queue(u.admin,input);
 u.db.prepare('UPDATE users SET email_notifications=0 WHERE id=?').run(u.tenant.id);u.db.exec("UPDATE applications SET email='changed@example.test'");await u.notices.drain();assert.deepEqual(g.status(u.admin,input.campaign).counts,{Cancelled:2});assert.equal(u.messages.length,0);
});
test('an opted-out tenant mailbox cannot be reached through an otherwise opted-in applicant invitation',async t=>{
 const u=await unit(t);await u.auth.addUser({name:'Applicant account',email:'applicant@example.test',role:'tenant',password:u.password});assert.equal(u.notices.leaseGreetings.preview(u.admin).recipientCount,1);
});
test('greeting queue rejects stale audiences and unconfirmed, unauthorized or out-of-day sends',async t=>{
 const u=await unit(t),g=u.notices.leaseGreetings,input=u.input();assert.throws(()=>g.queue(u.admin,{...input,confirm:false}),e=>e.status===400);assert.throws(()=>g.queue(u.tenant,input),e=>e.status===403);
 assert.throws(()=>g.queue(u.admin,{...input,campaign:'thanksgiving-2025'}),e=>e.status===400);assert.throws(()=>g.queue(u.admin,{...input,audienceHash:'stale'}),e=>e.status===409);
 t.mock.timers.setTime(Date.parse('2026-11-27T08:00:00Z'));assert.equal(g.preview(u.admin).open,false);assert.throws(()=>g.queue(u.admin,input),e=>e.status===409);assert.equal(u.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,0);
});
test('queued greetings expire at midnight California time and lose authorization when the administrator is disabled',async t=>{
 const u=await unit(t),g=u.notices.leaseGreetings,input=u.input();g.queue(u.admin,input);u.db.prepare('UPDATE users SET active=0 WHERE id=?').run(u.admin.id);await u.notices.drain();assert.equal(u.messages.length,0);assert.equal(u.db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Cancelled'").get().n,2);
 u.db.prepare('UPDATE users SET active=1 WHERE id=?').run(u.admin.id);u.db.exec("UPDATE email_outbox SET status='Pending'");t.mock.timers.setTime(Date.parse('2026-11-27T08:00:00Z'));await u.notices.drain();assert.deepEqual(g.status(u.admin,input.campaign).counts,{Cancelled:2});
});
test('greeting HTTP preview and send enforce session, administrator role, origin, current password and SMTP revision',async()=>{
 const app=await fixture({SMTP_ENABLED:'false',EMAIL_DELIVERY_DISABLED:'true'});try{
  const endpoint='/api/admin/smtp-settings/lease-greetings',post=(p,d,c='',o=app.base)=>fetch(app.base+p,{method:'POST',headers:{Origin:o,'Content-Type':'application/json',Cookie:c},body:JSON.stringify(d)});
  assert.equal((await fetch(app.base+endpoint)).status,401);const login=await post('/api/login',app.credentials),cookie=login.headers.get('set-cookie').split(';')[0],preview=await(await fetch(app.base+endpoint,{headers:{Cookie:cookie}})).json();assert.equal(preview.recipientCount,0);
  const input={confirm:true,campaign:preview.campaign,audienceHash:preview.audienceHash,currentPassword:app.credentials.password,revision:0};assert.equal((await post(endpoint,input,cookie,'https://other.example')).status,403);assert.equal((await post(endpoint,{...input,currentPassword:'wrong'},cookie)).status,403);assert.equal((await post(endpoint,{...input,revision:999},cookie)).status,409);assert.equal((await post(endpoint,input,cookie)).status,409);
  await post('/api/admin/users',{name:'Agent',email:'agent@example.test',role:'agent',password:app.credentials.password},cookie);const other=await post('/api/login',{email:'agent@example.test',password:app.credentials.password}),agent=other.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(app.base+endpoint,{headers:{Cookie:agent}})).status,403);assert.equal((await post(endpoint,input,agent)).status,403);
 }finally{await app.cleanup();}
});
