import './stations.css';

const github = 'https://github.com/DanielRyu318';
const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const numbers = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const experiences = [
  {
    id: 'fidelity', name: 'Fidelity', role: 'Actuarial intern', organization: 'Fidelity Investments · Workplace Consulting', period: 'Joined June 2026',
    detail: 'I joined the Workplace Consulting team to work on pension valuations. My onboarding covered client data review, compliance requirements, and actuarial reporting in ProVal and Excel.',
    note: 'My assignments included retirement-plan true-ups, nondiscrimination testing, and Schedule SB preparation.',
  },
  {
    id: 'nobe', name: 'NOBE', role: 'Software developer', organization: 'National Organization for Business and Engineering', period: 'February–May 2026',
    detail: 'I worked with an asset management client to turn their spreadsheet-based reporting process into an AWS-hosted portfolio analytics platform. In project meetings, we translated the client’s questions into product requirements.',
    note: 'I built the upload workflow and logic for market value, cost basis, and capital gains. The client could review the results directly in the platform.',
  },
  {
    id: 'katusa', name: 'KATUSA', role: 'Army liaison', organization: 'Korean Augmentation to the United States Army', period: 'June 2023–December 2024',
    detail: 'I coordinated between Korean and U.S. Army units during training exercises and mentored three new KATUSA soldiers.',
    note: 'I also automated logistics status reports by combining and visualizing data from several sources. A report that once took four hours could be prepared in minutes.',
  },
];

const projects = [
  { slug: 'cline-financial', name: 'Cline Financial', description: 'How much of an account’s growth came from its investments? Add a deposit to this sample and follow the two readings.', render: renderFinancial },
  { slug: 'pinball-works', name: 'Pinball Works', description: 'A personal portfolio you can play. A steel ball carries you between stations on a miniature Three.js machine.', render: renderPinballProject },
  { slug: 'usage-dashboard', name: 'Usage dashboard', description: 'A reporting system for understanding when a facility gets busy and which customers return.', render: renderDashboard },
];

const voices = [
  { name: 'Rest', event: null, mark: '–' },
  { name: 'Click', event: 'flip', mark: 'Ⅰ' },
  { name: 'Thump', event: 'bumper', mark: '●' },
  { name: 'Clink', event: 'arrive', mark: '✦' },
];
const metrics = [
  ['score', 'Session score'], ['best', 'Best single ball'], ['launches', 'Balls launched'],
  ['hits', 'Targets hit'], ['visited', 'Stations visited'],
];

function title(heading, introduction = '') {
  return `<header class="st-heading"><h2 tabindex="-1">${heading}</h2>${introduction ? `<p>${introduction}</p>` : ''}</header>`;
}

function setPressed(group, selected) {
  for (const button of group.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.value === selected));
  }
}

function selectors(choices, selected, name) {
  return `<div class="st-selector" role="group" aria-label="${name}">${choices.map(([value, label]) =>
    `<button type="button" value="${value}" aria-pressed="${value === selected}">${label}</button>`).join('')}</div>`;
}

function external(url, label) {
  return `<a class="st-textlink" href="${url}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true">↗</span></a>`;
}

function onward(body, id, label, navigate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'st-onward';
  button.innerHTML = `<span>${label}</span><span aria-hidden="true">→</span>`;
  button.addEventListener('click', () => navigate(id));
  body.append(button);
}

