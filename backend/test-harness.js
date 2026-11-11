// Cravio full API test harness — runs ON the PC against http://127.0.0.1:5000
// Writes one-line PASS/FAIL summaries to stdout and full JSON to test-results.json
const fs = require('fs');
const BASE = 'http://127.0.0.1:5000';
const results = [];
const S = {}; // shared state (tokens, ids)
let auth429 = false;

function short(v, n = 500) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '...[truncated]' : s;
}

async function call(method, path, opts = {}) {
  const headers = {};
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  if (opts.extraHeaders) Object.assign(headers, opts.extraHeaders);
  let body;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  else if (opts.rawBody !== undefined) { headers['Content-Type'] = 'application/json'; body = opts.rawBody; }
  let res, text = '';
  try {
    res = await fetch(BASE + path, { method, headers, body, signal: AbortSignal.timeout(15000) });
    text = await res.text();
  } catch (e) { return { status: 0, json: null, raw: '', error: e.message }; }
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* raw */ }
  if (path.startsWith('/api/auth') && res.status === 429) auth429 = true;
  return { status: res.status, json, raw: text };
}

async function test(id, name, method, path, opts, expected, check) {
  const r = await call(method, path, opts);
  const exp = Array.isArray(expected) ? expected : [expected];
  let pass = exp.includes(r.status);
  let note = '';
  if (pass && check) {
    try {
      const c = check(r);
      if (c !== true) { pass = false; note = typeof c === 'string' ? c : 'check failed'; }
    } catch (e) { pass = false; note = 'check threw: ' + e.message; }
  }
  if (r.status === 429) note += ' RATE-LIMITED';
  if (r.status === 0) note += ' ' + (r.error || 'no response');
  results.push({ id, name, method, path, role: opts.role || 'public', expected: exp.join(' or '), status: r.status, verdict: pass ? 'PASS' : 'FAIL', note, resp: short(r.json !== null ? r.json : r.raw) });
  console.log(id + ' ' + (pass ? 'PASS' : 'FAIL') + ' ' + method + ' ' + path + ' -> ' + r.status + ' (exp ' + exp.join('/') + ')' + (note ? ' [' + note + ']' : ''));
  return r;
}

async function loginAs(email, key) {
  const r = await call('POST', '/api/auth/login', { body: { email, password: 'TestPass123!' } });
  if (r.status === 200 && r.json && r.json.token) {
    S[key + 'Token'] = r.json.token;
    S[key + 'Id'] = r.json.user && r.json.user.id;
    console.log('LOGIN-OK ' + key + ' id=' + S[key + 'Id']);
  } else {
    console.log('LOGIN-FAIL ' + key + ' status=' + r.status + ' ' + short(r.json || r.raw, 200));
  }
}

const T = () => S.customerToken;
const A = () => S.adminToken;
const V = () => S.vendorToken;
const D = () => S.deliveryToken;
const ST = () => S.studentToken;

