const {staff,fail,id,migrate}=require('./service-utils');
const labels={'notification':'Portal update','verification':'Account verification','recovery':'Password recovery','applicant-lease':'Lease invitation','application-receipt':'Application receipt','application-progress':'Application progress','application-document':'Document request','lease-signing-reminder':'Lease reminder','lease-thanksgiving':'Holiday greeting','smtp-test':'Test email','transactional':'Automated email'};
labels['staff-message']='Team email';
const previewKinds=new Set(['notification','applicant-lease','application-receipt','application-progress','application-document','lease-signing-reminder','lease-thanksgiving','smtp-test','staff-message']);
const errors={AUTHENTICATION_FAILED:'The mailbox login was not accepted.',TLS_FAILED:'The secure email connection failed.',SMTP_HOST_BLOCKED:'The email server could not be used.',CONNECTION_FAILED:'The email server could not be reached.',DELIVERY_REJECTED:'The email provider rejected this message.',DELIVERY_FAILED:'The email provider did not accept the message.'};
function emailPreview(kind,body){
 if(!previewKinds.has(kind))return '';
 return String(body||'').replace(/https?:\/\/[^\s<>"']+/gi,'[Link omitted]').replace(/\b[a-f0-9]{32,}\b/gi,'[Private reference omitted]').slice(0,10000);
}
function createEmailHistory(db){
 migrate(db,'email_outbox','history_preview',"TEXT NOT NULL DEFAULT ''");
 db.exec('CREATE INDEX IF NOT EXISTS email_outbox_created_at ON email_outbox(created_at,id)');
 for(const row of db.prepare("SELECT id,kind,body FROM email_outbox WHERE history_preview='' AND body<>'' AND kind IN ("+[...previewKinds].map(()=>'?').join(',')+')').all(...previewKinds))db.prepare('UPDATE email_outbox SET history_preview=? WHERE id=?').run(emailPreview(row.kind,row.body),row.id);
 function authorize(user){staff(user);if(!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(user.id))fail('Staff access changed. Sign in again.',403);}
 const iso=value=>value===null||value===undefined?null:new Date(value).toISOString();
 const statusSql="CASE WHEN status='Pending' AND expires_at IS NOT NULL AND expires_at<=? THEN 'Expired' ELSE status END";
 const historySql='WITH history AS (SELECT id,recipient,subject,kind,status,attempts,available_at,created_at,sent_at,expires_at,last_error,history_preview,'+statusSql+' AS delivery_status FROM email_outbox) ';
 function dto(r,detail=false){
  const result={id:r.id,recipient:r.recipient,subject:r.subject,kind:r.kind,category:labels[r.kind]||'Automated email',status:r.delivery_status,createdAt:r.created_at,sentAt:r.sent_at,error:r.last_error?(errors[r.last_error]?r.last_error:'DELIVERY_FAILED'):'',errorMessage:r.last_error?(errors[r.last_error]||errors.DELIVERY_FAILED):''};
  if(detail)Object.assign(result,{attempts:r.attempts,availableAt:iso(r.available_at),expiresAt:iso(r.expires_at),preview:emailPreview(r.kind,r.history_preview),previewStatus:['verification','recovery'].includes(r.kind)?'restricted':r.history_preview&&previewKinds.has(r.kind)?'available':'unavailable'});
  return result;
 }
 function integer(value,fallback,min,max,label){if(value===undefined||value==='')return fallback;if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)fail('Choose a valid '+label+'.');return Number(value);}
 function list(user,input={}){
  authorize(user);const q=input.q===undefined?'':input.q;if(typeof q!=='string'||q.length>160)fail('Search with up to 160 characters.');
  const status=input.status||'',kind=input.kind||'',limit=integer(input.limit,25,1,100,'page size');let page=integer(input.page,1,1,1000000,'page');
  if(status&&!['Sent','Pending','Failed','Cancelled','Expired'].includes(status))fail('Choose a valid email status.');if(kind&&(typeof kind!=='string'||kind.length>80))fail('Choose a valid email category.');
  const clauses=[],params=[Date.now()],term=q.trim().replace(/[\\%_]/g,'\\$&');
  if(term){clauses.push("(recipient LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\')");params.push('%'+term+'%','%'+term+'%');}
  if(kind){clauses.push('kind=?');params.push(kind);}
  for(const [key,operator] of [['since','>='],['until','<']])if(input[key]){const value=input[key];if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail('Choose a valid email date range.');clauses.push('created_at'+operator+'?');params.push(value);}
  if(input.since&&input.until&&input.since>=input.until)fail('Choose an end date on or after the start date.');
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'',counts={Sent:0,Pending:0,Failed:0,Cancelled:0,Expired:0};
  for(const row of db.prepare(historySql+'SELECT delivery_status,COUNT(*) AS n FROM history'+where+' GROUP BY delivery_status').all(...params))if(Object.hasOwn(counts,row.delivery_status))counts[row.delivery_status]=row.n;
  const total=status?counts[status]:Object.values(counts).reduce((a,b)=>a+b,0),pages=Math.max(1,Math.ceil(total/limit));page=Math.min(page,pages);
  const filtered=where+(status?(where?' AND ':' WHERE ')+'delivery_status=?':'');
  const messages=db.prepare(historySql+'SELECT * FROM history'+filtered+' ORDER BY id DESC LIMIT ? OFFSET ?').all(...params,...(status?[status]:[]),limit,(page-1)*limit).map(r=>dto(r));
  return {messages,total,page,pages,limit,counts,categories:db.prepare('SELECT DISTINCT kind FROM email_outbox ORDER BY kind').all().map(r=>({kind:r.kind,label:labels[r.kind]||'Automated email'})),retentionDays:90};
 }
 function detail(user,value){authorize(user);const row=db.prepare(historySql+'SELECT * FROM history WHERE id=?').get(Date.now(),id(value));if(!row)fail('Email record not found.',404);return {message:dto(row,true)};}
 return {list,detail};
}
module.exports={createEmailHistory,emailPreview};
