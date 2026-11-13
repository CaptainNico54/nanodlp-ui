const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/js/athena.js'), 'utf8');
const start = source.indexOf('async function runGcode(gcode) {');
const end = source.indexOf('/* The disk cards', start);
assert.ok(start !== -1 && end > start);

function setup(fetchImpl) {
    const requests = [];
    const messages = [];
    const handlers = [];
    const state = {disabled:false, busy:null};
    const document = {};
    const controls = {
        prop(key, value) { if (key === 'disabled') state.disabled = value; return this; },
        attr(key, value) { if (key === 'aria-busy') state.busy = value; return this; },
        removeAttr(key) { if (key === 'aria-busy') state.busy = null; return this; }
    };
    const context = {
        document, URLSearchParams,
        fetch: (url, options) => {requests.push({url, options}); return fetchImpl(url, options);},
        toastr: {
            success: text => messages.push({kind:'success', text}),
            error: text => messages.push({kind:'error', text})
        },
        $: selector => {
            if (selector === '[data-force-tare]') return controls;
            assert.equal(selector, document);
            return {ready: fn => fn(), on: (event, target, fn) => handlers.push({event, target, fn})};
        }
    };
    vm.runInNewContext(source.slice(start, end), context);
    return {context, requests, messages, handlers, state};
}

test('initialization binds an explicit action and sends no command', () => {
    const s = setup(async () => ({ok:true}));
    assert.equal(s.requests.length, 0);
    assert.equal(s.handlers.length, 1);
    assert.equal(s.handlers[0].target, '[data-force-tare]');
    assert.equal(s.handlers[0].event, 'click.c3dForceTare');
});

test('tare submits the exact NanoDLP command once and only confirms submission', async () => {
    const s = setup(async () => ({ok:true}));
    await s.context.requestForceTare();
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].url, '/gcode');
    assert.equal(s.requests[0].options.method, 'post');
    assert.equal(s.requests[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(new URLSearchParams(s.requests[0].options.body).get('gcode'), '[[PressureWrite 1]]');
    assert.deepEqual(s.messages, [{kind:'success', text:'Force tare requested.'}]);
    assert.deepEqual(s.state, {disabled:false, busy:null});
});

test('pending tare disables controls and suppresses duplicate clicks', async () => {
    let finish;
    const s = setup(() => new Promise(resolve => {finish = resolve;}));
    const first = s.context.requestForceTare();
    assert.deepEqual(s.state, {disabled:true, busy:'true'});
    await s.context.requestForceTare();
    assert.equal(s.requests.length, 1);
    finish({ok:true});
    await first;
    assert.deepEqual(s.state, {disabled:false, busy:null});
});

test('HTTP and network failures show failure, restore controls and allow retry', async () => {
    for (const fetchImpl of [async () => ({ok:false, status:500}), async () => {throw Error('offline');}]) {
        const s = setup(fetchImpl);
        await s.context.requestForceTare();
        assert.equal(s.messages[0].kind, 'error');
        assert.deepEqual(s.state, {disabled:false, busy:null});
        await s.context.requestForceTare();
        assert.equal(s.requests.length, 2);
        assert.equal(s.messages.some(m => m.kind === 'success'), false);
    }
});

test('Tare appears on the dashboard and live analytics templates', () => {
    for (const file of ['templates/index.html', 'templates/analytics.html']) {
        const template = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(template, /<button\b[^>]*type="button"[^>]*data-force-tare/);
    }
});
