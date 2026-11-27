const {randomBytes}=require('node:crypto');
const photoName=mime=>'ctpm-photo-'+randomBytes(16).toString('hex')+(mime==='image/png'?'.png':'.jpg');
const photoLabel=name=>'Property photo '+name.replace(/^ctpm-photo-/,'').slice(0,8).toUpperCase();
function photoCaption(value){
 if(value===undefined||value===null||value==='')return '';
 if(typeof value!=='string'||value.trim().length>200){const error=Error('Use a photo description of up to 200 characters.');error.status=400;throw error;}
 const caption=value.trim();if(/(?:\.(?:jpe?g|png|gif|webp|heic|avif)\s*$|[\\/][^\s]+\.(?:jpe?g|png)\b)/i.test(caption)){const error=Error('Describe the room instead of using an upload filename. Leave the description blank for an automatic name.');error.status=400;throw error;}return caption;
}
module.exports={photoName,photoLabel,photoCaption};
