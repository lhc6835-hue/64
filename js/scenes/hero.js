// 첫 화면 풍경: 지금 시각에 맞춰 하늘이 바뀌는 운동장, 학교, 그리고 김이 나는 커다란 컵라면.

import { hex, mix, cycle, rand, TAU, clamp } from '../pixelfx/index.js';

export const HERO_W = 402;
export const HERO_H = 84;
const GROUND = 70;

const SKIES = {
  night: ['#0e0c24', '#15123a', '#1f1a50', '#2e2670', '#453a8c'],
  dawn: ['#3a3a80', '#7a5ca8', '#e88aa0', '#ffc0a0', '#ffe8c0'],
  day: ['#3f8fd8', '#58a8e8', '#7cc4f4', '#a8dcfa', '#d4f0ff'],
  dusk: ['#3b2a6e', '#7a3f8c', '#d85a6a', '#f89a4a', '#ffd27a'],
};

// 시각(0~24) → 하늘 색 띠 5개와 밤의 정도(0 낮 ~ 1 밤)
function skyAt(hour) {
  const keys = [
    [0, 'night', 1], [5, 'night', 1], [6.5, 'dawn', 0.45], [8, 'day', 0], [16.5, 'day', 0],
    [18, 'dusk', 0.4], [19.5, 'night', 1], [24, 'night', 1],
  ];
  let i = 0;
  while (i < keys.length - 2 && hour >= keys[i + 1][0]) i++;
  const [h0, a, n0] = keys[i];
  const [h1, b, n1] = keys[i + 1];
  const t = clamp((hour - h0) / (h1 - h0));
  return {
    bands: SKIES[a].map((c, k) => mix(hex(c), hex(SKIES[b][k]), t)),
    night: n0 + (n1 - n0) * t,
  };
}

function cloud(p, x, y, s, c, shade) {
  p.rect(x - 9 * s, y, 18 * s, 3 * s, shade);
  p.circle(x - 5 * s, y, 3.2 * s, c);
  p.circle(x, y - 2 * s, 4.4 * s, c);
  p.circle(x + 5 * s, y, 3.4 * s, c);
  p.rect(x - 8 * s, y, 16 * s, 2 * s, c);
}

function tree(p, x, y, s, T) {
  p.rect(x - 1, y - 5 * s, 2, 5 * s, T('#6a4226'));
  p.circle(x, y - 8 * s, 5 * s, T('#2f7a3c'));
  p.circle(x - 2 * s, y - 9 * s, 3.4 * s, T('#4ea04a'));
  p.circle(x + 2.4 * s, y - 6.4 * s, 2.6 * s, T('#25632f'));
  p.px(x - 3 * s, y - 10 * s, T('#8ccc5a'));
  p.px(x - 2 * s, y - 11 * s, T('#8ccc5a'));
}

function school(p, x, T, night, t) {
  const y = GROUND;
  const ink = hex('#1b1326');
  const wall = T('#f2e2c0');
  const wallLo = T('#d6bf94');
  const roof = T('#c0503a');
  const lit = night > 0.5;
  // 본관
  p.rect(x, y - 26, 78, 26, ink);
  p.rect(x + 1, y - 25, 76, 25, wall);
  p.rect(x + 1, y - 25, 76, 2, roof);
  p.rect(x + 1, y - 2, 76, 2, wallLo);
  // 가운데 탑과 시계
  p.rect(x + 30, y - 38, 18, 13, ink);
  p.rect(x + 31, y - 37, 16, 12, wall);
  p.rect(x + 31, y - 37, 16, 2, roof);
  p.circle(x + 39, y - 30, 3.6, ink);
  p.circle(x + 39, y - 30, 2.6, hex('#fffaf0'));
  p.px(x + 39, y - 31, ink);
  p.px(x + 39, y - 30, ink);
  p.px(x + 40, y - 30, ink);
  // 창문
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 8; c++) {
      if (r === 1 && (c === 3 || c === 4)) continue;
      const wx = x + 5 + c * 9;
      const wy = y - 21 + r * 10;
      const on = lit && rand(c, r, 7) > 0.35;
      p.rect(wx, wy, 6, 6, ink);
      p.rect(wx + 1, wy + 1, 4, 4, on ? hex('#ffd86a') : T('#7cc4f4'));
      p.px(wx + 1, wy + 1, on ? hex('#fff6c4') : T('#d4f0ff'));
      if (on) p.glow(wx + 3, wy + 3, 7, hex('#ffb040'), 0.35);
    }
  // 현관
  p.rect(x + 33, y - 12, 12, 12, ink);
  p.rect(x + 34, y - 11, 10, 11, T('#8a5a34'));
  p.rect(x + 38, y - 11, 2, 11, ink);
  // 깃대와 펄럭이는 깃발
  p.rect(x - 8, y - 34, 1, 34, T('#9aa0b4'));
  for (let i = 0; i < 9; i++) {
    const wave = Math.round(Math.sin(t * 4 - i * 0.7) * 1.2);
    p.rect(x - 7 + i, y - 34 + wave, 1, 5, i % 3 === 2 ? T('#fffaf0') : T('#e2452f'));
  }
}

