const {fail}=require('./service-utils');
const california=require('./company-lease-template');
const jurisdictions=Object.entries({AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'}).map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
function jurisdiction(value='CA'){const state=jurisdictions.find(s=>s.code===value);if(!state)fail('Choose one of the 50 U.S. states or the District of Columbia.');return state;}
function inferState(address){const match=String(address||'').trim().match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?$/i);return jurisdictions.some(s=>s.code===match?.[1].toUpperCase())?match[1].toUpperCase():'CA';}
function sourceTemplate(value){const state=jurisdiction(value);if(state.code==='CA')return {...california,stateCode:'CA'};
 return {stateCode:state.code,title:'Residential lease agreement — '+state.name,source:'Editable national starter for '+state.name+'; company review and state/local terms required',body:`RESIDENTIAL LEASE AGREEMENT — {{stateName}}

1. PARTIES AND AGREEMENT DATE
This Lease is dated {{agreementDate}}, between {{managerName}} (Landlord / authorized manager) and {{tenantName}} (Tenant). Tenant email: {{tenantEmail}}. Tenant phone: {{tenantPhone}}.

2. PREMISES
The residential premises are {{propertyAddress}}. The parties' occupancy arrangements and any property rules are set out in the state/local terms and attached disclosures below.

3. TENANCY
{{tenancyTerms}}

4. RENT
Monthly rent is {{monthlyRent}}, due on day {{paymentDay}} of each month. Payment instructions: {{paymentInstructions}}. Any fees, grace periods, rent-increase procedures and other move-in amounts must be expressly set out in the state/local terms and comply with applicable law.

5. SECURITY DEPOSIT
The agreed security deposit is {{deposit}}. Applicable state/local requirements and the agreed handling, permitted deductions, required statements, interest and return deadline must be set out in the state/local terms below. The deposit amount and handling are subject to applicable law.

6. PARKING
{{parkingTerms}}

7. HOUSEHOLD, PETS AND PROPERTY RULES
Occupants, guest arrangements, pet provisions, assistance-animal accommodations, smoking rules and any other agreed rules must be set out in the state/local terms and applicable addenda. No fee or restriction is created by this paragraph alone.

8. UTILITIES AND SERVICES
The state/local terms below identify the utilities and services paid by each party, and any allocation or billing terms.

9. CONDITION, REPAIRS AND ACCESS
The parties will document the premises' condition and comply with applicable habitability, repair, safety and access requirements. Responsibility for maintenance, repair requests, required notice before entry and emergency access must be set out in the state/local terms.

10. NOTICES
Management notice contact: {{noticeContactName}}, phone {{managerPhone}}. Required written notice addresses, service methods, statutory time periods and any renewal or termination procedures must be set out in the state/local terms. A portal renewal-review date does not terminate a periodic tenancy.

11. DISCLOSURES AND ADDENDA
Provide all applicable state, local and federal disclosures and required attachments. For housing subject to federal lead-based paint disclosure requirements, provide the required disclosure, records and pamphlet before execution. State/local terms and disclosure/addendum list:
{{stateSpecificTerms}}

12. INSURANCE AND LIABILITY
Any agreed insurance responsibilities, coverage or liability terms must be expressly stated in the state/local terms, subject to applicable law.

13. TRANSFER AND SUBLETTING
Any agreed assignment, subletting or occupancy-transfer provisions must be expressly stated in the state/local terms and comply with applicable law.

14. DEFAULT, DISPUTES AND END OF TENANCY
The state/local terms specify any agreed lawful remedies, dispute procedures, attorney-fee provisions, surrender requirements and renewal or termination arrangements. Required legal notices and procedures remain applicable.

15. DEPOSIT RETURN CONTACT
Forwarding / deposit return address: {{forwardingAddress}}, or another address the Tenant supplies in writing in accordance with applicable law.

16. ADDITIONAL AGREEMENT TERMS
{{additionalTerms}}

17. GOVERNING LAW AND CHANGES
The laws of {{stateName}} and applicable local and federal law govern this Lease. Required law controls any conflicting provision. Any amendment must be recorded in writing and accepted by the parties as required by law.

18. SIGNATURES
Landlord / authorized manager: {{managerName}}
Signature: ____________________  Date: __________
Tenant: {{tenantName}}
Signature: ____________________  Date: __________
An in-app applicant or resident signature is retained on an appended signature record. Management signatures are supplied separately.`};
}
module.exports={jurisdictions,jurisdiction,inferState,sourceTemplate};
