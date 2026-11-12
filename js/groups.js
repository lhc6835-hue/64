import { $, state, numbers, isGirl, local, shuffle, sleep, sfx, confetti } from './core.js';

let root = null;
let gen = 0;
let busy = false;
let opts = local.get('groups.opts', { count: 4, balance: true });
let last = local.get('groups.last', null); // 마지막 결과 (이 기기에만 저장)

const FLAGS = ['#e2452f', '#ffcc3d', '#53b8e8', '#5cbd5a', '#ff8fb8', '#7a5cc8', '#ff9a3c', '#fffaf0', '#2d7bbd', '#2f8a4a'];

export function enter(el) {
  root = el;
  gen++;
  busy = false;
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>모둠 뽑기</h1>
        <p class="dim">번호를 섞어서 모둠으로 공평하게 나눠요.</p>
      </div>
    </header>
    <div class="controls left">
      <label class="field">모둠 수
        <select id="gCount">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}">${n}모둠</option>`).join('')}</select>
      </label>
      <label class="check" id="gBalanceWrap"><input type="checkbox" id="gBalance"> 남녀 골고루 섞기</label>
      <button class="btn red huge" id="gGo">모둠 나누기!</button>
    </div>
    <p class="dim" id="gInfo"></p>
    <div class="deck" id="gDeck"></div>
    <div class="groups" id="gOut"></div>`;
  $('#gCount', el).value = opts.count;
  $('#gBalance', el).checked = opts.balance;
  const save = () => {
    opts = { count: +$('#gCount', el).value, balance: $('#gBalance', el).checked };
    local.set('groups.opts', opts);
    info();
  };
  $('#gCount', el).addEventListener('change', save);
  $('#gBalance', el).addEventListener('change', save);
  $('#gGo', el).addEventListener('click', go);
  update();
  if (last) show(last);
}

export function leave() {
  gen++;
  root = null;
}
export function update() {
  if (!root) return;
  $('#gBalanceWrap', root).hidden = !state.config.girls.length;
  info();
}

function info() {
  const total = numbers().length;
  const per = Math.floor(total / opts.count);
  const extra = total % opts.count;
  $('#gInfo', root).textContent = `전체 ${total}명 → ${opts.count}모둠 (${extra ? `${per + 1}명 모둠 ${extra}개, ${per}명 모둠 ${opts.count - extra}개` : `모둠마다 ${per}명`})`;
}

function make() {
  let people = shuffle(numbers());
  if (opts.balance && state.config.girls.length) {
    // 남·여를 각각 섞은 뒤 이어 붙여서 차례로 나눠 주면 골고루 섞임
    people = [...people.filter((n) => isGirl(n)), ...people.filter((n) => !isGirl(n))];
  }
  const groups = Array.from({ length: opts.count }, () => []);
  const order = shuffle(groups.map((_, i) => i));
  people.forEach((n, i) => groups[order[i % opts.count]].push(n));
  return groups;
}

function boxes(count) {
  $('#gOut', root).innerHTML = Array.from(
    { length: count },
    (_, i) => `<div class="pn group"><h3><i class="flag" style="background:${FLAGS[i % FLAGS.length]}"></i>${i + 1}모둠</h3><div class="group-body" data-g="${i}"></div></div>`
  ).join('');
}

function show(groups) {
  boxes(groups.length);
  groups.forEach((g, i) => {
    $(`[data-g="${i}"]`, root).innerHTML = [...g].sort((a, b) => a - b).map((n) => `<span class="chip">${n}</span>`).join('');
  });
}

async function go() {
  if (busy) return;
  busy = true;
  const my = ++gen;
  const groups = make();
  boxes(groups.length);
  const deck = $('#gDeck', root);
  const all = shuffle(groups.flat());
  deck.innerHTML = all.map((n) => `<span class="chip shake">${n}</span>`).join('');
  sfx.drum(1.1);
  await sleep(1100);
  if (my !== gen) return;

  // 카드를 한 장씩 모둠에 나눠 주기
  const max = Math.max(...groups.map((g) => g.length));
  for (let k = 0; k < max; k++) {
    for (let i = 0; i < groups.length; i++) {
      const n = groups[i][k];
      if (n == null) continue;
      if (my !== gen) return;
      [...deck.children].find((c) => +c.textContent === n)?.remove();
      $(`[data-g="${i}"]`, root).insertAdjacentHTML('beforeend', `<span class="chip pop">${n}</span>`);
      sfx.tick(0.8 + i * 0.08);
      await sleep(70);
    }
  }
  deck.innerHTML = '';
  last = groups;
  local.set('groups.last', groups);
  show(groups);
  sfx.fanfare();
  confetti(120);
  busy = false;
}
