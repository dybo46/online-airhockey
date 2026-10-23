import test from 'node:test';
import assert from 'node:assert/strict';
import {PUCK_STYLES,normalizeSettings,upgradeSettings} from '../public/config.js';
import {Lobby} from '../lobby.mjs';
import {createGame,serve,tick} from '../public/physics.js';
test('one validated puck color survives settings and legacy migration without changing physics',()=>{
  assert.deepEqual(PUCK_STYLES.map(style=>style.id),['black','white','red','blue']);
  for(const value of [undefined,'invalid',['red','blue'],null])assert.equal(normalizeSettings({puckColor:value}).puckColor,'black');
  const games=PUCK_STYLES.map(style=>{
    const settings=upgradeSettings({puckColor:style.id},'0.9');assert.equal(settings.puckColor,style.id);
    const game=createGame(settings);serve(game,0);for(let n=0;n<100;n++)tick(game);return game;
  });
  for(const game of games){assert.deepEqual(game.puck,games[0].puck);assert.deepEqual(game.score,games[0].score);}
});
test('owner puck color stays hidden until match and is frozen for both players and spectators',()=>{
  const lobby=new Lobby(),a=lobby.join('先'),b=lobby.join('後'),viewer=lobby.join('観戦');
  lobby.setRule(a.id,{puckColor:'red'},6);lobby.setRule(b.id,{puckColor:'blue'},6);
  assert.ok(!JSON.stringify(lobby.snapshot(viewer.id)).includes('puckColor'));
  lobby.ready(a.id,true);lobby.ready(b.id,true);
  for(const p of [a,b,viewer]){assert.equal(lobby.snapshot(p.id).match.rule.settings.puckColor,'red');assert.equal(lobby.snapshot(p.id).match.game.settings.puckColor,'red');}
  lobby.setRule(a.id,{puckColor:'white'},6);assert.equal(a.rule.settings.puckColor,'white');assert.equal(lobby.match.game.settings.puckColor,'red');
});
