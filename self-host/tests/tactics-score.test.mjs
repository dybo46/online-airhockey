import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTarget} from '../public/config.js';
import {createGame,addGoal,scoreState,cpu,tick,DT} from '../public/physics.js';
test('deuce display increases on equalizers and underlines the A side only',()=>{
  for(const target of [6,11]){
    const g=createGame({},target),n=target-1;g.status='playing';g.score=[n,n];
    assert.deepEqual(scoreState(g).labels,[String(n),String(n)]);
    addGoal(g,0);assert.deepEqual(scoreState(g).labels,[n+'A',String(n)]);assert.equal(scoreState(g).side,0);
    g.status='playing';addGoal(g,1);assert.deepEqual(scoreState(g).labels,[String(n+1),String(n+1)]);assert.equal(g.events.at(-1).kind,'deuce');
    g.status='playing';addGoal(g,1);assert.deepEqual(scoreState(g).labels,[String(n+1),(n+1)+'A']);assert.equal(g.events.at(-1).kind,'matchPoint');
    g.status='playing';addGoal(g,1);assert.equal(g.status,'finished');assert.equal(g.winner,1);assert.equal(scoreState(g).kind,null);
  }
  assert.equal(normalizeTarget(5),6);assert.equal(normalizeTarget(10),11);assert.equal(normalizeTarget(0),0);
});
test('tactical choices have bounded durations and use real positional steering',()=>{
  const g=createGame();g.status='playing';g.puck={x:700,y:250,vx:300,vy:50};
  for(const [roll,expected]of [[0,'goal'],[.3,'middle'],[.6,'diagonal'],[.99,'press']]){
    g.ai.controllers={};const values=[.99,roll,.5,.2];let n=0;cpu(g,7,1,()=>values[n++]??.5);
    const ai=g.ai.controllers[1];assert.equal(ai.tactic,expected==='middle'?'diagonal':expected);assert.ok(ai.tacticUntil<=5.5);
    assert.deepEqual(g.puck,{x:700,y:250,vx:300,vy:50});
    assert.ok(g.paddles[1].tx>=500);assert.ok(g.paddles[1].tx<=1000);
    assert.ok(ai.tacticUntil>g.time);
  }
});
test('adjacent CPU levels can produce an underdog win without forced scoring',()=>{
  let wins=0,finished=0;
  for(let seed=1;seed<=6;seed++){
    let state=735+5*111+seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
    const g=createGame();while(g.time<900&&g.status!=='finished'){cpu(g,5,0,random);cpu(g,6,1,random);tick(g,DT);}
    assert.equal(g.status,'finished');finished++;if(g.winner===0)wins++;
  }
  assert.ok(wins>0&&wins<finished,`lower wins ${wins}/${finished}`);
});
