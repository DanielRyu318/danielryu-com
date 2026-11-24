import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { indexLinks, indexStations, indexSummary, records } from './room-index-data.js';

const WIDTH = 1536, HEIGHT = 496;
const paper = '#e9d9ad', ink = '#202f32', gold = '#cba16a';
const pageNames = { education: 'Education', resume: 'Résumé', contact: 'Contact' };

function canvas(width, height) {
  const el = document.createElement('canvas');
  el.width = width; el.height = height;
  return el;
}

function star(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2;
    const r = i % 2 ? radius * .22 : radius;
    const dx = x + Math.cos(a) * r, dy = y + Math.sin(a) * r;
    if (i) ctx.lineTo(dx, dy); else ctx.moveTo(dx, dy);
  }
  ctx.closePath(); ctx.fill();
}

function arc(ctx, x, y, r, a, b) {
  ctx.beginPath(); ctx.arc(x, y, r, a, b); ctx.stroke();
}

// Brass scales, a printed midnight sky and a mountain silhouette belong to
// the instrument's idle leaf. Its working leaves use the same ticket stock.
function dial(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#101e32'); sky.addColorStop(.63, '#234046'); sky.addColorStop(1, '#916e51');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  const cx = WIDTH / 2, cy = HEIGHT * 1.16;
  ctx.strokeStyle = '#a99a68'; ctx.lineWidth = 1.5;
  for (const r of [352, 387, 445, 464, 485, 514]) arc(ctx, cx, cy, r, Math.PI, 2 * Math.PI);
  for (let i = 0; i <= 90; i++) {
    const a = Math.PI + i * Math.PI / 90;
    const inner = i % 5 ? 457 : 446;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * 463, cy + Math.sin(a) * 463); ctx.stroke();
  }
  let seed = 37;
  const random = () => {seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296;};
  ctx.fillStyle = '#edd5a5';
  for (let i = 0; i < 116; i++) {
    const x = random() * WIDTH, y = random() * HEIGHT * .85;
    const r = 1 + random() * 2.3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (const side of [0,1]) {
    ctx.save(); if (side) { ctx.translate(WIDTH, 0); ctx.scale(-1, 1); }
    const points = [[45,220], [120,155], [188,178], [258,79], [310,115]];
    ctx.lineWidth = 2; ctx.strokeStyle = '#ceb789'; ctx.beginPath();
    points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.stroke();
    ctx.fillStyle = '#ffe7ad';points.forEach(([x,y], i) => star(ctx,x,y, i===3?13:7));
    ctx.restore();
  }
  for (const [base, amp, color] of [[382, 80, '#596b64'], [405, 61, '#435b56'], [445, 73, '#2b4544'], [476, 58, '#1f3337']]) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH + 30; x += 30) {
      const ridge = Math.sin(x * .009 + base) * .37 + Math.sin(x * .023 - base) * .29 + random() * .30;
      ctx.lineTo(x, base - amp * ridge);
    }
    ctx.lineTo(WIDTH,HEIGHT); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.shadowColor = '#101d28'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#f9e6b9'; ctx.font = 'bold 143px Georgia, serif';
  ctx.fillText('NIGHT SHIFT', cx, 288, WIDTH - 340);
  ctx.shadowBlur = ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#e5c891'; ctx.font = 'bold 37px Georgia, serif';
  ctx.fillText('D A N I E L   R Y U', cx, 365);
  ctx.fillStyle = '#eed1a2';star(ctx, cx, 127, 19);
  ctx.restore();
}

