import test from 'node:test';
import assert from 'node:assert/strict';
import {BiasedStylePicker,BiasedShotEffects,ALL_SHOT_STYLES} from '../public/effect-selection.js';
import {ShotEffects,SHOT_STYLES,LASER_STYLES} from '../public/effects.js';
import {EXTRA_LASER_STYLES} from '../public/laser-variants.js';
function seeded(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('ordinary hits form biased streaks while still reaching every ordinary style',()=>{
  const picker=new BiasedStylePicker(seeded(491)),seen=new Set();let previous=-1,repeats=0,run=0,longest=0;
  for(let n=0;n<10000;n++){
    const index=picker.pick(null);seen.add(index);assert.ok(![...LASER_STYLES,...EXTRA_LASER_STYLES].includes(ALL_SHOT_STYLES[index]));
    if(index===previous){repeats++;run++;}else run=1;longest=Math.max(longest,run);previous=index;
  }
  assert.equal(seen.size,12);assert.ok(repeats>3000&&repeats<8000,`repeats ${repeats}`);assert.ok(longest>=5);
});
test('every successful grade changes the preceding effect, including after ordinary streaks and resets',()=>{
  const fx=new BiasedShotEffects(seeded(83)),seen=new Set();let previous=-1;
  for(let n=0;n<3000;n++){
    const grade=[null,null,'COOL','DRIVE','SMASH'][n%5];
    if(n%37===0)fx.reset();fx.trigger(40,50,grade,n*100);
    if(grade)assert.notEqual(fx.shot.index,previous);seen.add(fx.shot.kind);previous=fx.shot.index;
  }
  assert.equal(seen.size,21);
});
test('the selection adapter delegates drawing and effect appearance to the unchanged v0.7 renderer',()=>{
  const fx=new BiasedShotEffects(seeded(5));
  for(const [grade,power]of [[null,1],['COOL',1.15],['DRIVE',1.4],['SMASH',1.7]]){
    fx.trigger(15,25,grade,500);assert.equal(fx.shot.power,power);assert.equal(fx.shot.x,15);assert.equal(fx.shot.y,25);assert.equal(fx.shot.at,500);assert.equal(fx.shot.colors.length,2);assert.equal(fx.shot.kind,ALL_SHOT_STYLES[fx.shot.index]);
  }
  const original=ShotEffects.prototype.draw;let calls=0;
  ShotEffects.prototype.draw=function(...args){calls++;return original.apply(this,args);};
  try{for(let i=0;i<13;i++){fx.shot.index=i;fx.shot.kind=SHOT_STYLES[i];fx.points=[];fx.draw({}, {x:30,y:40},12,600);}assert.equal(calls,13);}finally{ShotEffects.prototype.draw=original;}
});
