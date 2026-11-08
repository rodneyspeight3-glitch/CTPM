const {PDFDocument}=require('pdf-lib');
const {id,stamp,staff,optional,text,fail,transaction}=require('./service-utils');
const {date,money}=require('./operations');
const {document:pdf}=require('./pdf');
const companyTemplate=require('./company-lease-template');
const {jurisdictions,jurisdiction,inferState,sourceTemplate}=require('./lease-jurisdictions');
const starter=`RESIDENTIAL LEASE AGREEMENT

Landlord / authorized manager: {{managerName}}
Resident: {{tenantName}}
Resident email: {{tenantEmail}}
Premises: {{propertyAddress}}

The parties agree to a tenancy from {{startsOn}} through {{endsOn}}.
Monthly rent: {{monthlyRent}}, due on day {{paymentDay}} of each month.
Security deposit: {{deposit}}.
Payment instructions: {{paymentInstructions}}

Additional agreement terms and disclosures:
{{additionalTerms}}

The parties agree to the terms written in this agreement and its attached addenda, subject to applicable law. Include all property-specific terms and required disclosures before sending.

Management signature: ____________________  Date: __________
Resident signature: ______________________  Date: __________
An in-app resident signature, when completed, is retained on an appended signature record. Management signatures must be supplied separately.`;
const tokens=['managerName','tenantName','tenantEmail','propertyAddress','startsOn','endsOn','monthlyRent','deposit','paymentDay','paymentInstructions','additionalTerms','agreementDate','tenantPhone','managerPhone','noticeContactName','tenancyTerms','parkingTerms','forwardingAddress','stateName','stateSpecificTerms'];
const revision=(row,input)=>{if(!Number.isSafeInteger(input.revision)||input.revision!==row.revision)fail('This lease draft changed. Reopen it to review the latest version.',409);};
function suggestedEnd(starts,duration){
 const match=String(duration||'').trim().match(/^(\d{1,2})\s*(months?|mos?|years?|yrs?)$/i);if(!match||!/^\d{4}-\d{2}-\d{2}$/.test(starts))return '';
 const months=Number(match[1])*(/^y/i.test(match[2])?12:1);if(!months||months>120)return '';
 const d=new Date(starts+'T00:00:00Z');if(!Number.isFinite(d.getTime()))return '';
 const year=d.getUTCFullYear(),month=d.getUTCMonth()+months,day=Math.min(d.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());
 return new Date(Date.UTC(year,month,day)-86400000).toISOString().slice(0,10);
}
function templateBody(value){const body=text(value,'lease agreement wording',30000);for(const match of body.matchAll(/\{\{([^}]+)\}\}/g))if(!tokens.includes(match[1]))fail('Unknown lease placeholder: '+match[1]+'.');if(/\{\{|\}\}/.test(body.replace(/\{\{[^}]+\}\}/g,'')))fail('Close each lease placeholder using {{fieldName}}.');return body;}
function createLeasePreparation(db,operations,signatures,settings,offers){
 db.exec(`CREATE TABLE IF NOT EXISTS lease_template_versions(revision INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS lease_preparations(application_id INTEGER PRIMARY KEY REFERENCES applications(id),data TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'template',upload_name TEXT NOT NULL DEFAULT '',upload_data BLOB,revision INTEGER NOT NULL DEFAULT 1,lease_id INTEGER UNIQUE REFERENCES leases(id),document_id INTEGER REFERENCES lease_documents(id),signature_request_id INTEGER REFERENCES signature_requests(id),created_by INTEGER REFERENCES users(id),updated_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO lease_template_versions(revision,title,body,updated_by,updated_at) VALUES(1,?,?,NULL,?)').run('Residential lease agreement',starter,stamp());
 db.exec('CREATE TABLE IF NOT EXISTS lease_template_imports(source TEXT PRIMARY KEY,revision INTEGER)');
 if(!db.prepare('SELECT source FROM lease_template_imports WHERE source=?').get('company-california-v1')){const latest=db.prepare('SELECT * FROM lease_template_versions ORDER BY revision DESC LIMIT 1').get();let imported=null;if(latest.body!==companyTemplate.body){imported=latest.revision+1;db.prepare('INSERT INTO lease_template_versions(revision,title,body,updated_by,updated_at) VALUES(?,?,?,NULL,?)').run(imported,companyTemplate.title,companyTemplate.body,stamp());}db.prepare('INSERT INTO lease_template_imports VALUES(?,?)').run('company-california-v1',imported);}
 if(!db.prepare('PRAGMA table_info(lease_template_versions)').all().some(c=>c.name==='state_code'))db.exec("ALTER TABLE lease_template_versions ADD COLUMN state_code TEXT NOT NULL DEFAULT 'CA'");
 for(const state of jurisdictions)if(!db.prepare('SELECT revision FROM lease_template_versions WHERE state_code=?').get(state.code)){const t=sourceTemplate(state.code),next=db.prepare('SELECT MAX(revision)+1 AS n FROM lease_template_versions').get().n;db.prepare('INSERT INTO lease_template_versions(revision,title,body,updated_by,updated_at,state_code) VALUES(?,?,?,NULL,?,?)').run(next,t.title,t.body,stamp(),state.code);}
 const authorize=user=>{staff(user);const actor=db.prepare('SELECT role,active FROM users WHERE id=?').get(user.id);if(!actor?.active||!['admin','agent'].includes(actor.role))fail('Your staff access changed. Sign in again.',403);};
 const template=(state='CA')=>db.prepare('SELECT * FROM lease_template_versions WHERE state_code=? ORDER BY revision DESC LIMIT 1').get(jurisdiction(state).code);
 const application=value=>{const row=db.prepare('SELECT * FROM applications WHERE id=?').get(id(value));if(!row)fail('Application not found.',404);return row;};
 const columns='p.application_id,p.data,p.source,p.upload_name,CASE WHEN p.upload_data IS NULL THEN 0 ELSE 1 END AS has_upload,p.revision,p.lease_id,p.document_id,p.signature_request_id,p.created_at,p.updated_at,a.status AS application_status,a.reference,l.status AS lease_status,s.status AS signature_status';
 const read=value=>{const row=db.prepare('SELECT '+columns+' FROM lease_preparations p JOIN applications a ON a.id=p.application_id LEFT JOIN leases l ON l.id=p.lease_id LEFT JOIN signature_requests s ON s.id=(SELECT id FROM signature_requests WHERE document_id=p.document_id ORDER BY id DESC LIMIT 1) WHERE p.application_id=?').get(id(value));if(!row)fail('Lease draft not found.',404);return row;};
 const dto=(row,detail=true)=>{const {data,...rest}=row,values=JSON.parse(data);if(!detail){delete values.terms;delete values.paymentInstructions;delete values.additionalTerms;}const invitation=offers?.dto(offers.latest(row.application_id));return {...rest,values,invitation,hasUpload:!!row.has_upload,state:row.lease_id?(row.lease_status==='Ended'?'Lease ended':row.signature_status==='Signed'?'Signed':row.signature_status==='Pending'?'Awaiting signature':row.signature_status==='Declined'?'Signing declined':row.signature_status==='Voided'?'Signing withdrawn':'Sent'):invitation&&['Pending','Signed'].includes(invitation.status)?(invitation.status==='Signed'?'Applicant signed':'Applicant invited'):row.application_status==='Approved'?'Draft':'Approval changed'};};
 const editable=(user,value,input)=>{authorize(user);const row=read(value);if(row.lease_id)fail('This lease was already sent. Manage its existing record and documents in Leases.',409);if(row.application_status!=='Approved')fail('The application must be Approved before preparing or sending a lease.',409);if(offers?.locked(offers.latest(value)))fail('This agreement was shared. Withdraw its pending invitation before editing; signed agreements are retained unchanged.',409);revision(row,input);return row;};
 function values(input,app){
  const data=input.values;if(!data||typeof data!=='object'||Array.isArray(data))fail('Enter the lease details.');
  const tenantId=data.tenantId==null?null:id(data.tenantId),propertyId=data.propertyId==null?null:id(data.propertyId);
  if(tenantId&&!db.prepare("SELECT id FROM users WHERE id=? AND role='tenant' AND active=1 AND email=? COLLATE NOCASE").get(tenantId,app.email))fail('Choose an active tenant account with the application email.');
  if(propertyId&&!db.prepare('SELECT id FROM properties WHERE id=? AND archived=0 AND is_preview=0').get(propertyId))fail('Choose a verified, active property.');
  const startsOn=data.startsOn?date(data.startsOn,'lease start date'):'',endsOn=data.endsOn?date(data.endsOn,'lease end date'):'';if(startsOn&&endsOn&&endsOn<startsOn)fail('The lease end must be on or after its start.');
  const monthlyRent=data.monthlyRent==null?null:money(data.monthlyRent,'monthly rent')/100,deposit=data.deposit==null?null:money(data.deposit,'deposit',true)/100;
  if(!Number.isInteger(data.paymentDay)||data.paymentDay<1||data.paymentDay>28)fail('Choose a rent due day from 1 to 28.');
  const tenancyType=data.tenancyType||'fixed';if(!['fixed','yearly'].includes(tenancyType))fail('Choose fixed term or year-to-year tenancy.');const state=jurisdiction(data.stateCode||'CA');if(data.termsStateCode!==undefined)jurisdiction(data.termsStateCode);const details={tenancyType,stateCode:state.code,stateName:state.name,termsStateCode:data.termsStateCode||state.code,stateSpecificTerms:optional(data.stateSpecificTerms,'state-specific terms and disclosures',10000),stateReviewConfirmed:data.stateReviewConfirmed===true};for(const [key,max] of Object.entries({agreementDate:10,tenantPhone:60,managerPhone:60,noticeContactName:150,tenancyTerms:1500,parkingTerms:600,forwardingAddress:250}))details[key]=optional(data[key],key,max);if(details.agreementDate)date(details.agreementDate,'agreement date');
  return {...details,tenantId,propertyId,tenantName:text(data.tenantName,'the resident name',100),tenantEmail:app.email,propertyAddress:optional(data.propertyAddress,'the property address',250),managerName:optional(data.managerName,'the landlord or manager name',150),startsOn,endsOn,monthlyRent,deposit,paymentDay:data.paymentDay,paymentInstructions:optional(data.paymentInstructions,'payment instructions',3000),additionalTerms:optional(data.additionalTerms,'additional lease terms',6000),title:text(data.title,'a lease title',150),terms:templateBody(data.terms),templateRevision:Number.isSafeInteger(data.templateRevision)?data.templateRevision:1};
 }
 function ready(row,{applicant=false,tenantId}={}){
  const app=application(row.application_id),v=values({values:{...JSON.parse(row.data),...(tenantId?{tenantId}: {})}},app);if(app.status!=='Approved')fail('The application is no longer Approved. Reopen its review before sending a lease.',409);
  if(!applicant&&!v.tenantId)fail('Choose the applicant’s tenant account before sending.');if(!v.propertyId)fail('Add or match a verified property before sending.');
  if(!v.startsOn||!v.endsOn||v.monthlyRent==null||v.deposit==null)fail('Confirm the lease dates, rent and deposit before sending.');
  const p=db.prepare('SELECT address FROM properties WHERE id=?').get(v.propertyId);if(!p||v.propertyAddress.trim()!==p.address.trim())fail('Use the selected property’s current street address. Refresh the property selection.');
  if(row.source==='template'&&!v.managerName)fail('Enter the landlord or authorized manager’s name.');
  if(row.source==='template'&&v.termsStateCode!==v.stateCode)fail('Load or confirm agreement wording for the selected state before sending.');
  if(v.stateCode!=='CA'&&(!v.stateReviewConfirmed||row.source==='template'&&!v.stateSpecificTerms))fail('Review the selected state’s requirements and complete its state/local terms and disclosures before sending.');
  if(row.source==='template'){for(const key of tokens.filter(key=>!['additionalTerms','tenantEmail','startsOn','endsOn','monthlyRent','deposit','paymentDay'].includes(key)))if(v.terms.includes('{{'+key+'}}')&&!String(v[key]??'').trim())fail('Complete '+key.replace(/([A-Z])/g,' $1').toLowerCase()+' before sending the generated agreement.');}
  if(row.source==='upload'&&!row.has_upload)fail('Upload a readable lease PDF before sending.');
  if(db.prepare("SELECT id FROM leases WHERE status='Active' AND (tenant_id=? OR property_id=?)").get(v.tenantId,v.propertyId))fail('The tenant or property already has an active lease. Manage that existing lease instead.',409);
  return v;
 }
 async function generated(row,draft){
  const v=JSON.parse(row.data),formatted={...v,monthlyRent:v.monthlyRent==null?'[Needs review]':'$'+v.monthlyRent.toFixed(2),deposit:v.deposit==null?'[Needs review]':'$'+v.deposit.toFixed(2)};
  const rendered=v.terms.replace(/\{\{([^}]+)\}\}/g,(_,key)=>key==='additionalTerms'?String(formatted[key]||''):String(formatted[key]??'').trim()||'[Needs review]');
  return pdf((draft?'DRAFT - ':'')+v.title,[...(draft?['DRAFT: staff review is required before this agreement is sent.']:[]),'AGREEMENT DETAILS','Landlord / authorized manager: '+(v.managerName||'[Needs review]'),'Resident: '+v.tenantName+' ('+v.tenantEmail+')','Premises: '+(v.propertyAddress||'[Needs review]'),v.tenancyType==='yearly'?'Year-to-year tenancy beginning '+(v.startsOn||'[Needs review]')+'; next renewal review '+(v.endsOn||'[Needs review]')+' (tracking only, not a termination date)':'Term: '+(v.startsOn||'[Needs review]')+' through '+(v.endsOn||'[Needs review]'),'Monthly rent: '+formatted.monthlyRent+'; due day: '+v.paymentDay,'Security deposit: '+formatted.deposit,'AGREEMENT WORDING',...rendered.split('\n')]);
 }
 const api={
  ensure(value,user){if(user)authorize(user);const app=application(value);if(app.status!=='Approved')fail('Approve the application before preparing a lease.',409);const existing=db.prepare('SELECT application_id FROM lease_preparations WHERE application_id=?').get(app.id);if(existing)return dto(read(app.id));
   const company=settings.get(),p=app.property_id?db.prepare('SELECT id,address,price FROM properties WHERE id=? AND archived=0 AND is_preview=0').get(app.property_id):null;
   const stateCode=inferState(p?.address||app.requested_address),t=template(stateCode);
   const tenant=db.prepare("SELECT id FROM users WHERE role='tenant' AND active=1 AND email=? COLLATE NOCASE AND (email_verified_at IS NOT NULL OR identity_confirmed_at IS NOT NULL OR id IN (SELECT user_id FROM application_claims WHERE application_id=?))").get(app.email,app.id),details=JSON.parse(app.details),now=stamp();
   const draft={stateCode,stateName:jurisdiction(stateCode).name,termsStateCode:stateCode,stateSpecificTerms:'',stateReviewConfirmed:false,tenancyType:'fixed',agreementDate:'',tenantPhone:app.phone||'',managerPhone:company.contactPhone||'',noticeContactName:company.companyName||'',tenancyTerms:'',parkingTerms:'',forwardingAddress:'As advised in writing by the Tenant',tenantId:tenant?.id||null,propertyId:p?.id||null,tenantName:app.name,tenantEmail:app.email,propertyAddress:p?.address||app.requested_address,managerName:company.companyName,startsOn:app.move_in,endsOn:suggestedEnd(app.move_in,details.leaseDuration),monthlyRent:p?.price??null,deposit:null,paymentDay:1,paymentInstructions:company.paymentInstructions||'',additionalTerms:'',title:t.title,terms:t.body,templateRevision:t.revision};
   db.prepare('INSERT OR IGNORE INTO lease_preparations(application_id,data,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(app.id,JSON.stringify(draft),user?.id||app.updated_by||null,user?.id||app.updated_by||null,now,now);return dto(read(app.id));
  },
  list(user){authorize(user);return db.prepare('SELECT '+columns+' FROM lease_preparations p JOIN applications a ON a.id=p.application_id LEFT JOIN leases l ON l.id=p.lease_id LEFT JOIN signature_requests s ON s.id=(SELECT id FROM signature_requests WHERE document_id=p.document_id ORDER BY id DESC LIMIT 1) ORDER BY p.updated_at DESC,p.application_id DESC').all().map(row=>dto(row,false));},
  detail(user,value){authorize(user);const row=read(value),app=application(value);return {preparation:dto(row),invitationHistory:offers?.history(value)||[],emailAvailable:offers?.emailAvailable(value)||false,emailDelivery:offers?.emailDelivery(value),jurisdictions,sourceTemplate:sourceTemplate(JSON.parse(row.data).stateCode||'CA'),template:template(JSON.parse(row.data).stateCode||'CA'),tokens,residents:db.prepare("SELECT id,name,email,CASE WHEN email_verified_at IS NOT NULL OR identity_confirmed_at IS NOT NULL THEN 1 ELSE 0 END AS identityReady FROM users WHERE role='tenant' AND active=1 AND email=? COLLATE NOCASE").all(app.email),properties:db.prepare("SELECT p.id,p.name,p.address,p.price,(SELECT id FROM leases l WHERE l.property_id=p.id AND l.status='Active') AS activeLeaseId FROM properties p WHERE archived=0 AND is_preview=0 ORDER BY name").all()};},
  template(user,state='CA'){authorize(user);return {...template(state),tokens,jurisdictions,sourceTemplate:sourceTemplate(state)};},
  saveTemplate(user,input){authorize(user);const state=jurisdiction(input.stateCode||'CA'),current=template(state.code);revision(current,input);const title=text(input.title,'a template title',150),body=templateBody(input.body);const next=db.prepare('SELECT MAX(revision)+1 AS n FROM lease_template_versions').get().n;db.prepare('INSERT INTO lease_template_versions(revision,title,body,updated_by,updated_at,state_code) VALUES(?,?,?,?,?,?)').run(next,title,body,user.id,stamp(),state.code);return api.template(user,state.code);},
  save(user,value,input){const row=editable(user,value,input);if(!['template','upload'].includes(input.source))fail('Choose the template or PDF upload option.');const v=values(input,application(value));db.prepare('UPDATE lease_preparations SET data=?,source=?,revision=revision+1,updated_by=?,updated_at=? WHERE application_id=?').run(JSON.stringify(v),input.source,user.id,stamp(),row.application_id);return dto(read(value));},
  async upload(user,value,input){editable(user,value,input);const name=text(input.name,'a PDF name',120);if(typeof input.data!=='string'||input.data.length>7000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Choose a PDF up to 5 MB.');const bytes=Buffer.from(input.data,'base64');if(bytes.length<8||bytes.length>5242880||bytes.subarray(0,5).toString()!=='%PDF-')fail('Choose a PDF up to 5 MB.');try{const parsed=await PDFDocument.load(bytes);if(!parsed.getPageCount())throw Error();}catch{fail('Upload a readable, unencrypted PDF.');}editable(user,value,input);db.prepare("UPDATE lease_preparations SET upload_name=?,upload_data=?,source='upload',revision=revision+1,updated_by=?,updated_at=? WHERE application_id=?").run(name,bytes,user.id,stamp(),id(value));return dto(read(value));},
  async preview(user,value){authorize(user);const row=read(value);if(row.document_id)return operations.document(user,row.document_id).data;if(row.source==='upload'){const data=db.prepare('SELECT upload_data FROM lease_preparations WHERE application_id=?').get(id(value)).upload_data;if(!data)fail('Upload a PDF first.');return data;}return generated(row,true);},
  async send(user,value,input){
   authorize(user);let row=read(value);if(row.lease_id)return dto(row);revision(row,input);if(input.confirm!==true)fail('Confirm that you reviewed the agreement, recipient and lease details.');
   const existing=offers?.latest(value),applicant=input.delivery==='applicant';
   if(applicant&&offers.locked(existing))return {...dto(row),invitation:offers.dto(existing),trackingUrl:null};
   if(!applicant&&offers?.locked(existing)&&existing.status!=='Signed')fail('Wait for the applicant response or withdraw the invitation before assigning an account.',409);
   const attach=!applicant&&existing?.status==='Signed'&&!existing.lease_id;
   ready(row,{applicant,tenantId:input.tenantId});
   const bytes=attach?offers.latest(value,true).original_data:row.source==='upload'?db.prepare('SELECT upload_data FROM lease_preparations WHERE application_id=?').get(id(value)).upload_data:await generated(row,false);
   return transaction(db,()=>{
    authorize(user);row=read(value);if(row.lease_id)return dto(row);revision(row,input);const v=ready(row,{applicant,tenantId:input.tenantId});
    if(applicant)return {...dto(row),...offers.create(user,application(value),row,bytes,{email:input.email===true,consent:input.emailConsent===true})};
    const current=offers?.latest(value);if(attach&&(!current||current.id!==existing.id||current.status!=='Signed'||current.lease_id))fail('The applicant agreement changed. Reopen it.',409);
    const lease=operations.addLease(user,{tenantId:v.tenantId,propertyId:v.propertyId,startsOn:v.startsOn,endsOn:v.endsOn,monthlyRent:v.monthlyRent,deposit:v.deposit,tenancyType:v.tenancyType,notes:'Prepared from application '+row.reference+'.'},true,attach?current.id:null);
    const document=operations.addDocument(user,lease.id,{name:attach?current.document_name:row.source==='upload'?row.upload_name:'lease-agreement-'+row.application_id+'.pdf',data:Buffer.from(bytes).toString('base64')});
    const request=attach?offers.attach(user,row,lease,document,signatures):signatures.requestValidated(user,{documentId:document.id,title:v.title});
    db.prepare('UPDATE lease_preparations SET data=?,lease_id=?,document_id=?,signature_request_id=?,upload_data=NULL,revision=revision+1,updated_by=?,updated_at=? WHERE application_id=?').run(JSON.stringify(v),lease.id,document.id,request.id,user.id,stamp(),row.application_id);return dto(read(value));
   });
  }

 };
 // Existing approvals get a private preparation draft, never an active lease or signing request.
 transaction(db,()=>{for(const row of db.prepare("SELECT a.id FROM applications a WHERE status='Approved' AND NOT EXISTS(SELECT 1 FROM lease_preparations p WHERE p.application_id=a.id)").all())api.ensure(row.id);});
 return api;
}
module.exports={createLeasePreparation,suggestedEnd};
