// Run with Node22, PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE set to installed QA tools.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=createServer(async(req,res)=>{try{res.setHeader('content-type',req.url==='/'?'text/html':'text/javascript');res.end(req.url==='/'?'<!doctype html>':await readFile(new URL('../public'+req.url,import.meta.url)));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});
try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const result=await page.evaluate(async()=>{const {parseDocxStructure,groupSections}=await import('/document-structure.mjs');const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';const wrap=(tag,body)=>`<w:${tag} xmlns:w="${ns}">${body}</w:${tag}>`;
 const styles=wrap('styles','<w:style w:styleId="Root"><w:pPr><w:outlineLvl w:val="0"/><w:numPr><w:numId w:val="1"/><w:ilvl w:val="0"/></w:numPr></w:pPr></w:style><w:style w:styleId="Base"><w:pPr><w:outlineLvl w:val="1"/><w:numPr><w:numId w:val="1"/><w:ilvl w:val="1"/></w:numPr></w:pPr></w:style><w:style w:styleId="Inherited"><w:basedOn w:val="Base"/></w:style>');
 const numbering=wrap('numbering','<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1"/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="1"><w:startOverride w:val="2"/></w:lvlOverride></w:num>');
 const p=(style,text,extra='')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t>${extra}</w:r></w:p>`;
 const doc=wrap('document',p('Root','Chapitre A')+p('Inherited','Exigence A','<w:footnoteReference w:id="2"/>')+p('','Liste ; texte exact')+p('Inherited','Exigence B')+p('Root','Chapitre B')+p('Inherited','Exigence C'));
 const notes=wrap('footnotes','<w:footnote w:id="2">'+p('','Note exacte')+'</w:footnote>');const parsed=parseDocxStructure(doc,styles,numbering,notes);const sections=groupSections(parsed.paragraphs,2);
 const plain=parseDocxStructure(wrap('document',p('','7.2.1 Clause explicite')+p('','Détail')+p('','7.2.2 Clause suivante')));
 const missing=parseDocxStructure(wrap('document',p('Inherited','Sans définition')),styles,'');
 return {numbers:sections.map(x=>x.number),first:sections[0].text,next:sections[1].text,plain:groupSections(plain.paragraphs,3).map(x=>x.number),missing:missing.warnings};});
 assert.deepEqual(result.numbers,['3.2','3.3','4.2']);assert.match(result.first,/Note exacte/);assert.match(result.first,/Liste ; texte exact/);assert.ok(!result.first.includes('Exigence B'));assert.deepEqual(result.plain,['7.2.1','7.2.2']);assert.ok(result.missing.some(x=>x.includes('Définition de numérotation absente')));console.log('6/6 structural browser checks passed: inherited styles, overrides/restarts, notes, clause boundaries, literal numbering, missing-definition warning.');
}finally{await browser.close();server.close();}
