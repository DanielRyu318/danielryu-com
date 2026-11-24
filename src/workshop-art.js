import * as THREE from 'three';

function paint(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function seeded(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function path(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx, x, y, r, color) {
  path(ctx, [[x,y-r],[x+r*.2,y-r*.19],[x+r*.75,y],[x+r*.2,y+r*.16],[x,y+r],[x-r*.19,y+r*.16],[x-r*.75,y],[x-r*.19,y-r*.19]], color);
}

function pine(ctx, x, y, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - h * .025, y - h * .38, h * .05, h * .38);
  for (let i = 0; i < 3; i++) {
    const tip = y - h * (1 - i * .19), span = h * (.14 + i * .055);
    path(ctx, [[x,tip],[x+span,tip+h*.46],[x,tip+h*.42],[x-span,tip+h*.46]], color);
  }
}

function label(ctx, words, x, y, size, color, align = 'center', italic = false) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${italic ? 'italic ' : ''}900 ${size}px ${italic ? 'Georgia, serif' : 'Arial, sans-serif'}`;
  ctx.fillText(words, x, y);
}

export function backglassArt() {
  return paint(1024, 470, (c, w, h) => {
    const random = seeded(621);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,'#164943'); sky.addColorStop(.72,'#467369'); sky.addColorStop(1,'#faad72');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    for (let i=0;i<54;i++) star(c,random()*w,random()*h*.65,random()*3+1,'#e8d69a');
    circle(c,790,178,112,'#ffbc71');
    for(let i=0;i<7;i++) {
      const stripeY = 189+i*13, half = Math.sqrt(112**2-(stripeY-178)**2);
      c.fillStyle = '#de9170'; c.fillRect(790-half,stripeY,half*2,2+i*.4);
    }
    path(c, [[0,334],[111,263],[179,306],[287,241],[331,261],[396,225],[464,288],[546,241],[633,269],[770,138],[859,231],[918,195],[1024,270],[1024,470],[0,470]], '#c07d5f');
    path(c, [[515,344],[770,138],[734,221],[777,201],[707,267],[693,270],[638,324]], '#f4b47d');
    path(c, [[0,335],[135,271],[246,318],[350,283],[466,330],[601,260],[671,282],[809,211],[889,250],[966,220],[1024,249],[1024,470],[0,470]], '#7a8f78');
    path(c, [[0,377],[128,305],[273,356],[370,318],[508,357],[634,301],[721,334],[895,263],[1024,300],[1024,470],[0,470]], '#416f62');
    path(c, [[0,367],[133,339],[304,385],[416,355],[520,381],[663,340],[766,371],[940,309],[1024,299],[1024,470],[0,470]], '#24564d');
    c.fillStyle = '#deb779'; c.beginPath(); c.moveTo(675,340); c.bezierCurveTo(588,379,770,363,651,401); c.bezierCurveTo(605,420,715,432,772,470); c.lineTo(558,470); c.bezierCurveTo(573,438,565,418,626,395); c.bezierCurveTo(707,364,589,380,675,340); c.fill();
    for(let i=0;i<31;i++) {
      let x = i*37 - 20, edge = Math.abs(x/w-.5)*2;
      pine(c, x, h + random()*21, 30 + edge**2*160+random()*35, '#173e37');
    }
    c.save(); c.translate(50,35); c.rotate(-.032);
    label(c,'PINBALL',4,139,136,'#183d34','left');
    label(c,'PINBALL',0,132,136,'#ffe4ac','left');
    c.fillStyle = '#e1af78'; c.fillRect(14,163,87,4); c.fillRect(345,163,89,4);
    label(c,'W O R K S',223,179,39,'#f8d99b'); c.restore();
    star(c,925,73,19,'#ffe1a3'); star(c,609,41,9,'#ffe1a3');
    c.strokeStyle = '#e7bd80'; c.lineWidth=3; c.strokeRect(10,10,w-20,h-20);
  });
}

export function woodArt() {
  return paint(768,256,(c,w,h)=>{
    c.fillStyle='#b77148';c.fillRect(0,0,w,h);
    const random=seeded(101);
    for(let i=0;i<180;i++) {
      const y=random()*h, len=15+random()*w*.7, x=random()*w;
      c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+len*.17,y-4,x+len*.6,y+3,x+len,y-.5);
      c.strokeStyle = random()>.4?'rgba(82,39,20,.14)':'rgba(255,202,139,.15)';c.lineWidth=.4+random()*1.8;c.stroke();
    }
  });
}

export function sideArt() {
  return paint(1024,180,(c,w,h)=>{
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#184b45');sky.addColorStop(1,'#173b35');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(const [i,col] of ['#c17150','#e89f63','#eacf96'].entries()) {
      c.strokeStyle=col;c.lineWidth=13;c.beginPath();c.moveTo(-20,170-i*17);c.lineTo(222,170-i*17);c.bezierCurveTo(345,170-i*17,373,48-i*17,505,48-i*17);c.lineTo(1060,48-i*17);c.stroke();
    }
    star(c,105,61,37,'#eac892');star(c,150,72,10,'#eac892');star(c,866,98,15,'#d6a774');
    label(c,'PINBALL WORKS',486,137,45,'#edcf98','left');
    c.strokeStyle='#cfb382';c.lineWidth=2;c.strokeRect(5,5,w-10,h-10);
  });
}

export function fieldArt(table) {
  return paint(768,1344,(c,w,h)=>{
    const random=seeded(268), k=w/table.width;
    const surface=c.createLinearGradient(0,0,w,h);
    surface.addColorStop(0,'#226e65');surface.addColorStop(.58,'#41867a');surface.addColorStop(1,'#236456');c.fillStyle=surface;c.fillRect(0,0,w,h);
    for(let i=0;i<12000;i++) {c.fillStyle=i%2?'rgba(255,238,177,.045)':'rgba(13,50,42,.035)';c.fillRect(random()*w,random()*h,1+random()*3,2);}
    c.strokeStyle='#d3bc86';c.lineWidth=4;c.strokeRect(12,13,w-24,h-26);
    c.strokeStyle='#cbb784';c.lineWidth=1;c.strokeRect(19,20,w-38,h-40);
    for(let i=0;i<3;i++) {
      c.strokeStyle=['#e7c28b','#db8b5e','#d1b986'][i]; c.lineWidth=i===1?12:4;
      c.beginPath();c.moveTo(31+i*12,1065);c.bezierCurveTo(186+i*14,877,16+i*14,730,130+i*14,566);c.bezierCurveTo(276+i*14,382,221+i*14,230,350+i*14,98);c.stroke();
    }
    const cx=w*.485,cy=h*.58;
    for(let i=0;i<48;i++) {
      const a=i*Math.PI/24, r1=91, r2=i%4===0?144:108;
      c.beginPath();c.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);c.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);c.strokeStyle=i%4===0?'#f1d29d':'#a8b491';c.lineWidth=i%4===0?4:2;c.stroke();
    }
    for(const [radius,color] of [[85,'#d8bc83'],[79,'#255c52'],[73,'#cda46c'],[69,'#276359']]) circle(c,cx,cy,radius,color);
    path(c, [[cx-52,cy+23],[cx-13,cy-28],[cx+4,cy-8],[cx+21,cy-36],[cx+54,cy+23]],'#e7c18b');
    path(c, [[cx-13,cy-28],[cx-22,cy+3],[cx-9,cy-7],[cx-4,cy-1],[cx+3,cy-8]],'#fff0bd');
    star(c,cx-35,cy-24,9,'#e8cc8b');
    label(c,'D. RYU',cx,cy+43,17,'#f5dba4');
    label(c,'P I N B A L L   W O R K S',cx,cy+187,25,'#e7cd95');
    for(const b of table.bumpers) {
      const x=b.x*k,y=b.y*k,r=b.r*k;
      for(let i=0;i<3;i++){c.beginPath();c.arc(x,y,r+9+i*7,0,Math.PI*2);c.strokeStyle=i===1?'#f1d59b':'#c99366';c.lineWidth=i===1?4:2;c.stroke();}
    }
    for(let i=0;i<45;i++) {const x=40+random()*(w-150),y=100+random()*(h-200);if(Math.hypot(x-cx,y-cy)>180)star(c,x,y,2+random()*4,'#e0cc99');}
    for(let i=0;i<3;i++){const y=h*.77+i*22;path(c, [[cx-17,y+6],[cx,y-4],[cx+17,y+6],[cx,y]],'#dcb57e');}
  });
}

export function floorArt() {
  return paint(640, 840, (c,w,h)=>{
    const random=seeded(741);
    const tones=['#5c6250','#555e4f','#626652','#5d6251','#53604e','#656755','#59624f','#5b604f'];
    for(let i=0;i<8;i++){
      const end=164+(i*237)%535, x=i*80;
      c.fillStyle=tones[i];c.fillRect(x,0,80,h);
      c.fillStyle='#485144';c.fillRect(x,0,2,h);c.fillRect(x,end,80,2);
      c.fillStyle='rgba(231,211,165,.16)';c.fillRect(x+2,0,1,h);c.fillRect(x+2,end+2,76,1);
      for(let n=0;n<46;n++){
        const gx=x+5+random()*70, gy=random()*h-10, span=12+random()*90;
        c.beginPath();c.moveTo(gx,gy);c.bezierCurveTo(gx+2,gy+span*.27,gx-1,gy+span*.52,gx,gy+span);
        c.strokeStyle=n%3===0?'rgba(232,217,172,.13)':'rgba(36,53,38,.12)';c.lineWidth=.7+random();c.stroke();
      }
      for(const sy of [8,end-6,end+7,h-8]){
        circle(c,x+9,sy,1.5,'#494d40');circle(c,x+71,sy,1.5,'#494d40');
      }
    }
  });
}

export function scoreArt() {
  return paint(512,98,(c,w,h)=>{
    c.fillStyle='#1c2824';c.fillRect(0,0,w,h);
    c.strokeStyle='#ae8554';c.lineWidth=4;c.strokeRect(3,3,w-6,h-6);
    label(c,'DANIEL RYU',164,63,40,'#f1d198');
    for(let i=0;i<4;i++){c.fillStyle='#4f4c39';c.fillRect(326+i*39,19,33,62);label(c,'0',342+i*39,65,43,'#f0ba73');}
  });
}

export function updateScore(map, value) {
  const c=map.image.getContext('2d');
  const digits=String(Math.max(0,Math.floor(value))).padStart(4,'0').slice(-4);
  for(let i=0;i<4;i++){
    c.fillStyle='#4f4c39';c.fillRect(326+i*39,19,33,62);
    label(c,digits[i],342+i*39,65,43,'#f0ba73');
  }
  map.needsUpdate=true;
}

export function monitorArt() {
  return paint(384,212,(c,w,h)=>{
    c.fillStyle='#173c33';c.fillRect(0,0,w,h);c.strokeStyle='#54966d';c.lineWidth=1;
    for(let i=12;i<w;i+=24){c.beginPath();c.moveTo(i,67);c.lineTo(i,h-16);c.stroke();}
    for(let i=68;i<h;i+=23){c.beginPath();c.moveTo(10,i);c.lineTo(w-10,i);c.stroke();}
    c.lineWidth=6;c.strokeStyle='#f1c780';c.beginPath();c.moveTo(12,176);
    for(const [x,y] of [[67,155],[113,160],[153,128],[219,134],[261,96],[296,108],[368,65]])c.lineTo(x,y);c.stroke();
    label(c,'PROJECTS',17,48,40,'#f0ce88','left');
  });
}
