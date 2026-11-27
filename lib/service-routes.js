const {fail,admin}=require('./service-utils');
function createServiceRoutes({smtpSettings,accounts,notices,resident,finance,signatures,experience,agents,body,rawBody,json}){
 const send=(res,data,status=200)=>{json(res,status,data);return true;};
 const binary=(res,data,type,name,method='GET',extra={})=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'private, no-store',...(name?{'Content-Disposition':`attachment; filename="${name}"`}:{}),...extra});res.end(method==='HEAD'?undefined:data);return true;};
 return async(req,res,url,user)=>{
  const p=url.pathname,method=req.method,q=Object.fromEntries(url.searchParams),match=pattern=>p.match(pattern),input=(max)=>body(req,max);
  let m;
  if(p==='/api/faqs'&&method==='GET')return send(res,notices.aiTools.faqs.publicFaqs(q.lang));
  if(p==='/api/access-status'&&method==='GET')return send(res,accounts.status());
  if(p==='/api/account/forgot-password'&&method==='POST')return send(res,accounts.forgot(await input(),req));
  if(p==='/api/account/reset-password'&&method==='POST')return send(res,await accounts.reset(await input()));
  if(p==='/api/account/verify-email'&&method==='POST')return send(res,accounts.verify(await input()));
  if(p==='/api/webhooks/stripe'&&method==='POST')return send(res,finance.webhook(await rawBody(req,1048576),req.headers['stripe-signature']));
  if(p==='/api/agents'&&method==='GET')return send(res,{agents:agents.list()});
  if((m=match(/^\/agent-photos\/(\d+)$/))&&['GET','HEAD'].includes(method)){const row=agents.photo(m[1],user);return binary(res,row.data,row.mime,null,method);}
  if((m=match(/^\/gallery-photos\/(\d+)$/))&&['GET','HEAD'].includes(method)){const row=resident.galleryPhoto(user,m[1]);return binary(res,row.data,row.mime,null,method);}
  if((m=match(/^\/api\/properties\/(\d+)\/media$/))&&method==='GET')return send(res,resident.media(user,m[1]));
  if(p==='/api/tour-slots'&&method==='GET')return send(res,{slots:resident.slots(user,q.propertyId)});
  const ours=/^\/api\/(account\/|ai-tools|notifications|email-history|email-campaigns|email-writing|my-applications|document-requests|tour-slots|tours|contractors|maintenance|saved-searches|sessions|expenses|budgets|reports|integrations|online-payments|signatures|receipts|admin\/(agents|smtp-settings)|gallery\/|properties\/\d+\/(gallery|video)|applications\/\d+\/document-requests)/.test(p);
  if(!ours)return false;
  if(!user)fail('Please sign in to continue.',401);
  if(p==='/api/email-campaigns/audience'&&method==='GET')return send(res,notices.campaigns.audience(user,q.scope));
  if(p==='/api/email-campaigns'&&method==='POST')return send(res,await notices.campaigns.queue(user,await input(60000)),202);
  if((m=match(/^\/api\/email-campaigns\/([a-f0-9-]+)$/))&&method==='GET')return send(res,notices.campaigns.status(user,m[1]));
  if(p==='/api/email-writing/status'&&method==='GET')return send(res,notices.writing.status(user));
  if(p==='/api/email-writing/suggest'&&method==='POST')return send(res,await notices.writing.suggest(user,await input(6000)));
  if(p==='/api/ai-tools/status'&&method==='GET')return send(res,notices.aiTools.status(user));
  if(p==='/api/ai-tools/generate'&&method==='POST')return send(res,await notices.aiTools.generate(user,await input(36000)));
  if((m=match(/^\/api\/ai-tools\/maintenance\/(\d+)$/))){if(method==='GET')return send(res,notices.aiTools.maintenance(user,m[1]));if(method==='POST')return send(res,notices.aiTools.saveMaintenance(user,m[1],await input(36000)));}
  if(p==='/api/ai-tools/faqs'){if(method==='GET')return send(res,notices.aiTools.faqs.workspace(user));if(method==='POST')return send(res,notices.aiTools.faqs.save(user,await input(140000)));}
  if((m=match(/^\/api\/ai-tools\/faqs\/(publish|unpublish)$/))&&method==='POST')return send(res,notices.aiTools.faqs.publish(user,await input(),m[1]==='unpublish'));
  if(p==='/api/email-history'&&method==='GET')return send(res,notices.history.list(user,q));
  if((m=match(/^\/api\/email-history\/(\d+)$/))&&method==='GET')return send(res,notices.history.detail(user,m[1]));
  if(p==='/api/account/request-verification'&&method==='POST')return send(res,accounts.requestVerification(user,req));
  if(p==='/api/account/preferences'&&method==='POST')return send(res,accounts.preferences(user,await input()));
  if(p==='/api/notifications'&&method==='GET')return send(res,{notifications:notices.list(user)});
  if((m=match(/^\/api\/notifications\/(\d+)\/read$/))&&method==='POST')return send(res,notices.read(user,m[1]));
  if(p==='/api/my-applications'&&method==='GET')return send(res,{applications:resident.myApplications(user)});
  if((m=match(/^\/api\/applications\/(\d+)\/document-requests$/))){if(method==='GET')return send(res,{requests:resident.documentRequests(user,m[1])});if(method==='POST')return send(res,resident.requestDocument(user,m[1],await input()),201);}
  if((m=match(/^\/api\/document-requests\/(\d+)\/(upload|cancel)$/))&&method==='POST')return send(res,m[2]==='upload'?resident.fulfillDocument(user,m[1],await input(3000000)):resident.cancelDocumentRequest(user,m[1]));
  if((m=match(/^\/api\/properties\/(\d+)\/gallery$/))&&method==='POST')return send(res,resident.addGallery(user,m[1],await input(3000000)),201);
  if((m=match(/^\/api\/gallery\/(\d+)\/delete$/))&&method==='POST')return send(res,resident.deleteGallery(user,m[1]));
  if((m=match(/^\/api\/properties\/(\d+)\/video$/))&&method==='POST')return send(res,resident.setVideo(user,m[1],await input()));
  if(p==='/api/tour-slots'&&method==='POST')return send(res,resident.addSlot(user,await input()),201);
  if((m=match(/^\/api\/tour-slots\/(\d+)\/cancel$/))&&method==='POST')return send(res,resident.cancelSlot(user,m[1]));
  if(p==='/api/tours'){if(method==='GET')return send(res,{bookings:resident.bookings(user)});if(method==='POST')return send(res,resident.bookTour(user,await input()),201);}
  if((m=match(/^\/api\/tours\/(\d+)\/status$/))&&method==='POST')return send(res,resident.updateBooking(user,m[1],await input()));
  if((m=match(/^\/api\/tours\/(\d+)\/calendar$/))&&method==='GET')return binary(res,resident.calendar(user,m[1]),'text/calendar; charset=utf-8','viewing-'+m[1]+'.ics');
  if(p==='/api/contractors'){if(method==='GET')return send(res,{contractors:resident.contractors(user),workload:experience.workload(user)});if(method==='POST')return send(res,resident.saveContractor(user,null,await input()),201);}
  if((m=match(/^\/api\/contractors\/(\d+)$/))&&method==='POST')return send(res,resident.saveContractor(user,m[1],await input()));
  if((m=match(/^\/api\/maintenance\/(\d+)$/))&&method==='GET')return send(res,{...resident.maintenanceDetails(user,m[1]),history:experience.maintenanceHistory(user,m[1])});
  if((m=match(/^\/api\/maintenance\/(\d+)\/(assign|photos)$/))&&method==='POST')return send(res,m[2]==='assign'?resident.assign(user,m[1],await input()):resident.addMaintenancePhoto(user,m[1],await input(3000000)),m[2]==='photos'?201:200);
  if((m=match(/^\/api\/maintenance\/(\d+)\/calendar$/))&&method==='GET')return binary(res,experience.maintenanceCalendar(user,m[1]),'text/calendar; charset=utf-8','maintenance-'+m[1]+'.ics');
  if((m=match(/^\/api\/maintenance-photos\/(\d+)$/))&&['GET','HEAD'].includes(method)){const row=resident.maintenancePhoto(user,m[1]);return binary(res,row.data,row.mime,null,method);}
  if((m=match(/^\/api\/maintenance-photos\/(\d+)\/delete$/))&&method==='POST')return send(res,resident.deleteMaintenancePhoto(user,m[1]));
  if(p==='/api/saved-searches'){if(method==='GET')return send(res,{searches:experience.searches(user)});if(method==='POST')return send(res,experience.saveSearch(user,await input()),201);}
  if((m=match(/^\/api\/saved-searches\/(\d+)\/delete$/))&&method==='POST')return send(res,experience.deleteSearch(user,m[1]));
  if(p==='/api/sessions'&&method==='GET')return send(res,{sessions:experience.sessions(user,req)});
  if(p==='/api/sessions/revoke'&&method==='POST')return send(res,experience.revokeSession(user,await input()));
  if(p==='/api/expenses'){if(method==='GET')return send(res,{expenses:finance.expenses(user,q)});if(method==='POST')return send(res,finance.addExpense(user,await input()),201);}
  if((m=match(/^\/api\/expenses\/(\d+)\/void$/))&&method==='POST')return send(res,finance.voidExpense(user,m[1],await input()));
  if(p==='/api/budgets'){if(method==='GET')return send(res,{budgets:finance.budgets(user,q)});if(method==='POST')return send(res,finance.saveBudget(user,await input()));}
  if(p==='/api/reports'&&method==='GET')return send(res,{report:finance.report(user,q)});
  if(p==='/api/reports/export'&&method==='GET'){if(!['csv','pdf'].includes(q.format))fail('Choose CSV or PDF.');return binary(res,await finance.exportReport(user,q,q.format),q.format==='pdf'?'application/pdf':'text/csv; charset=utf-8','property-report.'+q.format);}
  if(p==='/api/admin/smtp-settings'){admin(user);if(method==='GET')return send(res,{settings:smtpSettings.status(user)});if(method==='POST'){const result=await smtpSettings.save(user,await input());notices.smtpSettingsChanged();return send(res,result);}}
  if(p==='/api/admin/smtp-settings/check'&&method==='POST'){admin(user);const result=await smtpSettings.checkSaved(user,await input());notices.smtpSettingsChanged();return send(res,result);}
  if(p==='/api/admin/smtp-settings/test'&&method==='POST'){admin(user);const data=await input();await smtpSettings.authorizeTest(user,data);return send(res,notices.queueSmtpTest(user,data),202);}
  if(p==='/api/admin/smtp-settings/lease-greetings'){admin(user);if(method==='GET')return send(res,notices.leaseGreetings.preview(user));if(method==='POST'){const data=await input();await smtpSettings.authorizeTest(user,data);return send(res,notices.leaseGreetings.queue(user,data),202);}}
  if((m=match(/^\/api\/admin\/smtp-settings\/lease-greetings\/(thanksgiving-\d{4})$/))&&method==='GET'){admin(user);return send(res,notices.leaseGreetings.status(user,m[1]));}
  if(p==='/api/admin/smtp-settings/lease-reminders'){admin(user);if(method==='GET')return send(res,notices.leaseReminderAudience(user));if(method==='POST'){const data=await input();await smtpSettings.authorizeTest(user,data);return send(res,notices.queueLeaseReminders(user,data),202);}}
  if((m=match(/^\/api\/admin\/smtp-settings\/lease-reminders\/([a-f0-9-]+)$/))&&method==='GET'){admin(user);return send(res,notices.leaseReminderStatus(user,m[1]));}
  if((m=match(/^\/api\/admin\/smtp-settings\/lease-reminders\/([a-f0-9-]+)\/cancel$/))&&method==='POST'){admin(user);const data=await input();await smtpSettings.authorizeTest(user,data);return send(res,notices.cancelLeaseReminders(user,m[1],data));}
  if((m=match(/^\/api\/admin\/smtp-settings\/test\/([a-f0-9-]+)$/))&&method==='GET'){admin(user);return send(res,notices.smtpTestStatus(user,m[1]));}
  if(p==='/api/admin/smtp-settings/reset'&&method==='POST'){admin(user);const result=await smtpSettings.reset(user,await input());notices.smtpSettingsChanged();return send(res,result);}
  if(p==='/api/integrations/email/retry'&&method==='POST')return send(res,notices.retryFailed(user));
  if(p==='/api/integrations/email/check'&&method==='POST')return send(res,await notices.verifySmtp(user));
  if(p==='/api/integrations'&&method==='GET'){admin(user);return send(res,{email:notices.deliveryStatus(user),payments:finance.status(user)});}
  if(p==='/api/online-payments/status'&&method==='GET')return send(res,{enabled:finance.enabled(),checkouts:finance.paymentStates(user)});
  if(p==='/api/online-payments/sync'&&method==='POST')return send(res,await finance.syncPayments(user));
  if((m=match(/^\/api\/online-payments\/(\d+)\/cancel$/))&&method==='POST')return send(res,await finance.cancelCheckout(user,m[1]));
  if((m=match(/^\/api\/online-payments\/(\d+)\/checkout$/))&&method==='POST')return send(res,await finance.checkout(user,m[1]));
  if((m=match(/^\/api\/receipts\/(\d+)$/))&&method==='GET')return binary(res,await finance.receipt(user,m[1]),'application/pdf','payment-receipt-'+m[1]+'.pdf');
  if(p==='/api/signatures'){if(method==='GET')return send(res,{requests:signatures.list(user)});if(method==='POST')return send(res,await signatures.request(user,await input()),201);}
  if((m=match(/^\/api\/signatures\/(\d+)\/(original|evidence)$/))&&method==='GET')return m[2]==='original'?binary(res,signatures.original(user,m[1]).data,'application/pdf','lease-to-review-'+m[1]+'.pdf'):send(res,{evidence:signatures.evidence(user,m[1])});
  if((m=match(/^\/api\/signatures\/(\d+)\/(sign|status)$/))&&method==='POST')return send(res,m[2]==='sign'?await signatures.sign(user,m[1],await input(),req):signatures.update(user,m[1],await input()));
  if(p==='/api/admin/agents'&&method==='GET')return send(res,{agents:agents.editList(user)});
  if((m=match(/^\/api\/admin\/agents\/(\d+)\/(profile|photo|remove-photo)$/))&&method==='POST')return send(res,m[2]==='profile'?agents.save(user,m[1],await input()):m[2]==='photo'?agents.savePhoto(user,m[1],await input(3000000)):agents.deletePhoto(user,m[1]));
  return false;
 };
}
module.exports={createServiceRoutes};
