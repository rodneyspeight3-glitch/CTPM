const {randomBytes}=require('node:crypto');
const {passwordHash}=require('./auth');
const {migrate,digest,stamp,rateLimit,publicOrigin,transaction,fail}=require('./service-utils');
function createAccountServices(db,mail){
 migrate(db,'users','identity_confirmed_at','TEXT');migrate(db,'users','identity_confirmed_by','INTEGER REFERENCES users(id)');
 migrate(db,'users','email_verified_at','TEXT');migrate(db,'users','email_notifications','INTEGER NOT NULL DEFAULT 0');
 db.exec(`CREATE TABLE IF NOT EXISTS account_tokens(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),email TEXT NOT NULL,password_fingerprint TEXT NOT NULL,purpose TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at TEXT NOT NULL);`);
 function issue(user,purpose){const token=randomBytes(32).toString('hex');transaction(db,()=>{db.prepare("UPDATE email_outbox SET status='Cancelled',body='' WHERE user_id=? AND kind=? AND status='Pending'").run(user.id,purpose==='reset'?'recovery':'verification');db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(user.id,purpose);db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?,?,?,?)').run(digest(token),user.id,user.email,digest(user.password_hash),purpose,Date.now()+(purpose==='reset'?1800000:86400000),stamp());});return token;}
 function valid(token,purpose){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('This link is invalid or expired. Request a new one.',400);const row=db.prepare('SELECT t.*,u.password_hash,u.active,u.email AS current_email FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE token_hash=? AND purpose=? AND expires_at>?').get(digest(token),purpose,Date.now());if(!row?.active||row.email!==row.current_email||row.password_fingerprint!==digest(row.password_hash))fail('This link is invalid or expired. Request a new one.',400);return row;}
 return {
  status(){return {emailEnabled:mail.configured(),freeMode:process.env.ALLOW_PAID_INTEGRATIONS!=='true'};},
  requestVerification(user,req){
   if(!mail.configured())fail('Email delivery has not been connected. Contact management for account help.',503);
   rateLimit(db,'verify-user',user.id,3,3600000);rateLimit(db,'verify-ip',req.socket.remoteAddress,60,3600000);
   const row=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(user.id);if(row.email_verified_at)return {message:'Your email is already verified.'};
   const token=issue(row,'verify');mail.enqueue({userId:row.id,to:row.email,subject:'Verify your Come Together email',body:'Confirm your email to securely access application tracking and lease signing. This link expires in 24 hours.\n\n'+publicOrigin()+'/account-access#verify='+token,kind:'verification',key:'verify:'+digest(token),expiresAt:Date.now()+86400000});return {message:'A verification link has been queued for your email.'};
  },
  verify(input){const row=valid(input.token,'verify');transaction(db,()=>{db.prepare('UPDATE users SET email_verified_at=? WHERE id=?').run(stamp(),row.user_id);db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(row.user_id,'verify');});return {message:'Email verified. Sign in or return to My account.'};},
  forgot(input,req){
   const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
   if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)fail('Enter a valid email address.');
   rateLimit(db,'recover-ip',req.socket.remoteAddress,60,3600000);rateLimit(db,'recover-email',email,3,3600000);
   const row=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
   if(row&&mail.configured()){const token=issue(row,'reset');mail.enqueue({userId:row.id,to:row.email,subject:'Reset your Come Together password',body:'Use this link to choose a new password. It expires in 30 minutes. If you did not request it, you can ignore this email.\n\n'+publicOrigin()+'/account-access#reset='+token,kind:'recovery',key:'reset:'+digest(token),expiresAt:Date.now()+1800000});}
   return {message:mail.configured()?'If an active account matches, a reset link has been queued.':'Email delivery is not connected yet. Please contact management for password recovery.'};
  },
  async reset(input){const row=valid(input.token,'reset');if(typeof input.password!=='string'||input.password.length<16||input.password.length>128||input.password!==input.confirmation)fail('Use matching passwords of 16–128 characters.');const hash=await passwordHash(input.password);transaction(db,()=>{valid(input.token,'reset');db.prepare('UPDATE users SET password_hash=?,email_verified_at=COALESCE(email_verified_at,?) WHERE id=?').run(hash,stamp(),row.user_id);db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(row.user_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);db.prepare('DELETE FROM login_attempts WHERE key=?').run(digest('email:'+row.email));});return {message:'Password updated. Sign in with your new password.'};},
  preferences(user,input){if(typeof input.emailNotifications!=='boolean')fail('Choose an email notification preference.');db.prepare('UPDATE users SET email_notifications=? WHERE id=?').run(input.emailNotifications?1:0,user.id);return {ok:true};}
 };
}
module.exports={createAccountServices};
