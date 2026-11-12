import { $, esc, state, saveState, isTeacher, modal, toast, confirmBox } from './core.js';

const DAY = 86_400_000;

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function when(ts) {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function postCard(p, withTools) {
  const url = safeUrl(p.url);
  const isNew = Date.now() - p.at < DAY;
  const inner = `
      <span class="post-icon">${p.pin ? '📌' : '🔗'}</span>
      <span class="post-main">
        <b>${esc(p.title)} ${isNew ? '<em class="new">NEW</em>' : ''}</b>
        ${p.memo ? `<span class="post-memo">${esc(p.memo)}</span>` : ''}
        <small>${url ? esc(host(url)) + ' · ' : ''}${when(p.at)}</small>
      </span>
      ${url ? '<span class="post-go">들어가기 →</span>' : ''}`;
  return `
    <div class="post ${p.pin ? 'pinned' : ''}">
      ${url ? `<a class="post-link" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="post-link">${inner}</div>`}
      ${
        withTools
          ? `<div class="post-tools">
              <button class="btn small ghost" data-act="pin" data-id="${esc(p.id)}">${p.pin ? '고정 풀기' : '맨 위 고정'}</button>
              <button class="btn small ghost" data-act="edit" data-id="${esc(p.id)}">고치기</button>
              <button class="btn small ghost danger" data-act="del" data-id="${esc(p.id)}">지우기</button>
            </div>`
          : ''
      }
    </div>`;
}

export function enter(el) {
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1>📌 선생님 게시물</h1>
        <p class="muted">선생님이 올린 사이트를 눌러서 바로 들어가요. QR코드는 이제 안녕!</p>
      </div>
      <button class="btn primary teacher-only" id="addPost">＋ 새 게시물</button>
    </header>
    <div id="postList" class="post-list"></div>`;
  $('#addPost', el).addEventListener('click', () => editPost());
  $('#postList', el).addEventListener('click', onTool);
  update(el);
}

export function update(el) {
  const list = [...state.posts].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at);
  $('#postList', el).innerHTML = list.length
    ? list.map((p) => postCard(p, isTeacher())).join('')
    : `<div class="empty big">아직 올라온 게시물이 없어요.<br><small>선생님이 올리면 여기에 바로 나타나요.</small></div>`;
}

async function onTool(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const post = state.posts.find((p) => p.id === btn.dataset.id);
  if (!post) return;
  if (btn.dataset.act === 'edit') return editPost(post);
  if (btn.dataset.act === 'pin') {
    await saveState({ posts: state.posts.map((p) => (p.id === post.id ? { ...p, pin: !p.pin } : p)) });
  }
  if (btn.dataset.act === 'del') {
    if (!(await confirmBox(`"${post.title}" 게시물을 지울까요?`, '지우기'))) return;
    if (await saveState({ posts: state.posts.filter((p) => p.id !== post.id) })) toast('지웠어요.');
  }
}

function editPost(post) {
  const dlg = modal(`
    <h2>${post ? '게시물 고치기' : '새 게시물'}</h2>
    <form class="stack" id="postForm">
      <label>제목<input id="pTitle" maxlength="60" required placeholder="예: 사회 3단원 퀴즈" value="${esc(post?.title || '')}"></label>
      <label>사이트 주소 (링크)<input id="pUrl" inputmode="url" placeholder="https://..." value="${esc(post?.url || '')}"></label>
      <label>설명 (없어도 돼요)<input id="pMemo" maxlength="120" placeholder="예: 2교시에 같이 들어가요" value="${esc(post?.memo || '')}"></label>
      <label class="check"><input type="checkbox" id="pPin" ${post?.pin ? 'checked' : ''}> 맨 위에 고정하기</label>
      <p class="form-error" id="pErr" hidden></p>
      <div class="row end">
        <button type="button" class="btn ghost" data-close>취소</button>
        <button class="btn primary">${post ? '저장' : '올리기'}</button>
      </div>
    </form>`);
  $('#pTitle', dlg).focus();
  $('#postForm', dlg).addEventListener('submit', async (e) => {
    e.preventDefault();
    let url = $('#pUrl', dlg).value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (url && !safeUrl(url)) {
      const err = $('#pErr', dlg);
      err.textContent = '주소가 올바르지 않아요. 다시 확인해 주세요.';
      err.hidden = false;
      return;
    }
    const data = {
      id: post?.id || crypto.randomUUID(),
      title: $('#pTitle', dlg).value.trim(),
      url,
      memo: $('#pMemo', dlg).value.trim(),
      pin: $('#pPin', dlg).checked,
      at: post?.at || Date.now(),
    };
    const posts = post ? state.posts.map((p) => (p.id === post.id ? data : p)) : [data, ...state.posts];
    if (await saveState({ posts })) {
      dlg.close();
      toast(post ? '고쳤어요.' : '게시물을 올렸어요.', 'good');
    }
  });
}
