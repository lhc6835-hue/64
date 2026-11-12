import { $, $$, state, loadState, onState, isTeacher, setTeacher, requireTeacher, onTeacher, isMuted, setMuted, sfx, toast, modal } from './core.js';
import * as home from './home.js';
import * as pick from './pick.js';
import * as seat from './seat.js';
import * as timer from './timer.js';
import * as posts from './posts.js';
import * as groups from './groups.js';
import * as noise from './noise.js';
import * as settings from './settings.js';

const pages = { home, pick, seat, timer, posts, groups, noise, settings };
const app = $('#app');
let current = null;

function route() {
  const name = location.hash.replace(/^#\/?/, '') || 'home';
  const page = pages[name] || home;
  const key = pages[name] ? name : 'home';
  current?.leave?.();
  current = page;
  app.className = 'page page-' + key;
  app.innerHTML = '';
  page.enter(app);
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === key));
  scrollTo(0, 0);
}
addEventListener('hashchange', route);

// 서버 값이 바뀌면 지금 보는 화면만 새로 그림
onState(() => current?.update?.(app));
onTeacher(() => {
  refreshTeacherBtn();
  current?.update?.(app);
});

/* ---------- 위쪽 버튼들 ---------- */
const teacherBtn = $('#teacherBtn');
function refreshTeacherBtn() {
  teacherBtn.textContent = isTeacher() ? '🔓 선생님 모드' : '🔒 선생님';
  teacherBtn.classList.toggle('on', isTeacher());
}
teacherBtn.addEventListener('click', async () => {
  if (!isTeacher()) return void (await requireTeacher());
  const dlg = modal(`
    <h2>🔓 선생님 모드</h2>
    <div class="stack">
      <a class="btn" href="#/settings" data-close>⚙️ 반 설정 (번호·자리·비밀번호)</a>
      <button class="btn ghost" id="logoutBtn">선생님 모드 끄기</button>
    </div>`);
  $('#logoutBtn', dlg).addEventListener('click', () => {
    setTeacher(null);
    dlg.close();
    toast('선생님 모드를 껐어요.');
    if (location.hash.includes('settings')) location.hash = '#/';
  });
});
refreshTeacherBtn();

const muteBtn = $('#muteBtn');
const refreshMute = () => (muteBtn.textContent = isMuted() ? '🔇' : '🔊');
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  refreshMute();
  if (!isMuted()) sfx.blip();
});
refreshMute();

$('#fullBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});

// 첫 클릭 때 소리 장치 깨우기 (브라우저 정책)
addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// 작은 타이머 표시 (다른 화면에 있어도 남은 시간이 보이게)
timer.onTick((t) => {
  const el = $('#miniTimer');
  const show = t.running || t.ringing;
  el.hidden = !show || current === timer;
  if (show) {
    el.textContent = (t.ringing ? '⏰ 끝! ' : '⏱ ') + timer.fmt(t.remain);
    el.classList.toggle('ring', t.ringing);
  }
});

route();
loadState();
setInterval(() => document.visibilityState === 'visible' && loadState(), 60_000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && loadState());
