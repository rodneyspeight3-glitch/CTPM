const {ensureAgentProfiles,publicAgentColumns}=require('./agent-profiles');
const stores=new WeakMap();
function fail(message,status=400){const error=Error(message);error.status=status;throw error;}
function createPropertyAgents(db){
 if(stores.has(db))return stores.get(db);
 ensureAgentProfiles(db);
 const accountColumns=new Set(db.prepare('PRAGMA table_info(users)').all().map(column=>column.name)),identityAvailable=accountColumns.has('role')&&accountColumns.has('active');
 db.exec(`CREATE TABLE IF NOT EXISTS property_agents(property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,agent_id INTEGER NOT NULL REFERENCES users(id),assigned_by INTEGER NOT NULL REFERENCES users(id),assigned_at TEXT NOT NULL,PRIMARY KEY(property_id,agent_id));
 CREATE INDEX IF NOT EXISTS property_agents_user ON property_agents(agent_id);
 CREATE TABLE IF NOT EXISTS property_agent_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL);`);
 // A one-time, transactional backfill uses the recorded creator only. Later admin
 // reassignments must not be silently undone on restart.
 db.exec('SAVEPOINT property_agents_backfill');
 try{if(identityAvailable&&!db.prepare('SELECT 1 FROM property_agent_migrations WHERE name=?').get('creator-v1')){
  db.prepare("INSERT OR IGNORE INTO property_agents(property_id,agent_id,assigned_by,assigned_at) SELECT p.id,p.created_by,p.created_by,p.created_at FROM properties p JOIN users u ON u.id=p.created_by WHERE u.role='agent'").run();
  db.prepare('INSERT INTO property_agent_migrations VALUES(?,?)').run('creator-v1',new Date().toISOString());
 }db.exec('RELEASE property_agents_backfill');}catch(error){db.exec('ROLLBACK TO property_agents_backfill');db.exec('RELEASE property_agents_backfill');throw error;}
 const api={
  ids(propertyId){return db.prepare('SELECT agent_id FROM property_agents WHERE property_id=? ORDER BY agent_id').all(propertyId).map(row=>row.agent_id);},
  requested(user,data,propertyId=null){
   if(data.agentIds===undefined)return propertyId===null?(identityAvailable&&user.role==='agent'?[user.id]:[]):null;
   if(user.role!=='admin')fail('Only administrators can change property agents.',403);
   if(!identityAvailable)fail('Update the account schema before assigning agents.',409);
   if(!Array.isArray(data.agentIds)||data.agentIds.length>20||new Set(data.agentIds).size!==data.agentIds.length||data.agentIds.some(id=>!Number.isSafeInteger(id)||id<1))fail('Choose up to 20 distinct agents.');
   const existing=new Set(propertyId===null?[]:api.ids(propertyId));
   for(const id of data.agentIds){const row=db.prepare('SELECT role,active FROM users WHERE id=?').get(id);if(!row||((row.role!=='agent'||!row.active)&&!existing.has(id)))fail('Choose an active agent.');}
   return [...data.agentIds];
  },
  replace(user,propertyId,ids){if(ids===null)return;const current=new Set(api.ids(propertyId)),next=new Set(ids);for(const id of current)if(!next.has(id))db.prepare('DELETE FROM property_agents WHERE property_id=? AND agent_id=?').run(propertyId,id);for(const id of ids)if(!current.has(id))db.prepare('INSERT INTO property_agents VALUES(?,?,?,?)').run(propertyId,id,user.id,new Date().toISOString());},
  attach(rows,{staff=false}={}){
   if(!rows.length)return rows;
   if(!identityAvailable)return rows.map(row=>{const {agents,assignedAgentIds,unavailableAgents,...safe}=row;return {...safe,agents:[],...(staff?{assignedAgentIds:[],unavailableAgents:[]}:{})};});
   const wanted=new Set(rows.map(row=>row.id)),active=new Map(),assigned=new Map(),unavailable=new Map();
   // One read for the returned portfolio; photo bytes and private account fields
   // never enter the listing DTO or saved-home snapshot.
   for(const row of db.prepare('SELECT a.property_id,'+publicAgentColumns+",u.active AS account_active,u.role AS account_role FROM property_agents a JOIN users u ON u.id=a.agent_id LEFT JOIN agent_profiles p ON p.user_id=u.id ORDER BY name COLLATE NOCASE,u.id").all()){
    if(!wanted.has(row.property_id))continue;
    if(!assigned.has(row.property_id))assigned.set(row.property_id,[]);assigned.get(row.property_id).push(row.id);
    const {property_id,account_active,account_role,...profile}=row;
    if(account_active&&account_role==='agent'){if(!active.has(property_id))active.set(property_id,[]);active.get(property_id).push(profile);}
    else if(staff){if(!unavailable.has(property_id))unavailable.set(property_id,[]);unavailable.get(property_id).push({id:row.id,name:row.name});}
   }
   return rows.map(row=>{const {agents,assignedAgentIds,unavailableAgents,...safe}=row;return {...safe,agents:active.get(row.id)||[],...(staff?{assignedAgentIds:assigned.get(row.id)||[],unavailableAgents:unavailable.get(row.id)||[]}:{})};});
  }
 };
 if(identityAvailable)stores.set(db,api);return api;
}
module.exports={createPropertyAgents};
