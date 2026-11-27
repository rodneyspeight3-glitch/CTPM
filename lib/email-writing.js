const {createGemini}=require('./gemini');
const {fail}=require('./service-utils');
function createEmailWriting(db,options={}){
 const gemini=createGemini(db,options);
 async function suggest(user,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter writing instructions.');gemini.authorize(user);
  if(typeof input.brief!=='string'||input.brief.trim().length<5||input.brief.length>1200)fail('Describe your email in 5–1,200 characters.');if(!['Warm','Professional','Concise'].includes(input.tone))fail('Choose a writing tone.');
  const draft=await gemini.generate(user,{system:'Write a plain-text property-management email for Come Together Property Management. Use only the topic and instructions provided. Do not invent dates, fees, repairs, approval decisions, lease terms or legal claims. Do not add recipient addresses or private links. Return only JSON with a subject and body. The user will review and edit it; never claim that any email was sent. Do not add a no-reply footer; the portal adds one.',prompt:'Tone: '+input.tone+'\nEmail instructions: '+input.brief.trim(),schema:{type:'OBJECT',properties:{subject:{type:'STRING'},body:{type:'STRING'}},required:['subject','body']}});
  if(typeof draft.subject!=='string'||!draft.subject.trim()||draft.subject.length>150||/[\r\n\x00]/.test(draft.subject)||typeof draft.body!=='string'||!draft.body.trim()||draft.body.length>10000||draft.body.includes('\0'))fail('Gemini returned an incomplete draft. Try again or write your message manually.',502);
  return {subject:draft.subject.trim(),message:draft.body.trim(),provider:'Google Gemini'};
 }
 return {status:gemini.status,suggest};
}
module.exports={createEmailWriting};
