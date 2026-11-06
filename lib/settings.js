const {fail}=require('./management');
const fields={companyName:150,contactEmail:254,contactPhone:40,paymentLabel:100,paymentUrl:2000,paymentAccountName:150,paymentBankName:150,paymentAccountDetails:500,paymentInstructions:3000};
function createSettings(db){
 db.exec(`CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT
 );
 CREATE TABLE IF NOT EXISTS settings_history (
  id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL
 );`);
 const defaults=Object.fromEntries(Object.keys(fields).map(key=>[key,key==='companyName'?'Come Together Property Management LLC':'']));
 db.prepare('INSERT OR IGNORE INTO company_settings(id,data) VALUES(1,?)').run(JSON.stringify(defaults));
 function get(){const row=db.prepare('SELECT * FROM company_settings WHERE id=1').get();return {...defaults,...JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at};}
 return {
  get,
  publicContact(){const {companyName,contactEmail,contactPhone}=get();return {companyName,contactEmail,contactPhone};},
  update(user,input){
   if(!['agent','admin'].includes(user.role))fail('Agent or administrator access is required.',403);
   const data={};
   for(const [key,max] of Object.entries(fields)){
    if(typeof input[key]!=='string'||input[key].trim().length>max)fail(`Enter valid ${key} (up to ${max} characters).`);
    data[key]=input[key].trim();
   }
   if(!data.companyName)fail('Enter the company name.');
   if(data.contactEmail&&!/^\S+@\S+\.\S+$/.test(data.contactEmail))fail('Enter a valid contact email.');
   if(data.contactPhone&&(!/^\+?[\d () .-]{7,40}$/.test(data.contactPhone)||data.contactPhone.replace(/\D/g,'').length<7))fail('Enter a valid contact phone number.');
   if(data.paymentUrl){
    let url;try{url=new URL(data.paymentUrl);}catch{fail('Enter a valid HTTPS payment portal URL.');}
    if(url.protocol!=='https:'||url.username||url.password)fail('Use an HTTPS payment portal URL without embedded credentials.');
    data.paymentUrl=url.href;
   }
   if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('Reload settings before saving.');
   const now=new Date().toISOString();
   db.exec('BEGIN IMMEDIATE');
   try{
    const result=db.prepare('UPDATE company_settings SET data=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?').run(JSON.stringify(data),now,input.revision);
    if(!result.changes)fail('Another staff member updated these settings. Reload settings, then reapply your changes.',409);
    db.prepare('INSERT INTO settings_history(revision,user_id,updated_at) VALUES(?,?,?)').run(input.revision+1,user.id,now);
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   return get();
  }
 };
}
module.exports={createSettings};
