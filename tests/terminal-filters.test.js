const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8');
const start = source.indexOf('var TERMINAL_FILTERS_KEY=');
const end = source.indexOf('\nfunction terminal_at_bottom(', start);
assert.notEqual(start, -1, 'terminal filter section is present');
assert.notEqual(end, -1, 'terminal filter section has an end marker');

function makeContext(saved = null, readError = false) {
	const reads = [];
	const context = {
		localStorage: {
			getItem: key => {
				reads.push(key);
				if (readError) throw new Error('Storage unavailable');
				return saved;
			},
			setItem: () => { throw new Error('Loading preferences must not write them'); }
		}
	};
	vm.runInNewContext(source.slice(start, end), context);
	return {context, reads};
}

const temperature = 'CHAMBER:30.3 /0.0 HOST:45.2 /55.0 MCU:36.5 /0.0 PTC:30.5 /0.0 RESIN:34.9 /35.0 UVLED:30.4 /40.0 VAT:38.5 /40.2';
const fanSamples = [
	'echo: UVLedFanRPM 1671.6867469893195',
	'echo: CaseFanRPM 1619.1904047944925',
	'echo: PTCFanRPM 0.0',
	'echo: AuxFanRPM 0.0',
	'echo: AEGISFanRPM 0.0'
];
const vocSamples = ['VOCINLET:99.74', 'VOCOUTLET:96.61'];
const defaults = {m105: true, fan: true, voc: true};

function filterCombinations() {
	return Array.from({length: 8}, (_, bits) => ({
		m105: Boolean(bits & 1),
		fan: Boolean(bits & 2),
		voc: Boolean(bits & 4)
	}));
}

test('classifies exact M105 commands with supported protocol wrappers', () => {
	const {context} = makeContext();
	for (const line of [
		'M105', ' M105 ', 'm105', 'M105 T0', 'M105 T12',
		'N12 M105', 'M105*42', 'N12 M105 T0*42',
		'Send: M105', 'Recv: M105', 'echo: M105', '// M105'
	]) {
		assert.equal(context.terminal_filter_category(line), 'm105', line);
	}
});

test('classifies complete Athena and conventional temperature reports', () => {
	const {context} = makeContext();
	for (const line of [
		temperature,
		'ok ' + temperature,
		'Recv: ' + temperature,
		'T:25.0 /0.0 B:30.0 /40.0',
		'ok T0:25.0 /0.0 T1:26.0 /0.0 @:0 B@:255',
		'RESIN:-1.5 /35.0'
	]) {
		assert.equal(context.terminal_filter_category(line), 'm105', line);
	}
});

test('classifies actual fan and VOC telemetry including zero readings', () => {
	const {context} = makeContext();
	for (const line of fanSamples) {
		assert.equal(context.terminal_filter_category(line), 'fan', line);
	}
	for (const line of [...vocSamples, 'VOCINLET:0', 'VOCOUTLET:0.0']) {
		assert.equal(context.terminal_filter_category(line), 'voc', line);
	}
});

test('keeps acknowledgements, commands, warnings, errors and ambiguous text visible', () => {
	const {context} = makeContext();
	for (const line of [
		'ok', 'ok 42', 'G28', 'G1 Z10 F60', 'M106 S255', 'M1050',
		'M105 S1', 'M105 T0 unexpected', 'Help: use M105 to read temperatures',
		'Error: M105 failed', '!! Fan sensor error', 'Warning: VOC sensor disconnected',
		'echo: CaseFanRPM 1619.19 error', 'VOCINLET:99.74 warning',
		temperature + ' error', temperature + ' FORCE:123',
		'>CHAMBER:30.3 /0.0', '>VOCINLET:99.74', 'echo: echo: CaseFanRPM 1600',
		'UnknownFanRPM 1600', 'FAN RPM 1600', 'VOCUNKNOWN:99.74', 'UNKNOWN:30 /40'
	]) {
		assert.equal(context.terminal_filter_category(line), null, line);
		assert.equal(context.terminal_should_hide(line, defaults), false, line);
	}
});

