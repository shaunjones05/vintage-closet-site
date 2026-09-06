const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-rewrite-desc';
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

const replacements = {
  '317607391969': "Liquid Blue 1993 all-over print skull T-shirt, XL, 100% cotton. Single stitch construction. Code: JKT-1969 -- Enter this product code at checkout to identify your item.",
  '317663062941': "Carhartt vintage faded denim chore jacket, XL. Classic workwear piece. Code: JKT-2941 -- Enter this product code at checkout to identify your item.",
  '317663055121': "1980s Levi's Type III denim jacket, M. Distressed with plaid lining and original buttons. Code: JKT-5121 -- Enter this product code at checkout to identify your item.",
  '317268047588': "Vintage Blink-182 x Hurley box-logo T-shirt, XL, blue. 90s band tee. Code: JKT-7588 -- Enter this product code at checkout to identify your item.",
  '317663060318': "Carhartt hooded canvas bomber/work jacket, L. Like new. Code: JKT-0318 -- Enter this product code at checkout to identify your item.",
  '317669871848': "Carhartt heavyweight canvas hooded work jacket, L, with quilted lining. Code: JKT-1848 -- Enter this product code at checkout to identify your item.",
  '317669998950': "Lee 1980s light wash denim jacket, XL. Faded/distressed vintage style. Code: JKT-8950 -- Enter this product code at checkout to identify your item.",
  '317663057992': "Carhartt hooded workwear jacket, XL. Faded purple canvas with Alta embroidery, good vintage condition. Code: JKT-7992 -- Enter this product code at checkout to identify your item."
};
// Find each product object by ebayItemNumber and replace its description property
let count = 0;
for (const itemNum of Object.keys(replacements)){
  const idx = src.indexOf(itemNum);
  if (idx === -1) continue;
  // find object start (nearest "{" before idx)
  const objStart = src.lastIndexOf('{', idx);
  if (objStart === -1) continue;
  // find object end: look for "}," after idx, fallback to next "}".
  let objEnd = src.indexOf('},', idx);
  if (objEnd === -1) objEnd = src.indexOf('}', idx);
  if (objEnd === -1) continue;
  const objText = src.slice(objStart, objEnd + 1);

  const descRe = /(\bdescription\b\s*:\s*)(['\"])([\s\S]*?)\2/;
  const newDesc = replacements[itemNum].replace(/"/g, '\"');
  let newObj;
  if (descRe.test(objText)){
    newObj = objText.replace(descRe, `$1"${newDesc}"`);
  } else {
    const insertPoint = objText.lastIndexOf('}');
    const before = objText.slice(0, insertPoint);
    const after = objText.slice(insertPoint);
    const insertStr = `\n    description: "${newDesc}",`;
    newObj = before + insertStr + after;
  }
  src = src.slice(0, objStart) + newObj + src.slice(objEnd + 1);
  count++;
}

fs.writeFileSync(file, src, 'utf8');
console.log(`Rewrote descriptions for ${count} products. Backup at ${backup}`);
