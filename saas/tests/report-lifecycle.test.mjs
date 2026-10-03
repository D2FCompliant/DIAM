import {blankCyber} from '../public/cyber.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankLifecycle,normalizeLifecycle,assessLifecycle,STATUSES,TESTS,LIFECYCLE_FILE} from '../public/lifecycle.mjs';
import {readLifecycle,sha256,applyLifecycleGate,applyEvidenceGates} from '../worker/lifecycle-store.mjs';
import {structuredReportHtml,reportSummary,standaloneReport} from '../public/report-template.mjs';
import worker from '../worker/index.mjs';
import {createHmac} from 'node:crypto';
const proof={id:'p1',mission_id:'m1',tenant_id:'tenant',question_id:'q1',original_name:'payload.json',number:'EVD-1',sha256:'a'.repeat(64)};
function complete() {
  const d=blankLifecycle('m1');
  Object.assign(d,{reference_version:'XP Z12-012 — édition auditée',reference_locator:'Document contrôlé § cycle',scope:'Scénarios de test du périmètre PA',reviewer:'Auditeur de test',reviewed_at:'2026-10-03T12:00:00Z'});
  d.statuses.forEach(s=>s.implemented='YES');
  d.tests.forEach(t=>Object.assign(t,{result:'PASS',initial_state:'État établi',actor:'Acteur habilité',trigger:'Déclencheur observé',previous_status:'État initial documenté',next_status:'État autorisé documenté',transition_rule:'Règle applicable vérifiée',invoice_id:'TEST-INVOICE',correlation_id:'TEST-CORR',message_id:'TEST-MESSAGE',timestamp:'2026-10-03T11:00:00Z',journal_reference:'TEST-JOURNAL',observed:'Résultat de la fixture uniquement',reception:'Vérifiée dans fixture',si_restitution:'Vérifiée dans fixture',replay:'Idempotent',out_of_order:'Rejet contrôlé',payment_date:'2026-10-03',invoice_amount:'1200.00',payment_amount:'600.00',balance:'600.00',currency:'EUR',evidence_ids:['p1'],payload_evidence_id:'p1'}));
  return d;
}
test('a real blank dossier contains 14 statuses and 53 unevaluated cases, no invented facts',()=>{
 const d=blankLifecycle('m1');assert.equal(d.statuses.length,14);assert.equal(d.tests.length,53);assert.equal(d.mode,'REAL');
 assert.ok(d.tests.every(t=>t.result==='NOT_STARTED'&&!t.timestamp&&!t.message_id&&!t.observed&&!t.evidence_ids.length));assert.equal(assessLifecycle(d).status,'NOT_STARTED');
 assert.deepEqual(STATUSES.filter(s=>s.mandatory).map(s=>s.code),[200,210,212,213]);
});
test('complete documented fixture can be assessed without auto executing tests',()=>{const d=normalizeLifecycle(complete(),'m1',[proof]);const a=assessLifecycle(d,[proof]);assert.equal(a.status,'COMPLIANT');assert.equal(a.passed,53);});
test('cannot omit, duplicate or add a template test',()=>{for(const mutation of [d=>d.tests.pop(),d=>d.tests[0]=d.tests[1],d=>d.tests.push(d.tests[0])]){const d=complete();mutation(d);assert.throws(()=>normalizeLifecycle(d,'m1',[proof]),/campagne/);}});
test('cannot omit or duplicate a status',()=>{const d=complete();d.statuses[0]=d.statuses[1];assert.throws(()=>normalizeLifecycle(d,'m1',[proof]),/14 statuts/);});
test('rejects foreign mission dossier and proof ids',()=>{
 assert.throws(()=>normalizeLifecycle(complete(),'m2',[proof]),/mission incorrect/);
 assert.throws(()=>normalizeLifecycle(complete(),'m1',[{...proof,mission_id:'m2'}]),/extérieure/);
});
test('payload must belong to the selected proof list',()=>{const d=complete();d.tests[0].payload_evidence_id='missing';assert.throws(()=>normalizeLifecycle(d,'m1',[proof]),/Payload/);});
test('pass without observed traces is not demonstrated',()=>{const d=complete();d.tests[0].message_id='';assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('pass without source evidence is not demonstrated',()=>{const d=complete();d.tests[0].evidence_ids=[];assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('a dossier cannot prove itself or use an invalid source hash',()=>{for(const p of [{...proof,original_name:LIFECYCLE_FILE},{...proof,sha256:'invented'}])assert.equal(assessLifecycle(complete(),[p]).status,'NOT_STARTED');});
test('optional unsupported status is excluded with a reason, never marked passed',()=>{const d=complete();const s=d.statuses.find(s=>s.code===201);s.implemented='NO';s.justification='Fonction non proposée, revue du périmètre';const a=assessLifecycle(d,[proof]);assert.equal(a.status,'COMPLIANT');assert.equal(a.tests.find(t=>t.id==='CDV-201').effective,'NOT_APPLICABLE');assert.equal(a.passed,52);});
test('optional implemented status cannot be skipped',()=>{const d=complete();Object.assign(d.tests.find(t=>t.id==='CDV-201'),{result:'NOT_APPLICABLE',justification:'Excuse non suffisante'});assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('mandatory capability cannot be excluded because event does not occur on every invoice',()=>{const d=complete();Object.assign(d.tests.find(t=>t.id==='CDV-210'),{result:'NOT_APPLICABLE',justification:'Pas de refus sur cet échantillon'});assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('undeclared optional scope or unreasoned exclusion blocks completeness',()=>{for(const implemented of ['UNKNOWN','NO']){const d=complete();d.statuses[1].implemented=implemented;assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');}});
test('payment reconciliation is exact to cents and rejects altered totals',()=>{const d=complete();d.tests.find(t=>t.id==='PAY-212').balance='599.99';assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('failure is kept even with incomplete evidence',()=>{const d=blankLifecycle('m1');d.tests[0].result='FAIL';assert.equal(assessLifecycle(d,[]).status,'NON_COMPLIANT');});
test('synthetic dossier cannot support real conformity',()=>{const d=complete();d.mode='DEMO';assert.equal(assessLifecycle(d,[proof]).status,'NOT_STARTED');});
test('missing dossier downgrades reported compliance without mutating stored answer',()=>{const chain=[{reference:'DGFiP-3.9',reponse_statut:'COMPLIANT'}];const result=applyLifecycleGate(chain,{assessment:assessLifecycle(null)});assert.equal(result[0].reponse_statut,'NOT_STARTED');assert.equal(result[0].recorded_reponse_statut,'COMPLIANT');assert.equal(chain[0].reponse_statut,'COMPLIANT');});
test('failed lifecycle never hides an existing nonconformity',()=>{const chain=[{reference:'DGFiP-3.9',reponse_statut:'NON_COMPLIANT'}];assert.equal(applyLifecycleGate(chain,{assessment:assessLifecycle(null)})[0].reponse_statut,'NON_COMPLIANT');});
test('read verifies the bytes of the latest snapshot and retains evidence identity',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(complete()));const e={...proof,id:'matrix',original_name:LIFECYCLE_FILE,storage_path:'tenant/m1/matrix',sha256:await sha256(bytes)};
 const d=await readLifecycle({downloadFromBucket:async()=>bytes},'tenant','m1','q1',[e,proof]);assert.equal(d.assessment.status,'COMPLIANT');assert.equal(d.evidence.id,'matrix');assert.match(d.integrity,/vérifié/);
});
test('corrupt latest snapshot fails closed rather than falling back to old PASS',async()=>{
 const e={...proof,id:'matrix',original_name:LIFECYCLE_FILE,storage_path:'tenant/m1/matrix'};
 const d=await readLifecycle({downloadFromBucket:async()=>new Uint8Array([1,2])},'tenant','m1','q1',[e,proof]);assert.equal(d.assessment.status,'NOT_STARTED');assert.equal(d.dossier,null);assert.match(d.integrity,/ÉCHEC/);
});
test('snapshot read never follows a different tenant storage path',async()=>{let called=false;const e={...proof,original_name:LIFECYCLE_FILE,storage_path:'other/m1/matrix'};const d=await readLifecycle({downloadFromBucket:async()=>{called=true;}},'tenant','m1','q1',[e]);assert.equal(called,false);assert.equal(d.dossier,null);});
test('PA report has ordered 9 chapters and four annexes, real counts and full hashes',()=>{
 const d=complete(), out={template:{id:'D2F-PA-STRUCTURED'},mission:{id:'m1',title:'Audit réel'},client:{name:'Client réel'},chain:[{reference:'DGFiP-3.9',reponse_statut:'COMPLIANT',evidence_ids:['p1']}],evidences:[proof],lifecycle:{dossier:d,assessment:assessLifecycle(d,[proof])},result:{opinion:'CONFORME'}};
 const html=structuredReportHtml(out);let at=-1;for(const title of ['1. Synthèse','2. Périmètre','3. Méthode','4. Résultats','5. Audit','6. Cybersécurité','7. Constats','8. Contrôle','9. Conclusion','Annexe A','Annexe B','Annexe C','Annexe D']){const next=html.indexOf(title);assert.ok(next>at,title);at=next;}
 assert.ok(html.includes(proof.sha256));assert.ok(html.includes('53/53'));assert.equal(reportSummary(out.chain).find(r=>r[0]==='Conforme')[1],1);
 assert.ok(standaloneReport(out).startsWith('<!doctype html>'));
});
test('untrusted client, observation and proof names are escaped in all report fields',()=>{const html=structuredReportHtml({client:{name:'<script>alert(1)</script>'},evidences:[{...proof,original_name:'<img src=x onerror=alert(1)>'}]});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));});
test('synthetic mission is visibly labelled and not presented as anonymized real audit',()=>{const html=structuredReportHtml({mission:{title:'[DEMO FICTIVE] exemple'}});assert.match(html,/DÉMONSTRATION FICTIVE — NON OPPOSABLE/);});
test('new lifecycle and report retrieval endpoints require authentication',async()=>{
 for(const path of ['/api/lifecycle?mission_id=m1','/api/reports?mission_id=m1']){const response=await worker.fetch(new Request(`https://diam.test${path}`),{});assert.ok([401,503].includes(response.status));}
});

test('API lifecycle snapshots are append-only, mission scoped, retry safe and detect stale edits',async()=>{
 const originalFetch=globalThis.fetch, rows=[], events=[], objects=new Map();let allow=true;
 globalThis.fetch=async(url,options={})=>{
   const u=new URL(url), name=u.pathname.split('/').at(-1), body=options.body && typeof options.body==='string'?JSON.parse(options.body):null;
   if(u.pathname.includes('/storage/')) {
     const key=u.pathname.split('/diam-evidence/')[1];
     if(options.method==='POST'){objects.set(key,options.body);return new Response('{}');}
     return new Response(objects.get(key));
   }
   let data=[];
   if(name==='diam_tenants') data=[{id:'tenant'}];
   if(name==='diam_users') data=[{id:'auditor',role:'AUDITOR',status:'ACTIVE'}];
   if(name==='diam_mission_auditors') data=allow?[{id:'assignment'}]:[];
   if(name==='diam_missions') data=[{id:'m1'}];
   if(name==='diam_questions') data=[{id:'q1',reference:'DGFiP-3.9',mission_id:'m1'}];
   if(name==='diam_evidences') {
     if(options.method==='POST'){const e={...body,id:`e${rows.length}`,uploaded_at:new Date().toISOString()};rows.unshift(e);data=[e];}
     else if(options.method==='PATCH'){Object.assign(rows[0],body);data=[rows[0]];}
     else data=rows;
   }
   if(name==='diam_audit_events'&&options.method==='POST'){events.push(body);data=[{id:'event',...body}];}
   if(name==='diam_archive_events') data=[{id:'archive',...body}];
   return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 const env={DIAM_ADMIN_EMAIL:'owner@example.invalid',DIAM_ADMIN_PASSWORD:'fixture-password',DIAM_SESSION_SECRET:'fixture-secret',SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',SAE_ENABLED:'false'};
 const payload=Buffer.from(JSON.stringify({email:'auditor@example.invalid',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
 const cookie=`diam_session=${payload}.${createHmac('sha256',env.DIAM_SESSION_SECRET).update(payload).digest('hex')}`;
 const call=(method,body)=>worker.fetch(new Request('https://diam.test/api/lifecycle?mission_id=m1',{method,headers:{cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 try {
   allow=false;assert.equal((await call('GET')).status,403);assert.equal(rows.length,0);
   allow=true;const first=await (await call('GET')).json();assert.equal(first.evidence,null);
   const input={mission_id:'m1',base_evidence_id:null,dossier:blankLifecycle('m1')};
   const savedResponse=await call('POST',input);assert.equal(savedResponse.status,201);const saved=await savedResponse.json();
   assert.equal(rows.length,1);assert.equal(events.length,1);assert.equal(rows[0].question_id,'q1');assert.equal(rows[0].tenant_id,'tenant');
   const reopened=await (await call('GET')).json();assert.equal(reopened.evidence.id,saved.evidence.id);assert.match(reopened.integrity,/vérifié/);
   input.base_evidence_id=saved.evidence.id;
   const retry=await (await call('POST',input)).json();assert.equal(retry.unchanged,true);assert.equal(rows.length,1);
   input.dossier.scope='Nouveau périmètre';assert.equal((await call('POST',input)).status,201);assert.equal(rows.length,2);
   assert.equal((await call('POST',input)).status,200);assert.equal(rows.length,2);
   input.dossier.scope='Modification concurrente';assert.equal((await call('POST',input)).status,409);assert.equal(rows.length,2);
   assert.equal(events.length,2);assert.equal(events[1].details.previous_evidence_id,saved.evidence.id);
 } finally {globalThis.fetch=originalFetch;}
});

test('PA evidence gate blocks unsupported compliance and unjustified exclusion',()=>{
 const rows=[{reference:'DGFiP-1.1',reponse_statut:'COMPLIANT',analyse_auditeur:'Analyse',evidence_ids:[]},{reference:'DGFiP-A9',reponse_statut:'NOT_APPLICABLE',analyse_auditeur:''}];
 assert.ok(applyEvidenceGates(rows,[proof]).every(r=>r.reponse_statut==='NOT_STARTED'));
 rows[0].evidence_ids=['p1'];assert.equal(applyEvidenceGates(rows,[proof])[0].reponse_statut,'COMPLIANT');
});

test('audit period validates real dates and roundtrips PostgreSQL exclusive end dates',async()=>{
 const {auditPeriod,periodDates,periodLabel}=await import('../public/audit-period.mjs');
 assert.equal(auditPeriod('2026-09-01','2026-09-30'),'[2026-09-01,2026-09-30]');
 assert.deepEqual(periodDates('[2026-09-01,2026-10-01)'),{start:'2026-09-01',end:'2026-09-30'});
 assert.equal(periodLabel('[2026-09-01,2026-10-01)'),'2026-09-01 au 2026-09-30');
 for(const dates of [['2026-02-30','2026-03-01'],['2026-10-03','2026-09-30'],['2026-09-01','']])assert.throws(()=>auditPeriod(...dates),/invalide/);
 assert.equal(auditPeriod('',''),null);
});
test('new matrices never presume a platform implements a status',()=>{assert.ok(blankLifecycle('m1').statuses.every(s=>s.implemented==='UNKNOWN'));});

test('API Cyber snapshots are append-only, mission scoped, retry safe and detect stale edits',async()=>{
 const originalFetch=globalThis.fetch, rows=[], events=[], objects=new Map();let allow=true;
 globalThis.fetch=async(url,options={})=>{
   const u=new URL(url), name=u.pathname.split('/').at(-1), body=options.body && typeof options.body==='string'?JSON.parse(options.body):null;
   if(u.pathname.includes('/storage/')) {
     const key=u.pathname.split('/diam-evidence/')[1];
     if(options.method==='POST'){objects.set(key,options.body);return new Response('{}');}
     return new Response(objects.get(key));
   }
   let data=[];
   if(name==='diam_tenants') data=[{id:'tenant'}];
   if(name==='diam_users') data=[{id:'auditor',role:'AUDITOR',status:'ACTIVE'}];
   if(name==='diam_mission_auditors') data=allow?[{id:'assignment'}]:[];
   if(name==='diam_missions') data=[{id:'m1'}];
   if(name==='diam_questions') data=[{id:'q1',reference:'DGFiP-7.3',mission_id:'m1'}];
   if(name==='diam_evidences') {
     if(options.method==='POST'){const e={...body,id:`e${rows.length}`,uploaded_at:new Date().toISOString()};rows.unshift(e);data=[e];}
     else if(options.method==='PATCH'){Object.assign(rows[0],body);data=[rows[0]];}
     else data=rows;
   }
   if(name==='diam_audit_events'&&options.method==='POST'){events.push(body);data=[{id:'event',...body}];}
   if(name==='diam_archive_events') data=[{id:'archive',...body}];
   return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 const env={DIAM_ADMIN_EMAIL:'owner@example.invalid',DIAM_ADMIN_PASSWORD:'fixture-password',DIAM_SESSION_SECRET:'fixture-secret',SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',SAE_ENABLED:'false'};
 const payload=Buffer.from(JSON.stringify({email:'auditor@example.invalid',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
 const cookie=`diam_session=${payload}.${createHmac('sha256',env.DIAM_SESSION_SECRET).update(payload).digest('hex')}`;
 const call=(method,body)=>worker.fetch(new Request('https://diam.test/api/cyber?mission_id=m1',{method,headers:{cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 try {
   allow=false;assert.equal((await call('GET')).status,403);assert.equal(rows.length,0);
   allow=true;const first=await (await call('GET')).json();assert.equal(first.evidence,null);
   const input={mission_id:'m1',base_evidence_id:null,dossier:blankCyber('m1')};
   const savedResponse=await call('POST',input);assert.equal(savedResponse.status,201);const saved=await savedResponse.json();
   assert.equal(rows.length,1);assert.equal(events.length,1);assert.equal(rows[0].question_id,'q1');assert.equal(rows[0].tenant_id,'tenant');
   const reopened=await (await call('GET')).json();assert.equal(reopened.evidence.id,saved.evidence.id);assert.match(reopened.integrity,/vérifié/);
   input.base_evidence_id=saved.evidence.id;
   const retry=await (await call('POST',input)).json();assert.equal(retry.unchanged,true);assert.equal(rows.length,1);
   input.dossier.tests[0].scope='Nouveau périmètre';assert.equal((await call('POST',input)).status,201);assert.equal(rows.length,2);
   assert.equal((await call('POST',input)).status,200);assert.equal(rows.length,2);
   input.dossier.tests[0].scope='Modification concurrente';assert.equal((await call('POST',input)).status,409);assert.equal(rows.length,2);
   assert.equal(events.length,2);assert.equal(events[1].details.previous_evidence_id,saved.evidence.id);
 } finally {globalThis.fetch=originalFetch;}
});
