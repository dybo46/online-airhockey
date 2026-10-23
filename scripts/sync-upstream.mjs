import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildDemo,replaceRequired} from './build-demo.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
const value=key=>args[args.indexOf(key)+1],sourceArg=args.includes('--source')?value('--source'):null;
if(!sourceArg)throw Error('Usage: node scripts/sync-upstream.mjs --source <開発フォルダー> [--apply]');
const source=path.resolve(sourceArg),apply=args.includes('--apply'),manifestFile=path.join(root,'UPSTREAM.json');
if(source===root||source.startsWith(root+path.sep))throw Error('取り込み元は別の開発フォルダーにしてください');
const hash=b=>createHash('sha256').update(b).digest('hex');
const forbidden=[/myqnapcloud\./i,/192\.168\./,/C:[\\/]Users[\\/]/i,/D:[\\/]desktop/i,/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{15}/];
const textFile=p=>/\.(?:m?js|css|html|json|md|txt|py)$/.test(p);
async function list(dir,prefix=''){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())out.push(...await list(path.join(dir,e.name),rel+'/'));else out.push(rel);}return out;}
const names=['server.mjs','lobby.mjs',...(await list(path.join(source,'public'))).filter(p=>p!=='game-links.js').map(p=>'public/'+p),...(await list(path.join(source,'data'))).filter(p=>p.endsWith('.json')).map(p=>'data/'+p),'baselines/shot-effects-v0.7.json','scripts/prepare-real-sounds.py','scripts/prepare-comparison-sounds.py',...(await readdir(path.join(source,'tests'))).filter(p=>p.endsWith('.test.mjs')&&p!=='game-links.test.mjs').map(p=>'tests/'+p)];
let old;try{old=JSON.parse(await readFile(manifestFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;old={files:{}};}
const next={},changes=[],pending=[],preview=path.join(root,'.local/sync-preview');
for(const name of names){
  const raw=await readFile(path.join(source,name));let bytes=raw;
  if(textFile(name)){
    let text=raw.toString('utf8').replaceAll('\r\n','\n');
    if(name==='public/app.js'){text=replaceRequired(text,"import {gameUrl} from './game-links.js';\n",'');text=replaceRequired(text,"$('othelloLink').href=gameUrl('othello',location.href);\n",'');}
    if(name==='public/index.html'){text=text.replace(/<a id="othelloLink"[\s\S]*?<\/a>/,'<p class="small muted">独立したホッケープロジェクトです。</p>');text=text.replace(/<h2>v[\d.]+ · ルール一覧と打撃表示を見やすく<\/h2>[\s\S]*?<button id="closeHistory"/, '<h2>制作記録 v1.4</h2><p>現時点のゲーム内容・入室・オンライン対戦・CPU戦を記録。作者の運用環境への入口は含みません。</p><p>記録と更新内容はGitHubのHISTORY.md・CHANGELOG.mdをご覧ください。</p><button id="closeHistory"');}
    if(name==='tests/server.test.mjs')text=text.replaceAll("'18788'","'18986'").replaceAll(':18788',':18986');
    if(name==='baselines/shot-effects-v0.7.json'){const baseline=JSON.parse(text);baseline.sourceArchive='Original v0.7 archive is not distributed; rendering hash preserved.';text=JSON.stringify(baseline,null,2)+'\n';}
    for(const pattern of forbidden)if(pattern.test(text))throw Error('公開できない接続情報等を検出: '+name);
    bytes=Buffer.from(text);
  }
  const target=path.join(root,'self-host',name);let current=null;try{current=hash(await readFile(target));}catch(e){if(e.code!=='ENOENT')throw e;}
  const desired=hash(bytes),previous=old.files[name];
  if(current!==desired){if(current&&(!previous||current!==previous.exportSha256))throw Error('公開版の個別編集と衝突しています: '+name);changes.push(name);pending.push({target,bytes});}
  next[name]={sourceSha256:hash(raw),exportSha256:desired};
  const previewFile=path.join(preview,'self-host',name);await mkdir(path.dirname(previewFile),{recursive:true});await writeFile(previewFile,bytes);
}
for(const name of Object.keys(old.files))if(!next[name])throw Error('削除された取り込み元ファイルがあります。影響を確認して手動対応してください: '+name);
const config=await readFile(path.join(source,'public/config.js'),'utf8'),version=config.match(/export const VERSION = '([^']+)'/)?.[1];if(!version)throw Error('バージョンを確認できません');
await buildDemo(preview);
const generatedFiles={},demoChanges=[];
for(const name of await list(path.join(preview,'docs'))){
  const bytes=await readFile(path.join(preview,'docs',name)),desired=hash(bytes),target=path.join(root,'docs',name);let current=null;
  try{current=hash(await readFile(target));}catch(e){if(e.code!=='ENOENT')throw e;}
  const previous=old.generatedFiles?.[name];
  if(current!==desired){if(current&&previous&&current!==previous)throw Error('CPUデモの個別編集と衝突しています: '+name);demoChanges.push(name);pending.push({target,bytes});}
  generatedFiles[name]=desired;
}
console.log(JSON.stringify({mode:apply?'apply':'check',sourceVersion:version,changed:changes,count:changes.length,demoChanged:demoChanges,demoCount:demoChanges.length},null,2));
if(apply){
  for(const {target,bytes}of pending){await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}
  await writeFile(manifestFile,JSON.stringify({schema:1,sourceVersion:version,updated:new Date().toISOString().slice(0,10),note:'開発フォルダーの場所・履歴・接続先は記録しない。ホワイトリストのみ取り込み、公開用変換後のハッシュも記録。',files:next,generatedFiles},null,2)+'\n');
}
