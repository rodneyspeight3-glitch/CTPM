const {createHash,randomUUID}=require('node:crypto');
const {fail,text,number}=require('./management');
const id=value=>number(Number(value),'record',1,Number.MAX_SAFE_INTEGER,true);
const stamp=()=>new Date().toISOString();
const today=()=>stamp().slice(0,10);
const digest=value=>createHash('sha256').update(value).digest('hex');
const staff=user=>{if(!user||!['admin','agent'].includes(user.role))fail('Agent or administrator access is required.',403);};
const admin=user=>{if(user?.role!=='admin')fail('Administrator access is required.',403);};
const optional=(value,label,max)=>value===undefined?'':typeof value==='string'&&value.trim().length<=max?value.trim():fail(`Use ${label} up to ${max} characters.`);
function migrate(db,table,name,definition){if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name===name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+definition);}
function transaction(db,action){db.exec('BEGIN IMMEDIATE');try{const value=action();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
function verified(db,user){const row=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(user.id);if(!row?.email_verified_at&&!row?.identity_confirmed_at)fail('Ask management to confirm your identity before continuing.',403);return row;}
function publicOrigin(){const raw=process.env.PUBLIC_APP_URL||process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL;if(!raw)return '';try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:process.env.NODE_ENV!=='production'&&u.hostname==='127.0.0.1'?u.origin:'';}catch{return '';}}
function imageBytes(input,max=2097152){
 if(!input||!['image/jpeg','image/png'].includes(input.mime)||typeof input.data!=='string'||input.data.length>Math.ceil(max/3)*4+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Upload a JPEG or PNG up to '+max/1048576+' MB.');
 const data=Buffer.from(input.data,'base64'),valid=input.mime==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data[0]===255&&data[1]===216&&data[2]===255;
 if(data.length<12||data.length>max||!valid)fail('Upload a valid JPEG or PNG up to '+max/1048576+' MB.');return data;
}
function rateLimit(db,scope,connection,limit=20,age=900000){const now=Date.now(),key=digest(scope+':'+connection);db.exec('CREATE TABLE IF NOT EXISTS service_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)');db.prepare('DELETE FROM service_limits WHERE expires_at<=?').run(now);if((db.prepare('SELECT count FROM service_limits WHERE key=?').get(key)?.count||0)>=limit)fail('Too many requests. Please try again later.',429);db.prepare('INSERT INTO service_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+age);}
function installationId(db){db.exec('CREATE TABLE IF NOT EXISTS app_identity(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)');db.prepare('INSERT OR IGNORE INTO app_identity VALUES(1,?)').run(randomUUID());return db.prepare('SELECT value FROM app_identity WHERE id=1').get().value;}
function csvCell(value){const text=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
module.exports={id,stamp,today,digest,staff,admin,optional,migrate,transaction,verified,publicOrigin,imageBytes,rateLimit,csvCell,installationId,fail,text,number};
