// 픽셀 UI 부품을 코드로 직접 그려서 CSS에 꽂아 주는 곳.
// - nine(): 9조각 테두리(패널·버튼·입력칸) 그림
// - ICONS: 손으로 찍은 픽셀 아이콘
// 그림 파일은 하나도 없고, 전부 여기서 만들어집니다.

export const U = 3; // 화면에서 픽셀 한 칸의 크기(px)

export const C = {
  ink: '#1b1326',
  night: '#1f1a3a',
  night2: '#2b2452',
  night3: '#3d3470',
  paper: '#f8ecd0',
  paperHi: '#fffaf0',
  paperLo: '#dcc592',
  tan: '#c9ae7c',
  red: '#e2452f',
  redHi: '#ff7a59',
  redLo: '#a82a26',
  yellow: '#ffcc3d',
  yellowHi: '#fff0a0',
  yellowLo: '#d99a1c',
  green: '#5cbd5a',
  greenHi: '#a4e87c',
  greenLo: '#2f8a4a',
  blue: '#53b8e8',
  blueHi: '#b0e8ff',
  blueLo: '#2d7bbd',
  pink: '#ff8fb8',
  pinkLo: '#d85a8c',
  purple: '#7a5cc8',
  grey: '#9aa0b4',
  greyLo: '#5a5f78',
  brown: '#8a5a34',
  brownLo: '#5a3a24',
  orange: '#ff9a3c',
};

// 아이콘에서 쓰는 글자 → 색
const PAL = {
  k: C.ink, w: C.paperHi, c: C.paper, C: C.tan, r: C.red, R: C.redLo, h: C.redHi,
  y: C.yellow, Y: C.yellowLo, g: C.green, G: C.greenLo, b: C.blue, B: C.blueLo,
  p: C.pink, P: C.pinkLo, v: C.purple, s: C.grey, S: C.greyLo, n: C.brown, N: C.brownLo, o: C.orange,
  '#': C.paperHi,
};

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/** 글자 격자를 scale 배로 키운 캔버스로. tint 를 주면 모든 칸을 한 색으로. */
export function spriteCanvas(rows, scale = U, tint = null, pal = PAL) {
  const w = Math.max(...rows.map((r) => r.length));
  const cv = canvas(w * scale, rows.length * scale);
  const g = cv.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      g.fillStyle = tint || pal[ch] || '#f0f';
      g.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return cv;
}

/**
 * 9조각 테두리. 모서리가 계단처럼 깎인 상자에 윗면 하이라이트·아랫면 그림자, 그리고 base 만큼의 두께.
 * pressed 는 눌린 모양(두께가 사라지고 그만큼 아래로 내려앉음).
 */
export function nine({ fill, hi, lo, out = C.ink, base = 0, baseColor = lo, r = 2, pressed = false, inset = false }) {
  const s = r + 2;
  const W = s * 2 + 1;
  const H = s * 2 + 1 + base;
  const top = pressed ? base : 0;
  const bodyH = pressed ? H - base : H;
  const inside = (x, y) => {
    y -= top;
    if (x < 0 || y < 0 || x >= W || y >= bodyH) return false;
    const dx = Math.min(x, W - 1 - x);
    const dy = Math.min(y, bodyH - 1 - y);
    return dx + dy >= r;
  };
  const cv = canvas(W * U, H * U);
  const g = cv.getContext('2d');
  const faceBottom = top + bodyH - 1 - (pressed ? 0 : base); // 앞면의 마지막 줄(외곽선)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let col = fill;
      if (edge) col = out;
      else if (y > faceBottom - 1 && !pressed && base) col = y === faceBottom ? out : baseColor;
      else if (y === top + 1 || x === 1) col = inset ? lo : hi;
      else if (y === faceBottom - 1 || x === W - 2) col = inset ? hi : lo;
      g.fillStyle = col;
      g.fillRect(x * U, y * U, U, U);
    }
  return cv.toDataURL();
}