function card(ctx, id) {
  const r = records[id];
  const shade = ctx.createLinearGradient(0,0,WIDTH,HEIGHT);
  shade.addColorStop(0,'#f0e2be'); shade.addColorStop(.73,paper); shade.addColorStop(1,'#ceb686');
  ctx.fillStyle = shade; ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.fillStyle = '#213e43'; ctx.fillRect(0,0,28,HEIGHT);
  ctx.strokeStyle = '#a88b58'; ctx.lineWidth = 2; ctx.strokeRect(45,16,WIDTH-64,HEIGHT-33);
  const x = 91;
  ctx.fillStyle = '#81523a'; ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText(r.heading.toUpperCase(),x,79);
  ctx.fillStyle = ink; ctx.font = 'bold 98px Georgia, serif';
  ctx.fillText(r.title,x,192,WIDTH-320);
  const bodyY = r.subtitle ? 333 : 305;
  if (r.subtitle) {
    ctx.font = 'italic 57px Georgia, serif'; ctx.fillStyle = '#52635c';
    ctx.fillText(r.subtitle,x,255,WIDTH-240);
  }
  ctx.font = id==='exams' ? 'bold 88px Georgia, serif' : '73px Georgia, serif';
  ctx.fillStyle = ink;
  r.lines.forEach((line,i)=>ctx.fillText(line,x,bodyY+86*i,WIDTH-155));
  ctx.save(); ctx.translate(WIDTH-120,99);
  ctx.strokeStyle = '#a28859'; ctx.lineWidth = 2;
  arc(ctx,0,0,51,0,Math.PI*2); arc(ctx,0,0,41,0,Math.PI*2);
  ctx.fillStyle = '#906a40'; star(ctx,0,0,29); ctx.restore();
}

