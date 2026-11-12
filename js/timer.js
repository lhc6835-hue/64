import { $, local, sfx, isMuted } from './core.js';

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
    document.title = '⏰ 시간 끝!';
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
const R = 180;
const CIRC = 2 * Math.PI * R;

export function enter(el) {
  root = el;
  el.innerHTML = `
    <div class="stage timer-stage" id="timerStage">
      <div class="dial">
        <svg viewBox="0 0 400 400" aria-hidden="true">
          <circle class="dial-bg" cx="200" cy="200" r="${R}"/>
          <circle class="dial-fg" id="dialFg" cx="200" cy="200" r="${R}" stroke-dasharray="${CIRC}" transform="rotate(-90 200 200)"/>
        </svg>
        <div class="dial-inner">
          <div class="timer-time" id="timerTime" title="눌러서 시간 직접 입력">05:00</div>
          <div class="timer-msg" id="timerMsg"></div>
        </div>
      </div>
      <div class="timer-adjust">
        <button class="btn round" data-add="-60">−1분</button>
        <button class="btn round" data-add="-10">−10초</button>
        <button class="btn round" data-add="10">＋10초</button>
        <button class="btn round" data-add="60">＋1분</button>
      </div>
    </div>

    <div class="controls">
      <button class="btn primary huge" id="timerGo">▶ 시작 <kbd>Space</kbd></button>
      <button class="btn" id="timerReset">↺ 처음으로</button>
      <span class="presets">
        ${[1, 3, 5, 10, 15, 20, 30].map((m) => `<button class="btn ghost small" data-min="${m}">${m}분</button>`).join('')}
      </span>
    </div>
    <div class="controls toggles">
      <label class="check"><input type="checkbox" id="optSound"> 🔔 경고음 켜기</label>
      <label class="check"><input type="checkbox" id="optWarn1"> 1분 남았을 때 알림</label>
      <label class="check"><input type="checkbox" id="optLast10"> 마지막 10초 똑딱 소리</label>
    </div>
    <p class="muted center" id="timerHint"></p>`;

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
  root = null;
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
  if (e.target.tagName === 'INPUT') return;
  const b = e.target.closest('button, #timerTime');
  if (!b) return;
  if (b.dataset.add) add(+b.dataset.add);
  else if (b.dataset.min) setTotal(+b.dataset.min * 60);
  else if (b.id === 'timerGo') toggle();
  else if (b.id === 'timerReset') reset();
  else if (b.id === 'timerTime' && !t.running && !t.ringing && !$('input', b)) editTime();
}

// 시간 숫자를 눌러 직접 입력
function editTime() {
  const el = $('#timerTime', root);
  const m = Math.floor(t.remain / 60);
  const s = Math.round(t.remain % 60);
  el.innerHTML = `<input id="inMin" type="number" min="0" max="99" value="${m}"><span>:</span><input id="inSec" type="number" min="0" max="59" value="${String(s).padStart(2, '0')}">`;
  const inMin = $('#inMin', el);
  const inSec = $('#inSec', el);
  inMin.focus();
  inMin.select();
  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    setTotal((parseInt(inMin.value, 10) || 0) * 60 + Math.min(59, parseInt(inSec.value, 10) || 0));
  };
  el.addEventListener('focusout', () => setTimeout(() => !el.contains(document.activeElement) && commit(), 0));
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
  });
}

function render() {
  if (!root) return;
  const time = $('#timerTime', root);
  if (!$('input', time)) time.textContent = fmt(t.ringing ? 0 : t.remain);
  const ratio = t.total > 0 ? Math.min(1, t.remain / t.total) : 0;
  $('#dialFg', root).style.strokeDashoffset = CIRC * (1 - (t.ringing ? 0 : ratio));
  const stage = $('#timerStage', root);
  const sec = Math.ceil(t.remain);
  stage.classList.toggle('warn', !t.ringing && sec <= 60 && sec > 10 && t.total > 60 && (t.running || t.remain < t.total));
  stage.classList.toggle('danger', !t.ringing && sec <= 10 && (t.running || t.remain < t.total));
  stage.classList.toggle('ringing', t.ringing);
  $('#timerMsg', root).textContent = t.ringing ? '시간 끝! ⏰' : t.running ? '' : t.remain < t.total ? '잠깐 멈춤' : '';
  $('#timerGo', root).innerHTML = t.ringing ? '🔕 알람 끄기 <kbd>Space</kbd>' : t.running ? '⏸ 멈춤 <kbd>Space</kbd>' : '▶ 시작 <kbd>Space</kbd>';
  $('#timerHint', root).textContent =
    opts.sound && isMuted()
      ? '⚠️ 위쪽 🔇 버튼으로 전체 소리가 꺼져 있어서 경고음이 안 들려요.'
      : '시간 숫자를 누르면 직접 입력할 수 있어요. ↑↓ 키로 1분씩 조절돼요.';
}
