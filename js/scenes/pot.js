// 소음 측정 장면: 교실이 시끄러워질수록 라면 냄비가 끓어오릅니다.
// 조용하면 김만 솔솔, 조금 시끄러우면 뚜껑이 달그락, 너무 시끄러우면 넘쳐 흐르고 경고등이 돕니다.

import { hex, mix, Particles, P, PF, Rng, clamp, rand, TAU } from '../pixelfx/index.js';
import { blit, prerender } from '../stage.js';
import { digits } from './digits.js';

export const W = 300;
export const H = 128;
const INK = hex('#1b1326');
const COUNTER = 106;
const POT = { x: 84, top: 58, w: 62, h: 36 };
const ZONE = { green: '#3ddc84', yellow: '#ffcc3d', red: '#ff4a3d' };

function background() {
  return prerender(W, H, (p) => {
    // 타일 벽
    p.rect(0, 0, W, COUNTER, hex('#e9e2d2'));
    for (let y = 0; y < COUNTER; y += 12)
      for (let x = 0; x < W; x += 12) {
        const off = (y / 12) % 2 ? 6 : 0;
        p.rect(x - off, y, 11, 11, hex(rand(x, y) > 0.86 ? '#dfd6c2' : '#f4eee0'));
        p.rect(x - off, y, 11, 1, hex('#fffdf6'));
      }
    // 오른쪽 계기판
    p.rect(164, 6, 130, 96, INK);
    p.rect(165, 7, 128, 94, hex('#241c40'));
    p.rect(165, 7, 128, 1, hex('#4a3c80'));
    p.rect(166, 99, 126, 2, hex('#161126'));
    // 조리대와 가스레인지
    p.rect(0, COUNTER, W, H - COUNTER, hex('#8a5a34'));
    p.rect(0, COUNTER, W, 2, hex('#c98a4a'));
    p.rect(0, COUNTER + 2, W, 1, hex('#5a3a24'));
    for (let x = 0; x < W; x += 40) p.rect(x, COUNTER + 3, 1, H - COUNTER - 3, hex('#6a421e'));
    p.rect(POT.x - 44, COUNTER - 8, 88, 9, INK);
    p.rect(POT.x - 43, COUNTER - 7, 86, 7, hex('#5a5f78'));
    p.rect(POT.x - 43, COUNTER - 7, 86, 1, hex('#9aa0b4'));
    p.rect(POT.x - 30, COUNTER - 11, 60, 3, INK);
    for (let i = 0; i < 2; i++) {
      p.circle(POT.x - 30 + i * 60, COUNTER - 3, 2.6, INK);
      p.circle(POT.x - 30 + i * 60, COUNTER - 3, 1.6, hex('#dfe4ee'));
    }
    // 벽 선반과 그릇
    p.rect(10, 26, 50, 3, hex('#8a5a34'));
    p.rect(10, 26, 50, 1, hex('#c98a4a'));
    p.rect(14, 18, 10, 8, hex('#e2452f'));
    p.rect(14, 18, 10, 2, hex('#fffaf0'));
    p.rect(28, 20, 12, 6, hex('#53b8e8'));
    p.rect(44, 16, 8, 10, hex('#ffcc3d'));
    p.rect(44, 16, 8, 2, hex('#fffaf0'));
  });
}

