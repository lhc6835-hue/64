// 자리 뽑기 장면: 위에서 비스듬히 내려다본 교실.
// 조명이 빈 책상 위를 옮겨 다니다 멈추면, 번호판이 마구 돌다가 뿅 하고 학생이 나타납니다.

import { hex, mix, createFx, Particles, P, Rng, TAU, clamp, rand, sparkle } from '../pixelfx/index.js';
import { blit, prerender, darken } from '../stage.js';
import * as poof from '../fx/poof.js';
import { digits, digitsWidth } from './digits.js';

export const W = 300;
export const H = 150;
export const BOARD = { x: 60, y: 3, w: 180, h: 22 }; // 칠판 안쪽(글씨가 올라가는 자리)
const WALL = 31;
const TOP = 34; // 책상이 놓이기 시작하는 높이
const INK = hex('#1b1326');
const HAIR = ['#2a1c18', '#4a2c14', '#1b1326', '#6a421e', '#8e5c2c', '#3a2a20'];
const SKIN = ['#ffd9b0', '#f4c494', '#e0a878'];
const SHIRT = ['#e2452f', '#ffcc3d', '#53b8e8', '#5cbd5a', '#ff8fb8', '#7a5cc8', '#ff9a3c', '#fffaf0', '#2d7bbd'];

const KID = [
  '...kkkkkk...',
  '..khhhhhhk..',
  '.khhhhhhhhk.',
  '.khssssssHk.',
  '.ksesssesSk.',
  '.kssssssssk.',
  '..kssssssk..',
  '.kkttttttkk.',
  'kttttttttttk',
];
const KID_LONG = [
  '...kkkkkk...',
  '..khhhhhhk..',
  '.khhhhhhhhk.',
  'khhssssssHhk',
  'khsesssesShk',
  'khsssssssshk',
  'khkssssssk' + 'hk',
  '.kkttttttkk.',
  'kttttttttttk',
];

function background(flip) {
  return prerender(W, H, (p) => {
    // 벽
    p.rect(0, 0, W, WALL, hex('#ead9b6'));
    p.rect(0, 0, W, 2, hex('#cdb88e'));
    p.rect(0, WALL - 4, W, 4, hex('#b89a66'));
    p.rect(0, WALL - 4, W, 1, hex('#8a6e42'));
    // 바닥: 길이가 제각각인 나무 널
    const planks = ['#c98a4a', '#c2843f', '#d0924e', '#bd7e3c'];
    for (let y = WALL; y < H; y++) {
      const row = Math.floor((y - WALL) / 7);
      for (let x = 0; x < W; x++) {
        const len = 34;
        const k = Math.floor((x + row * 13) / len);
        let c = hex(planks[(k * 3 + row * 5) % planks.length]);
        if ((y - WALL) % 7 === 6 || (x + row * 13) % len === 0) c = hex('#9a6030');
        else if ((y - WALL) % 7 === 0) c = mix(c, hex('#ffffff'), 0.12);
        p.px(x, y, c);
      }
    }
    p.rect(0, WALL, W, 2, hex('#7a4a24'), 0.5);

    // 칠판(앞) 또는 게시판(뒤)
    const b = BOARD;
    p.rect(b.x - 3, b.y - 2, b.w + 6, b.h + 6, INK);
    p.rect(b.x - 2, b.y - 1, b.w + 4, b.h + 4, hex('#8a5a34'));
    p.rect(b.x - 2, b.y - 1, b.w + 4, 1, hex('#b47c40'));
    if (!flip) {
      p.rect(b.x, b.y + 1, b.w, b.h, hex('#2f6a4a'));
      p.rect(b.x, b.y + 1, b.w, 1, hex('#1f4e36'));
      // 덜 지워진 분필 자국
      for (let i = 0; i < 90; i++) p.px(b.x + 2 + rand(i, 1) * (b.w - 4), b.y + 3 + rand(i, 2) * (b.h - 4), hex('#3f7e5c'));
      // 분필 받침과 분필, 지우개
      p.rect(b.x - 2, b.y + b.h + 2, b.w + 4, 2, hex('#6a421e'));
      p.rect(b.x + 8, b.y + b.h + 1, 4, 1, hex('#fffaf0'));
      p.rect(b.x + 15, b.y + b.h + 1, 3, 1, hex('#ffcc3d'));
      p.rect(b.x + 21, b.y + b.h + 1, 3, 1, hex('#ff8fb8'));
      p.rect(b.x + b.w - 16, b.y + b.h, 8, 2, hex('#2d7bbd'));
      p.rect(b.x + b.w - 16, b.y + b.h, 8, 1, hex('#53b8e8'));
    } else {
      p.rect(b.x, b.y + 1, b.w, b.h, hex('#c08a50'));
      for (let i = 0; i < 160; i++) p.px(b.x + rand(i, 3) * b.w, b.y + 1 + rand(i, 4) * b.h, hex(rand(i, 5) > 0.5 ? '#a8743c' : '#d09c62'));
      // 글씨가 올라갈 흰 종이
      p.rect(b.x + 4, b.y + 2, b.w - 8, b.h - 2, hex('#fffaf0'));
      p.rect(b.x + 4, b.y + b.h - 1, b.w - 8, 1, hex('#dcc592'));
      for (const px of [b.x + 6, b.x + b.w - 8]) {
        p.rect(px, b.y + 3, 2, 2, hex('#e2452f'));
        p.px(px, b.y + 3, hex('#ff9a80'));
      }
    }

    // 창문 (왼쪽)
    p.rect(7, 3, 40, 23, INK);
    p.rect(8, 4, 38, 21, hex('#fffaf0'));
    for (const wx of [10, 28]) {
      p.rect(wx, 6, 16, 17, hex('#7cc4f4'));
      p.rect(wx, 6, 16, 6, hex('#a8dcfa'));
      p.line(wx + 3, 20, wx + 9, 8, hex('#d4f0ff'));
      p.line(wx + 6, 21, wx + 12, 9, hex('#d4f0ff'));
    }
    p.rect(6, 25, 42, 2, hex('#dcc592'));
    // 화분
    p.rect(50, 21, 5, 5, hex('#c0503a'));
    p.circle(52.5, 18, 3.2, hex('#2f8a4a'));
    p.px(51, 16, hex('#a4e87c'));

    // 시계와 문 (오른쪽)
    p.circle(257, 12, 6.5, INK);
    p.circle(257, 12, 5.5, hex('#fffaf0'));
    p.line(257, 12, 257, 8, INK);
    p.line(257, 12, 260, 13, hex('#e2452f'));
    p.rect(273, 5, 21, WALL - 5, INK);
    p.rect(274, 6, 19, WALL - 6, hex('#8a5a34'));
    p.rect(276, 8, 15, 8, hex('#a8dcfa'));
    p.rect(276, 8, 15, 2, hex('#d4f0ff'));
    p.rect(289, 19, 2, 2, hex('#ffcc3d'));

    // 교탁 (앞에서 볼 때만)
    if (!flip) {
      p.rect(131, WALL - 1, 38, 6, INK);
      p.rect(132, WALL, 36, 2, hex('#e8b06a'));
      p.rect(132, WALL + 2, 36, 2, hex('#9a6030'));
    }
  });
}

