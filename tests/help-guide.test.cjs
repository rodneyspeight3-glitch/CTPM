const {test}=require('node:test'),assert=require('node:assert/strict');
const guide=require('../public/help-guide');
const properties=[{id:1,name:'Cedar Court',area:'Cedar District',address:'10 Cedar Street',price:1650,beds:2,agents:[{id:7,name:'Alex Agent',email:'public@example.test'}]},{id:2,name:'Garden Square',area:'Garden District',address:'40 Garden Lane',price:1750,beds:2,agents:[]},{id:3,name:'Studio Place',area:'Cedar District',price:1200,beds:0,agents:[]},{id:4,name:'Hidden home',price:1000,beds:2,available:false,agents:[]}];
test('built-in help searches actual public listings, budgets, studios and assigned agents without inventing availability',()=>{
 let reply=guide.answer('show 2 bedrooms under $1,700',{properties});assert.equal(reply.topic,'listings');assert.deepEqual(reply.listings.map(p=>p.id),[1]);assert.deepEqual(reply.listings[0].agents,['Alex Agent']);
 reply=guide.answer('studio under 1500',{properties});assert.deepEqual(reply.listings.map(p=>p.id),[3]);
 reply=guide.answer('Who manages Cedar Court?',{properties});assert.deepEqual(reply.listings.map(p=>p.id),[1]);
 reply=guide.answer('homes managed by Alex Agent',{properties});assert.deepEqual(reply.listings.map(p=>p.id),[1]);
 reply=guide.answer('show available homes',{properties});assert.equal(reply.listings.length,3);assert.ok(!reply.listings.some(p=>p.id===4));
 reply=guide.answer('7 bedrooms under $300',{properties});assert.deepEqual(reply.listings,[]);assert.match(reply.text,/No current public vacancies match/);
 reply=guide.answer('show homes',{properties,listingError:true});assert.match(reply.text,/could not be loaded/);assert.equal(reply.listings,undefined);
});
test('help matches current application requirements and routes private questions to the authorized portal',()=>{
 assert.deepEqual(guide.suggestions.map(question=>guide.answer(question,{properties}).topic),['listings','apply','documents','tracking','agents','contact']);
 const docs=guide.answer('rental history documents');assert.match(docs.text,/landlord name, phone and reason for leaving are required/);assert.match(docs.text,/other income and pet information are optional/);assert.match(docs.text,/2 MB/);assert.match(docs.text,/five files/);
 const status=guide.answer('is my application approved?');assert.equal(status.topic,'tracking');assert.ok(status.links.some(l=>l.path==='/application-status'));assert.doesNotMatch(status.text,/you are approved/i);
 const payment=guide.answer('my rent balance');assert.equal(payment.topic,'payments');assert.ok(payment.links.some(l=>l.path==='/dashboard#ledger'));
 const add=guide.answer('add property');assert.ok(add.links.every(l=>!/newProperty|add-property/.test(l.path)));assert.ok(add.links.some(l=>l.path==='/dashboard'));
 const emergency=guide.answer('I smell gas');assert.match(emergency.text,/local emergency services/);
});
test('help protects receipt secrets and uses only published management contact fields',()=>{
 for(const query of ['my password is example-password','my ssn 123-45-6789','https://ctpm.example/application-status#receipt='+'a'.repeat(64)])assert.equal(guide.answer(query).redact,true);
 assert.equal(guide.sensitive('How do I reset my password?'),false);
 const reply=guide.answer('contact management',{company:{contactEmail:'management@example.test',contactPhone:'+1 555 010 1234',paymentBankName:'PRIVATE BANK',paymentAccountDetails:'PRIVATE ACCOUNT'}});assert.ok(reply.links.some(l=>l.path==='mailto:management%40example.test'));assert.doesNotMatch(JSON.stringify(reply),/PRIVATE BANK|PRIVATE ACCOUNT/);
 const none=guide.answer('contact management');assert.match(none.text,/when management has configured/);assert.ok(!none.links.some(l=>/^mailto:/.test(l.path)));
});
