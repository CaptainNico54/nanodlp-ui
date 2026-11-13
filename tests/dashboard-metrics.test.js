const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const metrics = require('../public/js/dashboard-metrics.js');
const analyticsSource = fs.readFileSync(path.join(__dirname, '../public/js/analytics.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '../templates/dashboard-widgets/pressure-chart.html'), 'utf8');
const inline = template.match(/<script>([\s\S]*?)<\/script>/)[1];
const analytics = vm.createContext({
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    uPlot: { fmtDate: () => () => '' },
});
vm.runInContext(analyticsSource + '\nthis.sharedFields = ALL_CHART_CONFIG;', analytics);
const fields = JSON.parse(JSON.stringify(analytics.sharedFields));
const clone = value => JSON.parse(JSON.stringify(value));

test('offers all 28 shared analytics fields without redefining their IDs or label overrides', () => {
    const options = metrics.options(fields);
    assert.equal(options.length, fields.length);
    assert.equal(options.length, 28);
    options.forEach((option, index) => {
        assert.equal(option.key, fields[index].key);
        assert.equal(option.id, fields[index].id);
        assert.equal(metrics.AXES[index].Key, option.key, 'axis order must match telemetry T indexing');
    });
    assert.equal(options.find(metric => metric.key === 'Pressure').label, 'Force');
    assert.equal(options.find(metric => metric.key === 'Pressure').unit, 'g');
    assert.equal(options.find(metric => metric.key === 'VOCInlet').label, 'VOC Score Inlet');
    assert.equal(options.find(metric => metric.key === 'VOCInlet').unit, '');
});

test('limits selections to five known unique metrics and preserves the existing defaults', () => {
    assert.deepEqual(metrics.DEFAULT_KEYS, ['Pressure', 'TemperatureInside', 'LayerHeight']);
    for (const invalid of [null, {}, [], ['missing'], 'Pressure']) {
        assert.deepEqual(metrics.normalizeSelection(invalid), metrics.DEFAULT_KEYS);
    }
    assert.deepEqual(metrics.normalizeSelection(['VOCInlet', 'missing', 'VOCInlet', 'AreaCount']), ['VOCInlet', 'AreaCount']);
    assert.equal(metrics.normalizeSelection(fields.map(field => field.key)).length, 5);
});

test('persists per-browser choices and handles blocked or malformed storage', () => {
    const saved = new Map();
    const storage = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)};
    assert.deepEqual(metrics.loadSelection(storage), metrics.DEFAULT_KEYS);
    assert.equal(metrics.saveSelection(storage, ['VOCOutlet', 'Speed', 'AreaCount']), true);
    assert.deepEqual(metrics.loadSelection(storage), ['VOCOutlet', 'Speed', 'AreaCount']);
    saved.set(metrics.STORAGE_KEY, '{broken');
    assert.deepEqual(metrics.loadSelection(storage), metrics.DEFAULT_KEYS);
    assert.deepEqual(metrics.loadSelection(undefined), metrics.DEFAULT_KEYS);
    assert.equal(metrics.saveSelection(undefined, ['Pressure']), false);
});

test('isolates dashboard legend visibility from the full analytics legends', () => {
    const saved = new Map([['legends:v3', JSON.stringify({
        '#uplot-1': [{key:'Pressure',show:false}],
        '#uplot-2': [{key:'VOCInlet',show:false}],
        [metrics.LEGEND_KEY]: [{key:'Pressure',show:false}],
    })]]);
    const storage = {getItem:key=>saved.get(key), setItem:(key,value)=>saved.set(key,value)};
    metrics.clearDashboardLegend(storage);
    assert.deepEqual(JSON.parse(saved.get('legends:v3')), {
        '#uplot-1': [{key:'Pressure',show:false}],
        '#uplot-2': [{key:'VOCInlet',show:false}],
    });
    assert.equal(metrics.chartConfig(['Pressure'], fields).legendStorageKey, metrics.LEGEND_KEY);
});

test('uses separate unit scales, prioritizes Force and temperature, and bounds axis count', () => {
    const selected = ['AreaCount', 'Speed', 'Pressure', 'TemperatureInside', 'VOCInlet'];
    const config = metrics.chartConfig(selected, fields, selected);
    assert.deepEqual(config.desktopAxisScales, ['Pressure', '°C', '#']);
    assert.deepEqual(config.mobileAxisScales, ['Pressure', '°C']);
    assert.equal(config.fields.length, 5);
    assert.deepEqual(config.fixedScaleRanges.VOC, [0, 100]);
    assert.equal(analytics.determineDecimalPlaces('#'), 0);
    assert.equal(analytics.determineDecimalPlaces('mm/s'), 1);
    const missingPriority = metrics.chartConfig(selected, fields, ['Speed', 'VOCInlet']);
    assert.deepEqual(missingPriority.desktopAxisScales, ['mm/s', 'VOC']);
    assert.equal(missingPriority.fields.length, 5, 'unavailable choices remain selected for future readings');
    assert.equal(metrics.chartConfig(['UVFanRPM'], fields, ['UVFanRPM']).roundedRpmScale, true);
});

