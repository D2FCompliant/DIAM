import {docxXml} from './docx-text.mjs';
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const ancestor=(node,name)=>{for(let p=node.parentElement;p;p=p.parentElement)if(p.namespaceURI===NS&&p.localName===name)return p;return null;};
const children=(node,name)=>[...(node?.children||[])].filter(x=>x.namespaceURI===NS&&x.localName===name);
const child=(node,name)=>children(node,name)[0];
const attr=(node,name='val')=>node?.getAttributeNS(NS,name)??null;
function xml(text){if(!text)return null;const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('Structure XML Word invalide.');return d.documentElement;}
function properties(pr){const num=child(pr,'numPr');return {style:attr(child(pr,'pStyle')),numId:attr(child(num,'numId')),level:attr(child(num,'ilvl')),outline:attr(child(pr,'outlineLvl'))};}
const merge=(a,b)=>({...a,...Object.fromEntries(Object.entries(b).filter(([,v])=>v!==null))});
function paragraphText(p){let out='';const walk=n=>{if(n.namespaceURI===NS&&['del','moveFrom'].includes(n.localName))return;if(n.namespaceURI===NS&&n.localName==='t'){out+=n.textContent;return;}if(n.namespaceURI===NS&&['tab','br','cr'].includes(n.localName)){out+=n.localName==='tab'?'\t':'\n';return;}for(const c of n.children||[])walk(c);};walk(p);return out;}
export async function readDocxStructure(bytes){
 const parts=await Promise.all(['document','styles','numbering','footnotes','endnotes'].map(n=>docxXml(bytes,`word/${n}.xml`,n!=='document')));
 return parseDocxStructure(...parts);
}
export function parseDocxStructure(documentXml,stylesXml='',numberingXml='',footnotesXml='',endnotesXml=''){
 const document=xml(documentXml),styles=xml(stylesXml),numbering=xml(numberingXml),warnings=[];
 const styleNodes=new Map(children(styles,'style').map(n=>[attr(n,'styleId'),n])),resolved=new Map();
 function resolveStyle(id,seen=new Set()){if(!id)return {};if(resolved.has(id))return resolved.get(id);if(seen.has(id)){warnings.push('Héritage cyclique de styles : structure à vérifier.');return {};}seen.add(id);const node=styleNodes.get(id),base=resolveStyle(attr(child(node,'basedOn')),seen);const value=merge(base,properties(child(node,'pPr')));resolved.set(id,value);return value;}
 const abstracts=new Map(children(numbering,'abstractNum').map(n=>[attr(n,'abstractNumId'),n]));
 const numbers=new Map(children(numbering,'num').map(n=>[attr(n,'numId'),n]));const counters=new Map();
 function levels(id){const n=numbers.get(id),a=abstracts.get(attr(child(n,'abstractNumId')));const out=new Map(children(a,'lvl').map(l=>[Number(attr(l,'ilvl')),l]));for(const o of children(n,'lvlOverride')){const i=Number(attr(o,'ilvl'));if(child(o,'lvl'))out.set(i,child(o,'lvl'));}return {n,out};}
 const notes=new Map();for(const [kind,source] of [['footnote',footnotesXml],['endnote',endnotesXml]])for(const note of children(xml(source),kind)){const id=attr(note,'id');if(Number(id)>=0)notes.set(`${kind}:${id}`,[...note.getElementsByTagNameNS(NS,'p')].map(paragraphText).join('\n'));}
 const paragraphs=[...document.getElementsByTagNameNS(NS,'p')].filter(p=>!ancestor(p,'del')&&!ancestor(p,'moveFrom')).map((p,index)=>{
  const direct=properties(child(p,'pPr')),props=merge(resolveStyle(direct.style),direct);let text=paragraphText(p),number='',depth=0,literalNumber=false;
  const id=props.numId;if(id&&id!=='0'){
   const {n,out}=levels(id);const level=Number(props.level||0),def=out.get(level);if(def){const values=counters.get(id)||[];const override=children(n,'lvlOverride').find(x=>Number(attr(x,'ilvl'))===level);const start=Number(attr(child(override,'startOverride'))??attr(child(def,'start'))??1);values[level]=values[level]===undefined?start:values[level]+1;
    for(const [i,l] of out){if(i<=level)continue;const restart=attr(child(l,'lvlRestart'));if(restart!=='0'&&(restart===null?level<i:level===Number(restart)-1))values[i]=undefined;}
    counters.set(id,values);const fmt=attr(child(def,'numFmt')),template=attr(child(def,'lvlText'))||'';
    if(fmt==='decimal'&&[...template.matchAll(/%(\d+)/g)].every(m=>attr(child(out.get(Number(m[1])-1),'numFmt'))==='decimal')){number=template.replace(/%(\d+)/g,(_,x)=>String(values[Number(x)-1]??Number(attr(child(out.get(Number(x)-1),'start'))??1))).replace(/[.\s]+$/,'');if(/^\d+(?:\.\d+)*$/.test(number))depth=number.split('.').length;}
    else if(fmt==='bullet')text='• '+text;
    else if(fmt!=='none')warnings.push(`Numérotation ${fmt||'inconnue'} au paragraphe ${index+1} : repère à vérifier.`);
   }else warnings.push(`Définition de numérotation absente au paragraphe ${index+1}.`);
  }
  const isHeading=(props.outline!==undefined&&props.outline!==null&&Number(props.outline)<9)||/^(Heading|Title|Titre)/i.test(direct.style||'');
  if(!isHeading){number='';depth=0;}
  if(!number){const literal=text.match(/^\s*§?\s*(\d+(?:\.\d+){1,8})[.)]?\s+\S/);if(literal&&!/\.{3,}\s*\d+\s*$/.test(text)&&!/^TOC/i.test(direct.style||'')){number=literal[1];depth=number.split('.').length;literalNumber=true;}}
  const refs=[...p.getElementsByTagNameNS(NS,'footnoteReference')].map(n=>['footnote',attr(n,'id')]).concat([...p.getElementsByTagNameNS(NS,'endnoteReference')].map(n=>['endnote',attr(n,'id')]));for(const [kind,key] of refs){const note=notes.get(`${kind}:${key}`);if(note)text+=`\n[Note ${key}] ${note}`;else warnings.push(`Note ${key} introuvable au paragraphe ${index+1}.`);}
  return {page:index+1,text,number,depth,literalNumber,style:direct.style||'',table:Boolean(ancestor(p,'tbl')),hasImage:p.getElementsByTagNameNS(NS,'drawing').length>0||p.getElementsByTagNameNS(NS,'pict').length>0};
 });
 if(paragraphs.some(p=>p.number&&!p.literalNumber)){for(const p of paragraphs)if(p.literalNumber){p.number='';p.depth=0;}warnings.push('La structure Word numérotée est prioritaire ; les renvois numériques du texte ne sont pas transformés en clauses.');}
 if(paragraphs.some(p=>p.hasImage))warnings.push('Illustrations présentes : consulter les originaux pour compléter les exigences contenant des schémas.');
 warnings.push('Les relations entre cellules de tableaux et les champs calculés doivent être vérifiés dans le document original.');
 return {paragraphs,warnings:[...new Set(warnings)]};
}
export function textStructure(pages){return {paragraphs:pages.flatMap(p=>p.text.split(/\n+/).map(text=>{const m=text.match(/^\s*§?\s*(\d+(?:\.\d+){1,8})[.)]?\s+\S/);const number=m&&!/\.{3,}\s*\d+\s*$/.test(text)?m[1]:'';return {page:p.page,text,number,depth:number?number.split('.').length:0};})),warnings:['Structure déduite des numéros présents dans le texte ; vérifier les tableaux, sommaires et ruptures de pages dans la source.']};}
export function sectionLevels(paragraphs){const counts=new Map();for(const p of paragraphs)if(p.depth)counts.set(p.depth,(counts.get(p.depth)||0)+1);return [...counts].sort((a,b)=>a[0]-b[0]);}
export function groupSections(paragraphs,depth){const out=[];for(let i=0;i<paragraphs.length;i++){const p=paragraphs[i];if(p.depth!==depth)continue;let end=i+1;while(end<paragraphs.length&&(!paragraphs[end].depth||paragraphs[end].depth>depth))end++;
 const parents=[];for(let j=i-1,last=depth;j>=0;j--){const a=paragraphs[j];if(a.depth&&a.depth<last){let stop=j+1;while(stop<i&&!paragraphs[stop].depth)stop++;parents.unshift({number:a.number,text:[a.text,...paragraphs.slice(j+1,stop).map(x=>x.text)].filter(t=>t.trim()).join('\n')});last=a.depth;}}
 const format=a=>a.number&&!a.text.trimStart().startsWith(a.number)?`§${a.number} ${a.text}`:a.text;
 out.push({number:p.number,depth,text:paragraphs.slice(i,end).map(format).filter(t=>t.trim()).join('\n'),title:p.text,context:parents.map(format).join(' › '),start:p.page,end:paragraphs[end-1]?.page||p.page});
 }return out;}
