const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/js/main.js', 'utf8');
const start = source.indexOf('function compareLastPrintRows(a, b){');
const end = source.indexOf('\nfunction setJobSortChips', start);
assert.notEqual(start, -1, 'last-printed comparator is present');
assert.notEqual(end, -1, 'last-printed comparator has an end marker');

const context = { $: row => ({ data: key => row[key] }) };
vm.runInNewContext(source.slice(start, end), context);

function sortRows(rows){
	return rows.slice().sort(context.compareLastPrintRows).map(row => row.id);
}

const chronological = [
	{id: 'never', sortLastprint: 0, sortId: 90},
	{id: 'five-weeks', sortLastprint: 3024000, sortId: 10},
	{id: 'ten-minutes', sortLastprint: 600, sortId: 1},
	{id: 'two-days', sortLastprint: 172800, sortId: 30},
	{id: 'five-hours', sortLastprint: 18000, sortId: 20}
];
assert.deepEqual(sortRows(chronological), [
	'ten-minutes', 'five-hours', 'two-days', 'five-weeks', 'never'
]);

const neverPrinted = [
	{id: 'never-older-id', sortLastprint: 0, sortId: 4},
	{id: 'printed', sortLastprint: 600, sortId: 2},
	{id: 'never-newer-id', sortLastprint: 0, sortId: 9}
];
assert.deepEqual(sortRows(neverPrinted), [
	'printed', 'never-newer-id', 'never-older-id'
]);

const equalPrintTimes = [
	{id: 'id-3', sortLastprint: 600, sortId: 3},
	{id: 'id-8', sortLastprint: 600, sortId: 8},
	{id: 'id-5', sortLastprint: 600, sortId: 5}
];
assert.deepEqual(sortRows(equalPrintTimes), ['id-8', 'id-5', 'id-3']);

const saved = new Map([['plates-sort', 'lastprint-desc']]);
const rendered = [];
const rows = [
	{id: 'never', sortLastprint: 0, sortId: 3, idx: 1},
	{id: 'older', sortLastprint: 18000, sortId: 2, idx: 2},
	{id: 'recent', sortLastprint: 600, sortId: 1, idx: 3}
].map(row => ({...row, getAttribute: key => key === 'data-idx' ? row.idx : null}));
const chips = ['id-desc', 'id-asc', 'name', 'lastprint-asc', 'layers-desc']
	.map(sort => ({sort, active: false}));
const list = {
	length: 1,
	children: () => ({toArray: () => rows.slice()}),
	append: row => rendered.push(row.id)
};
const sortContext = {
	localStorage: {
		getItem: key => saved.get(key) ?? null,
		setItem: (key, value) => saved.set(key, value)
	},
	$: item => {
		if (item === '#plates.c3d-job-list') return list;
		if (item === '#c3d-jobs-sort .c3d-chip') {
			return {each: callback => chips.forEach(chip => callback.call(chip))};
		}
		return {
			data: key => item[key],
			toggleClass: (name, active) => { item.active = active; }
		};
	}
};
const applyStart = source.indexOf('function applyJobSort(mode){');
const applyEnd = source.indexOf('\nfunction decorateJobsCount', applyStart);
assert.notEqual(applyStart, -1, 'job sort function is present');
assert.notEqual(applyEnd, -1, 'job sort function has an end marker');
vm.runInNewContext(source.slice(applyStart, applyEnd), sortContext);
sortContext.applyJobSort(sortContext.localStorage.getItem('plates-sort'));
assert.deepEqual(rendered, ['recent', 'older', 'never']);
assert.equal(saved.get('plates-sort'), 'lastprint-asc');
assert.equal(chips.find(chip => chip.sort === 'lastprint-asc').active, true);

rendered.length = 0;
saved.delete('plates-sort');
sortContext.applyJobSort(null);
assert.deepEqual(rendered, ['never', 'older', 'recent']);
assert.equal(chips.some(chip => chip.active), false);

console.log('Passed: chronological ages, PlateID tie-breaks, saved sort migration, and server-order reset.');
