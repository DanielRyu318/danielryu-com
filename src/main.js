import { fillIcons, icon } from './icons.js';
import { createAudio } from './audio.js';
import { renderStation, updateStats } from './stations.js';

const get = (selector) => document.querySelector(selector);
const workshop = get('.workshop');
const intro = get('.introduction');
const focus = get('.station-focus');
const content = get('#station-content');
const launch = get('#launch');
const soundButton = get('#sound');
const prompt = get('#game-prompt');
const fallback = get('#scene-fallback');
const label = get('#station-label');
const audio = createAudio();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const stations = new Set(['table', 'projects', 'experience', 'hobbies', 'stats', 'resume']);
const titles = { table: 'Pinball Works', projects: 'Projects', experience: 'Experience', hobbies: 'Hobbies', stats: 'Stats', resume: 'Portfolio profile' };
const visited = new Set();
const stats = { score: 0, launches: 0, hits: 0, best: 0, visited: 0 };
let scene;
let mode = 'ready';
let current = 'table';
let version = 0;
let secret = false;
let cleanup;
let promptTimer;
let unavailable = false;
let soundWanted = false;
try { soundWanted = localStorage.getItem('pw-sound') === 'on'; } catch {}
fillIcons();

function showSound() {
  soundButton.setAttribute('aria-pressed', String(soundWanted));
  soundButton.innerHTML = icon(soundWanted ? 'sound' : 'muted') + '<span>Sound ' + (soundWanted ? 'on' : 'off') + '</span>';
}
showSound();
soundButton.addEventListener('click', async () => {
  soundWanted = !soundWanted;
  showSound();
  if (soundWanted) {
    soundWanted = await audio.enable(true);
    if (soundWanted) audio.play('arrive');
    else get('#announcement').textContent = 'Audio is unavailable in this browser.';
  } else await audio.enable(false);
  try { localStorage.setItem('pw-sound', soundWanted ? 'on' : 'off'); } catch {}
  showSound();
});
function unlockAudio(event) {
  if (soundWanted && !soundButton.contains(event.target)) audio.enable(true);
}
document.addEventListener('pointerdown', unlockAudio, {once:true});
document.addEventListener('keydown', unlockAudio, {once:true});