export function potScene(stage, getState) {
  const bg = background();
  const R = new Rng(5);
  const ps = new Particles({ rng: R, ground: () => COUNTER - 1 });
  let t = 0;
  let lid = 0; // 뚜껑이 떠 있는 높이
  let lidV = 0;
  let heat = 0; // 0 조용 ~ 1 아주 시끄러움 (부드럽게 따라감)

  function update(dt) {
    t += dt;
    ps.update(dt);
    const s = getState();
    const zone = s.zone;
    const target = s.on ? clamp((s.level - (s.yellow - 22)) / (s.red + 8 - (s.yellow - 22))) : 0;
    heat += (target - heat) * Math.min(1, dt * 5);
    const { x, top, w } = POT;
    // 불
    if (s.on && R.chance(dt * (14 + heat * 50)))
      ps.spawn(P.FIRE, x + R.range(-24, 24), COUNTER - 11, R.range(-5, 5), R.range(-16, -4), R.range(0.14, 0.3), 0, R.range(1, 1.6 + heat * 1.6));
    // 김
    if (R.chance(dt * (2 + heat * 30)))
      ps.spawn(P.VAPOUR, x + R.range(-w / 2 + 4, w / 2 - 4), top - 4 - lid, R.range(-8, 8), R.range(-34, -14) - heat * 30, R.range(0.9, 1.7), '#fffaf0', R.range(3, 5 + heat * 5));
    if (zone === 'red') {
      // 넘쳐 흐르는 국물과 튀는 방울
      if (R.chance(dt * 26)) {
        const side = R.sign();
        ps.spawn(P.GRIT, x + side * (w / 2 + 1), top + 2, side * R.range(4, 30), R.range(-50, 10), R.range(0.5, 0.9), R.pick(['#ff9a3c', '#ffcc3d', '#fffaf0']), 2);
      }
      if (R.chance(dt * 16)) ps.spawn(P.SPARK, x + R.range(-20, 20), top - 2, R.range(-80, 80), R.range(-170, -60), R.range(0.2, 0.45));
      // 뚜껑이 들썩들썩
      if (lid <= 0.01) lidV = R.range(60, 110);
    } else if (zone === 'yellow' && lid <= 0.01 && R.chance(dt * 5)) lidV = R.range(18, 34);
    lidV -= 420 * dt;
    lid = Math.max(0, lid + lidV * dt);
    if (lid === 0) lidV = 0;
    if (zone === 'red' && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) stage.shake(1, 0.12);
  }

  function pot(p, zone) {
    const { x, top, w, h } = POT;
    const jx = zone === 'red' ? Math.round(Math.sin(t * 46) * 1) : 0;
    const X = x + jx;
    const l = X - w / 2;
    // 손잡이
    for (const s of [-1, 1]) {
      p.rect(X + s * (w / 2 + 4) - 3, top + 8, 7, 6, INK);
      p.rect(X + s * (w / 2 + 4) - 2, top + 9, 5, 4, hex('#3a2a52'));
    }
    // 몸통
    p.rect(l - 1, top, w + 2, h + 1, INK);
    p.rect(l, top + 1, w, h - 1, hex('#ffcc3d'));
    p.rect(l, top + 1, 5, h - 1, hex('#fff0a0'));
    p.rect(l + w - 9, top + 1, 9, h - 1, hex('#d99a1c'));
    p.rect(l, top + h - 4, w, 3, hex('#b87a14'));
    p.rect(l + 7, top + 4, 2, h - 12, hex('#fffaf0'));
    // 넘친 국물이 흘러내림
    if (zone === 'red')
      for (let i = 0; i < 7; i++) {
        const dx = 4 + i * 9;
        const len = 4 + Math.round((Math.sin(t * 5 + i * 1.9) * 0.5 + 0.5) * 12);
        p.rect(l + dx, top + 1, 3, len, hex('#ff9a3c'));
        p.rect(l + dx, top + 1, 1, len, hex('#ffcc3d'));
        p.px(l + dx + 1, top + 1 + len, hex('#ff9a3c'));
      }
    // 얼굴: 조용하면 방긋, 시끄러우면 깜짝, 너무 시끄러우면 으악
    const ey = top + 14;
    if (zone === 'red') {
      for (const s of [-1, 1]) {
        p.line(X + s * 14, ey - 2, X + s * 9, ey + 1, INK);
        p.line(X + s * 14, ey + 3, X + s * 9, ey + 1, INK);
      }
      p.rect(X - 5, ey + 7, 10, 6, INK);
      p.rect(X - 4, ey + 8, 8, 4, hex('#e2452f'));
      p.rect(X - 4, ey + 8, 8, 1, hex('#fffaf0'));
    } else if (zone === 'yellow') {
      for (const s of [-1, 1]) {
        p.circle(X + s * 11, ey + 1, 3, INK);
        p.rect(X + s * 11 - 1, ey - 1, 2, 2, hex('#fffaf0'));
      }
      p.circle(X, ey + 10, 2.4, INK);
      // 식은땀
      p.px(X + 22, ey - 4, hex('#53b8e8'));
      p.rect(X + 21, ey - 3, 3, 2, hex('#53b8e8'));
    } else {
      const blink = t % 3.4 < 0.14;
      for (const s of [-1, 1]) {
        if (blink) p.rect(X + s * 11 - 2, ey + 1, 5, 1, INK);
        else {
          p.px(X + s * 11 - 2, ey + 1, INK);
          p.px(X + s * 11 - 1, ey, INK);
          p.px(X + s * 11, ey - 1, INK);
          p.px(X + s * 11 + 1, ey, INK);
          p.px(X + s * 11 + 2, ey + 1, INK);
        }
        p.rect(X + s * 17 - 2, ey + 5, 4, 2, hex('#ff9a80'));
      }
      p.rect(X - 4, ey + 7, 1, 1, INK);
      p.rect(X - 3, ey + 8, 6, 1, INK);
      p.rect(X + 3, ey + 7, 1, 1, INK);
    }
    // 테두리와 뚜껑
    p.rect(l - 3, top - 2, w + 6, 4, INK);
    p.rect(l - 2, top - 1, w + 4, 2, hex('#fff0a0'));
    const ly = top - 2 - Math.round(lid);
    const tilt = lid > 0.5 ? Math.round(Math.sin(t * 30) * 1.5) : 0;
    if (lid > 2) {
      // 열린 틈으로 보이는 끓는 국물
      p.rect(l + 2, top - 3, w - 4, 2, hex('#ff9a3c'));
      for (let i = 0; i < 6; i++) p.circle(l + 8 + i * 9 + Math.sin(t * 9 + i) * 2, top - 3, 2 + (Math.sin(t * 12 + i * 2) > 0 ? 1 : 0), hex('#fff6c4'));
    }
    p.poly([[l - 1, ly + tilt], [l + 6, ly - 7 + tilt], [l + w - 6, ly - 7 - tilt], [l + w + 1, ly - tilt]], INK);
    p.poly([[l + 1, ly - 1 + tilt], [l + 7, ly - 6 + tilt], [l + w - 7, ly - 6 - tilt], [l + w - 1, ly - 1 - tilt]], hex('#dfe4ee'));
    p.line(l + 8, ly - 5 + tilt, l + w - 16, ly - 5, hex('#fffaf0'));
    p.rect(X - 4, ly - 11, 8, 5, INK);
    p.rect(X - 3, ly - 10, 6, 3, hex('#e2452f'));
    p.px(X - 3, ly - 10, hex('#ff9a80'));
  }

  function panel(p, s) {
    const zone = s.on ? s.zone : null;
    // 신호등
    p.rect(172, 12, 20, 52, INK);
    p.rect(173, 13, 18, 50, hex('#3a3350'));
    p.rect(173, 13, 18, 1, hex('#5a5078'));
    ['red', 'yellow', 'green'].forEach((z, i) => {
      const cy = 22 + i * 16;
      const on = zone === z;
      const c = hex(ZONE[z]);
      p.circle(182, cy, 6.5, INK);
      p.circle(182, cy, 5.5, on ? c : mix(c, INK, 0.72));
      if (on) {
        p.circle(180.5, cy - 1.5, 2, mix(c, hex('#ffffff'), 0.6));
        p.glow(182, cy, 22, c, 0.6 + Math.sin(t * 6) * 0.1);
      }
    });
    // 데시벨 숫자
    const str = s.on ? String(Math.round(s.level)) : '--';
    const col = zone ? hex(ZONE[zone]) : hex('#5548a0');
    digits(p, str, 236, 16, (gy) => (gy < 2 ? mix(col, hex('#ffffff'), 0.5) : col), { scale: 4, outline: INK, depth: mix(col, INK, 0.55) });
    p.text('dB', 274, 44, hex('#a9a0d0'), { font: 'big' });
    // 막대 계기: 기준선 두 개가 표시됨
    const x0 = 200;
    const n = 30;
    const pct = (db) => clamp((db - 30) / 70);
    for (let i = 0; i < n; i++) {
      const db = 30 + ((i + 0.5) / n) * 70;
      const z = db >= s.red ? 'red' : db >= s.yellow ? 'yellow' : 'green';
      const on = s.on && pct(s.level) * n > i;
      p.rect(x0 + i * 3, 62, 2, 7, on ? hex(ZONE[z]) : mix(hex(ZONE[z]), INK, 0.78));
    }
    for (const [db, z] of [[s.yellow, 'yellow'], [s.red, 'red']]) {
      const mx = x0 + Math.round(pct(db) * n) * 3 - 1;
      p.tri(mx - 2, 57, mx + 3, 57, mx + 0.5, 61, hex(ZONE[z]));
    }
    // 지나온 소리 크기 (기둥 그래프)
    p.rect(171, 74, 116, 24, hex('#161126'));
    const hist = s.history;
    const cols = 58;
    for (let i = 0; i < cols; i++) {
      const v = hist[hist.length - cols + i];
      if (v === undefined) continue;
      const hgt = Math.max(1, Math.round(pct(v) * 22));
      const z = v >= s.red ? 'red' : v >= s.yellow ? 'yellow' : 'green';
      p.rect(171 + i * 2, 98 - hgt, 2, hgt, hex(ZONE[z]));
      p.px(171 + i * 2, 98 - hgt, mix(hex(ZONE[z]), hex('#ffffff'), 0.5));
    }
    for (const [db, z] of [[s.yellow, 'yellow'], [s.red, 'red']]) {
      const y = 98 - Math.round(pct(db) * 22);
      for (let x = 171; x < 287; x += 4) p.px(x, y, hex(ZONE[z]));
    }
  }

  function draw(p) {
    const s = getState();
    const zone = s.on ? s.zone : 'green';
    blit(stage.frame, bg);
    ps.draw(p, 'back');
    pot(p, zone);
    // 불빛과 경고등
    if (s.on) p.glow(POT.x, COUNTER - 10, 40, hex('#ff8a2a'), 0.25 + heat * 0.35);
    if (zone === 'red') {
      const k = Math.sin(t * 9) * 0.5 + 0.5;
      p.glow(POT.x, 40, 120, hex('#ff3020'), 0.14 + k * 0.2);
    }
    panel(p, s);
    ps.draw(p, 'front');
  }

  return { update, draw };
}
