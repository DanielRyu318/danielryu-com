import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ROOM_LAYOUT as layout, surfaceY } from './room-layout.js';
import { createRoomStations } from './room-stations.js';

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
  scene.add(new THREE.HemisphereLight(0xc7d1e2,0x5e4838,.32));
  const window = new THREE.DirectionalLight(0xa6c5e7,.55);
  window.position.set(-.4,3.0,-3);
  scene.add(window);
  const desk = (x,y,z,power,color,tx,ty,tz,shadow=false) => {
    const lamp = new THREE.SpotLight(color,power,8,1.10,.65,2);
    lamp.position.set(x,y,z); lamp.target.position.set(tx,ty,tz);
    lamp.castShadow = shadow;
    if (shadow) { lamp.shadow.mapSize.set(1536,1536); lamp.shadow.normalBias=.002; lamp.shadow.bias=-.00012; }
    scene.add(lamp,lamp.target);
  };
  desk(-.55,2.55,.46,6,0xffbf86,0,.85,-.10,true);
  desk(-.55,1.53,-.57,1.55,0xffc16b,-.24,.92,-.09);
  desk(-1.93,1.72,-.79,2.8,0xffc781,-1.75,.92,-1.00);
  desk(2.42,1.90,-.63,3.6,0xffc184,1.77,1.24,-.95);
  const fill = new THREE.PointLight(0xffb883,.55,2.6);
  fill.position.set(.69,1.55,.72);scene.add(fill);
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
  lightRoom(scene);
  const camera=new THREE.PerspectiveCamera(28,1,.02,26);
  const gltf=await new GLTFLoader().loadAsync('/models/workshop.glb');
  const model=gltf.scene;
  scene.add(model);
  model.traverse(obj=>{
    if (!obj.isMesh) return;
    obj.receiveShadow=true;
    obj.castShadow=true;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for (const mat of mats) {
      if(mat.map) mat.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      if(mat.name==='woodGrain'){
        mat.color.set(0xb28c78);mat.bumpMap=mat.map;mat.bumpScale=.00065;
      }
      if(mat.name==='field')mat.color.set(0xc4d4d1);
    }
  });
  const byName=name=>model.getObjectByName(name);
  const stations=createRoomStations({screen:byName('Anchor_CRT'),archive:byName('Anchor_Archive'),switchAnchor:byName('Anchor_Switch')});
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
  const named={Pick_Projects:'projects',Pick_Experience:'experience',Pick_Resume:'resume-pdf',Pick_Play:'play-mode',Pick_Explore:'explore-mode',Pick_Score:'score'};
  const interactive=[ball,...stations.pickables];
  for(const [name,action] of Object.entries(named)){
    const root=byName(name);
    root?.traverse(obj=>{if(obj.isMesh){obj.userData.action=action;interactive.push(obj);}});
  }
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
  const lantern=byName('Pick_Hobbies');
  const signalPivot=new THREE.Group();
  const lampPos=layout.anchors.hobbies;
  signalPivot.position.set(lampPos[0],surfaceY(lampPos[2]),lampPos[2]);scene.add(signalPivot);
  if(lantern){model.updateMatrixWorld(true);signalPivot.attach(lantern);}
  const glow = (pos,scale,intensity) => {
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:lampTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:intensity,toneMapped:false}));
    s.position.copy(pos);s.scale.setScalar(scale);scene.add(s);return s;
  };
  glow(signalPivot.position.clone().add(v(0,.087,0)),.145,.61);
  const routeLamps=[];
  const mobilePlates=[];
  for(const [id,path] of Object.entries(layout.routes)){
    const label=document.createElement('canvas');label.width=640;label.height=116;
    const painter=label.getContext('2d');
    painter.fillStyle=id==='projects'?'#153f3f':'#6b302b';painter.fillRect(0,0,640,116);
    painter.strokeStyle='#c4975d';painter.lineWidth=8;painter.strokeRect(4,4,632,108);
    painter.fillStyle='#ffeacc';painter.font='bold 67px Georgia';painter.textAlign='center';painter.textBaseline='middle';
    painter.fillText(id.toUpperCase(),320,62,605);
    const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
    const plate=new THREE.Mesh(new THREE.PlaneGeometry(.272,.052),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));
    const [px,pz]=layout.gates[id].center;
    plate.position.set(px,surfaceY(pz+.144)+.006,pz+.144);plate.rotation.x=-Math.PI/2+.065;
    plate.userData.action=id;scene.add(plate);interactive.push(plate);mobilePlates.push(plate);
    path.slice(0,5).forEach(([x,y,z],i)=>{
      const m=new THREE.MeshStandardMaterial({color:0xc79958,emissive:0xff9e46,emissiveIntensity:.16,roughness:.39});
      const base=new THREE.Mesh(new THREE.SphereGeometry(.008,12,8),m);
      base.position.set(x+(id==='projects'?-.042:.042),y-.009,z);
      base.scale.y=.68;scene.add(base);
      const halo=glow(base.position,.074,.05);
      routeLamps.push({id,i,m,halo});
    });
  }
  const carriage=byName('Archive_Carriage');
  const carriageStart=carriage?.position.clone();
  const projectCup=byName('Projects_Cup'), experienceCup=byName('Experience_Cup');
  const projectCupY=projectCup?.position.y, experienceCupY=experienceCup?.position.y;
  const poses={};
  const target = new THREE.Vector3();
  let aspect=1,station='table',width=1,height=1;
  let activeTravel=null, depart=null, savedTarget=null, initialFov=0;
  const pose=(eye,look,fov,near=.035)=>({eye,look,fov,near});
  function measure() {
    width=canvas.clientWidth;height=canvas.clientHeight;
    aspect=width/Math.max(1,height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.65));
    renderer.setSize(width,height,false);
    camera.aspect=aspect;
    const pitch=Math.asin(clamp(.58 / aspect,.25,.97))-.035;
    const dist=3.75;
    const focus=v(.026,.94,.055);
    const offset=v(-.058,Math.sin(pitch),Math.cos(pitch)).normalize().multiplyScalar(dist);
    const fitWidth=1.38;
    const fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.max(fitWidth/aspect,1.78*Math.sin(pitch)+.14)/(2*dist)));
    poses.table=pose(focus.clone().add(offset),focus,fov,aspect<.9?2.48:1.64);
    const narrow=aspect<.80;
    for(const plate of mobilePlates)plate.visible=narrow;
    poses.projects=narrow
      ?pose(v(-3.14,1.82,-1.16),v(-1.79,1.15,-1.10),60)
      :pose(v(-3.14,1.82,-1.25),v(-1.20,1.04,-.88),46);
    poses.experience=narrow
      ?pose(v(1.62,1.63,1.16),v(1.80,1.35,-1.04),59)
      :pose(v(.99,1.64,1.03),v(1.58,1.28,-1.02),39);
    if (station in poses) snap(station);
  }
  function snap(id) {
    const p=poses[id]||poses.table;
    camera.position.copy(p.eye);target.copy(p.look);camera.fov=p.fov;camera.near=p.near;
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function travelCamera(state) {
    const trip=state.travel;
    if (!trip) {
      if (activeTravel || station !== state.station) {
        station=state.station||'table';if(!(station in poses))station='table';
        snap(station);activeTravel=null;
      }
      return;
    }
    if(activeTravel!==trip) {
      activeTravel=trip;depart=camera.position.clone();savedTarget=target.clone();initialFov=camera.fov;
    }
    const end=poses[trip.to]||poses.table;
    const wait=trip.from==='table'?trip.lipProgress:0;
    const u=clamp((trip.progress-wait)/Math.max(.001,1-wait),0,1),s=ease(u);
    const arc=Math.sin(Math.PI*s);
    camera.position.lerpVectors(depart,end.eye,s);
    // Pass the outside shoulder of the rail, then settle at the instrument.
    camera.position.x+=arc*(trip.to==='projects'?-.45:trip.to==='experience'?.35:0);
    camera.position.y+=arc*.16;
    target.lerpVectors(savedTarget,end.look,s);
    target.lerp(ball.position,Math.sin(Math.PI*s)*.60);
    camera.fov=THREE.MathUtils.lerp(initialFov,end.fov,s)+arc*8;
    camera.near=THREE.MathUtils.lerp(trip.from==='table'?poses.table.near:.035,end.near,s);
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
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
    const s=stations.pickables.find(mesh=>mesh.userData.action===action);
    if(s && station!=='table')return s.getWorldPosition(new THREE.Vector3());
    const namedObj=interactive.find(obj=>obj.userData.action===action&&!stations.pickables.includes(obj));
    if(namedObj) return new THREE.Box3().setFromObject(namedObj).getCenter(new THREE.Vector3());
    return fallbacks[action];
  }
  const ray=new THREE.Raycaster();
  function pick(x,y,actions) {
    ray.setFromCamera({x:x/width*2-1,y:1-y/height*2},camera);
    const hits=ray.intersectObjects(interactive,false);
    for(const hit of hits)if(actions.includes(hit.object.userData.action))return hit.object.userData.action;
    let best=null,closest=Infinity;
    for(const action of actions){
      const pos=actionPosition(action);if(!pos)continue;
      const pt=project(pos);
      const d=Math.hypot(x-pt.x,y-pt.y);
      if(pt.visible&&d<closest&&d<(action==='launch'?32:22)){best=action;closest=d;}
    }
    return best;
  }
  function draw(state) {
    const b=state.ball;ball.position.set(b.x,b.y,b.z);
    contactShadow.position.set(b.x,surfaceY(b.z)+.0035,b.z);
    contactShadow.visible=Math.abs(b.x)<.51&&Math.abs(b.z)<.90&&b.y<surfaceY(b.z)+.075;
    flippers.forEach((f,i)=>{f.rotation.y=-state.flippers[layout.flippers[i].side].angle;});
    const springEnd=layout.launcher.z+.02+state.pull*layout.launcher.pullDistance;
    coil.scale.z=Math.max(.035,.855-springEnd);
    lever.rotation.x=state.explore?.46:-.46;
    signalPivot.rotation.y=(state.travel?.to==='experience'?1:-1)*.32+Math.sin(state.score*.017)*.43;
    updateScore(state.score);
    for(const {id,i,m,halo} of routeLamps){
      const lit=state.travel?.to===id?Math.max(0,1-Math.abs(state.travel.progress*6-i)*.75):0;
      m.emissiveIntensity=.11+lit*2.6;halo.material.opacity=.02+lit*.72;
    }
    const trip=state.travel;
    const atStation=(id)=>{
      if(trip?.to===id)return ease(clamp((trip.progress-.52)/.48,0,1));
      if(trip?.from===id)return 1-ease(clamp(trip.progress/.35,0,1));
      return state.station===id?1:0;
    };
    if(swivel)swivel.rotation.y=-1.54*atStation('projects');
    if(carriage)carriage.position.y=carriageStart.y+.025*atStation('experience');
    if(projectCup)projectCup.position.y=projectCupY-.009*atStation('projects');
    if(experienceCup)experienceCup.position.y=experienceCupY-.009*atStation('experience');
    travelCamera(state);
    renderer.render(scene,camera);
  }
  renderer.shadowMap.needsUpdate=true;
  measure();
  return {stations,measure,draw,pick,project,actionPosition,
    position(action){const p=actionPosition(action);return p?project(p):null;},
    pullVector(){
      const a=project(v(...layout.launcher.path[0])),b=project(v(layout.launcher.x,layout.launcher.path[0][1],layout.launcher.z+layout.launcher.pullDistance));
      return {x:b.x-a.x,y:b.y-a.y};
    },
    dispose(){stations.dispose();environment.dispose();renderer.dispose();}
  };
}
