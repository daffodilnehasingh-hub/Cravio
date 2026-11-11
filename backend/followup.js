// Follow-up checks after main harness run — read-only except one login
const BASE = 'http://127.0.0.1:5000';
(async () => {
  // login as customer
  let r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jarvis-test@cravio.local', password: 'TestPass123!' }) });
  const lj = await r.json();
  console.log('LOGIN status', r.status, 'token?', !!lj.token);
  const tok = lj.token;
  if (!tok) { console.log('LOGIN FAILED, abort'); return; }
  const H = { Authorization: 'Bearer ' + tok };

  // K11 recheck: GET /me
  r = await fetch(BASE + '/api/auth/me', { headers: H });
  const me = await r.json();
  console.log('K11-RECHECK /me status', r.status, 'rewardPoints=', me.user && me.user.rewardPoints, 'isActive=', me.user && me.user.isActive);

  // E46/E67 recheck: fresh GET of both orders, full reward fields
  for (const id of ['6af4711af1098af1ed633463', '6af47119f1098af1ed6333cc']) {
    r = await fetch(BASE + '/api/orders/' + id, { headers: H });
    const o = await r.json();
    const ord = o.order || o;
    console.log('ORDER', id, 'status', r.status, 'orderStatus=', ord.status, 'rewardPointsAwarded=', ord.rewardPointsAwarded, 'awardedAt=', ord.rewardPointsAwardedAt, 'total=', ord.total);
  }

  // Socket.io: raw Engine.IO handshake, then CONNECT without auth, then poll
  r = await fetch(BASE + '/socket.io/?EIO=4&transport=polling');
  const t1 = await r.text();
  console.log('SOCK handshake status', r.status, 'body:', t1.slice(0, 200));
  let sid = null;
  try { sid = JSON.parse(t1.slice(1)).sid; } catch (e) { console.log('SOCK no sid parse:', e.message); }
  if (sid) {
    r = await fetch(BASE + '/socket.io/?EIO=4&transport=polling&sid=' + sid, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: '40' });
    console.log('SOCK CONNECT POST (no token) status', r.status, 'body:', (await r.text()).slice(0, 200));
    r = await fetch(BASE + '/socket.io/?EIO=4&transport=polling&sid=' + sid);
    console.log('SOCK POLL after CONNECT:', (await r.text()).slice(0, 300));
    // also try order:join without auth on the same session
    r = await fetch(BASE + '/socket.io/?EIO=4&transport=polling&sid=' + sid, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: '42["order:join",{"orderId":"6af47119f1098af1ed6333cc"}]' });
    console.log('SOCK order:join POST status', r.status, 'body:', (await r.text()).slice(0, 200));
    r = await fetch(BASE + '/socket.io/?EIO=4&transport=polling&sid=' + sid);
    console.log('SOCK POLL after join:', (await r.text()).slice(0, 300));
  }
  console.log('FOLLOWUP-DONE');
})().catch(e => console.log('FOLLOWUP-ERROR', e.message));
