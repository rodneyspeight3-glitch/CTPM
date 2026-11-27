const {photoName}=require('./photo-names');
function ensureAgentProfiles(db){
 db.exec(`CREATE TABLE IF NOT EXISTS agent_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id),display_name TEXT NOT NULL,title TEXT NOT NULL,bio TEXT NOT NULL,public_email TEXT NOT NULL,public_phone TEXT NOT NULL,areas TEXT NOT NULL,photo_mime TEXT,photo_data BLOB,updated_at TEXT NOT NULL,updated_by INTEGER NOT NULL REFERENCES users(id));`);
 if(!db.prepare('PRAGMA table_info(agent_profiles)').all().some(c=>c.name==='photo_name'))db.exec("ALTER TABLE agent_profiles ADD COLUMN photo_name TEXT NOT NULL DEFAULT ''");
 for(const row of db.prepare("SELECT user_id,photo_mime FROM agent_profiles WHERE photo_data IS NOT NULL AND photo_name=''").all())db.prepare('UPDATE agent_profiles SET photo_name=? WHERE user_id=?').run(photoName(row.photo_mime),row.user_id);
 if(!db.prepare('PRAGMA table_info(agent_profiles)').all().some(column=>column.name==='gender'))db.exec("ALTER TABLE agent_profiles ADD COLUMN gender TEXT NOT NULL DEFAULT 'unspecified' CHECK(gender IN ('unspecified','male','female','nonbinary'))");
}
// Public contact details are explicitly managed by admins; never use login email.
const publicAgentColumns="u.id,COALESCE(NULLIF(p.display_name,''),u.name) AS name,COALESCE(p.title,'Property agent') AS title,COALESCE(p.bio,'') AS bio,COALESCE(p.public_email,'') AS email,COALESCE(p.public_phone,'') AS phone,COALESCE(p.areas,'') AS areas,CASE WHEN p.photo_data IS NOT NULL THEN 1 ELSE 0 END AS hasPhoto,CASE WHEN p.gender IN ('male','female') THEN p.gender ELSE 'neutral' END AS avatarStyle,p.updated_at";
const agentIntro=({name,title,areas})=>`${name} is a ${title||'property agent'} with Come Together Property Management.${areas?' Areas served: '+areas+'.':''} Reach out for information about available homes, application steps and property management support.`;
const completePublicAgent=agent=>({...agent,bio:agent.bio?.trim()?agent.bio:agentIntro(agent)});
module.exports={agentIntro,completePublicAgent,ensureAgentProfiles,publicAgentColumns};