// 커다란 컵라면 (바닥 가운데가 x, GROUND)
function cup(p, x, t) {
  const y = GROUND + 4;
  const ink = hex('#1b1326');
  const H = 30;
  for (let i = 0; i < H; i++) {
    // 위가 넓고 아래가 좁은 컵
    const half = Math.round(17 - (i / H) * 5);
    const yy = y - H + i;
    p.rect(x - half - 1, yy, half * 2 + 2, 1, ink);
    let c = '#e2452f';
    if (i >= 9 && i < 19) c = '#ffcc3d';
    if (i === 8 || i === 19) c = '#a82a26';
    p.rect(x - half, yy, half * 2, 1, hex(c));
    // 왼쪽에서 빛: 왼쪽 밝게, 오른쪽 어둡게
    p.rect(x - half, yy, 2, 1, hex(i >= 9 && i < 19 ? '#fff0a0' : '#ff7a59'));
    p.rect(x + half - 4, yy, 4, 1, hex(i >= 9 && i < 19 ? '#d99a1c' : '#a82a26'));
  }
  p.rect(x - 13, y, 26, 1, ink);
  // 노란 띠 안의 무늬(면발 물결)
  for (let i = -9; i <= 8; i++) p.px(x + i, y - 16 + Math.round(Math.sin(i * 0.9) * 1.6), hex('#e2452f'));
  for (let i = -9; i <= 8; i++) p.px(x + i, y - 13 + Math.round(Math.sin(i * 0.9 + 1.5) * 1.6), hex('#a82a26'));
  // 테두리와 반쯤 열린 뚜껑
  p.rect(x - 20, y - H - 3, 40, 4, ink);
  p.rect(x - 19, y - H - 2, 38, 2, hex('#fffaf0'));
  p.rect(x - 19, y - H - 1, 38, 1, hex('#dcc592'));
  const lift = Math.round(Math.sin(t * 1.4) * 1);
  p.poly([[x - 20, y - H - 3], [x + 4, y - H - 3], [x - 2, y - H - 9 + lift], [x - 22, y - H - 7 + lift]], ink);
  p.poly([[x - 19, y - H - 4], [x + 2, y - H - 4], [x - 3, y - H - 8 + lift], [x - 20, y - H - 7 + lift]], hex('#dfe4ee'));
  p.line(x - 19, y - H - 7 + lift, x - 4, y - H - 8 + lift, hex('#fffaf0'));
  // 나무젓가락
  p.line(x + 6, y - H - 3, x + 22, y - H - 20, ink);
  p.line(x + 7, y - H - 3, x + 23, y - H - 20, hex('#e8b06a'));
  p.line(x + 10, y - H - 3, x + 27, y - H - 18, ink);
  p.line(x + 11, y - H - 3, x + 28, y - H - 18, hex('#c98a4a'));
  // 김: 부드럽게 피어올라 흩어짐
  cycle(t, 3.2, 9, 41, (g) => g.range(2.2, 3.2), (age, life, r) => {
    const k = age / life;
    const sx = x - 6 + r.range(-7, 9) + Math.sin(age * 2 + r.range(0, TAU)) * (3 + k * 5);
    const sy = y - H - 6 - k * (22 + r.range(0, 12));
    p.disc(sx, sy, 2 + k * 5, hex('#fffaf0'), (1 - k) * (1 - k) * 0.55 * Math.min(1, age * 4));
  });
  p.glow(x, y - H - 8, 26, hex('#ffb060'), 0.22);
  p.glow(x - 8, y - 14, 22, hex('#ff7a40'), 0.12);
}