function renderFinancial(area) {
  area.innerHTML = `<section class="st-instrument" aria-label="Sample account">
    <div class="st-readings">
      <div><span>Account balance</span><strong data-balance>$1,100</strong></div>
      <div><span>Time-weighted return</span><strong data-return>+10%</strong></div>
    </div>
    <div class="st-bars" role="img" aria-label="Starting balance $1,000. After growth $1,100. Current balance $1,100.">
      <div><i style="--level:62.5%"></i><span>Start</span></div>
      <div><i style="--level:68.75%"></i><span>After growth</span></div>
      <div><i class="st-final-bar" style="--level:68.75%"></i><span>Current</span></div>
    </div>
    <div class="st-demo-action"><button type="button" class="st-button" data-deposit>Add $500 deposit</button></div>
  </section>
  <p class="st-caption" data-observation role="status">The account started at $1,000 and earned $100.</p>
  <details class="st-project-notes"><summary>Project notes</summary>
    <p>My portfolio analytics work included an AWS-hosted upload and processing pipeline for an asset manager. The client could upload Excel data and inspect market value, cost basis, and capital gains in the browser.</p>
    <p>This sample isolates one accounting decision. The deposit starts a new measurement period. Linking each period’s return lets the account value change while preserving a measure of investment performance.</p>
  </details>`;

  const initial = 1000;
  const afterGrowth = 1100;
  const contribution = 500;
  let deposited = false;
  const action = area.querySelector('[data-deposit]');
  action.addEventListener('click', () => {
    deposited = !deposited;
    const cashFlow = deposited ? contribution : 0;
    const current = afterGrowth + cashFlow;
    const returnPct = ((afterGrowth / initial) * (current / (afterGrowth + cashFlow)) - 1) * 100;
    area.querySelector('[data-balance]').textContent = money.format(current);
    area.querySelector('[data-return]').textContent = `+${Math.round(returnPct)}%`;
    area.querySelector('.st-final-bar').style.setProperty('--level', `${current / (afterGrowth + contribution) * 100}%`);
    area.querySelector('.st-bars').setAttribute('aria-label', `Starting balance $1,000. After growth $1,100. Current balance ${money.format(current)}.`);
    area.querySelector('[data-observation]').textContent = deposited
      ? 'Balance $1,600. The $500 deposit is a cash flow. The investment earned the same $100, so its return holds at 10%.'
      : 'The account started at $1,000 and earned $100.';
    action.textContent = deposited ? 'Reset sample' : 'Add $500 deposit';
  });
}

function renderPinballProject(area, { navigate }) {
  area.innerHTML = `<dl class="st-details">
    <div><dt>World</dt><dd>Three.js renders the cabinet, lights, and moving parts in one scene. The camera travels between station views.</dd></div>
    <div><dt>Play</dt><dd>Flippers, rails, and bumpers share a physics simulation. A station hit lights up an invitation to explore while the ball keeps moving.</dd></div>
    <div><dt>Sound</dt><dd>The machine synthesizes its mechanical accents in the browser when sound is enabled.</dd></div>
  </dl>`;
  onward(area, 'table', 'Play the machine', navigate);
}

function renderDashboard(area) {
  area.innerHTML = `<dl class="st-details">
    <div><dt>Inputs</dt><dd>I connected session logs, transactions, customer activity, and inventory through a relational structure in Google Sheets.</dd></div>
    <div><dt>Decision</dt><dd>I separated raw inputs from cleaned tables and used time-overlap calculations to map each visit across the hours it occupied. This produced a usage heatmap by weekday and hour.</dd></div>
    <div><dt>Outcome</dt><dd>The dashboard helped inform a pricing change that increased overall facility usage by 15%.</dd></div>
  </dl>`;
}

function projectBench(body, options) {
  let selected = projects.find((project) => project.slug === options.project) ?? projects[0];
  body.innerHTML = selectors(projects.map((project) => [project.slug, project.name]), selected.slug, 'Choose a project')
    + '<div class="st-project"></div>';
  const buttons = body.querySelector('.st-selector');
  const projectArea = body.querySelector('.st-project');
  function show() {
    setPressed(buttons, selected.slug);
    projectArea.innerHTML = title(selected.name, selected.description) + '<div class="st-project-content"></div>';
    selected.render(projectArea.querySelector('.st-project-content'), options);
  }
  buttons.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.value === selected.slug) return;
    selected = projects.find((project) => project.slug === button.value);
    show();
    options.onProjectChange?.(selected.slug);
  });
  show();
  onward(body, 'experience', 'Continue to Experience', options.navigate);
}

function experienceBank(body, options) {
  body.innerHTML = title('Experience') + selectors(experiences.map((item) => [item.id, item.name]), experiences[0].id, 'Select an experience')
    + '<article class="st-nameplate" aria-live="polite"></article>';
  const group = body.querySelector('.st-selector');
  function select(entry) {
    setPressed(group, entry.id);
    body.querySelector('.st-nameplate').innerHTML = `<p class="st-label">${entry.period}</p><h3>${entry.role}</h3><p class="st-org">${entry.organization}</p><p>${entry.detail}</p><p>${entry.note}</p>`;
  }
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.getAttribute('aria-pressed') === 'true') return;
    options.sound?.('gate');
    select(experiences.find((entry) => entry.id === button.value));
  });
  select(experiences[0]);
  onward(body, 'hobbies', 'Follow the side lane', options.navigate);
}

