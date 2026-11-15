const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream}=require('pdf-lib');
const {fixture}=require('./fixture.cjs');
const {rentalApplication,pdf:unreadablePdf}=require('./rental-fixtures.cjs');
const inventory=require('./listing-fixtures.cjs');
const {applicationPdf}=require('../lib/application-pdf');

function content(pdf){
 const streams=pdf.getPages().flatMap(page=>{const contents=page.node.Contents();return contents instanceof PDFArray?contents.asArray().map(ref=>pdf.context.lookup(ref)):contents?[contents]:[];});
 for(const [,object]of pdf.context.enumerateIndirectObjects())if(object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))===PDFName.of('Form'))streams.push(object);
 return [...new Set(streams)].flatMap(stream=>[...Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1').matchAll(/<([a-f\d]+)>\s*Tj/gi)].map(match=>Buffer.from(match[1],'hex').toString('latin1'))).join(' ').replace(/\s+/g,' ');
}
function attachments(pdf){
 const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray),result=[];
 for(let i=0;i<names.size();i+=2){const file=names.lookup(i+1,PDFDict),stream=file.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'));result.push({name:names.get(i).decodeText(),data:Buffer.from(decodePDFRawStream(stream).decode())});}
 return result;
}
async function incomePdf(){
 const pdf=await PDFDocument.create(),first=pdf.addPage([792,612]),second=pdf.addPage([612,792]);
 first.drawText('INCOME PAGE ONE');second.drawText('INCOME PAGE TWO');
 const field=pdf.getForm().createTextField('employer');field.addToPage(second,{x:50,y:500,width:300,height:30});field.setText('FILLED EMPLOYER CONFIRMATION');
 return Buffer.from(await pdf.save());
}

test('staff download one private PDF with every application answer, all PDF pages, photo documents and later uploads',async()=>{
 const app=await fixture({SMTP_ENABLED:'false'});
 const call=(route,{cookie,method='GET',data}={})=>fetch(app.base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json',Origin:app.base}:{})},body:data?JSON.stringify(data):undefined});
 const post=async(route,data,cookie)=>{const r=await call(route,{method:'POST',data,cookie});assert.ok(r.ok,await r.clone().text());return r;};
 const login=async credentials=>(await post('/api/login',credentials)).headers.get('set-cookie').split(';')[0];
 try{
  const admin=await login(app.credentials),cookies={admin};
  for(const role of ['tenant','agent']){const user={name:'PDF '+role,email:role+'@example.test',password:app.credentials.password,role};await post('/api/admin/users',user,admin);cookies[role]=await login(user);}
  const {property}=await(await post('/api/properties',inventory[0],admin)).json();
  const income=await incomePdf(),png=fs.readFileSync(path.join(__dirname,'../public/brand/come-together-mark.png')),jpg=fs.readFileSync(path.join(__dirname,'../public/images/home-1.jpg'));
  const documents=[
   {kind:'income',name:'income.pdf',mime:'application/pdf',data:income.toString('base64')},
   {kind:'photo_id',name:'identification.png',mime:'image/png',data:png.toString('base64')},
   {kind:'rental_history',name:'history.jpg',mime:'image/jpeg',data:jpg.toString('base64')}
  ];
  const input=rentalApplication({name:'PDF Applicant',email:'tenant@example.test',hasPets:true,petDetails:'One indoor cat',otherIncome:'Freelance design',emailUpdates:true,documents});
  const receipt=await(await post('/api/vacancies/'+property.id+'/applications',input)).json();
  await post('/api/application-receipts/claim',{token:receipt.trackingUrl.split('=')[1]},cookies.tenant);
  const {applications}=await(await call('/api/applications',{cookie:admin})).json(),id=applications[0].id,url='/api/applications/'+id+'/download-pdf';
  await post('/api/applications/'+id+'/status',{status:'Reviewing',note:'PRIVATE STAFF NOTE EXCLUDED'},admin);
  const request=await(await post('/api/applications/'+id+'/document-requests',{kind:'additional',message:'Updated proof',dueOn:''},admin)).json();
  await post('/api/document-requests/'+request.id+'/upload',{name:'follow-up.pdf',mime:'application/pdf',data:income.toString('base64')},cookies.tenant);
  assert.equal((await call(url)).status,401);
  assert.equal((await call(url,{cookie:cookies.tenant})).status,403);
  assert.equal((await call('/api/applications/999999/download-pdf',{cookie:admin})).status,404);
  let result;
  for(const cookie of [admin,cookies.agent]){
   const r=await call(url,{cookie});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');
   assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('content-disposition'),/^attachment; filename="application-APP-[A-F\d]+-complete\.pdf"$/);
   const bytes=await r.arrayBuffer();assert.equal(bytes.byteLength,Number(r.headers.get('content-length')));result=await PDFDocument.load(bytes);
   assert.equal(result.getTitle(),'Rental application '+receipt.reference);
   const text=content(result);
   for(const value of [receipt.reference,input.name,input.email,input.phone,input.currentAddress,input.leaseDuration,input.moveIn,'700',input.rentInterruption,'Persons living in unit: 2',input.employer,input.jobTitle,'$4,500.25',input.employmentLength,input.otherIncome,input.landlordName,input.landlordPhone,input.leavingReason,'Previously evicted: No','Previously filed for bankruptcy: No','Pets: Yes',input.petDetails,'Smokes: No',input.message,'Reviewing','SUPPORTING DOCUMENTS (4)','follow-up.pdf','INCOME PAGE ONE','INCOME PAGE TWO','FILLED EMPLOYER CONFIRMATION'])assert.ok(text.includes(value),value);
   assert.ok(!text.includes('PRIVATE STAFF NOTE EXCLUDED'));
   assert.ok(text.includes('Management contact permission: Confirmed at submission'));assert.ok(text.includes('Application email updates: Requested'));
   const originals=attachments(result);assert.equal(originals.length,4);assert.deepEqual(originals.map(d=>d.data),[income,png,jpg,income]);
   assert.equal(result.getPages().filter(p=>p.getWidth()===792&&p.getHeight()===612).length,2);
   assert.ok(result.getPages().some(p=>{const resources=p.node.Resources();return resources?.has(PDFName.of('XObject'));}));
  }
  const head=await call(url,{cookie:admin,method:'HEAD'});assert.equal(head.status,200);assert.ok(Number(head.headers.get('content-length'))>0);assert.equal((await head.arrayBuffer()).byteLength,0);
  const {application}=await(await call('/api/applications/'+id,{cookie:admin})).json();
  await post('/api/application-documents/'+application.documents[0].id+'/delete',{reason:'No longer retained'},admin);
  result=await PDFDocument.load(await(await call(url,{cookie:admin})).arrayBuffer());assert.deepEqual(attachments(result).map(d=>d.name),['01-identification.png','02-history.jpg','03-follow-up.pdf']);
  assert.ok(!content(result).includes('Original filename: income.pdf'));
 }finally{await app.cleanup();}
});

test('unreadable originals stay attached with a visible notice, and legacy/optional answers are not invented',async()=>{
 const legacy={id:1,reference:'APP-LEGACY',property_name:'Address application',requested_address:'10 Test Avenue',status:'Submitted',name:'Legacy Applicant',email:'legacy@example.test',phone:'202-555-0123',move_in:'2099-01-15',occupants:1,form_version:1,details:{},created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',message:'Legacy message'};
 const pdf=await PDFDocument.load(await applicationPdf(legacy,[{name:'locked-or-unreadable.pdf',kind:'income',mime:'application/pdf',data:unreadablePdf,created_at:legacy.created_at}]));
 assert.match(content(pdf),/predates the expanded application form/);assert.match(content(pdf),/could not be displayed/);assert.deepEqual(attachments(pdf)[0].data,unreadablePdf);
 const largeImage=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(largeImage);largeImage.writeUInt32BE(50000,16);largeImage.writeUInt32BE(50000,20);
 const imagePacket=await PDFDocument.load(await applicationPdf(legacy,[{name:'oversized.png',kind:'photo_id',mime:'image/png',data:largeImage,created_at:legacy.created_at}]));
 assert.match(content(imagePacket),/exceeds the combined image preview size limit/);assert.deepEqual(attachments(imagePacket)[0].data,largeImage);
 const expanded=await PDFDocument.load(await applicationPdf({...legacy,form_version:4,details:{hasPets:null,monthlyIncomeCents:0}},[]));
 assert.match(content(expanded),/Other sources of income: Not supplied/);assert.match(content(expanded),/Pets: Not supplied/);assert.match(content(expanded),/Monthly income: \$0\.00/);assert.match(content(expanded),/No supporting documents are currently stored/);
});

test('an unusually long supporting PDF is preserved in full as an attachment instead of an unbounded page merge',async()=>{
 const original=await PDFDocument.create();for(let i=0;i<501;i++)original.addPage();const data=Buffer.from(await original.save());
 const pdf=await PDFDocument.load(await applicationPdf({reference:'APP-LONG',form_version:1,details:{}},[{name:'long.pdf',kind:'additional',mime:'application/pdf',data}]));
 assert.ok(pdf.getPageCount()<10);assert.match(content(pdf),/exceeds the combined preview page limit/);assert.deepEqual(attachments(pdf)[0].data,data);
});
