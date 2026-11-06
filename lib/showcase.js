const homes=[
 {name:'The Willow House',area:'Willow Creek',price:1850,beds:3,baths:2,size:1480,type:'SINGLE-FAMILY HOME',image:1,description:'A showcase of relaxed family living, with generous gathering spaces and a bright, welcoming layout.',amenities:['Outdoor space','Spacious living area','Family layout']},
 {name:'Parkside Residences',area:'Parkside District',price:1450,beds:2,baths:2,size:1120,type:'APARTMENT',image:2,description:'A thoughtfully arranged apartment concept with comfortable shared spaces and room for everyday routines.',amenities:['Open living area','Two bathrooms','Flexible workspace']},
 {name:'The Oakwood',area:'Oakwood Heights',price:1250,beds:1,baths:1,size:820,type:'APARTMENT',image:3,description:'An inviting one-bedroom showcase designed around a simpler, connected everyday.',amenities:['One-bedroom layout','Comfortable living space','Dining area']},
 {name:'Maple Row Townhomes',area:'Maple Row',price:2100,beds:3,baths:2.5,size:1650,type:'TOWNHOUSE',image:2,description:'A townhouse concept balancing private rooms with generous spaces to come together.',amenities:['Multi-level layout','Guest bathroom','Separate bedrooms']},
 {name:'Cedar Garden Studio',area:'Cedar Garden',price:1050,beds:0,baths:1,size:540,type:'APARTMENT',image:3,description:'A compact studio showcase with a flexible layout for living, working, and unwinding.',amenities:['Studio layout','Flexible living space','Compact footprint']},
 {name:'Riverstone Family Home',area:'Riverstone',price:2450,beds:4,baths:3,size:2100,type:'SINGLE-FAMILY HOME',image:1,description:'A spacious home concept with room for shared moments and individual retreats.',amenities:['Four-bedroom layout','Multiple bathrooms','Large living area']}
];
function seedShowcase(db){
 db.exec('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');
 if(process.env.SEED_SHOWCASE_PROPERTIES==='0')return;
 const admin=db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();if(!admin)return;
 db.exec('BEGIN IMMEDIATE');try{
  if(!db.prepare('SELECT name FROM app_migrations WHERE name=?').get('showcase-inventory-v1')){
   const insert=db.prepare('INSERT INTO properties(name,area,address,price,beds,baths,size,type,image,created_by,created_at,available,archived,is_preview,description,amenities) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,0,1,?,?)');
   for(const h of homes)if(!db.prepare('SELECT id FROM properties WHERE name=?').get(h.name))insert.run(h.name,h.area,'Address to be confirmed',h.price,h.beds,h.baths,h.size,h.type,h.image,admin.id,new Date().toISOString(),h.description,JSON.stringify(h.amenities));
   db.prepare('INSERT INTO app_migrations VALUES(?,?)').run('showcase-inventory-v1',new Date().toISOString());
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
module.exports={seedShowcase};
