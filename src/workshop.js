import * as THREE from 'three';
import { createPinball, TABLE } from './pinball.js';
import { deckPoint, makeModel } from './workshop-model.js';

const vec = (x,y,z) => new THREE.Vector3(x,y,z);
const viewpoints = {
  table: { direction: [8.6, 9.9, 12.5], zoom: 1 },
  projects: { direction: [3.9, 5.7, 10], zoom: 1.84 },
  experience: { direction: [-1.9, 6.2, 10], zoom: 1.70 },
  hobbies: { direction: [5.1, 9.2, 9.9], zoom: 1.66 },
  stats: { direction: [3.3, 3.6, 10.2], zoom: 1.70 },
};

function environmentMap() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,0,128);
  g.addColorStop(0,'#e4d4ad');g.addColorStop(.32,'#9fa596');g.addColorStop(.53,'#868c77');
  g.addColorStop(.60,'#3c4c3f');g.addColorStop(1,'#364035');
  c.fillStyle=g;c.fillRect(0,0,256,128);
  c.fillStyle='#fff6d5';c.fillRect(19,19,64,16);c.fillRect(166,39,28,12);
  c.fillStyle='#333f34';c.fillRect(115,32,22,32);c.fillRect(146,34,7,29);
  const tex=new THREE.CanvasTexture(canvas);tex.mapping=THREE.EquirectangularReflectionMapping;
  tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function softShadow(scene) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,6,64,64,63);
  g.addColorStop(0,'rgba(4,14,10,.68)');g.addColorStop(.58,'rgba(4,14,10,.54)');g.addColorStop(1,'rgba(4,14,10,0)');
  c.fillStyle=g;c.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(canvas);
  const material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});
  const geo=new THREE.PlaneGeometry(11,13),shadow=new THREE.Mesh(geo,material);
  shadow.position.set(.34,-.36,.43);shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  return () => {map.dispose();geo.dispose();material.dispose();};
}

