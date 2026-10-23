// Add/remove entries here to change both the release keys and the on-screen hint.
export const MOUSE_RELEASE_KEYS = Object.freeze([
  {code:'Escape',label:'Esc'},
  {code:'Space',label:'スペース'},
  {code:'Backspace',label:'Backspace'},
  {code:'Enter',label:'Enter'},
  {code:'NumpadEnter',label:'Enter'},
]);
export const MOUSE_RELEASE_HINT = [...new Set(MOUSE_RELEASE_KEYS.map(key=>key.label)),'右クリック'].join(' / ')+'でマウス解除';
export function handleMouseReleaseKey(event,locked,release){
  if(!locked||event.isComposing||!MOUSE_RELEASE_KEYS.some(key=>key.code===event.code))return false;
  event.preventDefault();
  event.stopPropagation();
  release();
  return true;
}
