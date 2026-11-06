const { id, stamp, staff, text, fail, imageBytes, migrate, transaction } = require('./service-utils');
const { date } = require('./operations');
function createPortfolioTools(db, management, resident) {
  migrate(db, 'property_gallery', 'position', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE property_gallery SET position=id WHERE position=0');
  return {
    saveProperty(user, value, input) {
      staff(user);
      const media = input.media === undefined ? [] : input.media;
      if (!Array.isArray(media) || media.length > 9) fail('Choose up to nine photos: one cover and eight gallery photos.');
      const cover = media.length ? Number(input.coverIndex ?? 0) : 0;
      if (!Number.isSafeInteger(cover) || cover < 0 || (media.length && cover >= media.length)) fail('Choose a cover photo.');
      for (const photo of media) { imageBytes(photo, 1048576); text(photo.caption, 'a photo caption', 200); }
      let property;
      transaction(db, () => {
        property = value ? management.editProperty(user, value, input, true) : management.addProperty(user, input);
        if (media.length) {
          management.savePhoto(user, property.id, media[cover]);
          for (const [index, photo] of media.entries()) if (index !== cover) {
            const added = resident.addGallery(user, property.id, photo);
            db.prepare('UPDATE property_gallery SET position=? WHERE id=?').run(db.prepare('SELECT COALESCE(MAX(position),0)+1 AS n FROM property_gallery WHERE property_id=?').get(property.id).n, added.id);
          }
        }
      });
      return management.listProperties(user).find(p => p.id === property.id);
    },
    reorderGallery(user, value, input) {
      staff(user); const property = id(value), current = db.prepare('SELECT id FROM property_gallery WHERE property_id=?').all(property).map(p => p.id);
      if (!Array.isArray(input.ids) || input.ids.length !== current.length || new Set(input.ids).size !== current.length || !input.ids.every(value => Number.isSafeInteger(value) && current.includes(value))) fail('Reload the gallery before reordering it.', 409);
      transaction(db, () => input.ids.forEach((value, index) => db.prepare('UPDATE property_gallery SET position=? WHERE id=? AND property_id=?').run(index + 1, value, property)));
      return { ok: true };
    },
    promoteCover(user, value) {
      staff(user); const photo = db.prepare('SELECT * FROM property_gallery WHERE id=?').get(id(value));
      if (!photo) fail('Gallery photo not found.', 404);
      db.prepare('INSERT INTO property_photos(property_id,mime,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(property_id) DO UPDATE SET mime=excluded.mime,data=excluded.data,updated_at=excluded.updated_at').run(photo.property_id, photo.mime, photo.data, stamp());
      return { ok: true };
    },
    quality(user) {
      staff(user); return db.prepare('SELECT id,name,address,description,amenities,is_preview FROM properties').all().map(p => {
        const checks = [!!p.name.trim(), !!p.address.trim() && p.address !== 'Address to be confirmed', !!p.description.trim(), JSON.parse(p.amenities).length > 0, !!db.prepare('SELECT 1 FROM property_photos WHERE property_id=?').get(p.id)];
        return { id: p.id, score: checks.filter(Boolean).length * 20, missing: ['Name', 'Verified address', 'Description', 'Amenities', 'Property photograph'].filter((_, i) => !checks[i]) };
      });
    },
    matchApplication(user, value, input) {
      staff(user); const app = db.prepare('SELECT * FROM applications WHERE id=?').get(id(value)); if (!app) fail('Application not found.', 404);
      const property = input.propertyId ? id(input.propertyId) : null;
      if (property && !db.prepare('SELECT id FROM properties WHERE id=? AND is_preview=0').get(property)) fail('Choose a verified property.');
      if (property && db.prepare('SELECT id FROM applications WHERE property_id=? AND email=? AND id<>?').get(property, app.email, app.id)) fail('This applicant already has a record for that property. Review both records before matching.', 409);
      try { db.prepare('UPDATE applications SET property_id=?,updated_at=?,updated_by=? WHERE id=?').run(property, stamp(), user.id, app.id); }
      catch (error) { if (error.message.includes('UNIQUE')) fail('An address application already exists for this applicant. Keep the existing records for review.', 409); throw error; }
      return { ok: true };
    },
    followUp(user, value, input) {
      staff(user); if (!['Normal', 'High', 'Urgent'].includes(input.priority)) fail('Choose a priority.');
      const due = input.followUpOn ? date(input.followUpOn, 'follow-up date') : '';
      if (!db.prepare('UPDATE applications SET priority=?,follow_up_on=?,updated_at=?,updated_by=? WHERE id=?').run(input.priority, due, stamp(), user.id, id(value)).changes) fail('Application not found.', 404);
      return { ok: true };
    }
  };
}
module.exports = { createPortfolioTools };
