// One schema drives validation and the staff editors. No records are seeded.
const field=(key,label,type='text',options={})=>({key,label,type,...options});
const select=(key,label,options)=>field(key,label,'select',{options});
const date=(key,label)=>field(key,label,'date');
const amount=(key,label)=>field(key,label,'number',{min:0,max:10000000,step:0.01});
const board=(id,title,singular,description,statuses,fields,checklist)=>({id,title,singular,description,statuses,closed:statuses.filter(s=>['Completed','Returned','Lost','Retired','Declined','Received','Cancelled','Stopped','Rejected','Accepted'].includes(s)),fields,checklist});
const catalog=[
 board('inspections','Inspections','Inspection','Plan walkthroughs and record observations. Findings are management records, not a compliance certification.', ['Scheduled','In progress','Follow-up','Completed'],[
  select('inspectionType','Walkthrough type',['Routine','Move-in','Move-out']),field('area','Room or area'),select('condition','Overall condition',['To review','Good','Monitor','Needs repair']),date('followUpOn','Follow-up date'),field('findings','Findings','textarea')
 ],['Entry and doors','Windows and ventilation','Kitchen and appliances','Bathroom and plumbing','Floors and surfaces','Record follow-up actions']),
 board('keys','Key custody','Key record','Track physical key labels and custody. Do not store lock combinations, alarm codes or passwords.', ['Available','Checked out','Returned','Lost'],[
  select('keyType','Item type',['Key','Fob','Remote']),field('quantity','Quantity','number',{min:1,max:10000,step:1,required:true}),field('holder','Current or last holder'),date('checkedOutOn','Checked out on'),date('returnedOn','Returned on'),field('location','Storage / handover location')
 ],['Confirm item labels','Count items','Record the holder','Confirm return arrangements','Check returned items']),
 board('assets','Appliances & assets','Asset','Keep equipment records, warranty dates and service plans together.', ['Active','Service due','Repair','Retired'],[
  select('assetType','Asset type',['Refrigerator','Range','Washer','Dryer','HVAC','Other']),field('serial','Serial / asset reference'),field('location','Room or location'),date('purchasedOn','Purchased on'),amount('purchasePrice','Purchase price ($)'),date('warrantyEnds','Warranty ends'),date('nextService','Next service date'),select('condition','Condition',['Good','Monitor','Needs repair','Retired'])
 ],['Record equipment identification','Keep the manual reference','Check installation condition','Record warranty dates','Plan the next service']),
 board('safety','Safety check plans','Safety check','Schedule checks and follow-up. These records do not certify compliance or dispatch emergency services.', ['Scheduled','In progress','Follow-up','Completed'],[
  select('checkType','Check type',['Smoke alarm','CO alarm','Extinguisher','General walkthrough']),date('checkedOn','Checked on'),date('nextCheck','Next planned check'),select('result','Recorded result',['Pending','No issue noted','Follow-up needed']),field('findings','Observations','textarea')
 ],['Confirm the equipment and location','Follow the manufacturer instructions','Record visible condition','Record the check outcome','Assign any follow-up']),
 board('move-in','Move-in plans','Move-in plan','Coordinate an existing lease and handover. A plan does not create a lease or reserve a home.', ['Planning','Preparing','Ready','Completed','Cancelled'],[
  field('resident','Resident / household reference'),date('moveDate','Planned move-in date'),select('utilities','Utility arrangements',['To arrange','Contacted','Confirmed']),select('keys','Key handover',['To arrange','Scheduled','Completed']),select('walkthrough','Condition walkthrough',['To arrange','Scheduled','Completed']),field('arrangements','Handover arrangements','textarea')
 ],['Confirm the signed lease arrangements','Confirm access and key pickup','Review utility responsibilities','Arrange the condition walkthrough','Share resident portal guidance','Confirm handover completion']),
 board('move-out','Move-out plans','Move-out plan','Coordinate a resident’s departure and record condition. Charges and deposit decisions stay in your normal lease process.', ['Planning','Preparing','Walkthrough','Completed','Cancelled'],[
  field('resident','Resident / household reference'),date('moveDate','Planned move-out date'),date('walkthroughOn','Final walkthrough date'),select('keys','Key return',['To arrange','Scheduled','Completed']),select('utilities','Utility handover',['To arrange','Contacted','Confirmed']),field('conditionNotes','Condition notes','textarea')
 ],['Confirm lease notice arrangements','Schedule the final walkthrough','Confirm key return','Review utility handover','Record condition observations','Review remaining lease records']),
 board('quotes','Procurement quotes','Quote','Record and compare internal quotes. Accepting a record does not send an order or create a payment.', ['Requested','Received','Shortlisted','Accepted','Declined'],[
  field('provider','Provider name'),field('scope','Work / supply scope','textarea'),field('quantity','Quantity','number',{min:1,max:10000,step:1,required:true}),amount('unitCost','Unit price ($)'),amount('tax','Tax estimate ($)'),amount('delivery','Delivery estimate ($)'),date('expiresOn','Quote expires'),field('reference','Provider reference')
 ],['Confirm the scope','Confirm quantities','Review the price and tax','Check validity dates','Record the management decision']),
 board('orders','Purchase requests','Purchase request','Prepare internal purchase requests. Only administrators can approve or reject; no order or payment is sent.', ['Draft','Requested','Approved','Rejected','Received','Cancelled'],[
  field('provider','Provider name'),field('scope','Items / scope','textarea'),field('quantity','Quantity','number',{min:1,max:10000,step:1,required:true}),amount('unitCost','Unit cost ($)'),amount('tax','Tax estimate ($)'),amount('delivery','Delivery estimate ($)'),field('reference','Internal reference'),date('expectedOn','Expected receipt date')
 ],['Confirm the need','Confirm the scope and quantity','Review the estimated total','Request administrator approval','Record receipt of the items']),
 board('projects','Property projects','Project','Track planned improvements, checklists and recorded estimates without changing your financial ledger.', ['Planning','In progress','On hold','Completed','Cancelled'],[
  select('phase','Project phase',['Planning','Preparing','Work underway','Final review','Complete']),date('startsOn','Planned start'),date('targetEnd','Target finish'),amount('budget','Budget estimate ($)'),amount('actualCost','Recorded cost ($)'),field('scope','Project scope','textarea')
 ],['Confirm the scope','Confirm the budget estimate','Arrange the work','Review progress','Complete the final walkthrough']),
 board('utilities','Utility coordination','Utility record','Organize provider arrangements and readings. Do not store account login details; this does not connect to utility companies.', ['To arrange','Contacted','Confirmed','Stopped'],[
  select('serviceType','Service type',['Water','Electricity','Gas','Internet','Trash','Other']),field('provider','Provider name'),select('responsibility','Responsibility to confirm',['Owner','Resident','Confirm with management']),date('startsOn','Service starts'),date('stopsOn','Service stops'),amount('monthlyEstimate','Monthly estimate ($)'),field('meterReading','Meter reading','number',{min:0,max:1000000000,step:0.001}),date('readingOn','Reading date')
 ],['Confirm responsibility under the lease','Confirm the provider','Arrange the service dates','Record the meter reading if applicable','Confirm the handover'])
];
module.exports={catalog};
