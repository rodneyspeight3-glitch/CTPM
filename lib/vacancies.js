const {createHash}=require('node:crypto');
const {fail,text,number,listingDTO}=require('./management');
const {validateRentalDetails,validateApplicationDocuments}=require('./rental-application');
function createVacancies(db){
 db.exec(`CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES properties(id),
  name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, phone TEXT NOT NULL,
  move_in TEXT NOT NULL, occupants INTEGER NOT NULL, message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted', staff_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by INTEGER REFERENCES users(id),
  UNIQUE(property_id,email)
 );
 CREATE TABLE IF NOT EXISTS application_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);`);
 for(const [name,definition] of [['details',"TEXT NOT NULL DEFAULT '{}'"],['form_version','INTEGER NOT NULL DEFAULT 1']])if(!db.prepare('PRAGMA table_info(applications)').all().some(c=>c.name===name))db.exec('ALTER TABLE applications ADD COLUMN '+name+' '+definition);
 db.exec(`CREATE TABLE IF NOT EXISTS application_documents(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),kind TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS application_events(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),status TEXT NOT NULL,note TEXT NOT NULL,updated_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS application_events_application ON application_events(application_id);
 CREATE INDEX IF NOT EXISTS application_documents_application ON application_documents(application_id);
 CREATE TABLE IF NOT EXISTS application_document_events(id INTEGER PRIMARY KEY,application_id INTEGER NOT NULL REFERENCES applications(id),kind TEXT NOT NULL,reason TEXT NOT NULL,removed_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);`);
 const staff=user=>{if(!['agent','admin'].includes(user.role))fail('Agent or administrator access is required.',403);};
 const list=()=>db.prepare(`SELECT a.id,a.property_id,a.name,a.email,a.phone,a.move_in,a.occupants,a.message,a.status,a.staff_note,a.created_at,a.updated_at,a.form_version,p.name AS property_name,p.available AS property_available,(SELECT COUNT(*) FROM application_documents WHERE application_id=a.id) AS document_count
  FROM applications a JOIN properties p ON p.id=a.property_id ORDER BY a.id DESC`).all();
 return {
  listVacancies:()=>db.prepare('SELECT id,name,area,address,price,beds,baths,size,type,image,description,amenities FROM properties WHERE available=1 AND archived=0 AND is_preview=0 ORDER BY id DESC').all().map(p=>({...listingDTO(p),photoUpdated:db.prepare('SELECT updated_at FROM property_photos WHERE property_id=?').get(p.id)?.updated_at||null})),
  beginApplication(idValue,connection){
   const id=number(Number(idValue),'property',1,Number.MAX_SAFE_INTEGER,true);
   if(!db.prepare('SELECT id FROM properties WHERE id=? AND available=1 AND archived=0 AND is_preview=0').get(id))fail('This property is no longer available.',409);
   const now=Date.now();db.prepare('DELETE FROM application_attempts WHERE expires_at<=?').run(now);
   const key=createHash('sha256').update('applications:'+connection).digest('hex');
   if((db.prepare('SELECT count FROM application_attempts WHERE key=?').get(key)?.count||0)>=200)fail('Too many applications. Please try again in an hour.',429);
   db.prepare('INSERT INTO application_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+3600000);
  },
  apply(idValue,data){
   const id=number(Number(idValue),'property',1,Number.MAX_SAFE_INTEGER,true);
   if(!db.prepare('SELECT id FROM properties WHERE id=? AND available=1 AND archived=0 AND is_preview=0').get(id))fail('This property is no longer available.',409);
   const name=text(data.name,'your name',100),email=text(data.email,'an email address',254).toLowerCase(),phone=text(data.phone,'a phone number',40);
   if(!/^\S+@\S+\.\S+$/.test(email)||!/^\+?[\d () .-]{7,40}$/.test(phone)||phone.replace(/\D/g,'').length<7)fail('Enter a valid email and phone number.');
   const moveIn=text(data.moveIn,'a move-in date',10);
   const date=new Date(moveIn+'T00:00:00Z');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(moveIn)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==moveIn||moveIn<new Date().toISOString().slice(0,10))fail('Choose a move-in date of today or later.');
   const occupants=number(data.occupants,'household size',1,50,true);
   const message=text(data.message,'your message for management',2000);
   if(data.consent!==true)fail('Confirm that management may contact you about this application.');
   const details=validateRentalDetails(data),documents=validateApplicationDocuments(data.documents),stamp=new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');try{
    const result=db.prepare('INSERT INTO applications(property_id,name,email,phone,move_in,occupants,message,created_at,updated_at,details,form_version) VALUES(?,?,?,?,?,?,?,?,?,?,3) ON CONFLICT(property_id,email) DO NOTHING').run(id,name,email,phone,moveIn,occupants,message,stamp,stamp,JSON.stringify(details));
    if(result.changes){const applicationId=Number(result.lastInsertRowid);db.prepare('INSERT INTO application_events(application_id,status,note,updated_by,created_at) VALUES(?,?,?,NULL,?)').run(applicationId,'Submitted','Application received.',stamp);for(const doc of documents)db.prepare('INSERT INTO application_documents(application_id,kind,name,mime,data,created_at) VALUES(?,?,?,?,?,?)').run(applicationId,doc.kind,doc.name,doc.mime,doc.data,stamp);}
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   // Repeated submissions return the same acknowledgement without exposing applicant data.
   return {message:'Application received. Management will review it. No account or lease has been created, and no confirmation email is sent.'};
  },
  listApplications(user){staff(user);return list();},
  application(user,idValue){
   staff(user);const id=number(Number(idValue),'application',1,Number.MAX_SAFE_INTEGER,true),row=db.prepare('SELECT a.*,p.name AS property_name FROM applications a JOIN properties p ON p.id=a.property_id WHERE a.id=?').get(id);if(!row)fail('Application not found.',404);
   return {...row,details:JSON.parse(row.details),reviewEvents:db.prepare('SELECT e.status,e.note,e.created_at,u.name AS staff_name FROM application_events e LEFT JOIN users u ON u.id=e.updated_by WHERE e.application_id=? ORDER BY e.id DESC').all(id),documents:db.prepare('SELECT id,kind,name,mime,length(data) AS size,created_at FROM application_documents WHERE application_id=? ORDER BY id').all(id),documentEvents:db.prepare('SELECT kind,reason,created_at FROM application_document_events WHERE application_id=? ORDER BY id DESC').all(id)};
  },
  document(user,idValue){staff(user);const row=db.prepare('SELECT * FROM application_documents WHERE id=?').get(number(Number(idValue),'document',1,Number.MAX_SAFE_INTEGER,true));if(!row)fail('Document not found.',404);return row;},
  removeDocument(user,idValue,input){
   const doc=this.document(user,idValue),reason=text(input.reason,'a document-removal reason',300),now=new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO application_document_events(application_id,kind,reason,removed_by,created_at) VALUES(?,?,?,?,?)').run(doc.application_id,doc.kind,reason,user.id,now);db.prepare('DELETE FROM application_documents WHERE id=?').run(doc.id);db.exec('COMMIT');return {ok:true};}catch(error){db.exec('ROLLBACK');throw error;}
  },
  updateApplication(user,idValue,data){
   staff(user);const id=number(Number(idValue),'application',1,Number.MAX_SAFE_INTEGER,true);
   if(!['Submitted','Reviewing','Contacted','Closed'].includes(data.status))fail('Choose a valid application status.');
   if(typeof data.note!=='string'||data.note.length>2000)fail('Use a staff note of up to 2000 characters.');
   const previous=db.prepare('SELECT status,staff_note,updated_at FROM applications WHERE id=?').get(id);
   if(!previous)fail('Application not found.',404);
   if(data.expectedUpdatedAt!==undefined&&data.expectedUpdatedAt!==previous.updated_at)fail('This application was updated by another staff member. Reopen it to review the latest version.',409);
   const note=data.note.trim();
   if(previous.status!==data.status||previous.staff_note!==note){
    const stamp=new Date(Math.max(Date.now(),Date.parse(previous.updated_at)+1)).toISOString();
    db.exec('BEGIN IMMEDIATE');try{
     db.prepare('UPDATE applications SET status=?,staff_note=?,updated_at=?,updated_by=? WHERE id=?').run(data.status,note,stamp,user.id,id);
     db.prepare('INSERT INTO application_events(application_id,status,note,updated_by,created_at) VALUES(?,?,?,?,?)').run(id,data.status,note,user.id,stamp);
     db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
   }
   return list().find(a=>a.id===id);
  }
 };
}
module.exports={createVacancies};
