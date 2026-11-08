/* Shared public status vocabulary. Decisions are recorded by staff, never inferred. */
((root,factory)=>{const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.ApplicationStates=value;})(globalThis,()=>{
 const all=Object.freeze(['Submitted','Reviewing','Contacted','Approved','Rejected','Closed','Withdrawn']);
 const open=Object.freeze(['Submitted','Reviewing','Contacted']);
 const decisions=Object.freeze(['Approved','Rejected']);
 const descriptions=Object.freeze({
  Submitted:'Management has received the application and has not recorded a decision yet.',
  Reviewing:'Management is reviewing the application and may request more information.',
  Contacted:'Management recorded a contact update. Check your supplied contact details and private portal.',
  Approved:'Management approved this application. Contact the team to confirm availability and next steps. Approval alone does not reserve a home or activate a lease. Management reviews the lease draft before sending it for signing.',
  Rejected:'Management rejected this application. Contact the team if you have questions about the decision.',
  Closed:'Management closed the review. This status alone does not mean approval or rejection; contact the team for the outcome.',
  Withdrawn:'This application was withdrawn. The submitted record is retained.'
 });
 return Object.freeze({all,open,isOpen:status=>open.includes(status),isDecision:status=>decisions.includes(status),description:status=>descriptions[status]||'Management updates your application status. Contact the team with questions.'});
});
