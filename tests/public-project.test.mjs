import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){if(['.git','.local','test-output','node_modules'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
const hash=b=>createHash('sha256').update(b).digest('hex');
test('公開する全テキストに作者の接続先・個人パス・秘密情報を含めない',async()=>{
  const forbidden=[/myqnapcloud\./i,/192\.168\./,/C:[\\/]Users[\\/]/i,/D:[\\/]desktop/i,/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{15}/];
  for(const p of await files(root)){if(!/\.(?:m?js|md|json|html|css|yaml|example|py|txt)$/.test(p)||p.endsWith('public-project.test.mjs')||p.endsWith('sync-upstream.mjs'))continue;const text=await readFile(p,'utf8');for(const pattern of forbidden)assert.equal(pattern.test(text),false,path.relative(root,p));}
});
test('CPU版にゲーム用APIを残さず、画像・音・別窓をPagesのサブパスで使う',async()=>{
  for(const p of await files(path.join(root,'docs'))){if(!/\.(?:html|js|css)$/.test(p))continue;const text=await readFile(p,'utf8');assert.doesNotMatch(text,/(?:fetch\s*\([^)]*\/api\/|new\s+EventSource|new\s+WebSocket|sendBeacon\s*\()/,p);assert.doesNotMatch(text,/(?:src|href)="\/(?!\/)|['"]\/assets\//,p);assert.doesNotMatch(text,/game-links|othelloLink/,p);}
  const html=await readFile(path.join(root,'docs/index.html'),'utf8');assert.match(html,/CPUデモ/);assert.match(html,/NO GAME SERVER/);
  const app=await readFile(path.join(root,'docs/app.js'),'utf8');assert.doesNotMatch(app,/\bfetch\s*\(/);assert.match(app,/demoSnapshot/);assert.match(app,/online-airhockey\.demo\./);
  const audio=await readFile(path.join(root,'docs/audio.js'),'utf8');assert.match(audio,/ROOT='\.\/assets\/audio\/'/);
  const windowCode=await readFile(path.join(root,'docs/game-window.js'),'utf8');assert.match(windowCode,/new URL\(location\.href\)/);assert.match(windowCode,/online-airhockey\.demo\./);
});
test('共通物理・21演出・13背景・46音源とv0.7基準を維持する',async()=>{
  for(const name of ['physics.js','config.js','effect-selection.js','effects.js','effects-extra.js','laser-variants.js','rainbow-smash.js','mouse-controls.js'])assert.deepEqual(await readFile(path.join(root,'docs',name)),await readFile(path.join(root,'self-host/public',name)),name);
  const skins=JSON.parse(await readFile(path.join(root,'self-host/data/skins.json'),'utf8'));assert.equal(skins.length,13);
  for(const s of skins)assert.deepEqual(await readFile(path.join(root,'docs',s.image.slice(1))),await readFile(path.join(root,'self-host/public',s.image.slice(1))));
  const {SOUND_LIBRARY}=await import('../docs/audio.js');assert.equal(SOUND_LIBRARY.length,46);for(const {file}of SOUND_LIBRARY)assert.deepEqual(await readFile(path.join(root,'docs/assets/audio',file)),await readFile(path.join(root,'self-host/public/assets/audio',file)));
  const baseline=JSON.parse(await readFile(path.join(root,'self-host/baselines/shot-effects-v0.7.json'),'utf8'));assert.equal(hash(await readFile(path.join(root,'docs/effects.js'))),baseline.sha256);
});
test('取り込み基準の公開側・生成側ハッシュが実際のファイルと一致する',async()=>{
  const manifest=JSON.parse(await readFile(path.join(root,'UPSTREAM.json'),'utf8'));assert.equal(manifest.sourceVersion,'1.4');
  for(const [name,record]of Object.entries(manifest.files))assert.equal(hash(await readFile(path.join(root,'self-host',name))),record.exportSha256,name);
  for(const [name,expected]of Object.entries(manifest.generatedFiles))assert.equal(hash(await readFile(path.join(root,'docs',name))),expected,name);
});
