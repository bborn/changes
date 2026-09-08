import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
export const TYPING_KEYS = ['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l'];
const Context = createContext({enabled:false,base:60,pressed:[]});
export const useMusicalTyping = () => useContext(Context);
export function MusicalTypingProvider({instrument,onPlay,children}) {
  const [enabled,setEnabled] = useState(false), [base,setBase] = useState(60), [pressed,setPressed] = useState([]);
  const play = useRef(onPlay); play.current = onPlay;
  useEffect(() => {
    setPressed([]);
    if (!enabled || instrument !== 'piano') return;
    const down = e => {
      if(e.repeat || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const key = e.key.toLowerCase(), index = TYPING_KEYS.indexOf(key);
      if(key==='z'||key==='x'){e.preventDefault();setBase(b=>Math.max(24,Math.min(84,b+(key==='z'?-12:12))));return;}
      if(index<0) return;
      e.preventDefault();setPressed(p=>[...new Set([...p,base+index])]);play.current([base+index]);
    };
    const up = e => {const i=TYPING_KEYS.indexOf(e.key.toLowerCase());if(i>=0)setPressed(p=>p.filter(n=>n!==base+i));};
    const clear = () => setPressed([]);
    document.addEventListener('keydown',down);document.addEventListener('keyup',up);window.addEventListener('blur',clear);
    return ()=>{document.removeEventListener('keydown',down);document.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
  },[enabled,instrument,base]);
  return <Context.Provider value={{enabled:enabled&&instrument==='piano',setEnabled,base,pressed}}>{children}</Context.Provider>;
}
export function MusicalTypingControl(){
  const {enabled,setEnabled,base}=useMusicalTyping();
  return <div className="musical-typing-control"><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Musical typing</label>{enabled&&<small>A–L · C{Math.floor(base/12)-1} · Z / X octave</small>}</div>;
}
