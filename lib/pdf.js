const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
const safe=(value,characters)=>Array.from(String(value??'')).map(c=>c==='\n'||characters.has(c.codePointAt(0))?c:'[U+'+c.codePointAt(0).toString(16).toUpperCase()+']').join('');
async function addPages(pdf,title,lines){const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),characters=new Set(font.getCharacterSet());let page,y;
 const next=()=>{page=pdf.addPage([612,792]);y=740;page.drawText(safe(title,characters).slice(0,78),{x:42,y,size:17,font:bold,color:rgb(.09,.25,.21)});y-=35;};next();
 const draw=row=>{if(y<50)next();page.drawText(row,{x:42,y,size:10,font});y-=16;};
 for(const line of lines){let row='';for(let word of safe(line,characters).split(/\s+/)){if(font.widthOfTextAtSize(word,10)>520){if(row){draw(row);row='';}while(font.widthOfTextAtSize(word,10)>520){let cut=1;while(cut<word.length&&font.widthOfTextAtSize(word.slice(0,cut+1),10)<=520)cut++;draw(word.slice(0,cut));word=word.slice(cut);}}
 const candidate=row?row+' '+word:word;if(font.widthOfTextAtSize(candidate,10)>520){draw(row);row=word;}else row=candidate;}draw(row);y-=4;}

 return pdf;
}
async function document(title,lines){return (await addPages(await PDFDocument.create(),title,lines)).save();}
module.exports={addPages,document};
