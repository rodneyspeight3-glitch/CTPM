const fs=require('node:fs');
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const {smtpSettings,createMailer,mailError}=require('./mailer');
const {verifyPassword}=require('./auth');
const {admin,fail,rateLimit,transaction,stamp,installationId}=require('./service-utils');
const address=value=>typeof value==='string'&&value.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const fields=['SMTP_ENABLED','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_FROM','SMTP_PASSWORD'];
function createSmtpSettings(db,{keyPath,env=process.env,transportFactory}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS smtp_configuration(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'environment',ciphertext BLOB,nonce BLOB,tag BLOB,updated_by INTEGER REFERENCES users(id),updated_at TEXT,verified_at TEXT);
 CREATE TABLE IF NOT EXISTS smtp_settings_events(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,actor_id INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO smtp_configuration(id) VALUES(1)').run();
 const instance=installationId(db),row=()=>db.prepare('SELECT * FROM smtp_configuration WHERE id=1').get();
 const hosting=()=>Object.fromEntries(fields.map(key=>[key,env[key]||'']));
 const authorize=user=>{admin(user);const actor=db.prepare("SELECT id,password_hash FROM users WHERE id=? AND role='admin' AND active=1").get(user.id);if(!actor)fail('Administrator access changed. Sign in again.',403);return actor;};
 function key(create=false){
  if(!keyPath)throw Error('Credential key path unavailable');
  if(create&&!fs.existsSync(keyPath)){
   let fd;try{fd=fs.openSync(keyPath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);fs.writeFileSync(fd,randomBytes(32));fs.fsyncSync(fd);}catch(error){if(error.code!=='EEXIST')throw error;}finally{if(fd!==undefined)fs.closeSync(fd);}
  }
  const fd=fs.openSync(keyPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{if(!fs.fstatSync(fd).isFile())throw Error('Invalid credential key');fs.fchmodSync(fd,0o600);const value=fs.readFileSync(fd);if(value.length!==32)throw Error('Invalid credential key');return value;}finally{fs.closeSync(fd);}
 }
 const aad=revision=>Buffer.from('ctpm-smtp-v1:'+instance+':'+revision);
 function unpack(record){const decipher=createDecipheriv('aes-256-gcm',key(),record.nonce);decipher.setAAD(aad(record.revision));decipher.setAuthTag(record.tag);const data=JSON.parse(Buffer.concat([decipher.update(record.ciphertext),decipher.final()]).toString('utf8'));if(fields.some(name=>typeof data[name]!=='string'))throw Error('Invalid saved settings');return Object.fromEntries(fields.map(name=>[name,data[name]]));}
 function snapshot(){const saved=row();if(saved.source==='environment')return {env:hosting(),source:'environment',revision:saved.revision,verifiedAt:null,updatedAt:saved.updated_at,storageProblem:null};try{return {env:unpack(saved),source:'dashboard',revision:saved.revision,verifiedAt:saved.verified_at,updatedAt:saved.updated_at,storageProblem:null};}catch{return {env:{SMTP_ENABLED:'false',SMTP_HOST:'smtp.gmail.com'},source:'dashboard',revision:saved.revision,verifiedAt:null,updatedAt:saved.updated_at,storageProblem:'Stored email credentials cannot be unlocked. Restore the SMTP encryption key or use hosting settings and enter the mailbox credentials again.'};}}
 async function reauthenticate(user,input){const actor=authorize(user);rateLimit(db,'smtp-settings-password',user.id,20,3600000);if(typeof input.currentPassword!=='string'||input.currentPassword.length>128||!await verifyPassword(input.currentPassword,actor.password_hash))fail('Confirm your current administrator password.',403);const current=authorize(user);if(current.password_hash!==actor.password_hash)fail('Your account changed. Sign in again.',403);return actor;}
 const revision=input=>{if(!Number.isSafeInteger(input.revision)||input.revision!==row().revision)fail('SMTP settings changed. Reload them before continuing.',409);};
 const stillAuthorized=(user,actor,input)=>{if(authorize(user).password_hash!==actor.password_hash)fail('Your account changed. Sign in again.',403);revision(input);};
 function candidate(input,enabled){
  const current=snapshot();if(current.storageProblem)fail(current.storageProblem,503);
  if(!['smtp.gmail.com','smtp.mail.com'].includes(input.host)||![465,587].includes(input.port))fail('Choose Gmail or mail.com and TLS port 465 or STARTTLS port 587.');
  const user=typeof input.username==='string'?input.username.trim().toLowerCase():'',from=typeof input.from==='string'?input.from.trim().toLowerCase():'';
  if(user&&!address(user)||from&&!address(from))fail('Enter a single valid mailbox address.');if(user&&from&&user!==from)fail('Use the same authorized mailbox for login and sender.');
  if(input.password!==undefined&&(typeof input.password!=='string'||input.password.length>512))fail('Use a mailbox password of at most 512 characters.');if(input.clearPassword===true&&input.password)fail('Choose either a replacement password or removal of the stored password.');
  const old=smtpSettings(current.env),provided=typeof input.password==='string'&&input.password.length>0;
  if(!provided&&!input.clearPassword&&(old.host!==input.host||old.user!==user)&&old.password)fail('Enter the mailbox password again when changing provider or login address.');
  let password=input.clearPassword===true?'':provided?input.password:old.password||'';if(input.host==='smtp.gmail.com')password=password.replace(/[ \t\r\n]/g,'');
  if(provided&&input.host==='smtp.gmail.com'&&!/^[A-Za-z0-9]{16}$/.test(password))fail('Gmail requires a generated 16-character Google app password, not your regular sign-in password.');
  const next={SMTP_ENABLED:enabled?'true':'false',SMTP_HOST:input.host,SMTP_PORT:String(input.port),SMTP_USER:user,SMTP_FROM:from,SMTP_PASSWORD:password};
  const config=smtpSettings(next);if(enabled&&(!config.ready))fail(config.problem||'Complete the mailbox, sender and SMTP password before enabling delivery.');return next;
 }
 function store(user,input,next,verifiedAt){
  revision(input);const saved=row(),nextRevision=saved.revision+1;let ciphertext,nonce,tag;
  try{const secret=key(saved.source!=='dashboard');nonce=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',secret,nonce);cipher.setAAD(aad(nextRevision));ciphertext=Buffer.concat([cipher.update(JSON.stringify(next),'utf8'),cipher.final()]);tag=cipher.getAuthTag();}catch{fail('SMTP credential storage is unavailable. Check the persistent data disk and key-file permissions.',503);}
  transaction(db,()=>{revision(input);db.prepare("UPDATE smtp_configuration SET source='dashboard',revision=?,ciphertext=?,nonce=?,tag=?,updated_by=?,updated_at=?,verified_at=? WHERE id=1").run(nextRevision,ciphertext,nonce,tag,user.id,stamp(),verifiedAt);db.prepare('INSERT INTO smtp_settings_events(revision,actor_id,action,created_at) VALUES(?,?,?,?)').run(nextRevision,user.id,next.SMTP_ENABLED==='true'?'Connection checked and delivery enabled':'Saved with delivery paused',stamp());});
 }
 async function check(envLike){const mailer=createMailer({settingsSource:()=>({env:envLike,source:'candidate',revision:0}),...(transportFactory?{transportFactory}:{})});try{return await mailer.verify({allowPaused:true});}catch(error){if(error.code==='SMTP_NOT_CONFIGURED')fail('Complete valid SMTP settings before checking the connection.');fail('SMTP connection check failed: '+mailError(error)+'. Check the provider, mailbox and app password.',503);}finally{mailer.close();}}
 return {
  snapshot,
  status(user){authorize(user);const current=snapshot(),c=smtpSettings(current.env);return {source:current.source,revision:current.revision,deliveryLocked:env.EMAIL_DELIVERY_DISABLED==='true',enabled:c.enabled,host:c.host,port:c.port,username:c.user,from:c.from,hasPassword:!!c.password,problem:current.storageProblem||c.problem,storageProblem:!!current.storageProblem,missing:c.missing,updatedAt:current.updatedAt,verifiedAt:current.verifiedAt};},
  async save(user,input){const actor=await reauthenticate(user,input);revision(input);const enable=input.action==='enable';if(!['pause','enable'].includes(input.action))fail('Choose Save paused or Check and enable.');if(enable&&env.EMAIL_DELIVERY_DISABLED==='true')fail('Email delivery is disabled by the hosting administrator for this environment.',503);if(enable&&input.confirmEnable!==true)fail('Confirm that automatic delivery can send pending eligible messages.');const next=candidate(input,enable);const checked=enable?await check(next):null;stillAuthorized(user,actor,input);store(user,input,next,checked?.verifiedAt||null);return {settings:this.status(user),message:enable?'Connection accepted. Automatic email is enabled for eligible queued messages.':'SMTP settings saved. Automatic email delivery is paused.'};},
  async checkSaved(user,input){const actor=await reauthenticate(user,input);revision(input);const current=snapshot();if(current.storageProblem)fail(current.storageProblem,503);const result=await check(current.env);stillAuthorized(user,actor,input);if(row().source==='dashboard')db.prepare('UPDATE smtp_configuration SET verified_at=? WHERE id=1 AND revision=?').run(result.verifiedAt,input.revision);return {settings:this.status(user),message:'The encrypted SMTP connection and mailbox login were accepted. No email was sent.',verifiedAt:result.verifiedAt};},
  async reset(user,input){const actor=await reauthenticate(user,input);stillAuthorized(user,actor,input);if(input.confirmReset!==true)fail('Confirm that the dashboard override should be removed.');transaction(db,()=>{revision(input);const next=input.revision+1;db.prepare("UPDATE smtp_configuration SET source='environment',revision=?,ciphertext=NULL,nonce=NULL,tag=NULL,verified_at=NULL,updated_by=?,updated_at=? WHERE id=1").run(next,user.id,stamp());db.prepare('INSERT INTO smtp_settings_events(revision,actor_id,action,created_at) VALUES(?,?,?,?)').run(next,user.id,'Returned to hosting configuration',stamp());});return {settings:this.status(user),message:'Dashboard settings removed. The hosting SMTP configuration now applies.'};}
 };
}
module.exports={createSmtpSettings};
