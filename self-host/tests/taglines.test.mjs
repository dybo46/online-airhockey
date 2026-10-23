import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('TOP has fifty distinct two-line taglines including the requested themes',async()=>{
  const rows=JSON.parse(await readFile(new URL('../data/taglines.json',import.meta.url),'utf8'));
  assert.equal(rows.length,50);assert.equal(new Set(rows).size,50);
  assert.ok(rows.includes('得意なルールで\n有利に。'));assert.ok(rows.includes('SMASH!を\n決めろ！'));
  for(const row of rows){assert.equal(row.split('\n').length,2);for(const line of row.split('\n'))assert.ok(Array.from(line).length<=11);}
});