(async () => {
  console.log('== SETUP ==');
  await test('S1', 'health check', 'GET', '/api/health', {}, 200, (r) => r.json && r.json.status === 'ok' ? true : 'no ok status');
  await loginAs('jarvis-test@cravio.local', 'customer');
  await loginAs('admin-test@cravio.local', 'admin');
  await loginAs('vendor-test@cravio.local', 'vendor');
  await loginAs('delivery-test@cravio.local', 'delivery');
  await loginAs('student-test@cravio.local', 'student');
  if (!S.customerToken || !S.adminToken || !S.vendorToken || !S.deliveryToken || !S.studentToken) {
    console.log('FATAL: missing tokens, aborting');
    fs.writeFileSync('test-results.json', JSON.stringify({ fatal: 'missing tokens', results }, null, 2));
    process.exit(1);
  }

  console.log('== AUTH ==');
  await test('A1', 'register missing password', 'POST', '/api/auth/register', { body: { name: 'X', email: 'x1@cravio.local' } }, 400);
  await test('A2', 'register short password', 'POST', '/api/auth/register', { body: { name: 'X', email: 'x2@cravio.local', password: 'short' } }, 400);
  await test('A3', 'register duplicate email', 'POST', '/api/auth/register', { body: { name: 'X', email: 'jarvis-test@cravio.local', phone: '9876543210', password: 'TestPass123!' } }, 409);
  await test('A4', 'register invalid email format', 'POST', '/api/auth/register', { body: { name: 'Junk', email: 'not-an-email', phone: '9876543210', password: 'TestPass123!' } }, 400);
  await test('A5', 'login wrong password', 'POST', '/api/auth/login', { body: { email: 'jarvis-test@cravio.local', password: 'WrongPass123!' } }, 401);
  await test('A6', 'login missing fields', 'POST', '/api/auth/login', { body: { email: 'jarvis-test@cravio.local' } }, 400);
  await test('A7', 'verify-email bad format code', 'POST', '/api/auth/verify-email', { body: { email: 'jarvis-test@cravio.local', otp: '123' } }, 400);
  await test('A8', 'verify-email wrong 6-digit code', 'POST', '/api/auth/verify-email', { body: { email: 'jarvis-test@cravio.local', otp: '000000' } }, 400);
  await test('A9', 'resend verification (verified user)', 'POST', '/api/auth/resend-verification', { body: { email: 'jarvis-test@cravio.local' } }, [400, 503]);
  await test('A10', 'request password reset', 'POST', '/api/auth/request-password-reset', { body: { email: 'jarvis-test@cravio.local' } }, [200, 503]);
  await test('A11', 'reset password missing fields', 'POST', '/api/auth/reset-password', { body: { email: 'jarvis-test@cravio.local' } }, 400);
  await test('A12', 'me no token', 'GET', '/api/auth/me', {}, 401);
  await test('A13', 'me customer', 'GET', '/api/auth/me', { token: T(), role: 'customer' }, 200, (r) => r.json && r.json.user && r.json.user.email === 'jarvis-test@cravio.local' ? true : 'wrong user');
  await test('A14', 'me bad token', 'GET', '/api/auth/me', { extraHeaders: { Authorization: 'Bearer xyz' } }, 401);
  let r = await test('A15', 'update me phone', 'PATCH', '/api/auth/me', { token: T(), role: 'customer', body: { phone: '9876543211' } }, 200);
  await test('A16', 'update me phone back', 'PATCH', '/api/auth/me', { token: T(), role: 'customer', body: { phone: '9876543210' } }, 200);
  await test('A17', 'update me invalid name', 'PATCH', '/api/auth/me', { token: T(), role: 'customer', body: { name: 'X' } }, 400);
  await test('A18', 'update me no token', 'PATCH', '/api/auth/me', { body: { name: 'Nope' } }, 401);

  console.log('== ADDRESSES ==');
  await test('B1', 'list addresses no token', 'GET', '/api/addresses', {}, 401);
  await test('B2', 'list addresses admin (customer-only)', 'GET', '/api/addresses', { token: A(), role: 'admin' }, 403);
  await test('B3', 'list addresses customer empty', 'GET', '/api/addresses', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.addresses) && r.json.addresses.length === 0 ? true : 'not empty: ' + short(r.json));
  r = await test('B4', 'create address valid', 'POST', '/api/addresses', { token: T(), role: 'customer', body: { label: 'Home', fullName: 'Jarvis Test', phone: '9876543210', pincode: '123456', house: '12 Test Street', area: 'Test Area' } }, 201, (r) => r.json && r.json.addresses && r.json.addresses.length === 1 && r.json.addresses[0].isDefault === true ? true : 'not default/1 addr: ' + short(r.json));
  S.addr1 = r.json && r.json.addresses && r.json.addresses[0] && r.json.addresses[0]._id;
  await test('B5', 'create address bad phone', 'POST', '/api/addresses', { token: T(), role: 'customer', body: { label: 'Home', fullName: 'Jarvis Test', phone: '12345', pincode: '123456', house: '12 Test Street', area: 'Test Area' } }, 400);
  await test('B6', 'create address bad pincode', 'POST', '/api/addresses', { token: T(), role: 'customer', body: { label: 'Work', fullName: 'Jarvis Test', phone: '9876543210', pincode: '123', house: '12 Test Street', area: 'Test Area' } }, 400);
  r = await test('B7', 'create second address', 'POST', '/api/addresses', { token: T(), role: 'customer', body: { label: 'Work', fullName: 'Jarvis Test', phone: '9876543210', pincode: '654321', house: '34 Work Road', area: 'Work Area' } }, 201);
  S.addr2 = r.json && r.json.addresses && r.json.addresses[1] && r.json.addresses[1]._id;
  await test('B8', 'set second address default', 'PATCH', '/api/addresses/' + S.addr2 + '/default', { token: T(), role: 'customer' }, 200, (r) => { const a = (r.json.addresses || []).find(x => String(x._id) === String(S.addr2)); return a && a.isDefault === true ? true : 'second not default: ' + short(r.json); });
  await test('B9', 'update address', 'PATCH', '/api/addresses/' + S.addr1, { token: T(), role: 'customer', body: { label: 'Home', fullName: 'Jarvis Test', phone: '9876543210', pincode: '123456', house: '99 New House', area: 'Test Area' } }, 200);
  await test('B10', 'update nonexistent address', 'PATCH', '/api/addresses/000000000000000000000000', { token: T(), role: 'customer', body: { label: 'Home', fullName: 'Jarvis Test', phone: '9876543210', pincode: '123456', house: 'x', area: 'y' } }, 404);
  await test('B11', 'delete second address', 'DELETE', '/api/addresses/' + S.addr2, { token: T(), role: 'customer' }, 200);
  await test('B12', 'delete same address again', 'DELETE', '/api/addresses/' + S.addr2, { token: T(), role: 'customer' }, 404);
  await test('B13', 'delete last address', 'DELETE', '/api/addresses/' + S.addr1, { token: T(), role: 'customer' }, 200);
  await test('B14', 'set default on deleted address', 'PATCH', '/api/addresses/' + S.addr1 + '/default', { token: T(), role: 'customer' }, 404);

  console.log('== OUTLETS ==');
  await test('C1', 'public outlet list', 'GET', '/api/outlets', {}, 200, (r) => Array.isArray(r.json.outlets) && r.json.outlets.length === 6 ? true : 'expected 6 outlets: ' + short(r.json));
  await test('C2', 'public menu outlet 1', 'GET', '/api/outlets/1/menu', {}, 200, (r) => r.json && r.json.outlet && r.json.outlet.items && r.json.outlet.items.length === 8 ? true : 'expected 8 items: ' + short(r.json));
  await test('C3', 'public menu outlet 999', 'GET', '/api/outlets/999/menu', {}, 404);
  await test('C4', 'public recommendations', 'GET', '/api/outlets/recommendations', {}, 200, (r) => Array.isArray(r.json.recommendations) && r.json.recommendations.length > 0 ? true : 'no recommendations: ' + short(r.json));
  await test('C5', 'personal recommendations customer', 'GET', '/api/outlets/recommendations/me', { token: T(), role: 'customer' }, 200, (r) => r.json && r.json.mode === 'personalized' ? true : 'mode is ' + (r.json && r.json.mode) + ' despite order history (personalization not working?)');
  await test('C6', 'personal recommendations no token', 'GET', '/api/outlets/recommendations/me', {}, 401);
  await test('C7', 'manage all admin', 'GET', '/api/outlets/manage/all', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.outlets) && r.json.outlets.length >= 6 ? true : 'expected >=6: ' + short(r.json));
  await test('C8', 'manage all vendor scoped to outlet 2', 'GET', '/api/outlets/manage/all', { token: V(), role: 'vendor' }, 200, (r) => Array.isArray(r.json.outlets) && r.json.outlets.length === 1 && r.json.outlets[0].outletId === '2' ? true : 'vendor sees wrong outlets: ' + short(r.json));
  await test('C9', 'manage all customer forbidden', 'GET', '/api/outlets/manage/all', { token: T(), role: 'customer' }, 403);
  await test('C10', 'inventory vendor scoped', 'GET', '/api/outlets/manage/inventory', { token: V(), role: 'vendor' }, 200, (r) => Array.isArray(r.json.items) && r.json.items.every(i => i.outletId === '2') ? true : 'vendor inventory leaks other outlets: ' + short(r.json, 300));
  await test('C11', 'inventory admin', 'GET', '/api/outlets/manage/inventory', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.items) && r.json.items.length > 0 ? true : 'no items: ' + short(r.json));
  await test('C12', 'admin manage list', 'GET', '/api/outlets/admin/manage', { token: A(), role: 'admin' }, 200);
  await test('C13', 'admin manage list customer forbidden', 'GET', '/api/outlets/admin/manage', { token: T(), role: 'customer' }, 403);
  r = await test('C14', 'create outlet 99 admin', 'POST', '/api/outlets', { token: A(), role: 'admin', body: { outletId: '99', name: 'Test Outlet', type: 'restaurant', description: 'harness test outlet', cuisine: 'Test', delivery: true, pickup: true } }, 201);
  await test('C15', 'create outlet duplicate 99', 'POST', '/api/outlets', { token: A(), role: 'admin', body: { outletId: '99', name: 'Dup', type: 'restaurant' } }, 409);
  await test('C16', 'create outlet invalid (no name)', 'POST', '/api/outlets', { token: A(), role: 'admin', body: { outletId: '98', type: 'restaurant' } }, 400);
  await test('C17', 'create outlet customer forbidden', 'POST', '/api/outlets', { token: T(), role: 'customer', body: { outletId: '98', name: 'Nope', type: 'restaurant' } }, 403);
  await test('C18', 'update outlet 99 admin', 'PATCH', '/api/outlets/99', { token: A(), role: 'admin', body: { name: 'Test Outlet Renamed' } }, 200);
  await test('C19', 'vendor update unassigned outlet 1', 'PATCH', '/api/outlets/1', { token: V(), role: 'vendor', body: { description: 'hijack' } }, 403);
  await test('C20', 'vendor update own outlet 2', 'PATCH', '/api/outlets/2', { token: V(), role: 'vendor', body: { description: 'Vendor-managed canteen' } }, 200);
  await test('C21', 'vendor add item to unassigned outlet 1', 'POST', '/api/outlets/1/items', { token: V(), role: 'vendor', body: { itemId: '199', name: 'Hijack Item', category: 'Menu', price: 10 } }, 403);
  await test('C22', 'vendor add item to own outlet 2', 'POST', '/api/outlets/2/items', { token: V(), role: 'vendor', body: { itemId: '299', name: 'Vendor Test Item', category: 'Menu', price: 42, stockQuantity: 10 } }, 201);
  await test('C23', 'admin add item to outlet 99', 'POST', '/api/outlets/99/items', { token: A(), role: 'admin', body: { itemId: '991', name: 'Test Item', category: 'Menu', price: 50, stockQuantity: 10 } }, 201);
  await test('C24', 'admin add duplicate item 991', 'POST', '/api/outlets/99/items', { token: A(), role: 'admin', body: { itemId: '991', name: 'Dup', category: 'Menu', price: 50 } }, 409);
  await test('C25', 'admin add item price 0', 'POST', '/api/outlets/99/items', { token: A(), role: 'admin', body: { itemId: '992', name: 'Free', category: 'Menu', price: 0 } }, 400);
  await test('C26', 'admin update item stock 5', 'PATCH', '/api/outlets/99/items/991/stock', { token: A(), role: 'admin', body: { stockQuantity: 5 } }, 200, (r) => r.json && r.json.item && r.json.item.stockQuantity === 5 ? true : 'stock not 5: ' + short(r.json));
  await test('C27', 'admin update item stock -1', 'PATCH', '/api/outlets/99/items/991/stock', { token: A(), role: 'admin', body: { stockQuantity: -1 } }, 400);
  await test('C28', 'admin bulk prices +10%', 'PATCH', '/api/outlets/99/items/bulk-prices', { token: A(), role: 'admin', body: { itemIds: ['991'], percentage: 10 } }, 200, (r) => r.json && r.json.updatedCount === 1 ? true : 'updatedCount wrong: ' + short(r.json));
  r = await test('C29', 'menu shows bulk price 55', 'GET', '/api/outlets/99/menu', {}, 200, (r) => { const it = (r.json.outlet.items || []).find(i => i.itemId === '991'); return it && it.price === 55 ? true : 'price not 55: ' + short(r.json); });
  await test('C30', 'admin bulk prices 500%', 'PATCH', '/api/outlets/99/items/bulk-prices', { token: A(), role: 'admin', body: { itemIds: ['991'], percentage: 500 } }, 400);
  await test('C31', 'admin update item price 60', 'PATCH', '/api/outlets/99/items/991', { token: A(), role: 'admin', body: { price: 60 } }, 200);
  await test('C32', 'vendor update stock own outlet 2 item 299', 'PATCH', '/api/outlets/2/items/299/stock', { token: V(), role: 'vendor', body: { stockQuantity: 7 } }, 200);
  await test('C33', 'admin delete item 991', 'DELETE', '/api/outlets/99/items/991', { token: A(), role: 'admin' }, 200);
  await test('C34', 'vendor delete item 299 own outlet', 'DELETE', '/api/outlets/2/items/299', { token: V(), role: 'vendor' }, 200);
  await test('C35', 'reject outlet 99', 'PATCH', '/api/outlets/admin/99/approval', { token: A(), role: 'admin', body: { approvalStatus: 'rejected', approvalNote: 'harness test' } }, 200, (r) => r.json && r.json.outlet && r.json.outlet.isActive === false ? true : 'rejected outlet still active: ' + short(r.json));
  await test('C36', 'rejected outlet hidden from public list', 'GET', '/api/outlets', {}, 200, (r) => Array.isArray(r.json.outlets) && !r.json.outlets.some(o => o.outletId === '99') ? true : 'rejected outlet still listed');
  await test('C37', 'rejected outlet menu 404', 'GET', '/api/outlets/99/menu', {}, 404);
  await test('C38', 'approve outlet 99 + activate', 'PATCH', '/api/outlets/admin/99/approval', { token: A(), role: 'admin', body: { approvalStatus: 'approved', activate: true } }, 200, (r) => r.json && r.json.outlet && r.json.outlet.isActive === true ? true : 'not active after approve: ' + short(r.json));
  await test('C39', 're-approved outlet back in public list', 'GET', '/api/outlets', {}, 200, (r) => Array.isArray(r.json.outlets) && r.json.outlets.some(o => o.outletId === '99') ? true : 'outlet 99 missing after approve');
  await test('C40', 'approval bad value', 'PATCH', '/api/outlets/admin/99/approval', { token: A(), role: 'admin', body: { approvalStatus: 'bogus' } }, 400);
  await test('C41', 'availability off', 'PATCH', '/api/outlets/admin/99/availability', { token: A(), role: 'admin', body: { isActive: false } }, 200);
  await test('C42', 'availability on', 'PATCH', '/api/outlets/admin/99/availability', { token: A(), role: 'admin', body: { isActive: true } }, 200);
  await test('C43', 'availability bad type', 'PATCH', '/api/outlets/admin/99/availability', { token: A(), role: 'admin', body: { isActive: 'yes' } }, 400);
  await test('C44', 'assign outlet 99 to vendor', 'PATCH', '/api/outlets/admin/99/vendor', { token: A(), role: 'admin', body: { vendorId: S.vendorId } }, 200);
  await test('C45', 'vendor now sees outlet 99 too', 'GET', '/api/outlets/manage/all', { token: V(), role: 'vendor' }, 200, (r) => Array.isArray(r.json.outlets) && r.json.outlets.some(o => o.outletId === '99') ? true : 'vendor does not see assigned 99: ' + short(r.json));
  await test('C46', 'unassign vendor from outlet 99', 'PATCH', '/api/outlets/admin/99/vendor', { token: A(), role: 'admin', body: { vendorId: null } }, 200);
  await test('C47', 'assign outlet to nonexistent vendor', 'PATCH', '/api/outlets/admin/99/vendor', { token: A(), role: 'admin', body: { vendorId: '000000000000000000000000' } }, 404);
  await test('C48', 'assign outlet vendor as customer forbidden', 'PATCH', '/api/outlets/admin/99/vendor', { token: T(), role: 'customer', body: { vendorId: S.vendorId } }, 403);

  console.log('== COUPONS ==');
  await test('D1', 'list coupons admin empty', 'GET', '/api/coupons', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.coupons) && r.json.coupons.length === 0 ? true : 'coupons exist already: ' + short(r.json));
  await test('D2', 'list coupons customer forbidden', 'GET', '/api/coupons', { token: T(), role: 'customer' }, 403);
  await test('D3', 'validate unknown coupon', 'POST', '/api/coupons/validate', { token: T(), role: 'customer', body: { code: 'NOPE', subtotal: 500, outletType: 'restaurant' } }, 400);
  await test('D4', 'validate missing fields', 'POST', '/api/coupons/validate', { token: T(), role: 'customer', body: {} }, 400);
  await test('D5', 'validate no token', 'POST', '/api/coupons/validate', { body: { code: 'X', subtotal: 100 } }, 401);
  r = await test('D6', 'create coupon TEST10 admin', 'POST', '/api/coupons', { token: A(), role: 'admin', body: { code: 'TEST10', description: 'harness test', discountType: 'percentage', discountValue: 10, minOrderValue: 100, outletType: 'all' } }, 201);
  S.couponId = r.json && r.json.coupon && r.json.coupon._id;
  await test('D7', 'create duplicate coupon TEST10', 'POST', '/api/coupons', { token: A(), role: 'admin', body: { code: 'TEST10', discountType: 'percentage', discountValue: 10 } }, 409);
  await test('D8', 'create coupon empty body (validation should be 400)', 'POST', '/api/coupons', { token: A(), role: 'admin', body: {} }, 400);
  await test('D9', 'validate TEST10 subtotal 500', 'POST', '/api/coupons/validate', { token: T(), role: 'customer', body: { code: 'TEST10', subtotal: 500, outletType: 'restaurant' } }, 200, (r) => r.json && r.json.valid === true && r.json.discount === 50 ? true : 'discount not 50: ' + short(r.json));
  await test('D10', 'validate TEST10 below min order', 'POST', '/api/coupons/validate', { token: T(), role: 'customer', body: { code: 'TEST10', subtotal: 50, outletType: 'restaurant' } }, 400);
  await test('D11', 'validate TEST10 lowercase code', 'POST', '/api/coupons/validate', { token: T(), role: 'customer', body: { code: 'test10', subtotal: 500, outletType: 'restaurant' } }, 200);
  await test('D12', 'update coupon discount to 20%', 'PATCH', '/api/coupons/' + S.couponId, { token: A(), role: 'admin', body: { discountValue: 20 } }, 200, (r) => r.json && r.json.coupon && r.json.coupon.discountValue === 20 ? true : 'not updated: ' + short(r.json));
  await test('D13', 'update coupon invalid value -5 (should be 400)', 'PATCH', '/api/coupons/' + S.couponId, { token: A(), role: 'admin', body: { discountValue: -5 } }, 400);
  await test('D14', 'update nonexistent coupon', 'PATCH', '/api/coupons/000000000000000000000000', { token: A(), role: 'admin', body: { discountValue: 5 } }, 404);
  await test('D15', 'update coupon customer forbidden', 'PATCH', '/api/coupons/' + S.couponId, { token: T(), role: 'customer', body: { discountValue: 5 } }, 403);

  console.log('== ORDERS ==');
  const addr = { fullName: 'Jarvis Test', phone: '9876543210', pincode: '123456', house: '12 Test Street', area: 'Test Area' };
  r = await test('E1', 'create pickup order outlet 1', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }, { itemId: '106', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', couponCode: '', studentDiscountApplied: false, redeemRewardPoints: 0 } }, 201, (r) => r.json && r.json.order && r.json.order.subtotal === 378 && r.json.order.total === 378 ? true : 'totals wrong: ' + short(r.json));
  S.orderPickup = r.json && r.json.order && r.json.order._id;
  r = await test('E2', 'tampered prices ignored (unitPrice 1, total 1)', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1, unitPrice: 1 }, { itemId: '106', quantity: 1, unitPrice: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', total: 1, subtotal: 1 } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.total !== 378) return 'total tampered to ' + o.total; if (o.items[0].unitPrice !== 149 || o.items[1].unitPrice !== 229) return 'unit prices tampered: ' + short(o.items); return true; });
  S.orderTamper = r.json && r.json.order && r.json.order._id;
  r = await test('E3', 'create delivery order subtotal 238 fee 25', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '102', quantity: 2 }], fulfillmentType: 'delivery', deliveryAddress: addr, paymentMethod: 'cod', couponCode: '', studentDiscountApplied: false, redeemRewardPoints: 0 } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.subtotal !== 238) return 'subtotal ' + o.subtotal; if (o.deliveryFee !== 25) return 'fee ' + o.deliveryFee; if (o.total !== 263) return 'total ' + o.total; return true; });
  S.orderDelivery = r.json && r.json.order && r.json.order._id;
  r = await test('E4', 'delivery order subtotal 458 fee 0', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '106', quantity: 2 }], fulfillmentType: 'delivery', deliveryAddress: addr, paymentMethod: 'cod' } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.subtotal !== 458) return 'subtotal ' + o.subtotal; if (o.deliveryFee !== 0) return 'fee ' + o.deliveryFee; if (o.total !== 458) return 'total ' + o.total; return true; });
  S.orderDelivery2 = r.json && r.json.order && r.json.order._id;
  await test('E5', 'delivery to pickup-only outlet 2', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '2', items: [{ itemId: '201', quantity: 1 }], fulfillmentType: 'delivery', deliveryAddress: addr, paymentMethod: 'cod' } }, 400);
  await test('E6', 'delivery missing address', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'delivery', paymentMethod: 'cod' } }, 400);
  await test('E7', 'invalid item 999', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '999', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod' } }, 400);
  await test('E8', 'empty items', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [], fulfillmentType: 'pickup', paymentMethod: 'cod' } }, 400);
  await test('E9', 'bad payment method', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cash' } }, 400);
  await test('E10', 'bad fulfillment type', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'drone', paymentMethod: 'cod' } }, 400);
  await test('E11', 'bad outlet', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '999', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod' } }, 400);
  r = await test('E12', 'coupon TEST10 20% on 378', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }, { itemId: '106', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', couponCode: 'TEST10' } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.discount !== 75.6) return 'discount ' + o.discount; if (o.total !== 302.4) return 'total ' + o.total; return true; });
  S.orderCoupon = r.json && r.json.order && r.json.order._id;
  await test('E13', 'coupon code invalid at order', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', couponCode: 'NOPE' } }, 400);
  r = await test('E14', 'student checkbox unverified user', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }, { itemId: '106', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', studentDiscountApplied: true } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.studentDiscountApplied !== false) return 'checkbox granted discount! ' + short(o); if (o.discount !== 0) return 'discount ' + o.discount; return true; });
  S.orderNoStudent = r.json && r.json.order && r.json.order._id;
  await test('E15', 'redeem 100 points with 0 balance', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', redeemRewardPoints: 100 } }, 409);
  await test('E16', 'redeem negative points', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', redeemRewardPoints: -5 } }, 400);
  r = await test('E17', 'razorpay order without real keys', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'razorpay' } }, [503], (r) => true);
  // E17 note: 503 is the designed "not configured" answer; a 500 means placeholder keys fooled the check
  await test('E18', 'no razorpay order left behind', 'GET', '/api/orders/my', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.orders) && !r.json.orders.some(o => o.paymentMethod === 'razorpay') ? true : 'razorpay order leaked: ' + short(r.json, 300));
  await test('E19', 'payment verify missing fields', 'POST', '/api/orders/payment/verify', { token: T(), role: 'customer', body: {} }, 400);
  await test('E20', 'payment verify bogus order', 'POST', '/api/orders/payment/verify', { token: T(), role: 'customer', body: { orderId: '000000000000000000000000', razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'abcd' } }, 404);
  await test('E21', 'payment verify on COD order', 'POST', '/api/orders/payment/verify', { token: T(), role: 'customer', body: { orderId: S.orderPickup, razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'abcd' } }, 404);
  await test('E22', 'payment fail missing orderId', 'POST', '/api/orders/payment/fail', { token: T(), role: 'customer', body: {} }, 400);
  await test('E23', 'payment fail on COD order', 'POST', '/api/orders/payment/fail', { token: T(), role: 'customer', body: { orderId: S.orderPickup } }, 200, (r) => r.json && /No pending payment/.test(r.json.message || '') ? true : 'unexpected message: ' + short(r.json));
  await test('E24', 'payment fail no token', 'POST', '/api/orders/payment/fail', { body: { orderId: S.orderPickup } }, 401);
  await test('E25', 'my orders customer', 'GET', '/api/orders/my', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.orders) && r.json.orders.length >= 5 ? true : 'expected >=5 orders: ' + short(r.json, 200));
  await test('E26', 'my orders no token', 'GET', '/api/orders/my', {}, 401);
  await test('E27', 'get own order', 'GET', '/api/orders/' + S.orderPickup, { token: T(), role: 'customer' }, 200);
  await test('E28', 'get order as vendor (not owner)', 'GET', '/api/orders/' + S.orderPickup, { token: V(), role: 'vendor' }, 404);
  await test('E29', 'get nonexistent order', 'GET', '/api/orders/000000000000000000000000', { token: T(), role: 'customer' }, 404);
  await test('E30', 'manage orders admin', 'GET', '/api/orders/manage', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.orders) && r.json.orders.length >= 5 ? true : 'expected >=5: ' + short(r.json, 200));
  await test('E31', 'manage orders vendor scoped (outlet 2 only)', 'GET', '/api/orders/manage', { token: V(), role: 'vendor' }, 200, (r) => Array.isArray(r.json.orders) && r.json.orders.every(o => o.outlet.outletId === '2') ? true : 'vendor sees other outlets: ' + short(r.json, 300));
  await test('E32', 'manage orders customer forbidden', 'GET', '/api/orders/manage', { token: T(), role: 'customer' }, 403);
  await test('E33', 'manage orders bad status filter', 'GET', '/api/orders/manage?status=bogus', { token: A(), role: 'admin' }, 400);
  await test('E34', 'manage orders vendor outletId=1 forbidden', 'GET', '/api/orders/manage?outletId=1', { token: V(), role: 'vendor' }, 403);
  await test('E35', 'cancel own placed order', 'PATCH', '/api/orders/' + S.orderPickup + '/cancel', { token: T(), role: 'customer', body: { reason: 'harness test cancel' } }, 200, (r) => r.json && r.json.order && r.json.order.status === 'cancelled' ? true : 'not cancelled: ' + short(r.json));
  await test('E36', 'cancel already-cancelled order', 'PATCH', '/api/orders/' + S.orderPickup + '/cancel', { token: T(), role: 'customer', body: {} }, 400);
  await test('E37', 'cancel someone elses order (vendor)', 'PATCH', '/api/orders/' + S.orderTamper + '/cancel', { token: V(), role: 'vendor', body: {} }, 404);
  await test('E38', 'stock restored after cancel (item 101 back to 46)', 'GET', '/api/outlets/manage/inventory', { token: A(), role: 'admin' }, 200, (r) => { const it = (r.json.items || []).find(i => i.outletId === '1' && i.itemId === '101'); return it && it.stockQuantity === 46 ? true : 'item 101 stock is ' + (it && it.stockQuantity) + ', expected 46'; });
  // vendor workflow on outlet 2 order
  r = await test('E39', 'create outlet 2 pickup order', 'POST', '/api/orders', { token: T(), role: 'customer', body: { outletId: '2', items: [{ itemId: '201', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod' } }, 201, (r) => r.json && r.json.order && r.json.order.total === 55 ? true : 'total not 55: ' + short(r.json));
  S.orderOutlet2 = r.json && r.json.order && r.json.order._id;
  await test('E40', 'vendor placed->accepted outlet 2', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: V(), role: 'vendor', body: { status: 'accepted', estimatedPreparationMinutes: 15 } }, 200, (r) => r.json && r.json.order && r.json.order.estimatedPreparationMinutes === 15 ? true : 'prep minutes not set: ' + short(r.json));
  await test('E41', 'vendor accepted->preparing', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: V(), role: 'vendor', body: { status: 'preparing' } }, 200);
  await test('E42', 'vendor preparing->ready', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: V(), role: 'vendor', body: { status: 'ready' } }, 200);
  await test('E43', 'vendor ready->delivered blocked by kitchen workflow', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: V(), role: 'vendor', body: { status: 'delivered' } }, 409);
  await test('E44', 'vendor update outlet 1 order forbidden', 'PATCH', '/api/orders/' + S.orderTamper + '/status', { token: V(), role: 'vendor', body: { status: 'accepted' } }, 403);
  await test('E45', 'vendor backwards move ready->accepted blocked', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: V(), role: 'vendor', body: { status: 'accepted' } }, 409);
  await test('E46', 'admin marks outlet 2 order picked_up', 'PATCH', '/api/orders/' + S.orderOutlet2 + '/status', { token: A(), role: 'admin', body: { status: 'picked_up' } }, 200, (r) => r.json && r.json.order && r.json.order.rewardPointsAwarded === 5 ? true : 'reward points not 5: ' + short(r.json));
  await test('E47', 'status update invalid status', 'PATCH', '/api/orders/' + S.orderTamper + '/status', { token: A(), role: 'admin', body: { status: 'flying' } }, 400);
  await test('E48', 'status update nonexistent order', 'PATCH', '/api/orders/000000000000000000000000/status', { token: A(), role: 'admin', body: { status: 'accepted' } }, 404);
  await test('E49', 'status update no token', 'PATCH', '/api/orders/' + S.orderTamper + '/status', { body: { status: 'accepted' } }, 401);
  await test('E50', 'status update prep time on ready rejected', 'PATCH', '/api/orders/' + S.orderTamper + '/status', { token: A(), role: 'admin', body: { status: 'ready', estimatedPreparationMinutes: 10 } }, 400);
  // delivery chain on E3 order (delivery, subtotal 238)
  await test('E51', 'admin accepted delivery order', 'PATCH', '/api/orders/' + S.orderDelivery + '/status', { token: A(), role: 'admin', body: { status: 'accepted', estimatedPreparationMinutes: 20 } }, 200);
  await test('E52', 'admin preparing delivery order', 'PATCH', '/api/orders/' + S.orderDelivery + '/status', { token: A(), role: 'admin', body: { status: 'preparing' } }, 200);
  await test('E53', 'admin ready delivery order', 'PATCH', '/api/orders/' + S.orderDelivery + '/status', { token: A(), role: 'admin', body: { status: 'ready' } }, 200);
  await test('E54', 'assign delivery to pickup order rejected', 'PATCH', '/api/orders/' + S.orderTamper + '/assign-delivery', { token: A(), role: 'admin', body: { deliveryPartnerId: S.deliveryId, estimatedDeliveryMinutes: 30 } }, 400);
  await test('E55', 'assign delivery before ready rejected (orderDelivery2 still placed)', 'PATCH', '/api/orders/' + S.orderDelivery2 + '/assign-delivery', { token: A(), role: 'admin', body: { deliveryPartnerId: S.deliveryId, estimatedDeliveryMinutes: 30 } }, 400);
  await test('E56', 'delivery partners list admin', 'GET', '/api/orders/delivery/partners', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.partners) && r.json.partners.some(p => p.email === 'delivery-test@cravio.local') ? true : 'delivery partner missing: ' + short(r.json));
  await test('E57', 'delivery partners list customer forbidden', 'GET', '/api/orders/delivery/partners', { token: T(), role: 'customer' }, 403);
  await test('E58', 'assign delivery partner', 'PATCH', '/api/orders/' + S.orderDelivery + '/assign-delivery', { token: A(), role: 'admin', body: { deliveryPartnerId: S.deliveryId, estimatedDeliveryMinutes: 30 } }, 200, (r) => r.json && r.json.order && r.json.order.deliveryPartner ? true : 'no partner on order: ' + short(r.json));
  await test('E59', 'assign same partner again (now busy)', 'PATCH', '/api/orders/' + S.orderDelivery + '/assign-delivery', { token: A(), role: 'admin', body: { deliveryPartnerId: S.deliveryId, estimatedDeliveryMinutes: 30 } }, 400);
  await test('E60', 'delivery my orders', 'GET', '/api/orders/delivery/my', { token: D(), role: 'delivery' }, 200, (r) => Array.isArray(r.json.orders) && r.json.orders.some(o => String(o._id) === String(S.orderDelivery)) ? true : 'assigned order missing: ' + short(r.json, 300));
  await test('E61', 'delivery my orders customer forbidden', 'GET', '/api/orders/delivery/my', { token: T(), role: 'customer' }, 403);
  await test('E62', 'delivery out_for_delivery', 'PATCH', '/api/orders/delivery/' + S.orderDelivery + '/status', { token: D(), role: 'delivery', body: { status: 'out_for_delivery' } }, 200);
  await test('E63', 'delivery invalid status ready', 'PATCH', '/api/orders/delivery/' + S.orderDelivery + '/status', { token: D(), role: 'delivery', body: { status: 'ready' } }, 400);
  await test('E64', 'delivery location update', 'PATCH', '/api/orders/delivery/' + S.orderDelivery + '/location', { token: D(), role: 'delivery', body: { lat: 54.9, lng: 23.9 } }, 200, (r) => r.json && r.json.location && r.json.location.lat === 54.9 ? true : 'location wrong: ' + short(r.json));
  await test('E65', 'delivery location bad lat', 'PATCH', '/api/orders/delivery/' + S.orderDelivery + '/location', { token: D(), role: 'delivery', body: { lat: 200, lng: 23.9 } }, 400);
  await test('E66', 'delivery location on pickup order', 'PATCH', '/api/orders/delivery/' + S.orderTamper + '/location', { token: D(), role: 'delivery', body: { lat: 54.9, lng: 23.9 } }, 404);
  await test('E67', 'delivery marks delivered', 'PATCH', '/api/orders/delivery/' + S.orderDelivery + '/status', { token: D(), role: 'delivery', body: { status: 'delivered' } }, 200, (r) => r.json && r.json.order && r.json.order.rewardPointsAwarded === 26 ? true : 'reward points not 26: ' + short(r.json));
  await test('E68', 'customer reward points now 31 (5+26)', 'GET', '/api/auth/me', { token: T(), role: 'customer' }, 200, (r) => r.json && r.json.user && r.json.user.rewardPoints === 31 ? true : 'rewardPoints is ' + (r.json && r.json.user && r.json.user.rewardPoints) + ', expected 31');
  await test('E69', 'refund on COD order rejected', 'POST', '/api/orders/' + S.orderDelivery + '/refund', { token: T(), role: 'customer', body: { reason: 'test refund' } }, 400);
  await test('E70', 'refund nonexistent order', 'POST', '/api/orders/000000000000000000000000/refund', { token: T(), role: 'customer', body: { reason: 'x' } }, 404);
  await test('E71', 'refund missing reason', 'POST', '/api/orders/' + S.orderDelivery + '/refund', { token: T(), role: 'customer', body: {} }, 400);
  await test('E72', 'refund queue admin empty', 'GET', '/api/orders/refunds/manage', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.refunds) && r.json.refunds.length === 0 ? true : 'refunds present: ' + short(r.json, 200));
  await test('E73', 'refund queue customer forbidden', 'GET', '/api/orders/refunds/manage', { token: T(), role: 'customer' }, 403);
  await test('E74', 'review refund bad action', 'PATCH', '/api/orders/refunds/' + S.orderDelivery + '/review', { token: A(), role: 'admin', body: { action: 'maybe' } }, 400);
  await test('E75', 'review refund nonexistent order', 'PATCH', '/api/orders/refunds/000000000000000000000000/review', { token: A(), role: 'admin', body: { action: 'approve' } }, 404);
  await test('E76', 'review refund no refund on order', 'PATCH', '/api/orders/refunds/' + S.orderDelivery + '/review', { token: A(), role: 'admin', body: { action: 'approve' } }, 404);
  // student discount positive tests (student-test is verified in DB)
  r = await test('E77', 'verified student 15% discount', 'POST', '/api/orders', { token: ST(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }, { itemId: '106', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', studentDiscountApplied: true } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.studentDiscountApplied !== true) return 'flag false'; if (o.discount !== 56.7) return 'discount ' + o.discount; if (o.total !== 321.3) return 'total ' + o.total; return true; });
  S.orderStudent = r.json && r.json.order && r.json.order._id;
  r = await test('E78', 'verified student without checkbox no discount', 'POST', '/api/orders', { token: ST(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', studentDiscountApplied: false } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.discount !== 0) return 'discount ' + o.discount; return true; });
  r = await test('E79', 'coupon 20% beats student 15% (max wins)', 'POST', '/api/orders', { token: ST(), role: 'customer', body: { outletId: '1', items: [{ itemId: '101', quantity: 1 }, { itemId: '106', quantity: 1 }], fulfillmentType: 'pickup', paymentMethod: 'cod', couponCode: 'TEST10', studentDiscountApplied: true } }, 201, (r) => { const o = r.json && r.json.order; if (!o) return 'no order'; if (o.discount !== 75.6) return 'discount ' + o.discount + ' (expected 75.6, coupon wins)'; if (o.total !== 302.4) return 'total ' + o.total; return true; });
  await test('E80', 'coupon usedCount now 2 (E12 + E79)', 'GET', '/api/coupons', { token: A(), role: 'admin' }, 200, (r) => { const c = (r.json.coupons || []).find(x => x.code === 'TEST10'); return c && c.usedCount === 2 ? true : 'usedCount is ' + (c && c.usedCount) + ', expected 2 (E12 + E79)'; });

  console.log('== FAVORITES ==');
  await test('F1', 'favorites empty', 'GET', '/api/favorites', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.favorites) && r.json.favorites.length === 0 ? true : 'not empty: ' + short(r.json, 200));
  await test('F2', 'add favorite outlet 1', 'POST', '/api/favorites/1', { token: T(), role: 'customer' }, 200);
  await test('F3', 'add favorite outlet 1 again (idempotent)', 'POST', '/api/favorites/1', { token: T(), role: 'customer' }, 200);
  await test('F4', 'add favorite outlet 999', 'POST', '/api/favorites/999', { token: T(), role: 'customer' }, 404);
  await test('F5', 'favorites lists outlet 1 once', 'GET', '/api/favorites', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.favorites) && r.json.favorites.length === 1 && r.json.favorites[0].outletId === '1' ? true : 'wrong list: ' + short(r.json, 200));
  await test('F6', 'remove favorite outlet 1', 'DELETE', '/api/favorites/1', { token: T(), role: 'customer' }, 200);
  await test('F7', 'remove favorite again (still 200)', 'DELETE', '/api/favorites/1', { token: T(), role: 'customer' }, 200);
  await test('F8', 'favorites no token', 'GET', '/api/favorites', {}, 401);

  console.log('== NOTIFICATIONS ==');
  r = await test('G1', 'notifications list has order notices', 'GET', '/api/notifications', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.notifications) && r.json.notifications.length > 0 && typeof r.json.unreadCount === 'number' ? true : 'no notifications: ' + short(r.json, 200));
  S.notif1 = r.json && r.json.notifications && r.json.notifications[0] && r.json.notifications[0]._id;
  await test('G2', 'mark all read', 'PATCH', '/api/notifications/read-all', { token: T(), role: 'customer' }, 200);
  await test('G3', 'unread count now 0', 'GET', '/api/notifications', { token: T(), role: 'customer' }, 200, (r) => r.json && r.json.unreadCount === 0 ? true : 'unreadCount ' + (r.json && r.json.unreadCount));
  await test('G4', 'mark already-read notification', 'PATCH', '/api/notifications/' + S.notif1 + '/read', { token: T(), role: 'customer' }, 404);
  await test('G5', 'mark nonexistent notification', 'PATCH', '/api/notifications/000000000000000000000000/read', { token: T(), role: 'customer' }, 404);
  await test('G6', 'notifications no token', 'GET', '/api/notifications', {}, 401);
  await test('G7', 'mark all read no token', 'PATCH', '/api/notifications/read-all', {}, 401);

  console.log('== REVIEWS ==');
  await test('H1', 'review summaries public', 'GET', '/api/reviews/summary', {}, 200, (r) => Array.isArray(r.json.summaries) ? true : 'no summaries: ' + short(r.json));
  await test('H2', 'outlet 1 reviews public', 'GET', '/api/reviews/outlet/1', {}, 200, (r) => r.json && typeof r.json.reviewCount === 'number' ? true : 'bad shape: ' + short(r.json));
  await test('H3', 'outlet 999 reviews', 'GET', '/api/reviews/outlet/999', {}, 404);
  await test('H4', 'review delivered order', 'POST', '/api/reviews', { token: T(), role: 'customer', body: { orderId: S.orderDelivery, rating: 5, comment: 'harness test review' } }, 201);
  await test('H5', 'duplicate review same order', 'POST', '/api/reviews', { token: T(), role: 'customer', body: { orderId: S.orderDelivery, rating: 4, comment: 'again' } }, 409);
  await test('H6', 'review placed (not delivered) order', 'POST', '/api/reviews', { token: T(), role: 'customer', body: { orderId: S.orderTamper, rating: 5, comment: 'too early' } }, 400);
  await test('H7', 'review rating 6', 'POST', '/api/reviews', { token: T(), role: 'customer', body: { orderId: S.orderDelivery, rating: 6, comment: 'bad rating' } }, 400);
  await test('H8', 'review nonexistent order', 'POST', '/api/reviews', { token: T(), role: 'customer', body: { orderId: '000000000000000000000000', rating: 5, comment: 'ghost' } }, 404);
  await test('H9', 'my reviews', 'GET', '/api/reviews/my', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.reviews) && r.json.reviews.length === 1 ? true : 'expected 1 review: ' + short(r.json, 200));
  await test('H10', 'review no token', 'POST', '/api/reviews', { body: { orderId: S.orderDelivery, rating: 5 } }, 401);
  await test('H11', 'outlet 1 reviews now count 1 avg 5', 'GET', '/api/reviews/outlet/1', {}, 200, (r) => r.json && r.json.reviewCount === 1 && r.json.averageRating === 5 ? true : 'count/avg wrong: ' + short(r.json));

  console.log('== STUDENT VERIFICATION ==');
  await test('I1', 'my verification status', 'GET', '/api/student-verification/me', { token: T(), role: 'customer' }, 200, (r) => r.json && r.json.verification && r.json.verification.studentVerificationStatus === 'not_submitted' ? true : 'unexpected: ' + short(r.json));
  await test('I2', 'submit without file', 'POST', '/api/student-verification/submit', { token: T(), role: 'customer' }, 400);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('studentId', new Blob([png], { type: 'image/png' }), 'student-id.png');
  await test('I3', 'submit with PNG file (Cloudinary not configured -> 503)', 'POST', '/api/student-verification/submit', { token: T(), role: 'customer', form }, [503]);
  await test('I4', 'pending list admin', 'GET', '/api/student-verification/pending', { token: A(), role: 'admin' }, 200);
  await test('I5', 'pending list customer forbidden', 'GET', '/api/student-verification/pending', { token: T(), role: 'customer' }, 403);
  await test('I6', 'review bad decision', 'PATCH', '/api/student-verification/' + S.customerId + '/review', { token: A(), role: 'admin', body: { decision: 'maybe' } }, 400);
  await test('I7', 'review non-pending user', 'PATCH', '/api/student-verification/' + S.customerId + '/review', { token: A(), role: 'admin', body: { decision: 'approved' } }, 409);
  await test('I8', 'review nonexistent user', 'PATCH', '/api/student-verification/000000000000000000000000/review', { token: A(), role: 'admin', body: { decision: 'approved' } }, 404);
  await test('I9', 'submit no token', 'POST', '/api/student-verification/submit', {}, 401);

  console.log('== SUPPORT ==');
  r = await test('J1', 'create ticket with own order', 'POST', '/api/support', { token: T(), role: 'customer', body: { subject: 'harness test ticket', category: 'order', message: 'Test message about my order.', orderId: S.orderDelivery } }, 201);
  S.ticketId = r.json && r.json.ticket && r.json.ticket._id;
  await test('J2', 'create ticket missing message', 'POST', '/api/support', { token: T(), role: 'customer', body: { subject: 'x', category: 'order', message: '' } }, 400);
  await test('J3', 'create ticket bad category', 'POST', '/api/support', { token: T(), role: 'customer', body: { subject: 'x', category: 'bogus', message: 'hi' } }, 400);
  await test('J4', 'create ticket nonexistent order', 'POST', '/api/support', { token: T(), role: 'customer', body: { subject: 'x', category: 'order', message: 'hi', orderId: '000000000000000000000000' } }, 404);
  await test('J5', 'my tickets', 'GET', '/api/support/my', { token: T(), role: 'customer' }, 200, (r) => Array.isArray(r.json.tickets) && r.json.tickets.length >= 1 ? true : 'no tickets: ' + short(r.json, 200));
  await test('J6', 'all tickets admin', 'GET', '/api/support/manage', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.tickets) && r.json.tickets.length >= 1 ? true : 'no tickets: ' + short(r.json, 200));
  await test('J7', 'all tickets customer forbidden', 'GET', '/api/support/manage', { token: T(), role: 'customer' }, 403);
  await test('J8', 'customer reply own ticket', 'POST', '/api/support/' + S.ticketId + '/reply', { token: T(), role: 'customer', body: { message: 'Follow-up from customer.' } }, 200);
  await test('J9', 'admin reply + set in_progress', 'POST', '/api/support/' + S.ticketId + '/reply', { token: A(), role: 'admin', body: { message: 'We are looking into it.', status: 'in_progress' } }, 200, (r) => r.json && r.json.ticket && r.json.ticket.status === 'in_progress' ? true : 'status not in_progress: ' + short(r.json));
  await test('J10', 'reply empty message', 'POST', '/api/support/' + S.ticketId + '/reply', { token: T(), role: 'customer', body: { message: '' } }, 400);
  await test('J11', 'vendor reply to others ticket forbidden', 'POST', '/api/support/' + S.ticketId + '/reply', { token: V(), role: 'vendor', body: { message: 'Not my ticket.' } }, 403);
  await test('J12', 'reply nonexistent ticket', 'POST', '/api/support/000000000000000000000000/reply', { token: A(), role: 'admin', body: { message: 'hi' } }, 404);
  await test('J13', 'admin resolves ticket', 'POST', '/api/support/' + S.ticketId + '/reply', { token: A(), role: 'admin', body: { message: 'Resolved.', status: 'resolved' } }, 200, (r) => r.json && r.json.ticket && r.json.ticket.status === 'resolved' ? true : 'not resolved: ' + short(r.json));
  await test('J14', 'customer reply to resolved ticket', 'POST', '/api/support/' + S.ticketId + '/reply', { token: T(), role: 'customer', body: { message: 'It is still broken.' } }, 400);
  await test('J15', 'admin reply to resolved ticket still allowed', 'POST', '/api/support/' + S.ticketId + '/reply', { token: A(), role: 'admin', body: { message: 'Reopening note.', status: 'in_progress' } }, 200);

  console.log('== ADMIN CUSTOMERS ==');
  await test('K1', 'list customers admin', 'GET', '/api/admin/customers', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.customers) && r.json.customers.some(c => c.email === 'jarvis-test@cravio.local') ? true : 'customer missing: ' + short(r.json, 200));
  await test('K2', 'search customers jarvis', 'GET', '/api/admin/customers?search=jarvis', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.customers) && r.json.customers.length >= 1 && r.json.customers.every(c => /jarvis/i.test(c.name + c.email)) ? true : 'search wrong: ' + short(r.json, 200));
  await test('K3', 'list customers customer forbidden', 'GET', '/api/admin/customers', { token: T(), role: 'customer' }, 403);
  await test('K4', 'customer details admin', 'GET', '/api/admin/customers/' + S.customerId, { token: A(), role: 'admin' }, 200, (r) => r.json && r.json.customer && r.json.customer.email === 'jarvis-test@cravio.local' ? true : 'wrong customer: ' + short(r.json));
  await test('K5', 'customer details nonexistent', 'GET', '/api/admin/customers/000000000000000000000000', { token: A(), role: 'admin' }, 404);
  await test('K6', 'customer details vendor id (not a customer)', 'GET', '/api/admin/customers/' + S.vendorId, { token: A(), role: 'admin' }, 404);
  await test('K7', 'deactivate customer', 'PATCH', '/api/admin/customers/' + S.customerId + '/status', { token: A(), role: 'admin', body: { isActive: false } }, 200);
  await test('K8', 'login deactivated customer', 'POST', '/api/auth/login', { body: { email: 'jarvis-test@cravio.local', password: 'TestPass123!' } }, 403);
  await test('K9', 'me with deactivated token', 'GET', '/api/auth/me', { token: T(), role: 'customer' }, 401);
  await test('K10', 'reactivate customer', 'PATCH', '/api/admin/customers/' + S.customerId + '/status', { token: A(), role: 'admin', body: { isActive: true } }, 200);
  await test('K11', 'me works again after reactivation', 'GET', '/api/auth/me', { token: T(), role: 'customer' }, 200);
  await test('K12', 'status update bad type', 'PATCH', '/api/admin/customers/' + S.customerId + '/status', { token: A(), role: 'admin', body: { isActive: 'yes' } }, 400);
  await test('K13', 'status update nonexistent', 'PATCH', '/api/admin/customers/000000000000000000000000/status', { token: A(), role: 'admin', body: { isActive: false } }, 404);

  console.log('== ANALYTICS ==');
  await test('L1', 'summary admin', 'GET', '/api/analytics/summary', { token: A(), role: 'admin' }, 200, (r) => r.json && r.json.summary && typeof r.json.summary.totalOrders === 'number' ? true : 'bad summary: ' + short(r.json, 200));
  await test('L2', 'summary vendor scoped', 'GET', '/api/analytics/summary', { token: V(), role: 'vendor' }, 200, (r) => r.json && r.json.outlets && r.json.outlets.every(o => o.outletId === '2') ? true : 'vendor sees other outlets: ' + short(r.json, 300));
  await test('L3', 'summary customer forbidden', 'GET', '/api/analytics/summary', { token: T(), role: 'customer' }, 403);
  await test('L4', 'summary days=7', 'GET', '/api/analytics/summary?days=7', { token: A(), role: 'admin' }, 200, (r) => r.json && r.json.rangeDays === 7 ? true : 'rangeDays not 7: ' + short(r.json, 200));
  await test('L5', 'summary days=999 defaults to 30', 'GET', '/api/analytics/summary?days=999', { token: A(), role: 'admin' }, 200, (r) => r.json && r.json.rangeDays === 30 ? true : 'rangeDays not 30: ' + short(r.json, 200));
  await test('L6', 'admin overview', 'GET', '/api/analytics/admin-overview', { token: A(), role: 'admin' }, 200, (r) => r.json && r.json.counts && typeof r.json.counts.totalCustomers === 'number' ? true : 'bad overview: ' + short(r.json, 200));
  await test('L7', 'admin overview vendor forbidden', 'GET', '/api/analytics/admin-overview', { token: V(), role: 'vendor' }, 403);

  console.log('== DELIVERY PARTNERS ==');
  await test('M1', 'list partners admin', 'GET', '/api/delivery-partners', { token: A(), role: 'admin' }, 200, (r) => Array.isArray(r.json.partners) && r.json.partners.some(p => p.email === 'delivery-test@cravio.local') ? true : 'partner missing: ' + short(r.json, 200));
  await test('M2', 'list partners customer forbidden', 'GET', '/api/delivery-partners', { token: T(), role: 'customer' }, 403);
  r = await test('M3', 'create partner admin', 'POST', '/api/delivery-partners', { token: A(), role: 'admin', body: { name: 'Partner Two', email: 'partner2@cravio.local', phone: '9876543211', password: 'TestPass123!', vehicleType: 'scooter' } }, 201);
  S.partner2Id = r.json && r.json.partner && r.json.partner.id;
  await test('M4', 'create partner duplicate email', 'POST', '/api/delivery-partners', { token: A(), role: 'admin', body: { name: 'Dup', email: 'partner2@cravio.local', phone: '9876543211', password: 'TestPass123!', vehicleType: 'bike' } }, 409);
  await test('M5', 'create partner bad phone', 'POST', '/api/delivery-partners', { token: A(), role: 'admin', body: { name: 'Bad', email: 'bad@cravio.local', phone: 'x', password: 'TestPass123!', vehicleType: 'bike' } }, 400);
  await test('M6', 'update partner2 offline', 'PATCH', '/api/delivery-partners/' + S.partner2Id, { token: A(), role: 'admin', body: { availability: 'offline' } }, 200);
  await test('M7', 'update nonexistent partner', 'PATCH', '/api/delivery-partners/000000000000000000000000', { token: A(), role: 'admin', body: { availability: 'offline' } }, 404);
  await test('M8', 'my delivery profile', 'GET', '/api/delivery-partners/me', { token: D(), role: 'delivery' }, 200, (r) => r.json && r.json.partner && r.json.partner.email === 'delivery-test@cravio.local' ? true : 'wrong profile: ' + short(r.json));
  await test('M9', 'my availability offline', 'PATCH', '/api/delivery-partners/me/availability', { token: D(), role: 'delivery', body: { availability: 'offline' } }, 200);
  await test('M10', 'my availability back to available', 'PATCH', '/api/delivery-partners/me/availability', { token: D(), role: 'delivery', body: { availability: 'available' } }, 200);
  await test('M11', 'my availability busy rejected', 'PATCH', '/api/delivery-partners/me/availability', { token: D(), role: 'delivery', body: { availability: 'busy' } }, 400);
  await test('M12', 'my delivery profile customer forbidden', 'GET', '/api/delivery-partners/me', { token: T(), role: 'customer' }, 403);

  console.log('== WEBHOOK / SOCKET / MISC ==');
  await test('W1', 'webhook no signature', 'POST', '/api/webhooks/razorpay', { rawBody: '{}' }, [400, 503]);
  await test('W2', 'webhook garbage signature', 'POST', '/api/webhooks/razorpay', { rawBody: '{}', extraHeaders: { 'x-razorpay-signature': 'deadbeef' } }, [400, 503]);
  r = await call('GET', '/socket.io/?EIO=4&transport=polling', {});
  const sockPass = !(r.raw || '').includes('"sid"');
  results.push({ id: 'SOCK1', name: 'socket.io handshake without token gets no session', method: 'GET', path: '/socket.io/?EIO=4&transport=polling', role: 'public', expected: 'no sid in response', status: r.status, verdict: sockPass ? 'PASS' : 'FAIL', note: sockPass ? '' : 'unauthenticated handshake returned a session id', resp: short(r.raw, 300) });
  console.log('SOCK1 ' + (sockPass ? 'PASS' : 'FAIL') + ' GET /socket.io/?EIO=4&transport=polling -> ' + r.status);
  await test('X1', 'unknown route', 'GET', '/api/unknown-route', {}, 404);
  await test('X2', 'malformed JSON body', 'POST', '/api/orders', { token: T(), role: 'customer', rawBody: '{bad json' }, 400);
  await test('X3', 'garbage bearer token', 'GET', '/api/orders/my', { extraHeaders: { Authorization: 'Bearer xyz' } }, 401);
  await test('X4', 'final stock check 101=43 106=42 102=48 201=49', 'GET', '/api/outlets/manage/inventory', { token: A(), role: 'admin' }, 200, (r) => {
    const items = r.json.items || [];
    const get = (oid, iid) => { const it = items.find(i => i.outletId === oid && i.itemId === iid); return it ? it.stockQuantity : null; };
    const bad = [];
    if (get('1', '101') !== 43) bad.push('101=' + get('1', '101'));
    if (get('1', '106') !== 42) bad.push('106=' + get('1', '106'));
    if (get('1', '102') !== 48) bad.push('102=' + get('1', '102'));
    if (get('2', '201') !== 49) bad.push('201=' + get('2', '201'));
    return bad.length ? 'stock mismatch: ' + bad.join(', ') : true;
  });

  const pass = results.filter(x => x.verdict === 'PASS').length;
  const fail = results.filter(x => x.verdict === 'FAIL').length;
  console.log('== SUMMARY == PASS=' + pass + ' FAIL=' + fail + ' TOTAL=' + results.length + ' AUTH429=' + auth429);
  fs.writeFileSync('test-results.json', JSON.stringify({ pass, fail, total: results.length, auth429, results }, null, 2));
  console.log('WROTE test-results.json');
})().catch(e => {
  console.log('HARNESS-ERROR ' + e.message);
  try { fs.writeFileSync('test-results.json', JSON.stringify({ harnessError: e.message, results }, null, 2)); } catch (_) { /* ignore */ }
  process.exit(1);
});
