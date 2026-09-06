const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'app.js');
const backup = file + '.bak-v2-' + Date.now();
let src = fs.readFileSync(file, 'utf8');
fs.writeFileSync(backup, src, 'utf8');

// Mapping for concise descriptions
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

// Extract the products array text
const arrRe = /const\s+products\s*=\s*\[([\s\S]*?)\];/m;
const m = src.match(arrRe);
if(!m){
  console.error('Could not find products array in file');
  process.exit(1);
}
const arrayText = '[' + m[1] + ']';

// Evaluate the array safely using VM
let products;
try{
  // Replace JACKETS_STRIPE_LINK identifier with its defined string value so vm can evaluate
  const stripeRe = /const\s+JACKETS_STRIPE_LINK\s*=\s*(['\"])([\s\S]*?)\1/;
  const sm = src.match(stripeRe);
  let evalText = arrayText;
  if (sm) {
    const stripeVal = sm[2].replace(/\\"/g,'\\\"');
    evalText = arrayText.replace(/\bJACKETS_STRIPE_LINK\b/g, '"' + stripeVal + '"');
  }
  const script = new vm.Script('(' + evalText + ')');
  const context = vm.createContext({});
  products = script.runInContext(context);
  if(!Array.isArray(products)) throw new Error('Parsed value is not an array');
}catch(e){
  console.error('Failed to parse products array:', e);
  process.exit(1);
}

let updated = 0;
for(const p of products){
  const num = (p.ebayItemNumber || '').toString();
  if(replacements[num]){
    p.description = replacements[num];
    updated++;
  } else {
    // fallback: if description exists, sanitize by removing hashtags and promo phrases
    if(p.description && typeof p.description === 'string'){
      let out = p.description.replace(/#\S+/g,'');
      out = out.replace(/(?:bundle discount|get\s*\d+%?\s*off|\d+%?\s*off)/gi,'');
      out = out.replace(/\s+/g,' ').trim();
      // if description contains 'Condition:' and it's unclear, drop condition text
      out = out.replace(/Condition:\s*[^.]{0,200}\.*/i,'').trim();
      p.description = out;
    }
  }
}

// Build new array JS (use JSON.stringify for stable formatting)
const newArrayJS = JSON.stringify(products, null, 2);
const newFile = src.replace(arrRe, `const products = ${newArrayJS};`);
fs.writeFileSync(file, newFile, 'utf8');
console.log(`Updated ${updated} product descriptions. Backup at ${backup}`);
