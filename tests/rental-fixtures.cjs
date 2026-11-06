const pdf=Buffer.from('%PDF-1.4\nTEST DOCUMENT ONLY — NO PERSONAL INFORMATION\n%%EOF');
function rentalApplication(overrides={}){
 return {name:'Test Applicant',email:'applicant@example.test',phone:'202-555-0123',currentAddress:'100 Test Avenue',leaseDuration:'12 months',moveIn:'2099-01-15',creditScore:700,creditScoreUnknown:false,rentInterruption:'No known interruptions',occupants:2,employer:'Example Employer',jobTitle:'Coordinator',monthlyIncome:4500.25,employmentLength:'2 years',otherIncome:'',landlordName:'Example Landlord',landlordPhone:'202-555-0111',leavingReason:'Moving closer to work',evicted:false,bankruptcy:false,hasPets:false,petDetails:'',smokes:false,message:'Interested in this home.',consent:true,documents:[{kind:'income',name:'test-income.pdf',mime:'application/pdf',data:pdf.toString('base64')},{kind:'photo_id',name:'test-photo-id.pdf',mime:'application/pdf',data:pdf.toString('base64')}],...overrides};
}
async function fillRentalApplication(page,overrides={}){
 const data=rentalApplication(overrides),form=page.locator('#vacancy-application-form');
 for(const key of ['name','email','phone','currentAddress','leaseDuration','moveIn','rentInterruption','occupants','employer','jobTitle','monthlyIncome','employmentLength','otherIncome','landlordName','landlordPhone','leavingReason','message'])await form.locator('[name="'+key+'"]').fill(String(data[key]));
 await form.locator('[name="creditScore"]').fill(String(data.creditScore));
 for(const key of ['evicted','bankruptcy','smokes'])await form.locator('[name="'+key+'"]').selectOption(String(data[key]));
 await form.locator('[name="hasPets"]').selectOption(data.hasPets==null?'':String(data.hasPets));await form.locator('[name="petDetails"]').fill(data.petDetails||'');
 for(const [name,kind] of [['incomeProof','income'],['photoId','photo_id']])await form.locator('[name="'+name+'"]').setInputFiles({name:data.documents.find(d=>d.kind===kind).name,mimeType:'application/pdf',buffer:pdf});
 await form.locator('[name="consent"]').check();
}
module.exports={rentalApplication,fillRentalApplication,pdf};
