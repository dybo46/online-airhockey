import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMouseReleaseKey,MOUSE_RELEASE_HINT} from '../public/mouse-controls.js';
test('release keys exit only while locked and consume default button/scroll actions',()=>{
  for(const code of ['Escape','Space','Backspace','Enter','NumpadEnter']){
    let released=0,prevented=0,stopped=0;
    const event={code,preventDefault(){prevented++;},stopPropagation(){stopped++;}};
    assert.equal(handleMouseReleaseKey(event,false,()=>released++),false);
    assert.deepEqual([released,prevented,stopped],[0,0,0]);
    assert.equal(handleMouseReleaseKey(event,true,()=>released++),true);
    assert.deepEqual([released,prevented,stopped],[1,1,1]);
  }
  assert.equal(handleMouseReleaseKey({code:'KeyA'},true,()=>assert.fail()),false);
  assert.equal(handleMouseReleaseKey({code:'Enter',isComposing:true},true,()=>assert.fail()),false);
  for(const label of ['Esc','スペース','Backspace','Enter','右クリック'])assert.ok(MOUSE_RELEASE_HINT.includes(label));
});
