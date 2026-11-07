function ensureAgentProfiles(db){
 db.exec(`CREATE TABLE IF NOT EXISTS agent_profiles(user_id INTEGER PRIMARY KEY REFERENCES users(id),display_name TEXT NOT NULL,title TEXT NOT NULL,bio TEXT NOT NULL,public_email TEXT NOT NULL,public_phone TEXT NOT NULL,areas TEXT NOT NULL,photo_mime TEXT,photo_data BLOB,updated_at TEXT NOT NULL,updated_by INTEGER NOT NULL REFERENCES users(id));`);
}
// Public contact details are explicitly managed by admins; never use login email.
const publicAgentColumns="u.id,COALESCE(NULLIF(p.display_name,''),u.name) AS name,COALESCE(p.title,'Property agent') AS title,COALESCE(p.bio,'') AS bio,COALESCE(p.public_email,'') AS email,COALESCE(p.public_phone,'') AS phone,COALESCE(p.areas,'') AS areas,CASE WHEN p.photo_data IS NOT NULL THEN 1 ELSE 0 END AS hasPhoto,p.updated_at";
module.exports={ensureAgentProfiles,publicAgentColumns};
