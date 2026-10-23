import test from 'node:test';
import assert from 'node:assert/strict';
import {RainbowSmash} from '../public/rainbow-smash.js';
test('rainbow requires an actual SMASH and uses independent ten-percent/half thresholds',()=>{
  const values=[.099,.49,.1,.05,.5];let i=0;const state=new RainbowSmash(()=>values[i++]);
  state.hit('SMASH');assert.equal(state.active,true);assert.equal(state.laser,true);
  state.hit('SMASH');assert.equal(state.active,false);
  state.hit('SMASH');assert.equal(state.active,true);assert.equal(state.laser,false);
  state.hit('COOL');assert.equal(state.active,false);assert.equal(i,5);
});
test('rainbow lasts beyond normal trail timeout and clears at the next paddle hit or reset',()=>{
  const state=new RainbowSmash(()=>0);state.hit('SMASH');const puck={x:150,y:200},ctx=new Proxy({}, {get:(_,key)=>key==='createConicGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
  state.drawPuck(ctx,puck,15,12000);state.drawTrail(ctx,puck,15,12000);assert.equal(state.active,true);assert.deepEqual(puck,{x:150,y:200});
  state.hit(null);assert.equal(state.active,false);assert.equal(state.laser,false);state.hit('SMASH');state.clear();assert.equal(state.active,false);
});
test('seeded repeated successful smashes approximate ten percent with half receiving a laser',()=>{
  let seed=41;const state=new RainbowSmash(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));let rainbows=0,lasers=0;
  for(let i=0;i<20000;i++){state.hit('SMASH');rainbows+=Number(state.active);lasers+=Number(state.laser);}
  assert.ok(rainbows>1800&&rainbows<2200);assert.ok(lasers/rainbows>.45&&lasers/rainbows<.55);
});
