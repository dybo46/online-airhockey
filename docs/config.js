export const VERSION = '1.4';
export function normalizeTarget(value){return Number(value)===0?0:[10,11].includes(Number(value))?11:6;}
export const PUCK_STYLES=[
  {id:'black',name:'黒',color:'#122331',highlight:'#334a5f',edge:'#f6fff5'},
  {id:'white',name:'白',color:'#f4f5f5',highlight:'#ffffff',edge:'#273a49'},
  {id:'red',name:'赤',color:'#e52b35',highlight:'#ff6570',edge:'#fff1e8'},
  {id:'blue',name:'青',color:'#1674d9',highlight:'#57b0ff',edge:'#edf8ff'},
];
export function normalizePuckColor(value){return PUCK_STYLES.some(style=>style.id===value)?value:'black';}
// Lv.5–7 ease defense; shot timing remains a separate skill.
export const CPU_PROFILES = [
  [.24,150,.30,.40,6], [.18,95,.44,.46,5],
  [.16,82,.50,.48,4.7], [.14,68,.55,.50,4.3],
  [.135,72,.57,.52,4], [.12,58,.63,.555,3.7],
  [.10,43,.70,.76,1.8], [.06,16.5,.90,.82,1.6],
  [.045,8,1,.90,1.2], [.025,3,1,1,.35],
].map(([reaction,error,speed,attempt,jitter])=>({reaction,error,speed,attempt,jitter}));
export function upgradeDifficulty(value,version=VERSION){
  const level=Math.round(Number(value)||3);
  return /^0\.[1-5]$/.test(version)?[1,2,5,7,9][Math.max(1,Math.min(5,level))-1]:Math.max(1,Math.min(10,level));
}
export const SETTINGS = [
  ['goalSize','ゴールの幅',1,20,13,'相手・自分の両方に適用'],
  ['puckSpeed','パックの初速',1,20,7,'セット直後の速さ'],
  ['maxSpeed','パックの最高速度',1,20,12,'通常・初回強打の上限。カウンターは別設定'],
  ['puckSize','パックの大きさ',1,20,6,'旧値−10で表示・増分はv0.1と同じ'],
  ['paddleSize','パドルの大きさ',1,20,8,'旧値−10で表示・両プレイヤー共通'],
  ['paddleSpeed','パドルの最高速度',1,20,12,'瞬間移動を防ぐ移動制限'],
  ['bounce','壁の跳ね返り',1,20,10,'10が等速の反射'],
  ['hitPower','打ち返す強さ',1,20,10,'通常打撃の強さ'],
  ['glide','滑りやすさ',1,20,16,'高いほど減速しにくい'],
  ['smashFrames','SMASH受付',1,10,2,'60fps基準・フレーム'],
  ['driveFrames','DRIVE受付の終端',2,20,5,'SMASHの終端より後に調整'],
  ['coolFrames','COOL受付の終端',3,30,10,'DRIVEの終端より後に調整'],
  ['coolBoost','COOL加速',10,30,12,'10で1.0倍・12で1.2倍'],
  ['driveBoost','DRIVE加速',10,40,15,'10で1.0倍・15で1.5倍'],
  ['smashBoost','SMASH加速',10,50,20,'10で1.0倍・20で2.0倍'],
  ['cooldown','強打の再使用待ち',3,40,12,'10で1秒・空振りでも消費'],
  ['counterStep','強打カウンターの加速上限増分',1,10,5,'5で連続するたび最高速度の上限＋50%'],
  ['counterMax','カウンターの最高速度上限',10,50,30,'30で通常の最高速度の3倍まで'],
];
export const DEFAULTS = {...Object.fromEntries(SETTINGS.map(([key,,,,value]) => [key,value])),puckColor:'black'};
export function normalizeSettings(input = {}) {
  const out = {};
  for (const [key,,min,max,value] of SETTINGS) out[key] = Number.isFinite(Number(input[key])) ? Math.max(min, Math.min(max,Math.round(Number(input[key])))) : value;
  out.driveFrames = Math.max(out.smashFrames+1,out.driveFrames);
  out.coolFrames = Math.max(out.driveFrames+1,out.coolFrames);
  out.puckColor = normalizePuckColor(input.puckColor);
  return out;
}
export function upgradeSettings(input={},version=VERSION){
  if(version!=='0.1'&&version!=='0.2')return normalizeSettings(input);
  const old=normalizeSettings(input);
  if(version==='0.1')return normalizeSettings({...old,puckSize:old.puckSize-10,paddleSize:old.paddleSize-10});
  return normalizeSettings({...old,
    puckSize:Math.round((17.5+(old.puckSize-1)*3.5-7)/1.05-10),
    paddleSize:Math.round((31+(old.paddleSize-1)*6-16)/1.5-10)});
}
