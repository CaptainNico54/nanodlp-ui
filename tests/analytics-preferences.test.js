const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const analyticsSource = fs.readFileSync(path.join(root, 'public/js/analytics.js'), 'utf8');
const metricsSource = fs.readFileSync(path.join(root, 'public/js/dashboard-metrics.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const options = (...keys) => ({series: [{}, ...keys.map(key => ({key, show: true}))]});

function setup(initial = null) {
    let raw = initial;
    let click;
    const storage = {
        getItem: () => raw,
        setItem(key, value) { assert.equal(key, 'legends:v3'); raw = value; },
    };
    const context = vm.createContext({
        localStorage: storage,
        window: {localStorage: storage, addEventListener() {}, matchMedia: () => ({matches: false})},
        $: selector => {
            assert.equal(selector, '.u-legend .u-series');
            return {
                off() { return this; },
                on(event, handler) { assert.equal(event, 'click.c3dLegend'); click = handler; return this; },
            };
        },
    });
    vm.runInContext(analyticsSource + '\nthis.setPlots = plots => { uplots = plots; };', context);
    vm.runInContext(metricsSource, context);
    return {
        api: context, storage,
        dashboardKey: context.C3DDashboardMetrics.LEGEND_KEY,
        saved: () => JSON.parse(raw),
        save(plots) { context.setPlots(plots); context.addSaveLegendHandler(); click(); },
    };
}

function plot(id, visibility, legendStorageKey) {
    return {
        id, chartConfig: {legendStorageKey},
        uplot: {series: [{}, ...Object.entries(visibility).map(([key, show]) => ({key, show}))]},
    };
}

test('saving dashboard visibility preserves both full analytics preference entries', () => {
    const original = {
        '#uplot-1': [{key: 'Pressure', show: false}],
        '#uplot-2': [{key: 'VOCInlet', show: false}],
    };
    const s = setup(JSON.stringify(original));
    s.save([plot('#uplot-1', {Pressure: true, Speed: false}, s.dashboardKey)]);
    assert.deepEqual(s.saved(), {
        ...original,
        [s.dashboardKey]: [{show: true}, {key: 'Pressure', show: true}, {key: 'Speed', show: false}],
    });
});

test('saving full analytics visibility preserves the dashboard preference entry', () => {
    const s = setup();
    s.storage.setItem('legends:v3', JSON.stringify({[s.dashboardKey]: [{key: 'Pressure', show: false}]}));
    s.save([plot('#uplot-1', {Pressure: true}), plot('#uplot-2', {VOCInlet: false})]);
    assert.deepEqual(s.saved(), {
        [s.dashboardKey]: [{key: 'Pressure', show: false}],
        '#uplot-1': [{show: true}, {key: 'Pressure', show: true}],
        '#uplot-2': [{show: true}, {key: 'VOCInlet', show: false}],
    });
});

test('restores visibility by metric key after series reordering', () => {
    const s = setup(JSON.stringify({'#uplot-1': [
        {}, {key: 'Pressure', show: false}, {key: 'Speed', show: true},
        {key: 'removed', show: false}, null, 17,
    ]}));
    const reordered = options('Speed', 'AreaCount', 'Pressure');
    s.api.applyLegend(reordered, '#uplot-1');
    assert.deepEqual(reordered.series, [
        {}, {key: 'Speed', show: true}, {key: 'AreaCount', show: true}, {key: 'Pressure', show: false},
    ]);
});

test('corrupt or invalid stored preferences safely default and allow later saving', () => {
    for (const raw of [null, '{bad', '[]', 'null', '123', '"bad"']) {
        const s = setup(raw);
        assert.deepEqual(clone(s.api.readLegendPreferences()), {});
        const opts = options('Pressure');
        assert.equal(s.api.applyLegend(opts, '#uplot-1'), opts);
        assert.equal(opts.series[1].show, true);
        assert.doesNotThrow(() => s.save([plot('#uplot-1', {Pressure: false})]));
        assert.equal(s.saved()['#uplot-1'][1].show, false);
    }
});

test('blocked storage reads and writes do not prevent legend use', () => {
    const s = setup();
    s.storage.getItem = s.storage.setItem = () => { throw new Error('Storage blocked'); };
    assert.deepEqual(clone(s.api.readLegendPreferences()), {});
    assert.equal(s.api.applyLegend(options('Pressure'), '#uplot-1').series[1].show, true);
    assert.doesNotThrow(() => s.save([plot('#uplot-1', {Pressure: false})]));
    assert.equal(s.api.applyLegend(options('Pressure'), '#uplot-1').series[1].show, false);
});

test('dashboard legend reset applies in this page when storage reads work but writes fail', () => {
    const s = setup();
    s.storage.setItem('legends:v3', JSON.stringify({
        [s.dashboardKey]: [{key: 'Pressure', show: false}],
        '#uplot-1': [{key: 'Pressure', show: false}],
    }));
    s.storage.setItem = () => { throw new Error('Storage is read-only'); };
    s.api.C3DDashboardMetrics.clearDashboardLegend(s.storage);
    assert.equal(s.api.applyLegend(options('Pressure'), s.dashboardKey).series[1].show, true);
    assert.equal(s.api.applyLegend(options('Pressure'), '#uplot-1').series[1].show, false);
    s.save([plot('#uplot-1', {Pressure: false}, s.dashboardKey)]);
    assert.equal(s.api.applyLegend(options('Pressure'), s.dashboardKey).series[1].show, false);
    s.api.C3DDashboardMetrics.clearDashboardLegend(s.storage);
    assert.equal(s.api.applyLegend(options('Pressure'), s.dashboardKey).series[1].show, true);
});

test('count and speed scales produce their own formatted axes', () => {
    const s = setup();
    const axes = s.api.prepareAxis([
        {}, {key: 'AreaCount', scale: '#'}, {key: 'Speed', scale: 'mm/s'},
    ], {});
    assert.equal(s.api.determineDecimalPlaces('#'), 0);
    assert.equal(s.api.determineDecimalPlaces('mm/s'), 1);
    assert.deepEqual(clone(axes.find(axis => axis.scale === '#').values(null, [0, 12])), ['0', '12']);
    assert.deepEqual(clone(axes.find(axis => axis.scale === 'mm/s').values(null, [0, 1.25])), ['0.0', '1.3']);
});
