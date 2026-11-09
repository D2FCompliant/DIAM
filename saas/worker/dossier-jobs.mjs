import {DOCUMENTARY_VERSION,validateExtractions,documentaryReview} from './documentary-review.mjs';
import {reviewTargets,selectReviewDocuments,fingerprintReview,launchReview,openAIRequest,cleanupReviewFiles,validateReview} from './dossier-review.mjs';
import {sha256} from './lifecycle-store.mjs';
const uuid = h => `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
export async function dossierJobs({request,url,path,db,env,tenant,currentUser,who,ensureMissionAccess,json}) {
 if(!path.startsWith('/api/dossier-reviews'))return null;
 const body=request.method==='POST'?await request.json():{};
 const missionId=body.mission_id||url.searchParams.get('mission_id');
 if(!/^[a-f0-9-]{36}$/i.test(missionId||''))return json({error:'Mission invalide.'},400);
 const mission=await ensureMissionAccess(db,tenant.id,missionId,currentUser);
 const base=`?tenant_id=eq.${tenant.id}&mission_id=eq.${missionId}&object_type=eq.DOSSIER_REVIEW`;
 const events=(id='')=>db.select('diam_audit_events',base+(id?`&object_id=eq.${id}`:'')+'&order=created_at.desc&limit=200');
 const record=(id,type,details,eventId)=>db.insert('diam_audit_events',{...(eventId?{id:eventId}:{}),tenant_id:tenant.id,mission_id:missionId,actor:who,event_type:type,object_type:'DOSSIER_REVIEW',object_id:id,details});
 const publicJob=e=>({id:e.object_id,status:e.event_type.replace('DOSSIER_REVIEW_',''),created_at:e.created_at,...Object.fromEntries(Object.entries(e.details||{}).filter(([k])=>!['response_id','file_ids'].includes(k)))});
 if(path==='/api/dossier-reviews'&&request.method==='GET'){
  const rows=await events(),seen=new Set();return json(rows.filter(e=>{if(seen.has(e.object_id))return false;seen.add(e.object_id);return true;}).map(publicJob));
 }
 if(path==='/api/dossier-reviews'&&request.method==='POST'){
  const local=body.mode==='DOCUMENTARY';
  if(body.mode&&!['DOCUMENTARY','AI'].includes(body.mode))return json({error:'Mode de préparation invalide.'},400);
  if(!local&&!env.OPENAI_API_KEY)return json({error:'Analyse non exécutée : clé API absente côté DIAM.'},503);
  if(mission.client_id){const client=(await db.select('diam_clients',`?tenant_id=eq.${tenant.id}&id=eq.${mission.client_id}`))[0];mission.client_scope=client?.scope||{};}
  let targets,docs;
  try{targets=reviewTargets(body.phase,await db.select('diam_questions',`?tenant_id=eq.${tenant.id}&mission_id=eq.${missionId}&order=reference.asc`));
   if(!targets.length)throw new Error('Le programme de cette mission ne contient aucun contrôle.');
   docs=selectReviewDocuments(await db.select('diam_documents',`?tenant_id=eq.${tenant.id}&or=(mission_id.eq.${missionId},document_scope.eq.GLOBAL)`),body.documents,tenant.id,missionId,{documentary:local});
  }catch(e){return json({error:e.message},400);}
  const references=await db.select('diam_audit_events',`?tenant_id=eq.${tenant.id}&object_type=eq.REFERENCE_LIBRARY&order=created_at.desc&limit=1000`);
  for(const d of docs.filter(d=>d.role==='REFERENCE')){
   const review=references.find(e=>e.object_id===d.id)?.details;
   if(!local&&(!review||review.status!=='VALIDATED'||review.sha256!==d.sha256))return json({error:`Référentiel à identifier et valider dans Administration avant analyse : ${d.original_name}.`},409);
   d.reference=review&&review.sha256===d.sha256?{title:review.title,edition:review.edition,origin:review.origin,scope:review.scope,program:review.program,status:review.status}:{status:'UNVALIDATED'};
  }
  let indexes,indexHash;
  if(local){try{indexes=validateExtractions(body.extractions,docs);indexHash=await sha256(new TextEncoder().encode(JSON.stringify(indexes)));}catch(e){return json({error:e.message},400);}}
  const model=local?DOCUMENTARY_VERSION:env.OPENAI_MODEL||'gpt-5';
  const fingerprint=await fingerprintReview(mission,body.phase,targets,docs,local?`${model}:${indexHash}`:model);
  if(body.retry_of&&!/^[a-f0-9-]{36}$/i.test(body.retry_of))return json({error:'Identifiant de reprise invalide.'},400);
  const rows=body.retry_of?await events(body.retry_of):[];
  if(body.retry_of){const prior=rows.find(e=>e.object_id===body.retry_of);if(!prior||!['DOSSIER_REVIEW_FAILED','DOSSIER_REVIEW_COMPLETED'].includes(prior.event_type)||prior.details.fingerprint!==fingerprint)return json({error:'Seule une préparation terminée du même dossier peut être relancée.'},409);}
  const id=uuid(body.retry_of?await sha256(new TextEncoder().encode(`${fingerprint}:${body.retry_of}`)):fingerprint),existing=(await events(id))[0];
  if(existing)return json(publicJob(existing));
  const metadata={fingerprint,phase:body.phase,model,mode:local?'DOCUMENTARY':'AI',mission_context:{number:mission.number,title:mission.title,period:mission.audit_period,referential:mission.referential_version,audit_type:mission.audit_type,client_scope:mission.client_scope},targets,documents:docs.map(({id,original_name,sha256,role,reference})=>({id,original_name,sha256,role,reference}))};
  if(local){const result=documentaryReview(targets,docs,indexes),details={...metadata,extraction_sha256:indexHash,extractions:indexes.map(x=>({document_id:x.document_id,source_sha256:x.source_sha256,extractor:x.extractor,pages:x.pages.length})),result,result_sha256:await sha256(new TextEncoder().encode(JSON.stringify(result)))};try{return json(publicJob(await record(id,'DOSSIER_REVIEW_COMPLETED',details,id)),201);}catch(e){const prior=(await events(id))[0];if(prior)return json(publicJob(prior));throw e;}}
  // A deterministic primary key prevents two concurrent clicks from launching two paid jobs.
  try{await record(id,'DOSSIER_REVIEW_REQUESTED',metadata,id);}catch(e){const prior=(await events(id))[0];if(prior)return json(publicJob(prior));throw e;}
  let launched;
  try{launched=await launchReview(env,db,mission,targets,docs);const e=await record(id,'DOSSIER_REVIEW_STARTED',{...metadata,...launched});return json(publicJob(e),202);}
  catch(e){if(launched){await openAIRequest(env,`responses/${launched.response_id}/cancel`,{method:'POST'}).catch(()=>{});await cleanupReviewFiles(env,launched.file_ids);}
   await record(id,'DOSSIER_REVIEW_FAILED',{...metadata,error:e.message});return json({error:e.message},502);}
 }
 const match=path.match(/^\/api\/dossier-reviews\/([a-f0-9-]{36})$/i);
 if(!match||request.method!=='GET')return json({error:'Route de préparation inconnue.'},404);
 const rows=await events(match[1]),latest=rows[0];
 if(!latest)return json({error:'Préparation introuvable dans cette mission.'},404);
 if(latest.event_type!=='DOSSIER_REVIEW_STARTED')return json(publicJob(latest));
 const d=latest.details;
 let response;
 try{response=await openAIRequest(env,`responses/${encodeURIComponent(d.response_id)}`);}catch(e){if(![404,410].includes(e.providerStatus))throw e;response={status:'expired',error:{message:'Résultat fournisseur expiré ou indisponible. Relancer explicitement l’analyse.'}};}
 if(['queued','in_progress'].includes(response.status))return json(publicJob(latest));
 let final;
 try{
  if(response.status!=='completed')throw new Error(`Analyse ${response.status} : ${response.error?.message||response.incomplete_details?.reason||'aucun résultat validé'}`);
  const output=(response.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  const result=validateReview(JSON.parse(output),d.targets,d.documents);
  final={...d,result,result_sha256:await sha256(new TextEncoder().encode(JSON.stringify(result)))};
 }catch(e){final={...d,error:e.message};}
 const type=final.result?'COMPLETED':'FAILED';
 const terminalId=uuid(await sha256(new TextEncoder().encode(`${match[1]}:terminal`)));
 let saved;
 try{saved=await record(match[1],`DOSSIER_REVIEW_${type}`,final,terminalId);}catch(e){saved=(await events(match[1])).find(e=>e.id===terminalId);if(!saved)throw e;}
 // Delete provider input copies only after the result is durably saved.
 const retained=await cleanupReviewFiles(env,d.file_ids);
 if(retained.length)await db.insert('diam_audit_events',{tenant_id:tenant.id,mission_id:missionId,actor:who,event_type:'DOSSIER_REVIEW_CLEANUP_PENDING',object_type:'AI_FILE_CLEANUP',object_id:match[1],details:{file_ids:retained}});
 return json(publicJob(saved));
}
