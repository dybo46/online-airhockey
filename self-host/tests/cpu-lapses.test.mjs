import test from 'node:test';
import assert from 'node:assert/strict';
import {CPU_PROFILES,DEFAULTS} from '../public/config.js';
import {createGame,cpu,cpuTimingFrames,hitGrade} from '../public/physics.js';
test('all levels have brief committed lapses, recover, and cannot immediately repeat',()=>{
  for(let level=1;level<=10;level++){
    const g=createGame();g.status='playing';g.puck={x:700,y:280,vx:300,vy:0};
    cpu(g,level,1,()=>0);const ai=g.ai.controllers[1];
    assert.equal(ai.lapses,1);assert.equal(ai.lapsing,true);assert.equal(ai.movementLevel,Math.max(1,level-2));
    g.time=.3;cpu(g,level,1,()=>0);assert.equal(ai.lapsing,true);assert.equal(ai.lapses,1);
    g.time=1;cpu(g,level,1,()=>0);assert.equal(ai.lapsing,false);assert.equal(ai.movementLevel,level);assert.equal(ai.lapses,1);
    assert.ok(ai.lapseCheckAt>g.time);
  }
});
test('expert/master can also have rare movement lapses and lapses do not deliberately grant goals',()=>{
  for(const level of [9,10]){
    const g=createGame();g.status='playing';g.puck={x:700,y:280,vx:300,vy:0};cpu(g,level,1,()=>0);
    assert.equal(g.ai.controllers[1].lapses,1);assert.equal(g.ai.controllers[1].movementLevel,level-2);
    assert.deepEqual(g.score,[0,0]);
  }
});
test('middle defense is gentler while level seven independently aims frequent varied strong shots',()=>{
  for(const [level,oldReaction,oldSpeed,oldError]of [[5,.12,.61,55],[6,.0975,.705,40],[7,.075,.80,25]]){
    const p=CPU_PROFILES[level-1];assert.ok(p.reaction>oldReaction);assert.ok(p.speed<oldSpeed);assert.ok(p.error>oldError);
  }
  assert.ok(CPU_PROFILES[6].attempt>=.75);
  const grades=[.1,.4,.7].map(roll=>hitGrade(cpuTimingFrames(DEFAULTS,7,()=>roll),DEFAULTS));
  assert.deepEqual(grades,['SMASH','DRIVE','COOL']);
});
