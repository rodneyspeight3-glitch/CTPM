const {fail,text,number}=require('./management');
function money(value,label,allowZero=false){
 number(value,label,allowZero?0:0.01,1000000);
 const cents=Math.round(value*100);if(Math.abs(value*100-cents)>0.00001)fail(`Use at most two decimal places for ${label}.`);return cents;
}
function date(value,label){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(`Enter a valid ${label}.`);
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)fail(`Enter a valid ${label}.`);return value;
}
function id(value){return number(Number(value),'record ID',1,Number.MAX_SAFE_INTEGER,true);}
function optional(value,label,max){if(typeof value!=='string'||value.trim().length>max)fail(`Use ${label} of up to ${max} characters.`);return value.trim();}
function createOperations(db){
 db.exec(`CREATE TABLE IF NOT EXISTS leases(
  id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES users(id),property_id INTEGER NOT NULL REFERENCES properties(id),
  starts_on TEXT NOT NULL,ends_on TEXT NOT NULL,monthly_rent_cents INTEGER NOT NULL,deposit_cents INTEGER NOT NULL,
  notes TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Active',created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
 );
 CREATE UNIQUE INDEX IF NOT EXISTS active_lease_property ON leases(property_id) WHERE status='Active';
 CREATE UNIQUE INDEX IF NOT EXISTS active_lease_tenant ON leases(tenant_id) WHERE status='Active';
 CREATE TABLE IF NOT EXISTS rent_charges(
  id INTEGER PRIMARY KEY,lease_id INTEGER NOT NULL REFERENCES leases(id),period TEXT NOT NULL,due_on TEXT NOT NULL,amount_cents INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,UNIQUE(lease_id,period)
 );
 CREATE TABLE IF NOT EXISTS rent_payments(
  id INTEGER PRIMARY KEY,charge_id INTEGER NOT NULL REFERENCES rent_charges(id),amount_cents INTEGER NOT NULL,paid_on TEXT NOT NULL,
  method TEXT NOT NULL,reference TEXT NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,
  void_reason TEXT NOT NULL DEFAULT '',voided_by INTEGER REFERENCES users(id),voided_at TEXT
 );
 CREATE TABLE IF NOT EXISTS conversations(
  id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES users(id),subject TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Open',
  created_at TEXT NOT NULL,updated_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY,conversation_id INTEGER NOT NULL REFERENCES conversations(id),author_id INTEGER NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS lease_documents(
  id INTEGER PRIMARY KEY,lease_id INTEGER NOT NULL REFERENCES leases(id),name TEXT NOT NULL,data BLOB NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL
 );`);
 const staff=user=>{if(!['admin','agent'].includes(user.role))fail('Agent or administrator access is required.',403);};
 const getLease=recordId=>db.prepare(`SELECT l.*,p.name AS property_name,p.address,u.name AS tenant_name,u.email AS tenant_email FROM leases l JOIN properties p ON p.id=l.property_id JOIN users u ON u.id=l.tenant_id WHERE l.id=?`).get(recordId);
 const charge=recordId=>db.prepare(`SELECT c.*,l.tenant_id,p.name AS property_name,u.name AS tenant_name,
  COALESCE((SELECT SUM(amount_cents) FROM rent_payments WHERE charge_id=c.id AND voided_at IS NULL),0) AS paid_cents
  FROM rent_charges c JOIN leases l ON l.id=c.lease_id JOIN properties p ON p.id=l.property_id JOIN users u ON u.id=l.tenant_id WHERE c.id=?`).get(recordId);
 const conversation=(user,value)=>{const row=db.prepare('SELECT * FROM conversations WHERE id=?').get(id(value));if(!row||(user.role==='tenant'&&row.tenant_id!==user.id))fail('Conversation not found.',404);return row;};
 return {
  residents(user){staff(user);return db.prepare("SELECT id,name,email FROM users WHERE role='tenant' AND active=1 ORDER BY name").all();},
  leases(user){return db.prepare(`SELECT l.*,p.name AS property_name,p.address,u.name AS tenant_name,u.email AS tenant_email FROM leases l JOIN properties p ON p.id=l.property_id JOIN users u ON u.id=l.tenant_id ${user.role==='tenant'?'WHERE l.tenant_id=?':''} ORDER BY l.id DESC`).all(...(user.role==='tenant'?[user.id]:[])).map(l=>({...l,documents:db.prepare('SELECT id,name,created_at FROM lease_documents WHERE lease_id=? ORDER BY id DESC').all(l.id)}));},
  addDocument(user,value,input){
   staff(user);const record=getLease(id(value));if(!record)fail('Lease not found.',404);
   const name=text(input.name,'a document name',120);
   if(typeof input.data!=='string'||!input.data||input.data.length>7000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Upload a PDF document up to 5 MB.');
   const bytes=Buffer.from(input.data,'base64');if(bytes.length>5242880||bytes.length<8||bytes.subarray(0,5).toString()!=='%PDF-')fail('Upload a valid PDF document up to 5 MB.');
   const result=db.prepare('INSERT INTO lease_documents(lease_id,name,data,created_by,created_at) VALUES(?,?,?,?,?)').run(record.id,name,bytes,user.id,new Date().toISOString());return {id:Number(result.lastInsertRowid)};
  },
  document(user,value){const row=db.prepare('SELECT d.*,l.tenant_id FROM lease_documents d JOIN leases l ON l.id=d.lease_id WHERE d.id=?').get(id(value));if(!row||(user.role==='tenant'&&row.tenant_id!==user.id))fail('Document not found.',404);return row;},
  addLease(user,input){
   staff(user);const tenant=id(input.tenantId),property=id(input.propertyId),starts=date(input.startsOn,'start date'),ends=date(input.endsOn,'end date');
   if(ends<starts)fail('The end date must be on or after the start date.');
   const rent=money(input.monthlyRent,'monthly rent'),deposit=money(input.deposit,'deposit',true),notes=optional(input.notes,'lease notes',3000);
   if(!db.prepare("SELECT id FROM users WHERE id=? AND role='tenant' AND active=1").get(tenant))fail('Choose an active tenant account.');
   if(!db.prepare('SELECT id FROM properties WHERE id=? AND archived=0 AND is_preview=0').get(property))fail('Choose an active property.');
   if(db.prepare("SELECT id FROM leases WHERE status='Active' AND (tenant_id=? OR property_id=?)").get(tenant,property))fail('The tenant or property already has an active lease.',409);
   db.exec('BEGIN IMMEDIATE');
   try{
    const result=db.prepare('INSERT INTO leases(tenant_id,property_id,starts_on,ends_on,monthly_rent_cents,deposit_cents,notes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(tenant,property,starts,ends,rent,deposit,notes,user.id,new Date().toISOString());
    db.prepare('UPDATE properties SET available=0 WHERE id=?').run(property);db.exec('COMMIT');return getLease(Number(result.lastInsertRowid));
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  endLease(user,value){staff(user);const record=getLease(id(value));if(!record)fail('Lease not found.',404);if(record.status!=='Active')fail('This lease has already ended.',409);db.prepare("UPDATE leases SET status='Ended' WHERE id=?").run(record.id);return getLease(record.id);},
  ledger(user){
   const ids=db.prepare(`SELECT c.id FROM rent_charges c JOIN leases l ON l.id=c.lease_id ${user.role==='tenant'?'WHERE l.tenant_id=?':''} ORDER BY c.due_on DESC,c.id DESC`).all(...(user.role==='tenant'?[user.id]:[]));
   return ids.map(({id:recordId})=>{const row=charge(recordId);return {...row,payments:db.prepare('SELECT id,amount_cents,paid_on,method,reference,created_at,void_reason,voided_at FROM rent_payments WHERE charge_id=? ORDER BY id DESC').all(recordId)};});
  },
  addCharge(user,input){
   staff(user);const lease=getLease(id(input.leaseId));if(!lease||lease.status!=='Active')fail('Choose an active lease.');
   if(typeof input.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period))fail('Choose a valid rent month.');
   if(input.period<lease.starts_on.slice(0,7)||input.period>lease.ends_on.slice(0,7))fail('The rent month must fall within the lease dates.');
   const due=date(input.dueOn,'due date');if(due.slice(0,7)!==input.period)fail('The due date must be in the rent month.');
   const amount=money(input.amount,'rent charge');
   if(db.prepare('SELECT id FROM rent_charges WHERE lease_id=? AND period=?').get(lease.id,input.period))fail('Rent has already been charged for this lease and month.',409);
   const result=db.prepare('INSERT INTO rent_charges(lease_id,period,due_on,amount_cents,created_by,created_at) VALUES(?,?,?,?,?,?)').run(lease.id,input.period,due,amount,user.id,new Date().toISOString());return charge(Number(result.lastInsertRowid));
  },
  recordPayment(user,value,input){
   staff(user);const record=charge(id(value));if(!record)fail('Rent charge not found.',404);
   const amount=money(input.amount,'payment'),paidOn=date(input.paidOn,'payment date'),reference=optional(input.reference,'a payment reference',200);
   if(paidOn>new Date().toISOString().slice(0,10))fail('Recorded payments cannot be dated in the future.');
   if(!['Bank transfer','Cash','External portal','Other'].includes(input.method))fail('Choose a valid payment method.');
   if(amount>record.amount_cents-record.paid_cents)fail('The payment exceeds the outstanding balance.',409);
   if(reference&&db.prepare('SELECT id FROM rent_payments WHERE charge_id=? AND reference=? AND voided_at IS NULL').get(record.id,reference))fail('A payment with this reference has already been recorded for this charge.',409);
   const result=db.prepare('INSERT INTO rent_payments(charge_id,amount_cents,paid_on,method,reference,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(record.id,amount,paidOn,input.method,reference,user.id,new Date().toISOString());return {id:Number(result.lastInsertRowid)};
  },
  voidPayment(user,value,input){
   staff(user);const reason=text(input.reason,'a reason for voiding the payment',500),record=db.prepare('SELECT * FROM rent_payments WHERE id=?').get(id(value));
   if(!record)fail('Payment not found.',404);if(record.voided_at)fail('This payment has already been voided.',409);
   db.prepare('UPDATE rent_payments SET void_reason=?,voided_by=?,voided_at=? WHERE id=?').run(reason,user.id,new Date().toISOString(),record.id);return {ok:true};
  },
  conversations(user){return db.prepare(`SELECT c.*,u.name AS tenant_name,(SELECT body FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) AS last_message FROM conversations c JOIN users u ON u.id=c.tenant_id ${user.role==='tenant'?'WHERE c.tenant_id=?':''} ORDER BY c.updated_at DESC,c.id DESC`).all(...(user.role==='tenant'?[user.id]:[]));},
  newConversation(user,input){
   const resident=user.role==='tenant'?user.id:id(input.tenantId);
   if(!db.prepare("SELECT id FROM users WHERE id=? AND role='tenant' AND active=1").get(resident))fail('Choose an active resident.');
   const subject=text(input.subject,'a subject',150),body=text(input.body,'a message',4000),now=new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');try{const result=db.prepare('INSERT INTO conversations(tenant_id,subject,created_at,updated_at) VALUES(?,?,?,?)').run(resident,subject,now,now);const recordId=Number(result.lastInsertRowid);db.prepare('INSERT INTO messages(conversation_id,author_id,body,created_at) VALUES(?,?,?,?)').run(recordId,user.id,body,now);db.exec('COMMIT');return {id:recordId};}catch(error){db.exec('ROLLBACK');throw error;}
  },
  messages(user,value){const row=conversation(user,value);return {conversation:row,messages:db.prepare('SELECT m.*,u.name AS author_name,u.role AS author_role FROM messages m JOIN users u ON u.id=m.author_id WHERE m.conversation_id=? ORDER BY m.id').all(row.id)};},
  reply(user,value,input){const row=conversation(user,value),body=text(input.body,'a message',4000),now=new Date().toISOString();db.prepare('INSERT INTO messages(conversation_id,author_id,body,created_at) VALUES(?,?,?,?)').run(row.id,user.id,body,now);db.prepare("UPDATE conversations SET status='Open',updated_at=? WHERE id=?").run(now,row.id);return {ok:true};},
  closeConversation(user,value){staff(user);const row=conversation(user,value);db.prepare("UPDATE conversations SET status='Closed',updated_at=? WHERE id=?").run(new Date().toISOString(),row.id);return {ok:true};}
 };
}
module.exports={createOperations,money,date};
