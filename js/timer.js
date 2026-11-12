import { $, local, sfx, isMuted, modal } from './core.js';
import { Stage } from './stage.js';
import { fuseScene, W, H } from './scenes/fuse.js';

// 타이머는 다른 화면으로 가도 계속 돌아가도록 화면과 따로 관리
const t = {
  total: local.get('timer.total', 300), // 처음 맞춘 시간(초)
  remain: local.get('timer.total', 300),
  running: false,
  ringing: false,
  endAt: 0,
};
let opts = local.get('timer.opts', { sound: true, warn1: true, last10: true });
let lastSec = -1;
let ringTimer = 0;
const tickers = new Set();
export const onTick = (fn) => (tickers.add(fn), () => tickers.delete(fn));
const emit = () => tickers.forEach((fn) => fn(t));

export function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const beep = (fn) => opts.sound && fn();

function loop() {
  if (!t.running) return;
  t.remain = Math.max(0, (t.endAt - Date.now()) / 1000);
  const sec = Math.ceil(t.remain);
  if (sec !== lastSec) {
    if (lastSec !== -1) {
      if (opts.warn1 && sec === 60 && t.total > 60) beep(sfx.warn);
      if (opts.last10 && sec <= 10 && sec > 0) beep(() => sfx.tick(sec <= 3 ? 1.5 : 1));
    }
    lastSec = sec;
    document.title = `${fmt(t.remain)} · 타이머`;
  }
  if (t.remain <= 0) {
    t.running = false;
    t.ringing = true;
    document.title = '시간 끝!';
    beep(sfx.alarm);
    // 끌 때까지 알람 반복 (최대 1분)
    let n = 0;
    clearInterval(ringTimer);
    ringTimer = setInterval(() => {
      if (!t.ringing || ++n > 40) return stopRing();
      beep(sfx.alarm);
    }, 1500);
  }
  emit();
}
setInterval(loop, 200);

function stopRing() {
  clearInterval(ringTimer);
  if (t.ringing) {
    t.ringing = false;
    t.remain = t.total;
    document.title = '6개장 4발면 · 6학년 4반';
    emit();
  }
}

function start() {
  if (t.ringing) stopRing();
  if (t.remain <= 0) t.remain = t.total;
  if (t.remain <= 0) return;
  t.endAt = Date.now() + t.remain * 1000;
  t.running = true;
  lastSec = -1;
  sfx.unlock();
  emit();
}
function pause() {
  t.running = false;
  emit();
}
function reset() {
  stopRing();
  t.running = false;
  t.remain = t.total;
  document.title = '6개장 4발면 · 6학년 4반';
  emit();
}
function setTotal(sec) {
  stopRing();
  t.running = false;
  t.total = Math.max(0, Math.min(sec, 99 * 60 + 59));
  t.remain = t.total;
  local.set('timer.total', t.total);
  emit();
}
// 시간 더하기/빼기 (돌아가는 중에도 가능)
function add(sec) {
  if (t.ringing) stopRing();
  const next = Math.max(0, Math.min(t.remain + sec, 99 * 60 + 59));
  t.remain = next;
  if (t.running) t.endAt = Date.now() + next * 1000;
  else {
    t.total = Math.round(next);
    local.set('timer.total', t.total);
  }
  if (t.remain > t.total) t.total = Math.round(t.remain);
  lastSec = -1;
  emit();
}

/* ---------- 화면 ---------- */
let root = null;
let off = null;
let stage = null;

