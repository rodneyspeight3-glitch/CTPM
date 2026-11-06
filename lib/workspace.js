const { id, stamp, today, staff, text, optional, number, fail, transaction, installationId } = require('./service-utils');
const { date } = require('./operations');
const { calendar } = require('./calendar');
const pdf = require('./pdf');
function createWorkspace(db, notices) {
  const namespace = installationId(db);
  db.exec(`CREATE TABLE IF NOT EXISTS team_tasks(id INTEGER PRIMARY KEY,title TEXT NOT NULL,notes TEXT NOT NULL,property_id INTEGER REFERENCES properties(id),assignee_id INTEGER REFERENCES users(id),due_on TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Open',created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,plan_key TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS maintenance_plans(id INTEGER PRIMARY KEY,title TEXT NOT NULL,property_id INTEGER NOT NULL REFERENCES properties(id),interval_days INTEGER NOT NULL,next_due TEXT NOT NULL,assignee_id INTEGER REFERENCES users(id),active INTEGER NOT NULL DEFAULT 1,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS community_notices(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,audience TEXT NOT NULL,target_user_id INTEGER REFERENCES users(id),expires_on TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,created_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);`);
  const employee = value => { if (!value) return null; const key = id(value); if (!db.prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(key)) fail('Choose an active team member.'); return key; };
  const property = value => { if (!value) return null; const key = id(value); if (!db.prepare('SELECT 1 FROM properties WHERE id=? AND is_preview=0').get(key)) fail('Choose a verified property.'); return key; };
  const tasks = user => { staff(user); return db.prepare('SELECT t.*,u.name AS assignee_name,p.name AS property_name FROM team_tasks t LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN properties p ON p.id=t.property_id ORDER BY CASE t.status WHEN \'Done\' THEN 1 WHEN \'Cancelled\' THEN 1 ELSE 0 END,t.due_on,t.id DESC').all(); };
  const plans = user => { staff(user); return db.prepare('SELECT m.*,p.name AS property_name,u.name AS assignee_name FROM maintenance_plans m JOIN properties p ON p.id=m.property_id LEFT JOIN users u ON u.id=m.assignee_id ORDER BY m.active DESC,m.next_due').all(); };
  const members = user => { staff(user); return db.prepare("SELECT id,name,role FROM users WHERE active=1 AND role IN ('admin','agent') ORDER BY name").all(); };
  function runPlans() {
    for (const plan of db.prepare('SELECT m.* FROM maintenance_plans m JOIN properties p ON p.id=m.property_id WHERE m.active=1 AND m.next_due<=? AND p.archived=0').all(today())) {
      const owner = plan.assignee_id && db.prepare("SELECT id FROM users WHERE id=? AND active=1 AND role IN ('admin','agent')").get(plan.assignee_id) ? plan.assignee_id : null;
      const now = stamp(), key = 'plan:' + plan.id + ':' + plan.next_due, days = Math.floor((Date.parse(today()) - Date.parse(plan.next_due)) / 86400000), advance = (Math.floor(days / plan.interval_days) + 1) * plan.interval_days;
      transaction(db, () => {
        const result = db.prepare('INSERT INTO team_tasks(title,notes,property_id,assignee_id,due_on,created_by,created_at,updated_at,plan_key) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(plan_key) DO NOTHING').run(plan.title, 'Preventive maintenance plan. Confirm the work and appointment with the property team.', plan.property_id, owner, plan.next_due, plan.created_by, now, now, key);
        db.prepare('UPDATE maintenance_plans SET next_due=? WHERE id=?').run(new Date(Date.parse(plan.next_due) + advance * 86400000).toISOString().slice(0, 10), plan.id);
        if (result.changes && owner) notices.notify(owner, { kind: 'task', title: 'A preventive maintenance task is ready', link: '/dashboard#workspace', key });
      });
    }
  }
  return {
    tasks, plans, members, runPlans,
    saveTask(user, value, input) {
      staff(user); const title = text(input.title, 'a task title', 150), notes = optional(input.notes, 'task notes', 1500), place = property(input.propertyId), owner = employee(input.assigneeId), due = date(input.dueOn, 'due date');
      const status = input.status || 'Open'; if (!['Open', 'In progress', 'Done', 'Cancelled'].includes(status)) fail('Choose a task status.');
      if (value) { if (!db.prepare('UPDATE team_tasks SET title=?,notes=?,property_id=?,assignee_id=?,due_on=?,status=?,updated_at=? WHERE id=?').run(title, notes, place, owner, due, status, stamp(), id(value)).changes) fail('Task not found.', 404); }
      else { const result = db.prepare('INSERT INTO team_tasks(title,notes,property_id,assignee_id,due_on,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(title, notes, place, owner, due, status, user.id, stamp(), stamp()); value = Number(result.lastInsertRowid); }
      if (owner && status !== 'Done' && status !== 'Cancelled') notices.notify(owner, { kind: 'task', title: 'A team task was assigned or updated', link: '/dashboard#workspace', key: 'task:' + value + ':' + stamp() });
      return { id: Number(value) };
    },
    savePlan(user, value, input) {
      staff(user); const title = text(input.title, 'a plan title', 150), place = property(input.propertyId); if (!place) fail('Choose a property.');
      const interval = number(input.intervalDays, 'interval in days', 1, 3650, true), due = date(input.nextDue, 'next due date'), owner = employee(input.assigneeId);
      if (value) { if (typeof input.active !== 'boolean') fail('Choose a plan status.'); if (!db.prepare('UPDATE maintenance_plans SET title=?,property_id=?,interval_days=?,next_due=?,assignee_id=?,active=? WHERE id=?').run(title, place, interval, due, owner, input.active ? 1 : 0, id(value)).changes) fail('Plan not found.', 404); }
      else db.prepare('INSERT INTO maintenance_plans(title,property_id,interval_days,next_due,assignee_id,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(title, place, interval, due, owner, user.id, stamp());
      runPlans(); return { ok: true };
    },
    taskCalendar(user, value) { const task = tasks(user).find(t => t.id === id(value)); if (!task) fail('Task not found.', 404); return calendar([{ id: 'task-' + task.id, title: task.title, start: task.due_on, allDay: true, description: task.notes, location: task.property_name || '' }], namespace); },
    followUpCalendar(user, value) { staff(user); const a = db.prepare('SELECT * FROM applications WHERE id=?').get(id(value)); if (!a?.follow_up_on) fail('Set a follow-up date first.', 409); return calendar([{ id: 'application-' + a.id, title: 'Application follow-up: ' + a.reference, start: a.follow_up_on, allDay: true, description: 'Review the application in your management dashboard.', location: a.requested_address }], namespace); },
    leaseCalendar(user, value) { const lease = db.prepare('SELECT l.*,p.name AS property_name FROM leases l JOIN properties p ON p.id=l.property_id WHERE l.id=?').get(id(value)); if (!lease || (user.role === 'tenant' && lease.tenant_id !== user.id)) fail('Lease not found.', 404); return calendar([{ id: 'lease-' + lease.id, title: 'Lease end: ' + lease.property_name, start: lease.ends_on, allDay: true, description: 'Contact management to confirm renewal or move-out arrangements.' }], namespace); },
    personalCalendar(user) {
      const events = [];
      for (const b of db.prepare("SELECT b.id,s.starts_at,s.ends_at,p.name,p.address FROM tour_bookings b JOIN tour_slots s ON s.id=b.slot_id JOIN properties p ON p.id=s.property_id WHERE b.status='Confirmed' AND " + (user.role === 'tenant' ? 'b.user_id=?' : 's.created_by=?')).all(user.id)) events.push({ id: 'viewing-' + b.id, title: 'Viewing: ' + b.name, start: b.starts_at, end: b.ends_at, location: b.address });
      for (const r of db.prepare("SELECT r.id,r.title,a.scheduled_on FROM maintenance_requests r JOIN maintenance_assignments a ON a.request_id=r.id WHERE r.status NOT IN ('Completed','Cancelled') AND a.scheduled_on<>'' AND " + (user.role === 'tenant' ? 'r.tenant_id=?' : 'a.updated_by=?')).all(user.id)) events.push({ id: 'maintenance-' + r.id, title: 'Maintenance: ' + r.title, start: r.scheduled_on, allDay: true, description: 'Confirm the arrival window with management.' });
      if (user.role === 'tenant') for (const l of db.prepare("SELECT l.id,l.ends_on,p.name FROM leases l JOIN properties p ON p.id=l.property_id WHERE l.status='Active' AND l.tenant_id=?").all(user.id)) events.push({ id: 'lease-' + l.id, title: 'Lease end: ' + l.name, start: l.ends_on, allDay: true });
      else for (const t of tasks(user).filter(t => t.assignee_id === user.id && !['Done', 'Cancelled'].includes(t.status))) events.push({ id: 'task-' + t.id, title: t.title, start: t.due_on, allDay: true, description: t.notes });
      return calendar(events, namespace);
    },
    notices(user) {
      return db.prepare("SELECT n.id,n.title,n.body,n.audience,n.target_user_id,n.expires_on,n.pinned,n.archived,n.created_at,u.name AS author FROM community_notices n JOIN users u ON u.id=n.created_by WHERE " + (user.role === 'tenant' ? "n.archived=0 AND (n.expires_on='' OR n.expires_on>=?) AND n.audience IN ('all','residents') AND (n.target_user_id IS NULL OR n.target_user_id=?)" : '1=1') + ' ORDER BY n.pinned DESC,n.id DESC').all(...(user.role === 'tenant' ? [today(), user.id] : []));
    },
    publishNotice(user, input) {
      staff(user); if (!['all', 'residents', 'staff'].includes(input.audience)) fail('Choose an audience.'); const target = input.targetUserId ? id(input.targetUserId) : null;
      if (target && (!db.prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role='tenant'").get(target) || input.audience === 'staff')) fail('Choose an active resident.');
      const expiry = input.expiresOn ? date(input.expiresOn, 'expiry date') : ''; if (expiry && expiry < today()) fail('Choose today or a future expiry.');
      const result = db.prepare('INSERT INTO community_notices(title,body,audience,target_user_id,expires_on,pinned,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)').run(text(input.title, 'a notice title', 150), text(input.body, 'notice text', 3000), input.audience, target, expiry, input.pinned === true ? 1 : 0, user.id, stamp());
      const recipients = db.prepare('SELECT id FROM users WHERE active=1' + (target ? ' AND id=?' : input.audience === 'residents' ? " AND role='tenant'" : input.audience === 'staff' ? " AND role IN ('admin','agent')" : '')).all(...(target ? [target] : []));
      for (const recipient of recipients) notices.notify(recipient.id, { kind: 'community', title: 'A new community notice is available', link: '/dashboard#community', key: 'notice:' + result.lastInsertRowid });
      return { id: Number(result.lastInsertRowid) };
    },
    archiveNotice(user, value) { staff(user); if (!db.prepare('UPDATE community_notices SET archived=1 WHERE id=?').run(id(value)).changes) fail('Notice not found.', 404); return { ok: true }; },
    async workOrder(user, value) {
      const r = db.prepare('SELECT r.*,u.name AS tenant_name,p.name AS property_name FROM maintenance_requests r JOIN users u ON u.id=r.tenant_id LEFT JOIN properties p ON p.id=r.property_id WHERE r.id=?').get(id(value));
      if (!r || (user.role === 'tenant' && r.tenant_id !== user.id)) fail('Work order not found.', 404);
      const a = db.prepare('SELECT a.*,c.company,c.trade,c.phone FROM maintenance_assignments a JOIN contractors c ON c.id=a.contractor_id WHERE a.request_id=?').get(r.id);
      return pdf.document('Come Together · Maintenance work order', ['Request #' + r.id + ' | ' + r.status, r.title, r.property_name || r.location, 'Location: ' + r.location, 'Description: ' + r.description, 'Category: ' + r.category + ' | Priority: ' + r.priority, 'Resident update: ' + r.staff_note, ...(a ? ['Assigned: ' + a.company + ' · ' + a.trade, 'Scheduled day: ' + (a.scheduled_on || 'Not scheduled'), ...(user.role !== 'tenant' ? ['Contractor phone: ' + a.phone, 'Private work note: ' + a.private_note] : [])] : ['No contractor assigned.'])]);
    }
  };
}
module.exports = { createWorkspace };
