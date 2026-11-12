// 캡슐이 터지는 순간: 흰 섬광 → 여덟 갈래 빛줄기 → 고리 → 튀는 불꽃과 껍데기 조각 → 색종이와 반짝이가 천천히 가라앉음.
// 6학년 4반 사이트용으로 직접 만든 이펙트 (pixelfx 코어 사용).

import { Particles, Bits, Lights, P, B, Rng, fit, sparkle, flare, ease, clamp, TAU, hex } from '../pixelfx/index.js';

export const meta = {
  name: 'Capsule pop', desc: 'A gacha capsule bursts open: white flash, flare, ring, sparks, shell halves, confetti and glints.',
  tags: ['ui', 'reward', 'burst'], size: [160, 128], origin: [80, 64], duration: 2.6, loop: false, fps: 30, bg: 'dark',
  options: { palette: ['#4a2c08', '#86520c', '#c48412', '#f0b424', '#ffe066', '#fff6c4', '#ffffff'], shell: '#e2452f', seed: 3, floor: 46 },
};

const CONFETTI = ['#e2452f', '#ffcc3d', '#5cbd5a', '#53b8e8', '#ff8fb8', '#fffaf0', '#7a5cc8'];

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), floor = () => o.floor;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[2]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const shell = hex(o.shell);
  lights.add(0, 0, 60, C[5], 0.9, 0.35);
  lights.add(0, 0, 44, C[4], 0.6, 1.4);
  // 불꽃: 사방으로 빠르게 튀었다가 떨어져 바닥에서 튐
  for (let i = 0; i < 46; i++) {
    const a = R.range(0, TAU), sp = R.range(90, 330);
    ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp - 50, R.range(0.25, 0.75));
  }
  // 껍데기 두 쪽: 위쪽은 색, 아래쪽은 흰색. 돌면서 날아가 바닥에 구름
  bits.add({ kind: B.CHUNK, x: -2, y: -3, vx: -120, vy: -260, a: 0.4, va: -9, s: 6, g: 0.9, bounce: 0.45, life: 2.2,
    ramp: ['#1b1326', '#7a1a22', '#a82a26', shell, '#ff9a80'] });
  bits.add({ kind: B.CHUNK, x: 2, y: 3, vx: 140, vy: -200, a: -0.3, va: 8, s: 6, g: 0.9, bounce: 0.45, life: 2.2,
    ramp: ['#1b1326', '#9a8c70', '#dcc592', '#f8ecd0', '#ffffff'] });
  // 색종이: 가볍게 흩날리다 가라앉음
  for (let i = 0; i < 44; i++) {
    const a = R.range(-Math.PI, 0) + R.range(-0.5, 0.5), sp = R.range(60, 240);
    ps.spawn(P.GRIT, R.range(-3, 3), R.range(-3, 3), Math.cos(a) * sp, Math.sin(a) * sp * 1.1 - 40, R.range(1.1, 2.3), R.pick(CONFETTI), R.chance(0.5) ? 2 : 1, R.range(0, 0.08));
  }
  // 반짝이: 조금 늦게 여기저기서 깜빡임
  for (let i = 0; i < 16; i++) {
    const a = R.range(0, TAU), d = R.range(12, 58);
    ps.spawn(P.STAR, Math.cos(a) * d, Math.sin(a) * d * 0.8 - 4, R.range(-6, 6), R.range(-14, -2), R.range(0.6, 1.5), R.pick([C[4], C[5], C[6]]), R.range(1.5, 4.5), R.range(0.12, 0.9));
  }
  // 옅은 김
  for (let i = 0; i < 9; i++) ps.spawn(P.VAPOUR, R.range(-6, 6), R.range(-6, 6), R.range(-50, 50), R.range(-50, 10), R.range(0.5, 1), '#fff6c4', R.range(5, 9));
  let t = 0;
  return {
    update(dt) { t += dt; ps.update(dt); bits.update(dt); lights.update(dt); },
    drawBack(p) { ps.draw(p, 'back'); },
    draw(p) {
      // 1~2 프레임짜리 흰 섬광
      if (t < 0.07) { p.circle(0, 0, 12 + t * 160, C[6]); p.glow(0, 0, 60, C[6], 1.1); }
      // 빛줄기: 빠르게 뻗고 금방 사라짐
      if (t < 0.34) flare(p, 0, 0, 10 + ease.outExpo(t / 0.34) * 46, 1 - t / 0.34, C);
      // 퍼져 나가는 고리
      if (t > 0.03 && t < 0.5) {
        const u = (t - 0.03) / 0.47, r = 8 + ease.outQuart(u) * 50;
        p.ring(0, 0, r, Math.max(1, 5 * (1 - u)), (v) => (v > 0.6 ? C[6] : C[4]), 1.1 - u * 1.1);
        p.glowRing(0, 0, r, 9, C[4], 0.5 * (1 - u));
      }
      if (t > 0.07 && t < 0.3) sparkle(p, 0, 0, 12 * (1 - (t - 0.07) / 0.23), C[5], C[3]);
      bits.draw(p);
      ps.draw(p, 'front');
      lights.draw(p);
    },
  };
}
