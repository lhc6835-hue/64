import { $, esc, state, saveState, isTeacher, modal, toast } from './core.js';
import { postCard } from './posts.js';
import { Stage } from './stage.js';
import { heroScene, HERO_W, HERO_H } from './scenes/hero.js';

let clock = 0;
let stage = null;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const tools = [
  ['pick', '번호 뽑기', '주인공은 누구?'],
  ['seat', '자리 뽑기', '두근두근 새 자리'],
  ['timer', '타이머', '시간 약속 지키기'],
  ['posts', '게시물', '링크를 한 번에'],
  ['groups', '모둠 뽑기', '공평하게 나누기'],
  ['noise', '소음 측정', '우리 반 목소리'],
];

export function enter(el) {
  el.innerHTML = `
    <section class="hero">
      <div class="bezel" id="heroHost"></div>
      <div class="hero-text">
        <div>
          <span class="hero-tag">6학년 4반</span>
          <h1 class="hero-title">6개장 4발면</h1>
        </div>
        <div class="hero-clock">
          <div class="clock-time" id="clockTime">--:--</div>
          <div class="clock-date" id="clockDate"></div>
        </div>
      </div>
    </section>

    <section class="home-grid">
      <article class="pn note">
        <header class="pn-head">
          <h2>오늘의 알림장</h2>
          <button class="btn small teacher-only" id="editNotice">고치기</button>
        </header>
        <div id="noticeBody"></div>
      </article>

      <article class="pn">
        <header class="pn-head">
          <h2><i class="ic ic-posts"></i>선생님 게시물</h2>
          <a class="btn small" href="#/posts">전체 보기</a>
        </header>
        <div id="homePosts" class="post-list compact"></div>
      </article>
    </section>

    <section class="tiles">
      ${tools
        .map(
          ([id, name, sub]) => `
        <a class="pn tile" href="#/${id}">
          <i class="ic big ic-${id}"></i>
          <b>${name}</b>
          <small>${sub}</small>
        </a>`
        )
        .join('')}
    </section>
    <p class="conn" id="conn"></p>`;

  stage = new Stage($('#heroHost', el), { w: HERO_W, h: HERO_H, reserve: 0 }).start(heroScene());
  $('#editNotice', el).addEventListener('click', editNotice);
  tick();
  clock = setInterval(tick, 1000);
  update(el);
}

export function leave() {
  clearInterval(clock);
  stage?.destroy();
  stage = null;
}

function tick() {
  const d = new Date();
  const t = $('#clockTime');
  if (!t) return;
  t.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  $('#clockDate').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일`;
}

export function update(el) {
  const n = state.notice;
  const body = $('#noticeBody', el);
  if (n.text?.trim()) {
    const d = new Date(n.updated);
    body.innerHTML = `<div class="notice-text">${esc(n.text)}</div>
      <p class="soft">${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}요일에 씀</p>`;
  } else {
    body.innerHTML = `<p class="empty">아직 알림장이 없어요.</p>`;
  }

  const list = [...state.posts].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at).slice(0, 3);
  $('#homePosts', el).innerHTML = list.length
    ? list.map((p) => postCard(p, false)).join('')
    : `<p class="empty">아직 올라온 게시물이 없어요.</p>`;

  $('#conn', el).textContent = state.loaded && !state.online ? '인터넷 연결이 없어 예전에 받아 둔 내용을 보여 주고 있어요.' : '';
}

function editNotice() {
  if (!isTeacher()) return;
  const dlg = modal(`
    <h2>알림장 쓰기</h2>
    <form class="stack" id="noticeForm">
      <textarea id="noticeText" rows="9" placeholder="1. 수학 익힘책 52~53쪽&#10;2. 내일 체육복 입고 오기&#10;3. 가정통신문 부모님께 보여 드리기">${esc(state.notice.text || '')}</textarea>
      <div class="row end">
        <button type="button" class="btn" data-close>취소</button>
        <button class="btn red">저장</button>
      </div>
    </form>`);
  $('#noticeForm', dlg).addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#noticeText', dlg).value.slice(0, 3000);
    if (await saveState({ notice: { text, updated: Date.now() } })) {
      dlg.close();
      toast('알림장을 저장했어요.', 'good');
    }
  });
}