export function heroScene() {
  let t = 0;
  return {
    update(dt) {
      t += dt;
    },
    draw(p) {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      const { bands, night } = skyAt(hour);
      const dark = hex('#1a1840');
      const T = (c) => mix(hex(c), dark, night * 0.62);

      // 하늘: 색 띠 5개, 경계는 디더링
      const bh = GROUND / bands.length;
      bands.forEach((c, i) => {
        p.rect(0, Math.round(i * bh), HERO_W, Math.ceil(bh), c);
        if (i) p.rect(0, Math.round(i * bh) - 2, HERO_W, 2, c, 0.5);
      });

      // 별
      if (night > 0.3)
        for (let i = 0; i < 46; i++) {
          const sx = rand(i, 1) * HERO_W;
          const sy = rand(i, 2) * (GROUND - 22);
          const tw = Math.sin(t * (1 + rand(i, 3) * 2) + i) * 0.5 + 0.5;
          if (tw * night > 0.35) p.px(sx, sy, rand(i, 4) > 0.8 ? hex('#fff6c4') : hex('#b0a4f0'));
          if (rand(i, 5) > 0.9 && tw > 0.7) {
            p.px(sx + 1, sy, hex('#8c7ad8'));
            p.px(sx - 1, sy, hex('#8c7ad8'));
            p.px(sx, sy + 1, hex('#8c7ad8'));
            p.px(sx, sy - 1, hex('#8c7ad8'));
          }
        }

      // 해 또는 달: 하루 동안 왼쪽에서 오른쪽으로 호를 그림
      const isDay = hour >= 6 && hour < 18.5;
      const u = isDay ? (hour - 6) / 12.5 : ((hour + 24 - 18.5) % 24) / 11.5;
      const cx = 30 + u * (HERO_W - 60);
      const cy = 46 - Math.sin(u * Math.PI) * 34;
      if (isDay) {
        p.circle(cx, cy, 6.5, hex('#ffcc3d'));
        p.circle(cx - 1, cy - 1, 4.5, hex('#fff0a0'));
        p.glow(cx, cy, 30, hex('#ffd060'), 0.5);
      } else {
        p.circle(cx, cy, 6, hex('#fff6d8'));
        p.circle(cx + 3, cy - 2, 5, bands[1]);
        p.px(cx - 3, cy + 1, hex('#dcd0a8'));
        p.glow(cx, cy, 24, hex('#b0b8ff'), 0.3);
      }

      // 구름 (먼 것은 느리게)
      const cc = mix(hex('#ffffff'), bands[2], 0.25 + night * 0.5);
      const cs = mix(hex('#d4e4f4'), bands[1], 0.3 + night * 0.5);
      for (let i = 0; i < 5; i++) {
        const sp = 2 + rand(i, 11) * 4;
        const x = ((rand(i, 12) * 500 + t * sp) % (HERO_W + 80)) - 40;
        cloud(p, x, 10 + rand(i, 13) * 30, 0.7 + rand(i, 14) * 0.6, cc, cs);
      }

      // 먼 산
      for (let x = 0; x < HERO_W; x++) {
        const h = 8 + Math.sin(x * 0.035) * 5 + Math.sin(x * 0.11 + 2) * 2;
        p.rect(x, GROUND - h, 1, h, mix(bands[3], hex('#2b2452'), 0.35 + night * 0.3));
      }

      // 운동장
      p.rect(0, GROUND, HERO_W, HERO_H - GROUND, T('#e8c890'));
      p.rect(0, GROUND, HERO_W, 1, T('#b89460'));
      for (let x = 0; x < HERO_W; x += 7) p.px(x + ((x * 7) % 5), GROUND + 3 + ((x * 3) % 9), T('#cfae78'));
      p.rect(20, GROUND + 8, HERO_W - 40, 1, T('#fffaf0'), 0.5);

      tree(p, 28, GROUND, 1.2, T);
      tree(p, 52, GROUND, 0.9, T);
      school(p, 238, T, night, t);
      tree(p, 330, GROUND, 1, T);
      tree(p, 372, GROUND, 1.2, T);
      // 철봉
      p.rect(92, GROUND - 9, 1, 9, T('#5a5f78'));
      p.rect(106, GROUND - 9, 1, 9, T('#5a5f78'));
      p.rect(92, GROUND - 9, 15, 1, T('#9aa0b4'));

      cup(p, 180, t);
    },
  };
}