// 16x16 큰 아이콘 (메뉴용)
export const ICONS = {
  cup: [
    '................',
    '.....w....w.....',
    '....w....w......',
    '.....w....w.....',
    '................',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwck.',
    '.kkkkkkkkkkkkkk.',
    '..krrrrrrrrrrk..',
    '..krhyyyyyyrRk..',
    '..krhyrrrryrRk..',
    '..krryyyyyyrRk..',
    '...krrrrrrrRk...',
    '...krRRRRRRRk...',
    '....kkkkkkkk....',
    '................',
  ],
  pick: [
    '................',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krhwwrrrrrrk..',
    '..khwwrrrrrrRk..',
    '.krhwrrrrrrrRRk.',
    '.krrrrrrrrrrRRk.',
    '.kkkkkkkkkkkkkk.',
    '.kyyyyyyyyyyyYk.',
    '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwcck.',
    '.kwwwwwwwwwccck.',
    '..kwwwwwwwcccCk.',
    '..kwwwwwwcccCk..',
    '...kkccccCCkk...',
    '.....kkkkkk.....',
  ],
  seat: [
    '................',
    '....kkkkkkkk....',
    '....kbbbbbbk....',
    '....kbBBBBbk....',
    '....kbbbbbbk....',
    '....kkkkkkkk....',
    '.kkkkkkkkkkkkkk.',
    '.koooooooooooyk.',
    '.knnnnnnnnnnnnk.',
    '.kkkkkkkkkkkkkk.',
    '..kNk.kSSk.kNk..',
    '..kNk.kSSk.kNk..',
    '..kNk.kkkk.kNk..',
    '..kNk......kNk..',
    '..kkk......kkk..',
    '................',
  ],
  timer: [
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnNk..',
    '..kkkkkkkkkkkk..',
    '...kwwwwwwwck...',
    '...kwyyyyyyck...',
    '....kwyyyyck....',
    '.....kwyyck.....',
    '......kyyk......',
    '.....kwwyck.....',
    '....kwwwywck....',
    '...kwwwyyyyck...',
    '...kwyyyyyyYk...',
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnNk..',
    '..kkkkkkkkkkkk..',
    '................',
  ],
  posts: [
    '.......kk.......',
    '......krhk......',
    '......krRk......',
    '..kkkkkrRkkkkk..',
    '..kwwwwkkwwwck..',
    '..kwwwwwwwwwck..',
    '..kwSSSSSSSwck..',
    '..kwwwwwwwwwck..',
    '..kwSSSSSwwwck..',
    '..kwwwwwwwwwck..',
    '..kwSSSSSSSwck..',
    '..kwwwwwwwwkkk..',
    '..kwwwwwwwkCk...',
    '..kcccccckkk....',
    '..kkkkkkkk......',
    '................',
  ],
  groups: [
    '................',
    '......kkkk......',
    '.....kyyyyk.....',
    '..kk.kyyyyk.kk..',
    '.kbbkkyyyykkppk.',
    '.kbbk.kkkk.kppk.',
    '.kkkkkrrrrkkkkk.',
    'kbbbkrrrrrrkpppk',
    'kbbbkrhrrrRkpppk',
    'kbBBkrrrrrRkpPPk',
    'kkkkkrrrrrRkkkkk',
    '....krrrrrRk....',
    '....kkkkkkkk....',
    '................',
    '................',
    '................',
  ],
  noise: [
    '................',
    '........k.......',
    '.......kk....r..',
    '......kwk..o..r.',
    '..kkkkwwk...o.r.',
    '..kwwwwwk.y.o.r.',
    '..kwwwwck.y.o.r.',
    '..kwwwcck.y.o.r.',
    '..kcccCCk.y.o.r.',
    '..kkkkCCk...o.r.',
    '......kCk..o..r.',
    '.......kk....r..',
    '........k.......',
    '................',
    '................',
    '................',
  ],
};

// 12x12 한 색 아이콘 (버튼 안에 들어가는 작은 것). 밝은 색/어두운 색 두 벌로 만들어 둠.
export const GLYPHS = {
  lock: ['............', '...######...', '..##....##..', '..##....##..', '.##########.', '.##########.', '.####..####.', '.####..####.', '.#####.####.', '.##########.', '.##########.', '............'],
  unlock: ['...######...', '..##....##..', '..##........', '..##........', '.##########.', '.##########.', '.####..####.', '.####..####.', '.#####.####.', '.##########.', '.##########.', '............'],
  sound: ['............', '.....#......', '....##...#..', '.#####.#..#.', '.#####..#.#.', '.#####..#.#.', '.#####..#.#.', '.#####.#..#.', '....##...#..', '.....#......', '............', '............'],
  mute: ['............', '.....#......', '....##......', '.#####.#..#.', '.#####..##..', '.#####..##..', '.#####.#..#.', '.#####......', '....##......', '.....#......', '............', '............'],
  full: ['............', '.####..####.', '.#........#.', '.#........#.', '.#........#.', '............', '............', '.#........#.', '.#........#.', '.#........#.', '.####..####.', '............'],
  gear: ['.....##.....', '..#.####.#..', '.##########.', '..###..###..', '.###....###.', '####....####', '####....####', '.###....###.', '..###..###..', '.##########.', '..#.####.#..', '.....##.....'],
  arrow: ['............', '............', '......#.....', '......##....', '.########...', '.#########..', '.#########..', '.########...', '......##....', '......#.....', '............', '............'],
  pin: ['............', '....####....', '...######...', '...######...', '...######...', '....####....', '..########..', '.....##.....', '.....##.....', '.....##.....', '.....#......', '............'],
  link: ['............', '.....#####..', '.......###..', '......####..', '.....###.#..', '.#..###..#..', '.#.###......', '.#..#.......', '.#......#...', '.#......#...', '.########...', '............'],
};

