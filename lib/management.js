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
 const staff = user => { if (!['agent', 'admin'].includes(user.role)) fail('Agent or administrator access is required.', 403); };
 const requestId = value => { const id = Number(value); if (!Number.isSafeInteger(id) || id < 1) fail('Request not found.', 404); return id; };
 const getRequest = id => db.prepare(`SELECT r.*, u.name AS tenant_name, p.name AS property_name
  FROM maintenance_requests r JOIN users u ON u.id=r.tenant_id LEFT JOIN properties p ON p.id=r.property_id WHERE r.id=?`).get(id);
 return {
  listProperties: () => db.prepare('SELECT id,name,area,address,price,beds,baths,size,type,image,created_at FROM properties ORDER BY id DESC').all(),
  addProperty(user, data) {
   staff(user);
   const name = text(data.name, 'a property name', 100), area = text(data.area, 'a neighborhood', 100), address = text(data.address, 'an address', 250);
   const price = number(data.price, 'monthly rent', 0, 1000000), beds = number(data.beds, 'bedroom count', 0, 50, true), baths = number(data.baths, 'bathroom count', 0.5, 50), size = number(data.size, 'square footage', 1, 1000000, true);
   if (!['SINGLE-FAMILY HOME', 'APARTMENT', 'CONDO', 'TOWNHOUSE'].includes(data.type)) fail('Choose a property type.');
   const image = number(data.image, 'listing illustration', 1, 3, true);
   const result = db.prepare('INSERT INTO properties(name,area,address,price,beds,baths,size,type,image,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(name,area,address,price,beds,baths,size,data.type,image,user.id,new Date().toISOString());
   return this.listProperties().find(p => p.id === Number(result.lastInsertRowid));
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
module.exports = {createManagement};
