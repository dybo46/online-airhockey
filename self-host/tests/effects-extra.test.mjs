import test from 'node:test';
import assert from 'node:assert/strict';
import {BiasedShotEffects} from '../public/effect-selection.js';
test('all three false trails stay behind a moving puck and never change it',()=>{
  for(const index of [13,14,15]){
    const fx=new BiasedShotEffects(()=>.2);fx.picker.pick=()=>index;fx.trigger(100,200,null,0);
    let currentX=0,calls=0;
    const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{if(['moveTo','lineTo','ellipse'].includes(key)){calls++;assert.ok(Number.isFinite(args[0])&&Number.isFinite(args[1]));assert.ok(args[0]<=currentX-12+1e-7);}},set:()=>true});
    for(let n=0;n<100;n++){const puck={x:100+n*4,y:200};currentX=puck.x;fx.draw(ctx,puck,15,n*12);assert.deepEqual(puck,{x:100+n*4,y:200});}
    assert.ok(calls>10);assert.ok(fx.points.length<=90);
    const before=calls;fx.draw(ctx,{x:500,y:200},15,5000);assert.equal(calls,before);
    fx.draw(ctx,{x:500,y:200},15,5010,false);assert.equal(fx.shot,null);assert.equal(fx.points.length,0);
  }
});
