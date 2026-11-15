const {PDFDocument,rgb}=require('pdf-lib');
const {addPages}=require('./pdf');

const labels={income:'Proof of income',photo_id:'Government-issued photo ID',rental_history:'Rental history',additional:'Additional document'};
const supplied=value=>value===undefined||value===null||value===''?'Not supplied':String(value);
const yesNo=value=>value===true?'Yes':value===false?'No':'Not supplied';
const money=value=>Number.isSafeInteger(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100):'Not supplied';

function applicationLines(a,documents){
 const d=a.details||{},rows=(heading,fields)=>[heading,...fields.map(([label,value])=>label+': '+supplied(value)),''];
 return [
  'Come Together Property Management',
  'Private rental application | '+a.reference,
  ...rows('APPLICATION RECORD',[
   ['Property',a.property_name],['Address applied for',a.requested_address],['Status',a.status],
   ['Submitted (UTC)',a.created_at],['Last updated (UTC)',a.updated_at]
  ]),
  ...rows('PERSONAL INFORMATION',[
   ['Full name',a.name],['Email',a.email],['Phone number',a.phone],['Current address',d.currentAddress],
   ['Expected lease duration',d.leaseDuration],['Move-in date',a.move_in],
   ['Credit score (self-reported)',a.form_version<2?null:d.creditScore===null?'Unknown':d.creditScore],
   ['Could anything interrupt your ability to pay rent?',d.rentInterruption],['Persons living in unit',a.occupants]
  ]),
  ...(a.form_version>=2?[
   ...rows('EMPLOYMENT INFORMATION',[
    ['Current employer',d.employer],['Job title',d.jobTitle],['Monthly income',money(d.monthlyIncomeCents)],
    ['Length of employment',d.employmentLength],['Other sources of income',d.otherIncome]
   ]),
   ...rows('RENTAL HISTORY',[
    ['Current landlord name',d.landlordName],['Current landlord phone number',d.landlordPhone],['Reason for leaving',d.leavingReason]
   ]),
   ...rows('ADDITIONAL QUESTIONS',[
    ['Previously evicted',yesNo(d.evicted)],['Previously filed for bankruptcy',yesNo(d.bankruptcy)],
    ['Pets',yesNo(d.hasPets)],['Pet details',d.petDetails],['Smokes',yesNo(d.smokes)]
   ])
  ]:['This record predates the expanded application form. Additional answers were not collected.','']),
  ...rows('APPLICANT MESSAGE',[['Message',a.message]]),
  ...(a.form_version>=4?rows('SUBMISSION PREFERENCES',[
   ['Management contact permission','Confirmed at submission'],
   ['Application email updates',a.email_updates?'Requested':'Not requested']
  ]):[]),
  'SUPPORTING DOCUMENTS ('+documents.length+')',
  ...documents.map((doc,index)=>(index+1)+'. '+(labels[doc.kind]||doc.kind)+' | '+doc.name+' | Uploaded (UTC): '+doc.created_at),
  documents.length?'Supporting pages follow in the order listed. The original files are also attached inside this PDF.':'No supporting documents are currently stored.',
  'Private staff notes and review history are not part of the completed application.'
 ];
}

async function applicationPdf(application,documents){
 const pdf=await PDFDocument.create();
 pdf.setTitle('Rental application '+application.reference);
 pdf.setAuthor('Come Together Property Management');
 pdf.setSubject('Completed rental application and supporting documents');
 await addPages(pdf,'Rental application',applicationLines(application,documents),{headings:[
  'APPLICATION RECORD','PERSONAL INFORMATION','EMPLOYMENT INFORMATION','RENTAL HISTORY',
  'ADDITIONAL QUESTIONS','APPLICANT MESSAGE','SUBMISSION PREFERENCES','SUPPORTING DOCUMENTS ('+documents.length+')'
 ]});
 let supportingPages=0,rasterPixels=0;
 for(const [index,doc]of documents.entries()){
  const kind=labels[doc.kind]||doc.kind;
  const filename=String(index+1).padStart(2,'0')+'-'+doc.name.replace(/[\/\\\x00-\x1f\x7f]/g,'-');
  await pdf.attach(doc.data,filename,{mimeType:doc.mime,description:kind+' | Original filename: '+doc.name});
  let source,image,notice='';
  try{
   if(doc.mime==='application/pdf'){
    source=await PDFDocument.load(doc.data,{throwOnInvalidObject:true});
    const count=source.getPageCount();
    if(!count)throw Error('No pages');
    if(supportingPages+count>500)notice='This document exceeds the combined preview page limit. Its complete original file is attached inside this PDF.';
    else source.getForm().flatten();
   }else if(doc.mime==='image/png'){
    const header=Buffer.from(doc.data),width=header.readUInt32BE(16),height=header.readUInt32BE(20);
    if(!width||!height)throw Error('Invalid image dimensions');
    if(rasterPixels+width*height>20000000)notice='This image exceeds the combined image preview size limit. Its complete original file is attached inside this PDF.';
    else{rasterPixels+=width*height;image=await pdf.embedPng(doc.data);}
   }
   else if(doc.mime==='image/jpeg')image=await pdf.embedJpg(doc.data);
   else throw Error('Unsupported preview');
  }catch{
   notice='This document could not be displayed as PDF pages. It may be password-protected or unreadable. Its original file is attached inside this PDF; use a PDF reader that supports file attachments to open it.';
  }
  let pages;
  if(source&&!notice)try{pages=await pdf.copyPages(source,source.getPageIndices());}catch{
   notice='This document could not be copied as PDF pages. Its original file is attached inside this PDF; use a PDF reader that supports file attachments to open it.';
  }
  await addPages(pdf,'Supporting document '+(index+1)+' | '+kind,[
   'Application: '+application.reference,
   'Applicant: '+application.name,
   'Original filename: '+doc.name,
   'Uploaded (UTC): '+doc.created_at,
   'Attached original: '+filename,
   notice||'The document pages follow. Original page sizes are preserved; photo documents are fitted to the page.'
  ]);
  if(notice)continue;
  if(pages){for(const page of pages)pdf.addPage(page);supportingPages+=pages.length;}
  else if(image){
   const page=pdf.addPage([612,792]),size=image.scaleToFit(528,708);
   page.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(1,1,1)});
   page.drawImage(image,{x:(612-size.width)/2,y:(792-size.height)/2,width:size.width,height:size.height});
   supportingPages++;
  }
 }
 return Buffer.from(await pdf.save());
}

module.exports={applicationPdf};
