#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'js', 'app.js');
const BACKUP = FILE + '.bak-imgs';

function extractUrls(text){
  const re = /(https?:\/\/[^"'\s\],]+)/g;
  const out = [];
  let m; while((m=re.exec(text))){ out.push(m[1]); }
  return out;
}

function preferHighRes(url){
  // If URL contains s-lNNN, replace with s-l1600 to request higher-res
  try{
    if(/s-l\\d+/i.test(url)){
      return url.replace(/s-l\\d+/i, 's-l1600');
    }
    return url;
  }catch(e){ return url; }
}

function dedupePreserve(arr){
  const seen = new Set(); const out = [];
  for(const v of arr){ if(!v) continue; if(!seen.has(v)){ seen.add(v); out.push(v); } }
  return out;
}

function processImagesArray(content){
  const urls = extractUrls(content);
  if(urls.length === 0) return [];
  // map original sizes for sorting
  const sizeFrom = (u)=>{ const m = u.match(/s-l(\\d+)/i); return m? parseInt(m[1],10):0 };
  const mapped = urls.map(u=>({orig:u, size:sizeFrom(u)}));
  // sort by original size desc, stable
  mapped.sort((a,b)=> b.size - a.size);
  // prefer higher res by rewriting s-lNNN -> s-l1600
  const upgraded = mapped.map(m=> preferHighRes(m.orig));
  const dedup = dedupePreserve(upgraded);
  // limit to 8
  return dedup.slice(0,8);
}

function replaceImagesInFile(str){
  // regex to find images: [ ... ] occurrences (handles both quoted and unquoted keys)
  const re = /["']?images["']?\s*:\s*\[([\s\S]*?)\](\s*,?)/g;
  let match;
  let out = str;
  let count=0;
  const changes = [];
  while((match = re.exec(str))){
    const origBlock = match[0];
    const inner = match[1];
    const tail = match[2] || '';
    const newUrls = processImagesArray(inner);
    if(newUrls.length === 0) continue;
    const newBlock = 'images: [' + newUrls.map(u=> '"'+u.replace(/"/g,'\\"')+'"').join(',') + ']' + tail;
    if(newBlock !== origBlock){
      out = out.replace(origBlock, newBlock);
      count++;
      changes.push({origCount: extractUrls(inner).length, newCount: newUrls.length});
    }
  }
  return { out, count, changes };
}

function main(){
  const src = fs.readFileSync(FILE,'utf8');
  fs.writeFileSync(BACKUP, src, 'utf8');
  const res = replaceImagesInFile(src);
  fs.writeFileSync(FILE, res.out, 'utf8');
  console.log('Updated', res.count, 'products image arrays.');
  let totalBefore=0, totalAfter=0;
  res.changes.forEach((c,i)=>{ totalBefore+=c.origCount; totalAfter+=c.newCount; console.log(` - product ${i+1}: ${c.origCount} -> ${c.newCount}`); });
  console.log('Total images before:', totalBefore, 'after:', totalAfter);
  console.log('Backup written to', BACKUP);
}

main();
