const {staff,fail,rateLimit}=require('./service-utils');
function createEmailWriting(db,{env=process.env,request=fetch}={}){
 function authorize(user){staff(user);if(!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(user.id))fail('Staff access changed. Sign in again.',403);}
 function configuration(){const model=env.GEMINI_MODEL||'gemini-3.5-flash-lite';return {enabled:env.GEMINI_ENABLED!=='false'&&!!env.GEMINI_API_KEY?.trim()&&/^[a-z0-9.-]{1,80}$/i.test(model),model};}
 function status(user){authorize(user);const c=configuration();return {provider:'Google Gemini',configured:c.enabled,model:c.model,dailySuggestions:20};}
 async function suggest(user,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter writing instructions.');
  authorize(user);if(typeof input.brief!=='string'||input.brief.trim().length<5||input.brief.length>1200)fail('Describe your email in 5–1,200 characters.');if(!['Warm','Professional','Concise'].includes(input.tone))fail('Choose a writing tone.');
  const c=configuration();if(!c.enabled)fail('Gemini is not connected yet. An administrator can save GEMINI_API_KEY privately in Render. You can write and send your own email now.',503);
  rateLimit(db,'email-ai-user',user.id,20,86400000);rateLimit(db,'email-ai-installation','all',100,86400000);
  const payload={systemInstruction:{parts:[{text:'Write a plain-text property-management email for Come Together Property Management. Use only the topic and instructions provided. Do not invent dates, fees, repairs, approval decisions, lease terms or legal claims. Do not add recipient addresses or private links. Return only JSON with a subject and body. The user will review and edit it; never claim that any email was sent. Do not add a no-reply footer; the portal adds one.'}]},contents:[{role:'user',parts:[{text:'Tone: '+input.tone+'\nEmail instructions: '+input.brief.trim()}]}],generationConfig:{temperature:0.6,maxOutputTokens:4096,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{subject:{type:'STRING'},body:{type:'STRING'}},required:['subject','body']}}};
  let response;try{response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+c.model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY.trim()},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});}catch{fail('The writing assistant could not be reached. Try again or write your message manually.',503);}
  if(response.status===429)fail('Gemini’s request limit was reached. Try later or write your message manually.',429);if(!response.ok)fail('Gemini could not create a suggestion. An administrator may need to check the API key and model in Render.',503);
  let draft;try{const result=await response.json(),text=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');draft=JSON.parse(text);if(typeof draft.subject!=='string'||!draft.subject.trim()||draft.subject.length>150||/[\r\n\x00]/.test(draft.subject)||typeof draft.body!=='string'||!draft.body.trim()||draft.body.length>10000||draft.body.includes('\0'))throw Error();}catch{fail('Gemini returned an incomplete draft. Try again or write your message manually.',502);}
  authorize(user);return {subject:draft.subject.trim(),message:draft.body.trim(),provider:'Google Gemini'};
 }
 return {status,suggest};
}
module.exports={createEmailWriting};
