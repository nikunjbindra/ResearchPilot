const $=id=>document.getElementById(id);
function node(parent,tag,value){const n=document.createElement(tag);n.textContent=value;parent.append(n);return n}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
const runs=read('researchpilot-runs',[]), links=new WeakMap();
let pending=read('researchpilot-pending',null),files=[],running=false;
function route(){const open=location.hash==='#workspace';$('landing').hidden=open;$('workspace').hidden=!open;if(open)$('question').focus();document.body.classList.remove('leaving')}
document.querySelector('.start').onclick=e=>{e.preventDefault();document.body.classList.add('leaving');setTimeout(()=>location.hash='workspace',matchMedia('(prefers-reduced-motion:reduce)').matches?0:320)};
onhashchange=route;route();
function list(){const ul=$('list');ul.replaceChildren();files.forEach((file,i)=>{const row=node(ul,'li',file.name);const b=node(row,'button','Remove');b.type='button';b.disabled=running;b.setAttribute('aria-label','Remove '+file.name);b.onclick=()=>{files.splice(i,1);list()}})}
function select(incoming){if(running)return;const next=[...files];for(const f of incoming){if(!/\.(pdf|txt)$/i.test(f.name)){statusText('Choose PDF or TXT files.');return}if(!next.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))next.push(f)}if(next.length>8||next.reduce((n,f)=>n+f.size,0)>16000000){statusText('Select up to eight papers totalling 16 MB or less.');return}files=next;list()}
$('browse').onclick=()=>$('files').click();$('files').onchange=e=>{select(e.target.files);e.target.value=''};
for(const event of ['dragover','dragleave','drop'])$('tray').addEventListener(event,e=>{e.preventDefault();$('tray').classList.toggle('over',event==='dragover');if(event==='drop')select(e.dataTransfer.files)});
function stageName(id){const key=String(id).replace(/[0-9]+$/,'');return ({'v1/baseline':'baseline report','v2/plan':'research planning','v2/notes':'paper evidence extraction','v2/compare':'paper comparison','v2/report':'report writing','v3/verify':'citation review'})[key]||'report generation'}
function statusText(value){$('status').textContent=value}
function sourceInfo(r,id){const match=/^D(\d+)-p(\d+)-/.exec(id);const passage=r.sources.find(p=>p.id===id);if(!match||!passage)return null;const i=Number(match[1])-1;return {i,page:match[2],label:r.documents[i]+' · p. '+match[2],text:passage.text}}
function evidence(r,id){const src=sourceInfo(r,id);if(!src)return;$('sourceTitle').textContent=src.label;$('excerpt').textContent=src.text;const url=links.get(r)?.[src.i];$('original').hidden=!url;if(url)$('original').href=url+'#page='+src.page;$('reader').showModal()}
function review(r){return r.pending?'Draft · citation review pending':r.version==='v3'?'Citation review complete':'Draft · no citation review'}
function coverage(r){return r.documents.map((name,i)=>{const count=r.claims.filter(c=>c.citations.some(id=>id.startsWith('D'+(i+1)+'-')&&sourceInfo(r,id))).length;const title=name+' — '+(count?count+' cited finding'+(count===1?'':'s'):'No cited finding in this report');return title})}
function paperDetails(r){
  return r.documents.map((name,i)=>{
    const notes=r.paperNotes?.find(p=>p.document==='D'+(i+1));
    if(Array.isArray(notes?.evidence))return [coverage(r)[i],...notes.evidence.filter(e=>e && typeof e.text==="string").map(e=>e.topic ? e.topic+": "+e.text : e.text)];
    return [coverage(r)[i],...(notes?['architecture','training','findings'].map(k=>k[0].toUpperCase()+k.slice(1)+': '+(notes[k]||'Not found in selected passages')):[])];
  });
}
function sectionHeading(report, claim, previous) {
  if (report.version === 'v1' || typeof claim.heading !== 'string') return '';
  const heading = claim.heading.trim();
  return heading === previous ? '' : heading;
}
function show(r){const box=$('report');box.hidden=false;box.replaceChildren();const top=node(box,'div','');top.className='heading';node(top,'h2',r.question);node(top,'button','Download report as PDF').onclick=()=>downloadPDF(r);node(box,'small',review(r));if(!r.claims.length)node(box,'p','No findings retained for this question.');let previous='';for(const c of r.claims){const heading=sectionHeading(r,c,previous);if(heading){node(box,'h3',heading);previous=heading}const p=node(box,'p',c.text+' ');p.className='finding';for(const id of c.citations){const src=sourceInfo(r,id);if(!src)continue;const b=node(p,'button','['+(src.i+1)+' · p. '+src.page+']');b.className='cite';b.onclick=()=>evidence(r,id)}}node(box,'h3','Paper coverage');paperDetails(r).forEach(([title,...notes])=>{const d=node(box,'details','');node(d,'summary',title);if(notes.length)node(d,'small','Extraction notes · before citation review');notes.forEach(s=>node(d,'p',s))})}
function history(){const h=$('history');h.replaceChildren();for(const r of [...runs].reverse()){const b=node(h,'button',r.version.toUpperCase()+' · '+r.question);b.onclick=()=>show(r)}}
function download(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('export').onclick=()=>download(new Blob([JSON.stringify(runs,null,2)],{type:'application/json'}),'researchpilot-runs.json');
function encode(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,data:reader.result.split(',')[1]});reader.onerror=reject;reader.readAsDataURL(file)})}
async function submit(resuming){
 if(running)return;
 if(!resuming&&pending){statusText('Resume the paused report or finish it before starting another run.');return}
 if(!resuming&&!files.length){statusText('Add at least one source paper.');return}
 running=true;for(const id of ['run','browse','resume','version','question'])$(id).disabled=true;list();statusText(resuming?'Resuming from the saved stage…':'Reading papers and preparing your report…');
 try{
 const input=resuming?{resume:pending.resume}:{files:await Promise.all(files.map(encode)),question:$('question').value,version:$('version').value};
 const res=await fetch('/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await res.json();
 if(res.status===429&&data.resume){pending={resume:data.resume,error:data.error,stage:data.stage,draft:data.draft};localStorage.setItem('researchpilot-pending',JSON.stringify(pending));if(data.draft)show({...data.draft,pending:true});statusText('Paused at '+stageName(data.stage)+'. '+data.error);return}
 if(!res.ok)throw Error(data.error);
 pending=null;localStorage.removeItem('researchpilot-pending');const reports=data.reports||[data];
 for(const r of reports){if(!resuming)links.set(r,files.map(f=>f.name.toLowerCase().endsWith('.pdf')?URL.createObjectURL(f):null));runs.push(r)}
 show(reports.at(-1));history();statusText('Report ready.');localStorage.setItem('researchpilot-runs',JSON.stringify(runs));
 }catch(err){statusText(err.message)}finally{running=false;for(const id of ['run','browse','resume','version','question'])$(id).disabled=false;$('resume').hidden=!pending;$('discard').hidden=!pending;list()}
}
$('research').onsubmit=e=>{e.preventDefault();submit(false)};$('resume').onclick=()=>submit(true);
const discard=document.createElement('button');discard.id='discard';discard.textContent='Dismiss paused run';$('resume').after(discard);discard.onclick=()=>{pending=null;localStorage.removeItem('researchpilot-pending');discard.hidden=$('resume').hidden=true;statusText('Ready for a new report.')};
history();discard.hidden=$('resume').hidden=!pending;if(pending){statusText('Paused at '+stageName(pending.stage)+'. '+pending.error);if(pending.draft)show({...pending.draft,pending:true})}
function downloadPDF(r){
  const pages=[],width=1240,height=1754,margin=92;
  let canvas,ctx,y;
  function page(){
    if(canvas)pages.push(canvas.toDataURL('image/jpeg',0.9));
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;ctx=canvas.getContext('2d');ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,width,height);ctx.fillStyle='#381729';ctx.font='30px Georgia';ctx.fillText('ResearchPilot',margin,74);ctx.font='20px Arial';ctx.fillText(String(pages.length+1),width-margin,74);ctx.fillRect(margin,95,width-margin*2,2);y=155;
  }
  function paragraph(value,size=26){
    const font=size+'px Georgia',lineHeight=size*1.45,max=width-margin*2;ctx.font=font;
    function line(s){if(y>height-margin){page();ctx.font=font}ctx.fillText(s,margin,y);y+=lineHeight}
    let current='';for(const word of String(value).split(/\s+/)){if(ctx.measureText(current+' '+word).width>max&&current){line(current);current=''}for(const letter of word){if(ctx.measureText(current+letter).width>max){line(current);current=''}current+=letter}current+=' '}if(current)line(current);y+=14;
  }
  page();paragraph(r.question,41);paragraph(review(r),24);
  let previous='';for(const c of r.claims){const heading=sectionHeading(r,c,previous);if(heading){paragraph(heading,32);previous=heading}paragraph(c.text+' '+c.citations.map(id=>sourceInfo(r,id)?.label).filter(Boolean).map(x=>'['+x+']').join(' '));}
  paragraph('Paper coverage',32);coverage(r).forEach(s=>paragraph(s));
  const ids=[...new Set(r.claims.flatMap(c=>c.citations))];if(ids.length)paragraph('Source passages',32);
  for(const id of ids){const src=sourceInfo(r,id);if(src){paragraph(src.label);paragraph(src.text,23)}}
  pages.push(canvas.toDataURL('image/jpeg',0.9));
  download(pdfFromPages(pages,width,height),'ResearchPilot-report.pdf');
}
function pdfFromPages(images,width,height){
  const parts=[],offsets=[0];let size=0;
  function put(data){const bytes=typeof data==='string'?new TextEncoder().encode(data):data;parts.push(bytes);size+=bytes.length}
  function object(id,body){offsets[id]=size;put(id+' 0 obj\n');body();put('\nendobj\n')}
  put('%PDF-1.4\n');object(1,()=>put('<< /Type /Catalog /Pages 2 0 R >>'));object(2,()=>put('<< /Type /Pages /Count '+images.length+' /Kids ['+images.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>'));
  images.forEach((uri,i)=>{const id=3+i*3;const jpeg=Uint8Array.from(atob(uri.split(',')[1]),s=>s.charCodeAt(0));const draw='q 595 0 0 842 0 0 cm /PageImage Do Q';
    object(id,()=>put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /PageImage '+(id+1)+' 0 R >> >> /Contents '+(id+2)+' 0 R >>'));
    object(id+1,()=>{put('<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n');put(jpeg);put('\nendstream')});
    object(id+2,()=>put('<< /Length '+draw.length+' >>\nstream\n'+draw+'\nendstream'))
  });
  const xref=size;put('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');offsets.slice(1).forEach(offset=>put(String(offset).padStart(10,'0')+' 00000 n \n'));put('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return new Blob(parts,{type:'application/pdf'});
}