function kid(p, n, cx, y, lift, blink) {
  const long = rand(n, 21) > 0.5;
  const hair = HAIR[Math.floor(rand(n, 22) * HAIR.length)];
  const skin = SKIN[Math.floor(rand(n, 23) * SKIN.length)];
  const shirt = SHIRT[Math.floor(rand(n, 24) * SHIRT.length)];
  const pal = {
    k: '#1b1326', h: hair, H: mix(hex(hair), hex('#ffffff'), 0.18), s: skin, S: mix(hex(skin), hex('#a05a3a'), 0.25),
    e: blink ? skin : '#1b1326', t: shirt,
  };
  p.sprite(long ? KID_LONG : KID, pal, cx - 6, y - lift);
}

export function classroomScene(stage, hooks = {}) {
  let bg = background(false);
  const R = new Rng(46);
  const ps = new Particles({ rng: R, ground: () => H - 2 });
  let layout = { rows: 5, cols: 6, off: [], genderOn: false, flip: false, girls: [] };
  let desks = new Map(); // seat → { x, y, w, n, hidden, pop, text, jit }
  let cellH = 23;
  let t = 0;
  let spot = null; // 조명이 비추는 자리
  let dim = 1;
  let dimTo = 1;
  let fxs = [];
  let banner = null; // { str, t, hold }
  let party = 0;

  function setLayout(next) {
    const flipChanged = !!next.flip !== !!layout.flip;
    layout = { ...layout, ...next };
    if (flipChanged) bg = background(layout.flip);
    const { rows, cols, off, flip } = layout;
    const old = desks;
    desks = new Map();
    cellH = Math.min(23, Math.floor((H - TOP) / rows));
    const cellW = Math.min(44, Math.floor((W - 16) / cols));
    const w = Math.max(15, Math.min(30, cellW - 4));
    const x0 = Math.round((W - cellW * cols) / 2);
    const y0 = TOP + Math.max(0, Math.floor((H - TOP - cellH * rows) / 2));
    for (let i = 0; i < rows * cols; i++) {
      if (off.includes(i)) continue;
      let r = Math.floor(i / cols);
      let c = i % cols;
      // 짝끼리는 살짝 붙여서 그림
      let nudge = 0;
      if (layout.genderOn && !(cols % 2 === 1 && c === cols - 1)) nudge = c % 2 === 0 ? 2 : -2;
      if (flip) {
        r = rows - 1 - r;
        c = cols - 1 - c;
        nudge = -nudge;
      }
      const prev = old.get(i);
      desks.set(i, { x: x0 + c * cellW + cellW / 2 + nudge, y: y0 + r * cellH, w, n: prev?.n ?? null, hidden: prev?.hidden ?? false, pop: prev?.pop ?? 9, text: null, jit: 0, row: r });
    }
  }

  /** 자리별 번호를 한꺼번에 정함. shown: { seat: 번호 }, hidden: 아직 공개 안 된 자리 목록 */
  function setSeats(shown, hidden = []) {
    for (const [seat, d] of desks) {
      const n = shown[seat];
      d.n = n === undefined || n === '' ? null : n;
      d.hidden = hidden.includes(seat);
      d.pop = 9;
      d.text = null;
    }
    spot = null;
    dimTo = 1;
    party = 0;
    banner = null;
  }

  const roomy = () => cellH >= 22;
  const center = (seat) => {
    const d = desks.get(seat);
    return d ? { x: d.x, y: d.y + cellH - 6 } : null;
  };

  function setSpot(seat, focus = false) {
    spot = seat == null ? null : { seat, focus };
    dimTo = seat == null ? 1 : focus ? 0.36 : 0.55;
  }
  function setText(seat, text) {
    const d = desks.get(seat);
    if (d) {
      d.text = text;
      d.jit = 0.12;
    }
  }
  function gather(seat) {
    // 빛 알갱이가 책상으로 모여듦 (마지막 자리들의 뜸 들이기)
    const c = center(seat);
    const a = R.range(0, TAU);
    const dd = R.range(22, 40);
    ps.spawn(P.STREAK, c.x + Math.cos(a) * dd, c.y - 6 + Math.sin(a) * dd, -Math.cos(a) * 26, -Math.sin(a) * 26, 0.4, '#ffe066');
  }

  function reveal(seat, n, big = true) {
    const d = desks.get(seat);
    if (!d) return;
    d.n = n;
    d.hidden = false;
    d.text = null;
    d.pop = 0;
    const c = center(seat);
    fxs.push(createFx(poof, { x: c.x, y: d.y + (roomy() ? 9 : 4), seed: 1 + Math.floor(R.next() * 999) }));
    if (big) {
      banner = { str: String(n), t: 0, hold: 1.25 };
      stage.shake(2, 0.2);
    }
  }
  function showBanner(str, hold = 99) {
    banner = str == null ? null : { str: String(str), t: 0, hold };
  }

  function celebrate() {
    party = 1;
    spot = null;
    dimTo = 1;
    const cols = ['#e2452f', '#ffcc3d', '#5cbd5a', '#53b8e8', '#ff8fb8', '#fffaf0', '#7a5cc8'];
    for (let i = 0; i < 150; i++)
      ps.spawn(P.GRIT, R.range(0, W), R.range(-30, 0), R.range(-30, 30), R.range(20, 90), R.range(1.6, 3.4), R.pick(cols), R.chance(0.5) ? 2 : 1, R.range(0, 1.2));
    for (let i = 0; i < 26; i++)
      ps.spawn(P.STAR, R.range(10, W - 10), R.range(8, H - 20), 0, -6, R.range(0.6, 1.6), R.pick(['#ffe066', '#fff6c4', '#ffffff']), R.range(2, 5), R.range(0, 1.6));
  }

  function update(dt) {
    t += dt;
    ps.update(dt);
    dim += (dimTo - dim) * Math.min(1, dt * 9);
    for (const f of fxs) f.update(dt);
    fxs = fxs.filter((f) => !f.done());
    for (const d of desks.values()) {
      d.pop += dt;
      if (d.jit > 0) d.jit -= dt;
    }
    if (banner) {
      banner.t += dt;
      if (banner.t > banner.hold + 0.3) banner = null;
    }
    if (party) party += dt;
  }

  function desk(p, seat, d) {
    const focus = spot?.seat === seat && spot.focus;
    const jx = focus ? Math.round((rand(Math.floor(t * 30), seat) - 0.5) * 2.4) : 0;
    const x = Math.round(d.x - d.w / 2) + jx;
    const big = roomy();
    const top = d.y + (big ? 8 : 0);
    // 학생: 책상 뒤에서 쏙 올라옴
    if (big && d.n != null && !d.hidden) {
      const u = clamp(d.pop / 0.22);
      const rise = Math.round((1 - u) * 8) - (d.pop > 0.22 && d.pop < 0.34 ? 2 : 0);
      const hop = party ? Math.max(0, Math.round(Math.sin(party * 9 + seat * 1.7) * 2.5)) : 0;
      const blink = (t * 0.6 + rand(d.n, 9) * 7) % 3.2 < 0.12;
      kid(p, d.n, d.x + jx, d.y + 1 + rise, hop, blink);
    }
    // 책상 윗면
    const h = 2;
    p.rect(x - 1, top - 1, d.w + 2, h + 2, INK);
    p.rect(x, top, d.w, h, hex('#e8b06a'));
    p.rect(x, top, d.w, 1, hex('#f8d090'));
    // 앞판 = 번호판
    const py = top + h + 1;
    const ph = cellH - (big ? 8 : 0) - h - 1;
    p.rect(x, py - 1, d.w, ph + 1, INK);
    let plate = '#f8ecd0';
    if (!d.hidden && d.n != null && layout.genderOn) plate = layout.girls.includes(d.n) ? '#ffd0e2' : '#bfe4ff';
    if (d.hidden) plate = '#5a4a3a';
    if (d.n == null && !d.hidden) plate = '#b87a3c';
    const flash = !d.hidden && d.pop < 0.1;
    p.rect(x + 1, py, d.w - 2, ph - 1, hex(flash ? '#ffffff' : plate));
    if (!flash && !d.hidden && d.n != null) p.rect(x + 1, py + ph - 2, d.w - 2, 1, mix(hex(plate), INK, 0.18));
    const ty = py + Math.max(0, Math.round((ph - 1 - 9) / 2));
    if (d.hidden) {
      if (d.text != null) digits(p, d.text, d.x + jx, ty, hex('#ffe066'));
      else p.text('?', d.x + jx, py + Math.floor((ph - 6) / 2), hex('#a08c70'), { font: 'mini', align: 'center' });
    } else if (d.n != null && !flash) {
      digits(p, String(d.n), d.x + jx, ty, INK);
    }
  }

  function draw(p) {
    blit(stage.frame, bg);
    // 창으로 들어온 햇빛
    p.glow(40, WALL + 14, 46, hex('#fff0b0'), 0.16);
    const order = [...desks.entries()].sort((a, b) => a[1].row - b[1].row);
    for (const [seat, d] of order) desk(p, seat, d);

    if (dim < 0.99) {
      const holes = [];
      if (spot) {
        const c = center(spot.seat);
        if (c) holes.push({ x: c.x, y: c.y - 5, r: spot.focus ? 23 + Math.sin(t * 8) * 1.5 : 21 });
      }
      darken(stage.frame, dim, holes);
      // 칠판 글씨는 DOM 이라 어두워지지 않으므로, 칠판만은 그대로 밝게 둠
    }
    if (spot) {
      const c = center(spot.seat);
      if (c) {
        p.glow(c.x, c.y - 5, spot.focus ? 34 : 26, hex('#ffe9a0'), spot.focus ? 0.5 : 0.32);
        if (spot.focus) p.ring(c.x, c.y - 5, 16 + ((t * 22) % 9), 1, hex('#fff6c4'), 0.45);
      }
    }
    for (const f of fxs) {
      f.draw(stage.frame);
      p.reset();
    }
    ps.draw(p);

    if (banner) {
      // 방금 나온 번호를 교실 한가운데에 크게
      const s = banner.t;
      const scale = s < 0.05 ? 2 : s < 0.1 ? 6 : s < 0.16 ? 5 : 4;
      if (s > banner.hold) p.fade = clamp(1 - (s - banner.hold) / 0.3);
      const y = 54 - (9 * scale) / 2;
      const tw = digitsWidth(banner.str, scale);
      p.rect(150 - tw / 2 - 9, y - 7, tw + 18, 9 * scale + 16, hex('#ffcc3d'));
      p.rect(150 - tw / 2 - 8, y - 6, tw + 16, 9 * scale + 14, INK);
      digits(p, banner.str, 150, y, (gy) => hex(gy < 1 ? '#fffaf0' : gy < 4 ? '#ffe066' : gy < 7 ? '#ffcc3d' : '#ff9a3c'), { scale, outline: INK, depth: hex('#a8501c') });
      if (s < 0.5) sparkle(p, 150 + tw / 2 + 4, y, 6 * (1 - s / 0.5), hex('#ffffff'), hex('#fff0a0'));
      p.fade = 1;
      p.glow(150, 54, 60, hex('#ffb040'), 0.22 * (s > banner.hold ? clamp(1 - (s - banner.hold) / 0.3) : 1));
    }
  }

  setLayout({});
  return { update, draw, setLayout, setSeats, setSpot, setText, gather, reveal, showBanner, celebrate, center, hiddenSeats: () => [...desks].filter(([, d]) => d.hidden).map(([s]) => s) };
}