function announce(message) { get('#announcement').textContent = message; }
function labelStation(id) {
  label.hidden = true;
  if (!scene || !id || current !== 'table') return;
  const point = scene.projectTarget(id);
  if (!point) return;
  const surface = get('#scene');
  label.style.left = (surface.offsetLeft + point.x * surface.clientWidth) + 'px';
  label.style.top = (surface.offsetTop + point.y * surface.clientHeight) + 'px';
  label.textContent = titles[id];
  label.hidden = false;
}
for (const card of document.querySelectorAll('[data-station]')) {
  card.setAttribute('aria-label', 'Explore ' + titles[card.dataset.station]);
  for (const event of ['mouseenter','focus']) card.addEventListener(event, () => labelStation(card.dataset.station));
  for (const event of ['mouseleave','blur']) card.addEventListener(event, () => labelStation(null));
}
function setStats(raw = {}) {
  stats.launches = raw.launches ?? stats.launches;
  stats.hits = raw.bumperHits ?? stats.hits;
  stats.best = raw.highScore ?? stats.best;
  if (current === 'stats') updateStats(content, stats);
}
function showControls() {
  const label = mode === 'paused' ? 'Resume ball' : mode === 'playing' ? 'Ball in play' : 'Launch ball';
  launch.querySelector('span').textContent = label;
  launch.disabled = unavailable || mode === 'playing';
  get('#hud-launch').disabled = launch.disabled;
  get('#hud-launch').setAttribute('aria-label', label);
}
function hidePrompt() { clearTimeout(promptTimer); prompt.hidden = true; }
function showPrompt(id, message) {
  if (current !== 'table') return;
  hidePrompt();
  prompt.replaceChildren();
  const link = document.createElement('a');
  link.href = '#' + id;
  link.textContent = message;
  prompt.append(link);
  prompt.hidden = false;
  promptTimer = setTimeout(() => { if (!prompt.contains(document.activeElement)) hidePrompt(); }, 4800);
}
function routeFromLocation() {
  const [raw, project] = location.hash.slice(1).split('/');
  return { id: stations.has(raw) ? raw : 'table', project: raw === 'projects' ? project : undefined };
}
function navigate(id) {
  if (!stations.has(id)) return;
  if (location.hash === '#' + id) return;
  history.pushState(null, '', '#' + id);
  displayRoute();
}
function showStation(id, project) {
  cleanup?.();
  cleanup = undefined;
  content.replaceChildren();
  intro.hidden = id !== 'table';
  focus.hidden = id === 'table';
  workshop.classList.toggle('is-station', id !== 'table');
  if (id === 'table') return;
  visited.add(id);
  stats.visited = visited.size;
  cleanup = renderStation(content, id, {
    navigate, stats, secret, project,
    sound: (name) => audio.play(name),
    onProjectChange(slug) { history.pushState(null, '', '#projects/' + slug); }
  });
}
async function displayRoute(initial = false) {
  const request = ++version;
  const { id, project } = routeFromLocation();
  const previous = current;
  current = id;
  label.hidden = true;
  hidePrompt();
  // Stop station instruments as soon as a visitor decides to leave.
  cleanup?.();
  cleanup = undefined;
  for (const link of document.querySelectorAll('[data-station]')) {
    if (link.dataset.station === id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  document.title = (id === 'table' ? '' : titles[id] + ' · ') + 'Pinball Works — Daniel Ryu';
  if (!initial && window.scrollY > workshop.offsetTop) window.scrollTo({top:0, behavior:'instant'});
  if (scene && (id !== previous || initial)) {
    await scene.goTo(id === 'resume' ? 'table' : id, {instant:initial || motion.matches});
  }
  if (request !== version) return;
  showStation(id, project);
  if (!initial) {
    if (id === 'table') launch.focus({preventScroll:true});
    else content.querySelector('h2')?.focus({preventScroll:true});
    announce(id === 'table' ? 'Workshop floor' : titles[id] + ' station');
  }
}
document.addEventListener('click', (event) => {
  const a = event.target.closest('a[href^="#"]');
  if (!a || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const id = a.hash.slice(1);
  if (!stations.has(id)) return;
  event.preventDefault();
  navigate(id);
});
window.addEventListener('popstate', () => displayRoute());
window.addEventListener('hashchange', () => {
  // Browser history traversal also dispatches popstate. Manual hash changes may dispatch only hashchange.
  if (routeFromLocation().id !== current) displayRoute();
});

function fallbackMode() {
  unavailable = true;
  fallback.hidden = false;
  get('#scene').hidden = true;
  get('.scene-controls').hidden = true;
  launch.disabled = true;
  launch.querySelector('span').textContent = '3D unavailable';
  launch.title = 'WebGL is unavailable. Choose a station to explore the portfolio.';
}
fallback.hidden = false;
const sceneReady = import('./workshop.js').then(({ createWorkshop }) => {
  scene = createWorkshop(get('#scene'), {
    reducedMotion: motion.matches,
    onPick: navigate,
    onHover: labelStation,
    onHit: id => showPrompt(id, 'Explore ' + titles[id] + ' ↗'),
    onSecret() { secret = true; showPrompt('stats', 'Secret unlocked · View scoreboard ↗'); },
    onSound: (name, strength) => audio.play(name, strength),
    onScore(value, raw) {
      stats.score = value;
      get('#score').value = String(value).padStart(6, '0');
      setStats(raw);
    },
    onState(value, raw) { mode = value; setStats(raw); showControls(); }
  });
  fallback.hidden = true;
  const id = routeFromLocation().id;
  if (id !== 'table') scene.goTo(id === 'resume' ? 'table' : id, {instant:true});
}).catch(error => {
  console.warn('Could not initialize the 3D workshop.', error);
  fallbackMode();
});
async function launchBall() {
  await sceneReady;
  if (!scene || current !== 'table') return;
  if (mode === 'paused') scene.resume();
  else if (mode === 'ready') scene.launch();
}
launch.addEventListener('click', launchBall);
get('#hud-launch').addEventListener('click', launchBall);
for (const btn of document.querySelectorAll('[data-flip]')) {
  const side = btn.dataset.flip;
  btn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    btn.setPointerCapture(event.pointerId);
    scene?.flip(side, true);
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) btn.addEventListener(name, () => scene?.flip(side, false));
  btn.addEventListener('click', (event) => {
    if (event.detail === 0) { scene?.flip(side, true); setTimeout(() => scene?.flip(side, false), 100); }
  });
}
function gameKey(event, down) {
  if (current !== 'table' || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
  if (event.code === 'Space') {
    if (event.target.closest('button,a')) return;
    event.preventDefault();
    if (down && !event.repeat) launchBall();
  } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    scene?.flip(event.code === 'ArrowLeft' ? 'left' : 'right', down);
  }
}
document.addEventListener('keydown', (event) => gameKey(event, true));
document.addEventListener('keyup', (event) => gameKey(event, false));
window.addEventListener('blur', () => { scene?.flip('left', false); scene?.flip('right', false); });
displayRoute(true);
