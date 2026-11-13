const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/js/resin-unsaved.js'), 'utf8');

function eventTarget() {
    const handlers = new Map();
    return {
        handlers,
        addEventListener(type, callback) {
            if (!handlers.has(type)) handlers.set(type, []);
            handlers.get(type).push(callback);
        },
        emit(type, values = {}) {
            const event = {defaultPrevented: false, returnValue: '', preventDefault() { this.defaultPrevented = true; }, ...values};
            for (const callback of handlers.get(type) || []) callback(event);
            return event;
        }
    };
}

function field(name, value, options = {}) {
    return {tagName: 'INPUT', type: 'text', id: name, name, value, validity: {badInput: false}, ...options};
}

function form(elements, options = {}) {
    return {
        elements, hidden: false, attributes: {}, ...options,
        classList: {contains(name) { return name === 'hidden' && !!options.hidden; }},
        getAttribute(name) { return this.attributes[name] ?? null; }
    };
}

function setup(forms = [], {initialize = true, confirm = true} = {}) {
    const timers = [];
    const ready = [];
    const prompts = [];
    const document = eventTarget();
    document.querySelectorAll = selector => {
        assert.equal(selector, 'form[data-resin-editor-form]');
        return forms;
    };
    const window = Object.assign(eventTarget(), {
        setTimeout(callback, delay) { timers.push({callback, delay}); },
        confirm(message) { prompts.push(message); return confirm; }
    });
    const context = {window, document, jQuery: callback => ready.push(callback)};
    vm.runInNewContext(source, context);
    function runReady() { for (const callback of ready.splice(0)) callback(); }
    function runTimers(delay) {
        for (let i = timers.length - 1; i >= 0; i--) {
            if (timers[i].delay === delay) timers.splice(i, 1)[0].callback();
        }
    }
    if (initialize) { runReady(); runTimers(0); }
    return {window, document, prompts, timers, runReady, runTimers, context};
}

function expectWarning(s, expected = true) {
    const event = s.window.emit('beforeunload');
    assert.equal(event.defaultPrevented, expected);
    if (expected) assert.match(event.returnValue, /unsaved changes.*resin profile/i);
    else assert.equal(event.returnValue, '');
}

test('the guard leaves unrelated pages and machine-settings forms alone', () => {
    const s = setup();
    assert.equal(s.window.c3dResinEditorGuard, undefined);
    assert.equal(s.window.handlers.size, 0);
    expectWarning(s, false);
});

test('baseline waits for ready initializers and the native DOMContentLoaded PWM conversion', () => {
    const speed = field('SimpleLiftSpeed', '');
    const pwm = field('UvPwmValuePercent', '0.7', {type: 'number'});
    const wait = field('WaitBeforePrint', '12', {type: 'number'});
    const checkbox = field('DwEnable', '0', {type: 'checkbox', checked: false});
    const s = setup([form([speed, pwm, wait, checkbox])], {initialize: false});
    speed.value = '50';
    wait.value = '0.00';
    wait.disabled = true;
    checkbox.checked = true;
    s.runReady();
    assert.equal(s.window.c3dResinEditorGuard, undefined);
    pwm.value = '70';
    s.runTimers(0);
    expectWarning(s, false);
    pwm.value = '71';
    expectWarning(s);
});

test('actual edits warn; restoring the original value clears the warning', () => {
    const title = field('Title', 'My resin');
    const s = setup([form([title])]);
    expectWarning(s, false);
    title.value = 'Changed resin';
    expectWarning(s);
    // Choosing Stay in the browser must not clear the unsaved state.
    expectWarning(s);
    title.value = 'My resin';
    expectWarning(s, false);
});

test('formatting and display-only changes are clean, including the inactive editor', () => {
    const number = field('ResinPrice', '42.00', {type: 'number'});
    const inactive = field('Title', 'Hidden editor');
    const save = field('', '', {tagName: 'BUTTON', type: 'submit'});
    const config = field('', '19', {id: 'MXRes', type: 'hidden'});
    const activeForm = form([number, save, config]);
    const s = setup([form([inactive], {hidden: true}), activeForm]);
    number.value = '42';
    number.disabled = true;
    number.style = {display: 'none'};
    save.disabled = true;
    config.value = '24';
    inactive.value = 'Changed hidden editor';
    s.document.emit('click');
    expectWarning(s, false);
});

test('checkbox, radio, select and multi-select changes are tracked', () => {
    for (const control of [
        field('Detection', '0', {type: 'checkbox', checked: true}),
        field('Choice', '0', {type: 'radio', checked: true}),
        field('Mode', '0', {tagName: 'SELECT', type: 'select-one'}),
        field('Modes', '', {tagName: 'SELECT', type: 'select-multiple', multiple: true, options: [{value:'a', selected:true}, {value:'b', selected:false}]})
    ]) {
        const s = setup([form([control])]);
        expectWarning(s, false);
        if (control.type === 'checkbox' || control.type === 'radio') control.checked = false;
        else if (control.multiple) control.options[1].selected = true;
        else control.value = '1';
        expectWarning(s);
    }
});

test('programmatic formula, hidden, disabled and named custom values are protected without events', () => {
    for (const control of [
        field('StartOfLayer', 'G90', {tagName: 'TEXTAREA', type: 'textarea'}),
        field('UvPwmValue', '0.7', {type: 'hidden'}),
        field('WaitBeforePrint', '0', {disabled: true}),
        field('CustomerSetting', 'one'),
        field('', '50', {id: 'SpeedHelper', type: 'number'})
    ]) {
        const s = setup([form([control])]);
        control.value = '1';
        expectWarning(s);
    }
});

