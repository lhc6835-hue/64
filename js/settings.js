import { $, $$, state, saveState, isTeacher, requireTeacher, changePassword, toast, DEFAULT_CONFIG } from './core.js';

let root = null;
let cfg = null; // 고치는 중인 설정 (저장 전)

export function enter(el) {
  root = el;
  cfg = null;
  render();
  if (!isTeacher()) requireTeacher().then((pw) => !pw && root === el && (location.hash = '#/'));
}
export function leave() {
  root = null;
}
export function update() {
  // 고치는 중에는 서버 새로고침으로 내용이 날아가지 않게 함
  if (root && (!cfg || !isTeacher())) render();
}

function render() {
  if (!isTeacher()) {
    root.innerHTML = `<div class="empty big">선생님만 들어올 수 있는 곳이에요.</div>`;
    return;
  }
  cfg = cfg || JSON.parse(JSON.stringify({ ...DEFAULT_CONFIG, ...state.config }));
  root.innerHTML = `
    <header class="page-head">
      <div>
        <h1>반 설정</h1>
        <p class="dim">여기서 바꾼 내용은 "저장"을 눌러야 모든 친구들 화면에 반영돼요.</p>
      </div>
      <button class="btn green huge" id="sSave">저장</button>
    </header>

    <section class="pn set">
      <h2>학생 번호</h2>
      <label class="field">마지막 번호 <input type="number" id="sCount" min="1" max="60" value="${cfg.count}"> 번</label>
      <p class="soft">번호를 누를 때마다 <b class="tag b">남</b> <b class="tag g">여</b> <b class="tag x">없는 번호</b> 순서로 바뀌어요. (전학 간 번호는 "없는 번호"로)</p>
      <div class="num-grid" id="sNums"></div>
      <p class="soft" id="sNumInfo"></p>
    </section>

    <section class="pn set">
      <h2>자리 배치</h2>
      <div class="row">
        <label class="field">가로(칸) <input type="number" id="sCols" min="1" max="10" value="${cfg.cols}"></label>
        <label class="field">세로(줄) <input type="number" id="sRows" min="1" max="10" value="${cfg.rows}"></label>
      </div>
      <label class="check"><input type="checkbox" id="sGender" ${cfg.genderOn ? 'checked' : ''}> 옆자리 짝을 최대한 남녀로 맞추기 <span class="soft">(남는 경우에만 남남·여여·혼자)</span></label>
      <p class="soft">자리를 누르면 "없는 자리"로 바뀌어요. 칠판이 위쪽이에요.</p>
      <div class="board-bar">칠판</div><div class="desk-grid" id="sDesks"></div>
      <p class="soft" id="sSeatInfo"></p>
    </section>

    <section class="pn set">
      <h2>선생님 비밀번호 바꾸기</h2>
      <form class="row" id="sPwForm">
        <input type="password" id="sPw" placeholder="새 비밀번호 (4자 이상)" minlength="4" maxlength="64" autocomplete="new-password" required>
        <button class="btn">바꾸기</button>
      </form>
    </section>`;

  $('#sCount', root).addEventListener('change', (e) => {
    cfg.count = clamp(+e.target.value, 1, 60);
    cfg.excluded = cfg.excluded.filter((n) => n <= cfg.count);
    cfg.girls = cfg.girls.filter((n) => n <= cfg.count);
    e.target.value = cfg.count;
    drawNums();
    drawDesks();
  });
  $('#sNums', root).addEventListener('click', (e) => {
    const n = +e.target.closest('[data-n]')?.dataset.n;
    if (!n) return;
    const girl = cfg.girls.includes(n);
    const out = cfg.excluded.includes(n);
    cfg.girls = cfg.girls.filter((x) => x !== n);
    cfg.excluded = cfg.excluded.filter((x) => x !== n);
    if (!girl && !out) cfg.girls.push(n); // 남 → 여
    else if (girl) cfg.excluded.push(n); // 여 → 없는 번호
    drawNums();
    drawDesks();
  });
  for (const [id, key] of [['sCols', 'cols'], ['sRows', 'rows']]) {
    $('#' + id, root).addEventListener('change', (e) => {
      const old = { rows: cfg.rows, cols: cfg.cols };
      const v = clamp(+e.target.value, 1, 10);
      e.target.value = v;
      // 칸 번호가 달라지므로 "없는 자리"를 새 크기에 맞게 옮김
      const offRC = cfg.off.map((i) => [Math.floor(i / old.cols), i % old.cols]);
      cfg[key] = v;
      cfg.off = offRC.filter(([r, c]) => r < cfg.rows && c < cfg.cols).map(([r, c]) => r * cfg.cols + c);
      drawDesks();
    });
  }
  $('#sGender', root).addEventListener('change', (e) => {
    cfg.genderOn = e.target.checked;
    drawDesks();
  });
  $('#sDesks', root).addEventListener('click', (e) => {
    const i = e.target.dataset?.i;
    if (i == null) return;
    cfg.off = cfg.off.includes(+i) ? cfg.off.filter((x) => x !== +i) : [...cfg.off, +i];
    drawDesks();
  });
  $('#sSave', root).addEventListener('click', async () => {
    const students = cfg.count - cfg.excluded.length;
    const seats = cfg.rows * cfg.cols - cfg.off.length;
    if (seats < students) return toast(`자리가 ${students - seats}개 모자라요. 자리를 늘려 주세요.`, 'bad');
    if (await saveState({ config: cfg })) {
      cfg = null;
      toast('설정을 저장했어요.', 'good');
      render();
    }
  });
  $('#sPwForm', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await changePassword($('#sPw', root).value)) {
      $('#sPw', root).value = '';
      toast('비밀번호를 바꿨어요.', 'good');
    }
  });
  drawNums();
  drawDesks();
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v) || lo));

function drawNums() {
  let html = '';
  for (let n = 1; n <= cfg.count; n++) {
    const kind = cfg.excluded.includes(n) ? 'x' : cfg.girls.includes(n) ? 'g' : 'b';
    html += `<button class="chip ${kind}" data-n="${n}"><span>${n}<small>${{ x: '없음', g: '여', b: '남' }[kind]}</small></span></button>`;
  }
  $('#sNums', root).innerHTML = html;
  const total = cfg.count - cfg.excluded.length;
  const girls = cfg.girls.length;
  $('#sNumInfo', root).textContent = `전체 ${total}명 · 남 ${total - girls}명 · 여 ${girls}명`;
}

function drawDesks() {
  const el = $('#sDesks', root);
  el.style.setProperty('--cols', cfg.cols);
  let html = '';
  for (let i = 0; i < cfg.rows * cfg.cols; i++) {
    const c = i % cfg.cols;
    const gap = cfg.genderOn && c % 2 === 1 && c < cfg.cols - 1 ? ' gap' : '';
    html += `<button class="${cfg.off.includes(i) ? 'none' : ''}${gap}" data-i="${i}" aria-label="자리"></button>`;
  }
  el.innerHTML = html;
  const students = cfg.count - cfg.excluded.length;
  const seats = cfg.rows * cfg.cols - cfg.off.length;
  const info = $('#sSeatInfo', root);
  info.textContent =
    seats < students
      ? `자리 ${seats}개 · 학생 ${students}명 → 자리가 ${students - seats}개 모자라요.`
      : seats > students
        ? `자리 ${seats}개 · 학생 ${students}명 → 뒤쪽 ${seats - students}자리는 비워 둬요.`
        : `자리 ${seats}개 · 학생 ${students}명 → 딱 맞아요!`;
  info.classList.toggle('form-error', seats < students);
}
