#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'js', 'app.js');
const BACKUP = FILE + '.bak-desc';

function sanitize(s){
  if(!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g,'');
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi,'');
  out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/,'');
  out = out.replace(/\s+/g,' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g,'').trim();
  return out;
}

function quoteString(str, quote){
  if(quote === '"') return '"' + String(str).replace(/"/g,'\\"') + '"';
  return '\'' + String(str).replace(/'/g,"\\'") + '\'';
}

const src = fs.readFileSync(FILE,'utf8');
fs.writeFileSync(BACKUP, src, 'utf8');

const m = src.match(/const\s+products\s*=\s*\[([\s\S]*?)\];/m);
if(!m){ console.error('products array not found'); process.exit(1); }
const body = m[1];

const objRe = /{[^}]*?ebayItemNumber[^}]*?}/g;
let outBody = body;
let match; const changes = [];
while((match = objRe.exec(body))){
  const objText = match[0];
  const itemMatch = objText.match(/ebayItemNumber\s*[:=]\s*['\"]?(\d+)['\"]?/);
  if(!itemMatch) continue;
  const item = itemMatch[1];
  const codeMatch = objText.match(/\"code\"\s*:\s*['\"]([^'\"]+)['\"]/i) || objText.match(/\bcode\b\s*:\s*['\"]([^'\"]+)['\"]/i);
  const code = codeMatch ? codeMatch[1] : ('JKT-' + String(item).slice(-4));

  // find description property within this object
  const descRe = /(?:\"description\"|\bdescription\b)\s*:\s*(['\"])([\s\S]*?)\1/;
  const dm = objText.match(descRe);
  let newDesc = '';
  if(dm){
    const orig = dm[2];
    newDesc = sanitize(orig);
  } else {
    newDesc = '';
  }
  const instr = `Code: ${code} -- Enter this product code at checkout to identify your item. Use it when purchasing to ensure we match your payment to the correct listing.`;
  if(newDesc) newDesc = newDesc + '  ' + instr;
  else newDesc = instr;

  if(dm){
    const fullMatch = dm[0];
    const quote = dm[1];
    const replacement = `description: ${quoteString(newDesc, quote)}`;
    const newObj = objText.replace(fullMatch, replacement);
    outBody = outBody.replace(objText, newObj);
    changes.push({item, code});
  } else {
    // insert description before the final closing of the object
    const insertionPoint = objText.lastIndexOf('}');
    const before = objText.slice(0,insertionPoint);
    const after = objText.slice(insertionPoint);
    const insertStr = '\n    description: ' + quoteString(newDesc, '"') + ',';
    const newObj = before + insertStr + after;
    outBody = outBody.replace(objText, newObj);
    changes.push({item, code});
  }
}

const newFile = src.replace(/const\s+products\s*=\s*\[([\s\S]*?)\];/m, `const products = [${outBody}];`);
fs.writeFileSync(FILE, newFile, 'utf8');
console.log('Updated descriptions for', changes.length, 'products. Backup at', BACKUP);
