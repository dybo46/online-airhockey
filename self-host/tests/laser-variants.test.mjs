import test from 'node:test';
import assert from 'node:assert/strict';
import {BiasedShotEffects} from '../public/effect-selection.js';
import {LASER_VARIANTS} from '../public/laser-variants.js';
test('five straight laser variants render finite straight paths without changing puck state and expire',()=>{
  assert.equal(LASER_VARIANTS.length,5);
  for(let index=16;index<21;index++){
    const fx=new BiasedShotEffects(()=>.2);fx.picker.pick=()=>index;assert.ok(fx.trigger(100,200,'DRIVE',0));let calls=0;
    const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{if(['moveTo','lineTo'].includes(key)){assert.ok(Number.isFinite(args[0])&&Number.isFinite(args[1]));assert.ok(Math.abs(args[1]-200)<10);calls++;}},set:()=>true});
    for(let n=0;n<100;n++){const puck={x:100+n*4,y:200};fx.draw(ctx,puck,15,n*12);assert.deepEqual(puck,{x:100+n*4,y:200});}
    assert.ok(calls>10);assert.ok(fx.points.length<=90);const before=calls;fx.draw(ctx,{x:500,y:200},15,5000);assert.equal(calls,before);fx.draw(ctx,{x:500,y:200},15,5010,false);assert.equal(fx.shot,null);
  }
});
