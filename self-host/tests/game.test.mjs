import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,addGoal,scoreLabel,arm,serve,tick,hitGrade,setTarget,dimensions,cpu,DT} from '../public/physics.js';
import {DEFAULTS,normalizeSettings,upgradeSettings} from '../public/config.js';
import {Lobby} from '../lobby.mjs';

test('6 and 11 point matches require two-point leads after deuce',()=>{
  for(const target of [6,11]){
    const g=createGame({},target);g.score=[target-1,target-1];g.status='playing';
    addGoal(g,0);assert.equal(g.status,'serve');assert.match(scoreLabel(g),/MATCH POINT/);
    g.status='playing';addGoal(g,1);assert.equal(scoreLabel(g),'DEUCE');
    g.status='playing';addGoal(g,0);g.status='playing';addGoal(g,0);
    assert.equal(g.status,'finished');assert.equal(g.winner,0);assert.deepEqual(g.score,[target+2,target]);
  }
});
test('only the conceding side can set; set click cannot also arm a shot',()=>{
  const g=createGame();assert.equal(serve(g,1),false);assert.equal(serve(g,0),true);
  arm(g,0);addGoal(g,0);assert.equal(g.serveSide,1);assert.equal(serve(g,0),false);
  assert.equal(serve(g,1),true);assert.ok(g.puck.x>500);assert.equal(g.paddles[1].armedAt,null);
});
test('a click consumes cooldown even on a miss, and holding/repeated calls never extend timing',()=>{
  const g=createGame();serve(g,0);assert.equal(arm(g,0),true);const first=g.paddles[0].armedAt;
  tick(g,.02);assert.equal(arm(g,0),false);assert.equal(g.paddles[0].armedAt,first);
  for(let i=0;i<150;i++)tick(g);assert.equal(arm(g,0),true);
});
test('three timing grades have exact boundaries and misses',()=>{
  assert.equal(hitGrade(2,DEFAULTS),'SMASH');assert.equal(hitGrade(2.5,DEFAULTS),'DRIVE');
  assert.equal(hitGrade(5,DEFAULTS),'DRIVE');assert.equal(hitGrade(5.5,DEFAULTS),'COOL');
  assert.equal(hitGrade(10,DEFAULTS),'COOL');assert.equal(hitGrade(10.5,DEFAULTS),null);
});
test('actual contact consumes one armed shot and applies smash acceleration',()=>{
  const normal=createGame(),strong=createGame();
  for(const g of [normal,strong]){serve(g,0);const p=g.paddles[0],r=dimensions(g.settings);g.puck={x:p.x+r.paddle+r.puck+1,y:p.y,vx:-300,vy:0};}
  arm(strong,0);tick(normal);tick(strong);
  assert.equal(strong.lastHit.grade,'SMASH');assert.equal(strong.paddles[0].armedAt,null);
  assert.ok(Math.hypot(strong.puck.vx,strong.puck.vy)>Math.hypot(normal.puck.vx,normal.puck.vy)*1.8);
});
test('paddles stay in their halves; maximum settings remain finite in sustained play',()=>{
  const g=createGame(Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,999])));serve(g,0);
  setTarget(g,0,9000,-9000);setTarget(g,1,-9000,9000);
  for(let n=0;n<5000;n++){cpu(g,5);tick(g);if(g.status==='serve')serve(g,g.serveSide);if(g.status==='finished')break;}
  assert.ok(g.paddles[0].x<500);assert.ok(g.paddles[1].x>500);
  for(const value of Object.values(g.puck))assert.ok(Number.isFinite(value));
  assert.ok(Math.hypot(g.puck.vx,g.puck.vy)<=dimensions(g.settings).max+.01);
});
test('settings coerce and clamp bad values, and preserve timing order',()=>{
  const s=normalizeSettings({goalSize:999,puckSpeed:'bad',smashFrames:10,driveFrames:2,coolFrames:3});
  assert.equal(s.goalSize,20);assert.equal(s.puckSpeed,DEFAULTS.puckSpeed);assert.ok(s.smashFrames<s.driveFrames&&s.driveFrames<s.coolFrames);
});
test('v0.3 shifts old values by ten without changing the original size increments',()=>{
  const small=dimensions({...DEFAULTS,paddleSize:1,puckSize:1}),large=dimensions({...DEFAULTS,paddleSize:20,puckSize:20});
  assert.equal(small.puck,7+11*1.05);assert.equal(small.paddle,16+11*1.5);
  assert.equal(large.puck,7+30*1.05);assert.equal(large.paddle,16+30*1.5);
  for(let value=1;value<20;value++){const a=dimensions({...DEFAULTS,paddleSize:value,puckSize:value}),b=dimensions({...DEFAULTS,paddleSize:value+1,puckSize:value+1});assert.ok(Math.abs(b.puck-a.puck-1.05)<1e-10);assert.ok(Math.abs(b.paddle-a.paddle-1.5)<1e-10);}
  assert.ok(large.puck>7+20*1.05);assert.ok(large.paddle>16+20*1.5);
  assert.ok(large.paddle<250);assert.ok(large.puck<280);
  const migrated=upgradeSettings({...DEFAULTS,paddleSize:10,puckSize:10},'0.1');
  assert.equal(migrated.paddleSize,1);assert.equal(migrated.puckSize,1);
  assert.equal(upgradeSettings({...DEFAULTS,paddleSize:20,puckSize:20},'0.1').paddleSize,10);
  assert.equal(upgradeSettings({...DEFAULTS,paddleSize:20,puckSize:20},'0.1').puckSize,10);
  assert.equal(upgradeSettings({...DEFAULTS,paddleSize:6,puckSize:7},'0.2').paddleSize,20);
  assert.equal(upgradeSettings({...DEFAULTS,paddleSize:6,puckSize:7},'0.2').puckSize,20);
  for(const side of [0,1]){const g=createGame({...DEFAULTS,paddleSize:20,puckSize:20});g.serveSide=side;serve(g,side);
    assert.ok(Math.hypot(g.puck.x-g.paddles[side].x,g.puck.y-g.paddles[side].y)>large.puck+large.paddle);
  }
});
test('endless practice never ends and goals must fully cross the mouth',()=>{
  const g=createGame();g.endless=true;g.score=[90,0];serve(g,0);addGoal(g,0);assert.equal(g.status,'serve');
  serve(g,1);g.puck={x:995,y:280,vx:600,vy:0};tick(g,.05);assert.equal(g.score[0],92);
});
test('exactly five participants, default names unique, custom duplicates and long names rejected',()=>{
  const l=new Lobby();for(let i=0;i<5;i++)l.join('',true);
  assert.equal(new Set([...l.players.values()].map(p=>p.name)).size,5);
  assert.equal([...l.players.values()][0].name,'名無しさん１');assert.throws(()=>l.join('',true),/満杯/);
  const custom=new Lobby();custom.join('あお');assert.throws(()=>custom.join('あお'),/使用中/);assert.throws(()=>custom.join('１２３４５６７'),/6文字/);
});
test('winner retains priority but both players must explicitly ready again',()=>{
  const l=new Lobby(),a=l.join('A'),b=l.join('B'),c=l.join('C');l.ready(a.id,true);l.ready(b.id,true);
  assert.deepEqual(l.match.ids,[a.id,b.id]);l.finish(0);
  assert.equal(l.queue[0],a.id);assert.equal(a.ready,false);assert.equal(b.ready,false);
  l.ready(c.id,true);assert.equal(l.match,null);l.ready(a.id,true);assert.deepEqual(l.match.ids,[a.id,c.id]);
});
test('two other ready players start; unready retained winner moves to the end',()=>{
  const l=new Lobby(),a=l.join('A'),b=l.join('B'),c=l.join('C'),d=l.join('D');
  l.ready(a.id,true);l.ready(b.id,true);l.finish(0);
  l.ready(c.id,true);l.ready(d.id,true);assert.deepEqual(l.match.ids,[c.id,d.id]);assert.equal(l.queue.at(-1),a.id);assert.equal(a.retained,false);
});
test('CPU practice releases ready state and keeps queue position; leaving a match forfeits',()=>{
  const l=new Lobby(),a=l.join('A'),b=l.join('B'),c=l.join('C');l.ready(a.id,true);l.mode(a.id,'practice');l.ready(b.id,true);
  assert.equal(l.match,null);assert.equal(a.ready,false);assert.equal(l.queue[0],a.id);
  l.ready(c.id,true);l.leave(b.id);assert.equal(l.match,null);assert.equal(l.lastResult.winner,'C');assert.equal(l.players.size,2);
});
