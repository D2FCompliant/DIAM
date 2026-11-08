import {blankPreparation,normalizePreparation,normalizeParticipants,normalizeMethod,planIssues,publicPreparation,canonical} from '../public/audit-preparation.mjs';
import {sha256} from './lifecycle-store.mjs';
const hash=v=>sha256(new TextEncoder().encode(canonical(v)));
const uuid=h=>`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
const validId=v=>/^[a-f0-9-]{36}$/i.test(v||'');
const signedView=p=>({...p,client_confirmation:null,approval:null});
export async function auditPreparationStore({request,url,path,db,tenant,currentUser,who,ensureMissionAccess,ensureClientMissionAccess,requireAdminUser,json}){
 if(!['/api/audit-methods','/api/audit-preparation','/api/client/preparation'].includes(path))return null;
 const eventBase=`?tenant_id=eq.${tenant.id}`;
 if(path==='/api/audit-methods'){
  if(request.method==='GET'){const events=await db.select('diam_audit_events',eventBase+'&object_type=eq.AUDIT_METHOD&order=created_at.desc&limit=1000');const seen=new Set();return json(events.filter(e=>{if(seen.has(e.object_id))return false;seen.add(e.object_id);return true;}).map(e=>({id:e.object_id,revision:e.id,recorded_by:e.actor,recorded_at:e.created_at,...e.details.method})));}
  if(request.method!=='POST')return json({error:'Méthode non prise en charge.'},405);
  requireAdminUser(currentUser);const body=await request.json();let method;try{method=normalizeMethod(body.method);}catch(e){return json({error:e.message},400);}const id=body.id||crypto.randomUUID();if(!validId(id))return json({error:'Profil invalide.'},400);
  const prior=(await db.select('diam_audit_events',eventBase+`&object_type=eq.AUDIT_METHOD&object_id=eq.${id}&order=created_at.desc&limit=1`))[0];if((prior?.id||null)!==(body.base_revision||null))return json({error:'Le profil a changé. Recharge sa dernière version.'},409);
  const e=await db.insert('diam_audit_events',{id:uuid(await hash({tenant:tenant.id,id,base:prior?.id||null})),tenant_id:tenant.id,mission_id:null,actor:who,event_type:'AUDIT_METHOD_SAVED',object_type:'AUDIT_METHOD',object_id:id,details:{method,previous_revision:prior?.id||null,sha256:await hash(method)}});return json({id,revision:e.id,...method},201);
 }
 const isClient=path==='/api/client/preparation';
 const body=request.method==='POST'?await request.json():{};
 const missionId=url.searchParams.get('mission_id')||body.mission_id;
 if(!validId(missionId))return json({error:'Mission invalide.'},400);
 const mission=isClient?await ensureClientMissionAccess(db,tenant,request,currentUser):await ensureMissionAccess(db,tenant.id,missionId,currentUser);
 if(mission.id!==missionId)return json({error:'Mission incohérente.'},403);
 const eventsQuery=eventBase+`&mission_id=eq.${mission.id}&object_type=eq.AUDIT_PREPARATION&order=created_at.desc&limit=1`;
 const latest=(await db.select('diam_audit_events',eventsQuery))[0];let plan=latest?.details.plan||blankPreparation(mission.id);
 if(!latest&&mission.client_id){const client=(await db.select('diam_clients',eventBase+`&id=eq.${mission.client_id}`))[0];if(client){plan.letter.audited_entity=[client.name,client.address,[client.scope?.client_postal_code,client.city].filter(Boolean).join(' '),client.country].filter(Boolean).join('\n');plan.letter.scope=client.scope?.declared_scope||'';}plan.letter.criteria=mission.referential_version||'';}
 if(latest&&await hash(plan)!==latest.details.sha256)return json({error:'Intégrité de la préparation non vérifiée. Aucun état antérieur n’est substitué.'},409);
 const questions=await db.select('diam_questions',eventBase+`&mission_id=eq.${mission.id}&order=reference.asc`);
 const catalogue=questions.map(({id,reference,title})=>({id,reference,title}));
 const output=(p,revision)=>({revision,mission:{id:mission.id,number:mission.number,title:mission.title},plan:isClient?publicPreparation(p):p,questions:catalogue,issues:isClient?[]:planIssues(p,catalogue),confirmation_current:Boolean(p.client_confirmation&&p.client_confirmation.plan_sha256===latest?.details.content_sha256)});
 if(request.method==='GET')return json(output(plan,latest?.id||null));
 if(request.method!=='POST')return json({error:'Méthode non prise en charge.'},405);
 const allowed=isClient?['CLIENT_PARTICIPANTS','CLIENT_CONFIRM']:['AUDITOR_SAVE','AUDITOR_APPROVE'];if(!allowed.includes(body.action))return json({error:'Action non autorisée pour cet espace.'},403);
 const inputHash=await hash({action:body.action,plan:body.plan||null,participants:body.participants||null,actor_name:body.actor_name||'',comment:body.comment||''});
 if((latest?.id||null)!==(body.base_revision||null)){if(latest?.details.input_sha256===inputHash)return json(output(plan,latest.id));return json({error:'La préparation a été modifiée. Recharge-la avant d’enregistrer pour préserver les réponses déjà reçues.'},409);}
 try{
 if(body.action==='AUDITOR_SAVE'){
  const documents=await db.select('diam_documents',eventBase+`&mission_id=eq.${mission.id}`);const old=plan;plan=normalizePreparation(body.plan,mission.id,catalogue,documents);plan.prepared_by=[...new Set([...(old.prepared_by||[]),who])];
  const method=body.plan.method_profile;if(method){if(!validId(method.id)||!validId(method.revision))throw new Error('Profil de pratiques invalide.');const e=(await db.select('diam_audit_events',eventBase+`&object_type=eq.AUDIT_METHOD&object_id=eq.${method.id}&id=eq.${method.revision}`))[0];if(!e||e.details.method.status!=='VALIDATED')throw new Error('Choisis un profil validé par l’administrateur.');if(old.method_profile?.revision!==method.revision){const latestMethod=(await db.select('diam_audit_events',eventBase+`&object_type=eq.AUDIT_METHOD&object_id=eq.${method.id}&order=created_at.desc&limit=1`))[0];if(latestMethod?.id!==method.revision||latestMethod.details.method.status!=='VALIDATED')throw new Error('Ce profil a été remplacé ou retiré. Choisis sa version actuellement validée.');}plan.method_profile={id:method.id,revision:e.id,...e.details.method};}
  if(plan.letter.status==='ISSUED'&&['contracting_party','audited_entity','objectives','scope','criteria','terms','lead_auditor'].some(k=>!plan.letter[k].trim()))throw new Error('Complète les objectifs, le périmètre, les critères, les conditions et le responsable avant émission de la lettre.');
  if(await hash(signedView(plan))===await hash(signedView(old))){plan.client_confirmation=old.client_confirmation;plan.approval=old.approval;}
 }else if(body.action==='CLIENT_PARTICIPANTS'){
  const participants=normalizeParticipants(body.participants);if(plan.schedule.some(s=>s.participant_ids.some(id=>!participants.some(p=>p.id===id))))throw new Error('Un participant est affecté au planning : demande à l’auditeur de le retirer avant suppression.');plan={...plan,participants,client_confirmation:null,approval:null};
 }else if(body.action==='CLIENT_CONFIRM'){
  const name=String(body.actor_name||'').trim(),comment=String(body.comment||'');if(!name||name.length>200||comment.length>4000)throw new Error('Renseigne le nom de la personne confirmant le planning.');
  const issues=planIssues({...plan,method_profile:plan.method_profile?{...plan.method_profile,require_signed_letter:false,require_control_mapping:false}:null},catalogue);if(issues.length)throw new Error('Planning à compléter avant confirmation : '+issues.join(' '));
  plan={...plan,client_confirmation:{actor_name:name,comment,confirmed_at:new Date().toISOString(),plan_sha256:await hash(signedView(plan)),kind:'ORGANISATION_ACKNOWLEDGEMENT'},approval:null};
 }else{
  const issues=planIssues(plan,catalogue);if(issues.length)throw new Error(issues.join(' '));if(!plan.client_confirmation||plan.client_confirmation.plan_sha256!==await hash(signedView(plan)))throw new Error('Confirmation du client absente ou devenue obsolète.');
  if(plan.method_profile?.independent_review&&(plan.prepared_by||[]).includes(who))throw new Error('Ce profil exige une revue par une personne qui n’a pas préparé le plan.');
  if(!currentUser?.fullAccess){const assignments=await db.select('diam_mission_auditors',eventBase+`&mission_id=eq.${mission.id}&user_id=eq.${currentUser.id}&mission_role=eq.REVIEWER&revoked_at=is.null`);if(!assignments.length)throw new Error('Approbation réservée au relecteur affecté ou à l’administrateur.');}
  plan={...plan,approval:{approved_by:who,approved_at:new Date().toISOString(),scope:'AUDIT_PREPARATION_ONLY'}};
 }
 }catch(e){return json({error:e.message},400);}
 const eventId=uuid(await hash({tenant:tenant.id,mission:mission.id,base:latest?.id||null,type:'AUDIT_PREPARATION'}));
 const contentHash=await hash(signedView(plan));let saved;
 try{saved=await db.insert('diam_audit_events',{id:eventId,tenant_id:tenant.id,mission_id:mission.id,actor:isClient?'CLIENT_PORTAL':who,event_type:body.action,object_type:'AUDIT_PREPARATION',object_id:mission.id,details:{plan,sha256:await hash(plan),content_sha256:contentHash,input_sha256:inputHash,previous_revision:latest?.id||null}});}catch(e){const current=(await db.select('diam_audit_events',eventsQuery))[0];if(current?.details.input_sha256===inputHash)return json(output(current.details.plan,current.id));return json({error:'Enregistrement concurrent ou indisponible. Recharge pour vérifier la version conservée.'},409);}
 return json({...output(plan,saved.id),confirmation_current:Boolean(plan.client_confirmation?.plan_sha256===contentHash)},201);
}