test('keeps malformed, failed and incomplete sensor readings visible', () => {
	const {context} = makeContext();
	for (const line of [
		'echo: UVLedFanRPM', 'echo: UVLedFanRPM NaN', 'echo: CaseFanRPM Infinity',
		'echo: CaseFanRPM 123abc', 'echo: PTCFanRPM -100',
		'VOCINLET:', 'VOCINLET:NaN', 'VOCOUTLET:Infinity', 'VOCINLET:99.7bad',
		'VOCOUTLET:-1', 'RESIN:34.9', 'RESIN:NaN /35.0', 'RESIN:34.9 /',
		'RESIN:34.9 /35.0 VAT:'
	]) {
		assert.equal(context.terminal_filter_category(line), null, line);
		assert.equal(context.terminal_should_hide(line, defaults), false, line);
	}
});

test('all eight filter combinations suppress only their selected categories', () => {
	const {context} = makeContext();
	for (const filters of filterCombinations()) {
		for (const line of ['M105', temperature]) {
			assert.equal(context.terminal_should_hide(line, filters), filters.m105);
		}
		for (const line of fanSamples) {
			assert.equal(context.terminal_should_hide(line, filters), filters.fan);
		}
		for (const line of vocSamples) {
			assert.equal(context.terminal_should_hide(line, filters), filters.voc);
		}
		assert.equal(context.terminal_should_hide('G1 Z10 F60', filters), false);
		assert.equal(context.terminal_should_hide('ok', filters), false);
	}
});

test('hides a multiline record only when every nonblank line is selected telemetry', () => {
	const {context} = makeContext();
	for (const filters of filterCombinations()) {
		assert.equal(
			context.terminal_should_hide('M105\r\n' + temperature, filters),
			filters.m105
		);
		assert.equal(
			context.terminal_should_hide(temperature + '\n' + fanSamples[0], filters),
			filters.m105 && filters.fan
		);
		assert.equal(
			context.terminal_should_hide('\n' + temperature + '\r\n' + fanSamples[0] + '\n' + vocSamples[0] + '\n', filters),
			filters.m105 && filters.fan && filters.voc
		);
		for (const significantLine of ['G28', 'ok', 'Error: sensor failed', '>CHAMBER:30.3 /0.0']) {
			assert.equal(
				context.terminal_should_hide(fanSamples[0] + '\n' + significantLine + '\n' + vocSamples[0], filters),
				false,
				significantLine
			);
		}
	}
	assert.equal(context.terminal_should_hide(' \r\n\t\n', defaults), false);
	assert.equal(context.terminal_should_hide('  \n' + fanSamples[0] + '\n\t', defaults), true);
});

test('restores every saved boolean combination, including explicit false values', () => {
	for (const filters of filterCombinations()) {
		const {context, reads} = makeContext(JSON.stringify(filters));
		context.terminal_filters_load();
		assert.deepEqual({...context.terminal_display_filters}, filters);
		assert.deepEqual(reads, [context.TERMINAL_FILTERS_KEY]);
	}
});

test('uses defaults for missing or invalid preferences without losing valid false values', () => {
	for (const saved of [null, '', '{invalid', 'null', '{}', '[]', 'false', '42', '"invalid"']) {
		const {context} = makeContext(saved);
		context.terminal_display_filters = {m105: false, fan: false, voc: false};
		context.terminal_filters_load();
		assert.deepEqual({...context.terminal_display_filters}, defaults, String(saved));
	}
	const {context} = makeContext(JSON.stringify({m105: false, fan: 'false', voc: 0, unrelated: true}));
	context.terminal_filters_load();
	assert.deepEqual({...context.terminal_display_filters}, {m105: false, fan: true, voc: true});
});

test('storage failure leaves usable default filters', () => {
	const {context} = makeContext(null, true);
	assert.doesNotThrow(() => context.terminal_filters_load());
	assert.deepEqual({...context.terminal_display_filters}, defaults);
});
