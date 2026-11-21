import test from 'node:test';
import assert from 'node:assert/strict';
import {passages,retrieve,workflow} from './workflow.mjs';
const sources=passages(['Students completed three exercises.'],'D1');
test('preserves page IDs and multiple sources',()=>assert.equal(retrieve([...sources,...passages(['Other text'],'D2')],'students').length,2));
for(const version of ['v1','v2','v3'])test(version+' workflow routing',async()=>{
  const report={claims:[{text:'Three exercises.',citations:['D1-p1-1']},{text:'Four exercises.',citations:['missing']}]};
  const replies=version==='v1'?[report]:[{queries:['exercises']},{notes:[]},{comparison:[]},report,{checks:[{index:0,status:'supported'},{index:1,status:'supported'}]}];
  const r=await workflow(version,'How many exercises?',sources,async()=>replies.shift());
  assert.equal(r.trace.length,{v1:1,v2:4,v3:5}[version]);assert.equal(r.claims.length,version==='v3'?1:2);
});
for(const count of [2,3,5,8])test('resume comparison for '+count+' papers without repeating completed calls',async()=>{
  const all=Array.from({length:count},(_,i)=>passages(['Paper evidence.'],'D'+(i+1))).flat();
  const claims=all.map(p=>({text:'Paper evidence.',citations:[p.id]}));
  const state={};let pause=true,baselines=0,plans=0,checks=0;
  async function ask(prompt,data){
    if(data.claims){if(pause){pause=false;throw Error('quota')}checks++;return {checks:data.claims.map(c=>({index:c.index,status:'supported'}))}}
    if(data.comparison)return {claims};if(data.notes)return {comparison:[]};if(data.plan)return {notes:[]};if(data.sources){baselines++;return {claims}}plans++;return {queries:['evidence']};
  }
  await assert.rejects(workflow('all','Evidence?',all,ask,state),/quota/);
  assert.equal(state.draft.claims.length,count);
  const result=await workflow('all','Evidence?',all,ask,JSON.parse(JSON.stringify(state)));
  assert.equal(result.reports.length,3);assert.equal(result.reports[2].claims.length,count);
  assert.equal(plans,1);assert.equal(baselines,1);assert.equal(checks,Math.ceil(count/2));
});
test('similarities require both sources and relevance',async()=>{
  const both=[...sources,...passages(['Other paper.'],'D2')];
  const citations=both.map(p=>p.id);
  const answers=[{queries:[],answerMode:'shared',sharedDocuments:['D1','D2']},{papers:[]},{comparison:[]},{claims:[
    {text:'One paper only',citations:citations.slice(0,1)},
    {text:'Off-topic detail',citations},{text:'Shared feature',citations}]},
    {checks:[{index:0,status:'supported',relevant:false},{index:1,status:'supported',relevant:true}]}];
  const result=await workflow('v3','WHAT ARE SIMILARITIES IN BOTH PAPERS',both,async()=>answers.shift());
  assert.deepEqual(result.claims.map(c=>c.text),['Shared feature']);
});

test('model inventories retain separately cited models during review',async()=>{
  const evidence=[...passages(['We trained model A.'],'D1'),...passages(['We trained model B.'],'D2')];
  const claims=evidence.map((p,i)=>({text:p.text,citations:[p.id]}));
  const replies=[{queries:['model'],answerMode:'per-paper',sharedDocuments:['D1','D2']},
    {papers:[]},{comparison:[]},{claims},{checks:claims.map((_,index)=>({index,status:'supported',relevant:true}))}];
  const result=await workflow('v3','What are the models used in these papers?',evidence,async()=>replies.shift());
  assert.deepEqual(result.claims,claims);
  assert.equal(result.checks.length,2);
});

test('mixed questions preserve independently supported answers alongside comparisons',async()=>{
  const evidence=[...passages(['Attendance rose from 20 to 25.'],'D1'),...passages(['Attendance rose.'],'D2')];
  const claims=[{text:'Both report rising attendance.',citations:evidence.map(p=>p.id)},
    {text:'The first study gained 5 attendees (25 minus 20).',citations:[evidence[0].id]}];
  const results=[{queries:['attendance'],answerMode:'other',sharedDocuments:['D1','D2']},
    {papers:[]},{comparison:[]},{claims},{checks:claims.map((_,index)=>({index,status:'supported',relevant:true}))}];
  const result=await workflow('v3','Describe similarities; calculate the change in the first study.',evidence,async()=>results.shift());
  assert.deepEqual(result.claims,claims);
});

test('empty V3 draft searches unseen passages and verifies the recovered answer',async()=>{
  const pages=passages(['attendance survey','attendance goal','attendance background','attendance increased by five'],'D1');
  const ask=async(_,data)=>{
    if(data.claims)return {checks:[{index:0,status:'supported',relevant:true}]};
    if(data.comparison)return {claims:data.notes[0].papers};
    if(data.notes)return {comparison:[]};
    if(data.plan)return {papers:data.sources.filter(p=>p.text.includes('five')).map(p=>({text:p.text,citations:[p.id]}))};
    return {queries:['attendance']};
  };
  const result=await workflow('v3','Attendance?',pages,ask);
  assert.deepEqual(result.claims,[{text:'attendance increased by five',citations:['D1-p4-1']}]);
  assert.equal(result.checks[0].status,'supported');
});
