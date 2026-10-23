import {normalizeSettings,CPU_PROFILES,normalizeTarget} from './config.js';
export const W=1000,H=560,DT=1/120;
export function dimensions(settings) {
  return {goal:80+settings.goalSize*12,puck:7+(settings.puckSize+10)*1.05,paddle:16+(settings.paddleSize+10)*1.5,max:400+settings.maxSpeed*75};
}
export function createGame(settings={},target=6) {
  const s=normalizeSettings(settings);
  return {settings:s,target:normalizeTarget(target)||6,time:0,status:'serve',serveSide:0,score:[0,0],winner:null,
    powerChain:0,puck:{x:250,y:H/2,vx:0,vy:0},paddles:[0,1].map(side=>({x:side?820:180,y:H/2,vx:0,vy:0,tx:side?820:180,ty:H/2,armedAt:null,nextArm:0})),
    events:[],eventId:0,lastHit:null,ai:{next:0,serveAt:.8},idle:0};
}
function emit(g,type,extra={}){g.events.push({id:++g.eventId,type,time:g.time,...extra});if(g.events.length>16)g.events.shift();}
export function forfeit(g,side){
  if(!g||g.status==='finished'||![0,1].includes(side))return false;
  g.status='finished';g.winner=1-side;g.finishReason='降参';g.puck.vx=0;g.puck.vy=0;
  for(const p of g.paddles)p.armedAt=null;
  emit(g,'win',{side:g.winner,reason:g.finishReason});return true;
}
export function setTarget(g,side,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!g.paddles[side])return;
  const r=dimensions(g.settings).paddle,p=g.paddles[side];
  p.tx=Math.max(side?W/2+r:r,Math.min(side?W-r:W/2-r,x));p.ty=Math.max(r,Math.min(H-r,y));
}
export function serve(g,side){
  if(g.status!=='serve'||g.serveSide!==side)return false;
  const d=dimensions(g.settings),speed=180+g.settings.puckSpeed*28;
  const p=g.paddles[side],paddleX=side?W-d.paddle-12:d.paddle+12;
  Object.assign(p,{x:paddleX,y:H/2,tx:paddleX,ty:H/2,vx:0,vy:0});
  const puckX=Math.max(W*.27,d.paddle*2+d.puck+24);
  Object.assign(g.puck,{x:side?W-puckX:puckX,y:H/2,vx:(side?-1:1)*speed,vy:0});
  g.status='playing';g.idle=0;g.powerChain=0;g.ai.controllers={};
  for(const p of g.paddles)p.armedAt=null;
  emit(g,'serve',{side});return true;
}
export function arm(g,side){
  if(g.status!=='playing')return false;
  const p=g.paddles[side];if(g.time+1e-9<p.nextArm)return false;
  p.armedAt=g.time;p.nextArm=g.time+g.settings.cooldown/10;
  emit(g,'arm',{side,x:p.x,y:p.y});return true;
}
export function cpuTimingFrames(settings,level=3,random=Math.random){
  const roll=random(),smash=settings.smashFrames,drive=settings.driveFrames,cool=settings.coolFrames;
  const high=level>=9,perfect=level>=10;
  const bands=perfect?[.30,.65,1,1]:high?[.27,.61,.94,.98]:level>=7?[.22,.55,.88,.96]:[.18,.47,.76,.92];
  let frames=roll<bands[0]?smash*.55:roll<bands[1]?(smash+drive)/2:roll<bands[2]?(drive+cool)/2:roll<bands[3]?cool+2+random()*4:-1-random()*3;
  return frames+(random()-.5)*CPU_PROFILES[Math.max(0,Math.min(9,Math.round(level)-1))].jitter;
}
export function predictContact(p,b,radius){
  const x=b.x-p.x,y=b.y-p.y,vx=b.vx-p.vx,vy=b.vy-p.vy,a=vx*vx+vy*vy,q=x*vx+y*vy,c=x*x+y*y-radius*radius;
  if(q>=0||a<1)return null;if(c<=0)return 0;
  const disc=q*q-a*c;if(disc<0)return null;
  const t=(-q-Math.sqrt(disc))/a;return t>=0?t:null;
}
export function hitGrade(frames,s){
  if(frames<0||frames>s.coolFrames+1e-7)return null;
  return frames<=s.smashFrames+1e-7?'SMASH':frames<=s.driveFrames+1e-7?'DRIVE':'COOL';
}
export function speedLimit(g){return dimensions(g.settings).max*Math.min(g.settings.counterMax/10,1+Math.max(0,(g.powerChain||0)-1)*g.settings.counterStep/10);}
export function addGoal(g,scorer){
  if(g.status!=='playing')return;
  g.score[scorer]++;emit(g,'goal',{side:scorer});
  const [a,b]=g.score;
  if(!g.endless&&Math.max(a,b)>=g.target&&Math.abs(a-b)>=2){g.status='finished';g.winner=scorer;emit(g,'win',{side:scorer});}
  else {g.status='serve';g.serveSide=1-scorer;g.ai.serveAt=g.time+.9;
    const state=scoreState(g);if(state.kind)emit(g,'pointState',{kind:state.kind,side:state.side});
  }
  g.puck.vx=g.puck.vy=0;for(const p of g.paddles)p.armedAt=null;
}
export function scoreState(g){
  const [a,b]=g.score,base=Math.min(a,b);
  if(g.endless||g.status==='finished')return {kind:null,side:null,labels:[String(a),String(b)]};
  if(base>=g.target-1){
    if(a===b)return {kind:'deuce',side:null,labels:[String(a),String(b)]};
    const side=a>b?0:1;return {kind:'matchPoint',side,labels:[String(base)+(side===0?'A':''),String(base)+(side===1?'A':'')]};
  }
  return {kind:Math.max(a,b)===g.target-1?'matchPoint':null,side:a>b?0:b>a?1:null,labels:[String(a),String(b)]};
}
export function scoreLabel(g){
  const [a,b]=g.score;
  if(g.status==='finished')return '試合終了';
  const state=scoreState(g);if(state.kind)return state.kind==='deuce'?'DEUCE':`MATCH POINT · ${a>b?'LEFT':'RIGHT'}`;
  return `${g.target}本先取 · 2点差で勝利`;
}
export function cpu(g,level=3,side=1,random=Math.random){
  const p=g.paddles[side],b=g.puck;
  if(g.status==='serve'){if(g.serveSide===side&&g.time>=g.ai.serveAt)serve(g,side);return;}
  if(g.status!=='playing')return;
  level=Math.max(1,Math.min(10,Math.round(level)||3));const profile=CPU_PROFILES[level-1];
  g.ai.controllers??={};
  const ai=g.ai.controllers[side]??={next:0,samples:[],phase:'normal',until:0,escapes:0,turn:1,shotAt:null,decideShotAt:0,attempts:0,lapseUntil:0,lapseCheckAt:0,lapses:0,tactic:'middle',tacticUntil:0,tacticChanges:0};
  // Button timing runs every physics step, independently of movement reaction speed.
  if(ai.phase!=='normal')ai.shotAt=null;
  if(ai.shotAt!==null&&g.time>=ai.shotAt){if(arm(g,side))ai.attempts++;ai.shotAt=null;ai.decideShotAt=g.time+.3;}
  if(g.time<ai.next)return;
  const d=dimensions(g.settings),reach=d.paddle+d.puck,dir=side?1:-1;
  const own=side?b.x>W/2:b.x<W/2,near=Math.hypot(b.x-p.x,b.y-p.y)<reach*2+130;
  // Short, time-based lapses affect movement only; never fabricate a goal or a hit.
  if(ai.phase==='normal'&&own&&(side?b.vx>0:b.vx<0)&&g.time>=ai.lapseCheckAt){
    ai.lapseCheckAt=g.time+1.5;
    if(random()<[.18,.18,.17,.16,.16,.15,.14,.12,.07,.045][level-1]){
      ai.lapseUntil=g.time+.45+random()*.45;ai.lapseCheckAt=ai.lapseUntil+3+random()*2;ai.lapses++;
    }
  }
  const lapse=g.time<ai.lapseUntil,movementLevel=lapse?Math.max(1,level-2):level;
  const movement=CPU_PROFILES[movementLevel-1],beginnerSlip=lapse&&level===1;
  ai.movementLevel=movementLevel;ai.lapsing=lapse;
  const interval=movement.reaction*(beginnerSlip?1.3:1);ai.next=g.time+interval;
  const edge=b.y<reach+45||b.y>H-reach-45|| (side?b.x>W-reach-45:b.x<reach+45);
  ai.samples.push({t:g.time,px:p.x,py:p.y,bx:b.x,by:b.y});
  ai.samples=ai.samples.filter(s=>g.time-s.t<=1.1);
  const span=key=>Math.max(...ai.samples.map(s=>s[key]))-Math.min(...ai.samples.map(s=>s[key]));
  const observed=ai.samples.length>1&&g.time-ai.samples[0].t>=.75;
  const staying=observed&&span('px')<32&&span('py')<32;
  const confined=observed&&span('bx')<reach*2+35&&span('by')<reach*2+35;
  // Observe where the puck stays, not only its speed: corner ricochets may be fast.
  if(ai.phase==='normal'&&own&&near&&(staying||(edge&&confined))){
    ai.phase='clear';ai.until=g.time+.7;ai.escapes++;ai.samples=[];ai.turn*=-1;
    ai.vertical=b.y<H*.35?1:b.y>H*.65?-1:ai.turn;
    ai.clearX=p.x-dir*(reach+95);
    ai.clearY=p.y+ai.vertical*(reach+100);
  }
  if(ai.phase==='clear'&&g.time>=ai.until){ai.phase='flank';ai.until=g.time+.55;}
  if(ai.phase==='flank'&&g.time>=ai.until){ai.phase='normal';ai.samples=[];}
  if(ai.phase==='normal'&&g.time>=ai.tacticUntil){
    const roll=random(),defend=.08+level*.008;
    let next=roll<defend?'goal':roll<defend+.38?'middle':roll<defend+.72?'diagonal':'press';
    if(next===ai.tactic)next=next==='middle'?'diagonal':'middle';
    ai.tactic=next;ai.tacticUntil=g.time+(next==='goal'?1.2+random()*1.2:2.5+random()*3);ai.lane=random()<.5?-1:1;ai.tacticChanges++;
  }
  const home=ai.tactic==='goal'?W-d.paddle-24:ai.tactic==='middle'?750:800;
  let x=side?home:W-home,y=H/2;
  const incoming=side?b.vx>0:b.vx<0;
  if(ai.phase==='clear'){
    // Commit to opening space; do not change our mind and chase the trapped puck.
    x=ai.clearX;y=ai.clearY;
  }else if(ai.phase==='flank'&&own){
    x=b.x+dir*(reach+24);y=b.y+ai.vertical*(reach+50);
  }else if(own&&Math.hypot(b.vx,b.vy)<220){
    const behind=b.x+dir*(reach+18),gap=(behind-p.x)*dir;
    // Go around a slow puck before approaching it, instead of pushing it into a wall.
    x=behind;y=b.y;
    if(gap>reach*.65)y+= (b.y<H/2?1:-1)*(reach+32);
    else x=b.x-dir*reach*.25;
  }else if(incoming){
    x=ai.tactic==='goal'?(side?home:W-home):ai.tactic==='middle'?(side?750:250):side?Math.max(610,Math.min(900,b.x+55)):Math.min(390,Math.max(100,b.x-55));
    let predicted=b.y+(movementLevel>=5?b.vy*Math.max(0,(x-b.x)/b.vx):0);
    const wall=dimensions(g.settings).puck,span=H-2*wall,fold=((predicted-wall)%(2*span)+2*span)%(2*span);
    y=wall+(fold>span?2*span-fold:fold);
  }else if(side?b.x>560:b.x<440){x=b.x+dir*(reach+12);y=b.y;}
  // Approach an offset contact point to create a real diagonal reflection.
  // Wall escapes and slow-puck release retain priority; no velocity is assigned here.
  if(ai.phase==='normal'&&ai.tactic==='diagonal'&&own&&near&&Math.hypot(b.vx,b.vy)>=220){
    const aimX=side?0:W,aimY=ai.lane<0?-H*.5:H*1.5,angle=Math.atan2(aimY-b.y,aimX-b.x);
    x=b.x-Math.cos(angle)*reach*.94;y=b.y-Math.sin(angle)*reach*.94;
  }
  if(ai.phase==='normal')y+=(random()-.5)*movement.error*(beginnerSlip?1.35:1);
  const speed=(300+g.settings.paddleSpeed*65)*movement.speed*(beginnerSlip?.8:1);
  const dx=x-p.x,dy=y-p.y,len=Math.hypot(dx,dy),step=speed*interval;
  setTarget(g,side,p.x+dx*Math.min(1,step/(len||1)),p.y+dy*Math.min(1,step/(len||1)));
  if(ai.phase==='normal'&&own&&ai.shotAt===null&&g.time>=ai.decideShotAt&&g.time>=p.nextArm){
    const contact=predictContact({...p,vx:(p.tx-p.x)/interval,vy:(p.ty-p.y)/interval},b,reach);
    if(contact!==null&&contact<.45){
      ai.decideShotAt=g.time+.35;
      if(random()<profile.attempt)ai.shotAt=g.time+contact-cpuTimingFrames(g.settings,level,random)/60;
    }
  }
}
export function tick(g,dt=DT){
  if(g.status==='finished')return;
  g.time+=dt;const s=g.settings,d=dimensions(s),b=g.puck;
  for(const p of g.paddles){
    const dx=p.tx-p.x,dy=p.ty-p.y,len=Math.hypot(dx,dy),step=Math.min(len,(300+s.paddleSpeed*65)*dt);
    p.vx=len?dx/len*step/dt:0;p.vy=len?dy/len*step/dt:0;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.armedAt!==null&&(g.time-p.armedAt)*60>s.coolFrames){p.armedAt=null;emit(g,'miss',{side:g.paddles.indexOf(p),x:p.x,y:p.y});}
  }
  if(g.status!=='playing')return;
  // Substeps keep fast pucks from skipping thin mallets or the goal mouth.
  const count=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/Math.max(3,d.puck*.65))),sub=dt/count;
  let wallHit=false;
  for(let k=0;k<count&&g.status==='playing';k++){
    b.x+=b.vx*sub;b.y+=b.vy*sub;
    if(b.y<d.puck){b.y=d.puck;b.vy=Math.abs(b.vy)*s.bounce/10;wallHit=true;}
    if(b.y>H-d.puck){b.y=H-d.puck;b.vy=-Math.abs(b.vy)*s.bounce/10;wallHit=true;}
    const inGoal=Math.abs(b.y-H/2)+d.puck<d.goal/2;
    if(inGoal&&(b.x<-d.puck||b.x>W+d.puck)){addGoal(g,b.x<0?1:0);break;}
    if(!inGoal&&b.x<d.puck){b.x=d.puck;b.vx=Math.abs(b.vx)*s.bounce/10;wallHit=true;}
    if(!inGoal&&b.x>W-d.puck){b.x=W-d.puck;b.vx=-Math.abs(b.vx)*s.bounce/10;wallHit=true;}
    for(let side=0;side<2;side++){
      const p=g.paddles[side],dx=b.x-p.x,dy=b.y-p.y,dist=Math.hypot(dx,dy),r=d.puck+d.paddle;
      if(dist>=r)continue;
      const nx=dist?dx/dist:(side?-1:1),ny=dist?dy/dist:0;
      b.x=p.x+nx*(r+.2);b.y=p.y+ny*(r+.2);
      const dot=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny;
      if(dot>=0)continue;
      b.vx-=2*dot*nx;b.vy-=2*dot*ny;
      const strength=.65+s.hitPower*.035;b.vx*=strength;b.vy*=strength;
      let grade=null,frames=null;
      if(p.armedAt!==null){frames=(g.time-p.armedAt)*60;grade=hitGrade(frames,s);p.armedAt=null;}
      if(grade){const boost=s[grade.toLowerCase()+'Boost']/10;b.vx*=boost;b.vy*=boost;g.powerChain=g.lastHit?.grade&&g.lastHit.grade!=='通常'&&g.lastHit.side!==side?(g.powerChain||1)+1:1;}
      else g.powerChain=0;
      g.lastHit={grade:grade||'通常',frames:frames===null?null:Math.round(frames*10)/10,side,time:g.time,chain:g.powerChain};
      emit(g,'hit',{side,grade,frames,x:b.x,y:b.y,chain:g.powerChain});
    }
    const velocity=Math.hypot(b.vx,b.vy),limit=Math.min(1,speedLimit(g)/(velocity||1));b.vx*=limit;b.vy*=limit;
  }
  if(wallHit&&g.time-(g.lastWallSound??-Infinity)>.09){g.lastWallSound=g.time;emit(g,'wall');}
  const friction=Math.exp(-(21-s.glide)*.018*dt);b.vx*=friction;b.vy*=friction;
  if(g.status==='playing'&&Math.hypot(b.vx,b.vy)<35){g.idle+=dt;if(g.idle>3){g.status='serve';g.serveSide=b.x<W/2?0:1;g.ai.serveAt=g.time+.9;emit(g,'stuck');}}
  else g.idle=0;
}
