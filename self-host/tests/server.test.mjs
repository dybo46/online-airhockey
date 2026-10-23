import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('HTTP sessions enforce five-player limit, roster size, origins and private data',async t=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'18986',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());await once(child.stdout,'data');
  const base='http://127.0.0.1:18986';
  async function post(route,data={},cookie='',origin){return fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});}
  const cookies=[];for(let n=0;n<5;n++){const r=await post('join',{useDefault:true});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
  const full=await post('join',{useDefault:true});assert.equal(full.status,409);assert.match((await full.json()).error,/満杯/);
  const info=await(await fetch(base+'/api/info')).json();assert.equal(info.count,5);assert.equal(info.skins.length,13);assert.equal(info.taglines.length,50);
  assert.equal((await post('ready',{ready:true},cookies[0],'http://evil.example')).status,403);
  assert.equal((await post('ready',{ready:true})).status,401);
  const stream=await fetch(base+'/api/events',{headers:{Cookie:cookies[0]}});const reader=stream.body.getReader();
  const {value}=await reader.read(),event=new TextDecoder().decode(value);assert.match(event,/名無しさん１/);
  const payload=JSON.parse(event.split('data: ')[1].split('\n')[0]);assert.equal(payload.players.length,5);assert.equal(payload.players[0].id.length,12);assert.ok(!JSON.stringify(payload).includes(cookies[0].slice(7)));
  await reader.cancel();assert.equal((await post('leave',{},cookies[0])).status,200);assert.equal((await post('join',{useDefault:true})).status,200);
  assert.equal((await fetch(base+'/server.mjs')).status,404);assert.equal((await fetch(base+'/data/random-names.json')).status,404);
});
