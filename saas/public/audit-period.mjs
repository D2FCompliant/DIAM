export function auditPeriod(start,end) {
  if(!start&&!end)return null;
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(!valid(start)||!valid(end)||end<start)throw Object.assign(new Error('Période auditée invalide : renseigne deux dates valides et une fin postérieure ou égale au début.'),{status:400});
  // PostgreSQL normalizes an inclusive date upper bound into an exclusive bound.
  return `[${start},${end}]`;
}
export function periodDates(range) {
  const match=String(range||'').match(/^([[(])(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})([)\]])$/);
  if(!match)return {start:'',end:''};
  const shift=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
  return {start:match[1]==='('?shift(match[2],1):match[2],end:match[4]===')'?shift(match[3],-1):match[3]};
}
export function periodLabel(range) {const {start,end}=periodDates(range);return start?`${start} au ${end}`:'Non renseignée';}
