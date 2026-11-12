// 번호 뽑기 장면: 캡슐 뽑기 기계.
// 통 안에서 캡슐이 뒤섞이다가 하나가 굴러 나와 공중에 떠오르고, 떨리다가 터지면서 번호가 나타납니다.

import { hex, mix, createFx, Particles, P, Rng, TAU, clamp, ease, rand, sparkle } from '../pixelfx/index.js';
import { blit, prerender, darken } from '../stage.js';
import * as capsulePop from '../fx/capsule-pop.js';
import { digits, digitsWidth } from './digits.js';

export const W = 300;
export const H = 128;
const FLOOR = 106;
const DOME = { x: 72, y: 46, r: 35 };
const SPOT = { x: 206, y: 56 }; // 번호가 나타나는 자리
const INK = hex('#1b1326');
const SHELLS = ['#e2452f', '#ffcc3d', '#53b8e8', '#5cbd5a', '#ff8fb8', '#7a5cc8', '#ff9a3c'];
const BR = 5.2; // 통 안 캡슐 반지름

function background() {
  return prerender(W, H, (p) => {
    // 줄무늬 벽지
    for (let x = 0; x < W; x++) p.rect(x, 0, 1, FLOOR, hex((x >> 3) & 1 ? '#2c2250' : '#271d47'));
    for (let x = 4; x < W; x += 16) for (let y = 6; y < 80; y += 12) p.px(x, y + ((x >> 4) & 1) * 6, hex('#3a2e66'));
    // 허리 몰딩
    p.rect(0, 84, W, FLOOR - 84, hex('#1f1838'));
    p.rect(0, 84, W, 1, hex('#4a3c80'));
    p.rect(0, 85, W, 1, hex('#161126'));
    for (let x = 0; x < W; x += 20) p.rect(x, 86, 1, FLOOR - 86, hex('#191330'));
    // 바둑판 바닥
    for (let y = FLOOR; y < H; y++)
      for (let x = 0; x < W; x++) {
        const size = 10;
        const row = Math.floor((y - FLOOR) / 6);
        const on = (Math.floor((x + row * 5) / size) + row) & 1;
        p.px(x, y, hex(on ? '#4a3668' : '#35264e'));
      }
    p.rect(0, FLOOR, W, 1, hex('#6a5494'));
    // 번호가 올라설 받침대
    p.rect(SPOT.x - 30, FLOOR - 5, 60, 6, INK);
    p.rect(SPOT.x - 29, FLOOR - 4, 58, 4, hex('#c48412'));
    p.rect(SPOT.x - 29, FLOOR - 4, 58, 1, hex('#ffe066'));
    p.rect(SPOT.x - 29, FLOOR - 1, 58, 1, hex('#86520c'));
    p.rect(SPOT.x - 24, FLOOR - 9, 48, 5, INK);
    p.rect(SPOT.x - 23, FLOOR - 8, 46, 3, hex('#f0b424'));
    p.rect(SPOT.x - 23, FLOOR - 8, 46, 1, hex('#fff6c4'));
  });
}

// 캡슐 하나: 위는 색, 아래는 흰색, 가운데 띠. rot 만큼 돌아가 있음
function capsule(p, x, y, r, shell, rot = 0, white = 0) {
  const c = hex(shell);
  const hi = mix(c, hex('#ffffff'), 0.45);
  const lo = mix(c, INK, 0.35);
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  p.circle(x, y, r + 1, INK);
  p.shade(x - r, y - r, x + r, y + r, (px, py) => {
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy > r * r) return 0;
    if (white) return hex('#ffffff');
    const v = (-dx * sn + dy * cs) / r; // 캡슐 기준 위아래
    const lit = (dx + dy) / r; // 왼쪽 위에서 빛
    if (Math.abs(v) < 0.14) return INK;
    if (v < 0) return lit < -0.7 ? hi : lit > 0.6 ? lo : c;
    return lit < -0.6 ? hex('#ffffff') : lit > 0.6 ? hex('#c9ae7c') : hex('#f8ecd0');
  });
  if (r >= 4 && !white) {
    p.px(x - r * 0.45, y - r * 0.5, hex('#ffffff'));
    if (r >= 9) p.rect(x - r * 0.5, y - r * 0.55, 2, 2, hex('#ffffff'));
  }
}

