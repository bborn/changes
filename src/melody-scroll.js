// Three identical choruses give the middle copy matching content above and below.
export function followMelody(root,key,{playing}) {
 const chart=root.querySelector('.melody-chart');if(!chart)return;
 const cycles=[...chart.querySelectorAll('[data-melody-cycle]')];if(cycles.length!==3)return;
 const keys=[...cycles[1].querySelectorAll('[data-bar]')].map(el=>el.dataset.bar);
 const index=keys.indexOf(key);if(index<0)return;
 const previous=chart.dataset.followKey;
 if(previous===key)return;
 const first=!previous,wrapped=previous===keys.at(-1)&&index===0;
 chart.dataset.followKey=key;
 if(first)chart.dataset.cycle='1';
 if(wrapped&&playing)chart.dataset.cycle='2';
 const cycle=cycles[Number(chart.dataset.cycle)||1];
 const bars=[...cycle.querySelectorAll('[data-bar]')],bar=bars[index];
 const rect=bar.getBoundingClientRect(),next=bars[index+1]?.getBoundingClientRect();
 const bottom=Math.min(innerHeight,root.querySelector('.transport')?.getBoundingClientRect().top??innerHeight)-16;
 const smooth=playing&&!first&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(first||wrapped||rect.top<16||Math.max(rect.bottom,next?.bottom??0)>bottom)window.scrollBy({top:rect.top-24,behavior:smooth?'smooth':'instant'});
 if(wrapped&&playing){
  const reset=()=>{clearTimeout(timer);window.removeEventListener('scrollend',reset);if(!chart.isConnected||chart.dataset.cycle!=='2')return;
   const delta=cycles[2].getBoundingClientRect().top-cycles[1].getBoundingClientRect().top;
   chart.dataset.cycle='1';window.scrollBy({top:-delta,behavior:'instant'});
  };
  const timer=setTimeout(reset,smooth?600:0);window.addEventListener('scrollend',reset,{once:true});
 }
}
