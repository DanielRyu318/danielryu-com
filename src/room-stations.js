import * as THREE from 'three';

const entries = [
  {
    action: 'fidelity', tab: 'FIDELITY', date: 'JUN 2026', role: 'Actuarial intern',
    lines: ['Pension valuations with Workplace Consulting.', 'Client data review and reporting in ProVal and Excel.'],
  },
  {
    action: 'nobe', tab: 'NOBE', date: 'FEB–MAY 2026', role: 'Software developer',
    lines: ['Built portfolio analytics for an asset manager.', 'Excel uploads fed an AWS platform for cost basis and gains.'],
  },
  {
    action: 'katusa', tab: 'KATUSA', date: '2023–2024', role: 'Army liaison',
    lines: ['Coordinated Korean and U.S. units during exercises.', 'Automated logistics reports from four hours to minutes.'],
  },
];

const deposit = 500;
const startingBalance = 1000;
const investmentGain = 100;

function lettering(ctx, value, x, y, maxWidth) {
  ctx.fillText(value, x, y, maxWidth);
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function canvasFace(width, height, lit = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = lit
    ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.86, metalness: 0.04 });
  return {
    material,
    draw(painter) {
      ctx.save();
      painter(ctx, width, height);
      ctx.restore();
      texture.needsUpdate = true;
    },
    dispose() { texture.dispose(); },
  };
}

function printPaper(ctx, width, height) {
  const paper = ctx.createLinearGradient(0, 0, width * .65, height);
  paper.addColorStop(0, '#f7e2b4');
  paper.addColorStop(.55, '#ecd09b');
  paper.addColorStop(1, '#d9b475');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  // Fixed fibres keep the same piece of stock on the press as its print changes.
  let seed = 7;
  ctx.fillStyle = '#80572a20';
  for (let i = 0; i < width * height / 190; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = (seed / 4294967296) * width;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillRect(x, (seed / 4294967296) * height, 2, 1);
  }
}

function screenReading(applied) {
  const value = startingBalance + investmentGain + (applied ? deposit : 0);
  return { balance: '$' + value.toLocaleString('en-US'), rate: '+' + (100 * investmentGain / startingBalance) + '%' };
}

