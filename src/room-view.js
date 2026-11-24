import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ROOM_LAYOUT as layout, stationTrack, surfaceY } from './room-layout.js';
import { createRoomStations } from './room-stations.js';
import { cameraPoses, createCameraRide } from './room-camera.js';
import hardware from './room-mechanisms.json' with { type: 'json' };

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const ease = t => t * t * (3 - 2 * t);

function material(color, roughness, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// The same pivot, tip, and radius drive Rapier and the visible tapered paddle.
function buildFlipper(config, palette) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const r = config.radius, length = config.length;
  shape.moveTo(0, r);
  shape.lineTo(length, r * .72);
  shape.absarc(length, 0, r * .72, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(0, -r);
  shape.absarc(0, 0, r, -Math.PI / 2, Math.PI / 2, true);
  const base = new THREE.ExtrudeGeometry(shape, { depth: .023, bevelEnabled:true, bevelThickness:.003, bevelSize:.003, bevelSegments:3, curveSegments:12 });
  base.rotateX(-Math.PI / 2);
  const body = new THREE.Mesh(base, palette.cream);
  const ring = new THREE.Mesh(base, palette.rubber);
  ring.scale.set(1.01, .35, 1.04);
  ring.position.y = .003;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(r*.38,r*.38,.004,20),palette.brass);
  pin.position.y = .029;
  group.add(body,ring,pin);
  group.position.set(config.x, surfaceY(config.z) + .006, config.z);
  group.name = config.side + 'Flipper';
  return group;
}

function buildSpring(palette) {
  const points = [];
  for (let i=0; i<=144; i++) {
    const f=i/144, t=f*Math.PI*2*12;
    points.push(v(.014*Math.cos(t),.014*Math.sin(t),-f));
  }
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),200,.0028,6,false),palette.brass);
  coil.position.set(layout.launcher.x, layout.launcher.path[0][1], .855);
  return coil;
}

function signalGlow() {
  const c=document.createElement('canvas');c.width=c.height=96;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(48,48,0,48,48,48);
  g.addColorStop(0,'rgba(255,224,146,.9)');g.addColorStop(.2,'rgba(255,178,77,.54)');
  g.addColorStop(.55,'rgba(247,115,33,.14)');g.addColorStop(1,'rgba(235,109,17,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,96,96);
  return new THREE.CanvasTexture(c);
}

// An illuminated start key gives the otherwise blank front service door a job.
function serviceDoor() {
  const door=new THREE.Group();
  door.position.set(0,.687,.982);
  door.rotation.x=.063;
  const dark=material(0x29282c,.53,.54),rim=material(0xa87a49,.32,.66);
  const keyMat=new THREE.MeshStandardMaterial({color:0xc88840,emissive:0xffa23c,roughness:.32});
  const block=(w,h,d,x,y,z,finish)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),finish);
    mesh.position.set(x,y,z);door.add(mesh);return mesh;
  };
  block(.35,.191,.012,0,0,0,rim);
  block(.337,.179,.015,0,0,.005,dark);
  block(.089,.062,.015,-.083,.027,.019,rim);
  const key=block(.079,.051,.009,-.083,.027,.031,keyMat);
  const c=document.createElement('canvas');c.width=192;c.height=96;
  const ctx=c.getContext('2d');ctx.font='bold 43px sans-serif';ctx.fillStyle='#321e15';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('START',96,49);
  const lettering=new THREE.Mesh(new THREE.PlaneGeometry(.075,.045),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  lettering.position.copy(key.position);lettering.position.z+=.0048;door.add(lettering);
  block(.097,.027,.008,.069,.045,.016,rim);
  block(.072,.007,.008,.069,.045,.021,dark);
  block(.102,.050,.010,.069,-.037,.016,rim);
  block(.090,.038,.011,.069,-.037,.019,dark);
  const fastener=new THREE.CylinderGeometry(.005,.005,.004,12);
  for(const x of [-.15,.15])for(const y of [-.072,.072]){
    const screw=new THREE.Mesh(fastener,rim);screw.rotation.x=Math.PI/2;screw.position.set(x,y,.016);door.add(screw);
  }
  for(const mesh of [key,lettering])mesh.userData.action='start';
  return {door,key,lettering,illuminate(ready){keyMat.emissiveIntensity=ready?.54:.08;}};
}

