const COLORS=['#ff416c','#ff9f32','#ffe65c','#62ed83','#38dfff','#7b78ff','#ed65ff'];
export class RainbowSmash {
  constructor(random=Math.random){this.random=random;this.clear();}
  clear(){this.active=false;this.laser=false;this.points=[];}
  hit(grade){
    this.clear();
    if(grade==='SMASH'&&this.random()<.1){this.active=true;this.laser=this.random()<.5;}
  }
  drawPuck(ctx,puck,r,now){
    if(!this.active)return false;
    ctx.save();ctx.beginPath();ctx.arc(puck.x,puck.y,r,0,Math.PI*2);ctx.clip();
    const gradient=ctx.createConicGradient(now/700,puck.x,puck.y);
    for(let i=0;i<=COLORS.length;i++)gradient.addColorStop(i/COLORS.length,COLORS[i%COLORS.length]);
    ctx.fillStyle=gradient;ctx.fillRect(puck.x-r,puck.y-r,r*2,r*2);ctx.restore();
    ctx.save();ctx.beginPath();ctx.arc(puck.x,puck.y,r+1,0,Math.PI*2);ctx.strokeStyle='#152639';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(puck.x-r*.2,puck.y-r*.25,r*.38,Math.PI,Math.PI*1.65);ctx.strokeStyle='#ffffffaa';ctx.lineWidth=2;ctx.stroke();ctx.restore();return true;
  }
  drawTrail(ctx,puck,r,now){
    if(!this.active||!this.laser)return;
    const last=this.points.at(-1);if(!last||Math.hypot(last.x-puck.x,last.y-puck.y)>1||now-last.at>35)this.points.push({x:puck.x,y:puck.y,at:now});
    this.points=this.points.filter(p=>now-p.at<680).slice(-90);if(this.points.length<2)return;
    ctx.save();ctx.lineCap=ctx.lineJoin='round';
    for(let color=0;color<COLORS.length;color++){
      ctx.beginPath();this.points.forEach((p,i)=>{const before=this.points[Math.max(0,i-1)],after=this.points[Math.min(this.points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1,offset=(color-3)*r*.2,x=p.x-dy/len*offset,y=p.y+dx/len*offset;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.globalAlpha=.7;ctx.strokeStyle=COLORS[color];ctx.lineWidth=Math.max(2,r*.23);ctx.shadowColor=COLORS[color];ctx.shadowBlur=9;ctx.stroke();
    }
    ctx.restore();
  }
}
