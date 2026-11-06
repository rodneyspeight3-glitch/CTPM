const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Stripe=require('stripe');
const {PDFDocument}=require('pdf-lib');
const {createAuth}=require('../lib/auth');
const {createManagement}=require('../lib/management');
const {createOperations}=require('../lib/operations');
const {createVacancies}=require('../lib/vacancies');
const {createNotifications}=require('../lib/notifications');
const {createAccountServices}=require('../lib/account-services');
const {createResidentServices}=require('../lib/resident-services');
const {createFinance}=require('../lib/finance');
const {createSignatures}=require('../lib/signatures');
const {createExperience}=require('../lib/experience');
const {digest}=require('../lib/service-utils');
const inventory=require('./listing-fixtures.cjs');
const request=()=>({headers:{'user-agent':'Synthetic test browser'},socket:{remoteAddress:'127.0.0.1'}});
async function unit(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ctpm-services-')),old={PUBLIC_APP_URL:process.env.PUBLIC_APP_URL,STRIPE_WEBHOOK_SECRET:process.env.STRIPE_WEBHOOK_SECRET};process.env.PUBLIC_APP_URL='https://ctpm.example.test';process.env.STRIPE_WEBHOOK_SECRET='whsec_test_not_a_real_secret';
 const auth=await createAuth(path.join(directory,'app.sqlite')),db=auth.db,management=createManagement(db),operations=createOperations(db),vacancies=createVacancies(db),sent=[];
 const notices=createNotifications(db,{sendMail:async data=>{sent.push(data);return {id:'test-mail-'+sent.length};}}),accounts=createAccountServices(db,notices),resident=createResidentServices(db,notices),experience=createExperience(db,notices);
 const password='Synthetic test password 123456789';
 const admin=await auth.addUser({name:'Test Admin',email:'admin-unit@example.test',role:'admin',password}),tenant=await auth.addUser({name:'Test Resident',email:'resident-unit@example.test',role:'tenant',password}),other=await auth.addUser({name:'Other Resident',email:'other-unit@example.test',role:'tenant',password});
 const realStripe=new Stripe('sk_test_not_a_real_key'),sessions=new Map();let creations=0;
 const stripeClient={webhooks:realStripe.webhooks,checkout:{sessions:{create:async(data,options)=>{const key=options.idempotencyKey;for(const session of sessions.values())if(session.key===key)return session;const session={id:'cs_test_'+(++creations),url:'https://checkout.stripe.com/c/pay/test_'+creations,status:'open',payment_status:'unpaid',amount_total:data.line_items[0].price_data.unit_amount,currency:'usd',client_reference_id:data.client_reference_id,payment_intent:'pi_test_'+creations,key};sessions.set(session.id,session);return session;},expire:async id=>{const session=sessions.get(id);session.status='expired';return session;},retrieve:async id=>sessions.get(id)}}};
 const finance=createFinance(db,notices,{stripeClient}),signatures=createSignatures(db,notices);
 const verify=user=>db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(new Date().toISOString(),user.id);
 const webhook=(type,object,id='evt_'+Math.random().toString(36).slice(2))=>{const event={id,type,created:Math.floor(Date.now()/1000),data:{object}},payload=JSON.stringify(event),header=realStripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});return finance.webhook(Buffer.from(payload),header);};
 return {auth,db,management,operations,vacancies,notices,accounts,resident,experience,finance,signatures,sent,admin,tenant,other,password,verify,webhook,sessions,get creations(){return creations;},cleanup(){db.close();fs.rmSync(directory,{recursive:true,force:true});for(const [key,value]of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}};
}
test('verification and password recovery use private expiring one-use tokens, revoke sessions, and reject changed accounts',async()=>{
 const u=await unit();try{
  const {accounts,tenant,auth,db,password,sent}=u;
  const initial=await auth.login({email:tenant.email,password},request());assert.ok(initial.cookie);
  assert.equal(accounts.requestVerification(tenant,request()).message.includes('queued'),true);assert.equal(sent.length,0);await u.notices.drain();assert.equal(sent.length,1);
  const token=sent[0].text.match(/#verify=([a-f0-9]{64})/)[1],stored=db.prepare('SELECT * FROM account_tokens').get();assert.equal(stored.token_hash,digest(token));assert.notEqual(stored.token_hash,token);
  assert.equal(accounts.verify({token}).message.includes('verified'),true);assert.throws(()=>accounts.verify({token}),/invalid or expired/);assert.ok(db.prepare('SELECT email_verified_at FROM users WHERE id=?').get(tenant.id).email_verified_at);
  const ack=accounts.forgot({email:tenant.email},request()),unknown=accounts.forgot({email:'missing@example.test'},request());assert.deepEqual(ack,unknown);await u.notices.drain();assert.equal(sent.length,2);
  const reset=sent[1].text.match(/#reset=([a-f0-9]{64})/)[1];await assert.rejects(accounts.reset({token:reset,password:'short',confirmation:'short'}));
  await accounts.reset({token:reset,password:'New synthetic test password 123456',confirmation:'New synthetic test password 123456'});assert.equal(db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id=?').get(tenant.id).total,0);
  await assert.rejects(accounts.reset({token:reset,password,confirmation:password}),/invalid or expired/);
  assert.equal(await auth.login({email:tenant.email,password},request()),null);assert.ok(await auth.login({email:tenant.email,password:'New synthetic test password 123456'},request()));
  accounts.requestVerification(u.other,request());db.prepare("UPDATE account_tokens SET expires_at=0 WHERE user_id=?").run(u.other.id);const expired=db.prepare('SELECT token_hash FROM account_tokens WHERE user_id=?').get(u.other.id);assert.ok(expired);await u.notices.drain();const expiredToken=sent.at(-1).text.match(/#verify=([a-f0-9]{64})/)[1];assert.throws(()=>accounts.verify({token:expiredToken}),/invalid or expired/);
  accounts.forgot({email:u.other.email},request());await u.notices.drain();const changedToken=sent.at(-1).text.match(/#reset=([a-f0-9]{64})/)[1];await auth.updateUser(u.admin,u.other.id,{name:u.other.name,email:'changed@example.test',role:'tenant',active:true});await assert.rejects(accounts.reset({token:changedToken,password,confirmation:password}),/invalid or expired/);
  for(let i=0;i<4;i++){try{accounts.forgot({email:'limited@example.test'},request());}catch(error){assert.equal(error.status,429);break;}}
 }finally{u.cleanup();}
});
test('Stripe hosted checkout only records confirmed payments, is idempotent, handles delayed failure and refunds, and keeps receipts private',async()=>{
 const u=await unit();try{
  const {management,admin,tenant,operations,finance,db}=u;u.verify(tenant);
  const p=management.addProperty(admin,inventory[0]),today=new Date().toISOString().slice(0,10),lease=operations.addLease(admin,{tenantId:tenant.id,propertyId:p.id,startsOn:today.slice(0,4)+'-01-01',endsOn:today.slice(0,4)+'-12-31',monthlyRent:1500.25,deposit:1000,notes:''}),charge=operations.addCharge(admin,{leaseId:lease.id,period:today.slice(0,7),dueOn:today,amount:1500.25});
  await assert.rejects(finance.checkout(u.other,charge.id),e=>e.status===403);await assert.rejects(finance.checkout(admin,charge.id),e=>e.status===403);
  const checkout=await finance.checkout(tenant,charge.id);assert.match(checkout.url,/checkout.stripe.com/);assert.equal(operations.ledger(tenant)[0].paid_cents,0);
  assert.equal((await finance.checkout(tenant,charge.id)).url,checkout.url);assert.equal(u.creations,1);
  assert.throws(()=>operations.recordPayment(admin,charge.id,{amount:1500.25,paidOn:today,method:'Cash',reference:'Manual race'}),e=>e.status===409);
  const session=[...u.sessions.values()][0];session.status='complete';session.payment_status='unpaid';u.webhook('checkout.session.completed',session,'evt_processing');assert.equal(operations.ledger(tenant)[0].paid_cents,0);assert.equal(db.prepare('SELECT status FROM payment_checkouts').get().status,'Processing');
  await assert.rejects(finance.checkout(tenant,charge.id),e=>e.status===409);
  assert.throws(()=>finance.webhook(Buffer.from('{}'),'invalid'),e=>e.status===400);
  session.payment_status='paid';u.webhook('checkout.session.async_payment_succeeded',session,'evt_paid');u.webhook('checkout.session.async_payment_succeeded',session,'evt_paid');u.webhook('checkout.session.completed',session,'evt_paid_replay');
  assert.equal(operations.ledger(tenant)[0].paid_cents,150025);assert.equal(db.prepare('SELECT COUNT(*) AS total FROM rent_payments').get().total,1);
  const payment=db.prepare('SELECT * FROM rent_payments').get();assert.throws(()=>operations.voidPayment(admin,payment.id,{reason:'Manual void'}),e=>e.status===409);
  const receipt=await finance.receipt(tenant,payment.id);assert.equal(Buffer.from(receipt).subarray(0,5).toString(),'%PDF-');await assert.rejects(finance.receipt(u.other,payment.id),e=>e.status===404);
  u.webhook('charge.refunded',{payment_intent:session.payment_intent,amount_refunded:25025},'evt_refund_partial');u.webhook('charge.refunded',{payment_intent:session.payment_intent,amount_refunded:25025},'evt_refund_partial_replay');assert.equal(operations.ledger(tenant)[0].paid_cents,125000);
  u.webhook('charge.refunded',{payment_intent:session.payment_intent,amount_refunded:150025},'evt_refund_full');u.webhook('charge.refunded',{payment_intent:session.payment_intent,amount_refunded:25025},'evt_refund_out_of_order');assert.equal(operations.ledger(tenant)[0].paid_cents,0);assert.equal(finance.report(admin).refundCents,150025);
  await finance.checkout(tenant,charge.id);assert.equal(u.creations,2);const second=[...u.sessions.values()][1];u.webhook('checkout.session.async_payment_failed',second,'evt_failed');assert.equal(db.prepare('SELECT status FROM payment_checkouts WHERE session_id=?').get(second.id).status,'Failed');second.status='complete';second.payment_status='unpaid';u.webhook('checkout.session.completed',second,'evt_older_completed');assert.equal(db.prepare('SELECT status FROM payment_checkouts WHERE session_id=?').get(second.id).status,'Failed');
  u.webhook('charge.dispute.created',{id:'dp_test',payment_intent:session.payment_intent,amount:10000,status:'needs_response'},'evt_dispute');assert.equal(finance.status(admin).alerts.length,1);
  // A later chargeback reopens only the returned amount, including duplicate and older provider events.
  await finance.checkout(tenant,charge.id);const third=[...u.sessions.values()][2];third.status='complete';third.payment_status='paid';u.webhook('checkout.session.completed',third,'evt_third_paid');
  u.webhook('charge.dispute.closed',{id:'dp_lost',payment_intent:third.payment_intent,amount:10000,status:'lost'},'evt_dispute_lost');u.webhook('charge.dispute.closed',{id:'dp_lost',payment_intent:third.payment_intent,amount:10000,status:'lost'},'evt_dispute_lost_replay');assert.equal(operations.ledger(tenant)[0].paid_cents,140025);
  u.webhook('charge.dispute.created',{id:'dp_lost',payment_intent:third.payment_intent,amount:10000,status:'needs_response'},'evt_dispute_older');assert.equal(operations.ledger(tenant)[0].paid_cents,140025);
  await finance.checkout(tenant,charge.id);await finance.cancelCheckout(tenant,charge.id);assert.equal(db.prepare('SELECT status FROM payment_checkouts ORDER BY id DESC LIMIT 1').get().status,'Expired');operations.recordPayment(admin,charge.id,{amount:100,paidOn:today,method:'Cash',reference:'After cancelled checkout'});assert.equal(operations.ledger(tenant)[0].paid_cents,150025);
 }finally{u.cleanup();}
});
test('lease signing retains the original PDF and exact hash, binds to a verified resident, records consent, and prevents duplicate signing',async()=>{
 const u=await unit();try{
  const {management,operations,admin,tenant,signatures,db}=u,p=management.addProperty(admin,inventory[0]),today=new Date().toISOString().slice(0,10),lease=operations.addLease(admin,{tenantId:tenant.id,propertyId:p.id,startsOn:today,endsOn:'2099-01-01',monthlyRent:1500,deposit:1000,notes:''});
  const document=await PDFDocument.create();document.addPage().drawText('Synthetic lease for automated testing only.');const bytes=await document.save(),original=operations.addDocument(admin,lease.id,{name:'test-lease.pdf',data:Buffer.from(bytes).toString('base64')});
  const {id}=await signatures.request(admin,{documentId:original.id,title:'Test lease agreement'}),record=signatures.list(admin)[0];assert.equal(record.document_hash,digest(bytes));assert.equal('original_data' in record,false);assert.deepEqual(Buffer.from(signatures.original(tenant,id).data),Buffer.from(bytes));
  const valid={name:tenant.name,documentHash:record.document_hash,consent:true};await assert.rejects(signatures.sign(tenant,id,valid,request()),e=>e.status===403);u.verify(tenant);
  await assert.rejects(signatures.sign(tenant,id,{...valid,consent:false},request()),e=>e.status===400);await assert.rejects(signatures.sign(tenant,id,{...valid,documentHash:'bad'},request()),e=>e.status===400);await assert.rejects(signatures.sign(tenant,id,{...valid,name:'Wrong person'},request()),e=>e.status===400);assert.throws(()=>signatures.original(u.other,id),e=>e.status===404);
  const results=await Promise.allSettled([signatures.sign(tenant,id,valid,request()),signatures.sign(tenant,id,valid,request())]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const signed=signatures.list(tenant)[0],evidence=signatures.evidence(tenant,id);assert.equal(signed.status,'Signed');assert.equal(evidence.signerName,tenant.name);assert.equal(evidence.verifiedEmail,tenant.email);assert.equal(evidence.documentHash,digest(bytes));assert.equal(evidence.consentVersion,'electronic-lease-signature-v1');
  const completed=operations.document(tenant,signed.signed_document_id),pdf=await PDFDocument.load(completed.data);assert.equal(pdf.getPageCount(),2);assert.deepEqual(Buffer.from(signatures.original(tenant,id).data),Buffer.from(bytes));assert.equal(db.prepare('SELECT COUNT(*) AS total FROM lease_documents').get().total,2);
  const second=await signatures.request(admin,{documentId:original.id,title:'Another request'});signatures.update(tenant,second.id,{status:'Declined',reason:'Need management to correct the dates.'});await assert.rejects(signatures.sign(tenant,second.id,valid,request()),e=>e.status===409);
 }finally{u.cleanup();}
});
test('notification delivery honors verification and opt-in, deduplicates updates, and retries provider failures',async()=>{
 const u=await unit();try{
  const {notices,tenant,db}=u;const event={kind:'maintenance',title:'Repair update',link:'/dashboard#requests',key:'repair-1'};
  notices.notify(tenant.id,event);assert.equal(notices.list(tenant).length,1);await notices.drain();assert.equal(u.sent.length,0);
  u.verify(tenant);db.prepare('UPDATE users SET email_notifications=1 WHERE id=?').run(tenant.id);notices.notify(tenant.id,{...event,key:'repair-2'});notices.notify(tenant.id,{...event,key:'repair-2'});await notices.drain();assert.equal(u.sent.length,1);assert.equal(notices.list(tenant).length,2);
  notices.notify(tenant.id,{...event,key:'repair-3'});db.prepare('UPDATE users SET email_notifications=0 WHERE id=?').run(tenant.id);await notices.drain();assert.equal(u.sent.length,1);assert.equal(db.prepare("SELECT COUNT(*) AS total FROM email_outbox WHERE status='Cancelled'").get().total,1);
  const failing=createNotifications(db,{sendMail:async()=>{throw Error('Synthetic provider failure');}});failing.enqueue({to:'test@example.test',subject:'Synthetic message',body:'No personal information',key:'failure-test'});for(let i=0;i<6;i++){db.prepare("UPDATE email_outbox SET available_at=0 WHERE event_key='failure-test'").run();await failing.drain();}assert.equal(db.prepare("SELECT status FROM email_outbox WHERE event_key='failure-test'").get().status,'Failed');
 }finally{u.cleanup();}
});
