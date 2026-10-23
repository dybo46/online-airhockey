// Settings and participant cookie stay in the same browser; only one page controls.
const ACTIVE_KEY='online-airhockey.demo.activeGameWindow',SUSPENDED_KEY='online-airhockey.demo.windowSuspended';
export function setupGameWindow({button,notify,suspend}){
  const id=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,origin=location.origin,params=new URL(location.href).searchParams,isPopup=params.get('gameWindow')==='1',transfer=params.get('transfer')||'direct';
  let popup=null,inactive=false,pending=false,resolveGrant;
  const overlay=document.createElement('section');overlay.id='windowHandoff';overlay.className='window-handoff';overlay.hidden=true;
  const card=document.createElement('div'),title=document.createElement('h2'),text=document.createElement('p'),back=document.createElement('button');
  title.textContent='ゲームは別のウィンドウで開いています';text.textContent='このページのゲーム操作と設定変更は停止中です。元ページは閉じても構いません。戻す場合は下のボタンを押してください。';back.textContent='このページで再開する';back.className='primary';
  back.onclick=()=>{sessionStorage.removeItem(SUSPENDED_KEY);location.reload();};card.append(title,text,back);overlay.append(card);document.body.append(overlay);
  async function park(){
    if(inactive)return;inactive=true;sessionStorage.setItem(SUSPENDED_KEY,'1');
    document.querySelector('main').inert=true;document.querySelector('header').inert=true;overlay.hidden=false;
    await suspend();
  }
  function claim(){sessionStorage.removeItem(SUSPENDED_KEY);localStorage.setItem(ACTIVE_KEY,id);}
  window.addEventListener('storage',event=>{if(event.key===ACTIVE_KEY&&event.newValue&&event.newValue!==id)void park();});
  window.addEventListener('message',async event=>{
    if(event.origin!==origin)return;
    if(event.data?.type==='airhockey-demo-popup-ready'&&event.source===popup){await park();popup.postMessage({type:'airhockey-demo-popup-granted'},origin);pending=false;}
    else if(event.data?.type==='airhockey-demo-popup-granted'&&event.source===window.opener)resolveGrant?.();
  });
  button.title='Chrome / Edgeの同じブラウザで別ウィンドウを開きます。設定・名前・勝利数は引き継ぎます。';
  if(isPopup){button.textContent='別ウィンドウ表示中';button.disabled=true;}
  button.onclick=()=>{
    if(pending)return;
    const next=new URL(location.href);next.searchParams.set('gameWindow','1');next.searchParams.set('transfer',`${Date.now()}-${Math.random()}`);
    popup=window.open(next.href,'online-airhockey-demo-game','popup=yes,width=1440,height=1000,resizable=yes,scrollbars=yes');
    if(!popup){notify('別ウィンドウがブロックされました。このサイトのポップアップを許可してください。');return;}
    pending=true;popup.focus();setTimeout(()=>{if(pending){pending=false;notify('別ウィンドウへの移動を確認できませんでした。元のページで続けられます。');}},10000);
  };
  return {async start(){
    if(isPopup&&window.opener&&sessionStorage.getItem('online-airhockey.demo.popupTransfer')!==transfer){
      let timer;const granted=await Promise.race([
        new Promise(resolve=>{resolveGrant=()=>resolve(true);window.opener.postMessage({type:'airhockey-demo-popup-ready'},origin);}),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(false),10000);}),
      ]);clearTimeout(timer);resolveGrant=null;
      if(!granted){await park();title.textContent='移動を確認できませんでした';text.textContent='元のページで続けるか、このウィンドウで再開してください。';sessionStorage.setItem('online-airhockey.demo.popupTransfer',transfer);return false;}
      sessionStorage.setItem('online-airhockey.demo.popupTransfer',transfer);sessionStorage.removeItem(SUSPENDED_KEY);
    }
    if(sessionStorage.getItem(SUSPENDED_KEY)){await park();return false;}
    claim();return true;
  }};
}
