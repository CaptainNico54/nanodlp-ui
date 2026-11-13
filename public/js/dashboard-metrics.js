// Dashboard-only selection and presentation. Full analytics data is unchanged.
var C3DDashboardMetrics = (function () {
    'use strict';
    var STORAGE_KEY = 'c3d-dashboard-metrics:v1';
    var LEGEND_KEY = 'dashboard-metrics:v1';
    var MAX_METRICS = 5;
    var DEFAULT_KEYS = ['Pressure', 'TemperatureInside', 'LayerHeight'];
    // Ordered axis metadata from the former dashboard template. Field IDs and
    // label overrides are read from the shared ALL_CHART_CONFIG below.
    var AXES = [
        {Key:'LayerHeight', Name:'Layer Height', Type:'mm', Decimal:2},
        {Key:'SolidArea', Name:'Solid Area', Type:'px', Decimal:0},
        {Key:'AreaCount', Name:'Area Count', Type:'#', Decimal:0},
        {Key:'LargestArea', Name:'Largest Area', Type:'px', Decimal:0},
        {Key:'Speed', Name:'Speed', Type:'mm/s', Decimal:0},
        {Key:'Cure', Name:'Cure Time', Type:'s', Decimal:2},
        {Key:'Pressure', Name:'Pressure', Type:'Pressure', Decimal:2},
        {Key:'TemperatureInside', Name:'Resin Temp', Type:'°C', Decimal:2},
        {Key:'TemperatureOutside', Name:'UV Temp', Type:'°C', Decimal:2},
        {Key:'LayerTime', Name:'Layer Time', Type:'s', Decimal:2},
        {Key:'LiftHeight', Name:'Lift Height', Type:'mm', Decimal:2},
        {Key:'TemperatureMCU', Name:'MCU Temp', Type:'°C', Decimal:2},
        {Key:'TemperatureInsideTarget', Name:'Resin Temp Target', Type:'°C', Decimal:2},
        {Key:'TemperatureOutsideTarget', Name:'UV Temp Target', Type:'°C', Decimal:2},
        {Key:'TemperatureMCUTarget', Name:'MCU Temp Target', Type:'°C', Decimal:2},
        {Key:'MCUFanRPM', Name:'MCU Fan RPM', Type:'RPM', Decimal:0},
        {Key:'UVFanRPM', Name:'UV Fan RPM', Type:'RPM', Decimal:0},
        {Key:'DynamicWait', Name:'Dynamic Wait Time', Type:'s', Decimal:2},
        {Key:'TemperatureVat', Name:'VAT Temp', Type:'°C', Decimal:2},
        {Key:'TemperatureVatTarget', Name:'VAT Temp Target', Type:'°C', Decimal:2},
        {Key:'PTCFanRPM', Name:'PTC Fan RPM', Type:'RPM', Decimal:0},
        {Key:'AEGISFanRPM', Name:'AEGIS Fan RPM', Type:'RPM', Decimal:0},
        {Key:'TemperatureChamber', Name:'Chamber Temp', Type:'°C', Decimal:2},
        {Key:'TemperatureChamberTarget', Name:'Chamber Temp Target', Type:'°C', Decimal:2},
        {Key:'TemperaturePTC', Name:'PTC Temp', Type:'°C', Decimal:2},
        {Key:'TemperaturePTCTarget', Name:'PTC Temp Target', Type:'°C', Decimal:2},
        {Key:'VOCInlet', Name:'VOC Index Inlet', Type:'VOC', Decimal:0},
        {Key:'VOCOutlet', Name:'VOC Index Outlet', Type:'VOC', Decimal:0},
    ];

    function normalizeSelection(value) {
        if (!Array.isArray(value)) return DEFAULT_KEYS.slice();
        var selected = value.filter(function (key, index) {
            return AXES.some(function (axis) { return axis.Key === key; }) && value.indexOf(key) === index;
        }).slice(0, MAX_METRICS);
        return selected.length ? selected : DEFAULT_KEYS.slice();
    }

    function loadSelection(storage) {
        try { return normalizeSelection(JSON.parse(storage.getItem(STORAGE_KEY))); }
        catch (error) { return DEFAULT_KEYS.slice(); }
    }

    function saveSelection(storage, selected) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSelection(selected))); return true; }
        catch (error) { return false; }
    }

    function options(allFields) {
        return allFields.map(function (field) {
            var axis = AXES.find(function (item) { return item.Key === field.key; });
            if (!axis) return null;
            return {
                key: field.key,
                id: field.id,
                label: field.overrideLabel || axis.Name,
                scale: axis.Type,
                unit: field.overrideUnit !== undefined ? field.overrideUnit : axis.Type,
                group: axis.Type === '°C' ? 'Temperatures' : axis.Type === 'RPM' ? 'Fan speeds' : axis.Type === 'VOC' ? 'Air quality' : 'Print and motion',
            };
        }).filter(Boolean);
    }

    function availableKeys(data, allFields) {
        var ids = new Set();
        if (Array.isArray(data)) data.forEach(function (row) {
            if (row && row.ID && typeof row.V === 'number' && Number.isFinite(row.V)) ids.add(row.T);
        });
        return allFields.filter(function (field) { return ids.has(field.id); }).map(function (field) { return field.key; });
    }

    function chartConfig(selected, allFields, available) {
        var keys = normalizeSelection(selected);
        var metrics = options(allFields).filter(function (metric) {
            return keys.indexOf(metric.key) !== -1 && (!available || available.indexOf(metric.key) !== -1);
        });
        var scales = [];
        ['Pressure', '°C'].forEach(function (scale) {
            if (metrics.some(function (metric) { return metric.scale === scale; })) scales.push(scale);
        });
        metrics.forEach(function (metric) {
            if (scales.indexOf(metric.scale) === -1) scales.push(metric.scale);
        });
        return {
            uplotId: '#uplot-1',
            legendStorageKey: LEGEND_KEY,
            height: 250,
            fitParent: true,
            reserveSiblingSpace: true,
            desktopAxisScales: scales.slice(0, 3),
            mobileAxisScales: scales.slice(0, 2),
            minimumScaleSpans: {Pressure: 200, '°C': 2.0},
            fixedScaleRanges: {VOC: [0, 100]},
            roundedRpmScale: metrics.some(function (metric) { return metric.scale === 'RPM'; }),
            fields: allFields.filter(function (field) { return keys.indexOf(field.key) !== -1; }).map(function (field) { return Object.assign({}, field); }),
        };
    }

    function clearDashboardLegend(storage) {
        if (typeof resetLegendPreferences === 'function') resetLegendPreferences(LEGEND_KEY);
        try {
            var saved = JSON.parse(storage.getItem('legends:v3'));
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                delete saved[LEGEND_KEY];
                storage.setItem('legends:v3', JSON.stringify(saved));
            }
        } catch (error) {}
    }

    function mount(allFields, onChange) {
        var storage;
        try { storage = window.localStorage; } catch (error) {}
        var selected = loadSelection(storage);
        var $dialog = $('#dashboard-metrics-dialog').appendTo(document.body);
        var optionsElement = document.getElementById('dashboard-metric-options');
        var $apply = $('#dashboard-metrics-apply');
        var $count = $('#dashboard-metrics-count');
        var groups = {};
        options(allFields).forEach(function (metric) {
            if (!groups[metric.group]) {
                var fieldset = document.createElement('fieldset');
                fieldset.className = 'c3d-dashboard-metric-group';
                var legend = document.createElement('legend');
                legend.textContent = metric.group;
                fieldset.appendChild(legend);
                optionsElement.appendChild(fieldset);
                groups[metric.group] = fieldset;
            }
            var label = document.createElement('label');
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.value = metric.key;
            label.appendChild(input);
            var text = document.createElement('span');
            text.textContent = metric.label + (metric.unit ? ' (' + metric.unit + ')' : '');
            label.appendChild(text);
            groups[metric.group].appendChild(label);
        });
        var $inputs = $('#dashboard-metric-options input');
        function draftKeys() {
            return $inputs.filter(':checked').map(function () { return this.value; }).get();
        }
        function paintDraft(keys) {
            $inputs.each(function () { this.checked = keys.indexOf(this.value) !== -1; });
            updateCount();
        }
        function updateCount() {
            var count = draftKeys().length;
            $inputs.each(function () { this.disabled = !this.checked && count >= MAX_METRICS; });
            $apply.prop('disabled', count === 0 || count > MAX_METRICS);
            $count.text(count + ' of ' + MAX_METRICS + ' selected');
        }
        $inputs.on('change.c3dMetrics', updateCount);
        $dialog.on('show.bs.modal', function () { paintDraft(selected); });
        $('#dashboard-metrics-open').on('click.c3dMetrics', function () { $dialog.modal('show'); });
        $('#dashboard-metrics-reset').on('click.c3dMetrics', function () { paintDraft(DEFAULT_KEYS); });
        $apply.on('click.c3dMetrics', function () {
            var keys = draftKeys();
            if (!keys.length || keys.length > MAX_METRICS) return;
            selected = normalizeSelection(keys);
            var persisted = saveSelection(storage, selected);
            clearDashboardLegend(storage);
            $('#dashboard-metrics-storage-note').prop('hidden', persisted);
            onChange(selected.slice());
            $dialog.modal('hide');
        });
        return { getSelection: function () { return selected.slice(); } };
    }

    return {
        STORAGE_KEY: STORAGE_KEY, LEGEND_KEY: LEGEND_KEY,
        MAX_METRICS: MAX_METRICS, DEFAULT_KEYS: DEFAULT_KEYS, AXES: AXES,
        normalizeSelection: normalizeSelection, loadSelection: loadSelection,
        saveSelection: saveSelection, options: options, availableKeys: availableKeys,
        chartConfig: chartConfig, clearDashboardLegend: clearDashboardLegend, mount: mount,
    };
})();

if (typeof module === 'object' && module.exports) module.exports = C3DDashboardMetrics;