function paintMonitor(ctx, w, h, awake, applied) {
  const glow = ctx.createRadialGradient(w * .47, h * .45, 4, w * .5, h * .5, w * .59);
  glow.addColorStop(0, awake ? '#452618' : '#341d13');
  glow.addColorStop(1, '#130e0b');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  if (!awake) {
    const trace = ctx.createLinearGradient(w * .12, 0, w * .88, 0);
    trace.addColorStop(0, '#7b431000');
    trace.addColorStop(.5, '#efa849');
    trace.addColorStop(1, '#7b431000');
    line(ctx, w * .12, h * .50, w * .88, h * .50, trace, 4);
    return;
  }
  const reading = screenReading(applied);
  const amber = '#ffcf80';
  const amberSoft = '#d6aa73';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = amber;
  ctx.shadowColor = '#ff9c43';
  ctx.shadowBlur = 6;
  ctx.font = 'bold 66px Consolas, monospace';
  lettering(ctx, 'CLINE FINANCIAL', 48, 83, w - 96);
  ctx.shadowBlur = 0;
  line(ctx, 48, 138, w - 48, 138, '#a66e39', 3);
  for (const [label, value, y] of [['Balance', reading.balance, 228], ['Time-weighted return', reading.rate, 325]]) {
    ctx.textAlign = 'left';
    ctx.font = label === 'Balance' ? '50px Consolas, monospace' : '39px Consolas, monospace';
    ctx.fillStyle = amberSoft;
    lettering(ctx, label, 48, y, w * .54);
    ctx.fillStyle = amber;
    ctx.textAlign = 'right';
    ctx.font = 'bold 81px Consolas, monospace';
    lettering(ctx, value, w - 48, y, w * .55);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eab578';
  ctx.beginPath();
  ctx.roundRect(48, 415, w - 96, 100, 10);
  ctx.fill();
  ctx.fillStyle = '#321b11';
  ctx.font = 'bold 50px Consolas, monospace';
  lettering(ctx, applied ? 'Reset sample' : '+ $500 deposit', w / 2, 466, w - 128);
  ctx.fillStyle = '#160c071c';
  for (let y = 1; y < h; y += 5) ctx.fillRect(0, y, w, 1);
}

function paintProof(ctx, w, h, entry) {
  printPaper(ctx, w, h);
  ctx.fillStyle = '#823e33';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px Georgia, serif';
  lettering(ctx, entry.tab, 38, 38);
  ctx.fillStyle = '#514134';
  ctx.font = '26px Georgia, serif';
  ctx.textAlign = 'right';
  lettering(ctx, entry.date, w - 38, 38);
  ctx.textAlign = 'left';
  line(ctx, 36, 66, w - 36, 66, '#a98159', 2);
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillStyle = '#352d22';
  lettering(ctx, entry.role, 36, 111, w - 72);
  ctx.font = '36px Georgia, serif';
  entry.lines.forEach((text, i) => lettering(ctx, text, 38, 178 + 48 * i, w - 76));
}

// Anchors are embedded in the room model. Their x/y scales match the usable face
// dimensions and their local +Z axis faces the reader.
export function createRoomStations({ screen, archive, switchAnchor }) {
  const owned = [];
  const materials = new Set();
  const textures = [];
  const pickables = [];
  let selected = entries[0];
  let deposited = false;
  let awake = false;
  let station = 'table';

  function add(parent, geometry, material, position, action) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    parent.add(mesh);
    owned.push(mesh);
    materials.add(material);
    if (action) {
      mesh.userData.action = action;
      pickables.push(mesh);
    }
    return mesh;
  }
  function surface(parent, w, h, position, pixels, action, lit = false) {
    const face = canvasFace(...pixels, lit);
    textures.push(face);
    add(parent, new THREE.PlaneGeometry(w, h), face.material, position, action);
    return face;
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0xb18339, roughness: .38, metalness: .64 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x9a7441, roughness: .84 });
  const monitor = surface(screen, .99, .99, [0, 0, .002], [864, 600], 'deposit', true);
  const proof = surface(archive, .96, .66, [0, .137, .010], [1100, 286]);
  add(archive, new THREE.BoxGeometry(.968, .682, .009), edge, [0, .135, .0043]);
  const tabOrder = [entries[1], entries[0], entries[2]];
  const tabs = tabOrder.map((entry, index) => {
    const x = (index - 1) * .326;
    add(archive, new THREE.BoxGeometry(.31, .221, .010), brass, [x, -.337, .006], entry.action);
    const face = surface(archive, .293, .187, [x, -.337, .012], [546, 137], entry.action);
    return { entry, face };
  });
  const plaque = surface(switchAnchor, 1, .94, [0, 0, .001], [520, 210], 'experience');
  plaque.draw((ctx, w, h) => {
    ctx.fillStyle = '#9f793d';
    ctx.fillRect(0, 0, w, h);
    const enamel = ctx.createLinearGradient(0, 8, 0, h);
    enamel.addColorStop(0, '#703d35');
    enamel.addColorStop(1, '#432622');
    ctx.fillStyle = enamel;
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f6d8a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 35px Georgia, serif';
    lettering(ctx, 'TO', 320, 67);
    ctx.font = 'bold 52px Georgia, serif';
    lettering(ctx, 'EXPERIENCE', 320, 130, 349);
  });

  // The flattened oval is the bushing; a tipped stem and a ball form the toggle.
  const bushing = add(switchAnchor, new THREE.SphereGeometry(1, 12, 8), brass, [-.34, 0, .002], 'experience');
  bushing.scale.set(.102, .20, .006);
  const stem = add(switchAnchor, new THREE.SphereGeometry(1, 12, 8), brass, [-.323, .034, .014], 'experience');
  stem.scale.set(.034, .060, .015);
  const knob = add(switchAnchor, new THREE.SphereGeometry(1, 16, 12), brass, [-.31, .066, .032], 'experience');
  knob.scale.set(.063, .136, .010);
  function resetPrint() {
    proof.draw((ctx, w, h) => paintProof(ctx, w, h, selected));
    for (const { entry, face } of tabs) {
      face.draw((ctx, w, h) => {
        printPaper(ctx, w, h);
        if (entry === selected) {
          ctx.fillStyle = '#733b31';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.fillStyle = entry === selected ? '#ffdfa7' : '#4d3529';
        ctx.font = 'bold 61px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lettering(ctx, entry.tab, w / 2, h / 2 + 3, w - 28);
      });
    }
  }
  function drawScreen() { monitor.draw((ctx, w, h) => paintMonitor(ctx, w, h, awake, deposited)); }
  function getSummary() {
    if (station === 'projects') {
      const reading = screenReading(deposited);
      return `Cline Financial sample account. Balance ${reading.balance}. Time-weighted return ${reading.rate}. ${deposited ? 'The $500 deposit is included.' : 'The account started at $1,000 and earned $100.'}`;
    }
    if (station === 'experience') return `${selected.tab}. ${selected.role}. ${selected.date}. ${selected.lines.join(' ')}`;
    return '';
  }
  function setStation(id) {
    station = id;
    if (id === 'projects' && !awake) { awake = true; drawScreen(); }
    return getSummary();
  }
  function getControls() {
    if (station === 'projects') return [
      { action: 'deposit', label: deposited ? 'Reset sample' : 'Add $500 deposit' },
      { action: 'experience', label: 'To Experience' },
    ];
    if (station === 'experience') return entries.map((entry) => ({
      action: entry.action, label: entry.tab, pressed: selected === entry,
    }));
    return [];
  }
  function activate(action) {
    if (station === 'projects' && action === 'experience') return { navigate: 'experience', sound: 'gate', announcement: 'To Experience' };
    if (station === 'projects' && action === 'deposit') {
      deposited = !deposited;
      drawScreen();
      return { sound: 'arrive', announcement: getSummary() };
    }
    const entry = entries.find((item) => item.action === action);
    if (station !== 'experience' || !entry) return null;
    selected = entry;
    resetPrint();
    return { sound: 'gate', announcement: getSummary() };
  }
  drawScreen();
  resetPrint();
  return {
    pickables, setStation, getControls, getSummary, activate,
    dispose() {
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose(); }
      for (const face of textures) face.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