export function enter(el) {
  root = el;
  el.innerHTML = `
    <div class="screen">
      <div class="bezel" id="timerHost" title="눌러서 시간 직접 입력"></div>
    </div>
    <div class="controls">
      <button class="btn small" data-add="-60">-1분</button>
      <button class="btn small" data-add="-10">-10초</button>
      <button class="btn red huge" id="timerGo">시작 <kbd>Space</kbd></button>
      <button class="btn small" data-add="10">+10초</button>
      <button class="btn small" data-add="60">+1분</button>
    </div>
    <div class="controls tight">
      <button class="btn dark small" id="timerReset">처음으로</button>
      <span class="presets">
        ${[1, 3, 5, 10, 15, 20, 30].map((m) => `<button class="btn dark small" data-min="${m}">${m}분</button>`).join('')}
      </span>
      <button class="btn dark small" id="timerEdit">직접 입력</button>
    </div>
    <div class="controls tight">
      <label class="check"><input type="checkbox" id="optSound"> 경고음 켜기</label>
      <label class="check"><input type="checkbox" id="optWarn1"> 1분 남았을 때 알림</label>
      <label class="check"><input type="checkbox" id="optLast10"> 마지막 10초 똑딱 소리</label>
    </div>
    <p class="hint" id="timerHint"></p>`;

  stage = new Stage($('#timerHost', el), { w: W, h: H, reserve: 150 });
  stage.start(fuseScene(stage, () => t));
  stage.canvas.style.cursor = 'pointer';
  stage.canvas.addEventListener('click', () => !t.running && !t.ringing && editTime());

  el.addEventListener('click', onClick);
  for (const [id, key] of [['optSound', 'sound'], ['optWarn1', 'warn1'], ['optLast10', 'last10']]) {
    const box = $('#' + id, el);
    box.checked = opts[key];
    box.addEventListener('change', () => {
      opts[key] = box.checked;
      local.set('timer.opts', opts);
      if (key === 'sound' && box.checked) sfx.warn();
      render();
    });
  }
  addEventListener('keydown', onKey);
  off = onTick(render);
  render();
}

export function leave() {
  removeEventListener('keydown', onKey);
  off?.();
  stage?.destroy();
  stage = root = null;
}

function onKey(e) {
  if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggle();
  }
  if (e.code === 'ArrowUp') add(60);
  if (e.code === 'ArrowDown') add(-60);
}

function toggle() {
  if (t.ringing) stopRing();
  else if (t.running) pause();
  else start();
}

function onClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.add) add(+b.dataset.add);
  else if (b.dataset.min) setTotal(+b.dataset.min * 60);
  else if (b.id === 'timerGo') toggle();
  else if (b.id === 'timerReset') reset();
  else if (b.id === 'timerEdit') editTime();
}

// 시간을 직접 입력
function editTime() {
  if (t.running) pause();
  const m = Math.floor(t.remain / 60);
  const s = Math.round(t.remain % 60);
  const dlg = modal(`
    <h2>시간 직접 입력</h2>
    <form class="stack" id="timeForm">
      <div class="row">
        <label class="field"><input id="inMin" type="number" min="0" max="99" value="${m}"> 분</label>
        <label class="field"><input id="inSec" type="number" min="0" max="59" value="${s}"> 초</label>
      </div>
      <div class="row end">
        <button type="button" class="btn" data-close>취소</button>
        <button class="btn red">맞추기</button>
      </div>
    </form>`);
  $('#inMin', dlg).select();
  $('#timeForm', dlg).addEventListener('submit', (e) => {
    e.preventDefault();
    setTotal((parseInt($('#inMin', dlg).value, 10) || 0) * 60 + Math.min(59, parseInt($('#inSec', dlg).value, 10) || 0));
    dlg.close();
  });
}

function render() {
  if (!root) return;
  $('#timerGo', root).innerHTML = t.ringing ? '알람 끄기 <kbd>Space</kbd>' : t.running ? '멈춤 <kbd>Space</kbd>' : '시작 <kbd>Space</kbd>';
  $('#timerGo', root).className = 'btn huge ' + (t.ringing ? 'yellow' : t.running ? 'blue' : 'red');
  $('#timerHint', root).textContent = t.ringing
    ? '시간 끝! 버튼이나 Space 를 누르면 알람이 꺼져요.'
    : opts.sound && isMuted()
      ? '위쪽 스피커 버튼으로 전체 소리가 꺼져 있어서 경고음이 안 들려요.'
      : !t.running && t.remain < t.total
        ? '잠깐 멈춤'
        : '화면을 누르면 시간을 직접 입력할 수 있어요. 위/아래 화살표 키로 1분씩 조절돼요.';
}
