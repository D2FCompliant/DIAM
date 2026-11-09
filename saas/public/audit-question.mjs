// Deterministic interview prompts. The reference text remains the sole normative source.
export function auditQuestion({text='',title='',locator=''}={}) {
 const originalTitle=String(title).trim();
 if(originalTitle.endsWith('?'))return originalTitle;
 const source=String(text).replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\[Contexte source\s*:[\s\S]*$/,'').trim();
 const readable=source.replace(/#{1,3}/g,'').replace(/^§?\d+(?:\.\d+)+(?:\s*[-–:]\s*|\s+)/,'').trim();
 // Keep the modal meaning: 'peut' remains a possibility; 'doit' asks about fulfilment.
 // This is the principal question, not automatic decomposition of all clause obligations.
 if(/options?/i.test(originalTitle)&&/options?\s*[:«]|deux options/i.test(readable))return 'Quelle option prévue par cette clause retenez-vous, et quelles preuves justifient son applicabilité ?';
 const obligation=readable.match(/(?:^|\s)((?:L[’'][\p{L}-]+|(?:Le|La|Les|Chaque|Un|Une)\s+[^.!?\n]{1,160}?))\s+(ne\s+)?(doit|doivent|peut|peuvent)\s+([\s\S]+)/iu);
 if(obligation){
  const subject=obligation[1][0].toLocaleLowerCase('fr')+obligation[1].slice(1);
  const modal=obligation[3].toLowerCase(),negative=Boolean(obligation[2]);
  const rest=obligation[4].split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÙÜÇ])/u)[0].replace(/[.?!]+$/,'').trim();
  const infinitive=(negative?'ne ':'')+rest;
  let action=/^peu/.test(modal)?`${negative?'ne ':''}${modal} ${rest}`:`${modal==='doivent'?'respectent':'respecte'} l’obligation ${/^[aàâeéèêëiîïoôuùûüh]/i.test(infinitive)?'d’':'de '}${infinitive}`;
  if(!negative&&/^doiv|^doit/.test(modal)&&/^être\s/.test(rest))action=`${modal==='doivent'?'sont':'est'} ${rest.replace(/^être\s+/,'')}`;
  const condition=/\bsi\b|lorsque|en cas|absence|sous réserve|à condition/i.test(readable.slice(0,obligation.index));
  const question=`${condition?'Dans les conditions prévues par la clause, est-ce':'Est-ce'} que ${subject} ${action} ?`;
  // No arbitrary truncation. Conditional scope remains explicit in the original displayed alongside.
  if(question.length<=2000)return question;
 }
 let topic=String(title||source.split('\n')[0]).replace(/^§?\d+(?:\.\d+)+(?:\s*[-–:]\s*|\s+)/,'').trim();
 topic=topic.split(/\s+(?=(?:Le |La |Les |L[’']|En fonction |Note\s*:))/)[0].replace(/[.:;]+$/,'').trim();
 const named=topic&&topic.length<=180;
 const subject=named?`les dispositions relatives à « ${topic} »`:`l’exigence${locator?' '+locator:''}`;
 return `Comment mettez-vous en œuvre ${subject} dans le périmètre audité, et quelles preuves étayent votre réponse ?`;
}
export function questionForControl(control) {
 return auditQuestion({text:control.requirement,title:control.title,locator:control.reference});
}
