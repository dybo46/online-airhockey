import test from 'node:test';
import assert from 'node:assert/strict';
import {ShotEffects,SHOT_STYLES,SHOT_NAMES} from '../public/effects.js';
import {SOUND_LIBRARY,SOUND_FILES,validateSoundChoices,SoundBank} from '../public/audio.js';
import {existsSync} from 'node:fs';
test('laser styles belong to powered hits; each pool can vary without consecutive repeats',()=>{
  for(const grade of [null,'COOL','DRIVE','SMASH']){
    const fx=new ShotEffects(()=>0),seen=new Set();let previous=-1;
    for(let n=0;n<30;n++){const name=fx.trigger(50,60,grade,n*100);assert.notEqual(fx.shot.index,previous);previous=fx.shot.index;seen.add(fx.shot.kind);assert.ok(SHOT_NAMES.includes(name));}
    assert.equal(seen.size,grade?13:9);if(!grade)assert.ok(!seen.has('laser'));fx.reset();assert.equal(fx.shot,null);assert.equal(fx.points.length,0);
  }
  assert.equal(SHOT_STYLES.length,13);
});
test('46 sound candidates have stable IDs, recorded defaults and independently layered skill sounds',()=>{
  assert.equal(SOUND_LIBRARY.length,46);assert.equal(new Set(SOUND_LIBRARY.map(s=>s.id)).size,46);
  for(const s of SOUND_LIBRARY)assert.ok(existsSync(new URL('../public/assets/audio/'+s.file,import.meta.url)),s.file);
  for(const type of ['hit','wall','COOL','DRIVE','SMASH'])assert.ok(SOUND_FILES[type].every(name=>name.startsWith('air-dry-')));
  assert.ok(SOUND_FILES.charge.every(name=>name.startsWith('laser')));assert.ok(SOUND_FILES.laserHit.every(name=>name.startsWith('laser')));
  assert.deepEqual(validateSoundChoices({hit:'S29',wall:'mute',SMASH:'bad'}),{hit:'S29',wall:'mute',charge:'',laserHit:'',COOL:'',DRIVE:'',SMASH:'',goal:'',win:'',serve:''});
  const bank=new SoundBank();bank.volume=0;assert.equal(bank.play('hit'),true,'mute must suppress the synthesized fallback');
});
