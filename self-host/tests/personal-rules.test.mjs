import test from 'node:test';
import assert from 'node:assert/strict';
import {Lobby} from '../lobby.mjs';
test('earlier ready player supplies rules; waiting snapshots do not reveal personal rules',()=>{
  const l=new Lobby(),a=l.join('先'),b=l.join('後');
  l.setRule(a.id,{goalSize:7,paddleSize:12},11);l.setRule(b.id,{goalSize:19},6);
  const waiting=l.snapshot(b.id);assert.equal(waiting.nextRule,undefined);assert.equal(waiting.players[0].rule,undefined);
  l.ready(b.id,true);l.ready(a.id,true);
  assert.equal(l.match.rule.ownerName,'先');assert.equal(l.match.game.settings.goalSize,7);assert.equal(l.match.game.target,11);
  assert.equal(l.snapshot(b.id).match.rule.ownerName,'先');
  l.setRule(a.id,{goalSize:16},6);assert.equal(l.match.game.settings.goalSize,7);assert.equal(l.match.rule.settings.goalSize,7);
  assert.equal(l.match.game.target,11);
});
test('winner supplies next rules, while two other ready players use their own queue order',()=>{
  const l=new Lobby(),a=l.join('甲'),b=l.join('乙'),c=l.join('丙'),d=l.join('丁');
  for(const [p,size]of [[a,7],[b,8],[c,9],[d,10]])l.setRule(p.id,{goalSize:size},6);
  l.ready(a.id,true);l.ready(b.id,true);l.finish(1);
  l.ready(c.id,true);l.ready(b.id,true);assert.equal(l.match.rule.ownerName,'乙');assert.equal(l.match.game.settings.goalSize,8);
  l.finish(0);l.ready(a.id,true);l.ready(d.id,true);
  assert.equal(l.match.rule.ownerName,'丁');assert.equal(l.match.game.settings.goalSize,10);
});
test('editing your rule clears your readiness and clamps settings without editing anyone else',()=>{
  const l=new Lobby(),a=l.join('甲'),b=l.join('乙');l.ready(a.id,true);
  l.setRule(a.id,{goalSize:999,paddleSize:-1},0);assert.equal(a.ready,false);assert.equal(a.rule.settings.goalSize,20);assert.equal(a.rule.settings.paddleSize,1);assert.equal(a.rule.target,6);assert.equal(b.rule.settings.goalSize,13);
  assert.throws(()=>l.setRule(a.id,null,11),/形式/);
});