function textureFor(canvasElement) {
  const texture = new THREE.CanvasTexture(canvasElement);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

// A single physical reader serves all record stations. The paper advances
// between two rollers; the cabinet and its controls stay fixed in the room.
export function createRoomIndex(scene) {
  const group = new THREE.Group();
  group.name = 'Night Shift instrument';
  group.position.set(0,1.342,-.998);
  group.rotation.x = -.22;
  scene.add(group);
  const meshes = [], textures = [], materials = new Set(), pickables = [], points = new Map();
  const mat = (color, roughness = .53, metalness = .06) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wood = mat(0x53352b), dark = mat(0x122329,.52,.22);
  const brass = mat(0xac8050,.31,.72), bronze = mat(0x6e5642,.48,.54);
  const cream = mat(0xd3b481,.63), steel = mat(0x4c5653,.48,.66);
  function put(parent, geometry, material, x,y,z, action) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z); parent.add(mesh); meshes.push(mesh); materials.add(material);
    if (action) {mesh.userData.action=action; pickables.push(mesh);}
    return mesh;
  }
  function block(parent,x,y,z,w,h,d,m, action) {
    return put(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(.009,d*.26,h*.18)),m,x,y,z,action);
  }
  function plane(parent,x,y,z,w,h,canvasElement,action) {
    const texture=textureFor(canvasElement);textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
    return put(parent,new THREE.PlaneGeometry(w,h),material,x,y,z,action);
  }
  function roller(x,y,z,length,radius,material) {
    const obj=put(group,new THREE.CylinderGeometry(radius,radius,length,20),material,x,y,z);
    obj.rotation.z=Math.PI/2;
    return obj;
  }
  block(group,0,0,-.022,.902,.455,.139,wood);
  block(group,0,.002,.041,.868,.432,.030,brass);
  block(group,0,.004,.054,.851,.418,.016,dark);
  block(group,0,.069,.066,.793,.258,.012,bronze);
  for(const x of [-.431,.431]){
    block(group,x,.004,.047,.023,.426,.033,wood);
    for(const y of [-.191,.199]) {
      const screw = put(group,new THREE.CylinderGeometry(.0047,.0047,.0036,12),brass,x,y,.066);
      screw.rotation.x=Math.PI/2;
    }
  }
  for(const y of [-.062,.200]) roller(0,y,.077,.806,.0052,brass);

  const leaves = new Map();
  for(const key of ['table',...Object.keys(records)]){
    const leaf=canvas(WIDTH,HEIGHT), ctx=leaf.getContext('2d');
    if(key==='table')dial(ctx);else card(ctx,key);
    leaves.set(key,leaf);
  }
  const display=canvas(WIDTH,HEIGHT), displayCtx=display.getContext('2d');
  const face=plane(group,0,.069,.073,.776,.247,display);
  const keys=new THREE.Group();group.add(keys);
  roller(0,-.102,.060,.750,.014,steel);
  for(const x of [-.386,.386])
    roller(x,-.102,.061,.023,.024,brass);
  const selectors=[];

  function key(parent,x,y,width,label,action,selector=false) {
    const holder=new THREE.Group(); holder.position.set(x,y,.083); parent.add(holder);
    block(holder,0,0,-.003,width+.008,.053,.021,bronze,action);
    const fill=selector?cream:brass;
    block(holder,0,0,.006,width,.046,.022,fill,action);
    const labelCanvas=canvas(Math.round(320*width/.129),105);
    const ctx=labelCanvas.getContext('2d'), w=labelCanvas.width,h=labelCanvas.height;
    const paint=pressed=>{
      ctx.fillStyle=pressed?'#244b49':selector?'#e6d0a2':'#b68c56';
      ctx.fillRect(0,0,w,h);ctx.strokeStyle=pressed?'#d3ac6d':'#8e6e46';ctx.lineWidth=2;
      ctx.strokeRect(3,3,w-6,h-6);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='bold 51px Georgia, serif';ctx.fillStyle=pressed?'#ffe9b9':'#302c23';
      ctx.fillText(label,w/2,h*.52,w-20);
    };
    paint(false);
    const print=plane(holder,0,0,.0174,width-.003,.042,labelCanvas,action);
    return {action,holder,point:print,paint(pressed){paint(pressed);print.material.map.needsUpdate=true;}};
  }
  indexStations.forEach((id,i)=>{
    const selector=key(group,(i-1)*.244,-.169,.225,pageNames[id],id,true);
    selectors.push(selector);
    points.set(id,selector.point);
  });
  const byRecord=new Map();
  for(const [id,r] of Object.entries(records)){
    const row=new THREE.Group(); keys.add(row);
    const stride=r.actions.length===1?.31:.247;
    r.actions.forEach(({action,label},i)=>{
      const button=key(row,(i-(r.actions.length-1)/2)*stride,-.103,stride-.018,label,action);
      points.set(action,button.point);
    });
    row.traverse(obj=>{
      if(obj.userData.action){obj.userData.recordAction=obj.userData.action;delete obj.userData.action;}
    });
    row.visible=false;byRecord.set(id,row);
  }
  let station='table',target='table',from='table',started=0;
  displayCtx.drawImage(leaves.get('table'),0,0);face.material.map.needsUpdate=true;
  function advance(key, instant=false) {
    if(key===target)return;
    from=target;target=key;
    started=performance.now();
    for(const [id,row] of byRecord){
      row.visible=id===key;
      row.traverse(obj=>{
        if(obj.userData.recordAction)obj.userData.action=row.visible?obj.userData.recordAction:null;
      });
    }
    for(const selector of selectors)selector.paint(selector.action===station);
    if(instant)started=0;
    update();
  }
  function update(){
    const t=started?Math.min(1,(performance.now()-started)/235):1;
    if(from===target)return;
    const s=t*t*(3-2*t), offset=Math.round(s*HEIGHT);
    displayCtx.drawImage(leaves.get(from),0,-offset);
    displayCtx.drawImage(leaves.get(target),0,HEIGHT-offset);
    face.material.map.needsUpdate=true;
    if(t===1)from=target;
  }
  function setStation(id){
    const previous=station;
    station=id;
    if(id!==previous)advance(indexStations.includes(id)?id:'table',window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return indexSummary(target);
  }
  function getControls(){
    if(!indexStations.includes(station))return [];
    return [
      ...records[target].actions,
      ...indexStations.filter(id=>id!==station).map(action=>({action,label:pageNames[action]})),
      {action:'return-'+station,label:'Pull to return to the table'},
    ];
  }
  function activate(action){
    if(!indexStations.includes(station))return null;
    if(station==='education'&&(action==='exams'||action==='study')){
      advance(action==='exams'?'exams':'education',window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      return {sound:'gate',announcement:indexSummary(target)};
    }
    if(indexStations.includes(action))return {navigate:action,sound:'gate',announcement:pageNames[action]};
    const link=indexLinks[action];
    return link && records[target].actions.some(a=>a.action===action)
      ? {url:link.url,sound:'gate',announcement:link.label} : null;
  }
  return {pickables,update,setStation,getControls,activate,getSummary:()=>indexSummary(target),
    actionPosition:action=>points.get(action)?.getWorldPosition(new THREE.Vector3())??null,
    dispose(){
      group.removeFromParent();
      for(const mesh of meshes)mesh.geometry.dispose();
      for(const m of materials)m.dispose();
      for(const texture of textures)texture.dispose();
    },
  };
}
