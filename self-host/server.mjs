import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Lobby} from './lobby.mjs';
import {tick,DT,setTarget,serve,arm,forfeit} from './public/physics.js';
import {VERSION} from './public/config.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const matchDefaults=JSON.parse(await readFile(path.join(root,'data/match-settings.json'),'utf8'));
const lobby=new Lobby(matchDefaults),streams=new Map(),rates=new Map();
const names=JSON.parse(await readFile(path.join(root,'data/random-names.json'),'utf8'));
const skins=JSON.parse(await readFile(path.join(root,'data/skins.json'),'utf8'));
const taglines=JSON.parse(await readFile(path.join(root,'data/taglines.json'),'utf8'));
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8787);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function cookie(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hockey='))?.slice(7)||'';}
function publish(){for(const [id,res] of streams){if(res.writableLength>256*1024){res.destroy();continue;}res.write(`data: ${JSON.stringify(lobby.snapshot(id))}\n\n`);}}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>4096)throw Object.assign(new Error('送信サイズが大きすぎます'),{status:413});}try{return JSON.parse(data||'{}');}catch{throw Object.assign(new Error('データ形式が不正です'),{status:400});}}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try{
    const url=new URL(req.url,'http://localhost'),id=cookie(req),p=lobby.players.get(id);
    if(url.pathname==='/api/info'&&req.method==='GET'){send(res,200,{version:VERSION,count:lobby.players.size,max:5,defaultName:lobby.defaultName(),names:names.filter(n=>typeof n==='string'&&Array.from(n).length<=6),skins,taglines,session:p?{name:p.name}:null});return;}
    if(url.pathname==='/health'){send(res,200,{ok:true,version:VERSION});return;}
    if(url.pathname==='/api/events'&&req.method==='GET'){
      if(!p){send(res,401,{error:'入室してください。'});return;}
      if(streams.has(id))streams.get(id).end();
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      streams.set(id,res);p.lastSeen=Date.now();res.write(`data: ${JSON.stringify(lobby.snapshot(id))}\n\n`);
      req.on('close',()=>{if(streams.get(id)===res)streams.delete(id);});return;
    }
    if(url.pathname.startsWith('/api/')&&req.method==='POST'){
      // Same-origin cookies are never accepted from a cross-site mutation.
      if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host){send(res,403,{error:'接続元を確認できません。'});return;}}
      const rateKey=id||req.socket.remoteAddress,now=Date.now(),rate=rates.get(rateKey)||{start:now,count:0};
      if(now-rate.start>1000){rate.start=now;rate.count=0;}rate.count++;rates.set(rateKey,rate);
      if(rate.count>100){send(res,429,{error:'操作が多すぎます。少し待ってください。'});return;}
      const data=await body(req);
      if(url.pathname==='/api/join'){
        if(p){send(res,200,{name:p.name});return;}
        const next=lobby.join(data.name,data.useDefault===true);
        res.setHeader('Set-Cookie',`hockey=${next.id}; HttpOnly; SameSite=Strict; Path=/`);
        send(res,200,{name:next.name});publish();return;
      }
      if(!p){send(res,401,{error:'接続が切れました。もう一度入室してください。'});return;}
      p.lastSeen=now;
      switch(url.pathname){
        case '/api/heartbeat':break;
        case '/api/settings':lobby.setRule(id,data.settings,data.target);publish();break;
        case '/api/ready':lobby.ready(id,data.ready);publish();break;
        case '/api/mode':lobby.mode(id,data.mode);publish();break;
        case '/api/leave':lobby.leave(id);streams.get(id)?.end();streams.delete(id);res.setHeader('Set-Cookie','hockey=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');publish();break;
        case '/api/input':{
          const m=lobby.match,side=m?.ids.indexOf(id)??-1;
          if(side>=0){setTarget(m.game,side,data.x,data.y);if(data.action==='serve')serve(m.game,side);if(data.action==='arm')arm(m.game,side);if(data.action==='forfeit'&&forfeit(m.game,side)){lobby.finish(1-side,'降参');publish();}}break;
        }
        default:send(res,404,{error:'操作が見つかりません。'});return;
      }
      send(res,200,{ok:true});return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){send(res,405,{error:'対応していない操作です。'});return;}
    const relative=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1));
    const file=path.resolve(root,'public',relative),base=path.resolve(root,'public')+path.sep;
    if(!file.startsWith(base)){send(res,403,{error:'アクセスできません'});return;}
    try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);}catch{send(res,404,{error:'ファイルが見つかりません'});}
  }catch(error){if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'サーバーでエラーが発生しました。'});else res.end();}
});
let previous=performance.now(),acc=0,broadcast=0;
const timer=setInterval(()=>{
  const now=performance.now();acc+=Math.min(.1,(now-previous)/1000);previous=now;
  while(acc>=DT){const m=lobby.match;if(m){tick(m.game,DT);if(m.game.status==='finished'){m.finishedAt??=Date.now();if(Date.now()-m.finishedAt>2500){lobby.finish(m.game.winner);publish();}}}acc-=DT;}
  if(now-broadcast>33){broadcast=now;if(lobby.match)publish();}
},8);
const cleanup=setInterval(()=>{
  for(const [id,p] of lobby.players)if(Date.now()-p.lastSeen>65000){lobby.leave(id);streams.get(id)?.end();streams.delete(id);publish();}
  for(const [key,value]of rates)if(Date.now()-value.start>60000)rates.delete(key);
  for(const res of streams.values())res.write(': keepalive\n\n');
},10000);
server.listen(port,host,()=>console.log(`Comic Hockey v${VERSION}  http://${host}:${port}`));
function stop(){clearInterval(timer);clearInterval(cleanup);for(const res of streams.values())res.end();server.close(()=>process.exit(0));}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
