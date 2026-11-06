const {publicOrigin}=require('./service-utils');
const automatedSenderName='Come Together Property Management (No Reply)';
const automatedHeaders=Object.freeze({'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'});
function automatedText(value){
 const origin=publicOrigin(),footer='This is an automated message. Please do not reply to this email.\n'+(origin?'For assistance, send management a message in your portal:\n'+origin+'/dashboard#messages\n\nIf you cannot sign in, find management contact options here:\n'+origin+'/#contact':'For assistance, contact management through the website or your resident portal.');
 const text=String(value??'').trimEnd();return text.endsWith(footer)?text:text+'\n\n---\n'+footer;
}
function automatedFrom(raw){
 const value=String(raw||'').trim(),match=value.match(/^[^<>]*<([^<>]+)>$/),address=match?match[1]:value;
 if(!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(address))throw Error('A valid authorized sender is required.');
 return '"'+automatedSenderName+'" <'+address+'>';
}
module.exports={automatedSenderName,automatedHeaders,automatedText,automatedFrom};
