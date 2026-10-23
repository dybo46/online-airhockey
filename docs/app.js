import {DEMO_DATA} from './demo-data.js';
import {VERSION,SETTINGS,DEFAULTS,normalizeSettings,upgradeSettings,upgradeDifficulty,normalizeTarget,PUCK_STYLES} from './config.js';
import {W,H,DT,createGame,tick,cpu,setTarget,serve,arm,forfeit,dimensions,scoreLabel,scoreState,speedLimit} from './physics.js';
import {BiasedShotEffects as ShotEffects} from './effect-selection.js';
import {SoundBank,SOUND_LIBRARY,SOUND_EVENTS,validateSoundChoices} from './audio.js';
import {handleMouseReleaseKey,MOUSE_RELEASE_HINT} from './mouse-controls.js';
import {setupGameWindow} from './game-window.js';
const $=id=>document.getElementById(id),canvas=$('rink'),ctx=canvas.getContext('2d');
const store={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('保存領域が使えません。設定をファイルに書き出してください。');}}};
const previousSettings=store.get('online-airhockey.demo.settings.v02',null)||store.get('online-airhockey.demo.settings.v01',null);
const previousVersion=store.get('online-airhockey.demo.settings.v02',null)?'0.2':'0.1';
let settings=normalizeSettings(store.get('online-airhockey.demo.settings.v03',previousSettings?upgradeSettings(previousSettings,previousVersion):DEFAULTS)),difficulty=5,winTarget=normalizeTarget(store.get('online-airhockey.demo.winTarget',6)),skinId=store.get('online-airhockey.demo.skin','beach');
let skins=[],nameList=[],defaultName='',snapshot=null,source=null,practice=null,paused=false,joined=false,connected=false,images=new Map();
let practiceKind='play',watchLevels=[5,5],watchTarget=6,watchNextAt=0,watchTotals;
function resetWatchTotals(){watchTotals={matches:0,wins:[0,0],arms:[0,0],misses:[0,0],normal:[0,0],powered:[0,0],peak:0,results:[]};}
resetWatchTotals();
let lastEvent=0,gameKey='',bursts=[],particles=[],previousGoal=-1,previousHit=-1,lastStep=performance.now(),accumulator=0,lastOnlineInput=0;
const shotEffects=new ShotEffects();
const soundBank=new SoundBank();
soundBank.choices=validateSoundChoices(store.get('online-airhockey.demo.soundChoices',{}));
if(store.get('online-airhockey.demo.audioLayersVersion',null)!=='0.5'){
  for(const grade of ['SMASH','DRIVE','COOL']){
    const old=SOUND_LIBRARY.find(s=>s.id===soundBank.choices[grade]);
    if(old&&/^(laser|powerUp)/.test(old.file)){soundBank.choices.laserHit||=old.id;soundBank.choices[grade]='';}
  }
  store.set('online-airhockey.demo.soundChoices',soundBank.choices);store.set('online-airhockey.demo.audioLayersVersion','0.5');
}
soundBank.volume=Math.max(0,Math.min(1,Number(store.get('online-airhockey.demo.soundVolume',.5))||0));
let pointer={x:180,y:H/2},audio=null,toastTimer,heartbeatTimer,settingsOpen=true;
let windowInactive=false;
const options={sound:true,effects:true,readout:true};
let renderedRule='';
const difficultyLabels=['入門','やさしい','初級＋','中級手前','ふつう','中級＋','むずかしい','上級手前','上級・強打巧者','達人・強打精密'];
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
const savedDemoName=sessionStorage.getItem('airhockey-demo.name');
let demoPlayer=savedDemoName?{id:'cpu-demo',name:savedDemoName,wins:0,ready:false,mode:'lobby',retained:false}:null;
function demoSnapshot(){return {me:demoPlayer,players:demoPlayer?[demoPlayer]:[],queue:demoPlayer?[demoPlayer.id]:[],match:null,lastResult:null};}
async function api(route,data={}){
  if(windowInactive)throw Error('ゲームは別のウィンドウで操作中です。');
  if(route==='join'){
    const name=String(data.name||'').trim().normalize('NFC');
    if(!name||Array.from(name).length>6||/[\p{C}<>]/u.test(name))throw Error('名前は1〜6文字で入力してください。');
    demoPlayer={id:'cpu-demo',name,wins:0,ready:false,mode:'lobby',retained:false};sessionStorage.setItem('airhockey-demo.name',name);
  }else if(route==='leave'){demoPlayer=null;sessionStorage.removeItem('airhockey-demo.name');}
  else if(route==='mode'&&demoPlayer)demoPlayer.mode=['practice','watch'].includes(data.mode)?data.mode:'lobby';
  else if(!['settings','heartbeat'].includes(route))throw Error('CPU専用デモです。ネット対戦は設置版で利用できます。');
  snapshot=demoSnapshot();if(joined&&demoPlayer)renderLobby();return {ok:true};
}
function safely(promise){promise.catch(error=>toast(error.message));}
function lostSession(){releaseMouse();joined=false;connected=false;source?.close();clearInterval(heartbeatTimer);practice=null;snapshot=null;$('room').hidden=true;$('entry').hidden=false;toast('参加セッションが終了しました。もう一度入室してください。');loadInfo();}
function sound(type){
  if(!options.sound||!audio)return;
  const played=soundBank.play(type||'hit');if(['COOL','DRIVE','SMASH'].includes(type))soundBank.play('laserHit');if(played)return;
  const frequencies=type==='goal'?[440,660,880]:type==='SMASH'?[150,500,900]:type==='DRIVE'?[200,600]:[350];
  frequencies.forEach((f,i)=>{const t=audio.currentTime+i*.065,o=audio.createOscillator(),gain=audio.createGain();o.type=type==='goal'?'square':'triangle';o.frequency.setValueAtTime(f,t);gain.gain.setValueAtTime(.035,t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);o.connect(gain).connect(audio.destination);o.start(t);o.stop(t+.14);});
}
function enableAudio(){audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});soundBank.load(audio);}
let randomSkinId=null;
function rollSkin(){const pool=skins.filter(s=>!s.random&&s.id!==randomSkinId);randomSkinId=pool[Math.floor(Math.random()*pool.length)]?.id||skins.find(s=>!s.random)?.id;}
function selectedSkin(){
  if(skinId==='random'&&currentGame()){if(!randomSkinId)rollSkin();return skins.find(s=>s.id===randomSkinId)||skins.find(s=>!s.random);}
  return skins.find(s=>s.id===skinId)||skins[0];
}
function currentGame(){return practice||snapshot?.match?.game||null;}
function mySide(){return practice?(practiceKind==='watch'?-1:0):(snapshot?.match?.side??-1);}
function makePracticeGame(){const g=createGame(settings,practiceKind==='watch'?watchTarget:winTarget);g.endless=practiceKind!=='watch'&&winTarget===0;return g;}
function randomDifferent(size,last){if(size<2)return 0;return (last+1+Math.floor(Math.random()*(size-1)))%size;}
async function loadInfo(){
  if(windowInactive)return;
  try{
    const info={skins:DEMO_DATA.skins,names:DEMO_DATA['random-names'],taglines:DEMO_DATA.taglines,defaultName:sessionStorage.getItem('airhockey-demo.name')||'名無しさん１',count:0,session:demoPlayer};skins=info.skins;nameList=info.names;defaultName=info.defaultName;
    if(Array.isArray(info.taglines)&&info.taglines.length){
      const previous=store.get('online-airhockey.demo.lastTagline',-1),index=Number.isInteger(previous)&&previous>=0&&previous<info.taglines.length?randomDifferent(info.taglines.length,previous):Math.floor(Math.random()*info.taglines.length);
      const [top,...bottom]=String(info.taglines[index]).split('\n'),em=document.createElement('em');em.textContent=bottom.join(' ');
      $('heroTagline').replaceChildren(document.createTextNode(top),document.createElement('br'),em);store.set('online-airhockey.demo.lastTagline',index);
    }
    $('nameInput').value=defaultName;$('capacity').textContent='CPU専用 · ゲームサーバーへの接続なし';
    $('joinButton').disabled=info.count>=5&&!info.session;$('connection').textContent='CPU DEMO';
    for(const skin of skins)if(!images.has(skin.image)){const img=new Image();img.src=skin.image;images.set(skin.image,img);}
    buildSkins();if(info.session)await enter();
  }catch{$('entryError').textContent='デモの初期化に失敗しました。ページを開き直してください。';$('connection').textContent='未接続';}
}
let ruleSave=Promise.resolve();
function publishRule(){if(!joined)return Promise.resolve();const payload={settings:{...settings},target:winTarget};ruleSave=ruleSave.catch(()=>{}).then(()=>api('settings',payload));ruleSave.catch(error=>toast(error.message));return ruleSave;}
async function enter(){
  if(windowInactive)return;
  joined=true;connected=true;snapshot=demoSnapshot();await publishRule();$('entry').hidden=true;$('room').hidden=false;$('connection').textContent='CPU DEMO · ブラウザ内で実行';renderLobby();
}
$('joinButton').onclick=async()=>{
  $('entryError').textContent='';$('joinButton').disabled=true;
  try{enableAudio();await api('join',{name:$('nameInput').value,useDefault:$('nameInput').value===defaultName});await enter();}
  catch(error){$('entryError').textContent=error.message;$('joinButton').disabled=false;}
};
$('nameInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)$('joinButton').click();});
$('randomName').onclick=()=>{
  const available=nameList.filter(n=>n!==$('nameInput').value);
  if(!available.length){toast('候補がありません。data/random-names.json に名前を追加できます。');return;}
  $('nameInput').value=available[Math.floor(Math.random()*available.length)];
};
$('exitButton').onclick=async()=>{
  if(snapshot?.match?.side>=0&&!confirm('退出すると対戦は棄権になります。退出しますか？'))return;
  try{await api('leave');source?.close();clearInterval(heartbeatTimer);joined=false;connected=false;practice=null;snapshot=null;$('room').hidden=true;$('entry').hidden=false;$('joinButton').disabled=false;await loadInfo();}catch(error){toast(error.message);}
};
function renderLobby(){
  if(!snapshot?.me)return;
  document.body.classList.toggle('practicing',!!practice);
  document.body.classList.toggle('watching',!!practice&&practiceKind==='watch');
  if(practice&&practiceKind==='watch')$('difficultyName').textContent=`左Lv.${watchLevels[0]} / 右Lv.${watchLevels[1]}`;
  else $('difficultyName').textContent=difficultyLabels[difficulty-1];
  $('myName').textContent=snapshot.me.name+' win'+(snapshot.me.wins||0);$('playerCount').textContent=`${snapshot.players.length} / 5`;
  const fragment=document.createDocumentFragment();
  for(let i=0;i<5;i++){
    const p=snapshot.players[i],li=document.createElement('li'),pos=document.createElement('span'),name=document.createElement('span'),status=document.createElement('span');
    pos.className='position';pos.textContent=String(i+1).padStart(2,'0');name.className='player-name';status.className='status';
    if(p){name.textContent=p.name;const wins=document.createElement('span');wins.className='win-count';wins.textContent='win'+(p.wins||0);name.append(wins);if(p.id===snapshot.me.id)name.append(document.createTextNode(' · あなた'));status.textContent=p.mode==='match'?'対戦中':p.mode==='watch'?'CPU観戦中':p.mode==='practice'?'CPU練習中':p.ready?'✓ 準備OK':p.retained?'勝者 · 準備待ち':'準備待ち';li.className=(p.ready?'ready ':'')+(p.id===snapshot.me.id?'self':'');}
    else{li.className='empty';name.textContent='空き枠';status.textContent='参加できます';}
    li.append(pos,name,status);fragment.append(li);
  }
  $('roster').replaceChildren(fragment);
  const inMatch=snapshot.match?.side>=0;
  $('readyButton').textContent=snapshot.me.ready?'準備OKを取り消す':practice?'練習中 · 戻ると準備できます':'準備OK';
  $('readyButton').disabled=!connected||!!practice||inMatch;
  $('startPractice').disabled=inMatch||!!practice;
  $('startWatch').disabled=inMatch||!!practice;
  $('forfeitButton').hidden=!(inMatch||practice&&practiceKind==='play');$('practiceTools').hidden=!(practice||inMatch);
  for(const id of ['pauseButton','resetPosition','resetScore']){$(id).disabled=!practice;$(id).title=practice?'':'CPU練習・CPU観戦で使用できます';}
  $('quitPractice').hidden=!practice;
  $('roomTitle').textContent=practice?(practiceKind==='watch'?'CPU同士を観戦':'CPUと練習'):inMatch?'オンライン対戦':'対戦待受';
  $('modeEyebrow').textContent=practice?(practiceKind==='watch'?'CPU WATCH':'PRACTICE LAB'):inMatch?'MATCH ON!':'THE LOBBY';
  $('watchStatus').hidden=!(practice&&practiceKind==='watch');$('quitPractice').textContent=practiceKind==='watch'?'観戦をやめる':'CPU戦をやめる';
  $('winTarget').disabled=!!practice&&practiceKind==='watch';
  $('queueHelp').textContent='勝者も再度準備OKが必要。ほかの2人が先にそろうと、勝者は最後尾へ。';
  renderRulePanel();
  if(snapshot.lastResult){const r=snapshot.lastResult;$('resultNotice').textContent=`前の試合：${r.names[0]} ${r.score[0]} – ${r.score[1]} ${r.names[1]} ／ ${r.winner} の勝利（${r.reason}）`;}
}
$('readyButton').onclick=async()=>{try{await ruleSave;await api('ready',{ready:!snapshot?.me?.ready});}catch(error){toast(error.message);}};
$('forfeitButton').onclick=()=>{
  const g=currentGame(),side=mySide();if(!g||side<0||g.status==='finished')return;
  releaseMouse();if(!confirm('降参しますか？ 相手の勝利になります。'))return;
  if(practice){forfeit(practice,side);paused=false;bursts=[];shotEffects.reset();toast('降参しました。CPUの勝利です。');}
  else if(connected)safely(api('input',{action:'forfeit'}));
};
for(let i=1;i<=10;i++){
  const button=document.createElement('button');button.textContent=i;button.title=difficultyLabels[i-1];button.className=i===difficulty?'selected':'';
  button.onclick=()=>{difficulty=i;$('difficultyName').textContent=difficultyLabels[i-1];for(const b of $('difficulties').children)b.classList.toggle('selected',Number(b.textContent)===i);};$('difficulties').append(button);
}
$('startPractice').onclick=async()=>{
  try{enableAudio();await api('mode',{mode:'practice'});practiceKind='play';practice=makePracticeGame();paused=false;accumulator=0;gameKey='';$('pauseButton').textContent='一時停止';renderLobby();toast('マウスで移動。クリックでセットして開始！');}catch(error){toast(error.message);}
};
$('quitPractice').onclick=async()=>{
  releaseMouse();
  practice=null;paused=false;bursts=[];shotEffects.reset();particles=[];gameKey='';renderLobby();
  try{await api('mode',{mode:'lobby'});}catch(error){toast(error.message);}
};
$('pauseButton').onclick=()=>{if(!practice)return;paused=!paused;$('pauseButton').textContent=paused?'再開する':'一時停止';};
function resetPractice(clearScore=false){
  if(!practice)return;const old=practice,next=makePracticeGame();watchNextAt=0;
  if(!clearScore){next.score=[...old.score];next.serveSide=old.serveSide;}
  next.ai.serveAt=.9;practice=next;gameKey='';bursts=[];shotEffects.reset();particles=[];
}
$('resetPosition').onclick=()=>{resetPractice(false);toast('配置をリセットしました。');};
$('resetScore').onclick=()=>{resetPractice(true);toast('得点をリセットしました。');};
function changeSettings(){
  settings=normalizeSettings(settings);syncSettings();store.set('online-airhockey.demo.settings.v03',settings);publishRule();renderRulePanel();
  if(practice){resetPractice(false);paused=true;$('pauseButton').textContent='再開する';toast('設定を適用しました。「再開する」で続けられます。');}
}
function buildSettings(){
  for(let index=0;index<SETTINGS.length;index++){
    const [key,label,min,max,,hint]=SETTINGS[index];
    if(index===0||key==='smashFrames'){
      const group=document.createElement('div');group.className='group-label';group.textContent=index===0?'PHYSICS / 遊び心地':'TIMING / 強打の調整';$('settingsList').append(group);
    }
    const item=document.createElement('div');item.className='setting';
    const head=document.createElement('div');head.className='setting-head';const name=document.createElement('label');name.htmlFor='range-'+key;name.textContent=label;
    const value=document.createElement('input');value.type='number';value.id='value-'+key;value.min=min;value.max=max;value.step=1;value.setAttribute('aria-label',label+'の数値');
    const range=document.createElement('input');range.type='range';range.id='range-'+key;range.min=min;range.max=max;range.step=1;
    const small=document.createElement('small');small.textContent=hint;
    const edit=event=>{settings[key]=Number(event.target.value);changeSettings();};value.addEventListener('change',edit);range.addEventListener('input',event=>{value.value=event.target.value;});range.addEventListener('change',edit);
    head.append(name,value);item.append(head,range,small);$('settingsList').append(item);
  }
  syncSettings();
}
function syncSettings(){for(const [key]of SETTINGS){$('range-'+key).value=settings[key];$('value-'+key).value=settings[key];}for(const style of PUCK_STYLES)if($('puckColor-'+style.id))$('puckColor-'+style.id).checked=settings.puckColor===style.id;}
$('winTarget').onchange=()=>{winTarget=Number($('winTarget').value);store.set('online-airhockey.demo.winTarget',winTarget);publishRule();renderRulePanel();if(practice){resetPractice(true);paused=true;$('pauseButton').textContent='再開する';toast('勝利条件を変更し、得点をリセットしました。');}};
$('defaultsButton').onclick=()=>{settings={...DEFAULTS};winTarget=6;store.set('online-airhockey.demo.winTarget',winTarget);$('winTarget').value=winTarget;changeSettings();if(practice)resetPractice(true);toast('数値・パック色・勝利条件をデフォルトに戻しました。保存したプリセットは残ります。');};
$('toggleSettings').onclick=()=>{settingsOpen=!settingsOpen;$('settingsBody').hidden=!settingsOpen;$('toggleSettings').textContent=settingsOpen?'折りたたむ':'調整を表示';};
$('soundOn').onchange=()=>{options.sound=$('soundOn').checked;if(options.sound)enableAudio();else soundBank.stop();};
$('effectsOn').onchange=()=>{options.effects=$('effectsOn').checked;if(!options.effects){bursts=[];particles=[];shotEffects.reset();}};
$('readoutOn').onchange=()=>{options.readout=$('readoutOn').checked;$('hitReadout').hidden=!options.readout;};
function presets(){
  const current=store.get('online-airhockey.demo.presets.v03',null);if(current)return current;
  const old=store.get('online-airhockey.demo.presets.v02',null)||store.get('online-airhockey.demo.presets.v01',{}),updated=Object.fromEntries(Object.entries(old).map(([name,data])=>[name,{...data,version:VERSION,difficulty:upgradeDifficulty(data.difficulty,data.version||'0.1'),settings:upgradeSettings(data.settings,data.version||'0.1')}]));
  store.set('online-airhockey.demo.presets.v03',updated);return updated;
}
function refreshPresets(){const current=$('presets').value;$('presets').replaceChildren(new Option('保存した設定を選択',''));for(const name of Object.keys(presets()))$('presets').add(new Option(name,name));$('presets').value=current;}
function presetData(){return {version:VERSION,settings:{...settings},difficulty,winTarget,skinId,soundChoices:{...soundBank.choices},soundVolume:soundBank.volume};}
function applyPreset(data){
  if(!data||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('設定ファイルの形式が違います。');
  if(data.version&&!['0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','1.0','1.1','1.2',VERSION].includes(data.version))throw Error('このバージョンの設定ファイルには対応していません。');
  if(data.soundChoices){soundBank.choices=validateSoundChoices(data.soundChoices);store.set('online-airhockey.demo.soundChoices',soundBank.choices);}
  if(Number.isFinite(data.soundVolume)){soundBank.volume=Math.max(0,Math.min(1,data.soundVolume));store.set('online-airhockey.demo.soundVolume',soundBank.volume);}
  syncAudioControls();
  settings=upgradeSettings(data.settings,data.version||'0.1');winTarget=normalizeTarget(data.winTarget);store.set('online-airhockey.demo.winTarget',winTarget);$('winTarget').value=winTarget;
  difficulty=upgradeDifficulty(data.difficulty,data.version||'0.1');$('difficulties').children[difficulty-1].click();
  skinId=skins.some(s=>s.id===data.skinId)?data.skinId:'beach';buildSkins();changeSettings();
}
$('savePreset').onclick=()=>{const name=$('presetName').value.trim();if(!name){toast('設定の名前を入力してください。');return;}const all=presets();if(Object.hasOwn(all,name)&&!confirm('同じ名前の設定を上書きしますか？'))return;Object.defineProperty(all,name,{value:presetData(),enumerable:true,writable:true,configurable:true});store.set('online-airhockey.demo.presets.v03',all);refreshPresets();$('presets').value=name;toast('「'+name+'」を保存しました。');};
$('loadPreset').onclick=()=>{const data=presets()[$('presets').value];if(!data){toast('設定を選んでください。');return;}applyPreset(data);toast('設定を読み込みました。');};
$('deletePreset').onclick=()=>{const name=$('presets').value;if(!name)return;if(!confirm('「'+name+'」を削除しますか？'))return;const all=presets();delete all[name];store.set('online-airhockey.demo.presets.v03',all);refreshPresets();};
$('exportPreset').onclick=()=>{const blob=new Blob([JSON.stringify(presetData(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hockey-v'+VERSION+'-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('importPreset').onchange=async()=>{try{const file=$('importPreset').files[0];if(!file)return;if(file.size>32000)throw Error('設定ファイルが大きすぎます。');applyPreset(JSON.parse(await file.text()));toast('ファイルの設定を読み込みました。');}catch(error){toast(error.message);}finally{$('importPreset').value='';}};
function buildSkins(){
  $('skinGrid').replaceChildren();
  for(const skin of skins){
    const b=document.createElement('button');b.className='skin-button'+(skin.id===skinId?' selected':'');b.setAttribute('aria-label','ステージ：'+skin.name);b.setAttribute('aria-pressed',String(skin.id===skinId));
    const preview=document.createElement('span');preview.className='skin-preview';preview.style.backgroundImage=`url("${skin.image}")`;
    const grid=skin.grid||[1,1],cell=skin.cell||[0,0];preview.style.backgroundSize=`${grid[0]*100}% ${grid[1]*100}%`;preview.style.backgroundPosition=`${grid[0]>1?cell[0]/(grid[0]-1)*100:0}% ${grid[1]>1?cell[1]/(grid[1]-1)*100:0}%`;
    const text=document.createElement('b');text.textContent=skin.name;b.append(preview,text);
    b.onclick=()=>{skinId=skin.id;if(skin.random)rollSkin();store.set('online-airhockey.demo.skin',skinId);buildSkins();};$('skinGrid').append(b);
  }
  $('stageName').textContent=selectedSkin()?.name||'ビーチ';
}
function releaseMouse(){if(document.pointerLockElement===canvas)document.exitPointerLock();}
function lockMouse(){
  if(document.pointerLockElement===canvas)return;
  if(!canvas.requestPointerLock){toast('このブラウザではマウス固定が使えません。EdgeかChromeで開いてください。');return;}
  const g=currentGame(),side=mySide(),p=g?.paddles[side];if(p){pointer={x:p.x,y:p.y};if(practice)setTarget(g,side,p.x,p.y);}
  try{const promise=canvas.requestPointerLock();promise?.catch(()=>toast('マウスを固定できませんでした。もう一度コートをクリックしてください。'));}
  catch{toast('マウス固定が許可されていません。EdgeかChromeでも試してください。');}
}
function move(event){
  const r=canvas.getBoundingClientRect(),g=currentGame(),side=mySide();
  if(document.pointerLockElement===canvas){
    const radius=dimensions(g?.settings||settings).paddle;
    pointer={x:Math.max(side===1?W/2+radius:radius,Math.min(side===1?W-radius:W/2-radius,pointer.x+event.movementX/r.width*W)),
      y:Math.max(radius,Math.min(H-radius,pointer.y+event.movementY/r.height*H))};
  }else pointer={x:(event.clientX-r.left)/r.width*W,y:(event.clientY-r.top)/r.height*H};
  if(practice&&practiceKind==='play')setTarget(practice,0,pointer.x,pointer.y);
}
canvas.addEventListener('mousemove',move);
canvas.addEventListener('mousedown',event=>{
  if(event.button===2){event.preventDefault();releaseMouse();return;}
  if(event.button!==0)return;event.preventDefault();
  const g=currentGame();if(!g||mySide()<0||g.status==='finished')return;
  if(paused&&practice){paused=false;$('pauseButton').textContent='一時停止';lockMouse();return;}
  if(document.pointerLockElement!==canvas)move(event);clickCourt();
});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();releaseMouse();});
document.addEventListener('keydown',event=>handleMouseReleaseKey(event,document.pointerLockElement===canvas,releaseMouse),true);
document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;document.body.classList.toggle('mouse-locked',locked);
  if(!locked&&practice&&!paused&&practice.status!=='finished'){paused=true;$('pauseButton').textContent='再開する';}
});
document.addEventListener('pointerlockerror',()=>toast('マウス固定が許可されませんでした。通常のEdgeかChromeでも試してください。'));
$('serveButton').onclick=()=>clickCourt();
function clickCourt(){
  enableAudio();const g=currentGame(),side=mySide();if(!g||side<0||paused)return;
  if(g.status==='finished')return;lockMouse();
  if(practice){if(g.status==='serve'){if(serve(g,side))pointer={x:g.paddles[side].x,y:g.paddles[side].y};}else arm(g,side);}
  else if(connected){const action=g.status==='serve'?'serve':'arm';safely(api('input',{...pointer,action}));}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&practice&&!paused){paused=true;$('pauseButton').textContent='再開する';}});
window.addEventListener('blur',()=>{if(practice&&!paused){paused=true;$('pauseButton').textContent='再開する';}});
function processEvents(g){
  const key=practice?'practice-'+(practice===lastPractice?'same':'new'):'online-'+snapshot?.match?.id;
  if(practice!==lastPractice||(!practice&&gameKey!==key)){if(skinId==='random')rollSkin();lastEvent=practice?0:(g.events.at(-1)?.id||0);lastPractice=practice;gameKey=key;bursts=[];particles=[];shotEffects.reset();}
  for(const e of g.events){if(e.id<=lastEvent)continue;lastEvent=e.id;
    if(e.type==='hit'){
      sound(e.grade);if(options.effects)shotEffects.trigger(e.x??g.puck.x,e.y??g.puck.y,e.grade,performance.now());
      if(e.grade){previousHit=randomDifferent(5,previousHit);bursts.push({text:e.grade+'!'+(e.chain>1?' ×'+e.chain:''),style:previousHit,at:performance.now(),duration:650,x:e.side===0?310:690,y:105});}
    }
    if(e.type==='goal'){
      sound('goal');const words=['GOAL!','GOOOAL!!','GOOOOAL!','GOAL!!','GOOOAL!'];previousGoal=randomDifferent(words.length,previousGoal);
      bursts.push({text:words[previousGoal],style:previousGoal,at:performance.now(),duration:1200,x:500,y:180});
      for(let i=0;i<45;i++)particles.push({x:500,y:260,vx:(Math.random()-.5)*700,vy:(Math.random()-.7)*600,at:performance.now(),color:['#ffe066','#ff717b','#43dffb','#e590ff'][i%4]});
    }
    if(e.type==='pointState'&&options.effects){const pool=e.kind==='deuce'?['DEUCE','DEUCE!','DEUCE!!']:['MATCH POINT','MATCH POINT!','MATCH POINT!!'];previousPoint=randomDifferent(pool.length,previousPoint);bursts.push({text:pool[previousPoint],style:randomDifferent(5,previousHit),at:performance.now()+750,duration:1400,x:500,y:280,point:true});}
    if(e.type==='stuck')toast('パックが止まったため、再セットできます。');
    if(e.type==='wall')sound('wall');
    if(e.type==='serve')sound('serve');
    if(e.type==='win')sound('win');
    if(e.type==='arm')sound('charge');
    if(e.type==='miss'&&options.effects)bursts.push({text:'MISS',style:3,at:performance.now(),duration:320,x:e.side===0?180:820,y:100});
    if(practice&&practiceKind==='watch'){
      if(e.type==='arm')watchTotals.arms[e.side]++;if(e.type==='miss')watchTotals.misses[e.side]++;
      if(e.type==='hit')watchTotals[e.grade?'powered':'normal'][e.side]++;
      if(e.type==='win'){watchTotals.matches++;watchTotals.wins[e.side]++;watchTotals.results.unshift(`第${watchTotals.matches}試合：${g.score[0]} – ${g.score[1]} · ${e.side===0?'左':'右'}CPUの勝利 · ${Math.round(g.time)}秒`);watchTotals.results=watchTotals.results.slice(0,5);watchNextAt=performance.now()+3500;}
    }
  }
}
let lastPractice=null,previousPoint=-1;
function updateLabels(g){
  const side=mySide();
  $('forfeitButton').disabled=!g||g.status==='finished'||(!practice&&!connected);
  $('pauseButton').disabled=!practice||g?.status==='finished';
  $('stageName').textContent=selectedSkin()?.name||'ビーチ';
  const watching=!!practice&&practiceKind==='watch';
  $('leftName').textContent=watching?'左CPU Lv.'+watchLevels[0]:practice?snapshot?.me?.name||'あなた':snapshot?.match?.names[0]||'あなた';
  $('rightName').textContent=watching?'右CPU Lv.'+watchLevels[1]:practice?'CPU Lv.'+difficulty:snapshot?.match?.names[1]||'CPU Lv.'+difficulty;
  const scoring=g?scoreState(g):{labels:['0','0']};
  for(const [i,id]of ['leftScore','rightScore'].entries()){$(id).textContent=scoring.labels[i];$(id).classList.toggle('advantage',scoring.labels[i].endsWith('A'));}
  $('matchBadge').textContent=watching?'CPU同士を観戦中':practice?'CPU練習中':snapshot?.match?(side>=0?'対戦中 · あなたは'+(side===0?'左':'右'):'観戦中'):'待受中';
  $('ruleLabel').textContent=g?(g.endless?'勝敗なしで練習':scoreLabel(g)):'6本先取 · デュースあり';
  const overlay=$('courtOverlay');let title='',text='',button=false;
  overlay.classList.toggle('setting-up',g?.status==='serve'&&!paused);
  if(!g){title='LET’S PLAY!';text='「CPUと戦う」で、遊び心地を試そう。';}
  else if(paused&&practice){title='PAUSED';text='設定を調整して「再開する」で続けよう。';}
  else if(g.status==='finished'){title=watching?(g.winner===0?'LEFT CPU WINS!':'RIGHT CPU WINS!'):practice?(g.winner===0?'YOU WIN!':'CPU WINS!'):'MATCH OVER!';text=watching?($('watchAuto').checked?'まもなく次のCPU戦を開始します。':'「得点をリセット」で次の試合を開始できます。'):practice?'「得点をリセット」で再挑戦できます。':'まもなくロビーへ戻ります。';}
  else if(g.status==='serve'){
    const mine=g.serveSide===side;title=mine?'YOUR SET!':'NEXT SET';
    text=mine?'あなたの陣地にパックをセットします':practice?'CPUがセットしています…':'失点したプレイヤーのセット待ち';button=mine;
  }
  if(!paused&&g?.status==='serve'&&bursts.some(b=>b.point&&performance.now()<b.at+b.duration))title='';
  overlay.hidden=!title;$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('serveButton').hidden=!button;
  $('playHint').textContent=(side===1?'右':'左')+'の陣地を操作 · '+(document.pointerLockElement===canvas?MOUSE_RELEASE_HINT:'コートを左クリックでマウス固定');
  if(watching)$('playHint').textContent='CPU同士の自動対戦 · マウス操作なし · 一時停止・終了できます';
  if(g&&side>=0){const p=g.paddles[side],remaining=Math.max(0,p.nextArm-g.time);$('shotState').textContent=remaining>0?`強打 あと ${remaining.toFixed(1)}秒`:'強打 READY';}
  else $('shotState').textContent='';
  if(g&&(g.powerChain||0)>1)$('shotState').textContent=`COUNTER ×${g.powerChain} · 上限 ${Math.round(speedLimit(g))}`;
  if(watching){const tacticNames={middle:'中域',goal:'ゴール前',diagonal:'斜め攻撃',press:'前へ詰める'};$('watchNumbers').textContent=`完了 ${watchTotals.matches}試合 · 左 ${watchTotals.wins[0]}勝 / 右 ${watchTotals.wins[1]}勝 · 今の試合 ${Math.round(g.time)}秒\n通常 ${watchTotals.normal.join(' / ')} · 強打 ${watchTotals.powered.join(' / ')} · ボタン ${watchTotals.arms.join(' / ')} · 空振り ${watchTotals.misses.join(' / ')}（左 / 右）\n最高速度 ${Math.round(watchTotals.peak)} · 現在 ${Math.round(Math.hypot(g.puck.vx,g.puck.vy))}\n戦術 ${[0,1].map(i=>tacticNames[g.ai.controllers?.[i]?.tactic]||'準備').join(' / ')}`;$('watchResults').textContent=watchTotals.results.join('\n');}
  const hit=g?.lastHit;if(options.readout)$('hitReadout').textContent=hit?`直前の打撃：${watching?(hit.side===0?'左CPU':'右CPU'):hit.side===side?'あなた':practice?'CPU':'相手'} · ${hit.grade}${hit.frames!==null?' · クリックから '+hit.frames+'フレーム':''} ／ SMASH ≤${g.settings.smashFrames}f・DRIVE ≤${g.settings.driveFrames}f・COOL ≤${g.settings.coolFrames}f`:'直前の打撃：まだ打撃がありません';
}
function circle(x,y,r,fill,stroke='#102236',width=3){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function draw(g,now){
  const skin=selectedSkin(),img=images.get(skin?.image),d=dimensions(g?.settings||settings);
  ctx.clearRect(0,0,W,H);
  if(img?.complete&&img.naturalWidth){const grid=skin.grid||[1,1],cell=skin.cell||[0,0],sw=img.naturalWidth/grid[0],sh=img.naturalHeight/grid[1];ctx.drawImage(img,sw*cell[0],sh*cell[1],sw,sh,0,0,W,H);}
  else{ctx.fillStyle=skin?.dark?'#142337':'#61c9c8';ctx.fillRect(0,0,W,H);}
  ctx.fillStyle=skin?.dark?'#0c162822':'#ffffff16';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=skin?.dark?'#b8edf8a8':'#16435480';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W/2,12);ctx.lineTo(W/2,H-12);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,70,0,Math.PI*2);ctx.stroke();
  for(const side of [0,1]){
    const color=side?'#ff737e':'#35dbf5',x=side?W-6:6,top=(H-d.goal)/2;
    ctx.strokeStyle=skin?.accent||'#ffde60';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,9);ctx.lineTo(side?W/2:W/2,9);ctx.moveTo(x,top+d.goal);ctx.lineTo(x,H-9);ctx.lineTo(W/2,H-9);ctx.stroke();
    ctx.fillStyle='#0d203ce0';ctx.fillRect(side?W-15:0,top,15,d.goal);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(side?W-15:0,top,15,d.goal);
    ctx.save();ctx.beginPath();ctx.rect(side?W-15:0,top,15,d.goal);ctx.clip();ctx.strokeStyle='#b7d9e447';ctx.lineWidth=1;for(let y=top-20;y<top+d.goal+20;y+=12){ctx.beginPath();ctx.moveTo(side?W-20:-5,y);ctx.lineTo(side?W+5:20,y+18);ctx.stroke();}ctx.restore();
  }
  if(g&&options.effects&&g.status==='playing'){
    shotEffects.draw(ctx,g.puck,d.puck,now);
  }else shotEffects.reset();
  const paddles=g?.paddles||[{x:180,y:280},{x:820,y:280}];
  paddles.forEach((p,side)=>{
    const color=side?'#ff7278':'#27d9ff';
    circle(p.x+2,p.y+5,d.paddle+2,'#10233199',null);
    const grad=ctx.createRadialGradient(p.x-8,p.y-9,2,p.x,p.y,d.paddle);grad.addColorStop(0,side?'#ffcbbe':'#c2ffff');grad.addColorStop(.4,color);grad.addColorStop(1,side?'#bc314b':'#067eaf');
    circle(p.x,p.y,d.paddle,grad,'#142c45',3);circle(p.x,p.y-2,d.paddle*.64,'#ffffff17','#ffffff8a',2);circle(p.x,p.y-4,d.paddle*.38,color,'#173548',2);
    if(g&&p.armedAt!==null&&g.status==='playing'){
      ctx.save();ctx.strokeStyle='#a9ffff';ctx.shadowColor='#30dfff';ctx.shadowBlur=12;ctx.lineWidth=3;
      for(let ray=0;ray<8;ray++){const angle=ray*Math.PI/4+now/220;ctx.beginPath();ctx.moveTo(p.x+Math.cos(angle)*(d.paddle+7),p.y+Math.sin(angle)*(d.paddle+7));ctx.lineTo(p.x+Math.cos(angle)*(d.paddle+27),p.y+Math.sin(angle)*(d.paddle+27));ctx.stroke();}ctx.restore();
      const remaining=Math.max(0,1-(g.time-p.armedAt)*60/g.settings.coolFrames);ctx.strokeStyle='#fffbd0';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,d.paddle+10+remaining*8,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,d.paddle+6,0,Math.PI*2);ctx.stroke();
    }
  });
  if(!g||g.status==='playing'){
    const b=g?.puck||{x:640,y:320};circle(b.x+2,b.y+3,d.puck+1,'#11233866',null);
    if(!(options.effects&&shotEffects.rainbow.drawPuck(ctx,b,d.puck,now))){const style=PUCK_STYLES.find(style=>style.id===(g?.settings||settings).puckColor)||PUCK_STYLES[0];circle(b.x,b.y,d.puck,style.color,style.edge,2);circle(b.x-2,b.y-3,d.puck*.60,style.highlight,null);}
  }
  if(options.effects){
    particles=particles.filter(p=>now-p.at<1000);for(const p of particles){const t=(now-p.at)/1000;ctx.globalAlpha=1-t;ctx.fillStyle=p.color;ctx.fillRect(p.x+p.vx*t,p.y+p.vy*t+280*t*t,6,11);}ctx.globalAlpha=1;
    bursts=bursts.filter(b=>now-b.at<b.duration);for(const b of bursts){
      if(now<b.at)continue;
      const age=(now-b.at)/b.duration,scale=Math.min(1,(age+.05)*9),colors=['#ffe15b','#ff83d0','#8eeaff','#fff5dc','#c3ff7e'];
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate([-.09,.06,-.04,.09,-.12][b.style]);ctx.scale(scale,scale);ctx.globalAlpha=Math.min(1,(1-age)*5);
      ctx.font='1000 italic '+(b.text==='MISS'?28:b.point?(b.text.startsWith('MATCH')?44:60):b.text.startsWith('GO')?70:52)+'px Impact, Arial Black, sans-serif';const width=ctx.measureText(b.text).width;
      if(b.text==='MISS'){ctx.textAlign='center';ctx.strokeStyle='#122035';ctx.lineWidth=4;ctx.strokeText(b.text,0,0);ctx.fillStyle='#e7e9e9';ctx.fillText(b.text,0,0);ctx.restore();continue;}
      ctx.beginPath();for(let i=0;i<24;i++){const angle=i/24*Math.PI*2,r=i%2?.77:1,x=Math.cos(angle)*(width/2+44)*r,y=Math.sin(angle)*58*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=colors[(b.style+2)%5];ctx.fill();ctx.lineWidth=5;ctx.strokeStyle='#172138';ctx.stroke();
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=9;ctx.strokeText(b.text,3,6);ctx.strokeText(b.text,0,0);ctx.fillStyle=colors[b.style];ctx.fillText(b.text,0,0);ctx.restore();
    }
  }
}
function frame(now){
  if(windowInactive){requestAnimationFrame(frame);return;}
  const delta=Math.min(.05,(now-lastStep)/1000);lastStep=now;
  if(practice&&!paused){
    const watching=practiceKind==='watch';
    if(watching&&practice.status==='finished'&&watchNextAt&&now>=watchNextAt&&$('watchAuto').checked)resetPractice(true);
    accumulator+=delta*(watching?Number($('watchSpeed').value):1);
    while(accumulator>=DT){if(watching)cpu(practice,watchLevels[0],0);cpu(practice,watching?watchLevels[1]:difficulty,1);tick(practice,DT);if(watching)watchTotals.peak=Math.max(watchTotals.peak,Math.hypot(practice.puck.vx,practice.puck.vy));accumulator-=DT;}
  }
  else accumulator=0;
  if(!practice&&snapshot?.match?.side>=0&&connected&&now-lastOnlineInput>34){lastOnlineInput=now;safely(api('input',pointer));}
  const g=currentGame();if(g)processEvents(g);else{bursts=[];shotEffects.reset();}
  if(document.pointerLockElement===canvas&&(!g||mySide()<0||g.status==='finished'||(practice&&paused)||(!practice&&!connected)))releaseMouse();
  updateLabels(g);draw(g,now);requestAnimationFrame(frame);
}
$('historyButton').onclick=()=>$('historyDialog').showModal();$('closeHistory').onclick=()=>$('historyDialog').close();
function buildAudioControls(){
  const box=document.createElement('details');box.className='audio-customizer';box.id='audioCustomizer';
  const summary=document.createElement('summary');summary.textContent='効果音を選んで試す · '+SOUND_LIBRARY.length+'種類';box.append(summary);
  const note=document.createElement('p');note.className='small muted';note.textContent='S37〜38は別サイトのホッケー打撃、S39〜40は合成音、S41〜44は原音寄りの実録音、S45〜46はゴールのカコン（合成音）。強打は打撃音とレーザー音を重ねます。';box.append(note);
  const volumeLabel=document.createElement('label');volumeLabel.className='section-label small';volumeLabel.textContent='効果音の音量';
  const volume=document.createElement('input');volume.type='range';volume.min=0;volume.max=100;volume.id='soundVolume';volume.setAttribute('aria-label','効果音の音量');
  const amount=document.createElement('output');amount.id='soundVolumeValue';volumeLabel.append(amount);box.append(volumeLabel,volume);
  volume.oninput=()=>{soundBank.volume=Number(volume.value)/100;store.set('online-airhockey.demo.soundVolume',soundBank.volume);syncAudioControls();};
  for(const [type,label] of Object.entries(SOUND_EVENTS)){
    const row=document.createElement('div');row.className='audio-row';const name=document.createElement('label');name.textContent=label;name.htmlFor='sound-'+type;
    const controls=document.createElement('div');controls.className='name-row';const select=document.createElement('select');select.id='sound-'+type;
    select.add(new Option('自動 · おすすめからランダム',''));select.add(new Option('この音を鳴らさない','mute'));
    for(const s of SOUND_LIBRARY)select.add(new Option(s.id+' · '+s.name,s.id));
    select.onchange=()=>{soundBank.choices[type]=select.value;store.set('online-airhockey.demo.soundChoices',soundBank.choices);};
    const play=document.createElement('button');play.className='secondary';play.textContent='試聴';play.setAttribute('aria-label',label+'を試聴');play.onclick=async()=>{
      if(!options.sound){toast('効果音をオンにすると試聴できます。');return;}
      enableAudio();await soundBank.load(audio);soundBank.stop();sound(type);
    };controls.append(select,play);row.append(name,controls);box.append(row);
  }
  const credit=document.createElement('a');credit.href='./assets/audio/CREDITS.md';credit.target='_blank';credit.rel='noopener';credit.textContent='効果音の作者・出典・ライセンス';credit.className='small';box.append(credit);
  const attribution=document.createElement('p');attribution.className='small muted';attribution.textContent='追加素材：Hockey Puck Slap / Hockey Stick Slap 2 — jameb32 (SoundBible, CC BY 3.0)。Air Hockey Rally Goal — BudgetPixel AI (CC BY 4.0)。切り出し・音量調整、一部低音化。リンクは素材一覧へ。';box.append(attribution);
  $('soundOn').closest('label').after(box);syncAudioControls();
}
function buildWatchControls(){
  const box=document.createElement('div');box.id='watchSetup';box.className='watch-setup';
  const title=document.createElement('h3');title.textContent='CPU × CPU · 観戦テスト';box.append(title);
  for(const [id,label]of [['watchLeft','左CPU'],['watchRight','右CPU']]){
    const row=document.createElement('label');row.className='section-label small';row.textContent=label;const select=document.createElement('select');select.id=id;
    for(let i=1;i<=10;i++)select.add(new Option('Lv.'+i+' · '+difficultyLabels[i-1],i));select.value=5;row.append(select);box.append(row);
  }
  const condition=document.createElement('label');condition.className='section-label small';condition.textContent='勝利条件';const target=document.createElement('select');target.id='watchTarget';target.add(new Option('6本先取＋デュース',6));target.add(new Option('11本先取＋デュース',11));condition.append(target);box.append(condition);
  const start=document.createElement('button');start.id='startWatch';start.className='secondary wide';start.textContent='CPU同士を観戦';box.append(start);$('startPractice').closest('section').append(box);
  const status=document.createElement('div');status.id='watchStatus';status.className='watch-status';status.hidden=true;
  const auto=document.createElement('label');auto.className='check';const check=document.createElement('input');check.type='checkbox';check.id='watchAuto';check.checked=true;auto.append(check,'試合終了後に自動で次の試合');
  const rate=document.createElement('label');rate.className='section-label small';rate.textContent='検証用の再生速度';const speed=document.createElement('select');speed.id='watchSpeed';for(const n of [1,2,4,8])speed.add(new Option(n+'倍',n));rate.append(speed);
  const numbers=document.createElement('p');numbers.id='watchNumbers';const results=document.createElement('p');results.id='watchResults';status.append(auto,rate,numbers,results);$('practiceTools').after(status);
  start.onclick=async()=>{try{
    enableAudio();await api('mode',{mode:'watch'});practiceKind='watch';watchLevels=[Number($('watchLeft').value),Number($('watchRight').value)];watchTarget=Number($('watchTarget').value);resetWatchTotals();watchNextAt=0;practice=makePracticeGame();paused=false;accumulator=0;gameKey='';$('pauseButton').textContent='一時停止';renderLobby();toast('CPU同士の対戦を開始します。セットも自動です。');
  }catch(error){toast(error.message);}};
}
function syncAudioControls(){
  if(!$('soundVolume'))return;$('soundVolume').value=Math.round(soundBank.volume*100);$('soundVolumeValue').textContent=$('soundVolume').value+'%';
  for(const type of Object.keys(SOUND_EVENTS))$('sound-'+type).value=soundBank.choices[type]||'';
}
function buildPuckControls(){
  const box=document.createElement('fieldset');box.className='puck-colors';box.id='puckColors';
  const legend=document.createElement('legend');legend.textContent='パックの種類';box.append(legend);
  for(const style of PUCK_STYLES){
    const label=document.createElement('label'),input=document.createElement('input'),dot=document.createElement('span');
    input.type='radio';input.name='puckColor';input.id='puckColor-'+style.id;input.value=style.id;input.checked=settings.puckColor===style.id;
    input.onchange=()=>{if(input.checked){settings.puckColor=style.id;changeSettings();}};
    dot.className='puck-swatch';dot.style.backgroundColor=style.color;dot.setAttribute('aria-hidden','true');
    label.append(input,document.createTextNode(style.name),dot);box.append(label);
  }
  const hint=document.createElement('small');hint.textContent='1色選択。あなたの対戦ルールとして保存します。';box.append(hint);$('settingsList').before(box);
}
function buildRulePanel(){
  const box=document.createElement('section');box.id='activeRules';box.className='active-rules';
  const owner=document.createElement('strong');owner.id='ruleOwner';
  const headline=document.createElement('p');headline.id='ruleHeadline';
  const note=document.createElement('p');note.id='ruleNote';note.className='small muted';
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='すべての数値を見る';const list=document.createElement('dl');list.id='ruleNumbers';details.append(summary,list);box.append(owner,headline,note,details);$('hitReadout').after(box);renderRulePanel();
}
function renderRulePanel(){
  if(!$('activeRules'))return;
  const details=$('ruleNumbers').closest('details');
  if(!practice&&!snapshot?.match){
    if(renderedRule==='waiting')return;renderedRule='waiting';
    $('ruleOwner').textContent='あなたの設定でCPUと対戦';
    $('ruleHeadline').textContent='CPU対戦・CPU観戦は、このブラウザの設定を使います。';
    $('ruleNote').textContent='ネット対戦を設置するためのコードと説明書は、GitHubのself-hostにあります。';
    details.hidden=true;$('ruleNumbers').replaceChildren();return;
  }
  details.hidden=false;
  const personal={ownerName:snapshot?.me?.name||'あなた',settings,target:practiceKind==='watch'&&practice?watchTarget:winTarget};
  const rule=practice?personal:snapshot?.match?.rule||personal;
  const mode=practice?'練習・観戦':'対戦中';
  const key=JSON.stringify([mode,rule]);if(key===renderedRule)return;renderedRule=key;
  $('ruleOwner').textContent=`${mode} · ${rule.ownerName}さんのルール`;
  $('ruleHeadline').textContent=`${rule.target===0?'勝敗なし':rule.target+'本先取・2点差'} ／ ゴール幅 ${rule.settings.goalSize} ／ パドル ${rule.settings.paddleSize} ／ パック ${rule.settings.puckSize} ／ 初速 ${rule.settings.puckSpeed} ／ 最高速 ${rule.settings.maxSpeed} ／ パドル速度 ${rule.settings.paddleSpeed} ／ 反射 ${rule.settings.bounce} ／ 打ち返し ${rule.settings.hitPower} ／ 滑りやすさ ${rule.settings.glide}`;
  $('ruleNote').textContent=practice?'調整した数値は、あなたがルール提供者になる対人戦でも使用します。勝敗なしは対人戦では6本先取になります。':snapshot?.match?'試合開始時に確定したルールです。右の「あなたの設定」を変えても、この試合には反映しません。':'準備OKの2人のうち、順番が先の人の設定を採用します。自分の設定を変えると準備OKは解除されます。';
  const shortLabels={goalSize:'ゴール幅',puckSpeed:'初速',maxSpeed:'最高速',puckSize:'パックサイズ',paddleSize:'パドルサイズ',paddleSpeed:'パドル速度',bounce:'反射',hitPower:'打ち返し',glide:'滑りやすさ',smashFrames:'SMASH受付',driveFrames:'DRIVE終端',coolFrames:'COOL終端',coolBoost:'COOL加速',driveBoost:'DRIVE加速',smashBoost:'SMASH加速',cooldown:'再使用待ち',counterStep:'カウンター増分',counterMax:'カウンター上限'};
  const addValue=(label,value,fullLabel=label)=>{const cell=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');cell.title=fullLabel;dt.textContent=label;if(typeof value==='string'||typeof value==='number')dd.textContent=value;else dd.append(value);cell.append(dt,dd);$('ruleNumbers').append(cell);};
  $('ruleNumbers').replaceChildren();for(const [id,label]of SETTINGS)addValue(shortLabels[id]||label,rule.settings[id],label);
  const color=PUCK_STYLES.find(style=>style.id===rule.settings.puckColor)||PUCK_STYLES[0],colorValue=document.createElement('span'),dot=document.createElement('span');dot.className='puck-swatch';dot.style.backgroundColor=color.color;colorValue.append(document.createTextNode(color.name+' '),dot);addValue('パック色',colorValue);$('ruleHeadline').append(document.createTextNode(' ／ パック色 '+color.name));
}
$('winTarget').value=winTarget;buildSettings();buildAudioControls();buildWatchControls();buildPuckControls();buildRulePanel();refreshPresets();
const gameWindow=setupGameWindow({button:$('popupButton'),notify:toast,async suspend(){windowInactive=true;releaseMouse();paused=true;connected=false;source?.close();source=null;clearInterval(heartbeatTimer);soundBank.stop();await ruleSave.catch(()=>{});}});
if(await gameWindow.start())loadInfo();requestAnimationFrame(frame);
