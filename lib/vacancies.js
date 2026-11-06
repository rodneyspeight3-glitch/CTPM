const {createHash}=require('node:crypto');
const {fail,text,number,listingDTO}=require('./management');
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
 const staff=user=>{if(!['agent','admin'].includes(user.role))fail('Agent or administrator access is required.',403);};
 const list=()=>db.prepare(`SELECT a.*,p.name AS property_name,p.available AS property_available
  FROM applications a JOIN properties p ON p.id=a.property_id ORDER BY a.id DESC`).all();
 return {
  listVacancies:()=>db.prepare('SELECT id,name,area,address,price,beds,baths,size,type,image,description,amenities FROM properties WHERE available=1 AND archived=0 AND is_preview=0 ORDER BY id DESC').all().map(p=>({...listingDTO(p),photoUpdated:db.prepare('SELECT updated_at FROM property_photos WHERE property_id=?').get(p.id)?.updated_at||null})),
  apply(idValue,data,connection){
   const id=number(Number(idValue),'property',1,Number.MAX_SAFE_INTEGER,true);
   if(!db.prepare('SELECT id FROM properties WHERE id=? AND available=1 AND archived=0 AND is_preview=0').get(id))fail('This property is no longer available.',409);
   const name=text(data.name,'your name',100),email=text(data.email,'an email address',254).toLowerCase(),phone=text(data.phone,'a phone number',40);
   if(!/^\S+@\S+\.\S+$/.test(email)||!/^\+?[\d () .-]{7,40}$/.test(phone)||phone.replace(/\D/g,'').length<7)fail('Enter a valid email and phone number.');
   const moveIn=text(data.moveIn,'a move-in date',10);
   const date=new Date(moveIn+'T00:00:00Z');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(moveIn)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==moveIn||moveIn<new Date().toISOString().slice(0,10))fail('Choose a move-in date of today or later.');
   const occupants=number(data.occupants,'household size',1,50,true);
   if(typeof data.message!=='string'||data.message.length>2000)fail('Use a message of up to 2000 characters.');
   if(data.consent!==true)fail('Confirm that management may contact you about this application.');
   const now=Date.now();
   db.prepare('DELETE FROM application_attempts WHERE expires_at<=?').run(now);
   // Use the socket identity rather than trusting client-supplied forwarding headers.
   const key=createHash('sha256').update('applications:'+connection).digest('hex');
   if((db.prepare('SELECT count FROM application_attempts WHERE key=?').get(key)?.count||0)>=200)fail('Too many applications. Please try again in an hour.',429);
   db.prepare('INSERT INTO application_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+3600000);
   const stamp=new Date(now).toISOString();
   db.prepare('INSERT INTO applications(property_id,name,email,phone,move_in,occupants,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(property_id,email) DO NOTHING').run(id,name,email,phone,moveIn,occupants,data.message.trim(),stamp,stamp);
   // Repeated submissions return the same acknowledgement without exposing applicant data.
   return {message:'Application received. Management will review it. No account or lease has been created, and no confirmation email is sent.'};
  },
  listApplications(user){staff(user);return list();},
  updateApplication(user,idValue,data){
   staff(user);const id=number(Number(idValue),'application',1,Number.MAX_SAFE_INTEGER,true);
   if(!['Submitted','Reviewing','Contacted','Closed'].includes(data.status))fail('Choose a valid application status.');
   if(typeof data.note!=='string'||data.note.length>2000)fail('Use a staff note of up to 2000 characters.');
   const result=db.prepare('UPDATE applications SET status=?,staff_note=?,updated_at=?,updated_by=? WHERE id=?').run(data.status,data.note.trim(),new Date().toISOString(),user.id,id);
   if(!result.changes)fail('Application not found.',404);
   return list().find(a=>a.id===id);
  }
 };
}
module.exports={createVacancies};
