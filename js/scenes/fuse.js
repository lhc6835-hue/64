// 타이머 장면: 밤하늘 아래 도화선이 타들어 가고, 시간이 다 되면 로켓이 날아올라 불꽃놀이가 터집니다.

import { hex, mix, createFx, Particles, P, PF, Rng, clamp, rand, TAU } from '../pixelfx/index.js';
import { blit, prerender } from '../stage.js';
import * as firework from '../fx/firework.js';
import { digits } from './digits.js';

export const W = 300;
export const H = 128;
const GROUND = 110;
const INK = hex('#1b1326');
const FX0 = 22; // 도화선 시작
const FX1 = 262; // 도화선 끝(로켓 꼬리)
const fuseY = (x) => GROUND - 5 + Math.round(Math.sin(x * 0.11) * 3 + Math.sin(x * 0.043 + 1) * 2);
const PALS = [
  ['#3a0a14', '#a01824', '#ff5a50', '#ffae35', '#ffe27a', '#ffffff'],
  ['#0c1430', '#1f4f94', '#58b4ec', '#9bdcff', '#d8f4ff', '#ffffff'],
  ['#0d1a0c', '#265e18', '#6cb82a', '#a8e04a', '#e0ff8a', '#ffffff'],
  ['#1a0516', '#701560', '#f53cd1', '#ff86e6', '#ffd2f6', '#ffffff'],
  ['#1e1206', '#86520c', '#f0b424', '#ffe066', '#fff6c4', '#ffffff'],
];

function background() {
  return prerender(W, H, (p) => {
    const bands = ['#0e0c24', '#15123a', '#1f1a50', '#2e2670', '#453a8c', '#6a4a9c'];
    const bh = GROUND / bands.length;
    bands.forEach((c, i) => {
      p.rect(0, Math.round(i * bh), W, Math.ceil(bh) + 1, hex(c));
      if (i) p.rect(0, Math.round(i * bh) - 2, W, 2, hex(c), 0.5);
    });
    // 먼 동네의 지붕들과 불 켜진 창
    for (let i = 0; i < 16; i++) {
      const bw = 12 + Math.floor(rand(i, 1) * 14);
      const bx = i * 20 - 6 + Math.floor(rand(i, 2) * 6);
      const bhh = 8 + Math.floor(rand(i, 3) * 16);
      p.rect(bx, GROUND - bhh, bw, bhh, hex('#161230'));
      if (rand(i, 4) > 0.5) p.tri(bx - 1, GROUND - bhh, bx + bw / 2, GROUND - bhh - 5, bx + bw + 1, GROUND - bhh, hex('#161230'));
      for (let k = 0; k < 4; k++)
        if (rand(i, k, 5) > 0.55) p.rect(bx + 2 + (k % 2) * 5, GROUND - bhh + 3 + Math.floor(k / 2) * 5, 2, 2, hex('#ffcc3d'));
    }
    // 풀밭
    p.rect(0, GROUND, W, H - GROUND, hex('#1f4a34'));
    p.rect(0, GROUND, W, 1, hex('#3a7a4a'));
    for (let x = 0; x < W; x += 3) p.px(x + (x % 2), GROUND - 1, hex('#2f6a40'));
    for (let i = 0; i < 70; i++) p.px(rand(i, 6) * W, GROUND + 2 + rand(i, 7) * (H - GROUND - 3), hex(rand(i, 8) > 0.5 ? '#2a5e3e' : '#18402c'));
  });
}

