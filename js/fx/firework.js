// 불꽃놀이 한 발: 꼬리를 끌며 올라가 → 흰 섬광 → 두 겹으로 터지는 불꽃이 중력에 처지며 색이 식고 → 깜빡이며 사라짐.
// 6학년 4반 사이트용으로 직접 만든 이펙트 (pixelfx 코어 사용).

import { Lights, Rng, fit, fly, flyV, ease, clamp, TAU, sparkle, hex, scale } from '../pixelfx/index.js';

export const meta = {
  name: 'Class firework', desc: 'A rocket climbs on a sparkling tail and bursts into a two-layer chrysanthemum that droops, cools and twinkles out.',
  tags: ['firework', 'celebration'], size: [140, 150], origin: [70, 146], duration: 2.9, loop: false, fps: 30, bg: 'dark',
  options: { palette: ['#3a0a14', '#a01824', '#ff5a50', '#ffae35', '#ffe27a', '#ffffff'], seed: 1, height: 96, rise: 0.75 },
};

export function create(o) {
  const C = fit(o.palette, 6), R = new Rng(o.seed), lights = new Lights();
  const T0 = o.rise, H = o.height, drift = R.range(-8, 8);
  // 터지는 가지: 바깥 겹(빠름)과 안쪽 겹(느림), 저마다 속도·수명이 다름
  const arms = [];
  const n1 = 30, n2 = 16;
  for (let i = 0; i < n1; i++) arms.push({ a: (i / n1) * TAU + R.range(-0.08, 0.08), sp: R.range(120, 150), life: R.range(1.2, 1.8), tw: R.range(0, 9), hot: 0 });
  for (let i = 0; i < n2; i++) arms.push({ a: (i / n2) * TAU + R.range(-0.1, 0.1), sp: R.range(55, 78), life: R.range(0.9, 1.4), tw: R.range(0, 9), hot: 1 });
  let t = 0, lit = false;
  const top = (u) => [drift * u + Math.sin(u * 9) * 1.2, -H * ease.outCubic(u)];
  return {
    update(dt) {
      t += dt;
      lights.update(dt);
      if (!lit && t >= T0) { lit = true; lights.add(drift, -H, 60, C[4], 0.9, 0.5); lights.add(drift, -H, 55, C[2], 0.5, 1.6); }
    },
    draw(p) {
      if (t < T0) {
        // 올라가는 로켓: 흰 머리, 아래로 식어 가는 점선 꼬리
        const u = t / T0, [x, y] = top(u);
        for (let k = 0; k < 14; k++) {
          const uu = u - k * 0.022;
          if (uu < 0) break;
          const [tx, ty] = top(uu);
          p.dot(tx + ((k * 7) % 3) - 1, ty, k < 2 ? C[5] : k < 6 ? C[4] : C[3], 1 - k / 14);
        }
        p.px(x, y, C[5]);
        p.px(x, y - 1, C[5]);
        p.glow(x, y, 9, C[4], 0.6);
        return;
      }
      const s = t - T0, cx = drift, cy = -H;
      if (s < 0.07) { p.circle(cx, cy, 4 + s * 90, C[5]); p.glow(cx, cy, 42, C[5], 0.9); }
      if (s < 0.25) sparkle(p, cx, cy, 12 * (1 - s / 0.25), C[5], C[4]);
      for (const a of arms) {
        if (s > a.life) continue;
        const k = s / a.life, vx = Math.cos(a.a) * a.sp, vy = Math.sin(a.a) * a.sp;
        const [x, y] = fly(cx, cy, vx, vy, s, 46, 2.6);
        // 지나온 길을 따라 식어 가는 꼬리
        for (let j = 1; j <= 11; j++) {
          const sj = s - j * 0.03;
          if (sj < 0) break;
          const [tx, ty] = fly(cx, cy, vx, vy, sj, 46, 2.6);
          p.dot(tx, ty, j < 4 ? C[3] : C[2 - (j > 8 ? 1 : 0)], (1 - k) * (1 - j / 12) * 1.5);
        }
        // 머리: 끝날 무렵엔 깜빡임
        const blink = k > 0.6 ? Math.sin(s * 34 + a.tw) > -0.2 : true;
        if (blink) {
          const head = k < 0.25 ? C[5] : k < 0.6 ? (a.hot ? C[5] : C[4]) : C[3];
          p.px(x, y, head);
          if (k < 0.5) p.px(x + 1, y, head);
          p.glow(x, y, 5, a.hot ? C[4] : C[2], 0.5 * (1 - k));
        }
      }
      lights.draw(p);
    },
  };
}
