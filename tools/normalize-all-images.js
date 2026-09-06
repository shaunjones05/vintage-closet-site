#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'js', 'app.js');
const BACKUP = FILE + '.bak-normalize';

function preferHighRes(url){
  try{ return url.replace(/s-l\d+/i, 's-l1600'); }catch(e){ return url; }
}

function dedupePreserve(arr){
  const seen = new Set(); const out = [];
  for(const v of arr){ if(!v) continue; if(!seen.has(v)){ seen.add(v); out.push(v); } }
  return out;
}

function extractUrlsFromText(text){
  const re = /(https?:\/\/[^"'\s,\]]+)/g;
  const out = [];
  let m; while((m=re.exec(text))){ out.push(m[1]); }
  return out;
}

function findBracketRange(str, startIdx){
  // startIdx points to '[' char
  let i = startIdx; let depth = 0; const L=str.length;
  let inSingle=false, inDouble=false, esc=false;
  for(; i<L; i++){
    const ch = str[i];
    if(esc){ esc = false; continue; }
    if(ch === '\\') { esc = true; continue; }
    if(ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if(ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if(inSingle || inDouble) continue;
    if(ch === '[') depth++;
    else if(ch === ']'){
      depth--; if(depth===0) return { start: startIdx, end: i }; }
  }
  return null;
}

function normalize(content){
  let out = content;
  let idx = 0; let changes = [];
  while(true){
    const found = out.indexOf('images', idx);
    if(found === -1) break;
    // ensure pattern 'images' followed by optional spaces and ':'
    const colon = out.indexOf(':', found);
    if(colon === -1){ idx = found+6; continue; }
    const bracketIdx = out.indexOf('[', colon);
    if(bracketIdx === -1){ idx = colon+1; continue; }
    const range = findBracketRange(out, bracketIdx);
    if(!range){ idx = bracketIdx+1; continue; }
    const inner = out.slice(range.start+1, range.end);
    const urls = extractUrlsFromText(inner).map(u=>preferHighRes(u));
    const dedup = dedupePreserve(urls);
    const limited = dedup.slice(0,8);
    // build new array string
    const newArr = '[' + limited.map(u=> '"'+u.replace(/"/g,'\\"')+'"').join(',') + ']';
    // replace the slice from range.start to range.end inclusive
    out = out.slice(0, range.start) + newArr + out.slice(range.end+1);
    changes.push({orig: urls.length, kept: limited.length});
    idx = range.start + newArr.length;
  }
  return { out, changes };
}

function main(){
  const src = fs.readFileSync(FILE,'utf8');
  fs.writeFileSync(BACKUP, src, 'utf8');
  const res = normalize(src);
  fs.writeFileSync(FILE, res.out, 'utf8');
  console.log('Normalized', res.changes.length, 'image arrays.');
  let totalBefore=0, totalAfter=0;
  res.changes.forEach((c,i)=>{ totalBefore += c.orig; totalAfter += c.kept; console.log(` - product ${i+1}: ${c.orig} -> ${c.kept}`); });
  console.log('Total images before:', totalBefore, 'after:', totalAfter);
  console.log('Backup written to', BACKUP);
}

main();