function scoreDrums(model) {
  const c=document.createElement('canvas');c.width=640;c.height=160;
  const ctx=c.getContext('2d'),texture=new THREE.CanvasTexture(c);
  texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    for(const m of [].concat(obj.material))if(m.name==='print_score'){
      m.map=texture;m.emissiveMap=texture;m.emissive.set(0x55462c);m.needsUpdate=true;
    }
  });
  let previous=-1;
  return value=>{
    if(value===previous)return;
    previous=value;
    ctx.fillStyle='#241f19';ctx.fillRect(0,0,640,160);
    ctx.font='bold 94px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    [...String(value).padStart(6,'0').slice(-6)].forEach((n,i)=>{
      const x=20+i*101,grad=ctx.createLinearGradient(0,13,0,146);
      grad.addColorStop(0,'#2c251e');grad.addColorStop(.5,'#514330');grad.addColorStop(1,'#211e19');
      ctx.fillStyle=grad;ctx.fillRect(x,13,93,132);ctx.fillStyle='#f5d495';ctx.fillText(n,x+46,83);
    });
    texture.needsUpdate=true;
  };
}

function lightRoom(scene) {
  scene.add(new THREE.HemisphereLight(0xaebbd6,0x714d44,.26));
  const window = new THREE.DirectionalLight(0x9ebbed,.42);
  window.position.set(-.4,3.0,-3);
  scene.add(window);
  const desk = (x,y,z,power,color,tx,ty,tz,shadow=false) => {
    const lamp = new THREE.SpotLight(color,power,8,shadow ? .87 : 1.02,.79,2);
    lamp.position.set(x,y,z); lamp.target.position.set(tx,ty,tz);
    lamp.castShadow = shadow;
    if (shadow) { lamp.shadow.mapSize.set(1536,1536); lamp.shadow.normalBias=.002; lamp.shadow.bias=-.00012; }
    scene.add(lamp,lamp.target);
    return lamp;
  };
  const cabinet=desk(-.68,2.70,.65,7.7,0xffdbad,0,.88,-.09,true);
  desk(1.05,2.23,-1.17,1.7,0x9abef6,.14,1.03,-.13);
  const monitor=desk(-1.93,1.72,-.79,2.8,0xffc781,-1.75,.92,-1.00);
  const press=desk(2.42,1.90,-.63,3.6,0xffc184,1.77,1.24,-.95);
  const fill = new THREE.PointLight(0xffb883,.55,2.6);
  fill.position.set(.69,1.55,.72);scene.add(fill);
  return (projects,experience)=>{
    cabinet.intensity=7.7-2.4*Math.max(projects,experience);
    monitor.intensity=.34+projects*2.55;
    press.intensity=.31+experience*3.35;
  };
}

