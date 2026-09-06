const fs = require('fs');
const vm = require('vm');

const FILE = 'js/app.js';

function sanitizeDescription(s) {
  if (!s) return '';
  let out = String(s);
  out = out.replace(/#\S+/g, '');
  out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi, '');
  out = out.replace(/(?:,\s*[^,]{1,40}){2,}\s*$/, '');
  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '').trim();
  return out;
}

function normalizeProductName(name, description) {
  const rawName = String(name || '').trim();
  if (!rawName) return rawName;
  if (!/\.\.\.$/.test(rawName)) return rawName;

  const base = rawName.replace(/\.\.\.$/, '').trim();
  const cleanedDescription = sanitizeDescription(description || '')
    .replace(/\s*Color\s*:\s*[^.\n;]+\.?/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedDescription) return base;

  const firstSentence = cleanedDescription.split(/[.!?](?:\s|$)/)[0].trim();
  const sentenceWords = firstSentence.split(/\s+/).filter(Boolean);
  const descTitle = sentenceWords.length > 20 ? sentenceWords.slice(0, 20).join(' ') : firstSentence;

  let candidate = descTitle || base;
  if (candidate.toLowerCase().indexOf(base.toLowerCase()) !== 0) {
    candidate = `${base} ${candidate}`;
  }

  candidate = candidate.replace(/\s+/g, ' ').trim();
  if (candidate.length > 110) {
    const clipped = candidate.slice(0, 110);
    const cutAt = clipped.lastIndexOf(' ');
    candidate = (cutAt > 0 ? clipped.slice(0, cutAt) : clipped).trim();
  }

  return candidate || base;
}

const src = fs.readFileSync(FILE, 'utf8');
const marker = 'const products =';
const idx = src.indexOf(marker);
const start = src.indexOf('[', idx);
let i = start;
let depth = 0;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) break;
  }
  if (ch === '"' || ch === '\'' || ch === '`') {
    const q = ch;
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') i += 2;
      else i++;
    }
  }
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext('products=' + src.slice(start, i + 1), sandbox);
const products = sandbox.products || [];

let updated = 0;
for (const p of products) {
  if (!p) continue;
  const original = String(p.name || '').trim();
  if (!/\.\.\.$/.test(original)) continue;
  const next = normalizeProductName(original, p.description);
  if (next && next !== original) {
    p.name = next;
    updated++;
  }
}

const outArray = JSON.stringify(products, null, 2);
const newSrc = src.slice(0, start) + outArray + src.slice(i + 1);
fs.writeFileSync(FILE, newSrc, 'utf8');

console.log('updated=' + updated);
