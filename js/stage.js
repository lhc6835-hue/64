// 픽셀 무대: 작은 해상도의 그림판(프레임)에 그린 뒤 정수 배로 키워 보여 줌.
// 그리는 일은 pixelfx 코어(Painter, Particles …)가 하고, 여기서는 화면 맞춤·반복·흔들림만 맡습니다.

import { createFrame, clearFrame, composite, painterFor, hex } from './pixelfx/index.js';

export class Stage {
  /**
   * host: 캔버스를 넣을 요소. opts: { w, h (그림판 크기), reserve (무대 아래에 남겨 둘 높이 px), bg }
   * scene: { update(dt, stage), draw(p, stage) } — p 는 pixelfx Painter
   */
  constructor(host, { w, h, reserve = 200, bg = '#0b0a10', maxScale = 9 }) {
    this.host = host;
    this.w = w;
    this.h = h;
    this.reserve = reserve;
    this.maxScale = maxScale;
    this.bg = hex(bg);
    this.frame = createFrame(w, h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.className = 'stage-canvas';
    host.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.img = new ImageData(w, h);
    this.scene = null;
    this.t = 0;
    this.raf = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.scale = 1;
    this.fit = this.fit.bind(this);
    this.loop = this.loop.bind(this);
    addEventListener('resize', this.fit);
    document.addEventListener('fullscreenchange', this.fit);
    this.fit();
  }

  fit() {
    // 무대를 감싼 칸(.screen 등)의 너비에서 테두리 두께만큼 뺀 것이 쓸 수 있는 너비
    const availW = (this.host.parentElement?.clientWidth || innerWidth) - 30;
    const top = this.host.getBoundingClientRect().top + scrollY;
    const availH = innerHeight - Math.min(top, 140) - this.reserve;
    this.scale = Math.max(1, Math.min(this.maxScale, Math.floor(Math.min(availW / this.w, availH / this.h))));
    this.canvas.style.width = this.w * this.scale + 'px';
    this.canvas.style.height = this.h * this.scale + 'px';
    this.onfit?.(this.scale);
  }

  start(scene) {
    this.scene = scene;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    return this;
  }

  /** amp 픽셀만큼 dur 초 동안 화면 흔들기 */
  shake(amp = 2, dur = 0.25) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeDur = this.shakeT;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const f = this.frame;
    this.scene.update?.(dt, this);
    clearFrame(f);
    this.scene.draw(painterFor(f), this);
    composite(f, this.img.data, this.bg);
    this.ctx.putImageData(this.img, 0, 0);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur) * this.shakeAmp * this.scale;
      const dx = Math.round((Math.random() * 2 - 1) * k);
      const dy = Math.round((Math.random() * 2 - 1) * k);
      this.canvas.style.transform = this.shakeT > 0 ? `translate(${dx}px,${dy}px)` : '';
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.fit);
    document.removeEventListener('fullscreenchange', this.fit);
    this.canvas.remove();
  }
}

/** 그림판의 색을 k 배로 어둡게 (0..1). holes: [{x, y, r}] 는 조명이 닿아 밝게 남는 곳 */
export function darken(frame, k, holes = []) {
  if (k >= 0.995) return;
  const { w, h, color: C } = frame;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let kk = k;
      for (const o of holes) {
        const dx = x + 0.5 - o.x;
        const dy = (y + 0.5 - o.y) * (o.sy || 1);
        const d = Math.sqrt(dx * dx + dy * dy) / o.r;
        if (d < 1) {
          // 가장자리는 디더링으로 계단지게
          const edge = d > 0.8 ? ((x + y) & 1 ? 0.5 : 0.25) : 1;
          kk = Math.max(kk, k + (1 - k) * edge);
        }
      }
      if (kk >= 0.995) continue;
      const i = y * w + x;
      const c = C[i];
      if (!c) continue;
      C[i] = (c & 0xff000000) | ((((c >>> 16) & 255) * kk) << 16) | ((((c >>> 8) & 255) * kk) << 8) | ((c & 255) * kk);
    }
}

/** 미리 그려 둔 배경(Uint32Array)을 그림판에 깔기 */
export function blit(frame, buf) {
  frame.color.set(buf);
}

/** 한 번만 그리면 되는 배경을 미리 그려서 Uint32Array 로 */
export function prerender(w, h, drawFn) {
  const f = createFrame(w, h);
  drawFn(painterFor(f), f);
  return f.color.slice();
}
