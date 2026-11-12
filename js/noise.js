import { $, local, sfx } from './core.js';

let root = null;
let stream = null;
let actx = null;
let analyser = null;
let raf = 0;
let level = 0; // 부드럽게 만든 데시벨 값
let history = [];
let redCount = 0;
let redSince = 0;
let wasRed = false;
let lastBeep = 0;
let opts = local.get('noise.opts', { yellow: 60, red: 72, beep: false });

export function enter(el) {
  root = el;
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>🚦 소음 측정</h1>
        <p class="muted">마이크로 교실 소리 크기를 재요. 숫자는 정확한 데시벨이 아니라 대략적인 값이에요.</p>
      </div>
    </header>
    <div class="stage noise-stage" id="noiseStage">
      <div class="lights">
        <span class="light red"></span>
        <span class="light yellow"></span>
        <span class="light green"></span>
      </div>
      <div class="noise-main">
        <div class="noise-db"><b id="dbNum">--</b><small>dB</small></div>
        <div class="noise-msg" id="noiseMsg">시작 버튼을 눌러 주세요</div>
        <div class="meter"><div class="meter-fill" id="meterFill"></div>
          <i class="mark y" id="markY"></i><i class="mark r" id="markR"></i></div>
        <canvas id="noiseGraph" width="800" height="140"></canvas>
      </div>
    </div>
    <div class="controls">
      <button class="btn primary huge" id="noiseGo">🎤 측정 시작</button>
      <span class="stat">빨간불 <b id="redCount">0</b>번</span>
      <button class="btn ghost" id="noiseClear">횟수 지우기</button>
    </div>
    <div class="controls toggles">
      <label class="field">🟡 노란불 기준 <input type="range" id="optYellow" min="40" max="85"> <output id="outYellow"></output></label>
      <label class="field">🔴 빨간불 기준 <input type="range" id="optRed" min="45" max="95"> <output id="outRed"></output></label>
      <label class="check"><input type="checkbox" id="optBeep"> 빨간불이 2초 넘으면 경고음</label>
    </div>
    <p class="form-error center" id="noiseErr" hidden></p>`;

  $('#noiseGo', el).addEventListener('click', () => (stream ? stop() : start()));
  $('#noiseClear', el).addEventListener('click', () => {
    redCount = 0;
    $('#redCount', root).textContent = 0;
  });
  const y = $('#optYellow', el);
  const r = $('#optRed', el);
  const b = $('#optBeep', el);
  y.value = opts.yellow;
  r.value = opts.red;
  b.checked = opts.beep;
  const sync = () => {
    let yv = +y.value;
    let rv = +r.value;
    if (rv <= yv) rv = yv + 2; // 빨간불 기준은 항상 노란불보다 높게
    r.value = rv;
    opts = { yellow: yv, red: +r.value, beep: b.checked };
    local.set('noise.opts', opts);
    $('#outYellow', el).textContent = opts.yellow;
    $('#outRed', el).textContent = opts.red;
    $('#markY', el).style.left = pct(opts.yellow) + '%';
    $('#markR', el).style.left = pct(opts.red) + '%';
  };
  [y, r, b].forEach((x) => x.addEventListener('input', sync));
  sync();
}

export function leave() {
  stop();
  root = null;
}

const pct = (db) => Math.max(0, Math.min(100, ((db - 30) / 70) * 100));

async function start() {
  const err = $('#noiseErr', root);
  err.hidden = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    err.textContent = '마이크를 쓸 수 없어요. 주소창 왼쪽 자물쇠 → 마이크 "허용"으로 바꿔 주세요.';
    err.hidden = false;
    return;
  }
  if (!root) return stop();
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 2048;
  actx.createMediaStreamSource(stream).connect(analyser);
  history = [];
  level = 40;
  $('#noiseGo', root).textContent = '⏹ 측정 멈추기';
  loop();
}

function stop() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((tr) => tr.stop());
  actx?.close();
  stream = actx = analyser = null;
  if (root) {
    $('#noiseGo', root).textContent = '🎤 측정 시작';
    $('#noiseStage', root).className = 'stage noise-stage';
    $('#noiseMsg', root).textContent = '시작 버튼을 눌러 주세요';
    $('#dbNum', root).textContent = '--';
    $('#meterFill', root).style.width = '0%';
  }
}

let frame = 0;
function loop() {
  if (!analyser || !root) return;
  raf = requestAnimationFrame(loop);
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  const rms = Math.sqrt(sum / buf.length);
  // 마이크 입력(0~1)을 대략적인 데시벨로 바꿈
  const db = Math.max(30, Math.min(100, 20 * Math.log10(rms || 1e-6) + 94));
  level += (db - level) * (db > level ? 0.25 : 0.06); // 올라갈 땐 빠르게, 내려갈 땐 천천히

  if (++frame % 6) return;
  const zone = level >= opts.red ? 'red' : level >= opts.yellow ? 'yellow' : 'green';
  $('#noiseStage', root).className = 'stage noise-stage z-' + zone;
  $('#dbNum', root).textContent = Math.round(level);
  $('#noiseMsg', root).textContent = { green: '좋아요! 딱 좋은 목소리 😊', yellow: '조금 시끄러워지고 있어요 🤫', red: '너무 시끄러워요! 🙉' }[zone];
  $('#meterFill', root).style.width = pct(level) + '%';

  const now = Date.now();
  if (zone === 'red') {
    if (!wasRed) {
      redSince = now;
      redCount++;
      $('#redCount', root).textContent = redCount;
    }
    if (opts.beep && now - redSince > 2000 && now - lastBeep > 4000) {
      lastBeep = now;
      sfx.warn();
    }
  }
  wasRed = zone === 'red';

  history.push(level);
  if (history.length > 200) history.shift();
  graph();
}

function graph() {
  const cv = $('#noiseGraph', root);
  const g = cv.getContext('2d');
  const { width: w, height: h } = cv;
  g.clearRect(0, 0, w, h);
  const yOf = (db) => h - (pct(db) / 100) * h;
  g.lineWidth = 1;
  g.setLineDash([6, 6]);
  for (const [db, color] of [[opts.yellow, '#ffc531'], [opts.red, '#ff5a4f']]) {
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(0, yOf(db));
    g.lineTo(w, yOf(db));
    g.stroke();
  }
  g.setLineDash([]);
  g.lineWidth = 3;
  g.strokeStyle = '#fff';
  g.lineJoin = 'round';
  g.beginPath();
  history.forEach((db, i) => {
    const x = (i / 199) * w;
    i ? g.lineTo(x, yOf(db)) : g.moveTo(x, yOf(db));
  });
  g.stroke();
}
