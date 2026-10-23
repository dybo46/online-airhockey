import {ShotEffects,SHOT_STYLES,LASER_STYLES} from './effects.js';
import {EXTRA_SHOT_STYLES,EXTRA_SHOT_NAMES,drawExtraShot} from './effects-extra.js';
import {RainbowSmash} from './rainbow-smash.js';
import {LASER_VARIANTS,EXTRA_LASER_STYLES,drawLaserVariant} from './laser-variants.js';
export const ALL_SHOT_STYLES=[...SHOT_STYLES,...EXTRA_SHOT_STYLES,...EXTRA_LASER_STYLES];
const ALL_EXTRA_NAMES=[...EXTRA_SHOT_NAMES,...LASER_VARIANTS.map(style=>style.name)];

// Selection only. The approved v0.7 renderer stays byte-for-byte unchanged.
export class BiasedStylePicker {
  constructor(random=Math.random){this.random=random;this.last=-1;this.resetBias();}
  resetBias(){this.groups={};}
  pick(grade){
    const powered=!!grade,key=powered?'powered':'normal';
    const pool=ALL_SHOT_STYLES.map((kind,index)=>({kind,index})).filter(s=>powered||(!LASER_STYLES.includes(s.kind)&&!EXTRA_LASER_STYLES.includes(s.kind)));
    let bias=this.groups[key];
    if(!bias||bias.remaining<=0){
      const favorite=Math.floor(this.random()*pool.length);
      const second=(favorite+1+Math.floor(this.random()*(pool.length-1)))%pool.length;
      bias=this.groups[key]={favorite:pool[favorite].index,second:pool[second].index,remaining:3+Math.floor(this.random()*8)};
    }
    bias.remaining--;
    const weighted=pool.filter(s=>!powered||s.index!==this.last).map(s=>({
      index:s.index,
      weight:(s.index===bias.favorite?5:s.index===bias.second?2.4:1)*(!powered&&s.index===this.last?4:1),
    }));
    let ticket=this.random()*weighted.reduce((sum,s)=>sum+s.weight,0);
    let chosen=weighted.at(-1).index;
    for(const item of weighted){ticket-=item.weight;if(ticket<0){chosen=item.index;break;}}
    this.last=chosen;return chosen;
  }
}

export class BiasedShotEffects extends ShotEffects {
  constructor(random=Math.random){super(random);this.picker=new BiasedStylePicker(random);this.rainbow=new RainbowSmash(random);}
  reset(){super.reset();this.picker?.resetBias();this.rainbow?.clear();}
  trigger(x,y,grade,now){
    this.rainbow.hit(grade);
    const index=this.picker.pick(grade);
    const pool=SHOT_STYLES.map((kind,index)=>({kind,index})).filter(s=>grade||!LASER_STYLES.includes(s.kind));
    const slot=Math.max(0,pool.findIndex(s=>s.index===index)),originalRandom=this.random;
    let first=true;
    // Ask the original trigger to render the chosen slot, including its original
    // palette and power logic. It must not apply its old no-repeat draw a second time.
    this.last=-1;
    this.random=()=>{if(first){first=false;return (slot+.5)/pool.length;}return originalRandom();};
    try{
      const name=super.trigger(x,y,grade,now);
      if(index>=SHOT_STYLES.length){this.last=index;this.shot.index=index;this.shot.kind=ALL_SHOT_STYLES[index];return ALL_EXTRA_NAMES[index-SHOT_STYLES.length];}
      return name;
    }finally{this.random=originalRandom;}
  }
  draw(ctx,puck,r,now,active=true){
    if(this.shot&&EXTRA_LASER_STYLES.includes(this.shot.kind))drawLaserVariant(this,ctx,puck,r,now,active);
    else if(this.shot&&this.shot.index>=SHOT_STYLES.length)drawExtraShot(this,ctx,puck,r,now,active);
    else super.draw(ctx,puck,r,now,active);
    if(active)this.rainbow.drawTrail(ctx,puck,r,now);
  }
}
