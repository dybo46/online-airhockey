import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,dimensions,cpu,tick,serve,DT} from '../public/physics.js';

test('CPU opens space at both corners on every difficulty, even with fast confined ricochets',()=>{
  for(const level of [1,2,3,4,5,6,7,8,9,10])for(const bottom of [false,true]){
    const g=createGame(),d=dimensions(g.settings),p=g.paddles[1];
    g.status='playing';Object.assign(p,{x:WALL_X(d),y:bottom?560-d.paddle:d.paddle,tx:WALL_X(d),ty:bottom?560-d.paddle:d.paddle});
    const start={x:p.x,y:p.y};let clearing=false,moved=0;
    for(let n=0;n<260;n++){
      // Reproduce a confined wall pocket without relying on low-speed idle resets.
      Object.assign(g.puck,{x:975,y:bottom?535:25,vx:280,vy:bottom?80:-80});
      cpu(g,level,1,()=>.5);tick(g,DT);
      clearing ||= g.ai.controllers?.[1]?.phase==='clear';
      moved=Math.max(moved,Math.hypot(p.x-start.x,p.y-start.y));
      assert.ok(p.x>=500+d.paddle-1e-6&&p.x<=1000-d.paddle+1e-6);
      assert.ok(p.y>=d.paddle-1e-6&&p.y<=560-d.paddle+1e-6);
    }
    assert.ok(clearing,`level ${level}, ${bottom?'bottom':'top'} detects pocket`);
    assert.ok(moved>80,`level ${level} actually moves away (${moved})`);
    assert.equal(g.status,'playing');
  }
});
function WALL_X(d){return 1000-d.paddle;}

test('actual puck simulation leaves the top and bottom corner pockets without resetting the puck',()=>{
  for(const bottom of [false,true]){
    const g=createGame(),d=dimensions(g.settings),p=g.paddles[1];g.status='playing';
    Object.assign(p,{x:WALL_X(d),y:bottom?560-d.paddle:d.paddle,tx:WALL_X(d),ty:bottom?560-d.paddle:d.paddle});
    g.puck={x:975,y:bottom?535:25,vx:280,vy:bottom?80:-80};let escaped=false;
    for(let n=0;n<330;n++){
      cpu(g,3,1,()=>.5);tick(g);
      if(g.status==='playing'&&(g.puck.x<820||(bottom?g.puck.y<390:g.puck.y>170))){escaped=true;break;}
      if(g.status!=='playing')break;
    }
    assert.ok(escaped,`${bottom?'bottom':'top'} pocket should release during normal physics`);
    assert.equal(g.events.some(e=>e.type==='stuck'),false);
  }
});

test('escape commits to its route and does not alternate back into the corner each decision',()=>{
  const g=createGame();g.status='playing';const d=dimensions(g.settings),p=g.paddles[1];
  Object.assign(p,{x:WALL_X(d),y:d.paddle,tx:WALL_X(d),ty:d.paddle});
  let first=null,last=null;
  for(let n=0;n<250;n++){
    Object.assign(g.puck,{x:975,y:25,vx:280,vy:-80});cpu(g,5,1,()=>.5);tick(g);
    const ai=g.ai.controllers[1];
    if(ai.phase==='clear'){first??={time:g.time,x:ai.clearX,y:ai.clearY};last=g.time;assert.equal(ai.clearX,first.x);assert.equal(ai.clearY,first.y);}
    if(first&&ai.phase==='flank')break;
  }
  assert.ok(first);assert.ok(last-first.time>.5);
});

test('CPU holding a defensive position does not wander when the puck is in the other half',()=>{
  const g=createGame();g.status='playing';g.puck={x:200,y:280,vx:0,vy:0};
  for(let n=0;n<280;n++){cpu(g,3,1,()=>.5);tick(g);}
  assert.equal(g.ai.controllers[1].escapes,0);assert.ok(Math.abs(g.paddles[1].x-800)<1);
});

test('escape respects maximum-size limits, mirrored halves, and resets on a new serve',()=>{
  for(const side of [0,1]){
    const g=createGame({paddleSize:20,puckSize:20});g.status='playing';const d=dimensions(g.settings),p=g.paddles[side];
    Object.assign(p,{x:side?1000-d.paddle:d.paddle,y:d.paddle,tx:side?1000-d.paddle:d.paddle,ty:d.paddle});
    for(let n=0;n<220;n++){g.puck={x:side?960:40,y:40,vx:side?300:-300,vy:-70};cpu(g,3,side,()=>.5);tick(g);}
    assert.ok(g.ai.controllers[side].escapes>0);
    assert.ok(p.x>= (side?500+d.paddle:d.paddle)-1e-6&&p.x<=(side?1000-d.paddle:500-d.paddle)+1e-6);
    g.status='serve';g.serveSide=side;serve(g,side);assert.deepEqual(g.ai.controllers,{});
  }
});
