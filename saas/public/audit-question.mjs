// Deterministic interview prompts. The reference text remains the sole normative source.
export function auditQuestion({text='',title='',locator=''}={}) {
 const source=String(text).replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\[Contexte source\s*:[\s\S]*$/,'').trim();
 let topic=String(title||source.split('\n')[0]).replace(/^§?\d+(?:\.\d+)+(?:\s*[-–:]\s*|\s+)/,'').trim();
 if(topic.endsWith('?'))return topic;
 // A flattened Word heading can include the next paragraph. Retain only an identifiable heading.
 topic=topic.split(/\s+(?=(?:Le |La |Les |L[’']|En fonction |Note\s*:))/)[0].replace(/[.:;]+$/,'').trim();
 const named=topic&&topic.length<=180;
 const subject=named?`les dispositions relatives à « ${topic} »`:`l’exigence${locator?' '+locator:''}`;
 return `Comment mettez-vous en œuvre ${subject} dans le périmètre audité, et quelles preuves étayent votre réponse ?`;
}
export function questionForControl(control) {
 return auditQuestion({text:control.requirement,title:control.title,locator:control.reference});
}
