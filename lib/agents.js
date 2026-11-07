const {id,admin,imageBytes,optional,text,fail,stamp}=require('./service-utils');
const {ensureAgentProfiles,publicAgentColumns}=require('./agent-profiles');
function createAgents(db){
 ensureAgentProfiles(db);
 const agent=value=>{const user=db.prepare("SELECT id,name,active FROM users WHERE id=? AND role='agent'").get(id(value));if(!user)fail('Agent not found.',404);return user;};
 const list=()=>db.prepare("SELECT "+publicAgentColumns+" FROM users u LEFT JOIN agent_profiles p ON p.user_id=u.id WHERE u.role='agent' AND u.active=1 ORDER BY name COLLATE NOCASE,u.id").all();
 return {list,
  editList(user){admin(user);return db.prepare("SELECT u.id,u.name AS account_name,u.active,p.* FROM users u LEFT JOIN agent_profiles p ON p.user_id=u.id WHERE u.role='agent' ORDER BY u.active DESC,u.name").all().map(p=>{const {photo_data,photo_mime,...safe}=p;return {...safe,hasPhoto:!!photo_data};});},
  save(user,value,input){admin(user);const u=agent(value),name=text(input.displayName,'a public display name',100),title=text(input.title,'a public title',100),bio=optional(input.bio,'a biography',1500),email=optional(input.email,'a public email',254),phone=optional(input.phone,'a public phone',40),areas=optional(input.areas,'areas served',500);if(email&&!/^\S+@\S+\.\S+$/.test(email))fail('Enter a valid public email.');if(phone&&(!/^\+?[\d () .-]{7,40}$/.test(phone)||phone.replace(/\D/g,'').length<7))fail('Enter a valid public phone.');db.prepare('INSERT INTO agent_profiles(user_id,display_name,title,bio,public_email,public_phone,areas,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,title=excluded.title,bio=excluded.bio,public_email=excluded.public_email,public_phone=excluded.public_phone,areas=excluded.areas,updated_at=excluded.updated_at,updated_by=excluded.updated_by').run(u.id,name,title,bio,email,phone,areas,stamp(),user.id);return {ok:true};},
  savePhoto(user,value,input){admin(user);const u=agent(value),bytes=imageBytes(input);if(!db.prepare('SELECT user_id FROM agent_profiles WHERE user_id=?').get(u.id))this.save(user,u.id,{displayName:u.name,title:'Property agent',bio:'',email:'',phone:'',areas:''});db.prepare('UPDATE agent_profiles SET photo_mime=?,photo_data=?,updated_at=?,updated_by=? WHERE user_id=?').run(input.mime,bytes,stamp(),user.id,u.id);return {ok:true};},
  photo(value,user){const u=agent(value);if(!u.active&&user?.role!=='admin')fail('Photo not found.',404);const photo=db.prepare('SELECT photo_mime AS mime,photo_data AS data FROM agent_profiles WHERE user_id=? AND photo_data IS NOT NULL').get(u.id);if(!photo)fail('Photo not found.',404);return photo;},
  deletePhoto(user,value){admin(user);agent(value);db.prepare('UPDATE agent_profiles SET photo_data=NULL,photo_mime=NULL,updated_at=?,updated_by=? WHERE user_id=?').run(stamp(),user.id,id(value));return {ok:true};}
 };
}
module.exports={createAgents};
