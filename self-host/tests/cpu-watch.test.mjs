import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,cpu,tick,DT,serve,arm,dimensions,speedLimit} from '../public/physics.js';
function seeded(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('CPU versus CPU finishes naturally on equal and unequal difficulty without a forced winner',t=>{
  for(const [left,right]of [[1,1],[3,3],[5,5],[1,5],[5,1],[9,9],[9,10],[10,10],[1,10]]){
    const g=createGame(),random=seeded(331+left*10+right);let arms=0,misses=0,last=0;
    while(g.time<360&&g.status!=='finished'){
      cpu(g,left,0,random);cpu(g,right,1,random);tick(g,DT);
      for(const e of g.events){if(e.id<=last)continue;last=e.id;if(e.type==='arm')arms++;if(e.type==='miss')misses++;}
    }
    t.diagnostic(JSON.stringify({left,right,time:g.time.toFixed(1),score:g.score,arms,misses}));
    assert.equal(g.status,'finished');assert.ok(Math.abs(g.score[0]-g.score[1])>=2);assert.ok(arms>0);if(left<9||right<9)assert.ok(misses>0);
  }
});
test('powered counters multiply existing speed and raise a finite speed ceiling; normal hits reset it',()=>{
  const g=createGame();serve(g,0);const d=dimensions(g.settings);
  for(let n=0;n<6;n++){
    const side=n%2,p=g.paddles[side],direction=side?1:-1;
    g.puck={x:p.x-direction*(d.paddle+d.puck+1),y:p.y,vx:direction*(n?Math.min(1800,speedLimit(g)):600),vy:0};
    g.time=Math.max(g.time,p.nextArm);arm(g,side);tick(g);
    assert.equal(g.lastHit.grade,'SMASH');assert.equal(g.powerChain,n+1);
    assert.ok(Math.hypot(g.puck.vx,g.puck.vy)<=speedLimit(g)+1e-6);
  }
  assert.ok(speedLimit(g)>d.max*2);assert.ok(speedLimit(g)<=d.max*3);
  const p=g.paddles[0];g.puck={x:p.x+d.paddle+d.puck+1,y:p.y,vx:-700,vy:0};tick(g);assert.equal(g.powerChain,0);assert.equal(speedLimit(g),d.max);
});