export async function createRoomView(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.84;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  const scene = new THREE.Scene();
  scene.background=new THREE.Color(0x353a3c);
  scene.fog = new THREE.FogExp2(0x4b443b,.043);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environment = pmrem.fromScene(roomEnvironment,.025);
  scene.environment=environment.texture;
  scene.environmentIntensity=.19;
  roomEnvironment.dispose();pmrem.dispose();
  const lightStations=lightRoom(scene);
  const camera=new THREE.PerspectiveCamera(28,1,.02,26);
  const gltf=await new GLTFLoader().loadAsync('/models/workshop.glb');
  const model=gltf.scene;
  scene.add(model);
  const finishedMaterials=new Set();
  model.traverse(obj=>{
    if (!obj.isMesh) return;
    obj.receiveShadow=true;
    obj.castShadow=true;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for (const mat of mats) {
      if(finishedMaterials.has(mat))continue;
      finishedMaterials.add(mat);
      if(mat.map) mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(mat.name==='woodGrain'){
        mat.color.set(0xb28c78);mat.bumpMap=mat.map;mat.bumpScale=.00065;
      }
      if(mat.name==='field')mat.color.set(0xffffff);
      if(mat.name==='wall'||mat.name==='wallShade')mat.color.multiply(new THREE.Color(0xb5b3ca));
      if(/^floor[A-D]$/.test(mat.name))mat.color.multiply(new THREE.Color(0xd2b9bf));
    }
  });
  const byName=name=>model.getObjectByName(name);
  const blades=hardware.dropBank.targets.map(({id,node})=>{
    const blade=byName(node);
    return {id,blade,raised:blade.position.y};
  });
  const spinner=byName(hardware.spinner.node);
  const axleRest=spinner.rotation.x;
  const rolloverLamps=hardware.rollovers.map(insert=>{
    let lens;
    byName(insert.node).traverse(mesh=>{
      if(mesh.isMesh&&mesh.material.name===insert.material)lens=mesh.material;
    });
    return {id:insert.id,lens,idle:lens.emissiveIntensity};
  });
  const buttons=['Left','Right'].map(side=>{
    const button=byName('Cabinet_Button_'+side);
    return {button,rest:button.position.x,side:side.toLowerCase()};
  });
  const stations=createRoomStations({screen:byName('Anchor_CRT'),archive:byName('Anchor_Archive'),switchAnchor:byName('Anchor_Switch'),plungerParent:scene});
  const palette={
    cream:material(0xffe4ac,.34,.09),rubber:material(0x9a392b,.65),
    brass:material(0xbb833d,.22,.80)
  };
  const ball=new THREE.Mesh(new THREE.SphereGeometry(layout.ballRadius,40,28),material(0xffffff,.085,1));
  ball.name='Steel ball';ball.userData.action='launch';
  ball.material.envMap=environment.texture;ball.material.envMapIntensity=1.45;
  const coil=buildSpring(palette);
  const flippers=layout.flippers.map(f=>buildFlipper(f,palette));
  const shadeCanvas=document.createElement('canvas');
  shadeCanvas.width=shadeCanvas.height=64;
  const ctx=shadeCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(28,16,5,.55)');gradient.addColorStop(1,'rgba(28,16,5,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(.11,.11),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadeCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  contactShadow.rotation.x=-Math.PI/2;
  scene.add(ball,coil,contactShadow,...flippers);
  const named={
    Pick_Projects:'projects',Pick_Experience:'experience',Pick_Education:'education',Pick_Record:'resume',
    Pick_Contact:'contact',Pick_Collector:'reader',Pick_Resume:'resume-pdf',Pick_Play:'play-mode',
    Pick_Explore:'explore-mode',Pick_Score:'score',Rollover_West:'resume',Rollover_East:'contact',
    Drop_1:'education',Drop_2:'education',Drop_3:'education',
    Pick_Desk_Sign:'projects',Pick_Archive_Sign:'experience'
  };
  const interactive=[ball,...stations.pickables];
  const tableAnchors=new Map();
  const service=serviceDoor();
  scene.add(service.door);interactive.push(service.key,service.lettering);
  tableAnchors.set('start',service.key.getWorldPosition(new THREE.Vector3()));
  for(const [name,action] of Object.entries(named)){
    const root=byName(name);
    if(!root)continue;
    root.traverse(obj=>{if(obj.isMesh){obj.userData.action=action;interactive.push(obj);}});
    if(!tableAnchors.has(action))tableAnchors.set(action,new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3()));
  }
  // Focus follows the inscription, even when its assembly includes a long guide rail.
  for(const [id,x,z] of [
    ['projects',-.278,.064],['experience',.19,-.483],['education',-.235,.204],
    ['contact',.106,.443],['resume',-.179,.443]
  ])tableAnchors.set(id,v(x,surfaceY(z)+.015,z));
  const bankDial=byName('Bank_Dial');
  const captive=byName(hardware.captive.node),captiveSpring=byName(hardware.captive.springNode);
  const captiveRest=captive?.position.clone(),springLength=captiveSpring?.scale.z;
  const swivel=byName('Projects_CRT_Swivel');
  const updateScore=scoreDrums(model);
  const lever=new THREE.Group();
  const leverFoot=new THREE.Mesh(new THREE.CylinderGeometry(.019,.025,.012,24),palette.brass);
  const leverStem=new THREE.Mesh(new THREE.CylinderGeometry(.0045,.007,.063,16),palette.brass);
  leverStem.position.y=.029;
  const leverKnob=new THREE.Mesh(new THREE.SphereGeometry(.015,20,16),palette.cream);
  leverKnob.position.y=.064;lever.add(leverFoot,leverStem,leverKnob);
  lever.position.set(.385,.958,.737);scene.add(lever);
  const lampTexture=signalGlow();
  const glow = (pos,scale,intensity) => {
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:lampTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:intensity,toneMapped:false}));
    s.position.copy(pos);s.scale.setScalar(scale);scene.add(s);return s;
  };
  const routeLamps=[];
  const paths={...layout.routes,reader:layout.reader.route};
  for(const [id,path] of Object.entries(paths)){
    path.forEach(([x,y,z],i)=>{
      const m=new THREE.MeshStandardMaterial({color:0xc79958,emissive:0xff9e46,emissiveIntensity:.16,roughness:.39});
      const base=new THREE.Mesh(new THREE.SphereGeometry(.008,12,8),m);
      const next=path[Math.min(i+1,path.length-1)],prev=path[Math.max(0,i-1)];
      const tangent=v(next[0]-prev[0],0,next[2]-prev[2]).normalize();
      const sideOffset=id==='projects'?.034:-.034;
      base.position.set(x+tangent.z*sideOffset,y-.014,z-tangent.x*sideOffset);
      base.scale.y=.68;scene.add(base);
      const halo=glow(base.position,.074,.05);
      routeLamps.push({id,m,halo,position:base.position});
    });
  }
  const carriage=byName('Archive_Carriage');
  const carriageStart=carriage?.position.clone();
  const projectCup=byName('Projects_Cup'), experienceCup=byName('Experience_Cup');
  const projectCupY=projectCup?.position.y, experienceCupY=experienceCup?.position.y;
  let poses;
  const target = new THREE.Vector3();
  let aspect=1,station='table',width=1,height=1;
  let activeTravel=null, ride=null, lastTripProgress=0;
  function measure() {
    width=canvas.clientWidth;height=canvas.clientHeight;
    aspect=width/Math.max(1,height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.65));
    renderer.setSize(width,height,false);
    camera.aspect=aspect;
    poses=cameraPoses(aspect);
    if (!activeTravel) snap(station);
    else { activeTravel=null; camera.updateProjectionMatrix(); }
  }
  function applyPose(p) {
    camera.position.copy(p.eye);target.copy(p.look);camera.fov=p.fov;camera.near=p.near;
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function snap(id) { applyPose(poses[id]||poses.table); }
  function travelCamera(state) {
    const trip=state.travel;
    if (!trip) {
      if (activeTravel || station !== state.station) {
        station=state.station||'table';if(!(station in poses))station='table';
        snap(station);activeTravel=null;lastTripProgress=0;
      }
      return;
    }
    if(activeTravel!==trip) {
      activeTravel=trip;
      const start={eye:camera.position.clone(),look:target.clone(),fov:camera.fov,near:camera.near};
      lastTripProgress=trip.progress;
      ride=createCameraRide(trip,start,poses[trip.to]||poses.table);
    }
    const progress=(trip.progress-lastTripProgress)/Math.max(.001,1-lastTripProgress);
    applyPose(ride(progress,ball.position,trip.ahead));
  }
  function project(pos) {
    const q=pos.clone().project(camera);
    return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,visible:q.z>=-1&&q.z<=1&&Math.abs(q.x)<1&&Math.abs(q.y)<1};
  }
  const fallbacks={
    projects:v(-.31,1.00,-.10),experience:v(.257,1.035,-.59),
    'resume-pdf':v(-.37,.933,.79),'explore-mode':v(.300,.926,.779),'play-mode':v(.308,.929,.737)
  };
  function actionPosition(action) {
    if(action==='launch')return ball.position;
    if(station!=='table'){
      const exact=stations.actionPosition(action);
      if(exact)return exact;
    }
    const s=stations.pickables.find(mesh=>mesh.userData.action===action);
    if(s && station!=='table')return s.getWorldPosition(new THREE.Vector3());
    return tableAnchors.get(action)||fallbacks[action];
  }
  const ray=new THREE.Raycaster();
  function pick(x,y,actions) {
    ray.setFromCamera({x:x/width*2-1,y:1-y/height*2},camera);
    const hits=ray.intersectObjects(interactive,false);
    for(const hit of hits) {
      let ancestor=hit.object;while(ancestor?.visible)ancestor=ancestor.parent;
      if(ancestor)continue;
      const action=hit.object===ball&&station!=='table'?'return-'+station:hit.object.userData.action;
      if(actions.includes(action))return action;
    }
    let best=null,closest=Infinity;
    for(const action of actions){
      const pos=actionPosition(action);if(!pos)continue;
      const pt=project(pos);
      const d=Math.hypot(x-pt.x,y-pt.y);
      if(pt.visible&&d<closest&&d<(action==='launch'||action.startsWith('return-')?32:22)){best=action;closest=d;}
    }
    return best;
  }
  function draw(state) {
    const b=state.ball;ball.position.set(b.x,b.y,b.z);
    service.illuminate(state.mode==='ready'||state.mode==='paused');
    if(state.station!=='table')stations.setReturnPull('return-'+state.station,state.pull);
    stations.update?.();
    for(const {id,blade,raised} of blades)blade.position.y=raised-.054*state.mechanisms.drops[id];
    if(bankDial)bankDial.rotation.y=-Math.PI*.5*Object.values(state.mechanisms.drops).reduce((sum,level)=>sum+level,0);
    if(captive){
      const travel=state.mechanisms.captive;
      captive.position.z=captiveRest.z-travel;
      captive.position.y=captiveRest.y+layout.deck.slope*travel;
      const span=hardware.captive.z-hardware.captive.radius-hardware.captive.rearAnchorZ;
      if(captiveSpring)captiveSpring.scale.z=springLength*(1-travel/span);
    }
    spinner.rotation.x=axleRest+state.mechanisms.spin;
    for(const {id,lens,idle} of rolloverLamps)lens.emissiveIntensity=Math.max(.22,idle)+2.8*state.mechanisms.rollovers[id];
    for(const {button,rest,side} of buttons)
      button.position.x=rest+(state.flippers[side].held?(side==='left'?.007:-.007):0);
    contactShadow.position.set(b.x,surfaceY(b.z)+.0035,b.z);
    contactShadow.visible=Math.abs(b.x)<.51&&Math.abs(b.z)<.90&&b.y<surfaceY(b.z)+.075;
    flippers.forEach((f,i)=>{f.rotation.y=-state.flippers[layout.flippers[i].side].angle;});
    const springEnd=layout.launcher.z+.02+(state.station==='table'?state.pull:0)*layout.launcher.pullDistance;
    coil.scale.z=Math.max(.035,.855-springEnd);
    lever.rotation.x=state.explore?.46:-.46;
    updateScore(state.score);
    const trip=state.travel;
    for(const {id,m,halo,position} of routeLamps){
      const onWire=trip&&!trip.crossing&&(stationTrack(trip.to)===id||stationTrack(trip.from)===id);
      const lit=onWire?1-THREE.MathUtils.smoothstep(ball.position.distanceTo(position),.045,.22):0;
      m.emissiveIntensity=.11+lit*2.6;halo.material.opacity=.02+lit*.72;
    }
    const atStation=(id)=>{
      if(trip?.to===id){
        const afterGate=(trip.progress-trip.gateProgress)/Math.max(.001,1-trip.gateProgress);
        return ease(clamp((afterGate-.34)/.66,0,1));
      }
      if(trip?.from===id)return 1-ease(clamp(trip.progress/.35,0,1));
      return state.station===id?1:0;
    };
    if(swivel)swivel.rotation.y=-1.54*atStation('projects');
    if(carriage)carriage.position.y=carriageStart.y+.025*atStation('experience');
    if(projectCup)projectCup.position.y=projectCupY-.009*atStation('projects');
    if(experienceCup)experienceCup.position.y=experienceCupY-.009*atStation('experience');
    lightStations(atStation('projects'),atStation('experience'));
    travelCamera(state);
    renderer.render(scene,camera);
  }
  renderer.shadowMap.needsUpdate=true;
  measure();
  return {stations,measure,draw,pick,project,actionPosition,
    position(action){const p=actionPosition(action);return p?project(p):null;},
    pullVector(action='launch'){
      if(action.startsWith('return-')){
        const axis=stations.returnPullAxis(action);
        const a=project(axis.start),b=project(axis.end);
        return {x:b.x-a.x,y:b.y-a.y};
      }
      const a=project(v(...layout.launcher.path[0])),b=project(v(layout.launcher.x,layout.launcher.path[0][1],layout.launcher.z+layout.launcher.pullDistance));
      return {x:b.x-a.x,y:b.y-a.y};
    },
    dispose(){stations.dispose();environment.dispose();renderer.dispose();}
  };
}
