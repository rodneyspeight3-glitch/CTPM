const test=require('node:test'),assert=require('node:assert/strict'),C=require('../public/studio-core.js');
const piece=extra=>({id:'piece-1',kind:'desk',label:'Desk',width:4,depth:2,x:0,y:0,rotated:false,...extra});
test('room plans enforce finite geometry, limits and a clean import schema',()=>{
 const p={...C.empty(),name:'<img src=x onerror=alert(1)>',items:[piece()]};assert.deepEqual(C.validate({...p,password:'discarded'}),p);
 for(const bad of [{...p,width:NaN},{...p,depth:61},{...p,version:2},{...p,items:[piece({width:100})]},{...p,items:[piece({x:15})]},{...p,items:[piece(),piece()]},{...p,style:'__proto__'},{...p,items:[piece({id:'bad"id'})]},{...p,items:Array.from({length:25},(_,i)=>piece({id:'piece-'+i}))}])assert.throws(()=>C.validate(bad));
 assert.equal(C.validate({...p,items:[piece({kind:'queen',width:5,depth:6.67,rotated:true})]}).items[0].rotated,true);
});
test('moving pieces stays inside the room; overlap checking accounts for rotation and rugs',()=>{
 const plan={...C.empty(),items:[piece(),piece({id:'piece-2',x:3})]};assert.equal(C.overlaps(plan).length,1);plan.items[1].x=4;assert.equal(C.overlaps(plan).length,0);plan.items[1].x=3;plan.items[0].rotated=true;assert.equal(C.overlaps(plan).length,0);plan.items[0].rotated=false;plan.items[1].kind='rug';assert.equal(C.overlaps(plan).length,0);
 assert.deepEqual(C.position(plan,piece(),-7,100),{x:0,y:10});assert.deepEqual(C.position(plan,piece(),1.3,2.2,true),{x:1.5,y:2});
});
test('downloaded room SVG escapes user labels and includes verified dimensions',()=>{
 const p={...C.empty(),name:'Room <script>alert(1)</script>',items:[piece({label:'Desk & <img onerror=x>'})]},svg=C.svg(p);assert.ok(svg.includes('Room &lt;script&gt;'));assert.ok(svg.includes('Desk &amp; &lt;img'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('16.00 × 12.00 ft'));assert.throws(()=>C.svg({...p,items:[piece({x:60})]}));
});
test('packing batches have bounded sequential numbers and retain plain content',()=>{
 const input={room:'Kitchen',contents:'Plates & mugs',note:'First night',start:8,count:3,color:'lilac',fragile:true};assert.deepEqual(C.labels(input).map(x=>x.number),[8,9,10]);assert.equal(C.labels(input)[0].contents,input.contents);
 for(const bad of [{...input,room:''},{...input,count:31},{...input,start:9999},{...input,count:1.5},{...input,color:'bad'},{...input,fragile:'yes'},{...input,contents:'x'.repeat(301)}])assert.throws(()=>C.labels(bad));
});
