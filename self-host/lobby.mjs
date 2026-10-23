import {randomBytes} from 'node:crypto';
import {createGame} from './public/physics.js';
import {normalizeSettings,normalizeTarget} from './public/config.js';
export class Lobby {
  constructor(options={}){this.options=options;this.players=new Map();this.queue=[];this.match=null;this.lastResult=null;this.matchNumber=0;}
  defaultName(){for(let n=1;n<=5;n++){const name=`名無しさん${String(n).replace(/\d/g,d=>'０１２３４５６７８９'[d])}`;if(![...this.players.values()].some(p=>p.name===name))return name;}return '名無しさん';}
  join(name,useDefault=false){
    if(this.players.size>=5)throw Object.assign(new Error('満杯です。参加者は5人までです。'),{status:409});
    name=useDefault?this.defaultName():String(name||'').trim().normalize('NFC');
    if(!name||Array.from(name).length>6||/[\p{C}<>]/u.test(name))throw Object.assign(new Error('名前は1〜6文字で入力してください。'),{status:400});
    if([...this.players.values()].some(p=>p.name===name))throw Object.assign(new Error('その名前は使用中です。別の名前を選んでください。'),{status:409});
    const id=randomBytes(24).toString('hex'),p={id,name,wins:0,ready:false,mode:'lobby',lastSeen:Date.now(),retained:false};
    p.rule={settings:normalizeSettings(this.options.settings),target:normalizeTarget(this.options.target)||6,revision:1};
    this.players.set(id,p);this.queue.push(id);return p;
  }
  setRule(id,settings,target){
    const p=this.players.get(id);if(!p)return;
    if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Object.assign(new Error('設定の形式が違います。'),{status:400});
    const next={settings:normalizeSettings(settings),target:normalizeTarget(target)||6};
    if(JSON.stringify(next.settings)!==JSON.stringify(p.rule.settings)||next.target!==p.rule.target){
      p.rule={...next,revision:p.rule.revision+1};p.ready=false;
    }
  }
  ready(id,value){const p=this.players.get(id);if(!p||p.mode!=='lobby')return;p.ready=!!value;this.tryMatch();}
  mode(id,mode){const p=this.players.get(id);if(!p||p.mode==='match')return;p.mode=['practice','watch'].includes(mode)?mode:'lobby';p.ready=false;this.tryMatch();}
  tryMatch(){
    if(this.match)return;
    const selected=this.queue.filter(id=>{const p=this.players.get(id);return p&&p.mode==='lobby'&&p.ready;}).slice(0,2);
    if(selected.length<2)return;
    // A retained winner loses priority once two other ready players take the table.
    const skipped=this.queue.filter(id=>this.players.get(id)?.retained&&!selected.includes(id));
    for(const id of skipped){this.queue=this.queue.filter(x=>x!==id);this.queue.push(id);this.players.get(id).retained=false;}
    this.queue=this.queue.filter(id=>!selected.includes(id));
    for(const id of selected){const p=this.players.get(id);p.mode='match';p.ready=false;p.retained=false;}
    const owner=this.players.get(selected[0]),rule=structuredClone({...owner.rule,ownerName:owner.name,ownerId:owner.id.slice(0,12)});
    this.match={id:++this.matchNumber,ids:selected,names:selected.map(id=>this.players.get(id).name),rule,game:createGame(rule.settings,rule.target),finishedAt:null};
  }
  finish(winnerSide,reason='得点による決着'){
    if(!this.match)return;
    const m=this.match,winner=m.ids[winnerSide],loser=m.ids[1-winnerSide];
    const winningPlayer=this.players.get(winner);if(winningPlayer)winningPlayer.wins++;
    this.lastResult={names:m.names,score:m.game.score,winner:m.names[winnerSide],reason};
    for(const id of m.ids){const p=this.players.get(id);if(p){p.mode='lobby';p.ready=false;p.retained=id===winner;}}
    this.queue=this.queue.filter(id=>!m.ids.includes(id));
    if(this.players.has(winner))this.queue.unshift(winner);
    if(this.players.has(loser))this.queue.push(loser);
    this.match=null;this.tryMatch();
  }
  leave(id){
    if(!this.players.has(id))return;
    const side=this.match?.ids.indexOf(id)??-1;
    this.players.delete(id);this.queue=this.queue.filter(x=>x!==id);
    if(side>=0)this.finish(1-side,'退出・接続切れによる棄権');
  }
  snapshot(id){
    const roster=[...(this.match?.ids||[]),...this.queue].map(key=>this.players.get(key)).filter(Boolean).map(p=>({id:p.id.slice(0,12),name:p.name,wins:p.wins,ready:p.ready,mode:p.mode,retained:p.retained}));
    const me=this.players.get(id);
    return {players:roster,me:me?{id:me.id.slice(0,12),name:me.name,wins:me.wins,ready:me.ready,mode:me.mode}:null,
      queue:this.queue.map(key=>key.slice(0,12)),lastResult:this.lastResult,
      match:this.match?{id:this.match.id,names:this.match.names,side:this.match.ids.indexOf(id),rule:this.match.rule,game:this.match.game}:null};
  }
}
