export function validateReference(input){
 const text=(key,max=2000)=>{const v=input[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Champ de référentiel requis ou invalide : ${key}.`);return v.trim();};
 if(!/^[a-f0-9-]{36}$/i.test(input.document_id||''))throw new Error('Document de référence invalide.');
 if(!['PA_DGFIP','SC_RLFC','CUSTOM_CDC'].includes(input.program))throw new Error('Programme invalide.');
 if(!['DRAFT','VALIDATED','RETIRED'].includes(input.status))throw new Error('Statut invalide.');
 return {document_id:input.document_id,program:input.program,title:text('title',500),edition:text('edition',200),origin:text('origin'),scope:text('scope'),status:input.status};
}
export async function referenceLibrary({request,path,db,tenant,currentUser,who,requireAdminUser,json}){
 if(path!=='/api/reference-library')return null;
 if(request.method==='GET'){
  const [docs,events]=await Promise.all([db.select('diam_documents',`?tenant_id=eq.${tenant.id}&document_scope=eq.GLOBAL&order=uploaded_at.desc`),db.select('diam_audit_events',`?tenant_id=eq.${tenant.id}&object_type=eq.REFERENCE_LIBRARY&order=created_at.desc&limit=1000`)]);
  return json(docs.map(d=>{const event=events.find(e=>e.object_id===d.id);return {...d,catalogue:event?{...event.details,recorded_at:event.created_at,recorded_by:event.actor}:null};}));
 }
 if(request.method==='POST'){
  requireAdminUser(currentUser);let metadata;try{metadata=validateReference(await request.json());}catch(e){return json({error:e.message},400);}
  const doc=(await db.select('diam_documents',`?tenant_id=eq.${tenant.id}&id=eq.${metadata.document_id}&document_scope=eq.GLOBAL`))[0];
  if(!doc)return json({error:'Référentiel absent de la bibliothèque transverse.'},404);
  const event=await db.insert('diam_audit_events',{tenant_id:tenant.id,mission_id:null,actor:who,event_type:'REFERENCE_LIBRARY_REVIEWED',object_type:'REFERENCE_LIBRARY',object_id:doc.id,details:{...metadata,sha256:doc.sha256}});
  return json({document_id:doc.id,catalogue:{...event.details,recorded_at:event.created_at,recorded_by:event.actor}},201);
 }
 return json({error:'Méthode non prise en charge.'},405);
}
