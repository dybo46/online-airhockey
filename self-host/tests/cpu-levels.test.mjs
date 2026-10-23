import test from 'node:test';
import assert from 'node:assert/strict';
import {CPU_PROFILES,upgradeDifficulty,DEFAULTS} from '../public/config.js';
import {createGame,cpu,tick,DT,cpuTimingFrames,hitGrade} from '../public/physics.js';
function seeded(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
test('legacy presets migrate to intended levels and preserve numbering and beginner base profiles',()=>{
  assert.deepEqual([1,2,3,4,5].map(v=>upgradeDifficulty(v,'0.5')),[1,2,5,7,9]);
  assert.equal(upgradeDifficulty(3,'0.6'),3);
  for(const [level,expected]of [[1,[.24,150,.30,.40,6]],[2,[.18,95,.44,.46,5]]])assert.deepEqual(Object.values(CPU_PROFILES[level-1]),expected);
  for(let n=1;n<10;n++){
    assert.ok(CPU_PROFILES[n].reaction<CPU_PROFILES[n-1].reaction);
    assert.ok(CPU_PROFILES[n].speed>=CPU_PROFILES[n-1].speed);
  }
});
test('expert and master improve actual powered contacts while retaining all three grades',t=>{
  const results=[];
  for(const level of [5,9,10]){
    const random=seeded(421),counts={SMASH:0,DRIVE:0,COOL:0,normal:0,miss:0,attempt:0};
    for(let trial=0;trial<300;trial++){
      const g=createGame();g.status='playing';g.puck={x:530+random()*110,y:245+random()*70,vx:320+random()*280,vy:(random()-.5)*100};let last=0;
      for(let n=0;n<130&&g.status==='playing';n++){
        cpu(g,level,1,random);tick(g,DT);
        for(const e of g.events){if(e.id<=last)continue;last=e.id;if(e.side!==1)continue;if(e.type==='arm')counts.attempt++;if(e.type==='miss')counts.miss++;if(e.type==='hit')counts[e.grade||'normal']++;}
      }
    }
    results.push(counts);t.diagnostic(JSON.stringify({level,...counts}));
    for(const grade of ['SMASH','DRIVE','COOL'])assert.ok(counts[grade]>20);
  }
  const powered=c=>c.SMASH+c.DRIVE+c.COOL;
  assert.ok(powered(results[1])>powered(results[0])*1.5);
  assert.ok(powered(results[2])/results[2].attempt>.94);
  assert.ok(results[2].SMASH/powered(results[2])<.5);
  assert.ok(results[2].miss<results[0].miss);
});
test('master timing aims inside real timing windows without changing collision rules',()=>{
  const random=seeded(13),counts={SMASH:0,DRIVE:0,COOL:0};
  for(let i=0;i<1000;i++){const grade=hitGrade(cpuTimingFrames(DEFAULTS,10,random),DEFAULTS);assert.ok(grade);counts[grade]++;}
  for(const count of Object.values(counts))assert.ok(count>200);
});
