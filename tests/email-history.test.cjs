const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createAuth}=require('../lib/auth'),{createNotifications}=require('../lib/notifications'),{createEmailHistory,emailPreview}=require('../lib/email-history'),{fixture}=require('./fixture.cjs');
async function unit(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-email-history-')),auth=await createAuth(path.join(dir,'app.sqlite')),db=auth.db,password='Synthetic history administrator password 123',users={};
 for(const role of ['admin','agent','tenant'])users[role]=await auth.addUser({name:'History '+role,email:role+'@example.test',role,password});
 db.exec("CREATE TABLE applications(id INTEGER PRIMARY KEY,email TEXT,email_updates INTEGER,status TEXT)");
 const previous=process.env.PUBLIC_APP_URL;process.env.PUBLIC_APP_URL='https://ctpm.example.test';const sent=[],notices=createNotifications(db,{sendMail:async m=>{sent.push(m);return {id:'synthetic-history-provider-id'}}});
 const add=(values={})=>{const v={to:'recipient@example.test',subject:'Lease update',kind:'lease-signing-reminder',body:'A friendly reminder. https://ctpm.example.test/lease-invitation#invite='+'a'.repeat(64),key:'history-'+Math.random(),...values};notices.enqueue(v);return db.prepare('SELECT id FROM email_outbox WHERE event_key=?').get(v.key).id;};
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});if(previous===undefined)delete process.env.PUBLIC_APP_URL;else process.env.PUBLIC_APP_URL=previous;});return {db,users,notices,sent,add};
}
test('all active staff can read email history while guests, tenants, deactivated and demoted staff cannot',async t=>{
 const u=await unit(t),id=u.add(),h=u.notices.history;assert.equal(h.list(u.users.admin).total,1);assert.equal(h.list(u.users.agent).total,1);assert.equal(h.detail(u.users.agent,id).message.recipient,'recipient@example.test');
 for(const user of [null,u.users.tenant]){assert.throws(()=>h.list(user),e=>e.status===403);assert.throws(()=>h.detail(user,id),e=>e.status===403);}
 u.db.prepare('UPDATE users SET active=0 WHERE id=?').run(u.users.agent.id);assert.throws(()=>h.list(u.users.agent),e=>e.status===403);u.db.prepare("UPDATE users SET active=1,role='tenant' WHERE id=?").run(u.users.agent.id);assert.throws(()=>h.detail(u.users.agent,id),e=>e.status===403);
 assert.throws(()=>h.detail(u.users.admin,99999),e=>e.status===404);
});
test('email history supports bounded pagination, literal recipient/subject searches, category, date and effective-expiry filters',async t=>{
 const u=await unit(t),h=u.notices.history;
 for(let i=0;i<31;i++){const id=u.add({subject:i===0?'Lease 10%_off':'Lease '+i,kind:i%2?'lease-thanksgiving':'smtp-test',to:'person'+i+'@example.test'});u.db.prepare('UPDATE email_outbox SET status=?,created_at=? WHERE id=?').run(i<20?'Sent':'Failed',i<15?'2026-11-26T12:00:00.000Z':'2026-11-27T12:00:00.000Z',id);}
 const expired=u.add({expiresAt:Date.now()-1000});assert.equal(h.list(u.users.admin).messages.length,25);assert.equal(h.list(u.users.admin,{page:'2'}).messages.length,7);assert.equal(h.list(u.users.admin,{page:'900'}).page,2);assert.equal(h.list(u.users.agent,{q:'10%_'}).total,1);assert.equal(h.list(u.users.agent,{q:'person1@example.test'}).total,1);assert.equal(h.list(u.users.agent,{q:"' OR 1=1 --"}).total,0);
 const dates={since:'2026-11-26T00:00:00.000Z',until:'2026-11-27T00:00:00.000Z'};assert.equal(h.list(u.users.admin,dates).counts.Sent,15);assert.equal(h.list(u.users.admin,{status:'Failed'}).total,11);assert.equal(h.list(u.users.admin,{status:'Expired'}).messages[0].id,expired);assert.equal(h.list(u.users.admin,{kind:'lease-thanksgiving',...dates}).total,7);
 for(const input of [{page:'-1'},{page:'1.5'},{limit:'101'},{status:'Delivered'},{q:'x'.repeat(161)},{since:'yesterday'},{since:'2026-02-30T00:00:00.000Z'},{since:dates.until,until:dates.since}])assert.throws(()=>h.list(u.users.admin,input),e=>e.status===400);
});
test('history previews omit capability URLs and private references, and security emails never expose their bodies',async t=>{
 const u=await unit(t),h=u.notices.history,token='b'.repeat(64),link='https://ctpm.example.test/application-status#receipt='+token;
 const id=u.add({kind:'application-receipt',body:'Welcome. '+link+'\nPrivate reference '+token,unsubscribeUrl:'https://ctpm.example.test/application-email#unsubscribe='+token,statusSnapshot:'private-snapshot-'+token,key:'secret-event-'+token});
 const detail=h.detail(u.users.agent,id).message;assert.equal(detail.previewStatus,'available');assert.match(detail.preview,/Welcome/);assert.match(detail.preview,/Link omitted/);assert.ok(!JSON.stringify(detail).includes(token));assert.ok(!JSON.stringify(detail).includes('private-snapshot'));assert.ok(!JSON.stringify(detail).includes('secret-event'));assert.equal(detail.body,undefined);assert.equal(detail.unsubscribe_url,undefined);assert.equal(detail.provider_id,undefined);
 for(const kind of ['verification','recovery','unknown-private-kind']){const other=u.add({kind,body:'Do not expose '+link});u.db.prepare('UPDATE email_outbox SET history_preview=? WHERE id=?').run('Old unsafe '+link,other);const value=h.detail(u.users.admin,other).message;assert.equal(value.preview,'');assert.ok(!JSON.stringify(value).includes(token));}
 assert.equal(emailPreview('verification','secret'),'');assert.ok(!emailPreview('applicant-lease','HTTPS://ctpm.example.test/path?token='+token).includes(token));
});
test('new safe previews survive sending while sent raw bodies are cleared and list responses do not expose previews or secrets',async t=>{
 const u=await unit(t),id=u.add({kind:'smtp-test'});await u.notices.drain();assert.equal(u.sent.length,1);assert.match(u.sent[0].text,/private|lease|reminder/i);assert.equal(u.db.prepare('SELECT body FROM email_outbox WHERE id=?').get(id).body,'');
 const message=u.notices.history.detail(u.users.admin,id).message;assert.equal(message.status,'Sent');assert.ok(message.sentAt);assert.match(message.preview,/friendly reminder/);assert.ok(!message.preview.includes('a'.repeat(64)));assert.equal(u.notices.history.list(u.users.admin).messages[0].preview,undefined);
});
test('legacy pending/failed bodies get safe previews without inventing earlier sent content or exposing arbitrary provider errors',async t=>{
 const u=await unit(t),pending=u.add(),sent=u.add();u.db.exec("UPDATE email_outbox SET history_preview=''");u.db.prepare("UPDATE email_outbox SET status='Sent',body='' WHERE id=?").run(sent);u.db.prepare("UPDATE email_outbox SET status='Failed',last_error=? WHERE id=?").run('secret SMTP password fake-do-not-expose',pending);
 const h=createEmailHistory(u.db),m=h.detail(u.users.admin,pending).message;assert.match(m.preview,/Link omitted/);assert.equal(m.error,'DELIVERY_FAILED');assert.ok(!JSON.stringify(m).includes('fake-do-not-expose'));assert.equal(h.detail(u.users.admin,sent).message.previewStatus,'unavailable');assert.equal(h.detail(u.users.admin,sent).message.preview,'');
});
test('email history HTTP routes allow agent reads, deny tenant/guest access and keep SMTP administration private',async()=>{
 const app=await fixture({SMTP_ENABLED:'false',EMAIL_DELIVERY_DISABLED:'true'});try{
  const {DatabaseSync}=require('node:sqlite'),post=(p,d,c='')=>fetch(app.base+p,{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json',Cookie:c},body:JSON.stringify(d)}),login=async data=>{const r=await post('/api/login',data);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];},get=(p,c='')=>fetch(app.base+p,{headers:{Cookie:c}});
  assert.equal((await get('/api/email-history')).status,401);const admin=await login(app.credentials);for(const role of ['agent','tenant'])await post('/api/admin/users',{name:'History '+role,email:role+'@example.test',role,password:app.credentials.password},admin);
  const db=new DatabaseSync(app.databasePath);db.exec('PRAGMA busy_timeout=5000');db.prepare("INSERT INTO email_outbox(recipient,subject,body,kind,status,available_at,created_at,event_key,history_preview) VALUES('recipient@example.test','Holiday greeting','private raw body','lease-thanksgiving','Sent',?,?,?,'Happy Thanksgiving!')").run(Date.now(),new Date().toISOString(),'synthetic-history');const id=db.prepare('SELECT id FROM email_outbox').get().id;
  const agent=await login({email:'agent@example.test',password:app.credentials.password}),tenant=await login({email:'tenant@example.test',password:app.credentials.password});assert.equal((await get('/api/email-history',agent)).status,200);const detail=await(await get('/api/email-history/'+id,agent)).json();assert.equal(detail.message.preview,'Happy Thanksgiving!');assert.ok(!JSON.stringify(detail).includes('private raw body'));
  for(const p of ['/api/email-history','/api/email-history/'+id])assert.equal((await get(p,tenant)).status,403);assert.equal((await get('/api/admin/smtp-settings',agent)).status,403);assert.equal((await post('/api/integrations/email/retry',{},agent)).status,403);db.prepare("UPDATE users SET role='tenant' WHERE email='agent@example.test'").run();assert.equal((await get('/api/email-history',agent)).status,403);db.close();
 }finally{await app.cleanup();}
});
