const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/preview.js'), 'utf8');
const helpers = source.slice(0, source.indexOf('\nfunction preview_layer_unavailable('));
assert.ok(helpers.includes('function preview_physical_ratio('));

function context(extra = {}) {
	const value = {...extra};
	vm.runInNewContext(helpers, value);
	return value;
}

const config12k = Object.freeze({ProjectorWidth:11520, ProjectorHeight:5120, XYRes:19, YRes:24});
const config16k = Object.freeze({ProjectorWidth:15136, ProjectorHeight:6230, XYRes:14, YRes:19});
const config8k = Object.freeze({ProjectorWidth:7680, ProjectorHeight:4320, XYRes:28.5, YRes:28.5});

function near(actual, expected) {
	assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
}

test('uses physical width/height including rectangular pixel pitch', () => {
	const api = context();
	near(api.preview_physical_ratio(config12k), 218.88 / 122.88);
	near(api.preview_physical_ratio(config16k), 211.904 / 118.37);
	near(api.preview_physical_ratio(config8k), 16 / 9);
	assert.notEqual(api.preview_physical_ratio(config16k), 15136 / 6230);
});

test('supports optional shared X/Y resolution and rejects invalid geometry', () => {
	const api = context();
	for (const y of [undefined, null, '', 0, '0']) {
		near(api.preview_physical_ratio({...config8k, YRes:y}), 16 / 9);
	}
	near(api.preview_physical_ratio({ProjectorWidth:'11520', ProjectorHeight:'5120', XYRes:'19', YRes:'24'}), 1.78125);
	for (const config of [null, {}, {...config12k, ProjectorWidth:0}, {...config12k, ProjectorHeight:-1}, {...config12k, XYRes:'bad'}, {...config12k, YRes:'bad'}, {...config12k, YRes:-24}, {...config12k, ProjectorWidth:Infinity}]) {
		assert.equal(api.preview_physical_ratio(config), null);
	}
});

test('fits within both bounds at the physical ratio for wide and tall frames', () => {
	const api = context();
	const ratio = api.preview_physical_ratio(config12k);
	for (const [w,h] of [[420,260],[390,180],[300,100],[200,400]]) {
		const size = api.preview_fit_dimensions(w,h,ratio);
		assert.ok(size.width <= w && size.height <= h);
		near(size.width / size.height, ratio);
		assert.ok(size.width === w || Math.abs(size.height - h) < 1e-9);
	}
	for (const values of [[0,100,ratio],[100,0,ratio],[100,100,null],[100,100,NaN],[-1,100,ratio]]) {
		assert.equal(api.preview_fit_dimensions(...values),null);
	}
});

test('full, half-width, RGB-packed and synthetic eighth-width rasters use the same physical box', () => {
	const api = context();
	// 3840x5120 is observed in a real 11520x5120 NanoDLP archive.
	// 7568x6230 and 15136x6230 are observed in two real 16K archives.
	// The /8 sizes deliberately test the reported encoding without claiming
	// that an actual /8 archive has been captured.
	for (const [config, widths] of [[config12k,[11520,3840,1440]], [config16k,[15136,7568,1892]]]) {
		const ratio = api.preview_physical_ratio(config);
		const expected = api.preview_fit_dimensions(420,260,ratio);
		for (const width of widths) {
			const image = {style:{}, naturalWidth:width, naturalHeight:config.ProjectorHeight, src:'unchanged.png'};
			const size = api.preview_apply_physical_size(image,420,260,ratio);
			near(size.width,expected.width);
			near(size.height,expected.height);
			assert.equal(image.style.objectFit,'fill');
			assert.equal(image.style.width,expected.width+'px');
			assert.equal(image.style.height,expected.height+'px');
			assert.equal(image.src,'unchanged.png');
			assert.equal(image.naturalWidth,width);
		}
	}
});

test('dashboard status sizing selects only the layer image and leaves 3D rendering alone', () => {
	const layer={style:{}, src:'layer.png'};
	const three={style:{objectFit:'contain',width:'100%',height:'100%'},src:'3d.png'};
	const box={clientWidth:420,clientHeight:260};
	const selectors=[];
	const frame={querySelector(selector){selectors.push(selector);return selector==='.image_enlarge'?box:selector==='img.two'?layer:three;}};
	const api=context({document:{getElementById:id=>id==='image_wrapper'?frame:null}});
	api.preview_physical_ratio_value=api.preview_physical_ratio(config12k);
	api.preview_status_image_resize();
	assert.deepEqual(selectors,['.image_enlarge','img.two']);
	near(parseFloat(layer.style.width)/parseFloat(layer.style.height),1.78125);
	assert.deepEqual(three,{style:{objectFit:'contain',width:'100%',height:'100%'},src:'3d.png'});
});

test('hidden status frames wait for measurable bounds without corrupting image styles', () => {
	const image={style:{objectFit:'contain'}};
	const api=context();
	assert.equal(api.preview_apply_physical_size(image,0,0,1.78125),null);
	assert.deepEqual(image.style,{objectFit:'contain'});
	assert.equal(api.preview_apply_physical_size(image,420,260,null),null);
	assert.deepEqual(image.style,{objectFit:'contain'});
});

test('full preview and dashboard share one read-only geometry request', () => {
	const requests=[];
	const callbacks=[];
	const request={done(callback){callbacks.push(callback);return request;},fail(){return request;}};
	const api=context({$:{getJSON(url){requests.push(url);return request;}}});
	const received=[];
	api.preview_load_physical_ratio(ratio=>received.push(ratio));
	api.preview_load_physical_ratio(ratio=>received.push(ratio));
	assert.deepEqual(requests,['/json/db/machine.json']);
	callbacks.forEach(callback=>callback(config12k));
	assert.deepEqual(received,[1.78125,1.78125]);
});

test('failed geometry reads can recover without issuing requests every frame', () => {
	let now=1000;
	const requests=[];
	function makeRequest(){
		const item={doneCallbacks:[],failCallbacks:[],done(callback){this.doneCallbacks.push(callback);return this;},fail(callback){this.failCallbacks.push(callback);return this;}};
		requests.push(item);
		return item;
	}
	const api=context({Date:{now:()=>now},$:{getJSON:makeRequest}});
	const received=[];
	api.preview_load_physical_ratio(value=>received.push(value));
	requests[0].failCallbacks.forEach(callback=>callback());
	for(let i=0;i<100;i++) api.preview_load_physical_ratio(value=>received.push(value));
	assert.equal(requests.length,1);
	assert.equal(api.preview_physical_ratio_value,null);
	now+=30000;
	api.preview_load_physical_ratio(value=>received.push(value));
	assert.equal(requests.length,2);
	requests[1].doneCallbacks.forEach(callback=>callback(config12k));
	assert.deepEqual(received,[1.78125]);
});
