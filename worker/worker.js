// 6학년 4반 사이트의 저장 서버 (Cloudflare Worker + KV)
// - 누구나 읽기 가능: GET /api/state
// - 선생님 비밀번호가 있어야 쓰기 가능: POST /api/state
// 비밀번호는 KV 안에 해시로만 저장되고, 이 코드에는 들어 있지 않습니다.

const ALLOWED_KEYS = ['posts', 'notice', 'config', 'seats'];
const MAX_BODY = 100_000;
const MAX_TRIES = 10; // 10분 동안 비밀번호 시도 횟수

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Password',
  'Access-Control-Max-Age': '86400',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword(env, request, password) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:' + ip;
  const tries = parseInt((await env.DB.get(rlKey)) || '0', 10);
  if (tries >= MAX_TRIES) return { ok: false, status: 429, error: '시도 횟수가 너무 많아요. 10분 뒤에 다시 해 주세요.' };

  const auth = await env.DB.get('auth', 'json');
  if (!auth) return { ok: false, status: 500, error: '비밀번호가 아직 설정되지 않았어요.' };
  const hash = await sha256(auth.salt + ':' + (password || ''));
  if (hash !== auth.hash) {
    await env.DB.put(rlKey, String(tries + 1), { expirationTtl: 600 });
    return { ok: false, status: 401, error: '비밀번호가 틀렸어요.' };
  }
  return { ok: true };
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('too large');
  return JSON.parse(text || '{}');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/api/state' && request.method === 'GET') {
        const state = (await env.DB.get('state', 'json')) || {};
        return json(state);
      }

      if (request.method !== 'POST') return json({ error: 'not found' }, 404);
      const body = await readBody(request);
      const password = request.headers.get('X-Password') || body.password;

      if (url.pathname === '/api/login') {
        const r = await checkPassword(env, request, password);
        return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
      }

      if (url.pathname === '/api/state') {
        const r = await checkPassword(env, request, password);
        if (!r.ok) return json({ error: r.error }, r.status);
        const state = (await env.DB.get('state', 'json')) || {};
        for (const key of ALLOWED_KEYS) {
          if (body.patch && key in body.patch) state[key] = body.patch[key];
        }
        state.rev = (state.rev || 0) + 1;
        state.updated = Date.now();
        const out = JSON.stringify(state);
        if (out.length > MAX_BODY * 2) return json({ error: '저장할 내용이 너무 커요.' }, 413);
        await env.DB.put('state', out);
        return json(state);
      }

      if (url.pathname === '/api/password') {
        const r = await checkPassword(env, request, password);
        if (!r.ok) return json({ error: r.error }, r.status);
        const next = String(body.newPassword || '');
        if (next.length < 4 || next.length > 64) return json({ error: '새 비밀번호는 4~64자로 정해 주세요.' }, 400);
        const salt = crypto.randomUUID();
        await env.DB.put('auth', JSON.stringify({ salt, hash: await sha256(salt + ':' + next) }));
        return json({ ok: true });
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: '요청을 처리하지 못했어요.' }, 400);
    }
  },
};