export function fuseScene(stage, getTimer) {
  const bg = background();
  const R = new Rng(11);
  const ps = new Particles({ rng: R, ground: () => GROUND + 2 });
  let t = 0;
  let fxs = [];
  let rocketY = 0; // 날아오른 높이
  let rocketV = 0;
  let wasRinging = false;
  let nextShow = 0;
  let shown = 0;

  function update(dt) {
    t += dt;
    ps.update(dt);
    for (const f of fxs) f.update(dt);
    fxs = fxs.filter((f) => !f.done());
    const tm = getTimer();
    const ratio = tm.total > 0 ? clamp(1 - tm.remain / tm.total) : 0;
    const bx = FX0 + (FX1 - FX0) * ratio;
    const by = fuseY(bx);

    if (tm.running) {
      // 타들어 가는 불꽃
      if (R.chance(dt * 34)) ps.spawn(P.SPARK, bx, by, R.range(-70, 40), R.range(-110, -20), R.range(0.15, 0.4));
      if (R.chance(dt * 16)) ps.spawn(P.FIRE, bx + R.range(-1, 1), by - 1, R.range(-6, 6), R.range(-18, -6), R.range(0.2, 0.4), 0, R.range(1.2, 2.2), 0, R.chance(0.3) ? PF.SMOKES : 0);
    } else if (!tm.ringing && ratio > 0 && R.chance(dt * 3)) {
      ps.spawn(P.SMOKE, bx, by - 1, R.range(-3, 3), -8, R.range(0.8, 1.4), 0, 2); // 멈췄을 땐 연기만 솔솔
    }

    if (tm.ringing && !wasRinging) {
      rocketV = 30;
      nextShow = 0.7;
      shown = 0;
      stage.shake(2, 0.3);
    }
    if (!tm.ringing && wasRinging) {
      rocketY = 0;
      rocketV = 0;
    }
    wasRinging = tm.ringing;
    if (tm.ringing) {
      // 로켓 발사
      if (rocketY < 200) {
        rocketV += 520 * dt;
        rocketY += rocketV * dt;
        for (let i = 0; i < 3; i++)
          ps.spawn(P.FIRE, FX1 + 9 + R.range(-2, 2), GROUND - 2 - rocketY + 12, R.range(-14, 14), R.range(30, 90), R.range(0.2, 0.5), 0, R.range(1.5, 3), 0, PF.SMOKES);
      }
      // 끌 때까지 이어지는 불꽃놀이
      nextShow -= dt;
      if (nextShow <= 0) {
        nextShow = shown < 3 ? 0.28 : R.range(0.45, 0.95);
        shown++;
        fxs.push(createFx(firework, { x: R.range(40, W - 40), y: GROUND, height: R.range(60, 96), rise: R.range(0.45, 0.7), palette: R.pick(PALS), seed: 1 + Math.floor(R.next() * 9999) }));
      }
    }
  }

  function rocket(p, y) {
    const x = FX1 + 9;
    // 발사대
    if (y < 4) {
      p.rect(x - 8, GROUND - 3, 16, 3, INK);
      p.rect(x - 7, GROUND - 2, 14, 2, hex('#5a5f78'));
    }
    const b = GROUND - 3 - y;
    p.tri(x - 6, b, x - 2, b - 9, x - 2, b, hex('#a82a26'));
    p.tri(x + 6, b, x + 2, b - 9, x + 2, b, hex('#7a1a22'));
    p.rect(x - 4, b - 22, 8, 22, INK);
    p.rect(x - 3, b - 21, 6, 20, hex('#fffaf0'));
    p.rect(x + 1, b - 21, 2, 20, hex('#dcc592'));
    for (let i = 0; i < 3; i++) p.rect(x - 3, b - 18 + i * 7, 6, 3, hex(i === 1 ? '#ffcc3d' : '#e2452f'));
    p.tri(x - 5, b - 22, x, b - 31, x + 5, b - 22, INK);
    p.tri(x - 3, b - 22, x, b - 28, x + 3, b - 22, hex('#e2452f'));
    p.px(x - 1, b - 25, hex('#ff9a80'));
  }

  function draw(p) {
    const tm = getTimer();
    const sec = Math.ceil(tm.remain);
    const active = tm.running || (tm.remain < tm.total && !tm.ringing);
    const warn = active && tm.total > 60 && sec <= 60 && sec > 10;
    const danger = active && sec <= 10;
    blit(stage.frame, bg);

    // 별
    for (let i = 0; i < 40; i++) {
      const tw = Math.sin(t * (1 + rand(i, 3) * 2) + i) * 0.5 + 0.5;
      if (tw > 0.3) p.px(rand(i, 1) * W, rand(i, 2) * 62, hex(rand(i, 4) > 0.8 ? '#fff6c4' : '#8c7ad8'));
    }
    // 급해질수록 하늘이 달아오름
    if (warn) p.glow(W / 2, GROUND, 170, hex('#ff9a3c'), 0.16);
    if (danger) p.glow(W / 2, GROUND, 190, hex('#ff3020'), 0.22 + Math.sin(t * TAU) * 0.1);

    // 도화선: 탄 부분은 재만 남음
    const ratio = tm.ringing ? 1 : tm.total > 0 ? clamp(1 - tm.remain / tm.total) : 0;
    const bx = FX0 + (FX1 - FX0) * ratio;
    for (let x = FX0; x <= FX1; x++) {
      const y = fuseY(x);
      if (x < bx) {
        if (x % 3 === 0) p.px(x, y + 1, hex('#2a2030'));
      } else {
        p.px(x, y, hex(x % 4 < 2 ? '#e8d0a0' : '#b89460'));
        p.px(x, y + 1, hex('#6a5030'));
      }
    }
    // 도화선 머리의 막대
    p.rect(FX0 - 3, fuseY(FX0) - 1, 3, 4, hex('#5a3a24'));
    if (!tm.ringing) {
      const by = fuseY(bx);
      if (tm.running) {
        p.px(bx, by, hex('#ffffff'));
        p.px(bx + 1, by, hex('#ffe27a'));
        p.glow(bx, by, 16 + Math.sin(t * 30) * 2, hex('#ffae35'), 0.75);
        p.glow(bx, by, 40, hex('#ff7020'), 0.2);
      } else if (ratio > 0) {
        p.px(bx, by, hex(Math.sin(t * 6) > 0 ? '#ff7020' : '#a82a26'));
        p.glow(bx, by, 7, hex('#ff5020'), 0.3);
      }
    }
    rocket(p, rocketY);

    for (const f of fxs) {
      f.draw(stage.frame);
      p.reset();
    }
    ps.draw(p);

    // 남은 시간
    const s = tm.ringing ? 0 : Math.max(0, Math.ceil(tm.remain));
    const str = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const blinkOff = (tm.ringing && Math.floor(t * 3) % 2 === 0) || (!tm.running && !tm.ringing && tm.remain < tm.total && Math.floor(t * 1.6) % 2 === 0);
    const jit = danger && tm.running ? Math.round(Math.sin(t * 50)) : 0;
    const tone = danger || tm.ringing ? ['#ffffff', '#ffb0a0', '#ff6a50', '#e2452f'] : warn ? ['#ffffff', '#fff0a0', '#ffcc3d', '#ff9a3c'] : ['#ffffff', '#fffaf0', '#f8ecd0', '#dcc592'];
    if (!blinkOff || tm.ringing) {
      p.fade = blinkOff ? 0.45 : 1;
      digits(p, str, W / 2 + jit, 18, (gy) => hex(gy < 1 ? tone[0] : gy < 4 ? tone[1] : gy < 7 ? tone[2] : tone[3]), { scale: 6, outline: INK, depth: hex(danger || tm.ringing ? '#7a1a22' : warn ? '#a8501c' : '#8a7450') });
      p.fade = 1;
    } else {
      digits(p, str, W / 2, 18, hex('#3d3470'), { scale: 6, outline: INK, depth: hex('#2b2452') });
    }
  }

  return { update, draw };
}
