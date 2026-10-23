// Five straight laser variants; v0.7 laser drawing remains untouched.
export const LASER_VARIANTS=[
  {id:'laser-azure',name:'アズール・レーザー',color:'#17cfff',core:'#f0ffff'},
  {id:'laser-crimson',name:'クリムゾン・レーザー',color:'#ff284b',core:'#fff2d4'},
  {id:'laser-gold',name:'ゴールド・パルス',color:'#ffb900',core:'#ffffed'},
  {id:'laser-violet',name:'バイオレット・ツイン',color:'#ad5cff',core:'#ffe9ff'},
  {id:'laser-mint',name:'ミント・フォトン',color:'#38ffc4',core:'#effff8'},
];
export const EXTRA_LASER_STYLES=LASER_VARIANTS.map(style=>style.id);
export function drawLaserVariant(fx,ctx,puck,r,now,active=true){
  if(!active){fx.reset();return;}
  const previous=fx.points.at(-1);
  if(!previous||Math.hypot(previous.x-puck.x,previous.y-puck.y)>1||now-previous.at>35)fx.points.push({x:puck.x,y:puck.y,at:now});
  fx.points=fx.points.filter(point=>now-point.at<680).slice(-90);
  const shot=fx.shot,style=LASER_VARIANTS.find(style=>style.id===shot?.kind),points=fx.points;
  if(!style||now-shot.at>4200||points.length<2)return;
  const fade=Math.min(1,(4200-(now-shot.at))/500),power=shot.power;
  const stroke=(width,color,alpha,offset=0)=>{
    ctx.beginPath();for(let i=0;i<points.length;i++){
      const p=points[i],next=points[Math.min(i+1,points.length-1)],prev=points[Math.max(0,i-1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;
      const x=p.x-dy/len*offset,y=p.y+dx/len*offset;i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.globalAlpha=alpha*fade;ctx.stroke();
  };
  ctx.save();ctx.lineCap=ctx.lineJoin='round';ctx.shadowColor=style.color;ctx.shadowBlur=18*power;
  const pulse=style.id==='laser-gold'?.72+.28*Math.sin((now-shot.at)/65):1;
  stroke(r*1.15*power,style.color,.16*pulse);stroke(8*power,style.color,.88*pulse);
  if(style.id==='laser-violet'){
    stroke(2.2*power,style.core,.95,-4*power);stroke(2.2*power,style.core,.95,4*power);
  }else{
    stroke(2.8*power,style.core,1);
    if(style.id==='laser-crimson'){ctx.shadowBlur=0;stroke(1,'#ff657b',.8,6*power);stroke(1,'#ff657b',.8,-6*power);}
    if(style.id==='laser-mint'){ctx.setLineDash([12,18]);ctx.lineDashOffset=-(now-shot.at)/7;stroke(5*power,'#ffffff',.9);}
  }
  ctx.restore();
}