export function createWorkshop(host, options = {}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x142c28,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.91;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  const canvas=renderer.domElement;
  canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',display:'block',width:'100%',height:'100%'});
  host.append(canvas);
  const scene=new THREE.Scene(), environment=environmentMap();
  scene.environment=environment;scene.environmentIntensity=.46;
  const sky=new THREE.HemisphereLight(0xffebce,0x799c8f,.86);
  const key=new THREE.DirectionalLight(0xffe2c6,2.23);
  key.position.set(-5,8,4);key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-6.4,right:6.4,top:7.2,bottom:-6,near:.5,far:28});
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.023;key.shadow.bias=-.00035;
  const rim=new THREE.DirectionalLight(0xffca93,1.29);rim.position.set(3,6,-6);
  scene.add(sky,key,rim);
  const removeShadow=softShadow(scene);
  const {deck,ball,bumpers,flippers,stationPoints,parking,travel,dispose:disposeModel,setScore}=makeModel(scene);
  const camera=new THREE.OrthographicCamera(-6,6,5,-5,.1,90);
  const cameraTarget=new THREE.Vector3(), cameraDir=vec(...viewpoints.table.direction).normalize();
  const homeTarget=vec(0,2,0), up=vec(0,1,0), homeDirection=cameraDir.clone();
  let viewHeight=10,aspect=1,selected='table',zoom=1,moving=null;
  let lastTime=0,frame=0,disposed=false,lastWidth=0,lastHeight=0;
  let pointerStart=null,hovered=null;
  const flashes=new Map(), seen=new Set();
  const listeners=new AbortController();
  const game=createPinball({onEvent(event){
    if(event.type==='hit'){
      flashes.set(event.station,.19);options.onHit?.(event.station);
    }else if(event.type==='score'){
      setScore?.(event.score);options.onScore?.(event.score,event.stats);
    }else if(event.type==='state')options.onState?.(event.mode,event.stats);
    else if(event.type==='sound')options.onSound?.(event.name,event.strength);
    else if(event.type==='secret')options.onSecret?.();
  }});
  const physicsPosition=()=>deckPoint(game.state.ball.x,game.state.ball.y,.046+TABLE.radius*2);
  ball.position.copy(physicsPosition());

  function setView() {
    const hh=viewHeight/(zoom*2);
    camera.left=-hh*aspect;camera.right=hh*aspect;
    camera.top=hh;camera.bottom=-hh;
    camera.position.copy(cameraTarget).addScaledVector(cameraDir,22);
    camera.lookAt(cameraTarget);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function frameHome() {
    const right=new THREE.Vector3().crossVectors(up,homeDirection).normalize();
    const vertical=new THREE.Vector3().crossVectors(homeDirection,right).normalize();
    const corners=[];
    // Fit the actual silhouette, leaving breathing room above the marquee and below the feet.
    for(const x of [-3.47,3.47])for(const z of [-4.34,4.65])corners.push(vec(x,-.36,z));
    for(const x of [-2.34,2.34])for(const z of [-3.95,-3.22])corners.push(vec(x,5.22,z));
    corners.push(vec(2.89,4.42,-3.18));
    const xs=corners.map(p=>p.dot(right)),ys=corners.map(p=>p.dot(vertical));
    const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
    homeTarget.copy(right).multiplyScalar((xmin+xmax)/2).addScaledVector(vertical,(ymin+ymax)/2)
      .addScaledVector(homeDirection,1.45);
    viewHeight=Math.max((xmax-xmin)/aspect,ymax-ymin)*1.12;
  }
  function targetFor(id){
    if(id==='table')return homeTarget.clone();
    const target=stationPoints[id].clone();
    // Keep the nearby machinery visible, so the route out remains legible at every stop.
    return target.lerp(homeTarget,.21);
  }
  function resize() {
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height||disposed)return;
    if(width!==lastWidth||height!==lastHeight){
      aspect=width/height;lastWidth=width;lastHeight=height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, width<540?1.55:1.8));
      renderer.setSize(width,height,false);frameHome();
      if(!moving)cameraTarget.copy(targetFor(selected));
      setView();renderer.render(scene,camera);
    }
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  cameraTarget.copy(homeTarget);resize();

  function track(from,to,id) {
    if(id==='projects')return new THREE.CatmullRomCurve3([from,vec(-1.68,.21,1.12),vec(-1.74,.49,-.52),vec(-1.62,.78,-1.50),vec(-1.4,.80,-2.13),to]);
    const mid=from.clone().lerp(to,.51);mid.y=Math.max(.54,from.y,to.y);
    mid.x+=id==='table'?.12:.22;
    return new THREE.CatmullRomCurve3([from,mid,to]);
  }
  function goTo(id,{instant=false}={}) {
    if(disposed||!Object.hasOwn(viewpoints,id))return Promise.resolve();
    if(moving){moving.resolve();moving=null;}
    const repeated=seen.has(id);seen.add(id);selected=id;game.pause();
    const end=targetFor(id),direction=vec(...viewpoints[id].direction).normalize();
    const dest=id==='table'?physicsPosition():parking[id].clone();
    if(instant||options.reducedMotion){
      cameraTarget.copy(end);cameraDir.copy(direction);zoom=viewpoints[id].zoom;
      ball.position.copy(dest);travel(id,1);setView();renderer.render(scene,camera);return Promise.resolve();
    }
    options.onSound?.('gate',.68);
    return new Promise(resolve=>{
      moving={resolve,start:performance.now(),duration:repeated?780:1340,
        fromTarget:cameraTarget.clone(),end,fromDirection:cameraDir.clone(),direction,
        fromZoom:zoom,toZoom:viewpoints[id].zoom,curve:track(ball.position.clone(),dest,id)};
      wake();
    });
  }
  function tick(now) {
    frame=0;if(disposed||document.hidden)return;
    const dt=Math.min((now-(lastTime||now))/1000,.066);lastTime=now;
    let needsNext=false;
    if(moving){
      const m=moving,t=Math.min(1,(now-m.start)/m.duration),ease=t*t*(3-2*t);
      cameraTarget.lerpVectors(m.fromTarget,m.end,ease);
      cameraDir.lerpVectors(m.fromDirection,m.direction,ease).normalize();
      zoom=THREE.MathUtils.lerp(m.fromZoom,m.toZoom,ease);
      ball.position.copy(m.curve.getPointAt(ease));
      travel(selected,t);
      setView();
      if(t===1){moving=null;options.onSound?.('arrive',.72);m.resolve();}
      else needsNext=true;
    }else if(selected==='table'){
      game.update(dt);ball.position.copy(physicsPosition());
      needsNext=game.state.mode==='playing';
    }
    for(const f of Object.values(game.state.flippers)){
      flippers[f.side].rotation.y=-f.angle;
      if(Math.abs(f.angle-(f.held?f.raised:f.rest))>.001 && game.state.mode!=='paused' && selected==='table')needsNext=true;
    }
    for(const [station,remaining] of flashes){
      const left=Math.max(0,remaining-dt),cap=bumpers.get(station);
      if(cap)cap.position.y=-Math.sin((left/.19)*Math.PI)*.08;
      if(left>0){flashes.set(station,left);needsNext=true;}else flashes.delete(station);
    }
    renderer.render(scene,camera);
    if(needsNext)frame=requestAnimationFrame(tick);
  }
  function wake(){if(!disposed&&!frame&&!document.hidden){lastTime=performance.now();frame=requestAnimationFrame(tick);}}
  function launch(){
    if(selected!=='table'||moving)return false;
    const launched=game.launch();wake();return launched;
  }
  function flip(side,down){if(selected==='table'&&!moving){game.flip(side,down);wake();}}
  function resume(){if(selected==='table'&&!moving){game.resume();wake();}}
  function projectTarget(id) {
    if(!stationPoints[id]||!lastWidth)return null;
    const p=stationPoints[id].clone().project(camera);return {x:(p.x+1)/2,y:(1-p.y)/2};
  }
  const caster=new THREE.Raycaster();
  const pickPoints=Object.entries(stationPoints).filter(([id])=>id!=='table')
    .map(([id,center])=>[id,new THREE.Sphere(center,id==='stats'?.53:.55)]);
  for(const bumper of TABLE.bumpers){
    pickPoints.push([bumper.station,new THREE.Sphere(deck.localToWorld(deckPoint(bumper.x,bumper.y,.38)),bumper.r*2+.10)]);
  }
  function pick(event) {
    const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
    caster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);
    let nearest=Infinity,id=null;const hit=new THREE.Vector3();
    for(const [station,proxy] of pickPoints){
      if(caster.ray.intersectSphere(proxy,hit)){
        const distance=hit.distanceTo(caster.ray.origin);
        if(distance<nearest){nearest=distance;id=station;}
      }
    }
    return id;
  }
  const listen=(object,event,fn)=>object.addEventListener(event,fn,{signal:listeners.signal});
  listen(canvas,'pointerdown',e=>{if(e.isPrimary&&e.button===0)pointerStart=[e.clientX,e.clientY];});
  function hover(id){
    if(id===hovered)return;hovered=id;canvas.style.cursor=id?'pointer':'';options.onHover?.(id);
  }
  listen(canvas,'pointermove',e=>{if(e.pointerType==='mouse')hover(pick(e));});
  listen(canvas,'pointerleave',()=>hover(null));
  listen(canvas,'pointercancel',()=>{pointerStart=null;});
  listen(canvas,'pointerup',e=>{
    if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])<8){
      const id=pick(e);if(id)options.onPick?.(id);
    }
    pointerStart=null;
  });
  listen(document,'visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;game.flip('left',false);game.flip('right',false);}
    else wake();
  });
  wake();
  return {goTo,launch,flip,resume,projectTarget,
    dispose(){
      disposed=true;moving?.resolve();moving=null;cancelAnimationFrame(frame);observer.disconnect();
      listeners.abort();disposeModel();removeShadow();key.shadow.dispose();environment.dispose();
      renderer.dispose();canvas.remove();
    }
  };
}
