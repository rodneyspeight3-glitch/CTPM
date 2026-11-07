const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const inventory=require('./listing-fixtures.cjs');
async function setup(){
 const app=await fixture({SMTP_ENABLED:'false'}),cookies={};
 const call=async(path,{method='GET',body,cookie=cookies.admin,origin=app.base}={})=>fetch(app.base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
 async function login(email){const r=await call('/api/login',{method:'POST',body:{email,password:app.credentials.password},cookie:''});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 cookies.admin=await login(app.credentials.email);const users={};
 for(const role of ['agent','tenant','neighbor']){const r=await call('/api/admin/users',{method:'POST',body:{name:'Test '+role,email:role+'@example.test',password:app.credentials.password,role:role==='neighbor'?'tenant':role}});assert.equal(r.status,201);users[role]=(await r.json()).user;cookies[role]=await login(role+'@example.test');}
 const property=(await(await call('/api/properties',{method:'POST',body:inventory[0]})).json()).property;
 const post=async(path,body,cookie=cookies.admin)=>{const r=await call(path,{method:'POST',body,cookie});return {status:r.status,data:await r.json()};};
 return {app,call,post,cookies,users,property};
}
test('all ten operations workflows persist, filter, export, comment, archive and restore without changing public availability',async()=>{
 const s=await setup();try{
  const schema=await(await s.call('/api/workbench/schema')).json();assert.equal(schema.boards.length,10);assert.deepEqual(schema.boards.map(b=>b.id),['inspections','keys','assets','safety','move-in','move-out','quotes','orders','projects','utilities']);
  for(const board of schema.boards){
   const meta={};for(const f of board.fields)if(f.required)meta[f.key]=1;
   const created=await s.post('/api/workbench/'+board.id,{title:board.title+' test',propertyId:s.property.id,assigneeId:s.users.agent.id,dueOn:'2027-05-01',priority:'Important',meta,checklist:[{id:'first',text:'Verify the record',result:'Pending',note:''}]},s.cookies.agent);assert.equal(created.status,201,board.id+': '+JSON.stringify(created.data));let record=created.data.record;
   assert.equal(record.propertyName,inventory[0].name);assert.equal(record.assigneeName,'Test agent');
   const saved=await s.post('/api/workbench/'+board.id+'/'+record.id,{...record,version:record.version,notes:'Recorded finding <script>',checklist:[{id:'first',text:'Verify the record',result:'Done',note:'Checked carefully.'}]},s.cookies.agent);assert.equal(saved.status,200);record=saved.data.record;assert.equal(record.progress,100);assert.equal(record.version,2);
   assert.equal((await s.post('/api/workbench/'+board.id+'/'+record.id+'/comments',{body:'Team update'},s.cookies.agent)).status,200);
   const detail=await(await s.call('/api/workbench/'+board.id+'/'+record.id)).json();assert.equal(detail.comments[0].body,'Team update');assert.equal(detail.events.length,2);
   const matches=await(await s.call('/api/workbench/'+board.id+'?q=Recorded&priority=Important&propertyId='+s.property.id+'&assigneeId='+s.users.agent.id+'&sort=due')).json();assert.equal(matches.total,1);
   const csv=await(await s.call('/api/workbench/'+board.id+'/export')).text();assert.match(csv,/Recorded finding <script>/);assert.match(csv,/"100"/);
   const ics=await(await s.call('/api/workbench/'+board.id+'/calendar')).text();assert.match(ics,/DTSTART;VALUE=DATE:20270501/);
   let archived=await s.post('/api/workbench/'+board.id+'/'+record.id+'/archive',{version:record.version,archived:true});assert.equal(archived.status,200);assert.equal((await(await s.call('/api/workbench/'+board.id)).json()).total,0);assert.equal((await(await s.call('/api/workbench/'+board.id+'?archive=archived')).json()).total,1);
   assert.equal((await s.post('/api/workbench/'+board.id+'/'+record.id,{...record,version:archived.data.record.version})).status,400);
   assert.equal((await s.post('/api/workbench/'+board.id+'/'+record.id+'/archive',{version:archived.data.record.version,archived:false})).status,200);
  }
  const publicListings=await(await s.call('/api/vacancies',{cookie:''})).json();assert.equal(publicListings.properties.length,1);assert.equal(publicListings.properties[0].id,s.property.id);
 }finally{await s.app.cleanup();}
});
test('staff records enforce permissions, references, date/numeric validation, original request origin and optimistic versions',async()=>{
 const s=await setup();try{
  assert.equal((await s.call('/api/workbench/schema',{cookie:''})).status,401);
  const personalSchema=await(await s.call('/api/workbench/schema',{cookie:s.cookies.tenant})).json();assert.deepEqual(personalSchema,{boards:[],properties:[],members:[]});
  for(const board of ['inspections','keys','assets','safety','move-in','move-out','quotes','orders','projects','utilities']){assert.equal((await s.call('/api/workbench/'+board,{cookie:s.cookies.tenant})).status,403);assert.equal((await s.post('/api/workbench/'+board,{title:'Forbidden'},s.cookies.tenant)).status,403);}
  const body={title:'Inspection',meta:{},propertyId:s.property.id};
  assert.equal((await s.call('/api/workbench/inspections',{method:'POST',body,origin:'https://other.example.test'})).status,403);
  for(const invalid of [{...body,dueOn:'2027-02-30'},{...body,propertyId:999999},{...body,assigneeId:s.users.tenant.id},{...body,meta:{untrusted:'value'}},{...body,checklist:[{id:'x',text:'A'},{id:'x',text:'B'}]}])assert.equal((await s.post('/api/workbench/inspections',invalid)).status,400);
  assert.equal((await s.post('/api/workbench/projects',{title:'Dates',meta:{startsOn:'2027-05-02',targetEnd:'2027-05-01'}})).status,400);
  assert.equal((await s.post('/api/workbench/quotes',{title:'Price',meta:{quantity:1,unitCost:1.001}})).status,400);
  const created=(await s.post('/api/workbench/inspections',body)).data.record;
  const updated=await s.post('/api/workbench/inspections/'+created.id,{...created,title:'First editor',version:1});assert.equal(updated.status,200);
  assert.equal((await s.post('/api/workbench/inspections/'+created.id,{...created,title:'Stale editor',version:1})).status,409);
  assert.equal((await(await s.call('/api/workbench/inspections/'+created.id)).json()).record.title,'First editor');
  assert.equal((await s.post('/api/workbench/inspections/'+created.id+'/archive',{version:1,archived:true})).status,409);
  assert.equal((await s.call('/api/workbench/inspections/'+created.id+'/comments',{method:'POST',body:{body:'Hidden'},cookie:s.cookies.tenant})).status,403);
  assert.equal((await s.call('/api/workbench/constructor')).status,404);
 }finally{await s.app.cleanup();}
});
test('purchase approvals require an administrator and receiving preserves the approved quantity and price',async()=>{
 const s=await setup();try{
  const body={title:'=SUM(1,2)',status:'Requested',meta:{provider:'Test supplier',scope:'Supplies',quantity:3,unitCost:12.34,tax:1.01,delivery:2}};
  assert.equal((await s.post('/api/workbench/orders',{...body,status:'Approved'},s.cookies.agent)).status,403);
  let record=(await s.post('/api/workbench/orders',body,s.cookies.agent)).data.record;assert.equal(record.metrics.total,40.03);
  assert.equal((await s.post('/api/workbench/orders/'+record.id,{...record,status:'Approved'},s.cookies.agent)).status,403);
  let approved=await s.post('/api/workbench/orders/'+record.id,{...record,status:'Approved'});assert.equal(approved.status,200);record=approved.data.record;
  assert.equal((await s.post('/api/workbench/orders/'+record.id,{...record,meta:{...record.meta,unitCost:1}},s.cookies.agent)).status,403);
  assert.equal((await s.post('/api/workbench/orders/'+record.id,{...record,status:'Received'},s.cookies.agent)).status,200);
  const exportText=await(await s.call('/api/workbench/orders/export')).text();assert.match(exportText,/"'=SUM\(1,2\)"/);
  const draft=(await s.post('/api/workbench/orders',{...body,title:'Draft order',status:'Draft'},s.cookies.agent)).data.record;
  assert.equal((await s.post('/api/workbench/orders/'+draft.id,{...draft,status:'Received'},s.cookies.agent)).status,400);
  assert.equal((await s.post('/api/workbench/orders/'+draft.id,{...draft,status:'Approved'})).status,400);
  assert.equal((await s.call('/api/workbench/orders/export',{cookie:s.cookies.tenant})).status,403);
 }finally{await s.app.cleanup();}
});
test('key custody records require handover facts, retain actor history and survive property deletion',async()=>{
 const s=await setup();try{
  const body={title:'Front door keys',propertyId:s.property.id,status:'Checked out',dueOn:'2026-11-06',meta:{keyType:'Key',quantity:2,holder:'Test holder',checkedOutOn:'2026-11-01'}};
  assert.equal((await s.post('/api/workbench/keys',{...body,meta:{...body.meta,holder:''}})).status,400);
  let record=(await s.post('/api/workbench/keys',body)).data.record;
  assert.equal((await(await s.call('/api/workbench/keys?overdue=1&today=2026-11-06')).json()).total,0);
  assert.equal((await(await s.call('/api/workbench/keys?overdue=1&today=2026-11-07')).json()).total,1);
  assert.equal((await s.post('/api/workbench/keys/'+record.id,{...record,status:'Returned',meta:{...record.meta,returnedOn:'2026-10-31'}})).status,400);
  const updated=await s.post('/api/workbench/keys/'+record.id,{...record,status:'Returned',meta:{...record.meta,returnedOn:'2026-11-06'}});assert.equal(updated.status,200);assert.ok(updated.data.events.some(event=>event.action.includes('Test holder')));
  assert.equal((await s.post('/api/properties/'+s.property.id+'/delete',{})).status,200);
  record=(await(await s.call('/api/workbench/keys/'+record.id)).json()).record;assert.equal(record.propertyId,null);assert.equal(record.propertyName,inventory[0].name);
 }finally{await s.app.cleanup();}
});
test('organizer content is account-private for tenants, agents and administrators, including exports and forged ownership fields',async()=>{
 const s=await setup();try{
  const created=await s.post('/api/organizer',{title:'Private tenant note <script>',body:'Only the owner should see this.',userId:s.users.neighbor.id,tags:['moving'],color:'coral',checklist:[{id:'one',text:'Read the guide',done:false}]},s.cookies.tenant);assert.equal(created.status,201);let entry=created.data.entry;
  for(const cookie of [s.cookies.neighbor,s.cookies.agent,s.cookies.admin]){assert.equal((await s.call('/api/organizer/'+entry.id,{cookie})).status,404);assert.equal((await s.post('/api/organizer/'+entry.id,{...entry,title:'Unauthorized'},cookie)).status,404);assert.equal((await s.post('/api/organizer/'+entry.id+'/archive',{version:entry.version,archived:true},cookie)).status,404);assert.doesNotMatch(await(await s.call('/api/organizer/export?userId='+s.users.tenant.id,{cookie})).text(),/Private tenant note/);}
  const updated=await s.post('/api/organizer/'+entry.id,{...entry,body:'Owner updated',checklist:[{id:'one',text:'Read the guide',done:true}]},s.cookies.tenant);assert.equal(updated.status,200);assert.equal(updated.data.entry.checklist[0].done,true);
  assert.equal((await s.post('/api/organizer/'+entry.id,{...entry,body:'Stale'},s.cookies.tenant)).status,409);entry=updated.data.entry;
  assert.equal((await s.post('/api/organizer/'+entry.id+'/delete',{version:entry.version,confirmTitle:entry.title},s.cookies.tenant)).status,400);
  entry=(await s.post('/api/organizer/'+entry.id+'/archive',{version:entry.version,archived:true},s.cookies.tenant)).data.entry;
  assert.equal((await s.post('/api/organizer/'+entry.id+'/delete',{version:entry.version,confirmTitle:'Wrong title'},s.cookies.tenant)).status,400);
  assert.equal((await s.post('/api/organizer/'+entry.id+'/delete',{version:entry.version,confirmTitle:entry.title},s.cookies.tenant)).status,200);
  assert.equal((await s.call('/api/organizer/'+entry.id,{cookie:s.cookies.tenant})).status,404);const replacement=await s.post('/api/organizer',{title:'A separate new entry'},s.cookies.tenant);assert.ok(replacement.data.entry.id>entry.id);assert.equal((await s.post('/api/organizer/'+entry.id,{...entry,title:'Stale edit after deletion'},s.cookies.tenant)).status,404);
  assert.equal((await s.call('/api/organizer',{cookie:''})).status,401);
 }finally{await s.app.cleanup();}
});
test('recurring personal tasks clamp month ends, reset checkmarks once and keep calendar days stable',async()=>{
 const s=await setup();try{
  for(const [due,expected] of [['2027-01-31','2027-02-28'],['2028-01-31','2028-02-29']]){
   let entry=(await s.post('/api/organizer',{kind:'task',title:'Monthly task',dueOn:due,repeat:'Monthly',checklist:[{id:'step',text:'Do the thing',done:true}]},s.cookies.tenant)).data.entry;
   const version=entry.version,completed=await s.post('/api/organizer/'+entry.id+'/complete',{version},s.cookies.tenant);assert.equal(completed.status,200);entry=completed.data.entry;assert.equal(entry.dueOn,expected);assert.equal(entry.status,'Open');assert.equal(entry.checklist[0].done,false);assert.ok(entry.lastCompletedAt);
   assert.equal((await s.post('/api/organizer/'+entry.id+'/complete',{version},s.cookies.tenant)).status,409);const again=await s.post('/api/organizer/'+entry.id+'/complete',{version:entry.version},s.cookies.tenant);assert.equal(again.data.entry.dueOn,expected.slice(0,4)+'-03-31');
   const ics=await(await s.call('/api/organizer/calendar',{cookie:s.cookies.tenant})).text();assert.ok(ics.includes('DTSTART;VALUE=DATE:'+expected.slice(0,4)+'0331'));
  }
  const entry=(await s.post('/api/organizer',{kind:'task',title:'One-time task',dueOn:'2027-03-14'},s.cookies.tenant)).data.entry;
  let done=(await s.post('/api/organizer/'+entry.id+'/complete',{version:entry.version},s.cookies.tenant)).data.entry;assert.equal(done.status,'Done');done=(await s.post('/api/organizer/'+entry.id+'/reopen',{version:done.version},s.cookies.tenant)).data.entry;assert.equal(done.status,'Open');
  assert.equal((await s.post('/api/organizer',{kind:'note',title:'Invalid recurrence',repeat:'Daily'},s.cookies.tenant)).status,400);
 }finally{await s.app.cleanup();}
});