function rhythmBench(body, options) {
  const pattern = [1, 0, 2, 3];
  let timer = null;
  let playing = false;
  body.innerHTML = title('The rhythm bench', 'Set four beats using sounds from the machine. Tap a beat to change its sound, then play the pattern.')
    + `<section class="st-rhythm" aria-label="Rhythm sequencer">
        <div class="st-pads">${pattern.map((_, index) => `<button type="button" data-pad="${index}"><small>Beat ${index + 1}</small><i aria-hidden="true"></i><strong></strong></button>`).join('')}</div>
        <button type="button" class="st-button" data-play>Play pattern</button>
      </section>
      <p class="st-caption">Enable cabinet sound to hear the pattern. The lights show each beat.</p>`;
  const pads = Array.from(body.querySelectorAll('[data-pad]'));
  const playButton = body.querySelector('[data-play]');
  function drawPad(index) {
    const voice = voices[pattern[index]];
    pads[index].querySelector('i').textContent = voice.mark;
    pads[index].querySelector('strong').textContent = voice.name;
    pads[index].setAttribute('aria-label', `Beat ${index + 1}, ${voice.name}. Change sound`);
  }
  function stop() {
    clearTimeout(timer);
    playing = false;
    pads.forEach((pad) => pad.classList.remove('st-playing'));
    playButton.textContent = 'Play pattern';
  }
  function beat(index) {
    if (!body.isConnected || index >= pads.length) { stop(); return; }
    pads.forEach((pad, position) => pad.classList.toggle('st-playing', position === index));
    const eventName = voices[pattern[index]].event;
    if (eventName) options.sound?.(eventName);
    timer = setTimeout(() => beat(index + 1), 380);
  }
  pads.forEach((pad, index) => {
    drawPad(index);
    pad.addEventListener('click', () => {
      pattern[index] = (pattern[index] + 1) % voices.length;
      drawPad(index);
      const eventName = voices[pattern[index]].event;
      if (!playing && eventName) options.sound?.(eventName);
    });
  });
  playButton.addEventListener('click', () => {
    if (playing) { stop(); return; }
    playing = true;
    playButton.textContent = 'Stop pattern';
    beat(0);
  });
  onward(body, 'stats', 'Visit the scoreboard', options.navigate);
  return stop;
}

export function updateStats(host, stats = {}) {
  for (const element of host.querySelectorAll('[data-st-metric]')) {
    const value = stats[element.dataset.stMetric];
    element.textContent = numbers.format(Number.isFinite(value) ? value : 0);
  }
}

function scoreboard(body, { stats, secret, navigate }) {
  body.innerHTML = title('Session stats', 'Read the counters from your time at the machine.')
    + `<dl class="st-scoreboard">${metrics.map(([key, label]) => `<div><dt>${label}</dt><dd data-st-metric="${key}">0</dd></div>`).join('')}</dl>`;
  if (secret) {
    body.insertAdjacentHTML('beforeend', '<aside class="st-note"><strong>Maintenance hatch open</strong><p>Inside the machine, the spring release, bumper, and ball cup each have a distinct voice. Try arranging them at the rhythm bench.</p></aside>');
    onward(body, 'hobbies', 'Try the rhythm bench', navigate);
  }
  updateStats(body, stats);
  onward(body, 'table', 'Return to the machine', navigate);
}

function profile(body) {
  body.innerHTML = title('Daniel Ryu', 'I study computer science and mathematics at the University of Illinois Urbana-Champaign.')
    + `<dl class="st-details">
        <div><dt>Education</dt><dd>B.S. in Computer Science + Mathematics<br>Expected May 2027</dd></div>
        <div><dt>Selected work</dt><dd>Portfolio analytics on AWS, relational data pipelines and interactive 3D for the web.</dd></div>
        <div><dt>Experience</dt><dd>Actuarial intern at Fidelity, software developer with NOBE, and KATUSA service.</dd></div>
        <div><dt>GitHub</dt><dd>${external(github, 'github.com/DanielRyu318')}</dd></div>
      </dl><a class="st-button" href="/daniel-ryu-resume.pdf" target="_blank" rel="noopener">Open résumé PDF <span aria-hidden="true">↗</span></a>`;
}

const stations = { projects: projectBench, experience: experienceBank, hobbies: rhythmBench, stats: scoreboard, resume: profile };
const mounted = new WeakMap();

export function renderStation(host, id, options = {}) {
  mounted.get(host)?.();
  const body = document.createElement('div');
  body.className = 'station-content';
  host.replaceChildren(body);
  const cleanup = stations[id]?.(body, { navigate: () => {}, ...options });
  const dispose = () => {
    cleanup?.();
    if (mounted.get(host) === dispose) mounted.delete(host);
  };
  mounted.set(host, dispose);
  return dispose;
}
