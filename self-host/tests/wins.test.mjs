import test from 'node:test';
import assert from 'node:assert/strict';
import {Lobby} from '../lobby.mjs';
test('online wins accumulate once per finished match and reset on leaving, not on snapshot or CPU mode',()=>{
  const l=new Lobby(),a=l.join('甲'),b=l.join('乙');
  for(let n=0;n<2;n++){l.ready(a.id,true);l.ready(b.id,true);l.finish(0);l.finish(0);}
  assert.equal(a.wins,2);assert.equal(b.wins,0);assert.equal(l.snapshot(a.id).me.wins,2);
  l.mode(a.id,'practice');l.mode(a.id,'watch');assert.equal(a.wins,2);
  l.leave(a.id);const next=l.join('甲');assert.equal(next.wins,0);
});
test('opponent disconnect/forfeit awards the surviving player and exposes only public win totals',()=>{
  const l=new Lobby(),a=l.join('甲'),b=l.join('乙'),c=l.join('観戦');l.ready(a.id,true);l.ready(b.id,true);l.leave(a.id);
  assert.equal(b.wins,1);assert.equal(l.snapshot(c.id).players.find(p=>p.name==='乙').wins,1);
  assert.equal(l.snapshot(c.id).players.find(p=>p.name==='乙').rule,undefined);
});
