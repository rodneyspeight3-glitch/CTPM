const categories = ['Plumbing', 'Heating & cooling', 'Electrical', 'Appliances', 'Other'];
const priorities = ['Routine', 'Urgent'];
const statuses = ['Submitted', 'In progress', 'Completed', 'Cancelled'];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function text(value, label, max) {
 if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`Enter ${label} (up to ${max} characters).`);
 return value.trim();
}
function number(value, label, min, max, integer = false) {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`Enter a valid ${label}.`);
 return value;
}
function listingDetails(data){
 const description=data.description===undefined?'':data.description;
 const amenities=data.amenities===undefined?[]:data.amenities;
 if(typeof description!=='string'||description.trim().length>3000)fail('Use a property description of up to 3000 characters.');
 if(!Array.isArray(amenities)||amenities.length>12||amenities.some(a=>typeof a!=='string'||!a.trim()||a.trim().length>40))fail('Use up to 12 amenities of 1–40 characters.');
 return {description:description.trim(),amenities:[...new Set(amenities.map(a=>a.trim()))]};
}
function listingDTO(p){const {is_preview,...row}=p;return {...row,isPreview:!!is_preview,amenities:JSON.parse(row.amenities||'[]')};}
function createManagement(db) {
 // Additive migrations preserve existing accounts, sessions, and application data.
 db.exec(`CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL,
  price REAL NOT NULL, beds INTEGER NOT NULL, baths REAL NOT NULL, size INTEGER NOT NULL,
  type TEXT NOT NULL, image INTEGER NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES users(id), property_id INTEGER REFERENCES properties(id),
  location TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted', staff_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id)
 );
 CREATE INDEX IF NOT EXISTS maintenance_tenant ON maintenance_requests(tenant_id);`);
 db.exec('CREATE TABLE IF NOT EXISTS property_photos(property_id INTEGER PRIMARY KEY REFERENCES properties(id),mime TEXT NOT NULL,data BLOB NOT NULL,updated_at TEXT NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS saved_homes(user_id INTEGER NOT NULL REFERENCES users(id),property_id INTEGER NOT NULL REFERENCES properties(id),snapshot TEXT NOT NULL,saved_at TEXT NOT NULL,PRIMARY KEY(user_id,property_id))');
 if (!db.prepare('PRAGMA table_info(properties)').all().some(column => column.name === 'available')) {
  db.exec('ALTER TABLE properties ADD COLUMN available INTEGER NOT NULL DEFAULT 0 CHECK(available IN (0,1))');
 }
 if(!db.prepare('PRAGMA table_info(properties)').all().some(column=>column.name==='archived'))db.exec('ALTER TABLE properties ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))');
 for(const [name,definition] of [['is_preview','INTEGER NOT NULL DEFAULT 0'],['description',"TEXT NOT NULL DEFAULT ''"],['amenities',"TEXT NOT NULL DEFAULT '[]'"]])if(!db.prepare('PRAGMA table_info(properties)').all().some(c=>c.name===name))db.exec('ALTER TABLE properties ADD COLUMN '+name+' '+definition);
 const staff = user => { if (!['agent', 'admin'].includes(user.role)) fail('Agent or administrator access is required.', 403); };
 const requestId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) fail('Request not found.', 404); return id; };
 const getRequest = id => db.prepare(`SELECT r.*, u.name AS tenant_name, p.name AS property_name
  FROM maintenance_requests r JOIN users u ON u.id=r.tenant_id LEFT JOIN properties p ON p.id=r.property_id WHERE r.id=?`).get(id);
 return {
  showcase:()=>db.prepare('SELECT id,name,area,price,beds,baths,size,type,image,description,amenities FROM properties WHERE is_preview=1 AND archived=0 ORDER BY id').all().map(p=>({...listingDTO(p),photoUpdated:db.prepare('SELECT updated_at FROM property_photos WHERE property_id=?').get(p.id)?.updated_at||null})),
  listProperties: user => db.prepare(`SELECT id,name,area,address,price,beds,baths,size,type,image,available,archived,is_preview,description,amenities,created_at FROM properties ${user.role==='tenant'?'WHERE available=1 AND archived=0 AND is_preview=0':''} ORDER BY id DESC`).all().map(p=>({...listingDTO(p),available:!!p.available,archived:!!p.archived,photoUpdated:db.prepare('SELECT updated_at FROM property_photos WHERE property_id=?').get(p.id)?.updated_at||null})),
  savedHomes(user){
   if(user.role!=='tenant')fail('Tenant access is required.',403);
   return db.prepare('SELECT * FROM saved_homes WHERE user_id=? ORDER BY saved_at DESC,property_id DESC').all(user.id).map(row=>{
    const p=db.prepare('SELECT id,name,area,address,price,beds,baths,size,type,image,description,amenities FROM properties WHERE id=? AND available=1 AND archived=0 AND is_preview=0').get(row.property_id);
    return p?{...listingDTO(p),available:true,savedAt:row.saved_at,photoUpdated:db.prepare('SELECT updated_at FROM property_photos WHERE property_id=?').get(p.id)?.updated_at||null}:{...JSON.parse(row.snapshot),available:false,photoUpdated:null,savedAt:row.saved_at};
   });
  },
  saveHome(user,idValue,input){
   if(user.role!=='tenant')fail('Tenant access is required.',403);
   const id=requestId(idValue);if(typeof input.saved!=='boolean')fail('Choose whether to save this home.');
   if(!input.saved){db.prepare('DELETE FROM saved_homes WHERE user_id=? AND property_id=?').run(user.id,id);return {ok:true};}
   const p=db.prepare('SELECT id,name,area,address,price,beds,baths,size,type,image,description,amenities FROM properties WHERE id=? AND available=1 AND archived=0 AND is_preview=0').get(id);
   if(!p)fail('This home is no longer available.',409);
   db.prepare('INSERT INTO saved_homes(user_id,property_id,snapshot,saved_at) VALUES(?,?,?,?) ON CONFLICT(user_id,property_id) DO NOTHING').run(user.id,id,JSON.stringify(listingDTO(p)),new Date().toISOString());return {ok:true};
  },
  savePhoto(user,idValue,input){
   staff(user);const id=requestId(idValue);if(!db.prepare('SELECT id FROM properties WHERE id=?').get(id))fail('Property not found.',404);
   if(!['image/jpeg','image/png'].includes(input.mime)||typeof input.data!=='string'||input.data.length>1400000||!input.data||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Upload a JPEG or PNG photo up to 1 MB.');
   const bytes=Buffer.from(input.data,'base64');
   if(bytes.length>1048576||bytes.length<12||(input.mime==='image/png'?!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]!==255||bytes[1]!==216||bytes[2]!==255))fail('Upload a valid JPEG or PNG photo up to 1 MB.');
   db.prepare('INSERT INTO property_photos(property_id,mime,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET mime=excluded.mime,data=excluded.data,updated_at=excluded.updated_at').run(id,input.mime,bytes,new Date().toISOString());return {ok:true};
  },
  photo(user,idValue){
   const id=requestId(idValue),property=db.prepare('SELECT available,archived,is_preview FROM properties WHERE id=?').get(id);
   const mayRead=property&&(((property.available||property.is_preview)&&!property.archived)||(user&&['agent','admin'].includes(user.role))||(user?.role==='tenant'&&db.prepare("SELECT id FROM leases WHERE tenant_id=? AND property_id=? AND status='Active'").get(user.id,id)));
   if(!mayRead)fail('Photo not found.',404);const photo=db.prepare('SELECT mime,data FROM property_photos WHERE property_id=?').get(id);if(!photo)fail('Photo not found.',404);return photo;
  },
  addProperty(user, data) {
   staff(user);
   const name = text(data.name, 'a property name', 100), area = text(data.area, 'a neighborhood', 100), address = text(data.address, 'an address', 250);
   const price = number(data.price, 'monthly rent', 0, 1000000), beds = number(data.beds, 'bedroom count', 0, 50, true), baths = number(data.baths, 'bathroom count', 0.5, 50), size = number(data.size, 'square footage', 1, 1000000, true);
   if (!['SINGLE-FAMILY HOME', 'APARTMENT', 'CONDO', 'TOWNHOUSE'].includes(data.type)) fail('Choose a property type.');
   const image = number(data.image, 'listing illustration', 1, 3, true);
   if(data.available!==undefined&&typeof data.available!=='boolean')fail('Choose whether the property is available.');
   const details=listingDetails(data),isPreview=data.isPreview===true;if(data.isPreview!==undefined&&typeof data.isPreview!=='boolean')fail('Choose a listing category.');if(isPreview&&data.available)fail('Showcase homes cannot accept applications.',409);
   const result = db.prepare('INSERT INTO properties(name,area,address,price,beds,baths,size,type,image,created_by,created_at,available,is_preview,description,amenities) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(name,area,address,price,beds,baths,size,data.type,image,user.id,new Date().toISOString(),data.available?1:0,isPreview?1:0,details.description,JSON.stringify(details.amenities));
   return this.listProperties(user).find(p => p.id === Number(result.lastInsertRowid));
  },
  setAvailability(user,idValue,data){
   staff(user);const id=requestId(idValue);
   if(typeof data.available!=='boolean')fail('Choose whether the property is available.');
   const property=db.prepare('SELECT archived,is_preview FROM properties WHERE id=?').get(id);
   if(!property)fail('Property not found.',404);
   if(data.available&&property.is_preview)fail('Edit this showcase home and enter verified property details before publishing it.',409);
   if(data.available&&property.archived)fail('Restore this property before publishing it.',409);
   if(data.available&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leases'").get()&&db.prepare("SELECT id FROM leases WHERE property_id=? AND status='Active'").get(id))fail('A property with an active lease cannot be published as available.',409);
   const result=db.prepare('UPDATE properties SET available=? WHERE id=?').run(data.available?1:0,id);
   if(!result.changes)fail('Property not found.',404);
   return this.listProperties(user).find(p=>p.id===id);
  },
  editProperty(user,idValue,data){
   staff(user);const id=requestId(idValue),property=db.prepare('SELECT * FROM properties WHERE id=?').get(id);if(!property)fail('Property not found.',404);
   const name=text(data.name,'a property name',100),area=text(data.area,'a neighborhood',100),address=text(data.address,'an address',250);
   const price=number(data.price,'monthly rent',0,1000000),beds=number(data.beds,'bedroom count',0,50,true),baths=number(data.baths,'bathroom count',0.5,50),size=number(data.size,'square footage',1,1000000,true),image=number(data.image,'listing illustration',1,3,true);
   if(!['SINGLE-FAMILY HOME','APARTMENT','CONDO','TOWNHOUSE'].includes(data.type))fail('Choose a property type.');
   if(typeof data.available!=='boolean')fail('Choose whether the property is available.');
   const details=listingDetails({description:data.description??property.description,amenities:data.amenities??JSON.parse(property.amenities)});
   if(data.isPreview!==undefined&&typeof data.isPreview!=='boolean')fail('Choose a listing category.');
   const isPreview=data.isPreview===undefined?!!property.is_preview:data.isPreview;
   if(isPreview&&data.available)fail('Showcase homes cannot accept applications.',409);
   if(isPreview&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leases'").get()&&db.prepare("SELECT id FROM leases WHERE property_id=? AND status='Active'").get(id))fail('A property with an active lease cannot become a showcase home.',409);
   if(property.is_preview&&!isPreview&&address==='Address to be confirmed')fail('Enter the verified property address before converting this home.');
   db.exec('BEGIN IMMEDIATE');try{
    db.prepare('UPDATE properties SET is_preview=? WHERE id=?').run(isPreview?1:0,id);
    this.setAvailability(user,id,{available:data.available});
    db.prepare('UPDATE properties SET name=?,area=?,address=?,price=?,beds=?,baths=?,size=?,type=?,image=?,description=?,amenities=? WHERE id=?').run(name,area,address,price,beds,baths,size,data.type,image,details.description,JSON.stringify(details.amenities),id);db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   return this.listProperties(user).find(p=>p.id===id);
  },
  deleteProperty(user,idValue){
   staff(user);const id=requestId(idValue);if(!db.prepare('SELECT id FROM properties WHERE id=?').get(id))fail('Property not found.',404);
   for(const table of ['leases','applications','maintenance_requests','saved_homes']){
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)&&db.prepare('SELECT 1 FROM '+table+' WHERE property_id=? LIMIT 1').get(id))fail('This property has linked resident or application records. Archive it to preserve its history.',409);
   }
   db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM property_photos WHERE property_id=?').run(id);db.prepare('DELETE FROM properties WHERE id=?').run(id);db.exec('COMMIT');return {ok:true};}catch(error){db.exec('ROLLBACK');throw error;}
  },
  archiveProperty(user,idValue,data){
   staff(user);const id=requestId(idValue);if(typeof data.archived!=='boolean')fail('Choose an archive status.');
   if(data.archived&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leases'").get()&&db.prepare("SELECT id FROM leases WHERE property_id=? AND status='Active'").get(id))fail('End the active lease before archiving this property.',409);
   const result=db.prepare('UPDATE properties SET archived=?,available=0 WHERE id=?').run(data.archived?1:0,id);if(!result.changes)fail('Property not found.',404);return {ok:true};
  },
  listRequests(user) {
   return db.prepare(`SELECT r.*, u.name AS tenant_name, p.name AS property_name FROM maintenance_requests r
    JOIN users u ON u.id=r.tenant_id LEFT JOIN properties p ON p.id=r.property_id
    ${user.role === 'tenant' ? 'WHERE r.tenant_id=?' : ''} ORDER BY r.id DESC`).all(...(user.role === 'tenant' ? [user.id] : []));
  },
  addRequest(user, data) {
   if (user.role !== 'tenant') fail('Only tenants can submit maintenance requests.', 403);
   const title = text(data.title, 'an issue title', 100), description = text(data.description, 'a description', 2000), location = text(data.location, 'a property address and unit', 250);
   if (!categories.includes(data.category) || !priorities.includes(data.priority)) fail('Choose a category and priority.');
   let propertyId = null;
   if (data.propertyId !== undefined && data.propertyId !== null && data.propertyId !== '') {
    propertyId = number(data.propertyId, 'property', 1, Number.MAX_SAFE_INTEGER, true);
    if (!db.prepare('SELECT id FROM properties WHERE id=?').get(propertyId)) fail('Property not found.', 404);
   }
   const now = new Date().toISOString();
   const result = db.prepare('INSERT INTO maintenance_requests(tenant_id,property_id,location,title,description,category,priority,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(user.id,propertyId,location,title,description,data.category,data.priority,now,now);
   return getRequest(Number(result.lastInsertRowid));
  },
  updateRequest(user, idValue, data, cancel = false) {
   const id = requestId(idValue), row = getRequest(id);
   if (!cancel) staff(user);
   if (!row || (cancel && (user.role !== 'tenant' || row.tenant_id !== user.id))) fail('Request not found.', 404);
   if (cancel) {
    if (row.status !== 'Submitted') fail('Only submitted requests can be cancelled.', 409);
    db.prepare('UPDATE maintenance_requests SET status=?,updated_at=?,updated_by=? WHERE id=?').run('Cancelled',new Date().toISOString(),user.id,id);
   } else {
    if (!statuses.includes(data.status) || data.status === 'Cancelled') fail('Choose Submitted, In progress, or Completed.');
    if (row.status === 'Cancelled') fail('Cancelled requests cannot be updated.', 409);
    if (typeof data.note !== 'string' || data.note.trim().length > 2000) fail('Use a resident update of up to 2000 characters.');
    db.prepare('UPDATE maintenance_requests SET status=?,staff_note=?,updated_at=?,updated_by=? WHERE id=?').run(data.status,data.note.trim(),new Date().toISOString(),user.id,id);
   }
   return getRequest(id);
  }
 };
}
module.exports = {createManagement,fail,text,number,listingDTO};
