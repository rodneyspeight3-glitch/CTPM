const {staff,fail,rateLimit}=require('./service-utils');
function createGemini(db,{env=process.env,request=fetch}={}){
 function authorize(user){staff(user);if(!db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(user.id))fail('Staff access changed. Sign in again.',403);}
 function config(){const model=env.GEMINI_MODEL||'gemini-3.5-flash-lite';return {enabled:env.GEMINI_ENABLED!=='false'&&!!env.GEMINI_API_KEY?.trim()&&/^[a-z0-9.-]{1,80}$/i.test(model),model};}
 function status(user){authorize(user);const c=config();return {provider:'Google Gemini',configured:c.enabled,model:c.model,dailySuggestions:20};}
 async function generate(user,{system,prompt,schema}){
  authorize(user);const c=config();if(!c.enabled)fail('Gemini is not connected yet. An administrator can save GEMINI_API_KEY privately in Render. Manual editing remains available.',503);
  // All staff AI tools share the email writer's free-tier budget.
  rateLimit(db,'email-ai-user',user.id,20,86400000);rateLimit(db,'email-ai-installation','all',100,86400000);
  const payload={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.6,maxOutputTokens:4096,responseMimeType:'application/json',responseSchema:schema}};
  let response;try{response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+c.model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY.trim()},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});}catch{fail('The writing assistant could not be reached. Try again or write your message manually.',503);}
  if(response.status===429)fail('Gemini’s request limit was reached. Try later or write your message manually.',429);if(!response.ok)fail('Gemini could not create a suggestion. An administrator may need to check the API key and model in Render.',503);
  let result;try{const data=await response.json();result=JSON.parse(data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(''));if(!result||typeof result!=='object'||Array.isArray(result))throw Error();}catch{fail('Gemini returned an incomplete draft. Try again or write your message manually.',502);}
  authorize(user);return result;
 }
 return {authorize,status,generate};
}
module.exports={createGemini};
