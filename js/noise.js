import { $, local, sfx } from './core.js';
import { Stage } from './stage.js';
import { potScene, W, H } from './scenes/pot.js';

let root = null;
let stage = null;
let zone = 'green';
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
    <div class="screen">
      <div class="bezel" id="noiseHost"><div class="say over" id="noiseMsg">시작 버튼을 누르면 마이크로 소리 크기를 재요</div></div>
    </div>
    <div class="controls">
      <button class="btn red huge" id="noiseGo">측정 시작</button>
      <span class="stat">빨간불 <b id="redCount">0</b>번</span>
      <button class="btn dark small" id="noiseClear">횟수 지우기</button>
    </div>
    <div class="controls tight">
      <label class="field">노란불 기준 <input type="range" id="optYellow" min="40" max="85"> <output id="outYellow"></output></label>
      <label class="field">빨간불 기준 <input type="range" id="optRed" min="45" max="95"> <output id="outRed"></output></label>
      <label class="check"><input type="checkbox" id="optBeep"> 빨간불이 2초 넘으면 경고음</label>
    </div>
    <p class="hint">숫자는 정확한 데시벨이 아니라 대략적인 값이에요.</p>
    <p class="form-error center" id="noiseErr" hidden></p>`;

  stage = new Stage($('#noiseHost', el), { w: W, h: H, reserve: 150 });
  stage.start(potScene(stage, () => ({ on: !!stream, level, zone, yellow: opts.yellow, red: opts.red, history })));

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
  };
  [y, r, b].forEach((x) => x.addEventListener('input', sync));
  sync();
}

export function leave() {
  stop();
  stage?.destroy();
  stage = root = null;
}


async function start() {
  const err = $('#noiseErr', root);
  err.hidden = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    err.textContent = '마이크를 쓸 수 없어요. 주소창 왼쪽 자물쇠를 눌러 마이크를 "허용"으로 바꿔 주세요.';
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
  $('#noiseGo', root).textContent = '측정 멈추기';
  loop();
}

function stop() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((tr) => tr.stop());
  actx?.close();
  stream = actx = analyser = null;
  if (root) {
    $('#noiseGo', root).textContent = '측정 시작';
    $('#noiseMsg', root).textContent = '시작 버튼을 누르면 마이크로 소리 크기를 재요';
    zone = 'green';
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
  const z = level >= opts.red ? 'red' : level >= opts.yellow ? 'yellow' : 'green';
  if (z !== zone || frame === 6) {
    const msg = $('#noiseMsg', root);
    msg.textContent = { green: '좋아요! 딱 좋은 목소리예요', yellow: '조금 시끄러워지고 있어요. 쉿!', red: '너무 시끄러워요! 냄비가 넘쳐요!' }[z];
    msg.classList.toggle('alert', z === 'red');
  }
  zone = z;

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

  if (frame % 18 === 0) {
    history.push(level);
    if (history.length > 120) history.shift();
  }
}
