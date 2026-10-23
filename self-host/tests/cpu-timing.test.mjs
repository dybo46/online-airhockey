import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,cpu,cpuTimingFrames,hitGrade,tick,arm,DT} from '../public/physics.js';
import {DEFAULTS} from '../public/config.js';
function seeded(seed=5){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('even level five aims for mixed timing windows and deliberately includes early/late mistakes',()=>{
  for(const level of [1,3,5]){const random=seeded(level),counts={SMASH:0,DRIVE:0,COOL:0,miss:0};
    for(let n=0;n<1000;n++){const f=cpuTimingFrames(DEFAULTS,level,random);counts[hitGrade(f,DEFAULTS)||'miss']++;}
    for(const value of Object.values(counts))assert.ok(value>50);assert.ok(counts.SMASH<350);assert.ok(counts.miss>150);
  }
});
test('accepted button presses create activation events and misses; cooldown cannot be bypassed',()=>{
  const g=createGame();g.status='playing';g.puck={x:500,y:100,vx:100,vy:0};
  assert.equal(arm(g,1),true);assert.equal(arm(g,1),false);for(let n=0;n<30;n++)tick(g);
  assert.equal(g.events.filter(e=>e.type==='arm').length,1);assert.equal(g.events.filter(e=>e.type==='miss').length,1);
});
test('CPU actually attempts powered shots, with successful grades and misses in physical play',t=>{
  const counts={SMASH:0,DRIVE:0,COOL:0,normal:0,miss:0,attempt:0};const random=seeded(421);
  for(let trial=0;trial<300;trial++){
    const g=createGame();g.status='playing';g.puck={x:530+random()*110,y:245+random()*70,vx:320+random()*280,vy:(random()-.5)*100};
    let eventId=0;
    for(let n=0;n<130&&g.status==='playing';n++){
      cpu(g,5,1,random);tick(g,DT);
      for(const e of g.events){if(e.id<=eventId)continue;eventId=e.id;if(e.side!==1)continue;if(e.type==='arm')counts.attempt++;if(e.type==='miss')counts.miss++;if(e.type==='hit')counts[e.grade||'normal']++;}
    }
  }
  t.diagnostic(JSON.stringify(counts));assert.ok(counts.attempt>100);assert.ok(counts.miss>10);assert.ok(counts.normal>40);
  for(const grade of ['SMASH','DRIVE','COOL'])assert.ok(counts[grade]>5,grade+' should occur naturally');
});
