import {STATUSES, TESTS, TEST_FIELDS, LIFECYCLE_FILE} from './lifecycle.mjs';
import {esc, resultLabel} from './report-template.mjs';
export function downloadFile(name,content,type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function bindLifecycle({api,getMission,run,showTab,refresh}) {
  const $=id=>document.getElementById(id);
  let current=null,missionId='',selected='CDV-200',dirty=false;
  const drafts=new Map();
  const status=message=>{$('lifecycleStatus').textContent=message;};
  const opt=(value,label,selectedValue)=>`<option value="${esc(value)}" ${value===selectedValue?'selected':''}>${esc(label)}</option>`;
  function capture() {
    if(!current?.dossier) return;
    for(const key of ['mode','reference_version','reference_locator','scope','reviewer','reviewed_at']) current.dossier[key]=$(`lc-${key}`).value;
    for(const row of current.dossier.statuses) {row.implemented=$(`lc-status-${row.code}`).value;row.justification=$(`lc-why-${row.code}`).value;}
    const t=current.dossier.tests.find(t=>t.id===selected);
    for(const key of Object.keys(TEST_FIELDS)) t[key]=$(`lc-test-${key}`).value;
    t.result=$('lc-test-result').value;
    t.evidence_ids=[...document.querySelectorAll('#lc-proof-list input:checked')].map(x=>x.value);
    t.payload_evidence_id=$('lc-payload').value;
  }
  function renderTest() {
    const t=current.dossier.tests.find(t=>t.id===selected), def=TESTS.find(t=>t.id===selected);
    $('lc-test-editor').innerHTML=`<h3>${esc(def.title)}</h3><p>${esc(def.expected)}</p><label>Résultat déclaré<select id="lc-test-result">${[['NOT_STARTED','Non évalué'],['PASS','Démontré'],['FAIL','Échec'],['NOT_APPLICABLE','Non applicable — justification requise']].map(([v,l])=>opt(v,l,t.result)).join('')}</select></label><div class="lcFields">${Object.entries(TEST_FIELDS).map(([key,label])=>`<label>${esc(label)}<textarea id="lc-test-${key}" rows="2">${esc(t[key])}</textarea></label>`).join('')}</div><h4>Pièces sources de la mission</h4><p>Déposer d’abord les messages et journaux dans « Contrôle sélectionné ». Les identifiants et empreintes proviennent de ces pièces.</p><div id="lc-proof-list">${current.proofs.filter(e=>e.original_name!==LIFECYCLE_FILE).map(e=>`<label class="inlineCheck"><input type="checkbox" value="${esc(e.id)}" ${t.evidence_ids.includes(e.id)?'checked':''}>${esc(e.number)} — ${esc(e.original_name)}</label>`).join('')||'Aucune pièce source déposée.'}</div><label>Pièce contenant le payload du statut<select id="lc-payload">${opt('','À sélectionner',t.payload_evidence_id)}${current.proofs.filter(e=>e.original_name!==LIFECYCLE_FILE).map(e=>opt(e.id,`${e.number} — ${e.original_name}`,t.payload_evidence_id)).join('')}</select></label>`;
  }
  function render() {
    const d=current.dossier;
    if(!d) {$('lifecycleEditor').innerHTML='<p>La dernière matrice est inexploitable. Les pièces sont conservées ; corriger le dossier avant de poursuivre.</p>';return;}
    $('lifecycleEditor').innerHTML=`<div class="lcFields"><label>Nature du dossier<select id="lc-mode">${opt('REAL','Audit réel',d.mode)}${opt('DEMO','Démonstration fictive',d.mode)}</select></label>${[['reference_version','Version XP Z12-012 / spécifications applicables'],['reference_locator','Document et section de référence'],['scope','Périmètre et cas applicables'],['reviewer','Auditeur ayant effectué la revue'],['reviewed_at','Date de revue ISO 8601']].map(([k,l])=>`<label>${l}<textarea id="lc-${k}">${esc(d[k])}</textarea></label>`).join('')}</div><h3>Matrice des statuts</h3><p>Les quatre capacités obligatoires doivent être testées sur des scénarios adaptés. Un statut facultatif non proposé doit être justifié.</p><table><thead><tr><th>Code / statut</th><th>Nature</th><th>Prise en charge</th><th>Justification</th></tr></thead><tbody>${STATUSES.map(s=>{const v=d.statuses.find(x=>x.code===s.code);return `<tr><td>${s.code} — ${esc(s.label)}</td><td>${s.mandatory?'Obligatoire selon événement':'Facultatif'}</td><td><select id="lc-status-${s.code}" aria-label="Prise en charge ${s.code}">${[['UNKNOWN','À déclarer'],['YES','Oui'],['NO','Non proposé']].map(([x,l])=>opt(x,l,v.implemented)).join('')}</select></td><td><input id="lc-why-${s.code}" aria-label="Justification ${s.code}" value="${esc(v.justification)}"></td></tr>`;}).join('')}</tbody></table><h3>Campagne de tests</h3><label>Cas à documenter<select id="lc-test-select">${TESTS.map(t=>opt(t.id,`${t.id} — ${t.title}`,selected)).join('')}</select></label><div id="lc-test-editor"></div>`;
    renderTest();
    $('lc-test-select').onchange=()=>{capture();selected=$('lc-test-select').value;renderTest();};
    $('lifecycleEditor').oninput=()=>{dirty=true;status('Modifications non enregistrées.');};
    $('lifecycleEditor').onchange=()=>{dirty=true;};
  }
  async function load() {
    const id=getMission();if(!id) throw new Error('Ouvre une mission PA avant de préparer les cycles de vie.');
    if(dirty && missionId===id) {showTab('lifecycle');return;}
    if(dirty && current?.dossier) {capture();drafts.set(missionId,structuredClone(current));}
    const data=await api(`/api/lifecycle?mission_id=${encodeURIComponent(id)}`);
    if(getMission()!==id) return;
    current=drafts.get(id)||data;missionId=id;dirty=drafts.has(id);selected='CDV-200';render();showTab('lifecycle');
    status(`${resultLabel(data.assessment.status)} — ${data.assessment.issues.join(' ')} ${data.evidence?'Version '+data.evidence.number:'Nouvelle matrice : aucun test exécuté.'}`);
  }
  $('openLifecycle').onclick=()=>{showTab('lifecycle');run(load,'lifecycleStatus');};
  $('openLifecycleReport').onclick=$('openLifecycle').onclick;
  $('saveLifecycle').onclick=()=>run(async()=>{
    if(!current?.dossier||getMission()!==missionId) throw new Error('Recharge la matrice de la mission active.');
    capture();
    const out=await api('/api/lifecycle',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mission_id:missionId,base_evidence_id:current.evidence?.id||null,dossier:current.dossier})});
    current={...current,...out};dirty=false;drafts.delete(missionId);
    status(`Version ${out.evidence.number} enregistrée. ${resultLabel(out.assessment.status)} — ${out.assessment.issues.join(' ')}`);
    await refresh();
  },'lifecycleStatus');
  $('exportLifecycle').onclick=()=>run(async()=>{if(!current?.dossier||missionId!==getMission()) throw new Error('Ouvre la matrice de la mission active.');capture();downloadFile(LIFECYCLE_FILE,JSON.stringify(current.dossier,null,2));},'lifecycleStatus');
  $('importLifecycle').onchange=()=>run(async()=>{
    if(!current||missionId!==getMission()) throw new Error('Ouvre la matrice de la mission active.');
    const file=$('importLifecycle').files[0];if(!file)return;if(file.size>1024*1024) throw new Error('Matrice limitée à 1 Mo.');
    const {normalizeLifecycle}=await import('./lifecycle.mjs');
    current.dossier=normalizeLifecycle(JSON.parse(await file.text()),missionId,current.proofs);dirty=true;render();status('Matrice importée en brouillon. Enregistre pour créer une version probante.');
    $('importLifecycle').value='';
  },'lifecycleStatus');
  window.addEventListener('beforeunload',e=>{if(dirty||drafts.size){e.preventDefault();e.returnValue='';}});
}