const NINES = {
  panel: { fill: C.paper, hi: C.paperHi, lo: C.paperLo, base: 2, baseColor: C.tan },
  dark: { fill: C.night2, hi: C.night3, lo: '#191533', base: 2, baseColor: '#120e26' },
  note: { fill: '#fff6b8', hi: '#fffde0', lo: '#e6cf6a', base: 2, baseColor: '#c9a83c' },
  btn: { fill: C.paper, hi: C.paperHi, lo: C.paperLo, base: 2, baseColor: C.tan },
  btnRed: { fill: C.red, hi: C.redHi, lo: C.redLo, base: 2, baseColor: '#7a1a22' },
  btnYellow: { fill: C.yellow, hi: C.yellowHi, lo: C.yellowLo, base: 2, baseColor: '#a66e10' },
  btnGreen: { fill: C.green, hi: C.greenHi, lo: C.greenLo, base: 2, baseColor: '#1f5e3a' },
  btnBlue: { fill: C.blue, hi: C.blueHi, lo: C.blueLo, base: 2, baseColor: '#1f5488' },
  btnDark: { fill: C.night3, hi: '#5548a0', lo: C.night2, base: 2, baseColor: '#191533' },
  input: { fill: '#fffdf6', hi: '#fffdf6', lo: C.paperLo, inset: true },
  well: { fill: '#161226', hi: '#2b2452', lo: '#0c0916', inset: true },
  chip: { fill: C.yellow, hi: C.yellowHi, lo: C.yellowLo, r: 1 },
  chipBlue: { fill: '#bfe4ff', hi: '#e6f6ff', lo: '#7fb8ea', r: 1 },
  chipPink: { fill: '#ffd0e2', hi: '#ffeaf2', lo: '#f08cb4', r: 1 },
  chipGrey: { fill: '#d6d3cc', hi: '#ecebe6', lo: '#aaa69c', r: 1 },
  chipOff: { fill: C.night2, hi: C.night3, lo: '#191533', r: 1 },
};

// 별이 뜬 밤하늘 바탕 무늬 (64x64 칸이 반복됨)
function starTile() {
  const N = 64;
  const cv = canvas(N * U, N * U);
  const g = cv.getContext('2d');
  g.fillStyle = C.night;
  g.fillRect(0, 0, cv.width, cv.height);
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() * N) | 0;
    const y = (rnd() * N) | 0;
    const big = rnd() < 0.18;
    g.fillStyle = [C.night3, '#5548a0', C.night3, '#8c7ad8'][(rnd() * 4) | 0];
    g.fillRect(x * U, y * U, U, U);
    if (big) {
      g.fillStyle = C.night3;
      g.fillRect((x - 1) * U, y * U, U * 3, U);
      g.fillRect(x * U, (y - 1) * U, U, U * 3);
      g.fillStyle = '#b0a4f0';
      g.fillRect(x * U, y * U, U, U);
    }
  }
  return cv.toDataURL();
}

/** 시작할 때 한 번: 모든 그림을 만들어 CSS 변수와 클래스로 등록 */
export function installArt() {
  const root = document.documentElement.style;
  let css = '';
  for (const [name, o] of Object.entries(NINES)) {
    root.setProperty(`--n-${name}`, `url(${nine(o)})`);
    if (o.base) root.setProperty(`--n-${name}-down`, `url(${nine({ ...o, pressed: true })})`);
  }
  root.setProperty('--stars', `url(${starTile()})`);
  for (const [name, rows] of Object.entries(ICONS)) {
    css += `.ic-${name}{background-image:url(${spriteCanvas(rows, 2).toDataURL()})}`;
    css += `.ic-${name}.big{background-image:url(${spriteCanvas(rows, 4).toDataURL()})}`;
  }
  for (const [name, rows] of Object.entries(GLYPHS)) {
    css += `.gl-${name}{background-image:url(${spriteCanvas(rows, 2, C.paperHi).toDataURL()})}`;
    css += `.gl-${name}.ink{background-image:url(${spriteCanvas(rows, 2, C.ink).toDataURL()})}`;
  }
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}
