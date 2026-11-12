import { $, $$, state, numbers, local, rint, sleep, sfx, confetti, confirmBox } from './core.js';

// 이 기기에만 저장: 이미 뽑힌 번호, 설정
let picked = local.get('pick.done', []);
let opts = local.get('pick.opts', { noRepeat: true, speed: 'normal', many: 1 });
let busy = false;
let root = null;

const SPEED = { fast: 1400, normal: 2800, slow: 4600 };

export function enter(el) {
  root = el;
  el.innerHTML = `
    <div class="stage pick-stage">
      <div class="stage-lights"></div>
      <p class="stage-caption" id="pickCaption">버튼을 누르면 시작!</p>
      <div class="pick-number" id="pickNumber">?</div>
      <div class="pick-multi" id="pickMulti"></div>
      <div class="balls" id="balls"></div>
    </div>

    <div class="controls">
      <button class="btn primary huge" id="pickGo">🎰 뽑기! <kbd>Space</kbd></button>
      <label class="field">한 번에
        <select id="pickMany">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}명</option>`).join('')}</select>
      </label>
      <label class="field">긴장감
        <select id="pickSpeed">
          <option value="fast">빠르게</option>
          <option value="normal">보통</option>
          <option value="slow">쫄깃하게</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="pickNoRepeat"> 뽑힌 번호는 빼기</label>
      <button class="btn ghost" id="pickReset">처음부터 다시</button>
    </div>
    <p class="muted center" id="pickInfo"></p>`;

  $('#pickMany', el).value = opts.many;
  $('#pickSpeed', el).value = opts.speed;
  $('#pickNoRepeat', el).checked = opts.noRepeat;
  const saveOpts = () => {
    opts = { many: +$('#pickMany', el).value, speed: $('#pickSpeed', el).value, noRepeat: $('#pickNoRepeat', el).checked };
    local.set('pick.opts', opts);
    drawBalls();
  };
  ['pickMany', 'pickSpeed', 'pickNoRepeat'].forEach((id) => $('#' + id, el).addEventListener('change', saveOpts));
  $('#pickGo', el).addEventListener('click', go);
  $('#pickReset', el).addEventListener('click', async () => {
    if (busy) return;
    if (picked.length && !(await confirmBox('뽑힌 번호 기록을 모두 지우고 처음부터 다시 할까요?', '다시 하기'))) return;
    picked = [];
    local.set('pick.done', picked);
    $('#pickNumber', el).textContent = '?';
    $('#pickNumber', el).className = 'pick-number';
    $('#pickMulti', el).innerHTML = '';
    $('#pickCaption', el).textContent = '버튼을 누르면 시작!';
    drawBalls();
  });
  addEventListener('keydown', onKey);
  drawBalls();
}

export function leave() {
  removeEventListener('keydown', onKey);
  root = null;
}
export function update() {
  if (!busy) drawBalls();
}

function onKey(e) {
  if (e.code !== 'Space' || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  e.preventDefault();
  go();
}

function pool() {
  const all = numbers();
  picked = picked.filter((n) => all.includes(n));
  return opts.noRepeat ? all.filter((n) => !picked.includes(n)) : all;
}

function drawBalls() {
  if (!root) return;
  const all = numbers();
  $('#balls', root).innerHTML = all
    .map((n) => `<span class="ball ${opts.noRepeat && picked.includes(n) ? 'done' : ''}" data-n="${n}">${n}</span>`)
    .join('');
  const left = pool().length;
  $('#pickInfo', root).textContent = opts.noRepeat
    ? left
      ? `남은 번호 ${left}명 · 뽑힌 번호 ${all.length - left}명`
      : '모든 번호를 다 뽑았어요! "처음부터 다시"를 눌러 주세요.'
    : `전체 ${all.length}명 중에서 뽑아요 (같은 번호가 또 나올 수 있어요)`;
  $('#pickGo', root).disabled = !left;
}

async function go() {
  if (busy || !root) return;
  let candidates = pool();
  if (!candidates.length) return;
  busy = true;
  $('#pickGo', root).disabled = true;
  const count = Math.min(opts.many, candidates.length);
  const multi = $('#pickMulti', root);
  multi.innerHTML = '';

  for (let i = 0; i < count; i++) {
    candidates = pool().filter((n) => !$$('.chip', multi).some((c) => +c.textContent === n));
    const target = candidates[rint(candidates.length)];
    // 여러 명 뽑을 때 두 번째부터는 조금 빠르게
    const dur = SPEED[opts.speed] * (i === 0 ? 1 : 0.6);
    await spin(candidates, target, dur, count > 1 ? `${i + 1}번째 주인공은…` : '과연 누가 될까…');
    if (!root) return (busy = false);
    if (opts.noRepeat) {
      picked.push(target);
      local.set('pick.done', picked);
    }
    if (count > 1) {
      multi.insertAdjacentHTML('beforeend', `<span class="chip pop">${target}</span>`);
      if (i < count - 1) await sleep(900);
    }
  }
  busy = false;
  if (root) drawBalls();
}

// 숫자가 빠르게 돌다가 점점 느려지며 멈추는 연출
async function spin(candidates, target, dur, caption) {
  const num = $('#pickNumber', root);
  const cap = $('#pickCaption', root);
  const balls = new Map($$('.ball', root).map((b) => [+b.dataset.n, b]));
  num.className = 'pick-number spinning';
  cap.textContent = caption;
  $('.pick-stage', root).classList.add('live');

  // 점점 길어지는 간격 만들기
  const delays = [];
  let d = 45;
  let sum = 0;
  while (sum < dur) {
    delays.push(d);
    sum += d;
    d = Math.min(d * 1.13, 520);
  }
  let last = null;
  for (let i = 0; i < delays.length; i++) {
    if (!root) return;
    const isLast = i === delays.length - 1;
    let n = target;
    if (!isLast && candidates.length > 1) {
      do n = candidates[rint(candidates.length)]; while (n === last || (i === delays.length - 2 && n === target));
    }
    balls.get(last)?.classList.remove('lit');
    balls.get(n)?.classList.add('lit');
    num.textContent = n;
    last = n;
    sfx.tick(0.8 + (i / delays.length) * 0.6);
    if (isLast) break;
    await sleep(delays[i]);
  }
  // 마지막 한 박자 멈칫 → 쾅!
  num.classList.add('hold');
  sfx.heart();
  await sleep(650);
  if (!root) return;
  num.className = 'pick-number boom';
  cap.textContent = `🎉 ${target}번! 🎉`;
  balls.get(target)?.classList.remove('lit');
  balls.get(target)?.classList.add('win');
  $('.pick-stage', root).classList.remove('live');
  sfx.fanfare();
  confetti(160);
}
