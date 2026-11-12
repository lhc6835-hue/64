import { $, numbers, local, rint, sleep, sfx, confetti, confirmBox } from './core.js';
import { Stage } from './stage.js';
import { gachaScene, W, H } from './scenes/gacha.js';

// 이 기기에만 저장: 이미 뽑힌 번호, 설정
let picked = local.get('pick.done', []);
let opts = local.get('pick.opts', { noRepeat: true, speed: 'normal', many: 1 });
let busy = false;
let root = null;
let stage = null;
let scene = null;

const SPEED = { fast: 0.35, normal: 1, slow: 1.9 };

export function enter(el) {
  root = el;
  el.innerHTML = `
    <div class="screen">
      <div class="bezel" id="pickHost"><div class="say over" id="pickSay">버튼을 누르면 캡슐이 나와요</div></div>
    </div>

    <div class="controls">
      <button class="btn red huge" id="pickGo">뽑기! <kbd>Space</kbd></button>
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
      <button class="btn dark" id="pickReset">처음부터 다시</button>
    </div>
    <div class="history" id="pickHistory"></div>
    <p class="hint" id="pickInfo"></p>`;

  stage = new Stage($('#pickHost', el), { w: W, h: H, reserve: 150 });
  scene = gachaScene(stage, {
    tick: (u) => sfx.tick(0.7 + u * 0.7),
    drop: () => sfx.blip(),
    bounce: () => sfx.tick(0.5),
    beat: () => sfx.heart(),
    pop: () => {
      sfx.thud();
      sfx.fanfare();
    },
  });
  stage.start(scene);

  $('#pickMany', el).value = opts.many;
  $('#pickSpeed', el).value = opts.speed;
  $('#pickNoRepeat', el).checked = opts.noRepeat;
  const saveOpts = () => {
    opts = { many: +$('#pickMany', el).value, speed: $('#pickSpeed', el).value, noRepeat: $('#pickNoRepeat', el).checked };
    local.set('pick.opts', opts);
    refresh();
  };
  ['pickMany', 'pickSpeed', 'pickNoRepeat'].forEach((id) => $('#' + id, el).addEventListener('change', saveOpts));
  $('#pickGo', el).addEventListener('click', go);
  $('#pickReset', el).addEventListener('click', async () => {
    if (busy) return;
    if (picked.length && !(await confirmBox('뽑힌 번호 기록을 모두 지우고 처음부터 다시 할까요?', '다시 하기'))) return;
    picked = [];
    local.set('pick.done', picked);
    scene.reset();
    $('#pickSay', el).textContent = '버튼을 누르면 캡슐이 나와요';
    refresh();
  });
  addEventListener('keydown', onKey);
  refresh();
}

export function leave() {
  removeEventListener('keydown', onKey);
  stage?.destroy();
  stage = scene = root = null;
  busy = false;
}
export function update() {
  if (!busy && root) refresh();
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

function refresh(justNow = []) {
  if (!root) return;
  const all = numbers();
  const left = pool().length;
  scene.setCount(left);
  $('#pickHistory', root).innerHTML = opts.noRepeat
    ? all.map((n) => `<span class="chip ${picked.includes(n) ? (justNow.includes(n) ? 'pop' : '') : 'off'}">${n}</span>`).join('')
    : '';
  $('#pickInfo', root).textContent = opts.noRepeat
    ? left
      ? `남은 번호 ${left}명 · 뽑힌 번호 ${all.length - left}명 (노란 칸이 뽑힌 번호)`
      : '모든 번호를 다 뽑았어요. "처음부터 다시"를 눌러 주세요.'
    : `전체 ${all.length}명 중에서 뽑아요. 같은 번호가 또 나올 수 있어요.`;
  $('#pickGo', root).disabled = !left || busy;
}

async function go() {
  if (busy || !root) return;
  let candidates = pool();
  if (!candidates.length) return;
  busy = true;
  $('#pickGo', root).disabled = true;
  const count = Math.min(opts.many, candidates.length);
  const say = $('#pickSay', root);
  const got = [];

  for (let i = 0; i < count; i++) {
    candidates = pool().filter((n) => !got.includes(n));
    const target = candidates[rint(candidates.length)];
    say.classList.remove('alert');
    say.textContent = count > 1 ? `${i + 1}번째 캡슐을 뽑는 중…` : '두구두구… 누가 나올까?';
    // 여러 명을 뽑을 때 두 번째부터는 조금 빠르게
    await scene.run(target, SPEED[opts.speed] * (i === 0 ? 1 : 0.6), opts.noRepeat);
    if (!root) return;
    got.push(target);
    if (opts.noRepeat) {
      picked.push(target);
      local.set('pick.done', picked);
    }
    say.innerHTML = count > 1 ? got.map((n) => `<b>${n}번</b>`).join(' · ') : `<b>${target}번</b> 당첨!`;
    say.classList.add('alert');
    setTimeout(() => say.classList.remove('alert'), 900);
    confetti(90);
    refresh([target]);
    $('#pickGo', root).disabled = true;
    if (i < count - 1) await sleep(1300);
    if (!root) return;
  }
  busy = false;
  refresh();
}
