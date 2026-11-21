import {readFile} from 'node:fs/promises';
const words = text => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
export function passages(pages, doc) {
  return pages.flatMap((page,i) => {
    const tokens = page.trim().split(/\s+/).filter(Boolean), chunks = [];
    for(let j=0;j<tokens.length;j+=150){
      chunks.push({id:doc+'-p'+(i+1)+'-'+(chunks.length+1), text:tokens.slice(j,j+180).join(' ')});
      if(j+180>=tokens.length) break;
    }
    return chunks;
  });
}
export function retrieve(all,query){
  const terms = new Set(words(query));
  const ranked = all.map(p => ({p, score:[...new Set(words(p.text))].reduce((n,w)=>n+(terms.has(w)?1:0),0)})).sort((a,b)=>b.score-a.score);
  const docs = new Set(), first = ranked.filter(({p})=>{
    const d=p.id.split('-')[0]; if(docs.has(d)) return false; docs.add(d);return true;
  });
  return [...new Set([...first,...ranked].map(x=>x.p))].slice(0,12);
}
const prompt = async path => readFile(new URL('../prompts/'+path+'.txt',import.meta.url),'utf8');

export async function workflow(version,question,all,ask,state={},persist=async()=>{}){
  if(!['v1','v2','v3','all'].includes(version)) throw Error('Unknown workflow');
  state.outputs ??= {};
  const start=Date.now(), trace=[];
  async function stage(path,data,format='',batch=''){
    const id=path+batch;
    state.stage=id;
    if(!Object.hasOwn(state.outputs,id)){
      const output=await ask(await prompt(path),{question,...data},format);
      state.outputs[id]=output;
      await persist();
    }
    const output=state.outputs[id];
    trace.push({stage:id,output});
    return output;
  }
  const documents=[...new Set(all.map(p=>p.id.split('-')[0]))];
  function select(query){
    return documents.flatMap(doc=>retrieve(all.filter(p=>p.id.startsWith(doc+'-')),query).slice(0,3));
  }
  let sources=select(question); let paperNotes=[];
  function report(v,claims,checks=[]){
    if(!Array.isArray(claims)||claims.some(c=>typeof c?.text!=='string'||!Array.isArray(c.citations)))throw Error('Invalid report format.');
    return {version:v,question,claims,checks,sources,paperNotes,trace:[...trace],seconds:(Date.now()-start)/1000};
  }
  if(version==='v1'||version==='all'){
    const baseline=await stage('v1/baseline',{sources:retrieve(sources,question).slice(0,Math.max(6,documents.length))},'Return JSON with plan and claims arrays; each claim has text and citations.');
    state.baseline=report('v1',baseline.claims);
    if(version==='v1')return state.baseline;
    trace.length=0;
  }
  const plan=await stage('v2/plan',{documents});
  if(!Array.isArray(plan.queries))throw Error('Invalid research plan');
  sources=select([question,...plan.queries].join(' '));
  const requiredDocs=(plan.answerMode==='shared' || !plan.answerMode) && Array.isArray(plan.sharedDocuments)
    ? [...new Set(plan.sharedDocuments.filter(id=>documents.includes(id)))] : [];
  const notes=[];
  for(let i=0;i<documents.length;i+=2){
    const group=documents.slice(i,i+2);
    const evidence=sources.filter(p=>group.includes(p.id.split('-')[0]));
    notes.push(await stage('v2/notes',{sources:evidence,plan},'Extract evidence for each requested part. Preserve passage IDs.',String(i/2+1)));
  }
  paperNotes=notes.flatMap(batch=>Array.isArray(batch.papers)?batch.papers:[])
    .filter(p=>p && documents.includes(p.document));
  const comparison=await stage('v2/compare',{notes});
  const draft=await stage('v2/report',{notes,comparison},'Keep claims atomic. Cover each paper where evidence permits. Use only citation IDs from the notes.');
  const candidate=report('v2',draft.claims);
  if(requiredDocs.length>1){
    candidate.claims=candidate.claims.filter(claim=>requiredDocs.every(doc=>
      claim.citations.some(id=>sources.some(p=>p.id===id && p.id.startsWith(doc+'-')))));
  }
  state.draft=candidate;
  if(version==='v2')return state.draft;
  const checks=[];
  for(let i=0;i<candidate.claims.length;i+=2){
    const claims=candidate.claims.slice(i,i+2).map((c,j)=>({...c,index:i+j}));
    const ids=new Set(claims.flatMap(c=>c.citations));
    const audit=await stage('v3/verify',{claims,passages:sources.filter(p=>ids.has(p.id))},'Keep the supplied global indices.',String(i/2+1));
    for(const claim of claims){
      const matches=(audit.checks||[]).filter(c=>c.index===claim.index);
      const known=claim.citations.length&&claim.citations.every(id=>sources.some(p=>p.id===id));
      if(matches.length===1 && (matches[0].relevant===false || (requiredDocs.length>1 && matches[0].relevant!==true))){checks.push({index:claim.index,status:'off-topic',reason:matches[0].reason});continue}
      checks.push(known&&matches.length===1&&['supported','partial','unsupported'].includes(matches[0].status)?matches[0]:{index:claim.index,status:'unreviewed',reason:'Missing passage or verdict'});
    }
  }
  let final=report('v3',candidate.claims.filter((_,i)=>checks[i].status==='supported'),checks);
  if(!final.claims.length && !state.recoveryPass){
    const seen=new Set(sources.map(p=>p.id));
    const remaining=all.filter(p=>!seen.has(p.id));
    if(remaining.length){
      state.recovery ??= {recoveryPass:true,outputs:{'v2/plan':plan}};
      const recovered=await workflow('v3',question,remaining,ask,state.recovery,persist);
      final={...recovered,sources:[...sources,...recovered.sources],trace:[...trace,...recovered.trace]};
    }
  }
  return version==='all'?{reports:[state.baseline,state.draft,final]}:final;
}


