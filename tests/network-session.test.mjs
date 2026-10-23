import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('自己設置版は5人の入室からルール共有・操作・降参・win・再準備・退出まで動く',async t=>{
  const port=18987,base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../self-host/',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());await once(child.stdout,'data');
  const cookies=[];
  const post=(route,data={},cookie)=>fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
  async function snapshot(cookie){const stream=await fetch(base+'/api/events',{headers:{Cookie:cookie}}),reader=stream.body.getReader();try{const {value}=await reader.read();return JSON.parse(new TextDecoder().decode(value).split('data: ')[1].split('\n')[0]);}finally{await reader.cancel();}}
  for(let i=0;i<5;i++){const r=await post('join',{useDefault:true});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
  assert.equal((await post('join',{useDefault:true})).status,409);
  await post('settings',{settings:{goalSize:12,puckColor:'blue'},target:11},cookies[0]);
  const waiting=await snapshot(cookies[2]);assert.equal(waiting.players.length,5);assert.equal(waiting.players[0].rule,undefined);assert.equal(waiting.match,null);
  await post('ready',{ready:true},cookies[1]);await post('ready',{ready:true},cookies[0]);
  let state=await snapshot(cookies[0]);assert.equal(state.match.side,0);assert.equal(state.match.rule.settings.goalSize,12);assert.equal(state.match.rule.settings.puckColor,'blue');assert.equal(state.match.game.target,11);
  const spectator=await snapshot(cookies[2]);assert.equal(spectator.match.side,-1);assert.deepEqual(spectator.match.rule,state.match.rule);
  await post('input',{x:200,y:260,action:'serve'},cookies[0]);state=await snapshot(cookies[0]);assert.equal(state.match.game.status,'playing');
  await post('input',{x:250,y:180,action:'arm'},cookies[0]);state=await snapshot(cookies[1]);assert.equal(state.match.side,1);assert.ok(state.match.game.events.some(e=>e.type==='arm'));
  await post('input',{action:'forfeit'},cookies[1]);state=await snapshot(cookies[0]);assert.equal(state.match,null);assert.equal(state.me.wins,1);assert.equal(state.me.ready,false);assert.equal(state.lastResult.reason,'降参');
  await post('input',{action:'forfeit'},cookies[1]);assert.equal((await snapshot(cookies[0])).me.wins,1);
  await post('ready',{ready:true},cookies[0]);await post('ready',{ready:true},cookies[1]);state=await snapshot(cookies[0]);assert.equal(state.match.id,2);assert.equal(state.match.rule.settings.goalSize,12);
  await post('leave',{},cookies[0]);state=await snapshot(cookies[1]);assert.equal(state.me.wins,1);assert.equal(state.match,null);
  await post('mode',{mode:'practice'},cookies[1]);assert.equal((await snapshot(cookies[1])).me.wins,1);
  for(const c of cookies.slice(1))await post('leave',{},c);assert.equal((await (await fetch(base+'/api/info')).json()).count,0);
});
