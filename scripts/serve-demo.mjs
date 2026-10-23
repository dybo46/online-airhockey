import http from 'node:http';
import {readFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const mount='/online-airhockey/',port=Number(process.env.PORT||8795);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(process.env.AUDIT_FILE)await appendFile(process.env.AUDIT_FILE,JSON.stringify({method:req.method,path:url.pathname})+'\n');
  if(url.pathname==='/'){res.writeHead(302,{Location:mount});res.end();return;}
  if(!['GET','HEAD'].includes(req.method)||!url.pathname.startsWith(mount)){res.writeHead(404);res.end();return;}
  try{
    const relative=decodeURIComponent(url.pathname.slice(mount.length))||'index.html',file=path.resolve(root,relative);
    if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`CPU demo: http://127.0.0.1:${port}${mount}`));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
