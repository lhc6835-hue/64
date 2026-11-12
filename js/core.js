// 공통 기능: 저장소, 서버 통신, 선생님 로그인, 소리, 폭죽, 작은 도우미들

export const API = 'https://class64.celesta.workers.dev';

/* ---------- 도우미 ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 공정한 무작위 (crypto 사용)
export function rint(n) {
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= max);
  return buf[0] % n;
}
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rint(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 이 기기에만 저장되는 값 ---------- */
const LS = 'c64:';
export const local = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(LS + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(LS + key, JSON.stringify(value));
    } catch {}
  },
};

/* ---------- 반 전체가 함께 보는 값 (서버 저장) ---------- */
export const DEFAULT_CONFIG = {
  count: 28, // 마지막 번호
  excluded: [], // 빠진 번호 (전학 등)
  girls: [], // 여학생 번호 (나머지는 남학생)
  genderOn: false, // 자리 뽑기 때 남녀 짝 맞추기
  rows: 5,
  cols: 6,
  off: [28, 29], // 사용하지 않는 자리 (칸 번호 = 줄*cols + 칸)
};

export const state = {
  posts: [],
  notice: { text: '', updated: 0 },
  config: { ...DEFAULT_CONFIG },
  seats: null,
  online: false,
  loaded: false,
};

const listeners = new Set();
export const onState = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach((fn) => fn(state));

function applyState(s) {
  state.posts = Array.isArray(s.posts) ? s.posts : [];
  state.notice = s.notice && typeof s.notice === 'object' ? s.notice : { text: '', updated: 0 };
  state.config = { ...DEFAULT_CONFIG, ...(s.config || {}) };
  state.seats = s.seats || null;
  state.rev = s.rev || 0;
}

export async function loadState() {
  const before = state.rev;
  try {
    const res = await fetch(API + '/api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const s = await res.json();
    applyState(s);
    local.set('cache', s);
    state.online = true;
  } catch {
    state.online = false;
  }
  const first = !state.loaded;
  state.loaded = true;
  if (first || before !== state.rev) emit();
}

// 선생님만: 서버에 저장
export async function saveState(patch) {
  const pw = await requireTeacher();
  if (!pw) return false;
  try {
    const res = await fetch(API + '/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Password': pw },
      body: JSON.stringify({ patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) setTeacher(null);
      toast(data.error || '저장하지 못했어요.', 'bad');
      return false;
    }
    applyState(data);
    local.set('cache', data);
    emit();
    return true;
  } catch {
    toast('인터넷 연결을 확인해 주세요. 저장하지 못했어요.', 'bad');
    return false;
  }
}

// 현재 사용 중인 번호 목록
export function numbers(cfg = state.config) {
  const out = [];
  for (let n = 1; n <= cfg.count; n++) if (!cfg.excluded.includes(n)) out.push(n);
  return out;
}
export const isGirl = (n, cfg = state.config) => cfg.girls.includes(n);

/* ---------- 선생님 모드 ---------- */
let teacherPw = null;
try {
  teacherPw = sessionStorage.getItem(LS + 'pw');
} catch {}
export const isTeacher = () => !!teacherPw;
const teacherListeners = new Set();
export const onTeacher = (fn) => (teacherListeners.add(fn), () => teacherListeners.delete(fn));

export function setTeacher(pw) {
  teacherPw = pw;
  try {
    if (pw) sessionStorage.setItem(LS + 'pw', pw);
    else sessionStorage.removeItem(LS + 'pw');
  } catch {}
  document.body.classList.toggle('is-teacher', !!pw);
  teacherListeners.forEach((fn) => fn(!!pw));
}

export async function requireTeacher() {
  if (teacherPw) return teacherPw;
  return new Promise((resolve) => {
    const dlg = modal(`
      <h2>선생님 확인</h2>
      <p class="soft">게시물·알림장·설정을 바꾸려면 선생님 비밀번호가 필요해요.</p>
      <form id="loginForm" class="stack">
        <input type="password" id="loginPw" placeholder="비밀번호" autocomplete="current-password" required>
        <p class="form-error" id="loginErr" hidden></p>
        <div class="row end">
          <button type="button" class="btn" data-close>취소</button>
          <button class="btn red">확인</button>
        </div>
      </form>`);
    let done = false;
    dlg.addEventListener('close', () => !done && resolve(null));
    $('#loginPw', dlg).focus();
    $('#loginForm', dlg).addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('#loginPw', dlg).value;
      const err = $('#loginErr', dlg);
      try {
        const res = await fetch(API + '/api/login', { method: 'POST', headers: { 'X-Password': pw }, body: '{}' });
        const data = await res.json();
        if (!res.ok) {
          err.textContent = data.error || '비밀번호가 틀렸어요.';
          err.hidden = false;
          return;
        }
        done = true;
        setTeacher(pw);
        dlg.close();
        toast('선생님 모드가 켜졌어요.', 'good');
        resolve(pw);
      } catch {
        err.textContent = '인터넷 연결을 확인해 주세요.';
        err.hidden = false;
      }
    });
  });
}

