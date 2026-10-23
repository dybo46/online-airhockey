const ROOT='/assets/audio/';
export const SOUND_LIBRARY=[
  ['impactWood_light_000.ogg','軽い打撃 A'],['impactWood_light_001.ogg','軽い打撃 B'],['impactWood_light_002.ogg','軽い打撃 C'],
  ['impactMetal_light_000.ogg','金属の反射 A'],['impactMetal_light_001.ogg','金属の反射 B'],
  ['laser1.ogg','レーザー A'],['laser2.ogg','レーザー B'],['powerUp1.ogg','パワーアップ A'],['powerUp2.ogg','パワーアップ B'],
  ['jingles_HIT00.ogg','ゴールジングル A'],['jingles_HIT01.ogg','ゴールジングル B'],['jingles_NES02.ogg','8ビット勝利 A'],
  ['impactMetal_light_002.ogg','金属の反射 C'],['impactMetal_light_003.ogg','金属の反射 D'],
  ['impactWood_medium_000.ogg','中くらいの打撃 A'],['impactWood_medium_001.ogg','中くらいの打撃 B'],['impactWood_heavy_000.ogg','重い打撃'],['impactPlate_light_000.ogg','プレート打撃'],
  ['laser3.ogg','レーザー C'],['laser4.ogg','レーザー D'],['laser5.ogg','レーザー E'],['laser6.ogg','レーザー F'],
  ['powerUp3.ogg','パワーアップ C'],['powerUp4.ogg','パワーアップ D'],['highUp.ogg','電子音アップ'],['highDown.ogg','電子音ダウン'],
  ['jingles_HIT02.ogg','ゴールジングル C'],['jingles_NES03.ogg','8ビット勝利 B'],
  ...Array.from({length:8},(_,i)=>['air-hit-'+String(i+1).padStart(2,'0')+'.wav','実録エアホッケー '+String.fromCharCode(65+i)]),
  ['soundbible-puck.wav','SoundBible・氷上ホッケー打撃 A'],['soundbible-stick.wav','SoundBible・氷上ホッケー打撃 B'],
  ['budgetpixel-air-01.wav','BudgetPixel・エアホッケー風（合成）A'],['budgetpixel-air-02.wav','BudgetPixel・エアホッケー風（合成）B'],
  ...Array.from({length:4},(_,i)=>['air-dry-'+String(i+1).padStart(2,'0')+'.wav','実録エアホッケー・原音寄り '+String.fromCharCode(65+i)]),
  ['goal-clunk-a.wav','ゴールのカコン A（エアホッケー風合成）'],['goal-clunk-b.wav','ゴールのカコン B・低め（合成）']
].map(([file,name],i)=>({id:'S'+String(i+1).padStart(2,'0'),file,name}));
export const SOUND_EVENTS={hit:'通常の打撃',wall:'壁の反射',charge:'強打ボタン・発動音',laserHit:'強打命中・レーザー重ね音',COOL:'COOL!の打撃',DRIVE:'DRIVE!の打撃',SMASH:'SMASH!の打撃',goal:'ゴール',win:'勝利',serve:'セット'};
export function validateSoundChoices(input={}){
  return Object.fromEntries(Object.keys(SOUND_EVENTS).map(type=>[type,input?.[type]==='mute'||SOUND_LIBRARY.some(s=>s.id===input?.[type])?input[type]:'']));
}
export const SOUND_FILES={
  hit:['air-dry-01.wav','air-dry-02.wav','air-dry-03.wav','air-dry-04.wav'],
  wall:['air-dry-01.wav','air-dry-02.wav'],
  charge:['laser1.ogg','laser2.ogg','laser3.ogg'],laserHit:['laser4.ogg','laser5.ogg','laser6.ogg'],
  COOL:['air-dry-01.wav','air-dry-03.wav'],DRIVE:['air-dry-02.wav','air-dry-04.wav'],SMASH:['air-dry-03.wav','air-dry-04.wav'],
  goal:['goal-clunk-a.wav','goal-clunk-b.wav'],win:['jingles_NES02.ogg'],serve:['air-hit-05.wav']
};
export class SoundBank {
  constructor(){this.buffers=new Map();this.loading=null;this.voices=new Set();this.last={};this.volume=.5;this.context=null;this.choices={};}
  load(context){
    this.context=context;
    return this.loading??=Promise.allSettled(SOUND_LIBRARY.map(({file:name})=>{
      return (async()=>{
      const response=await fetch(ROOT+name);if(!response.ok)throw Error(name);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);
      })();
    }));
  }
  stop(){for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();}
  play(type='hit'){
    const context=this.context,selected=this.choices[type];
    if(this.volume<=0||selected==='mute')return true;
    const choice=SOUND_LIBRARY.find(s=>s.id===selected),files=choice?[choice.file]:SOUND_FILES[type]||SOUND_FILES.hit;if(!context)return false;
    if(context.currentTime-(this.last[type]??-100)<(type==='wall'?.09:.035))return true;
    const available=files.filter(name=>this.buffers.has(name));if(!available.length)return false;
    this.last[type]=context.currentTime;if(this.voices.size>=12)return true;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=this.buffers.get(available[Math.floor(Math.random()*available.length)]);
    source.playbackRate.value=1;
    gain.gain.value=this.volume*({wall:.22,hit:.7,COOL:.75,DRIVE:.85,SMASH:.95,charge:.23,laserHit:.3,serve:.2,goal:.6,win:.6}[type]??.5);
    source.connect(gain).connect(context.destination);this.voices.add(source);source.onended=()=>{this.voices.delete(source);gain.disconnect();};source.start(context.currentTime+(type==='win'?.35:0));return true;
  }
}
