// Cosmetic only: never reads or changes game velocity, collision rules or scores.
export const SHOT_STYLES = ['afterimage','laser','lightning','flame','comet','rainbow','stars','rings','comic','helix','ice','smoke','confetti'];
export const SHOT_NAMES = ['残像ラッシュ','レーザーショット','サンダーボルト','フレイムショット','流星コメット','レインボー','スターダスト','ソニックリング','コミックインク','ツインスパイラル','アイスシャード','スモークジェット','コミック紙吹雪'];
export const LASER_STYLES = ['laser','lightning','rainbow','helix'];
const PALETTES=[['#4cffff','#438dff'],['#ff76ec','#8f60ff'],['#ffec69','#ff7637'],['#a3ff71','#26dbd2'],['#ffd7fb','#ff4e91']];
function stroke(ctx,points,color,width,alpha=1){
  if(points.length<2)return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap=ctx.lineJoin='round';ctx.stroke();
}
function ring(ctx,x,y,r,color,width=2){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function star(ctx,x,y,r,rotation,color){
  ctx.beginPath();for(let i=0;i<10;i++){const a=rotation+i*Math.PI/5,l=i%2?r*.4:r;const px=x+Math.cos(a)*l,py=y+Math.sin(a)*l;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#182d4b';ctx.lineWidth=1.5;ctx.stroke();
}
export class ShotEffects {
  constructor(random=Math.random){this.random=random;this.last=-1;this.reset();}
  reset(){this.points=[];this.shot=null;}
  trigger(x,y,grade,now){
    const pool=SHOT_STYLES.map((kind,index)=>({kind,index})).filter(s=>grade||!LASER_STYLES.includes(s.kind)),previous=pool.findIndex(s=>s.index===this.last);
    const slot=previous<0?Math.floor(this.random()*pool.length):(previous+1+Math.floor(this.random()*(pool.length-1)))%pool.length,index=pool[slot].index;
    this.last=index;
    this.shot={index,kind:SHOT_STYLES[index],colors:PALETTES[Math.floor(this.random()*PALETTES.length)],
      power:({COOL:1.15,DRIVE:1.4,SMASH:1.7})[grade]||1,at:now,x,y};
    this.points=[];return SHOT_NAMES[index];
  }
  draw(ctx,puck,r,now,active=true){
    if(!active){this.reset();return;}
    const last=this.points.at(-1);
    if(!last||Math.hypot(last.x-puck.x,last.y-puck.y)>1||now-last.at>35)this.points.push({x:puck.x,y:puck.y,at:now});
    this.points=this.points.filter(p=>now-p.at<680).slice(-90);
    const shot=this.shot,points=this.points;
    if(!shot||now-shot.at>4200||points.length<2)return;
    const age=now-shot.at,fade=Math.min(1,(4200-age)/500),power=shot.power,[color,secondary]=shot.colors;
    ctx.save();ctx.lineCap=ctx.lineJoin='round';
    // A dark under-stroke keeps neon readable on sunny as well as dark stages.
    stroke(ctx,points,'#18213e',r*.8,.25*fade);
    switch(shot.kind){
      case 'afterimage':
        for(let i=0;i<points.length;i+=Math.max(1,Math.floor(points.length/12))){
          const p=points[i],t=1-(now-p.at)/680;ctx.globalAlpha=t*.65*fade;
          ctx.save();ctx.translate(p.x,p.y);ctx.scale(1.3, .85);ctx.beginPath();ctx.arc(0,0,r*(.8+t*.55)*power,0,Math.PI*2);ctx.fillStyle=i%2?secondary:color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.restore();
        }break;
      case 'laser':
        stroke(ctx,points,secondary,r*1.65*power,.16*fade);stroke(ctx,points,color,r*.8*power,.55*fade);
        ctx.shadowColor=color;ctx.shadowBlur=18;stroke(ctx,points,'#fff',Math.max(3,r*.16),.95*fade);ctx.shadowBlur=0;break;
      case 'lightning':{
        const bolts=points.map((p,i)=>({x:p.x+(i%2?1:-1)*Math.sin(i*3.7+Math.floor(now/65))*12*power,y:p.y+(i%2?1:-1)*15*power}));
        stroke(ctx,bolts,secondary,14*power,.3*fade);stroke(ctx,bolts,color,5*power,.9*fade);stroke(ctx,bolts,'#fff',1.6,.95*fade);break;}
      case 'flame':
        for(let i=0;i<points.length-1;i+=3){const p=points[i],next=points[i+1],t=1-(now-p.at)/680,a=Math.atan2(next.y-p.y,next.x-p.x),length=(r*3+22)*t*power;
          ctx.save();ctx.globalAlpha=t*.8*fade;ctx.translate(p.x,p.y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(r*.4,0);ctx.quadraticCurveTo(-length*.3,-r*t*power,-length,-Math.sin(i)*r*.6);ctx.quadraticCurveTo(-length*.4,r*t*power,r*.4,0);ctx.fillStyle=i%2?'#ff5c30':'#ffb52e';ctx.fill();ctx.restore();
        }stroke(ctx,points,'#fff1a8',r*.35,.8*fade);break;
      case 'comet':{
        const tail=points[0],head=points.at(-1),angle=Math.atan2(head.y-tail.y,head.x-tail.x),nx=-Math.sin(angle),ny=Math.cos(angle),width=r*1.3*power;
        const gradient=ctx.createLinearGradient(tail.x,tail.y,head.x,head.y);gradient.addColorStop(0,'#ffffff00');gradient.addColorStop(.65,secondary);gradient.addColorStop(1,'#fff9c8');
        ctx.globalAlpha=.8*fade;ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x+nx*width,head.y+ny*width);ctx.quadraticCurveTo(head.x+Math.cos(angle)*r*2,head.y+Math.sin(angle)*r*2,head.x-nx*width,head.y-ny*width);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();break;}
      case 'rainbow':{
        const colors=['#ff508a','#ffab43','#fff078','#71fa9d','#5ce0ff','#a288ff'];
        colors.forEach((c,k)=>{const shifted=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],angle=Math.atan2(b.y-a.y,b.x-a.x),offset=(k-2.5)*5*power;return{x:p.x-Math.sin(angle)*offset,y:p.y+Math.cos(angle)*offset};});stroke(ctx,shifted,c,5*power,.65*fade);});break;}
      case 'stars':
        stroke(ctx,points,color,5*power,.4*fade);
        for(let i=0;i<points.length;i+=4){const p=points[i],t=(now-p.at)/680;ctx.globalAlpha=(1-t)*fade;star(ctx,p.x+Math.sin(i*2)*t*35,p.y+Math.cos(i*3)*t*35,(7+(i%3)*4)*power*(1-t*.5),now/300+i,i%2?color:secondary);}break;
      case 'rings':
        stroke(ctx,points,color,3,.5*fade);
        for(let i=0;i<points.length;i+=5){const p=points[i],t=(now-p.at)/680;ctx.globalAlpha=(1-t)*fade;ring(ctx,p.x,p.y,(r*.4+t*r*2.6)*power,color,3);ring(ctx,p.x,p.y,(r*.4+t*r*2.6)*power+5,'#ffffffaa',1);}break;
      case 'comic':
        stroke(ctx,points,'#111b35',r*1.1*power,.75*fade);stroke(ctx,points,'#ffe25e',r*.62*power,.9*fade);
        for(let i=0;i<points.length;i+=5){const p=points[i],t=1-(now-p.at)/680;ctx.globalAlpha=t*fade;star(ctx,p.x+Math.sin(i)*r,p.y+Math.cos(i)*r,r*.65*power,now/350+i,i%2?'#ff66ce':'#ffdd4b');}break;
      case 'helix':
        for(let strand=0;strand<2;strand++){const wave=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],angle=Math.atan2(b.y-a.y,b.x-a.x),offset=Math.sin(i*.7-now/85+strand*Math.PI)*r*power;return{x:p.x-Math.sin(angle)*offset,y:p.y+Math.cos(angle)*offset};});stroke(ctx,wave,strand?secondary:color,6*power,.8*fade);stroke(ctx,wave,'#ffffffaa',1.5,.8*fade);}break;
      case 'ice':
        stroke(ctx,points,'#cbf7ff',r*.45,.55*fade);
        for(let i=0;i<points.length;i+=3){const p=points[i],t=(now-p.at)/680;ctx.save();ctx.globalAlpha=(1-t)*.8*fade;ctx.translate(p.x+Math.sin(i)*t*30,p.y+Math.cos(i)*t*30);ctx.rotate(i+now/700);const size=(r*.7+6)*power;ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size*.4,-size*.35);ctx.lineTo(size,size*.3);ctx.closePath();ctx.fillStyle=i%2?'#adf1ff':'#fff';ctx.fill();ctx.strokeStyle='#4699d8';ctx.lineWidth=1;ctx.stroke();ctx.restore();}break;
      case 'smoke':
        for(let i=0;i<points.length;i+=4){const p=points[i],t=(now-p.at)/680;ctx.globalAlpha=(1-t)*.35*fade;ctx.beginPath();ctx.arc(p.x+Math.sin(i)*t*16,p.y+Math.cos(i)*t*16,(r*.4+t*r*1.4)*power,0,Math.PI*2);ctx.fillStyle=i%2?'#edfcff':color;ctx.fill();}break;
      case 'confetti':
        stroke(ctx,points,color,3,.6*fade);
        for(let i=0;i<points.length;i+=3){const p=points[i],t=(now-p.at)/680;ctx.save();ctx.globalAlpha=(1-t)*fade;ctx.translate(p.x+Math.sin(i*7)*t*38,p.y+Math.cos(i*5)*t*38);ctx.rotate(now/170+i);ctx.fillStyle=['#ffe26b','#ff80b8','#80f7ff','#a8ff8b'][i%4];ctx.fillRect(-3*power,-8*power,6*power,16*power);ctx.restore();}break;
    }
    // Local comic impact flare rather than a full-screen flash.
    if(age<380){const t=age/380;ctx.globalAlpha=(1-t)*.85;ring(ctx,shot.x,shot.y,r+(t*65+8)*power,color,5*(1-t)+1);
      for(let i=0;i<12;i++){const a=i*Math.PI/6,l=(r+15+t*75)*power;stroke(ctx,[{x:shot.x+Math.cos(a)*l*.6,y:shot.y+Math.sin(a)*l*.6},{x:shot.x+Math.cos(a)*l,y:shot.y+Math.sin(a)*l}],i%2?color:'#fff',3,(1-t)*fade);}
    }
    ctx.restore();
  }
}
