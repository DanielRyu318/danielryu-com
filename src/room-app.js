import { createAudio } from './audio.js';
import { icon } from './icons.js';
import { STATION_IDS } from './room-layout.js';

const $=s=>document.querySelector(s);
const canvas=$('#room-view'),room=$('#room'),guide=$('#guide-panel'),cue=$('#cue'),hover=$('#hover');
const audio=createAudio(), reduced=matchMedia('(prefers-reduced-motion:reduce)');
const destinations=new Set(['table',...STATION_IDS]);
const labels={launch:'Pull the ball',start:'Start a ball',projects:'Projects · desk',experience:'Experience · archive',education:'Education & credentials',contact:'Contact',resume:'Résumé',reader:'Collect a record','resume-pdf':'Open résumé PDF','play-mode':'Stay and play','explore-mode':'Explore the room',score:'Session score',deposit:'Add $500 deposit',fidelity:'Fidelity',nobe:'NOBE',katusa:'KATUSA'};
let view,game,frame=0,last=0,awakeUntil=0,station='table',soundOn=false,drag=null,spaceStart=0,cueTimer;
let fallback=null, lastRoll=null, lastPullSound=0;
const keys=new Map();
const actionButtons=new Map();
const atSpring=()=>game && ['ready','station'].includes(game.state.mode);
const isSpringAction=id=>id==='launch'||Boolean(id?.startsWith('return-'));
const charging=()=>game && ['pulling','station-pulling'].includes(game.state.mode);
const hashStation=()=>{const id=location.hash.slice(1).split('/')[0];return destinations.has(id)?id:'table';};
function announce(text){$('#live').textContent=text;}
function showCue(text, duration=4200){
  clearTimeout(cueTimer);cue.textContent=text;cue.hidden=!text;
  if(text&&duration)cueTimer=setTimeout(()=>{cue.hidden=true;},duration);
}
function soundUI(){
  const button=$('#sound');button.innerHTML=icon(soundOn?'sound':'muted');
  button.setAttribute('aria-pressed',String(soundOn));button.setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');
  button.title=soundOn?'Mute sound':'Enable sound';
}
try{soundOn=localStorage.getItem('pw-sound')==='on';}catch{}
soundUI();
$('#sound').addEventListener('click',async()=>{
  soundOn=await audio.enable(!soundOn);soundUI();
  try{localStorage.setItem('pw-sound',soundOn?'on':'off');}catch{}
  if(soundOn)audio.play('arrive',.5);
});
const unlock=e=>{if(soundOn&&!$('#sound').contains(e.target))audio.enable(true);};
document.addEventListener('pointerdown',unlock,{once:true});
document.addEventListener('keydown',unlock,{once:true});
function actions(){
  if(!game||game.state.mode==='travel')return [];
  if(station!=='table')return view.stations.getControls().map(c=>c.action);
  const ids=[...STATION_IDS,'reader','resume-pdf','play-mode','explore-mode','score'];
  if(['ready','pulling'].includes(game.state.mode))ids.unshift('launch');
  if(['ready','paused'].includes(game.state.mode))ids.push('start');
  return ids;
}
function controlLabel(id){
  return view?.stations.getControls().find(c=>c.action===id)?.label||labels[id];
}
function syncFocus(){
  const available=actions();
  for(const id of available){
    let b=actionButtons.get(id);
    if(!b){
      b=document.createElement('button');b.type='button';b.className='world-focus';b.dataset.action=id;
      b.addEventListener('click',()=>act(id));room.append(b);actionButtons.set(id,b);
    }
    b.textContent=controlLabel(id);
    const p=view.position(id);b.hidden=!p?.visible;
    if(p?.visible){b.style.left=p.x+'px';b.style.top=p.y+'px';}
  }
  for(const [id,b] of actionButtons)if(!available.includes(id))b.hidden=true;
}
function ui(){
  if(!game||!view)return;
  const s=game.state;
  $('#back').hidden=station==='table'&&s.mode!=='travel';
  $('#resume').hidden=s.mode!=='paused';
  $('#touch-paddles').hidden=station!=='table'||s.mode==='travel';
  const choices=view.stations.getControls();
  if(station==='table')choices.push({action:'launch',label:'Launch a ball'},{action:s.explore?'play-mode':'explore-mode',label:s.explore?'Set to free play':'Set to explore'});
  $('#guide-actions').replaceChildren(...choices.map(c=>{
    const b=document.createElement('button');b.type='button';b.textContent=c.label;
    if(typeof c.pressed==='boolean')b.setAttribute('aria-pressed',String(c.pressed));
    b.addEventListener('click',()=>{guide.close();act(c.action);});return b;
  }));
  $('#guide-description').textContent=view.stations.getSummary()||'Drag the steel ball toward you, then release. Select a named entrance to travel. The brass lever switches between exploring the room and playing for points.';
  syncFocus();
}
function wake(ms=250) {
  awakeUntil=Math.max(awakeUntil,performance.now()+ms);
  if(!frame&&view&&game&&!document.hidden)frame=requestAnimationFrame(tick);
}
function tick(now){
  frame=0;if(document.hidden||!view||!game)return;
  const dt=Math.min(.05,(now-(last||now))/1000);last=now;
  if(spaceStart)game.setPull(Math.min(1,(now-spaceStart)/660));
  game.update(dt);
  const s=game.state;
  if(soundOn && lastRoll && dt>0 && ['playing','travel'].includes(s.mode)){
    const speed=Math.hypot(s.ball.x-lastRoll.x,s.ball.y-lastRoll.y,s.ball.z-lastRoll.z)/dt;
    audio.roll(speed,Math.max(-1,Math.min(1,s.ball.x/1.8)),s.mode==='travel');
  }else audio.roll(0);
  lastRoll={...s.ball};
  view.draw(s);
  if(s.mode!=='travel')syncFocus();
  if(now<awakeUntil||['playing','travel','pulling','station-pulling'].includes(s.mode))frame=requestAnimationFrame(tick);
  else last=0;
}
function storeRoute(id,replace=false){
  if(hashStation()!==id){
    history[replace?'replaceState':'pushState'](null,'',id==='table'?'#table':'#'+id);
  }
}
function onEvent(e){
  if(e.type==='sound'){audio.play(e.name,e.strength);return;}
  if(e.type==='arrive'){
    if(!game||!view)return;
    station=game.state.station||'table';
    const summary=view.stations.setStation(station);
    storeRoute(station);
    const cueText={projects:'Try the deposit on the monitor.',experience:'Select a job card.',education:'Press Actuarial exams to read the credentials.',resume:'Use the PDF key to open the résumé.',contact:'Choose a contact key.'};
    showCue(cueText[station]||(game.state.mode==='paused'?'Your ball is waiting.':game.state.mode==='playing'?'Ball in play · Use the flippers.':'Drag the ball back to launch.'),3500);
    announce(summary||'At the flippers.');ui();wake();return;
  }
  if(e.type==='state'&&view&&game){
    if(e.mode==='travel'){hover.hidden=true;showCue('');}
    if(e.mode==='playing'){showCue('');}
    if(e.mode==='ready'&&e.stats?.drains){showCue('Ball returned. Pull to play again.');}
    ui();wake();
  }
  if(e.type==='hit'&&!game?.state.explore)showCue(labels[e.station]+' lit. Select its entrance to visit.',2500);
  if(e.type==='reader-select'){
    showCue(labels[e.station]+' lit · Shoot the collector.',2800);
    announce(labels[e.station]+' selected for the record reader.');
  }
  if(e.type==='secret'){showCue('All three bells lit!',2000);}
}
async function goto(id,{instant=false,historyChange=false}={}){
  if(!destinations.has(id))return;
  if(fallback){storeRoute(id);fallback(id);return;}
  if(!game||!view)return;
  if(guide.open)guide.close();
  if(id===game.state.station&&!game.state.travel)return;
  if(charging())game.cancelPull();
  drag=null;spaceStart=0;hover.hidden=true;canvas.style.cursor='default';
  if(!historyChange)storeRoute(id);
  const done=game.goTo(id,{instant:instant||reduced.matches});wake(800);
  await done;
}
function act(id){
  if(!game||!view)return;
  if(id==='resume-pdf'){window.open('/daniel-ryu-resume.pdf','_blank','noopener');return;}
  if(id==='reader'){goto(game.state.readerPage||'education');return;}
  if(isSpringAction(id)||id==='start'){
    if((id==='launch'||id==='start')&&game.state.mode==='paused')game.resume();
    else if(atSpring()){game.setPull(.72);game.release({instant:reduced.matches});}
    wake();return;
  }
  if(id==='play-mode'||id==='explore-mode'){
    const explore=id==='explore-mode';game.setExplore(explore);audio.play('gate');
    showCue(explore?'Explore · A clean destination shot leaves the table.':'Play · Your ball stays on the table.');
    ui();wake();return;
  }
  if(id==='score'){showCue('Score '+game.state.score+'   ·   Balls launched '+game.state.stats.launches);return;}
  const result=view.stations.activate(id);
  if(result){
    if(result.url){
      if(result.url.startsWith('mailto:'))location.href=result.url;
      else window.open(result.url,'_blank','noopener');
    }
    audio.play(result.sound);announce(result.announcement);
    if(result.navigate)goto(result.navigate);
    ui();wake(350);return;
  }
  if(destinations.has(id))goto(id);
}
function at(e){const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];}
canvas.addEventListener('pointerdown',e=>{
  if(!game||!e.isPrimary||e.button!==0)return;
  canvas.focus({preventScroll:true});const [x,y]=at(e);const action=view.pick(x,y,actions());
  drag={id:e.pointerId,x,y,action,max:0};canvas.setPointerCapture(e.pointerId);
  if(isSpringAction(action) && atSpring()){
    game.setPull(0);drag.spring=true;drag.axis=view.pullVector(action);canvas.style.cursor='grabbing';
    showCue('Release to launch.',0);hover.hidden=true;wake();
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!game||!view)return;
  const [x,y]=at(e);
  if(drag&&drag.id===e.pointerId){
    const dx=x-drag.x,dy=y-drag.y;drag.max=Math.max(drag.max,Math.hypot(dx,dy));
    if(drag.spring){
      const axis=drag.axis,len=Math.max(20,Math.hypot(axis.x,axis.y));
      const amount=Math.min(1,Math.max(0,(dx*axis.x+dy*axis.y)/(len*len)));
      game.setPull(amount);
      if(Math.abs(amount-lastPullSound)>.18){audio.play('spring',amount);lastPullSound=amount;}
      wake();
    }return;
  }
  if(e.pointerType==='touch')return;
  const id=view.pick(x,y,actions());canvas.style.cursor=id?(isSpringAction(id)?'grab':'pointer'):'default';
  hover.hidden=!id;if(id){
    hover.textContent=controlLabel(id);hover.style.left=Math.min(x+12,innerWidth-120)+'px';
    hover.style.top=Math.max(4,y-32)+'px';
  }
});
function endDrag(e,cancel=false){
  if(!drag||drag.id!==e.pointerId)return;
  const pending=drag;drag=null;
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(pending.spring){
    if(cancel||game.state.pull<.035){
      game.cancelPull();
      showCue(pending.action==='launch'?'Hold the steel ball, drag back, then release.':'Pull the handle away from the cup and release.');
    }else game.release({instant:reduced.matches});
    lastPullSound=0;canvas.style.cursor='grab';
  }else if(!cancel&&pending.max<12&&pending.action)act(pending.action);
  wake();
}
canvas.addEventListener('pointerup',e=>endDrag(e));
canvas.addEventListener('pointercancel',e=>endDrag(e,true));
canvas.addEventListener('lostpointercapture',e=>endDrag(e,true));
canvas.addEventListener('pointerleave',()=>{hover.hidden=true;});
for(const b of document.querySelectorAll('[data-side]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);game?.flip(b.dataset.side,true);wake();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{game?.flip(b.dataset.side,false);wake();});
}
function key(e,down){
  if(!game||guide.open||e.ctrlKey||e.altKey||e.metaKey)return;
  if(e.key==='Escape'&&down){goto('table');return;}
  if(game.state.mode==='travel')return;
  if(e.code==='Space'){
    if(e.target.closest('button,a'))return;
    e.preventDefault();
    if(down&&!e.repeat&&atSpring()){spaceStart=performance.now();game.setPull(0);}
    if(!down&&spaceStart){spaceStart=0;game.release({instant:reduced.matches});}
  }else if(station==='table'&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){
    e.preventDefault();const side=e.code==='ArrowLeft'?'left':'right';keys.set(side,down);game.flip(side,down);
  }
  wake(300);
}
document.addEventListener('keydown',e=>key(e,true));document.addEventListener('keyup',e=>key(e,false));
function cancelControls(){for(const side of keys.keys())game?.flip(side,false);keys.clear();spaceStart=0;if(charging())game.cancelPull();drag=null;audio.roll(0);}
window.addEventListener('blur',cancelControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelControls();last=0;}else wake();});
$('#guide').addEventListener('click',()=>{cancelControls();ui();guide.showModal();});
$('#back').addEventListener('click',()=>goto('table'));
$('#resume').addEventListener('click',()=>{game?.resume();wake();});
for(const b of document.querySelectorAll('[data-route]'))b.addEventListener('click',()=>{guide.close();goto(b.dataset.route);});
window.addEventListener('hashchange',()=>goto(hashStation(),{historyChange:true}));
window.addEventListener('resize',()=>{view?.measure();wake();});

