const {fail,text,number}=require('./management');
const documentKinds=['income','photo_id','rental_history','additional'];
function optional(value,label,max){if(value===undefined)value='';if(typeof value!=='string'||value.trim().length>max)fail(`Use ${label} of up to ${max} characters.`);return value.trim();}
function validateRentalDetails(input){
 const fields={currentAddress:250,leaseDuration:100,rentInterruption:1000,employer:150,jobTitle:100,employmentLength:100,landlordName:100,landlordPhone:40,leavingReason:1000};
 const labels={currentAddress:'your current address',leaseDuration:'your expected lease duration',rentInterruption:'an answer about rent payment interruptions',employer:'your current employer or N/A',jobTitle:'your job title or N/A',employmentLength:'your length of employment or N/A',landlordName:'your current landlord or N/A',landlordPhone:'your landlord’s phone number or N/A',leavingReason:'your reason for leaving or N/A'};
 const details={};for(const [key,max] of Object.entries(fields))details[key]=text(input[key],labels[key],max);
 if(!/^(n\/?a|not applicable|first rental)$/i.test(details.landlordPhone)&&(!/^\+?[\d () .-]{7,40}$/.test(details.landlordPhone)||details.landlordPhone.replace(/\D/g,'').length<7))fail('Enter a valid landlord phone number or N/A.');
 details.creditScore=input.creditScoreUnknown===true?null:number(input.creditScore,'self-reported credit score',300,850,true);
 const income=number(input.monthlyIncome,'monthly income',0,1000000),cents=Math.round(income*100);if(Math.abs(income*100-cents)>0.00001)fail('Use at most two decimal places for monthly income.');details.monthlyIncomeCents=cents;
 details.otherIncome=optional(input.otherIncome,'other income information',1000);
 for(const key of ['evicted','bankruptcy','hasPets','smokes']){if(typeof input[key]!=='boolean')fail('Answer each Yes / No question.');details[key]=input[key];}
 details.petDetails=details.hasPets?text(input.petDetails,'your pet details',1000):'';
 return details;
}
function validateApplicationDocuments(input){
 if(!Array.isArray(input)||input.length<2||input.length>5)fail('Upload proof of income and a photo ID. Use up to five files in total.');
 const documents=input.map(file=>{
  if(!file||typeof file!=='object'||!documentKinds.includes(file.kind))fail('Choose a valid supporting-document category.');
  const name=text(file.name,'a document name',120);
  if(/[\x00-\x1F\x7F]/.test(name)||!['application/pdf','image/jpeg','image/png'].includes(file.mime)||typeof file.data!=='string'||!file.data||file.data.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.data))fail('Upload PDF, JPEG, or PNG files up to 2 MB each.');
  const data=Buffer.from(file.data,'base64');
  const matches=file.mime==='application/pdf'?data.subarray(0,5).toString()==='%PDF-':file.mime==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data[0]===255&&data[1]===216&&data[2]===255;
  if(data.length<12||data.length>2097152||!matches)fail('Each supporting document must be a valid PDF, JPEG, or PNG up to 2 MB.');
  return {name,kind:file.kind,mime:file.mime,data};
 });
 if(!documents.some(d=>d.kind==='income')||!documents.some(d=>d.kind==='photo_id'))fail('Include at least one proof of income and one government-issued photo ID.');
 return documents;
}
module.exports={validateRentalDetails,validateApplicationDocuments};
