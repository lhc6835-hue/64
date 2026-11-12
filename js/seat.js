import { $, $$, state, numbers, isGirl, local, rint, shuffle, sleep, sfx, confetti, saveState, toast, confirmBox } from './core.js';

let root = null;
let gen = 0; // 화면을 떠나면 진행 중이던 연출을 멈추기 위한 번호
let busy = false;
let draw = null; // { rows, cols, off, map, order:[{seat,n}], idx, genderOn }
let opts = local.get('seat.opts', { mode: 'seat', auto: false, flip: false });

/* ---------- 자리 배정 계산 ---------- */
function activeSeats(cfg) {
  const out = [];
  for (let i = 0; i < cfg.rows * cfg.cols; i++) if (!cfg.off.includes(i)) out.push(i);
  return out;
}

// 옆자리(1·2번째 칸, 3·4번째 칸 …)를 짝으로 보고, 짝이 최대한 남녀가 되게 배정
export function assign(cfg) {
  const people = shuffle(numbers(cfg));
  const seats = activeSeats(cfg).slice(0, people.length); // 자리가 남으면 뒤쪽부터 비움
  if (seats.length < people.length) return null;
  const map = {};

  if (!cfg.genderOn) {
    seats.forEach((s, i) => (map[s] = people[i]));
    return map;
  }

  const used = new Set(seats);
  let pairs = [];
  let singles = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c += 2) {
      const a = r * cfg.cols + c;
      const b = c + 1 < cfg.cols ? a + 1 : -1;
      if (used.has(a) && used.has(b)) pairs.push([a, b]);
      else {
        if (used.has(a)) singles.push(a);
        if (used.has(b)) singles.push(b);
      }
    }
  }
  pairs = shuffle(pairs);
  singles = shuffle(singles);
  const boys = people.filter((n) => !isGirl(n, cfg));
  const girls = people.filter((n) => isGirl(n, cfg));
  const mixed = Math.min(boys.length, girls.length, pairs.length);
  for (let i = 0; i < mixed; i++) {
    const [a, b] = rint(2) ? pairs[i] : [pairs[i][1], pairs[i][0]];
    map[a] = boys.pop();
    map[b] = girls.pop();
  }
  // 남은 사람(한쪽 성별만 남거나, 짝 자리가 다 찬 경우)은 남은 자리에 무작위로
  const rest = shuffle([...boys, ...girls]);
  const restSeats = [...pairs.slice(mixed).flat(), ...singles];
  restSeats.forEach((s, i) => (map[s] = rest[i]));
  return map;
}

/* ---------- 화면 ---------- */
export function enter(el) {
  root = el;
  gen++;
  busy = false;
  draw = null;
  el.innerHTML = `
    <div class="stage seat-stage" id="seatStage">
      <div class="stage-lights"></div>
      <p class="stage-caption big" id="seatCaption"></p>
      <div class="room" id="room"></div>
    </div>
    <div class="controls" id="seatControls"></div>
    <p class="muted center" id="seatInfo"></p>`;
  addEventListener('keydown', onKey);
  renderView();
}

export function leave() {
  removeEventListener('keydown', onKey);
  gen++;
  root = null;
  draw = null;
}

export function update() {
  if (root && !draw) renderView();
}

