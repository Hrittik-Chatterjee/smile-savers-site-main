#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root = process.argv[2] || 'cache/objects/sha256';
let checked = 0,
  failed = 0;
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n),
      s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else {
      checked++;
      const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      if (n !== h) {
        failed++;
        console.error('HASH_MISMATCH', p, n, h);
      }
    }
  }
}
walk(root);
console.log(JSON.stringify({ checked, failed, status: failed ? 'NO-GO' : 'GO' }, null, 2));
process.exit(failed ? 1 : 0);
