import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {SHOT_STYLES} from '../public/effects.js';
test('the user-approved v0.7 puck effects remain byte-for-byte unchanged',async()=>{
  const baseline=JSON.parse(await readFile(new URL('../baselines/shot-effects-v0.7.json',import.meta.url),'utf8'));
  const source=await readFile(new URL('../public/effects.js',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),baseline.sha256,'Keep v0.7 effects intact; implement additions separately.');
  assert.deepEqual(SHOT_STYLES,baseline.styles);
});
