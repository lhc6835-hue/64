// 뿅! 하고 나타날 때: 바닥에서 먼지 구름이 양옆으로 퍼지고, 별이 튀고, 작은 반짝이가 남음.
// 6학년 4반 사이트용으로 직접 만든 이펙트 (pixelfx 코어 사용).

import { Particles, Lights, P, Rng, fit, sparkle, ease, TAU } from '../pixelfx/index.js';

export const meta = {
  name: 'Seat poof', desc: 'A soft dust poof with popping stars, for something appearing on the spot.',
  tags: ['spawn', 'poof', 'ui'], size: [72, 56], origin: [36, 40], duration: 1.1, loop: false, fps: 30, bg: 'ground',
  options: { palette: ['#86520c', '#c48412', '#f0b424', '#ffe066', '#fff6c4', '#ffffff'], dust: '#f8ecd0', seed: 5 },
};

export function create(o) {
  const C = fit(o.palette, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 2, sparks: [C[5], C[4], C[3], C[1]] }), lights = new Lights();
  lights.add(0, -8, 26, C[4], 0.9, 0.4);
  // 먼지: 바닥을 따라 양옆으로, 몇 개는 위로
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    ps.spawn(P.DUST, side * R.range(1, 5), R.range(-3, 1), side * R.range(40, 120), R.range(-34, -4), R.range(0.35, 0.7), o.dust, R.range(2.5, 4.5));
  }
  for (let i = 0; i < 5; i++) ps.spawn(P.VAPOUR, R.range(-4, 4), -6, R.range(-20, 20), R.range(-70, -30), R.range(0.4, 0.7), o.dust, R.range(3, 5));
  // 튀어 오르는 불꽃 몇 개와 별
  for (let i = 0; i < 10; i++) {
    const a = R.range(-Math.PI * 0.9, -Math.PI * 0.1), sp = R.range(70, 190);
    ps.spawn(P.SPARK, 0, -6, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.45));
  }
  for (let i = 0; i < 6; i++) {
    const a = R.range(0, TAU), d = R.range(8, 20);
    ps.spawn(P.STAR, Math.cos(a) * d, -10 + Math.sin(a) * d * 0.7, 0, -8, R.range(0.35, 0.8), R.pick([C[3], C[4]]), R.range(1.5, 3.5), R.range(0.05, 0.4));
  }
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); lights.update(dt); },
    drawBack(p) { ps.draw(p, 'back'); },
    draw(p) {
      if (t < 0.06) p.circle(0, -8, 7 + t * 60, C[5]);
      if (t < 0.22) {
        const u = t / 0.22;
        p.ring(0, -8, 5 + ease.outQuart(u) * 15, Math.max(1, 3 * (1 - u)), C[4], 1.1 - u);
        sparkle(p, 0, -8, 8 * (1 - u), C[5], C[3]);
      }
      ps.draw(p, 'front');
      lights.draw(p);
    },
  };
}