async function showFallback(err){
  console.warn('The interactive room is unavailable.',err);
  $('#loading').hidden=true;canvas.hidden=true;
  const {renderStation}=await import('./stations.js');
  const wrap=document.createElement('section');wrap.className='fallback';room.append(wrap);
  let teardown;
  fallback=id=>{
    teardown?.();wrap.replaceChildren();
    if(id==='table'){
      wrap.innerHTML='<h2>Daniel Ryu’s workshop</h2><p>The 3D room is unavailable in this browser. Explore the portfolio here.</p>';
      for(const id of STATION_IDS){
        const button=document.createElement('button');
        button.textContent=labels[id];button.onclick=()=>goto(id);wrap.append(button);
      }
    }else{
      const home=document.createElement('button');home.textContent='← Workshop';home.onclick=()=>goto('table');wrap.append(home);
      const section=document.createElement('div');wrap.append(section);
      teardown=renderStation(section,id,{navigate:x=>goto(destinations.has(x)?x:'table')});
    }
  };fallback(hashStation());
}
try{
  [view,game]=await Promise.all([
    import('./room-view.js').then(({createRoomView})=>createRoomView(canvas)),
    import('./room-physics.js').then(({createRoomPhysics})=>createRoomPhysics({onEvent}))
  ]);
  game.setExplore(true);$('#loading').hidden=true;
  const id=hashStation();
  if(id!=='table')await goto(id,{instant:true,historyChange:true});
  view.draw(game.state);ui();wake(300);
  if(id==='table')showCue('Drag the steel ball back, then release.',6500);
}catch(err){showFallback(err);}