test('availability includes zero readings and excludes absent or invalid samples without mutating data', () => {
    const data = Object.freeze([
        Object.freeze({ID:1,T:16,V:0}), Object.freeze({ID:2,T:26,V:99.5}),
        Object.freeze({ID:3,T:6,V:null}), Object.freeze({ID:4,T:7,V:NaN}),
        Object.freeze({T:0,V:1}),
    ]);
    assert.deepEqual(metrics.availableKeys(data, fields), ['UVFanRPM', 'VOCInlet']);
    assert.deepEqual(metrics.availableKeys(null, fields), []);
});

test('every selectable field reaches the shared chart renderer with its correct original value', () => {
    const data = Object.freeze(fields.map((field, index) => Object.freeze({ID:(index+1)*1000000000, T:field.id, V:field.id+0.25})));
    let result;
    analytics.renderChart = (name, rows, series, config) => { result = {rows, series, config}; };
    fields.forEach(field => {
        vm.runInContext('cachedDataByChart.clear()', analytics);
        const config = metrics.chartConfig([field.key], fields, [field.key]);
        analytics.buildChartFromData(null, data, false, metrics.AXES, [config]);
        assert.equal(result.series.length, 2, field.key);
        assert.equal(result.series[1].key, field.key);
        assert.equal(result.rows[1].at(-1), field.id + 0.25, field.key);
        assert.deepEqual(result.config.fields.map(item => item.id), [field.id]);
    });
});

function controllerHarness() {
    let selection = metrics.DEFAULT_KEYS.slice();
    let changed;
    const requests = [];
    const intervals = [];
    const renders = [];
    const elements = {};
    let destroyed = 0;
    const context = vm.createContext({
        C3DDashboardMetrics: {...metrics, mount: (_fields, onChange) => {
            changed = onChange;
            return {getSelection: () => selection.slice()};
        }},
        ALL_CHART_CONFIG: fields,
        BASE_URL: '', ANALYTICS_UPDATE_INTERVAL: 1000,
        document: {}, isZoomed: false, uplots: [], cachedDataByChart: new Map(),
        clearTimeout() {},
        setInterval: (fn, delay) => { intervals.push({fn, delay}); },
        fetch: url => new Promise(resolve => requests.push({url, resolve})),
        $: selector => {
            if (typeof selector === 'object') return {ready: callback => callback()};
            const element = elements[selector] ??= {};
            return {prop: (key, value) => {element[key] = value;}, empty: () => {element.empty = true;}, hide: () => {element.hidden = true;}};
        },
        buildChartFromData: (_name, data, _exp, _axes, configs) => {
            renders.push({data, fields:configs[0].fields.map(field=>field.key)});
            context.uplots = [{id:'#uplot-1',chartConfig:configs[0],uplot:{destroy:()=>{destroyed++;}}}];
        },
    });
    vm.runInContext(inline, context);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const respond = async (request, json, ok = true) => {
        request.resolve({ok, json: async () => json});
        await settle();
    };
    return {context, requests, intervals, renders, elements, respond, settle,
        select(keys) {selection = keys.slice(); changed();}, get destroyed() {return destroyed;}};
}

test('a selection made while a request is pending survives its response and sends no extra requests', async () => {
    const h = controllerHarness();
    assert.equal(h.requests[0].url, '/status');
    await h.respond(h.requests[0], {Printing:true});
    assert.equal(h.requests[1].url, '/analytic/data/start');
    h.select(['VOCInlet']);
    assert.equal(h.requests.length, 2);
    const data = [{ID:1,T:6,V:42},{ID:2,T:26,V:99}];
    await h.respond(h.requests[1], data);
    assert.deepEqual(clone(h.renders.at(-1).fields), ['VOCInlet']);
    assert.equal(h.renders.at(-1).data, data);
    assert.deepEqual(h.intervals.map(entry=>entry.delay), [1000]);
});

test('changing while zoomed resets the dashboard; unavailable selections never leave an old chart', async () => {
    const h = controllerHarness();
    await h.respond(h.requests[0], {Printing:false});
    assert.equal(h.requests[1].url, '/analytic/data/10000');
    await h.respond(h.requests[1], [{ID:1,T:6,V:42}]);
    h.context.isZoomed = true;
    h.context.cachedDataByChart.set('#uplot-1', 'previous');
    h.select(['VOCInlet']);
    assert.equal(h.destroyed, 1);
    assert.equal(h.context.isZoomed, false);
    assert.equal(h.context.cachedDataByChart.has('#uplot-1'), false);
    assert.equal(h.elements['#dashboard-chart-empty'].hidden, false);
    h.intervals[0].fn();
    await h.respond(h.requests[2], {Printing:false});
    await h.respond(h.requests[3], [{ID:2,T:26,V:98}]);
    assert.deepEqual(clone(h.renders.at(-1).fields), ['VOCInlet']);
    assert.equal(h.elements['#dashboard-chart-empty'].hidden, true);
});

test('failed polling preserves the last chart and recovers on the next regular interval', async () => {
    const h = controllerHarness();
    await h.respond(h.requests[0], {Printing:false});
    await h.respond(h.requests[1], [{ID:1,T:6,V:42}]);
    const renders = h.renders.length;
    h.intervals[0].fn();
    await h.respond(h.requests[2], null, false);
    assert.equal(h.renders.length, renders);
    assert.equal(h.destroyed, 0);
    h.intervals[0].fn();
    await h.respond(h.requests[3], {Printing:true});
    await h.respond(h.requests[4], [{ID:2,T:6,V:43}]);
    assert.equal(h.renders.length, renders + 1);
});
