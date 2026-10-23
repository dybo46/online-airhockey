import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function replaceRequired(text,from,to){if(!text.includes(from))throw Error('変換元が変わっています。自動変換を止めました: '+from.slice(0,90));return text.replace(from,to);}
async function copyTree(source,target){await mkdir(target,{recursive:true});for(const e of await readdir(source,{withFileTypes:true})){const a=path.join(source,e.name),b=path.join(target,e.name);if(e.isDirectory())await copyTree(a,b);else await copyFile(a,b);}}
export async function buildDemo(projectRoot=root){
  const publicDir=path.join(projectRoot,'self-host/public'),docs=path.join(projectRoot,'docs');await copyTree(publicDir,docs);
  const data={};for(const name of ['skins','random-names','taglines'])data[name]=JSON.parse(await readFile(path.join(projectRoot,'self-host/data',name+'.json'),'utf8'));
  data.skins=data.skins.map(s=>({...s,image:'.'+s.image}));
  await writeFile(path.join(docs,'demo-data.js'),`// Generated from self-host/data. No game server is contacted.\nexport const DEMO_DATA=${JSON.stringify(data,null,2)};\n`);
  let app=await readFile(path.join(publicDir,'app.js'),'utf8');
  app="import {DEMO_DATA} from './demo-data.js';\n"+app;
  app=replaceRequired(app,`async function api(route,data){
  if(windowInactive)throw Error('ゲームは別のウィンドウで操作中です。');
  const response=await fetch('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});
  const result=await response.json();if(!response.ok){if(response.status===401&&joined)lostSession();throw Error(result.error||'接続できませんでした');}return result;
}`,`const savedDemoName=sessionStorage.getItem('airhockey-demo.name');
let demoPlayer=savedDemoName?{id:'cpu-demo',name:savedDemoName,wins:0,ready:false,mode:'lobby',retained:false}:null;
function demoSnapshot(){return {me:demoPlayer,players:demoPlayer?[demoPlayer]:[],queue:demoPlayer?[demoPlayer.id]:[],match:null,lastResult:null};}
async function api(route,data={}){
  if(windowInactive)throw Error('ゲームは別のウィンドウで操作中です。');
  if(route==='join'){
    const name=String(data.name||'').trim().normalize('NFC');
    if(!name||Array.from(name).length>6||/[\\p{C}<>]/u.test(name))throw Error('名前は1〜6文字で入力してください。');
    demoPlayer={id:'cpu-demo',name,wins:0,ready:false,mode:'lobby',retained:false};sessionStorage.setItem('airhockey-demo.name',name);
  }else if(route==='leave'){demoPlayer=null;sessionStorage.removeItem('airhockey-demo.name');}
  else if(route==='mode'&&demoPlayer)demoPlayer.mode=['practice','watch'].includes(data.mode)?data.mode:'lobby';
  else if(!['settings','heartbeat'].includes(route))throw Error('CPU専用デモです。ネット対戦は設置版で利用できます。');
  snapshot=demoSnapshot();if(joined&&demoPlayer)renderLobby();return {ok:true};
}`);
  app=replaceRequired(app,`const response=await fetch('/api/info'),info=await response.json();skins=info.skins;nameList=info.names;defaultName=info.defaultName;`,`const info={skins:DEMO_DATA.skins,names:DEMO_DATA['random-names'],taglines:DEMO_DATA.taglines,defaultName:sessionStorage.getItem('airhockey-demo.name')||'名無しさん１',count:0,session:demoPlayer};skins=info.skins;nameList=info.names;defaultName=info.defaultName;`);
  app=replaceRequired(app,`$('capacity').textContent=\`現在 \${info.count} / 5 人\${info.count>=5?' · 満杯':''}\`;`,`$('capacity').textContent='CPU専用 · ゲームサーバーへの接続なし';`);
  app=replaceRequired(app,`$('connection').textContent='サーバー稼働中'`,`$('connection').textContent='CPU DEMO'`);
  const enterStart=app.indexOf('async function enter(){'),enterEnd=app.indexOf("$('joinButton').onclick",enterStart);
  if(enterStart<0||enterEnd<0)throw Error('入室処理の構造が変わっています');
  app=app.slice(0,enterStart)+`async function enter(){
  if(windowInactive)return;
  joined=true;connected=true;snapshot=demoSnapshot();await publishRule();$('entry').hidden=true;$('room').hidden=false;$('connection').textContent='CPU DEMO · ブラウザ内で実行';renderLobby();
}
`+app.slice(enterEnd);
  app=app.replaceAll("'hockey.","'online-airhockey.demo.").replaceAll("'/assets/","'./assets/");
  app=app.replace("'サーバーに接続できません。起動してからページを開き直してください。'","'デモの初期化に失敗しました。ページを開き直してください。'");
  app=app.replace("'対戦ルールは開始後に公開'","'あなたの設定でCPUと対戦'").replace("'準備OKの2人のうち、順番が先の人の設定を採用します。勝者が残留して準備OKした場合は、勝者の設定が優先されます。'","'CPU対戦・CPU観戦は、このブラウザの設定を使います。'").replace("'誰のルール・どんな数値かは、対戦が始まってからコート下に表示します。自分の設定を変えると準備OKは解除されます。'","'ネット対戦を設置するためのコードと説明書は、GitHubのself-hostにあります。'");
  await writeFile(path.join(docs,'app.js'),app);
  let html=await readFile(path.join(publicDir,'index.html'),'utf8');
  html=html.replaceAll('href="/','href="./').replaceAll('src="/','src="./');
  html=html.replace('</title>',' · CPU DEMO</title>');
  html=html.replace('ホッケーに入室','CPUデモをはじめる').replace('アカウント不要。最大5人の小さなロビー。','CPU対戦・CPU観戦の作品デモ。ネット対戦サーバーへ接続しません。').replace('OK · 入室する','OK · プレイ画面へ');
  html=html.replace('CPU専用で遊べます。','CPU専用で遊べます。').replace('対戦＋順番待ち','CPU専用');
  html=html.replace('PC専用・CPU調整版 / QNAPへ移せるブラウザゲーム','PC専用 · CPU DEMO · NO GAME SERVER');
  html=html.replace('</head>','<link rel="stylesheet" href="./demo.css"></head>');
  html=html.replace('</footer>',' · <a href="./about.html">この作品・公開の目的</a> · <a href="https://github.com/dybo46/online-airhockey">GitHub</a></footer>');
  await writeFile(path.join(docs,'index.html'),html);
  await writeFile(path.join(docs,'demo.css'),'.lobby-panel,.cpu-panel > .check {display:none!important} footer a{color:#43dffb} .entry-card .muted{line-height:1.7}\n');
  const audio=await readFile(path.join(publicDir,'audio.js'),'utf8');await writeFile(path.join(docs,'audio.js'),audio.replace("const ROOT='/assets/audio/';","const ROOT='./assets/audio/';"));
  const windowCode=await readFile(path.join(publicDir,'game-window.js'),'utf8');await writeFile(path.join(docs,'game-window.js'),windowCode.replaceAll('hockey.','online-airhockey.demo.').replaceAll('hockey-popup','airhockey-demo-popup').replace("'comic-hockey-game'","'online-airhockey-demo-game'"));
  await writeFile(path.join(docs,'.nojekyll'),'');
  await writeFile(path.join(docs,'about.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>online-airhockeyについて</title><style>body{max-width:760px;margin:50px auto;padding:20px;background:#101c2b;color:#edf5ff;font:16px/1.9 system-ui}a{color:#43dffb}</style><h1>online-airhockey</h1><p>自分のルール、見た目、音を楽しむPC用エアホッケーの制作記録です。このページではCPU戦とCPU同士の観戦をブラウザ内で遊べます。</p><p>作者のQNAPやゲームサーバーへ接続しません。オンライン対戦は、利用者自身のサーバーにself-host版を設置して使います。GitHub Pagesだけでネット対戦は動きません。</p><p>マウスの固定は通常のChrome・Edgeでお試しください。Esc・右クリック・スペース・Backspace・Enterで解除できます。</p><p><a href="./">CPUデモへ戻る</a> ／ <a href="https://github.com/dybo46/online-airhockey">コード・説明書・履歴</a> ／ <a href="./assets/audio/CREDITS.md">効果音の作者・出典・利用条件</a></p></html>`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildDemo();
