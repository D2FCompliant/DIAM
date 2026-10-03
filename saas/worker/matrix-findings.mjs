// Extend the existing one-finding-per-control workflow; never replace historical identity or closure evidence.
export function matrixGaps(lifecycle,cyber) {
 const rows=[];
 if(lifecycle.assessment.status!=='COMPLIANT') rows.push({control:'DGFiP-3.9',id:'CDV',title:'Audit des cycles de vie de la facture',reason:[...lifecycle.assessment.issues,...lifecycle.assessment.tests.filter(t=>!['PASS','NOT_APPLICABLE'].includes(t.effective)).map(t=>`${t.id} : ${t.missing?.join(' ')||t.effective}`)].join('\n'),expected:'Liste des statuts facultatifs déclarés, tests unitaires positifs/négatifs, messages de cycle de vie, transitions et journaux corrélés.'});
 for(const t of cyber.assessment.tests) if(!['COMPLIANT','NOT_APPLICABLE'].includes(t.effective)) rows.push({control:t.control,id:t.id,title:t.title,reason:[t.observed,...t.missing].filter(Boolean).join(' '),expected:t.recommendation||t.expected});
 return rows;
}
export async function reconcileMatrixFindings(db,{tenantId,missionId,actor,chain,lifecycle,cyber,revision}) {
 const rows=matrixGaps(lifecycle,cyber),groups=new Map();for(const row of rows){const group=groups.get(row.control)||[];group.push(row);groups.set(row.control,group);}
 let changed=0,unchanged=0;const results=[];
 for(const [reference,gaps] of groups) {
 const q=chain.find(r=>r.reference===reference);if(!q)throw new Error(`Contrôle ${reference} absent : aucun rattachement substitué.`);
 const marker=`[MATRICES ${revision} ${reference}]`;
 const old=(await db.select('diam_findings',`?tenant_id=eq.${tenantId}&question_id=eq.${q.question_id}`))[0];
 if(old?.summary?.includes(marker)){unchanged++;results.push({reference,number:old.number,unchanged:true});continue;}
 const addition=marker+'\n'+gaps.map(g=>`${g.id} — ${g.title}\nÉléments non démontrés / limites : ${g.reason}\nPièces / action attendues : ${g.expected}`).join('\n\n');
 // Record the previous state before mutation. A failed write leaves a pending, visible attempt rather than erasing history.
 const event=await db.insert('diam_audit_events',{tenant_id:tenantId,mission_id:missionId,actor,event_type:'MATRIX_FINDINGS_RECONCILIATION_REQUESTED',object_type:'FINDING',object_id:old?.id||q.question_id,details:{reference,revision,previous:old||null,gaps}});
 const values={summary:[old?.summary,addition].filter(Boolean).join('\n\n'),recommendation:[old?.recommendation,'Compléter les éléments des matrices, recueillir le contradictoire, puis effectuer les contre-tests et la revue avant clôture.'].filter(Boolean).join('\n'),status:'OPEN',updated_at:new Date().toISOString()};
 const f=old?await db.patch('diam_findings',`?id=eq.${old.id}&tenant_id=eq.${tenantId}`,values):await db.upsert('diam_findings',{...values,tenant_id:tenantId,question_id:q.question_id,number:`CST-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`,base_qualification:q.qualification_base,retained_qualification:q.qualification_retenue,created_by:actor},'question_id');
 await db.insert('diam_audit_events',{tenant_id:tenantId,mission_id:missionId,actor,event_type:'MATRIX_FINDINGS_RECONCILED',object_type:'FINDING',object_id:f.id,details:{request_event_id:event.id,reference,revision,number:f.number}});
 changed++;results.push({reference,number:f.number});
 }
 return {changed,unchanged,results};
}