export async function changePassword(newPassword) {
  const pw = await requireTeacher();
  if (!pw) return false;
  try {
    const res = await fetch(API + '/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Password': pw },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || '바꾸지 못했어요.', 'bad'), false;
    setTeacher(newPassword);
    return true;
  } catch {
    return toast('인터넷 연결을 확인해 주세요.', 'bad'), false;
  }
}

/* ---------- 창(모달)과 알림 ---------- */
export function modal(html) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = html;
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

export function confirmBox(message, okLabel = '확인') {
  return new Promise((resolve) => {
    const dlg = modal(`
      <p class="confirm-msg">${esc(message)}</p>
      <div class="row end">
        <button class="btn" data-close>취소</button>
        <button class="btn red" id="okBtn">${esc(okLabel)}</button>
      </div>`);
    let ok = false;
    $('#okBtn', dlg).addEventListener('click', () => ((ok = true), dlg.close()));
    dlg.addEventListener('close', () => resolve(ok));
  });
}

export function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- 소리 (파일 없이 직접 만들어 냄) ---------- */
let actx = null;
let muted = local.get('mute', false);
export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  local.set('mute', v);
}
function ctx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0 } = {}) {
  if (muted) return;
  const c = ctx();
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.2, at = 0, freq = 1800 } = {}) {
  if (muted) return;
  const c = ctx();
  const t = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  unlock: () => !muted && ctx(),
  tick: (pitch = 1) => tone(880 * pitch, 0.05, { type: 'square', vol: 0.07 }),
  blip: () => tone(520, 0.07, { type: 'square', vol: 0.09, slide: 260 }),
  // 두구두구두구 (dur초 동안)
  drum(dur = 1.5) {
    for (let t = 0; t < dur; t += 0.06) noise(0.05, { at: t, vol: 0.1 + 0.25 * (t / dur), freq: 900 });
  },
  heart() {
    tone(70, 0.16, { vol: 0.5, slide: -30 });
    tone(60, 0.2, { vol: 0.4, at: 0.2, slide: -25 });
  },
  thud() {
    tone(140, 0.3, { vol: 0.5, slide: -100 });
    noise(0.15, { vol: 0.3, freq: 400 });
  },
  pop: () => tone(660, 0.12, { type: 'square', vol: 0.12, slide: 500 }),
  fanfare() {
    // 게임기에서 아이템 얻을 때 나는 짧은 가락
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.11, { type: 'square', vol: 0.1, at: i * 0.075 }));
    [1047, 1319, 1568].forEach((f) => tone(f, 0.5, { type: 'square', vol: 0.06, at: 0.4 }));
    [262, 392].forEach((f) => tone(f, 0.5, { type: 'triangle', vol: 0.2, at: 0.4 }));
  },
  warn() {
    tone(880, 0.15, { type: 'square', vol: 0.12 });
    tone(880, 0.15, { type: 'square', vol: 0.12, at: 0.25 });
  },
  alarm() {
    for (let i = 0; i < 4; i++) {
      tone(1175, 0.12, { type: 'square', vol: 0.16, at: i * 0.16 });
    }
  },
};

/* ---------- 색종이 (화면 전체, 굵은 픽셀) ---------- */
const COLORS = ['#e2452f', '#ffcc3d', '#5cbd5a', '#53b8e8', '#ff8fb8', '#fffaf0', '#7a5cc8'];
const CELL = 6; // 색종이 한 칸의 크기(px)
let cv, cx, parts = [], raf = 0;
export function confetti(amount = 140, origin = { x: 0.5, y: 0.4 }) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!cv) {
    cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.append(cv);
    cx = cv.getContext('2d');
  }
  cv.width = Math.ceil(innerWidth / CELL);
  cv.height = Math.ceil(innerHeight / CELL);
  for (let i = 0; i < amount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 3.2;
    parts.push({
      x: origin.x * cv.width,
      y: origin.y * cv.height,
      vx: Math.cos(ang) * sp * 1.4,
      vy: Math.sin(ang) * sp - 1.6,
      ph: Math.random() * 6,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      life: 80 + Math.random() * 60,
    });
  }
  if (!raf) raf = requestAnimationFrame(step);
}
function step() {
  cx.clearRect(0, 0, cv.width, cv.height);
  parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 2);
  for (const p of parts) {
    p.vy += 0.07;
    p.vx *= 0.975;
    p.vy *= 0.985;
    p.x += p.vx + Math.sin(p.ph + p.life * 0.15) * 0.25;
    p.y += p.vy;
    p.life--;
    if (p.life < 20 && p.life % 4 < 2) continue; // 사라질 때는 깜빡임
    cx.fillStyle = p.c;
    // 팔랑거리는 느낌: 넓적했다 가늘어졌다
    const wide = Math.sin(p.ph + p.life * 0.3) > 0;
    cx.fillRect(Math.round(p.x), Math.round(p.y), wide ? 2 : 1, wide ? 1 : 2);
  }
  raf = parts.length ? requestAnimationFrame(step) : 0;
  if (!raf) cx.clearRect(0, 0, cv.width, cv.height);
}

// 캐시된 값으로 먼저 채워 두기 (인터넷이 느려도 바로 보이게)
applyState(local.get('cache', {}));
document.body.classList.toggle('is-teacher', !!teacherPw);