export function gachaScene(stage, hooks = {}) {
  const bg = background();
  const R = new Rng(64);
  const ps = new Particles({ rng: R });
  let balls = [];
  let t = 0;
  let mode = 'idle';
  let mt = 0; // 현재 단계가 시작된 뒤 흐른 시간
  let speed = 1;
  let cap = null; // 굴러 나온 캡슐
  let fx = null;
  let result = null; // { n, t }
  let crank = 0;
  let dim = 1;
  let tickAcc = 0;
  let beatAcc = 0;
  let resolveRun = null;

  function settle() {
    for (let i = 0; i < 240; i++) physics(1 / 90, 0);
  }

  function setCount(n) {
    n = Math.min(n, 40);
    while (balls.length > n) balls.splice(Math.floor(R.next() * balls.length), 1);
    let added = false;
    while (balls.length < n) {
      const a = R.range(0, TAU);
      const d = R.range(0, DOME.r - BR - 2);
      balls.push({ x: DOME.x + Math.cos(a) * d, y: DOME.y + Math.sin(a) * d * 0.6, vx: 0, vy: 0, rot: R.range(0, TAU), vr: 0, shell: SHELLS[balls.length % SHELLS.length] });
      added = true;
    }
    if (added) settle();
  }

  function physics(dt, churn) {
    const lim = DOME.r - BR - 1.5;
    for (const b of balls) {
      b.vy += 420 * dt;
      if (churn) {
        // 통이 도는 것처럼 빙글빙글 + 마구 튀기
        const dx = b.x - DOME.x;
        const dy = b.y - DOME.y;
        b.vx += (-dy * 16 + R.range(-900, 900)) * dt * churn;
        b.vy += (dx * 16 + R.range(-900, 900) - 520) * dt * churn;
      }
      b.vx *= 1 - 1.2 * dt;
      b.vy *= 1 - 1.2 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vx * dt * 0.18;
      const dx = b.x - DOME.x;
      const dy = b.y - DOME.y;
      const d = Math.hypot(dx, dy);
      if (d > lim) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = DOME.x + nx * lim;
        b.y = DOME.y + ny * lim;
        const vn = b.vx * nx + b.vy * ny;
        if (vn > 0) {
          b.vx -= vn * nx * 1.45;
          b.vy -= vn * ny * 1.45;
        }
      }
    }
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = BR * 2 + 0.6;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          a.vx += rel * nx * 0.7;
          a.vy += rel * ny * 0.7;
          b.vx -= rel * nx * 0.7;
          b.vy -= rel * ny * 0.7;
        }
      }
  }

  function go(next) {
    mode = next;
    mt = 0;
  }

  /** 뽑기 한 번. 번호가 나타나는 순간 끝나는 Promise 를 돌려줌 */
  function run(n, speedFactor = 1, removeBall = true) {
    speed = speedFactor;
    result = null;
    fx = null;
    cap = { n, shell: SHELLS[Math.floor(R.next() * SHELLS.length)], removeBall };
    go('churn');
    return new Promise((res) => (resolveRun = res));
  }

  function update(dt) {
    t += dt;
    mt += dt;
    ps.update(dt);
    fx?.update(dt);
    const churning = mode === 'churn';
    for (let i = 0; i < 2; i++) physics(dt / 2, churning ? 1 : 0);
    if (churning) crank += dt * 14;

    if (mode === 'churn') {
      tickAcc += dt;
      if (tickAcc > 0.085) {
        tickAcc = 0;
        hooks.tick?.(mt / (1.25 * speed));
      }
      if (mt > 1.25 * speed) {
        // 통에서 하나를 꺼내 출구로
        if (cap.removeBall && balls.length) {
          const i = Math.floor(R.next() * balls.length);
          cap.shell = balls[i].shell;
          balls.splice(i, 1);
        }
        Object.assign(cap, { x: 98, y: 99, vx: 105, vy: -150, rot: 0, r: 6 });
        hooks.drop?.();
        go('drop');
      }
    } else if (mode === 'drop') {
      cap.vy += 560 * dt;
      cap.x += cap.vx * dt;
      cap.y += cap.vy * dt;
      cap.rot += cap.vx * dt * 0.16;
      const fy = FLOOR - cap.r - 1;
      if (cap.y > fy) {
        cap.y = fy;
        if (cap.vy > 60) hooks.bounce?.();
        cap.vy = -cap.vy * 0.5;
        cap.vx *= 0.9;
      }
      if (cap.x >= 150 || mt > 1.2) {
        cap.x0 = cap.x;
        cap.y0 = cap.y;
        go('rise');
      }
    } else if (mode === 'rise') {
      const u = clamp(mt / 0.55);
      const e = ease.outCubic(u);
      cap.x = cap.x0 + (SPOT.x - cap.x0) * e;
      cap.y = cap.y0 + (SPOT.y - cap.y0) * e - Math.sin(u * Math.PI) * 10;
      cap.r = 6 + e * 9;
      cap.rot += dt * 9 * (1 - u);
      dim = 1 - e * 0.5;
      if (u >= 1) {
        beatAcc = 9;
        go('hold');
      }
    } else if (mode === 'hold') {
      const dur = 0.5 + 0.75 * speed;
      const u = clamp(mt / dur);
      cap.rot = Math.sin(mt * 30) * 0.12 * (0.4 + u);
      // 빛 알갱이가 캡슐로 모여듦
      if (R.chance(dt * (14 + u * 40))) {
        const a = R.range(0, TAU);
        const d = R.range(38, 60);
        ps.spawn(P.STREAK, SPOT.x + Math.cos(a) * d, SPOT.y + Math.sin(a) * d, -Math.cos(a) * 34, -Math.sin(a) * 34, 0.42, '#ffe066');
      }
      beatAcc += dt;
      if (beatAcc > 0.62 - u * 0.3) {
        beatAcc = 0;
        hooks.beat?.();
      }
      if (u >= 1) {
        fx = createFx(capsulePop, { x: SPOT.x, y: SPOT.y, shell: cap.shell, floor: FLOOR - 10 - SPOT.y, seed: 1 + Math.floor(R.next() * 999) });
        result = { n: cap.n, t: 0 };
        cap = null;
        stage.shake(3, 0.35);
        hooks.pop?.();
        go('show');
        resolveRun?.();
        resolveRun = null;
      }
    } else if (mode === 'show') {
      result.t += dt;
      dim = Math.min(1, dim + dt * 0.8);
      if (fx?.done()) fx = null;
      if (R.chance(dt * 3)) {
        ps.spawn(P.STAR, SPOT.x + R.range(-46, 46), SPOT.y + R.range(-34, 30), 0, -5, R.range(0.5, 1), R.pick(['#ffe066', '#fff6c4', '#ffffff']), R.range(1.5, 3.5));
      }
    }
  }

  function machine(p) {
    const { x, y, r } = DOME;
    const shake = mode === 'churn' ? Math.round(Math.sin(t * 60)) : 0;
    const X = x + shake;
    // 받침 다리
    p.rect(X - 26, FLOOR - 3, 8, 3, INK);
    p.rect(X + 18, FLOOR - 3, 8, 3, INK);
    // 몸통
    p.rect(X - 31, 74, 62, FLOOR - 3 - 74, INK);
    p.rect(X - 30, 75, 60, FLOOR - 5 - 74, hex('#e2452f'));
    p.rect(X - 30, 75, 60, 2, hex('#ff7a59'));
    p.rect(X - 30, 75, 2, FLOOR - 5 - 74, hex('#ff7a59'));
    p.rect(X + 26, 77, 4, FLOOR - 7 - 74, hex('#a82a26'));
    p.rect(X - 30, FLOOR - 7, 60, 3, hex('#7a1a22'));
    // 이름판
    p.rect(X - 24, 79, 26, 9, INK);
    p.rect(X - 23, 80, 24, 7, hex('#ffcc3d'));
    p.text('6-4', X - 11, 81, INK, { font: 'mini', align: 'center' });
    // 손잡이 (돌아감)
    p.circle(X - 12, 96, 6.5, INK);
    p.circle(X - 12, 96, 5.5, hex('#dfe4ee'));
    p.circle(X - 13, 97, 4, hex('#9aa0b4'));
    const hx = Math.cos(crank) * 4;
    const hy = Math.sin(crank) * 4;
    p.beam(X - 12 - hx, 96 - hy, X - 12 + hx, 96 + hy, 3.4, INK);
    p.beam(X - 12 - hx, 96 - hy, X - 12 + hx, 96 + hy, 1.6, hex('#fffaf0'));
    // 캡슐 나오는 구멍
    p.rect(X + 6, 89, 20, 13, INK);
    p.rect(X + 8, 91, 16, 11, hex('#0b0810'));
    p.rect(X + 8, 91, 16, 2, hex('#3a2a52'));
    // 목
    p.rect(X - 22, 70, 44, 6, INK);
    p.rect(X - 21, 71, 42, 4, hex('#9aa0b4'));
    p.rect(X - 21, 71, 42, 1, hex('#dfe4ee'));
    // 유리통 안쪽
    p.circle(X, y, r + 1.5, INK);
    p.circle(X, y, r, hex('#1a2a4a'));
    p.circle(X - 3, y - 3, r - 4, hex('#22365c'));
    for (const b of balls) capsule(p, b.x + shake, b.y, BR, b.shell, b.rot);
    // 유리 반사와 테두리
    p.arc(X, y, r - 2, 2, Math.PI * 1.08, Math.PI * 1.45, hex('#ffffff'), 0.75);
    p.arc(X, y, r - 6, 1.4, Math.PI * 1.15, Math.PI * 1.3, hex('#ffffff'), 0.5);
    p.arc(X, y, r - 2, 1.2, Math.PI * 0.1, Math.PI * 0.32, hex('#b0e8ff'), 0.5);
    p.ring(X, y, r + 0.5, 1.5, hex('#8fb0d8'), 0.9);
    // 꼭지
    p.rect(X - 6, y - r - 5, 12, 5, INK);
    p.rect(X - 5, y - r - 4, 10, 3, hex('#ffcc3d'));
    p.rect(X - 5, y - r - 4, 10, 1, hex('#fff0a0'));
  }

  // 천장의 꼬마전구 줄: 차례로 깜빡임
  function bulbs(p) {
    const cols = ['#e2452f', '#ffcc3d', '#5cbd5a', '#53b8e8', '#ff8fb8'];
    for (let i = 0; i < 19; i++) {
      const x = 8 + i * 16;
      const y = 4 + Math.round(Math.sin((i / 18) * Math.PI * 3) * 2 + 2);
      if (i < 18) p.line(x, y - 1, x + 16, 4 + Math.round(Math.sin(((i + 1) / 18) * Math.PI * 3) * 2 + 2) - 1, hex('#0b0810'));
      const c = hex(cols[i % cols.length]);
      const on = (Math.floor(t * 3) + i) % 3 !== 0 || mode === 'show';
      p.rect(x - 1, y, 2, 3, on ? c : mix(c, INK, 0.65));
      if (on) {
        p.px(x - 1, y, hex('#ffffff'));
        p.glow(x, y + 1, 9, c, mode === 'show' ? 0.5 : 0.28);
      }
    }
  }

  function sign(p) {
    // 네온 간판: 가끔 지직거림
    const flick = rand(Math.floor(t * 12)) > 0.06;
    const c = flick ? hex('#ff8fb8') : hex('#7a3a5c');
    p.text('LUCKY DRAW', SPOT.x, 15, c, { font: 'big', align: 'center' });
    if (flick) p.glowLine(SPOT.x - 30, 18, SPOT.x + 30, 18, 12, hex('#ff5aa0'), 0.35);
  }

  function burst(p, k) {
    // 번호 뒤에서 천천히 도는 햇살
    const rot = t * 0.35;
    p.shade(SPOT.x - 84, 0, SPOT.x + 84, FLOOR - 9, (x, y, o) => {
      const dx = x - SPOT.x;
      const dy = y - SPOT.y;
      const d = Math.hypot(dx, dy);
      if (d < 26 || d > 84) return;
      const w = Math.floor(((Math.atan2(dy, dx) + rot + TAU) / TAU) * 20) & 1;
      if (!w) return;
      o.c = hex('#ffcc3d');
      o.a = k * 0.34 * (1 - d / 84);
    });
  }

  function number(p) {
    const s = result.t;
    // 크게 튀어나왔다가 제자리로 (정수 배율만 써서 픽셀이 뭉개지지 않게)
    const scale = s < 0.05 ? 2 : s < 0.1 ? 7 : s < 0.17 ? 6 : 5;
    const str = String(result.n);
    const tw = digitsWidth(str, scale);
    const y = SPOT.y - (9 * scale) / 2 - 2 + (s > 0.17 ? Math.round(Math.sin(t * 2.4) * 1.5) : 0);
    p.glow(SPOT.x, SPOT.y, 58, hex('#ffb040'), 0.2);
    digits(p, str, SPOT.x, y, (gy) => hex(gy < 1 ? '#fffaf0' : gy < 4 ? '#ffe066' : gy < 7 ? '#ffcc3d' : '#ff9a3c'), { scale, outline: INK, depth: hex('#a8501c') });
    // 가끔 숫자 모서리에서 반짝
    const tw2 = (t * 0.7) % 1;
    if (s > 0.4 && tw2 < 0.25) sparkle(p, SPOT.x - tw / 2 + 2, y + 2, 5 * Math.sin((tw2 / 0.25) * Math.PI), hex('#ffffff'), hex('#fff0a0'), 0.4);
  }

  function draw(p) {
    blit(stage.frame, bg);
    bulbs(p);
    sign(p);
    if (mode === 'show') burst(p, clamp(result.t * 3));
    machine(p);
    if (dim < 1) darken(stage.frame, dim, cap ? [{ x: cap.x, y: cap.y, r: 30 + Math.sin(t * 5) * 2 }] : []);

    if (mode === 'idle') {
      // 아직 뽑기 전: 받침대 위의 물음표
      const bob = Math.round(Math.sin(t * 2.2) * 2);
      digits(p, '?', SPOT.x, SPOT.y - 24 + bob, (gy) => hex(gy < 3 ? '#7a6cd0' : '#5548a0'), { scale: 5, outline: INK, depth: hex('#2b2452') });
      p.glow(SPOT.x, FLOOR - 14, 34, hex('#7a5cc8'), 0.25 + Math.sin(t * 2.2) * 0.06);
    }
    if (fx) {
      fx.draw(stage.frame, 'back');
      p.reset();
    }
    if (result) number(p);
    if (cap && mode !== 'churn') {
      const hold = mode === 'hold';
      const u = hold ? clamp(mt / (0.5 + 0.75 * speed)) : 0;
      const jx = hold ? Math.round((rand(Math.floor(t * 40)) - 0.5) * (1 + u * 4)) : 0;
      const jy = hold ? Math.round((rand(Math.floor(t * 40), 9) - 0.5) * (1 + u * 3)) : 0;
      // 터지기 직전 마지막 순간엔 하얗게 달아오름
      capsule(p, cap.x + jx, cap.y + jy, cap.r + (hold ? Math.sin(mt * 9) * u * 1.5 : 0), cap.shell, cap.rot, hold && u > 0.9 ? 1 : 0);
      if (hold) {
        p.glow(cap.x, cap.y, 30 + u * 34, hex('#ffe066'), 0.25 + u * 0.75);
        p.ring(cap.x, cap.y, cap.r + 5 + ((mt * 26) % 12), 1, hex('#fff6c4'), 0.5 * u);
      } else p.glow(cap.x, cap.y, 14, hex(cap.shell), 0.3);
    }
    ps.draw(p);
    if (fx) {
      fx.draw(stage.frame, 'front');
      p.reset();
    }
  }

  function reset() {
    mode = 'idle';
    result = null;
    cap = null;
    fx = null;
    dim = 1;
  }

  return { update, draw, setCount, run, reset, get busy() { return mode !== 'idle' && mode !== 'show'; } };
}
