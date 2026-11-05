const { DatabaseSync } = require('node:sqlite');
const { randomBytes, scrypt, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const derive = promisify(scrypt);
const roles = ['tenant', 'agent', 'admin'];
const sessionAge = 8 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest('hex');
const publicUser = user => ({ id:user.id, name:user.name, email:user.email, role:user.role });
async function passwordHash(password) {
 const salt=randomBytes(16).toString('hex');
 const hash=await derive(password,salt,64);
 return salt+':'+hash.toString('hex');
}
async function verifyPassword(password, stored) {
 const [salt,hash]=stored.split(':');
 const derived=await derive(password,salt,64);
 return timingSafeEqual(derived,Buffer.from(hash,'hex'));
}
async function createAuth(dbFile) {
 fs.mkdirSync(path.dirname(dbFile),{recursive:true,mode:0o700});
 const db=new DatabaseSync(dbFile);
 fs.chmodSync(dbFile,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('tenant','agent','admin')), password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);`);
 const dummy=await passwordHash(randomBytes(32).toString('hex'));
 async function addUser({name,email,role,password}) {
  name=typeof name==='string'?name.trim():'';email=typeof email==='string'?email.trim().toLowerCase():'';
  if(!name||name.length>100||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(role)||typeof password!=='string'||password.length<16||password.length>128) {
   const error=new Error('Enter a name, valid email, role, and a password of 16–128 characters.');error.status=400;throw error;
  }
  const hash=await passwordHash(password);
  try {const result=db.prepare('INSERT INTO users(name,email,role,password_hash) VALUES(?,?,?,?)').run(name,email,role,hash);return {id:Number(result.lastInsertRowid),name,email,role};}
  catch(error){if(error.code==='ERR_SQLITE_ERROR'&&error.message.includes('UNIQUE')){const e=new Error('An account with this email already exists.');e.status=409;throw e;}throw error;}
 }
 if(!db.prepare('SELECT id FROM users LIMIT 1').get() && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  await addUser({name:'Company Administrator',email:process.env.ADMIN_EMAIL,role:'admin',password:process.env.ADMIN_PASSWORD});
  console.log('Initial administrator account created.');
 }
 if(process.env.NODE_ENV==='production'&&!db.prepare('SELECT id FROM users LIMIT 1').get())throw new Error('Configure ADMIN_EMAIL and ADMIN_PASSWORD before the first production start.');
 // Bootstrap values never reset an existing administrator password.
 delete process.env.ADMIN_PASSWORD;
 function userFor(req) {
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ctpm_session='))?.slice(13);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const user=db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(digest(token),Date.now());
  return user?publicUser(user):null;
 }
 function sessionCookie(token, maxAge=sessionAge) {return `ctpm_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
 function logout(req) {
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ctpm_session='))?.slice(13);
  if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
 }
 async function login({email,password,role},req) {
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>128||!roles.includes(role))return null;
  email=email.trim().toLowerCase();const now=Date.now();
  db.prepare('DELETE FROM login_attempts WHERE expires_at<?').run(now);
  // Rate-limit by account and by connection. Shared proxies get a higher connection allowance.
  const keys=[[digest('email:'+email),10],[digest('ip:'+req.socket.remoteAddress),100]];
  for(const [key,max] of keys){const row=db.prepare('SELECT count FROM login_attempts WHERE key=?').get(key);if(row&&row.count>=max){const e=new Error('Too many sign-in attempts. Try again in 15 minutes.');e.status=429;throw e;}}
  for(const [key] of keys)db.prepare('INSERT INTO login_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+15*60*1000);
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const valid=await verifyPassword(password,user?.password_hash||dummy);
  if(!user||!valid||user.role!==role)return null;
  db.prepare('DELETE FROM login_attempts WHERE key=?').run(keys[0][0]);
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
  logout(req);
  const token=randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,now+sessionAge*1000);
  return {user:publicUser(user),cookie:sessionCookie(token)};
 }
 async function changePassword(user,currentPassword,newPassword) {
  if(typeof currentPassword!=='string'||currentPassword.length>128||typeof newPassword!=='string'||newPassword.length<16||newPassword.length>128){const e=new Error('Use a new password of 16–128 characters.');e.status=400;throw e;}
  const row=db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  if(!await verifyPassword(currentPassword,row.password_hash)){const e=new Error('Current password is incorrect.');e.status=400;throw e;}
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await passwordHash(newPassword),user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
 }
 return {db,addUser,userFor,login,logout,sessionCookie,changePassword,listUsers:()=>db.prepare('SELECT id,name,email,role FROM users ORDER BY id DESC').all()};
}
module.exports={createAuth,roles};
