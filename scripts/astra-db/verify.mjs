import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from 'pglite-pg17';
import { pgcrypto } from 'pglite-pg17/contrib/pgcrypto';
import { pgtap } from '@electric-sql/pglite-pgtap';
import { checkBaseline } from './baseline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const migrations = (await readdir(path.join(root, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
const testFiles = (await readdir(path.join(root, 'supabase/tests'))).filter(f => f.endsWith('.sql')).sort();
const read = p => readFile(path.join(root, p), 'utf8');
let failures = 0;

// Always in-memory: no URL, network credentials or cloud project accepted.
for (let cycle = 1; cycle <= 2; cycle++) {
  const db = new PGlite({ extensions: { pgcrypto, pgtap } });
  try {
    await db.exec(await readFile(path.join(here, 'bootstrap.sql'), 'utf8'));
    await db.exec('set search_path = public, extensions; create extension pgtap with schema extensions;');
    console.log(JSON.stringify({ cycle, engine: (await db.query('select version()')).rows[0].version }));
    for (const file of migrations) {
      if (file === '20260911015117_astra_privacy_hardening.sql') {
        await db.exec(await read('supabase/seed.sql'));
        await checkBaseline(db);
      }
      await db.exec(await read(`supabase/migrations/${file}`));
      console.log(`migration PASS ${file}`);
    }
    await db.exec(await read('supabase/seed.sql'));
    for (const file of testFiles) {
      try {
        const results = await db.exec(await read(`supabase/tests/${file}`));
        const lines = results.flatMap(result => result.rows.flatMap(row => Object.values(row)))
          .filter(v => typeof v === 'string').flatMap(v => v.split('\n'));
        const assertions = lines.filter(line => /^(?:not )?ok \d+/.test(line));
        const bad = lines.filter(line => /^not ok \d+|^# Looks like/.test(line));
        const plans = lines.filter(line => /^1\.\.\d+$/.test(line));
        assert.equal(plans.length, 1, 'exactly one pgTAP plan required');
        assert.equal(Number(plans[0].slice(3)), assertions.length, 'pgTAP assertion count must match plan');
        assert.equal(bad.length, 0, bad.join('\n'));
        console.log(`pgTAP PASS ${file}: ${assertions.length} assertions`);
      } catch (error) {
        failures++;
        console.log(`pgTAP FAIL ${file}: ${error.message}`);
        await db.exec('rollback; reset role; set search_path = public, extensions;');
      }
    }
  } finally {
    await db.close();
  }
}
assert.equal(failures, 0, `${failures} DB test suites failed`);
console.log('PASS: migrations, seed and all SQL suites on two fresh in-memory databases.');
