// New cosmetic trails only. Never reads or writes simulation velocity/collisions.
export const EXTRA_SHOT_STYLES=['echo-weave','split-mirage','reverse-wake'];
export const EXTRA_SHOT_NAMES=['ゆらぎ残像','分岐ミラージュ','逆流エコー'];
export function drawExtraShot(fx,ctx,puck,r,now,active=true){
  if(!active){fx.reset();return;}
  const previous=fx.points.at(-1);
  if(!previous||Math.hypot(previous.x-puck.x,previous.y-puck.y)>1||now-previous.at>35)fx.points.push({x:puck.x,y:puck.y,at:now});
  fx.points=fx.points.filter(p=>now-p.at<680).slice(-90);
  const shot=fx.shot,points=fx.points;
  if(!shot||now-shot.at>4200||points.length<2)return;
  const age=now-shot.at,fade=Math.min(1,(4200-age)/500),[color,secondary]=shot.colors,power=shot.power;
  const tail=points[Math.max(0,points.length-3)],dx=puck.x-tail.x,dy=puck.y-tail.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
  // All false cues stay behind the real puck in its currently observed direction.
  const behind=(x,y)=>{const forward=(x-puck.x)*ux+(y-puck.y)*uy+r*.8;if(forward>0){x-=ux*forward;y-=uy*forward;}return {x,y};};
  const line=(path,c,width,alpha)=>{if(path.length<2)return;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=c;ctx.lineWidth=width;ctx.globalAlpha=alpha*fade;ctx.stroke();};
  const ghost=(p,size,c,alpha)=>{ctx.globalAlpha=alpha*fade;ctx.beginPath();ctx.ellipse(p.x,p.y,size*1.3,size*.75,Math.atan2(uy,ux),0,Math.PI*2);ctx.fillStyle=c+'33';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();};
  ctx.save();ctx.lineCap=ctx.lineJoin='round';
  if(shot.kind==='echo-weave'){
    const path=points.map((p,i)=>{const t=(now-p.at)/680,offset=Math.sin(i*.5+now*.012)*r*2.3*t*power;return behind(p.x+nx*offset,p.y+ny*offset);});
    line(path,'#102033',r*.8,.45);line(path,color,6*power,.8);line(path,'#ffffff',1.5,.7);
    for(let i=1;i<path.length;i+=7)ghost(path[i],r*.7,secondary,.45);
  }else if(shot.kind==='split-mirage'){
    for(const branch of [-1,1]){
      const path=points.map((p,i)=>{const t=(now-p.at)/680,offset=branch*r*(t*3.4+Math.sin(t*4+age/300)*t)*power;return behind(p.x+nx*offset,p.y+ny*offset);});
      line(path,'#102033',8,.35);line(path,branch<0?color:secondary,4*power,.7);
      for(let i=2;i<path.length;i+=12)ghost(path[i],r*.8,branch<0?color:secondary,.5);
    }
  }else if(shot.kind==='reverse-wake'){
    line(points.map(p=>behind(p.x,p.y)),color,2,.28);
    for(let n=0;n<7;n++){
      const phase=((age/550+n/7)%1),p=points[Math.floor((1-phase)*(points.length-1))],offset=Math.sin(phase*Math.PI*3+n)*r*1.5*power;
      ghost(behind(p.x+nx*offset-ux*phase*r,p.y+ny*offset-uy*phase*r),r*(1-phase*.45),n%2?secondary:color,(1-phase)*.7);
    }
  }
  ctx.restore();
}
