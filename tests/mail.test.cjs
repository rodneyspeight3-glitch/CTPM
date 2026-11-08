const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const nodemailer=require('nodemailer');
const {createAuth}=require('../lib/auth'),{createManagement}=require('../lib/management'),{createVacancies}=require('../lib/vacancies');
const {createNotifications}=require('../lib/notifications'),{createAccountServices}=require('../lib/account-services'),{createApplicationMail}=require('../lib/application-mail'),{createResidentServices}=require('../lib/resident-services');
const {createMailer,smtpSettings}=require('../lib/mailer');
const {rentalApplication}=require('./rental-fixtures.cjs');
const {fixture}=require('./fixture.cjs');
const req=()=>({headers:{'user-agent':'Synthetic browser'},socket:{remoteAddress:'127.0.0.1'}});
async function unit(){
 const values={SMTP_ENABLED:'true',SMTP_HOST:'smtp.mail.com',SMTP_PORT:'465',SMTP_USER:'company@example.test',SMTP_FROM:'company@example.test',SMTP_PASSWORD:'synthetic-mailbox-password-not-real',PUBLIC_APP_URL:'https://ctpm.example.test'},previous={};for(const[k,v]of Object.entries(values)){previous[k]=process.env[k];process.env[k]=v;}
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-mail-')),auth=await createAuth(path.join(directory,'app.sqlite')),db=auth.db;createManagement(db);
 const messages=[],options=[],state={error:null};const stream=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const mailer=createMailer({transportFactory:config=>{options.push(config);return {verify:async()=>{if(state.error)throw state.error;return true;},sendMail:async payload=>{if(state.error)throw state.error;const result=await stream.sendMail(payload);messages.push({payload,mime:result.message.toString()});return result;}};}});
 let resident;const vacancies=createVacancies(db,{onEvent:(...args)=>resident.applicationEvent(...args)}),notices=createNotifications(db,{mailer}),accounts=createAccountServices(db,notices),applicationMail=createApplicationMail(db,notices);resident=createResidentServices(db,notices,{applicationMail});
 const password='Synthetic local user password 123456789',admin=await auth.addUser({name:'Test Admin',email:'admin@example.test',role:'admin',password});
 return {auth,db,mailer,notices,accounts,applicationMail,vacancies,resident,messages,options,state,admin,password,cleanup(){db.close();fs.rmSync(directory,{recursive:true,force:true});for(const[k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}};
}
test('mail.com uses encrypted authenticated SMTP and a dedicated company sender without exposing login passwords',async()=>{
 const u=await unit();try{
  assert.equal(u.mailer.configured(),true);await u.mailer.verify();await u.mailer.send({to:'recipient@example.test',subject:'Test notice',text:'Synthetic message',key:'stable-message'});
  const config=u.options[0];assert.equal(config.host,'smtp.mail.com');assert.equal(config.port,465);assert.equal(config.secure,true);assert.equal(config.forceAuth,true);assert.equal(config.tls.rejectUnauthorized,true);assert.equal(config.tls.minVersion,'TLSv1.2');assert.equal(config.disableFileAccess,true);assert.equal(config.disableUrlAccess,true);
  assert.equal(u.messages[0].payload.from.address,'company@example.test');assert.deepEqual(u.messages[0].payload.envelope,{from:'company@example.test',to:['recipient@example.test']});assert.equal(u.messages[0].payload.from.name,'Come Together Property Management (No Reply)');assert.match(u.messages[0].mime.replace(/\r?\n[ \t]+/g,' '),/From:.*No Reply/);assert.equal(u.messages[0].payload.headers['Auto-Submitted'],'auto-generated');assert.equal(u.messages[0].payload.headers['X-Auto-Response-Suppress'],'All');assert.match(u.messages[0].payload.text,/Please do not reply/);assert.match(u.messages[0].payload.text,/https:\/\/ctpm.example.test\/dashboard#messages/);assert.ok(!u.messages[0].mime.includes(process.env.SMTP_PASSWORD));
  await u.mailer.send({to:'recipient@example.test',subject:'Test notice',text:'Synthetic message',key:'stable-message'});assert.equal(u.messages[1].payload.messageId,u.messages[0].payload.messageId);
  process.env.SMTP_PORT='587';await u.mailer.verify();assert.equal(u.options[1].secure,false);assert.equal(u.options[1].requireTLS,true);
  process.env.SMTP_PORT='0';assert.equal(u.mailer.configured(),false);await assert.rejects(u.mailer.send({to:'recipient@example.test',subject:'Test',text:'Test',key:'bad-port'}));
  process.env.SMTP_PORT='465';process.env.SMTP_USER='private-login@example.test';assert.equal(u.mailer.configured(),false);assert.match(smtpSettings().problem,/same authorized mailbox/);process.env.SMTP_USER='company@example.test';process.env.SMTP_FROM='';assert.equal(u.mailer.configured(),false);process.env.SMTP_FROM='company@example.test';process.env.SMTP_ENABLED='false';assert.equal(u.mailer.configured(),false);
 }finally{u.cleanup();}
});
test('signup produces a durable in-app welcome and a one-use welcome/verification email without passwords',async()=>{
 const u=await unit();try{
  const created=await u.auth.signup({name:'New Resident',email:'resident@example.test',password:u.password,confirmation:u.password,consent:true},req());u.accounts.welcome(created.user);u.accounts.welcome(created.user);u.accounts.requestVerification(created.user,req(),{welcome:true});
  assert.equal(u.notices.list(created.user).filter(n=>n.event_key==='signup-welcome').length,0);assert.equal(u.notices.list(created.user).filter(n=>n.title==='Welcome to Come Together').length,1);assert.equal(u.db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Pending'").get().n,1);assert.equal(u.messages.length,0);
  await u.notices.drain();await u.notices.drain();assert.equal(u.messages.length,1);const message=u.messages[0].payload;assert.match(message.subject,/Welcome/);assert.ok(!message.text.includes(u.password));const token=message.text.match(/#verify=([a-f0-9]{64})/)[1];u.accounts.verify({token});assert.throws(()=>u.accounts.verify({token}),/invalid or expired/);assert.equal(u.db.prepare('SELECT body FROM email_outbox').get().body,'');assert.match(message.text,/Only confirm if you created this account/);
 }finally{u.cleanup();}
});
test('guest applicants receive opted-in receipts and real progress only; duplicates, notes and documents never become mail',async()=>{
 const u=await unit();try{
  const input=rentalApplication({emailUpdates:true,requestedAddress:'42 Private Applicant Road',email:'applicant@example.test'}),receipt=u.vacancies.apply(null,input),app=u.vacancies.listApplications(u.admin)[0];
  assert.equal(u.messages.length,0);assert.equal(u.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,1);u.vacancies.apply(null,input);assert.equal(u.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,1);
  await u.notices.drain();assert.equal(u.messages.length,1);assert.ok(u.messages[0].payload.text.includes(receipt.trackingUrl));assert.ok(u.messages[0].payload.text.includes(app.reference));
  u.vacancies.updateApplication(u.admin,app.id,{status:'Reviewing',note:'Private screening note 8675309'});u.vacancies.updateApplication(u.admin,app.id,{status:'Contacted',note:'Private screening note 8675309'});u.vacancies.updateApplication(u.admin,app.id,{status:'Contacted',note:'A staff-note-only edit'});await u.notices.drain();assert.equal(u.messages.length,2);assert.match(u.messages[1].payload.subject,/Contacted/);assert.equal(u.db.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE status='Cancelled'").get().n,1);
  for(const message of u.messages)for(const value of [input.currentAddress,input.landlordName,input.employer,'8675309',input.documents[0].name,input.requestedAddress])assert.ok(!message.payload.text.includes(value),value);
  u.resident.requestDocument(u.admin,app.id,{kind:'income',message:'Private request details remain in the portal',dueOn:''});await u.notices.drain();assert.match(u.messages[2].payload.subject,/documents requested/);assert.ok(!u.messages[2].payload.text.includes('Private request details'));
  const other=u.vacancies.apply(null,rentalApplication({email:'optional@example.test',requestedAddress:'99 Another Road',emailUpdates:false}));assert.ok(other.reference);assert.equal(u.db.prepare('SELECT COUNT(*) AS n FROM email_outbox').get().n,4);
  const token=u.messages[2].payload.text.match(/#unsubscribe=([a-f0-9]{64})/)[1];u.applicationMail.unsubscribe({token},req());assert.equal(u.db.prepare('SELECT email_updates FROM applications WHERE id=?').get(app.id).email_updates,0);u.vacancies.updateApplication(u.admin,app.id,{status:'Closed',note:'Still private'});await u.notices.drain();assert.equal(u.messages.length,3);assert.equal(u.vacancies.application(u.admin,app.id).documents.length,2);assert.throws(()=>u.applicationMail.unsubscribe({token:'invalid'},req()),/unsubscribe link/);
 }finally{u.cleanup();}
});
test('opted-in decision emails name the actual approved or rejected status without leaking staff notes or changing delivery settings',async()=>{
 const u=await unit();try{
  u.vacancies.apply(null,rentalApplication({emailUpdates:true,requestedAddress:'42 Decision Road',email:'decision@example.test'}));await u.notices.drain();let app=u.vacancies.listApplications(u.admin)[0];
  u.vacancies.updateApplication(u.admin,app.id,{status:'Approved',note:'PRIVATE approval reasoning',confirmDecision:true,expectedUpdatedAt:app.updated_at});await u.notices.drain();const approved=u.messages.find(m=>/Application update: Approved/.test(m.payload.subject));assert.ok(approved);assert.match(approved.payload.text,/Management approved this application/);assert.match(approved.payload.text,/does not reserve a home or activate a lease/);assert.doesNotMatch(approved.payload.text,/PRIVATE approval reasoning|monthlyIncome|test-photo-id/);
  app=u.vacancies.listApplications(u.admin)[0];u.vacancies.updateApplication(u.admin,app.id,{status:'Reviewing',note:'PRIVATE correction',expectedUpdatedAt:app.updated_at});app=u.vacancies.listApplications(u.admin)[0];u.vacancies.updateApplication(u.admin,app.id,{status:'Rejected',note:'PRIVATE rejection reasoning',confirmDecision:true,expectedUpdatedAt:app.updated_at});await u.notices.drain();const rejected=u.messages.filter(m=>/Application update: Rejected/.test(m.payload.subject));assert.equal(rejected.length,1);assert.match(rejected[0].payload.text,/Management rejected this application/);assert.doesNotMatch(rejected[0].payload.text,/PRIVATE rejection reasoning|PRIVATE correction/);assert.equal(u.messages.some(m=>/Application update: Reviewing/.test(m.payload.subject)),false);
  assert.equal(process.env.SMTP_ENABLED,'true');assert.equal(u.vacancies.application(u.admin,app.id).reviewEvents.length,4);
 }finally{u.cleanup();}
});
test('SMTP failures are sanitized, retried deliberately, and unsubscribe/expiry/stale progress suppress queued mail',async()=>{
 const u=await unit();try{
  u.notices.enqueue({to:'recipient@example.test',subject:'Test',body:'Test',key:'auth-test'});u.state.error=Object.assign(new Error('Never expose '+process.env.SMTP_PASSWORD),{code:'EAUTH',responseCode:535});await u.notices.drain();let row=u.db.prepare('SELECT * FROM email_outbox').get();assert.equal(row.status,'Failed');assert.equal(row.last_error,'AUTHENTICATION_FAILED');assert.ok(u.notices.deliveryStatus(u.admin).smtp.retryAfter);await u.notices.drain();assert.equal(u.db.prepare('SELECT attempts FROM email_outbox').get().attempts,1);assert.ok(!JSON.stringify(u.notices.deliveryStatus(u.admin)).includes(process.env.SMTP_PASSWORD));assert.throws(()=>u.notices.retryFailed({role:'agent'}),/Administrator/);u.state.error=null;u.notices.retryFailed(u.admin);await u.notices.drain();assert.equal(u.messages.length,1);
  u.notices.enqueue({to:'recipient@example.test',subject:'Transient',body:'Test',key:'retry-test'});u.state.error=Object.assign(Error('Temporary'),{code:'ECONNECTION'});await u.notices.drain();row=u.db.prepare("SELECT * FROM email_outbox WHERE event_key='retry-test'").get();assert.equal(row.status,'Pending');assert.equal(row.attempts,1);assert.ok(row.available_at>Date.now());u.db.prepare("UPDATE email_outbox SET available_at=0 WHERE event_key='retry-test'").run();u.state.error=null;await u.notices.drain();assert.equal(u.messages.length,2);
  u.vacancies.apply(null,rentalApplication({email:'applicant@example.test',requestedAddress:'42 Test Road',emailUpdates:true}));const app=u.vacancies.listApplications(u.admin)[0];await u.notices.drain();u.vacancies.updateApplication(u.admin,app.id,{status:'Reviewing',note:''});u.state.error=Object.assign(Error('Temporary login failure'),{code:'EAUTH'});await u.notices.drain();u.vacancies.updateApplication(u.admin,app.id,{status:'Closed',note:''});u.state.error=null;u.notices.retryFailed(u.admin);await u.notices.drain();assert.equal(u.db.prepare("SELECT status FROM email_outbox WHERE application_id=? AND status_snapshot='Reviewing'").get(app.id).status,'Cancelled');assert.equal(u.messages.filter(m=>/Application update: Closed/.test(m.payload.subject)).length,1);
  u.notices.enqueue({to:'recipient@example.test',subject:'Expired',body:'Secret',key:'expired-test',expiresAt:Date.now()-1});await u.notices.drain();assert.equal(u.db.prepare("SELECT status FROM email_outbox WHERE event_key='expired-test'").get().status,'Cancelled');
 }finally{u.cleanup();}
});
test('new signup welcomes and email setup routes remain role-protected when SMTP is not connected',async()=>{
 const app=await fixture({SMTP_ENABLED:'false'});const post=(url,data,cookie)=>fetch(app.base+url,{method:'POST',headers:{Origin:app.base,'Content-Type':'application/json',Cookie:cookie||''},body:JSON.stringify(data)});
 try{const r=await post('/api/signup',{name:'New Resident',email:'signup@example.test',password:'A synthetic new password 123456789',confirmation:'A synthetic new password 123456789',consent:true});assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0],notices=await(await fetch(app.base+'/api/notifications',{headers:{Cookie:cookie}})).json();assert.ok(notices.notifications.some(n=>n.title==='Welcome to Come Together'));assert.equal((await post('/api/integrations/email/check',{},cookie)).status,403);assert.equal((await post('/api/integrations/email/check',{})).status,401);assert.equal((await post('/api/application-email/unsubscribe',{token:'invalid'})).status,400);assert.equal((await fetch(app.base+'/application-email')).status,200);}
 finally{await app.cleanup();}
});
test('all queued mail kinds get one no-reply footer and automatic-response headers, including pre-existing queued messages',async()=>{
 const u=await unit();try{
  for(const kind of ['verification','recovery','notification','application-receipt','application-progress','application-document'])u.notices.enqueue({to:'recipient@example.test',subject:'Test '+kind,body:'A message queued before this delivery-format change.',kind,key:'no-reply:'+kind});
  await u.notices.drain();assert.equal(u.messages.length,6);for(const {payload,mime} of u.messages){assert.equal(payload.from.name,'Come Together Property Management (No Reply)');assert.equal(payload.from.address,'company@example.test');assert.equal(payload.headers['Auto-Submitted'],'auto-generated');assert.equal(payload.headers['X-Auto-Response-Suppress'],'All');assert.equal((payload.text.match(/Please do not reply to this email\./g)||[]).length,1);assert.match(payload.text,/https:\/\/ctpm.example.test\/#contact/);assert.match(mime,/Auto-Submitted: auto-generated/);assert.equal(payload.replyTo,undefined);assert.ok(!mime.includes('noreply@'));
  }
 }finally{u.cleanup();}
});
test('legacy delivery keeps its authorized sender address and applies the shared no-reply policy',async()=>{
 const u=await unit(),fetchBefore=global.fetch,keys=['ALLOW_PAID_INTEGRATIONS','RESEND_API_KEY','EMAIL_FROM'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.SMTP_ENABLED='false';process.env.ALLOW_PAID_INTEGRATIONS='true';process.env.RESEND_API_KEY='synthetic-not-real';process.env.EMAIL_FROM='Company <company@example.test>';const payloads=[];global.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');payloads.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'synthetic-message'})};};
  const {createNotifications}=require('../lib/notifications'),legacy=createNotifications(u.db);legacy.enqueue({to:'recipient@example.test',subject:'Test',body:'A legacy queued message',key:'legacy-no-reply'});await legacy.drain();assert.equal(payloads.length,1);assert.equal(payloads[0].from,'"Come Together Property Management (No Reply)" <company@example.test>');assert.equal(payloads[0].headers['Auto-Submitted'],'auto-generated');assert.match(payloads[0].text,/Please do not reply/);
 }finally{global.fetch=fetchBefore;for(const[k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;u.cleanup();}
});
test('startup SMTP verification sends no message and reports only safe failure codes',async()=>{
 const u=await unit();try{
  const ready=await u.notices.startupCheck();assert.equal(ready.status,'verified');assert.equal(u.messages.length,0);assert.ok(u.notices.deliveryStatus(u.admin).smtp.lastVerifiedAt);
  u.state.error=Object.assign(Error('Must not expose '+process.env.SMTP_PASSWORD),{code:'EAUTH'});const failed=await u.notices.startupCheck();assert.deepEqual(failed,{status:'failed',code:'AUTHENTICATION_FAILED'});assert.ok(u.notices.deliveryStatus(u.admin).smtp.retryAfter);u.notices.enqueue({to:'recipient@example.test',subject:'Held',body:'Held while auth is failing',key:'startup-hold'});await u.notices.drain();assert.equal(u.db.prepare("SELECT status FROM email_outbox WHERE event_key='startup-hold'").get().status,'Pending');assert.equal(u.messages.length,0);
 }finally{u.cleanup();}
});
test('personal Gmail uses an app password, encrypted transport and its actual no-reply sender without exposing credentials',async()=>{
 const u=await unit();try{
  process.env.SMTP_HOST=' SMTP.GMAIL.COM ';process.env.SMTP_USER=process.env.SMTP_FROM='synthetic.sender@gmail.com';process.env.SMTP_PASSWORD='abcd efgh ijkl mnop';
  const checked=await u.mailer.verify();assert.match(checked.message,/Gmail SMTP/);assert.equal(u.messages.length,0);
  assert.equal(u.options[0].host,'smtp.gmail.com');assert.equal(u.options[0].auth.pass,'abcdefghijklmnop');assert.equal(u.options[0].secure,true);assert.equal(u.options[0].tls.rejectUnauthorized,true);
  u.notices.enqueue({to:'recipient@example.test',subject:'Gmail notice',body:'Synthetic message',key:'gmail-notice'});await u.notices.drain();assert.equal(u.messages.length,1);
  const {payload,mime}=u.messages[0];assert.equal(payload.from.address,'synthetic.sender@gmail.com');assert.equal(payload.from.name,'Come Together Property Management (No Reply)');assert.equal(payload.envelope.from,payload.from.address);assert.match(payload.text,/Please do not reply/);assert.equal(payload.headers['Auto-Submitted'],'auto-generated');assert.ok(!mime.includes('abcdefghijklmnop'));
  const status=u.notices.deliveryStatus(u.admin);assert.equal(status.provider,'Gmail SMTP');assert.equal(status.smtp.dailyLimit,400);assert.equal(status.smtp.sentLast24h,1);assert.ok(!JSON.stringify(status).includes('abcdefghijklmnop'));assert.ok(!JSON.stringify(status).includes('synthetic.sender@gmail.com'));
  process.env.SMTP_PORT='587';await u.mailer.verify();assert.equal(u.options[1].secure,false);assert.equal(u.options[1].requireTLS,true);assert.equal(u.options[1].tls.minVersion,'TLSv1.2');
  process.env.SMTP_ENABLED='false';assert.equal(u.mailer.configured(),false);assert.equal(u.mailer.status().provider,'Gmail SMTP');
 }finally{u.cleanup();}
});
test('Gmail refuses mismatched mailboxes, old mail.com identities and unsupported hosts before opening a transport',async()=>{
 const u=await unit();try{
  process.env.SMTP_HOST='smtp.gmail.com';process.env.SMTP_USER=process.env.SMTP_FROM='old.sender@example.test';
  process.env.SMTP_PASSWORD='abcdefghijklmnop';
  assert.equal(u.mailer.configured(),false);await assert.rejects(u.mailer.verify(),{code:'SMTP_NOT_CONFIGURED'});assert.equal(u.options.length,0);
  process.env.SMTP_USER='synthetic.sender@gmail.com';assert.equal(u.mailer.configured(),false);
  process.env.SMTP_FROM=process.env.SMTP_USER;assert.equal(u.mailer.configured(),true);
  for(const host of ['localhost','127.0.0.1','169.254.169.254','smtp.gmail.com.attacker.test','https://smtp.gmail.com']){process.env.SMTP_HOST=host;assert.equal(u.mailer.configured(),false);await assert.rejects(u.mailer.verify(),{code:'SMTP_NOT_CONFIGURED'});}
  assert.equal(u.options.length,0);process.env.SMTP_HOST='smtp.gmail.com';process.env.SMTP_PASSWORD='ordinary-password-not-an-app-password';assert.equal(u.mailer.configured(),false);assert.match(u.mailer.status().problem,/16-character Google app password/);await assert.rejects(u.mailer.verify(),{code:'SMTP_NOT_CONFIGURED'});assert.equal(u.options.length,0);process.env.SMTP_PASSWORD=' \n\t';assert.equal(u.mailer.configured(),false);assert.ok(u.mailer.status().missing.includes('SMTP_PASSWORD'));
 }finally{u.cleanup();}
});
test('Gmail daily budget holds pending email without consuming retries and resumes after the rolling window',async()=>{
 const u=await unit();try{
  process.env.SMTP_HOST='smtp.gmail.com';process.env.SMTP_USER=process.env.SMTP_FROM='synthetic.sender@gmail.com';
  process.env.SMTP_PASSWORD='abcdefghijklmnop';
  const insert=u.db.prepare("INSERT INTO email_outbox(recipient,subject,body,kind,status,available_at,created_at,sent_at,event_key) VALUES('recipient@example.test','Already sent','','transactional','Sent',?,?,?,?)"),now=new Date().toISOString();
  for(let i=0;i<400;i++)insert.run(Date.now(),now,now,'prior:'+i);
  u.notices.enqueue({to:'recipient@example.test',subject:'Wait for budget',body:'Keep this until delivery',key:'daily-wait'});await u.notices.drain();
  let row=u.db.prepare("SELECT * FROM email_outbox WHERE event_key='daily-wait'").get();assert.equal(row.status,'Pending');assert.equal(row.attempts,0);assert.equal(row.body,'Keep this until delivery');assert.equal(u.messages.length,0);
  u.db.prepare("UPDATE email_outbox SET sent_at=? WHERE status='Sent'").run(new Date(Date.now()-25*3600000).toISOString());await u.notices.drain();
  row=u.db.prepare("SELECT * FROM email_outbox WHERE event_key='daily-wait'").get();assert.equal(row.status,'Sent');assert.equal(row.body,'');assert.equal(u.messages.length,1);assert.equal(u.notices.deliveryStatus(u.admin).smtp.sentLast24h,1);
 }finally{u.cleanup();}
});