test('empty numbers and invalid numeric input cannot be mistaken for zero or an unchanged blank', () => {
    const number = field('CureTime', '0', {type:'number'});
    const s = setup([form([number])]);
    number.value = '';
    expectWarning(s);
    const blank = field('OptionalNumber', '', {type:'number'});
    const other = setup([form([blank])]);
    blank.validity.badInput = true;
    expectWarning(other);
});

test('accepted Save bypasses one unload after existing serialization and does not reset the baseline', () => {
    const title = field('Title', 'Original');
    const toggle = field('DwEnable', '1', {type:'checkbox', checked:false});
    const dynamic = field('DynamicSpeed', 'old', {type:'hidden'});
    const editor = form([title, toggle, dynamic]);
    const s = setup([editor]);
    title.value = 'Edited';
    // These are the transformations Athena's existing form handler runs before
    // the submit event bubbles to the window listener.
    toggle.checked = true;
    dynamic.value = '[JS] new speed formula [/JS]';
    s.window.emit('submit', {target: editor});
    expectWarning(s, false);
    expectWarning(s);
});

test('invalid Save clicks and submissions canceled before or after the listener retain protection', () => {
    for (const timing of ['validation', 'before', 'after']) {
        const title = field('Title', 'Original');
        const editor = form([title]);
        const s = setup([editor]);
        title.value = '';
        s.document.emit('click');
        // Native validation failure does not dispatch submit at all.
        if (timing !== 'validation') {
            const event = s.window.emit('submit', {target: editor, defaultPrevented: timing === 'before'});
            if (timing === 'after') event.preventDefault();
        }
        expectWarning(s);
    }
});

test('aborted submission permission expires, and next user attempts re-arm immediately', () => {
    for (const action of ['timeout', 'click', 'keydown', 'input', 'change', 'pageshow']) {
        const title = field('Title', 'Original');
        const editor = form([title]);
        const s = setup([editor]);
        title.value = 'Edited';
        s.window.emit('submit', {target: editor});
        if (action === 'timeout') s.runTimers(1000);
        else if (action === 'pageshow') s.window.emit(action);
        else s.document.emit(action);
        expectWarning(s);
    }
});

test('edits made after Save still warn even without an input event', () => {
    const title = field('Title', 'Original');
    const editor = form([title]);
    const s = setup([editor]);
    title.value = 'Submitted';
    s.window.emit('submit', {target: editor});
    title.value = 'Later edit';
    expectWarning(s);
});

test('unrelated forms and submissions targeting another tab never exempt the editor', () => {
    for (const external of [true, false]) {
        const title = field('Title', 'Original');
        const editor = form([title], {attributes: external ? {} : {target: '_blank'}});
        const s = setup([editor]);
        title.value = 'Edited';
        s.window.emit('submit', {target: external ? form([]) : editor});
        expectWarning(s);
    }
});

test('mode-change confirmation retains dirty state on Stay and permits only the confirmed snapshot on Leave', () => {
    for (const confirm of [false, true]) {
        const title = field('Title', 'Original');
        const s = setup([form([title])], {confirm});
        const guard = s.window.c3dResinEditorGuard;
        assert.equal(guard.confirmLeave(), true);
        assert.equal(s.prompts.length, 0);
        title.value = 'Edited';
        assert.equal(guard.confirmLeave(), confirm);
        assert.equal(guard.hasChanges(), true);
        assert.equal(s.prompts.length, 1);
        expectWarning(s, !confirm);
        expectWarning(s);
        guard.confirmLeave();
        title.value = 'Another edit';
        expectWarning(s);
    }
});

test('service mode checks the editor before sending its request or disabling confirmation', () => {
    const main = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8');
    const start = main.indexOf('var serviceModeTogglePending = false;');
    const end = main.indexOf('$(document).on("click", "#serviceModeEntry"', start);
    assert.ok(start > 0 && end > start);
    for (const allow of [false, true, null]) {
        const requests = [];
        const disabled = [];
        let reloads = 0;
        const $ = selector => {
            assert.equal(selector, '#serviceModeConfirm');
            return {prop: (name, value) => disabled.push({name, value})};
        };
        $.ajax = options => requests.push(options);
        const context = {$, window: {location: {reload: () => reloads++}}};
        if (allow !== null) context.window.c3dResinEditorGuard = {confirmLeave: () => allow};
        vm.runInNewContext(main.slice(start, end), context);
        context.toggleServiceMode();
        if (allow === false) {
            assert.equal(requests.length, 0);
            assert.equal(disabled.length, 0);
            assert.equal(context.serviceModeTogglePending, false);
        } else {
            assert.equal(requests.length, 1);
            assert.equal(requests[0].url, '/printer/view/toggle');
            assert.deepEqual(disabled, [{name:'disabled', value:true}]);
            context.toggleServiceMode();
            assert.equal(requests.length, 1);
            requests[0].complete();
            assert.equal(reloads, 1);
        }
    }
});

test('both resin templates opt in after common initializers without changing save routes or external Save', () => {
    const base = fs.readFileSync(path.join(root, 'templates/base.html'), 'utf8');
    assert.ok(base.indexOf('{% block js %}') > base.indexOf("src='/static/js/athena.js"));
    for (const file of ['edit', 'simple']) {
        const template = fs.readFileSync(path.join(root, 'templates/profile/' + file + '.html'), 'utf8');
        assert.match(template, /\{% block js %\}\s*<script src="\/static\/js\/resin-unsaved\.js\?/);
        const forms = template.match(/<form\b[^>]*>/g);
        assert.equal(forms.length, file === 'edit' ? 2 : 1);
        for (const markup of forms) {
            assert.match(markup, /action="" method="post"/);
            assert.match(markup, /data-resin-editor-form/);
        }
        if (file === 'edit') assert.match(template, /type="submit" form="setup2"/);
    }
});
