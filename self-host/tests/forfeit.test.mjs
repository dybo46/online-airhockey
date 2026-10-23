import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,serve,arm,forfeit,tick} from '../public/physics.js';
test('surrender finishes on either side even in endless practice, preserves score and cannot reverse a finished result',()=>{
  for(const side of [0,1]){
    const game=createGame();game.endless=true;game.score=[3,4];serve(game,0);arm(game,side);
    assert.equal(forfeit(game,side),true);assert.equal(game.status,'finished');assert.equal(game.winner,1-side);assert.equal(game.finishReason,'降参');assert.deepEqual(game.score,[3,4]);
    assert.equal(game.puck.vx,0);assert.equal(game.puck.vy,0);assert.ok(game.paddles.every(p=>p.armedAt===null));
    const count=game.events.length;assert.equal(forfeit(game,1-side),false);tick(game);assert.equal(game.events.length,count);assert.equal(game.winner,1-side);
  }
  const game=createGame();assert.equal(forfeit(game,-1),false);assert.equal(forfeit(game,2),false);assert.equal(game.status,'serve');
});
