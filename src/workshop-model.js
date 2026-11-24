import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { backglassArt, fieldArt, floorArt, monitorArt, scoreArt, sideArt, updateScore, woodArt } from './workshop-art.js';
import { TABLE } from './pinball.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
export const deckPoint = (x, y, lift = 0) => v((x - TABLE.width / 2) * 2, lift, (y - TABLE.height / 2) * 2);

// All printed layers sit on their physical surfaces, including the inclined playfield.
export function makeModel(scene) {
  const model = new THREE.Group();
  scene.add(model);
  const assets = new Set();
  const own = asset => { assets.add(asset); return asset; };
  const group = parent => { const g = new THREE.Group(); parent.add(g); return g; };
  const mat = (color, roughness=.64, metalness=0, extra={}) =>
    own(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
  const art = (map, brightness=0) => {
    own(map);
    return mat(0xffffff,.68,0, brightness ? { map, emissiveMap:map, emissive:0xffffff, emissiveIntensity:brightness } : { map });
  };
  const timberMap = own(woodArt());
  const m = {
    walnut:mat('#ad7653',.67,0,{map:timberMap}),
    wood:mat('#f8c18d',.61,0,{map:timberMap}),
    edge:mat('#e5ad73',.54), black:mat('#202f2b',.58), deep:mat('#123e36',.52),
    teal:mat('#28786a',.43), mint:mat('#8cc1a2',.44), sage:mat('#589d78',.6),
    gold:mat('#cd9b5d',.32,.52), brass:mat('#ffca79',.26,.55), chrome:mat('#d3ded5',.19,.83),
    cream:mat('#ffe2a8',.47), coral:mat('#ec8352',.43), ochre:mat('#edb45e',.45),
    field:art(fieldArt(TABLE),.09), side:art(sideArt(),.10), glass:art(backglassArt(),.38),
    score:art(scoreArt(),.30), screen:art(monitorArt(),.60),
    bulb:mat('#ffdf9e',.26,.04,{emissive:0xffac62,emissiveIntensity:1.8}),
    platform:art(floorArt()), platformEdge:mat('#463f31',.84),
    pot:mat('#c3754f',.76), soil:mat('#493d2b',.96), leaf:mat('#468264',.69),
    leafLight:mat('#83a077',.67), leafDark:mat('#2a604b',.7),
  };
  const geometries = new Map();
  const geo = (key, make) => {
    if (!geometries.has(key)) geometries.set(key, own(make()));
    return geometries.get(key);
  };
  const mesh = (p,g,material,x,y,z) => {
    const o=new THREE.Mesh(g,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;
  };
  const box = (p,x,y,z,w,h,d,material,r=0) => mesh(p,geo([w,h,d,r].join(':'),()=>r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2,h/2,d/2)):new THREE.BoxGeometry(w,h,d)),material,x,y,z);
  const drum = (p,x,y,z,top,bottom,h,material,n=24) => mesh(p,geo(['drum',top,bottom,h,n].join(':'),()=>new THREE.CylinderGeometry(top,bottom,h,n)),material,x,y,z);
  const sphere = (p,x,y,z,r,material) => mesh(p,geo('sphere'+r,()=>new THREE.SphereGeometry(r,20,12)),material,x,y,z);
  const plane = (p,x,y,z,w,h,material) => mesh(p,geo('p'+w+','+h,()=>new THREE.PlaneGeometry(w,h)),material,x,y,z);
  function rod(p,a,b,r,material) {
    const diff=new THREE.Vector3().subVectors(b,a),mid=a.clone().lerp(b,.5);
    const o=drum(p,mid.x,mid.y,mid.z,r,r,diff.length(),material,10);
    o.quaternion.setFromUnitVectors(v(0,1,0),diff.normalize());return o;
  }
  function wire(p,points,r,material) {
    return mesh(p,own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*5),r,7,false)),material,0,0,0);
  }
  function frontDisk(p,x,y,z,r,h,material) {
    const o=drum(p,x,y,z,r,r,h,material);o.rotation.x=Math.PI/2;return o;
  }
  const deck=group(model);deck.position.y=2.51;deck.rotation.x=.064;
  box(deck,0,-.50,0,4.45,.96,7.42,m.wood,.115);
  box(deck,0,-.96,0,4.39,.13,7.34,m.walnut,.055);
  box(deck,0,-.021,0,4.21,.11,7.18,m.deep,.07);
  plane(deck,0,.043,0,4,7,m.field).rotation.x=-Math.PI/2;
  for(const sign of [-1,1]) {
    box(deck,sign*2.115,.093,0,.21,.22,7.47,m.wood,.055);
    box(deck,sign*2.13,.207,0,.10,.032,7.36,m.gold,.011);
    const print=plane(deck,sign*2.228,-.48,-.015,6.95,.64,m.side);print.rotation.y=sign*Math.PI/2;
    for(const z of [-3.42,-2.15,1.68,3.41]){
      const screw=drum(deck,sign*2.231,-.8,z,.045,.045,.016,m.brass,12);screw.rotation.z=Math.PI/2;
    }
  }
  box(deck,0,.093,3.56,4.3,.20,.19,m.wood,.045);
  box(deck,0,.193,3.585,4.31,.045,.07,m.gold,.012);
  box(deck,0,-.43,3.706,4.14,.70,.07,m.deep,.045);
  // Coin door, entry slot, service latch and the sprung launch handle on the apron.
  box(deck,-.21,-.43,3.774,.91,.57,.10,m.gold,.06);
  box(deck,-.21,-.43,3.834,.81,.49,.05,m.black,.04);
  box(deck,-.32,-.34,3.876,.32,.13,.035,m.chrome,.018);
  box(deck,-.32,-.34,3.90,.24,.035,.02,m.black);
  box(deck,-.30,-.55,3.87,.25,.12,.04,m.deep,.015);
  frontDisk(deck,.027,-.45,3.87,.054,.044,m.chrome);
  frontDisk(deck,1.64,-.42,3.80,.205,.15,m.gold);
  frontDisk(deck,1.64,-.42,3.95,.077,.32,m.chrome);
  frontDisk(deck,1.64,-.42,4.14,.14,.14,m.ochre);
  [-1.89,1.91].forEach(x=>{[-.18,-.68].forEach(y=>frontDisk(deck,x,y,3.758,.04,.025,m.brass));});
  for(const x of [-1.83,1.83]) for(const z of [-3.13,3.1]) {
    const base=v(x*1.10,.17,z*1.055),top=v(x,2.02-z*.064,z);
    rod(model,base,top,.129,m.walnut);
    const trim=base.clone().lerp(top,.85);
    rod(model,trim,top,.154,m.gold);
    drum(model,base.x,.145,base.z,.17,.19,.13,m.gold);
    drum(model,base.x,.076,base.z,.19,.175,.046,m.black);
  }

  // Solid riser under the painted backglass and a small row of inset marquee lamps.
  const back=group(model);back.position.set(0,2.77,-3.53);back.rotation.x=-.052;
  box(back,0,.24,0,4.46,.75,.67,m.walnut,.12);
  box(back,0,1.36,-.045,4.63,2.04,.61,m.wood,.16);
  box(back,0,1.42,.259,4.40,1.78,.085,m.black,.072);
  box(back,0,1.43,.31,4.28,1.69,.075,m.gold,.06);
  plane(back,0,1.43,.356,4.15,1.58,m.glass);
  box(back,0,.31,.32,4.38,.46,.175,m.deep,.052);
  plane(back,0,.31,.416,2.15,.405,m.score);
  for(const x of [-1.82,-1.58,-1.34,1.34,1.58,1.82]) {
    frontDisk(back,x,.31,.427,.073,.04,m.gold);
    const o=sphere(back,x,.31,.447,.052,m.bulb);o.scale.z=.52;
  }
  box(back,0,2.375,-.02,4.61,.10,.67,m.edge,.035);
  for(const x of [-2.23,2.23]) for(const y of [.54,2.26])frontDisk(back,x,y,.251,.046,.06,m.gold);

  // Rails and posts match the collision map exactly.
  for(const rail of TABLE.rails) {
    const a=deckPoint(rail.ax,rail.ay,.16),b=deckPoint(rail.bx,rail.by,.16);
    rod(deck,a,b,.047,m.chrome);
    const len=a.distanceTo(b), stops=Math.ceil(len/1.35);
    for(let i=0;i<stops;i++) {
      const j=a.clone().lerp(b,i/stops);drum(deck,j.x,.107,j.z,.055,.065,.15,m.gold,14);
    }
  }
  const bumpers=new Map();
  for(const [i,b] of TABLE.bumpers.entries()) {
    const p=deckPoint(b.x,b.y),r=b.r*2;
    const accent=[m.coral,m.ochre,m.mint][i];
    drum(deck,p.x,.098,p.z,r*1.20,r*1.25,.095,m.gold);
    drum(deck,p.x,.19,p.z,r*.94,r,.145,m.cream);
    drum(deck,p.x,.235,p.z,r*1.11,r*1.12,.067,m.deep);
    const cap=group(deck);cap.position.copy(p);cap.userData.mobile=true;
    drum(cap,0,.31,0,r*1.25,r*1.20,.125,accent);
    drum(cap,0,.38,0,r*1.10,r*1.24,.054,m.brass);
    const dome=sphere(cap,0,.391,0,r*.96,accent);dome.scale.y=.27;
    drum(cap,0,.477,0,r*.34,r*.34,.027,m.cream);
    sphere(cap,0,.49,0,.043,m.bulb);
    bumpers.set(b.station,cap);
  }
  const flippers={};
  for(const f of TABLE.flippers) {
    const p=deckPoint(f.x,f.y),o=group(deck);o.position.copy(p);o.userData.mobile=true;
    const r=f.r*2, length=f.length*2;
    box(o,length*.49,.151,0,length,.16,r*2.11,m.coral,.079);
    box(o,length*.48,.239,0,length*.92,.052,r*1.68,m.cream,.023);
    drum(o,0,.157,0,r*1.16,r*1.17,.166,m.coral);
    drum(o,0,.252,0,r*.82,r*.89,.06,m.cream);
    drum(o,0,.293,0,.048,.05,.028,m.gold);
    flippers[f.side]=o;
  }
  const ball=sphere(deck,0,.20,0,TABLE.radius*2,mat('#f0f4ed',.105,.96));ball.userData.mobile=true;
  // The upper track is a wireform ramp. Its two bent rails remain visible from the front.
  for(const offset of [-.102,.102]) {
    wire(deck,[v(-1.72+offset,.13,1.24),v(-1.75+offset,.25,.24),v(-1.71+offset,.53,-.68),v(-1.62+offset,.67,-1.50),v(-1.39+offset,.72,-2.14),v(-1.23+offset,.62,-2.61)],.032,m.brass);
  }
  for(const [x,y,z] of [[-1.75,.22,.25],[-1.69,.54,-.74],[-1.42,.67,-2.05]]) {
    rod(deck,v(x,.08,z),v(x,y,z),.041,m.gold);rod(deck,v(x-.14,y,z),v(x+.14,y,z),.032,m.gold);
  }
  const gate=group(deck);gate.userData.mobile=true;gate.position.set(-1.84,.20,1.20);
  drum(gate,0,.008,0,.071,.08,.115,m.gold);
  box(gate,.12,0,0,.27,.065,.049,m.cream,.019);
  const project=group(deck);project.position.set(-1.13,.202,-2.73);
  drum(project,0,.084,0,.30,.34,.17,m.deep);
  box(project,0,.42,-.055,1.01,.72,.36,m.cream,.085);
  box(project,0,.45,.13,.89,.52,.055,m.deep,.04);
  plane(project,-.015,.45,.166,.756,.416,m.screen);
  sphere(project,.35,.158,.15,.033,m.bulb);
  // Three drop targets and an isolated lane mirror the rear and side destination stations.
  const dropTargets=[];
  for(let i=0;i<3;i++) {
    const x=-.15+i*.41,z=-2.74+(i%2)*.06;
    box(deck,x,.19,z,.34,.22,.16,m.walnut,.037);
    const drop=group(deck);drop.position.set(x,0,z);drop.userData.mobile=true;dropTargets.push(drop);
    box(drop,0,.40,0,.30,.43,.13,[m.ochre,m.coral,m.mint][i],.042);
    frontDisk(drop,0,.44,.069,.077,.019,m.cream);
  }
  for(let i=0;i<4;i++){
    const x=1.49,z=-.96+i*.55;
    drum(deck,x,.068,z,.085,.09,.045,m.brass,16);
    const o=sphere(deck,x,.097,z,.061,m.bulb);o.scale.y=.49;
  }
  const stationPoints={
    table:v(0,2.36,.18),
    projects:deck.localToWorld(v(-1.13,.62,-2.58)),
    experience:deck.localToWorld(v(.29,.46,-2.63)),
    hobbies:deck.localToWorld(v(.33,.15,.32)),
    stats:back.localToWorld(v(0,.32,.43)),
  };
  const parking={
    projects:v(-1.14,.41,-2.39),experience:v(.23,.19,-2.41),
    hobbies:v(.94,.21,.53),stats:v(1.12,.55,-2.97),
  };
  // Cut-corner display base, low ambient contact shadows, and two small workbench props.
  box(model,0,-.151,.16,6.89,.37,8.94,m.platformEdge,.16);
  box(model,0,.017,.16,6.89,.137,8.94,m.platform,.068);
  function plant(x,z,size,elevation=.086) {
    const p=group(model);p.position.set(x,elevation,z);p.scale.setScalar(size);
    drum(p,0,.34,0,.40,.27,.68,m.pot,16);
    drum(p,0,.65,0,.426,.418,.14,m.pot,16);
    drum(p,0,.716,0,.367,.36,.034,m.soil,16);
    for(let i=0;i<12;i++) {
      const angle=i*2.399, reach=.25+(i%5)*.088, rise=.37+(i%3)*.16;
      const tip=v(Math.cos(angle)*reach,.91+rise,Math.sin(angle)*reach);
      const start=v(Math.cos(angle)*.05,.695,Math.sin(angle)*.05);
      const mid=start.clone().lerp(tip,.50);mid.y+=.07;
      rod(p,start,mid,.016,m.leafDark);
      const side=v(-Math.sin(angle),0,Math.cos(angle)).multiplyScalar(.12);
      const a=mid.clone().add(side),b=mid.clone().sub(side);
      const keel=mid.clone();keel.y+=.115;
      const geom=own(new THREE.BufferGeometry());
      geom.setAttribute('position',new THREE.Float32BufferAttribute([...start,...a,...keel,...keel,...a,...tip,...start,...keel,...b,...keel,...tip,...b],3));
      geom.computeVertexNormals();const material=[m.leaf,m.leafLight,m.leafDark][i%3];
      material.side=THREE.DoubleSide;mesh(p,geom,material,0,0,0);
    }
  }
  // A little cedar crate brings the leafy silhouette up into view beside the apron.
  box(model,-2.63,.28,3.47,.94,.37,.92,m.walnut,.045);
  for(let i=0;i<3;i++){box(model,-2.63,.17+i*.113,3.947,.96,.088,.045,m.wood,.015);}
  plant(-2.63,3.50,1.16,.468);
  plant(-2.87,2.88,.61);
  // Workshop break stool with a cloth-bound notebook and an unfinished cup of tea.
  const stool=group(model);stool.position.set(2.71,.091,3.05);stool.rotation.y=-.24;
  for(let i=0;i<3;i++){
    const a=i*2*Math.PI/3;
    rod(stool,v(Math.cos(a)*.38,0,Math.sin(a)*.38),v(Math.cos(a)*.28,.76,Math.sin(a)*.28),.052,m.wood);
  }
  drum(stool,0,.76,0,.49,.46,.112,m.walnut,32);
  drum(stool,0,.822,0,.475,.49,.048,m.wood,32);
  const book=group(stool);book.position.set(-.08,.883,.052);book.rotation.y=.21;
  box(book,0,0,0,.45,.072,.59,m.cream,.012);
  box(book,0,.046,0,.475,.033,.61,m.deep,.009);
  box(book,-.207,.015,0,.040,.079,.602,m.teal,.008);
  const cup=group(stool);cup.position.set(.20,.85,-.10);
  drum(cup,0,.138,0,.125,.103,.276,m.ochre);
  drum(cup,0,.276,0,.107,.114,.010,m.cream);
  drum(cup,0,.283,0,.091,.091,.004,m.soil);
  const handle=mesh(cup,own(new THREE.TorusGeometry(.075,.023,8,16)),m.ochre,.124,.16,0);handle.rotation.y=.22;
  // Adjustable brass reading lamp, warmed from below the green enamel shade.
  const lamp=group(model);lamp.position.set(2.70,.09,-2.98);
  drum(lamp,0,.12,0,.35,.45,.20,m.gold);
  drum(lamp,0,.238,0,.254,.335,.08,m.deep);
  rod(lamp,v(0,.24,0),v(.13,3.16,-.09),.068,m.gold);
  sphere(lamp,.13,3.16,-.09,.15,m.brass);
  rod(lamp,v(.13,3.16,-.09),v(-.29,4.17,-.17),.067,m.gold);
  rod(lamp,v(-.29,4.17,-.17),v(-.74,4.25,.035),.07,m.gold);
  const shade=group(lamp);shade.position.set(-.75,4.07,.10);shade.rotation.z=-.37;shade.rotation.x=-.13;
  drum(shade,0,.11,0,.115,.23,.20,m.deep);
  drum(shade,0,-.09,0,.228,.465,.34,m.teal);
  drum(shade,0,-.26,0,.458,.473,.04,m.brass);
  drum(shade,0,-.285,0,.414,.442,.03,m.cream);
  sphere(shade,0,-.298,0,.122,m.bulb);
  const lampLight=new THREE.PointLight(0xffaf55,25,7,2);lampLight.position.set(1.9,3.78,-2.84);scene.add(lampLight);
  const lampSpot=new THREE.SpotLight(0xffb362,23,8,.96,.98,2);
  lampSpot.position.copy(lampLight.position);lampSpot.target.position.set(.52,2.60,-1.98);scene.add(lampSpot,lampSpot.target);

  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=96;
  const gc=glowCanvas.getContext('2d'),gg=gc.createRadialGradient(48,48,0,48,48,47);
  gg.addColorStop(0,'rgba(255,224,153,.91)');gg.addColorStop(.17,'rgba(255,187,94,.57)');
  gg.addColorStop(.43,'rgba(248,143,52,.18)');gg.addColorStop(1,'rgba(239,107,35,0)');
  gc.fillStyle=gg;gc.fillRect(0,0,96,96);
  const glowMap=own(new THREE.CanvasTexture(glowCanvas));glowMap.colorSpace=THREE.SRGBColorSpace;
  const glowMat=own(new THREE.SpriteMaterial({map:glowMap,transparent:true,opacity:.69,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  function glow(p,x,y,z,size){
    const sprite=new THREE.Sprite(glowMat);p.add(sprite);sprite.position.set(x,y,z);sprite.scale.setScalar(size);return sprite;
  }
  glow(shade,0,-.36,.08,1.37);
  for(const x of [-1.82,-1.58,-1.34,1.34,1.58,1.82])glow(back,x,.31,.51,.22);
  for(const b of TABLE.bumpers){const p=deckPoint(b.x,b.y,.50);glow(deck,p.x,p.y,p.z,.23);}
  const chase=[];
  for(const [x,y,z] of [[-1.75,.21,1.1],[-1.76,.35,.22],[-1.72,.61,-.65],[-1.63,.75,-1.48],[-1.38,.79,-2.13]]){
    sphere(deck,x-.12,y,z,.043,m.bulb);chase.push(glow(deck,x-.12,y+.018,z,.12));
  }

  // Bake immobile objects by material to limit draw calls on phone GPUs.
  model.updateMatrixWorld(true);
  const batches=new Map(),parts=[];
  model.traverse(o=>{
    if(!o.isMesh)return;
    for(let p=o;p&&p!==model;p=p.parent)if(p.userData.mobile)return;
    const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    geometry.applyMatrix4(o.matrixWorld);
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    if(!batches.has(o.material))batches.set(o.material,[]);
    batches.get(o.material).push(geometry);parts.push(o);
  });
  parts.forEach(part=>part.removeFromParent());
  for(const [material,list] of batches) {
    const geometry=own(mergeGeometries(list));mesh(model,geometry,material,0,0,0);
    list.forEach(g=>g.dispose());
  }
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
  const cc=contactCanvas.getContext('2d'),cg=cc.createRadialGradient(64,64,2,64,64,64);
  cg.addColorStop(0,'rgba(8,19,13,.74)');cg.addColorStop(.35,'rgba(12,24,16,.54)');cg.addColorStop(1,'rgba(13,27,20,0)');
  cc.fillStyle=cg;cc.fillRect(0,0,128,128);
  const contactMap=own(new THREE.CanvasTexture(contactCanvas));
  const contactMaterial=own(new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}));
  for(const [x,z,w,d] of [[0,-.06,6.0,8.25],[-2.63,3.5,1.47,1.39],[2.71,3.05,1.48,1.5],[2.7,-2.98,1.16,1.16]]){
    const shadow=plane(model,x,.09,z,w,d,contactMaterial);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
  }
  return {model, deck, ball, bumpers, flippers, stationPoints, parking,
    setScore(score){updateScore(m.score.map,score);},
    travel(id,fraction){
      gate.rotation.y=id==='projects'?Math.min(1,fraction*6)*1.34:0;
      chase.forEach((s,i)=>s.scale.setScalar(id==='projects'?.12+.48*Math.max(0,1-Math.abs(fraction*.98-i*.16)*6):.12));
      dropTargets.forEach((d,i)=>{d.position.y=id==='experience'?-Math.max(0,Math.min(1,(fraction-.52-i*.09)*8))*.257:0;});
    },
    dispose() {model.removeFromParent();lampLight.removeFromParent();lampSpot.removeFromParent();lampSpot.target.removeFromParent();assets.forEach(a=>a.dispose());}
  };
}