function onKey(e) {
  if (e.code !== 'Space' || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  e.preventDefault();
  if (draw && draw.idx < draw.order.length) next();
}

const where = (seat, cols) => `${Math.floor(seat / cols) + 1}번째 줄 ${(seat % cols) + 1}번째 자리`;

function roomHTML({ rows, cols, off, map, genderOn }, hidden) {
  const cells = [];
  for (let i = 0; i < rows * cols; i++) {
    const n = map?.[i];
    const pairGap = genderOn && (i % cols) % 2 === 1 && (i % cols) < cols - 1 ? ' gap' : '';
    if (off.includes(i) || n == null) cells.push(`<div class="desk none${pairGap}"></div>`);
    else
      cells.push(
        `<div class="desk${hidden ? ' hidden' : ' shown'}${pairGap}${!hidden && genderOn && n !== '' ? (isGirl(n) ? ' g' : ' b') : ''}" data-seat="${i}">${hidden ? '?' : n}</div>`
      );
  }
  if (opts.flip) cells.reverse();
  const board = `<div class="board">칠판</div>`;
  return `${opts.flip ? '' : board}<div class="desks" style="--cols:${cols};--rows:${rows}">${cells.join('')}</div>${opts.flip ? board : ''}`;
}

// 저장된 자리표 보기 (뽑기 전 화면)
function renderView() {
  const saved = state.seats;
  const cfg = state.config;
  const total = numbers().length;
  const seatCount = activeSeats(cfg).length;
  $('#seatStage', root).classList.remove('live');
  $('#seatCaption', root).textContent = saved ? '지금 우리 반 자리' : '아직 뽑은 자리가 없어요';
  $('#room', root).innerHTML = saved
    ? roomHTML(saved, false)
    : roomHTML({ ...cfg, map: Object.fromEntries(activeSeats(cfg).slice(0, total).map((s) => [s, '']) ) }, false);

  $('#seatControls', root).innerHTML = `
    <button class="btn primary huge" id="seatStart" ${seatCount < total ? 'disabled' : ''}>🪑 새 자리 뽑기</button>
    <label class="field">공개 방식
      <select id="seatMode">
        <option value="seat">자리마다 "주인은 누구?"</option>
        <option value="num">번호마다 "어디로 갈까?"</option>
      </select>
    </label>
    ${flipBtn()}
    ${saved ? '<button class="btn ghost" id="seatPrint">🖨 인쇄</button>' : ''}`;
  $('#seatMode', root).value = opts.mode;
  $('#seatMode', root).addEventListener('change', (e) => saveOpts({ mode: e.target.value }));
  $('#seatStart', root).addEventListener('click', start);
  $('#seatPrint', root)?.addEventListener('click', () => print());
  bindFlip(renderView);

  $('#seatInfo', root).textContent =
    seatCount < total
      ? `자리가 ${seatCount}개인데 학생은 ${total}명이에요. 선생님 설정에서 자리를 늘려 주세요.`
      : cfg.genderOn
        ? '옆자리 짝이 최대한 남녀가 되도록 뽑아요.'
        : saved?.at
          ? `${new Date(saved.at).getMonth() + 1}월 ${new Date(saved.at).getDate()}일에 뽑은 자리예요.`
          : '';
}

const flipBtn = () => `<button class="btn ghost" id="seatFlip">${opts.flip ? '학생 자리에서 보기' : '교탁에서 보기'}</button>`;
function bindFlip(rerender) {
  $('#seatFlip', root).addEventListener('click', () => {
    if (busy) return;
    saveOpts({ flip: !opts.flip });
    rerender();
  });
}
function saveOpts(patch) {
  opts = { ...opts, ...patch };
  local.set('seat.opts', opts);
}

/* ---------- 뽑기 진행 ---------- */
function start() {
  const cfg = state.config;
  const map = assign(cfg);
  if (!map) return toast('자리가 모자라요. 설정을 확인해 주세요.', 'bad');
  sfx.blip();
  draw = {
    rows: cfg.rows,
    cols: cfg.cols,
    off: [...cfg.off],
    genderOn: cfg.genderOn,
    map,
    order: shuffle(Object.entries(map).map(([seat, n]) => ({ seat: +seat, n }))),
    idx: 0,
  };
  renderDraw();
}

function renderDraw() {
  const done = draw.idx >= draw.order.length;
  const shownMap = Object.fromEntries(draw.order.slice(0, draw.idx).map((o) => [o.seat, o.n]));
  // 아직 공개 안 된 자리는 '?'로
  const room = $('#room', root);
  room.innerHTML = roomHTML({ ...draw, map: draw.map }, true);
  for (const [seat, n] of Object.entries(shownMap)) showDesk(deskEl(+seat), n, false);
  $('#seatStage', root).classList.toggle('live', !done);
  if (!draw.idx) $('#seatCaption', root).textContent = '자리가 섞였어요. 준비됐나요?';
  renderDrawControls();
}

function renderDrawControls() {
  const done = draw.idx >= draw.order.length;
  const left = draw.order.length - draw.idx;
  $('#seatControls', root).innerHTML = done
    ? `<button class="btn primary huge teacher-only" id="seatSave">✅ 이 자리로 확정하기</button>
       <button class="btn" id="seatAgain">🔁 다시 뽑기</button>
       ${flipBtn()}
       <button class="btn ghost" id="seatPrint">🖨 인쇄</button>
       <button class="btn ghost" id="seatCancel">나가기</button>`
    : `<button class="btn primary huge" id="seatNext">다음 자리 공개 <kbd>Space</kbd></button>
       <label class="check"><input type="checkbox" id="seatAuto" ${opts.auto ? 'checked' : ''}> 자동으로 계속</label>
       <button class="btn ghost" id="seatAll">한꺼번에 공개</button>
       <button class="btn ghost" id="seatCancel">그만하기</button>`;
  $('#seatInfo', root).textContent = done
    ? '선생님이 "확정하기"를 누르면 모든 친구들 화면에 이 자리표가 보여요.'
    : `남은 자리 ${left}개`;
  $('#seatNext', root)?.addEventListener('click', next);
  $('#seatAuto', root)?.addEventListener('change', (e) => {
    saveOpts({ auto: e.target.checked });
    if (opts.auto) next();
  });
  $('#seatAll', root)?.addEventListener('click', revealAll);
  $('#seatCancel', root).addEventListener('click', async () => {
    if (!(await confirmBox('지금 뽑은 자리는 사라져요. 정말 나갈까요?', '나가기'))) return;
    gen++;
    busy = false;
    draw = null;
    renderView();
  });
  $('#seatAgain', root)?.addEventListener('click', async () => {
    if (await confirmBox('지금 결과를 버리고 처음부터 다시 뽑을까요?', '다시 뽑기')) start();
  });
  $('#seatPrint', root)?.addEventListener('click', () => print());
  $('#seatSave', root)?.addEventListener('click', async () => {
    const { rows, cols, off, map, genderOn } = draw;
    if (await saveState({ seats: { rows, cols, off, map, genderOn, at: Date.now() } })) {
      toast('새 자리를 확정했어요!', 'good');
      draw = null;
      renderView();
    }
  });
  if ($('#seatFlip', root))
    bindFlip(() => {
      renderDraw();
      $('#seatCaption', root).textContent = '모든 자리가 정해졌어요! 🎉';
    });
}

const deskEl = (seat) => $(`.desk[data-seat="${seat}"]`, root);

function showDesk(el, n, animate = true) {
  el.textContent = n;
  el.classList.remove('hidden', 'spot', 'focus');
  el.classList.add('shown');
  if (draw.genderOn) el.classList.add(isGirl(n) ? 'g' : 'b');
  if (animate) el.classList.add('pop');
}

// 조명이 남은 자리 위를 돌아다니다 목표 자리에서 멈춤
async function chase(target, dur, my) {
  const els = $$('.desk.hidden', root);
  if (els.length <= 1 || dur <= 0) return;
  const delays = [];
  let d = 70;
  let sum = 0;
  while (sum < dur) {
    delays.push(d);
    sum += d;
    d = Math.min(d * 1.12, 420);
  }
  let last = null;
  for (let i = 0; i < delays.length; i++) {
    if (my !== gen) return;
    let el = target;
    if (i < delays.length - 1) {
      do el = els[rint(els.length)]; while (el === last || (i === delays.length - 2 && el === target));
    }
    last?.classList.remove('spot');
    el.classList.add('spot');
    last = el;
    sfx.tick(0.7 + (i / delays.length) * 0.7);
    await sleep(delays[i]);
  }
}

async function next() {
  if (busy || !draw || draw.idx >= draw.order.length) return;
  busy = true;
  const my = gen;
  const { seat, n } = draw.order[draw.idx];
  const left = draw.order.length - draw.idx;
  const finale = left <= 3; // 마지막 세 자리는 더 길게
  const el = deskEl(seat);
  const cap = $('#seatCaption', root);
  const btn = $('#seatNext', root);
  if (btn) btn.disabled = true;

  if (opts.mode === 'seat') {
    cap.textContent = finale ? `이제 ${left}자리 남았어요…` : '다음 자리는…';
    await chase(el, left > 1 ? (finale ? 1500 : 900) : 0, my);
    if (my !== gen) return;
    el.classList.add('spot', 'focus');
    cap.innerHTML = `${where(seat, draw.cols)}의 주인은…?`;
    const dur = finale ? 2600 : 1300;
    const remain = draw.order.slice(draw.idx).map((o) => o.n);
    sfx.drum(dur / 1000);
    const t0 = performance.now();
    while (performance.now() - t0 < dur) {
      if (my !== gen) return;
      el.textContent = remain[rint(remain.length)];
      if (finale && Math.floor((performance.now() - t0) / 800) !== Math.floor((performance.now() - t0 - 80) / 800)) sfx.heart();
      await sleep(80);
    }
  } else {
    cap.innerHTML = `<b class="cap-num">${n}번</b>의 자리는…?`;
    const dur = left > 1 ? (finale ? 3400 : 2000) : 900;
    sfx.drum(dur / 1000);
    await chase(el, dur, my);
    if (my !== gen) return;
    el.classList.add('spot', 'focus');
    await sleep(left > 1 ? 350 : 900);
  }
  if (my !== gen) return;

  showDesk(el, n);
  draw.idx++;
  cap.innerHTML = `<b class="cap-num">${n}번</b> → ${where(seat, draw.cols)}!`;
  sfx.thud();
  sfx.pop();
  const r = el.getBoundingClientRect();
  confetti(finale ? 60 : 28, { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight });

  busy = false;
  if (draw.idx >= draw.order.length) return finish();
  renderDrawControls();
  if (opts.auto) {
    await sleep(1100);
    if (my === gen && opts.auto) next();
  }
}

async function revealAll() {
  if (busy || !draw) return;
  busy = true;
  const my = gen;
  sfx.drum(1.2);
  $('#seatCaption', root).textContent = '하나, 둘, 셋…!';
  await sleep(1200);
  for (const { seat, n } of draw.order.slice(draw.idx)) {
    if (my !== gen) return;
    showDesk(deskEl(seat), n);
    sfx.tick(1.2);
    await sleep(45);
  }
  draw.idx = draw.order.length;
  busy = false;
  finish();
}

function finish() {
  $('#seatStage', root).classList.remove('live');
  $('#seatCaption', root).textContent = '모든 자리가 정해졌어요! 🎉';
  sfx.fanfare();
  confetti(220);
  renderDrawControls();
}
