const cachedDataByChart = new Map();

let uplots = [];

// Used primarily for pausing the chart auto-update on zoom
let isZoomed = false;

const LOCAL_STORAGE_KEY = "legends:v3";
// Keep current-page choices usable even if browser storage cannot be written.
const legendPreferencesByChart = new Map();

const ANALYTICS_UPDATE_INTERVAL = 1000;

const ColourValues = [
    "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000",
    "800000", "008000", "000080", "808000", "800080", "008080", "808080",
    "C00000", "00C000", "0000C0", "C0C000", "C000C0", "00C0C0", "C0C0C0",
    "400000", "004000", "000040", "404000", "400040", "004040", "404040",
    "200000", "002000", "000020", "202000", "200020", "002020", "202020",
    "600000", "006000", "000060", "606000", "600060", "006060", "606060",
    "A00000", "00A000", "0000A0", "A0A000", "A000A0", "00A0A0", "A0A0A0",
    "E00000", "00E000", "0000E0", "E0E000", "E000E0", "00E0E0", "E0E0E0",
];

// The two full charts have different sets of simultaneous series. Keep a stable
// color for each metric, with distinct hues within each chart. The community's
// green/cyan/blue/red/purple/yellow/orange suggestions are softened for the UI.
const SERIES_STYLES = {
    LayerHeight: { stroke: '#83cf76' },
    SolidArea: { stroke: '#dc81c9' },
    AreaCount: { stroke: '#e47b69' },
    LargestArea: { stroke: '#aa91d8' },
    Speed: { stroke: '#b99b70' },
    Cure: { stroke: '#67cad1' },
    Pressure: { stroke: '#e8b55b' },
    LayerTime: { stroke: '#78a6df' },
    LiftHeight: { stroke: '#6352c9' },
    DynamicWait: { stroke: '#d4cf72' },
    TemperatureInside: { stroke: '#e77e77' },
    TemperatureOutside: { stroke: '#a2e2cc' },
    TemperatureMCU: { stroke: '#ce9d64' },
    TemperatureInsideTarget: { stroke: '#e3e0c0', dash: [6, 3] },
    TemperatureOutsideTarget: { stroke: '#c0d2e3', dash: [6, 3] },
    TemperatureMCUTarget: { stroke: '#d2bce6', dash: [6, 3] },
    MCUFanRPM: { stroke: '#6464ce' },
    UVFanRPM: { stroke: '#64ce9d' },
    TemperatureVat: { stroke: '#b9ce64' },
    TemperatureVatTarget: { stroke: '#899cd2', dash: [6, 3] },
    PTCFanRPM: { stroke: '#e2b3a2' },
    AEGISFanRPM: { stroke: '#64ce64' },
    TemperatureChamber: { stroke: '#ce648e' },
    TemperatureChamberTarget: { stroke: '#c08ecc', dash: [6, 3] },
    TemperaturePTC: { stroke: '#bbe2a2' },
    TemperaturePTCTarget: { stroke: '#ce64b9', dash: [6, 3] },
    VOCInlet: { stroke: '#55c6da', width: 2 },
    VOCOutlet: { stroke: '#e7a5bc', width: 2 },
};

const ALL_CHART_CONFIG = [
    { key: 'LayerHeight', id: 0 },
    { key: 'SolidArea', id: 1 },
    { key: 'AreaCount', id: 2 },
    { key: 'LargestArea', id: 3 },
    { key: 'Speed', id: 4 },
    { key: 'Cure', id: 5 },
    { key: 'Pressure', id: 6, overrideLabel: 'Force', overrideAxisLabel: 'Force', overrideUnit: 'g' },
    { key: 'TemperatureInside', id: 7 },
    { key: 'TemperatureOutside', id: 8 },
    { key: 'LayerTime', id: 9 },
    { key: 'LiftHeight', id: 10 },
    { key: 'TemperatureMCU', id: 11 },
    { key: 'TemperatureInsideTarget', id: 12 },
    { key: 'TemperatureOutsideTarget', id: 13 },
    { key: 'TemperatureMCUTarget', id: 14 },
    { key: 'MCUFanRPM', id: 15 },
    { key: 'UVFanRPM', id: 16 },
    { key: 'DynamicWait', id: 17 },
    { key: 'TemperatureVat', id: 18 },
    { key: 'TemperatureVatTarget', id: 19 },
    { key: 'PTCFanRPM', id: 20 },
    { key: 'AEGISFanRPM', id: 21 },
    { key: 'TemperatureChamber', id: 22 },
    { key: 'TemperatureChamberTarget', id: 23 },
    { key: 'TemperaturePTC', id: 24 },
    { key: 'TemperaturePTCTarget', id: 25 },
    { key: 'VOCInlet', id: 26, overrideLabel: 'VOC Score Inlet', overrideAxisLabel: 'VOC score', overrideUnit: '' },
    { key: 'VOCOutlet', id: 27, overrideLabel: 'VOC Score Outlet', overrideAxisLabel: 'VOC score', overrideUnit: '' },
];

function isNotAllNull(subArray) {
    return subArray.some(element => element !== null);
}

function renderChart(name, dataRows, series, chartConfig) {
    const uplotId = `${chartConfig.uplotId}`;
    const $uplot = $(`${uplotId}`);

    if (dataRows.length <= 1) return;

    const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
    const mobileAxes = !!(chartConfig.mobileAxisScales && isMobile);
    const seriesKeys = series.map(serie => serie.key || '').join('|');
    let plotHeight = getPlotHeight(chartConfig);
    const containerEl = $uplot[0];
    const parentEl = containerEl ? containerEl.parentElement : null;
    // A naturally sized mobile card can grow with its legend. Fitting a fixed
    // container height there makes overflow-x:hidden create a vertical scroller.
    const fitParent = chartConfig.fitParent === true && parentEl &&
        !(isMobile && !document.body.classList.contains('c3d-printing'));
    if (fitParent) {
        const cs = getComputedStyle(parentEl);
        const pad = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0);
        const plotCs = getComputedStyle(containerEl);
        const plotMargin = parseFloat(plotCs.marginTop || 0) + parseFloat(plotCs.marginBottom || 0);
        // uPlot renders its legend inside the container, so reserve that too
        const legendEl = containerEl.querySelector('.u-legend');
        const legendH = legendEl ? legendEl.offsetHeight + 8 : 58;
        const siblingSpace = chartConfig.reserveSiblingSpace === true
            ? Array.from(parentEl.children).reduce((height, child) => {
                if (child === containerEl) return height;
                const siblingStyle = getComputedStyle(child);
                if (siblingStyle.display === 'none') return height;
                return height + child.offsetHeight + parseFloat(siblingStyle.marginTop || 0) + parseFloat(siblingStyle.marginBottom || 0);
            }, 0) : 0;
        const inner = parentEl.clientHeight - pad - plotMargin - siblingSpace;
        if (inner - legendH > 150) {
            plotHeight = Math.floor(inner - legendH - 2); // container border
        }
    }
    if (containerEl) containerEl.style.height = '';
    const axes = prepareAxis(series, chartConfig);
    let opts = {
        title: name,
        class: "my-chart",
        width: $uplot.width(),
        height: plotHeight,
        series: series,
        axes: axes,
        scales: buildScaleOptions(chartConfig),
        cursor: {
            sync: {
                key: 'chartCursorSync'
            }
        },
        hooks: {
            setSeries: [
                (plot, seriesIndex, options) => {
                    if (!options || options.show === undefined || !chartConfig.fixedScaleRanges?.VOC) return;
                    const vocAxis = plot.axes.find(axis => axis.scale === 'VOC');
                    if (!vocAxis) return;
                    const visible = plot.series.some(serie => serie.scale === 'VOC' && serie.show !== false);
                    if (vocAxis.show !== visible) {
                        vocAxis.show = visible;
                        // Axis width is part of uPlot's layout, so recalculate it.
                        const width = plot.width;
                        plot.setSize({ width: width - 1, height: plot.height });
                        plot.setSize({ width, height: plot.height });
                    }
                }
            ],
            setSelect: [
                _ => {
                    // Chart has been zoomed in
                    isZoomed = true;
                    $('#chart-paused-warning').show()
                }
            ],
            setScale: [
                (u, scale) => {
                    // hack to determine if zoom has been reset, see https://github.com/leeoniya/uPlot/issues/565
                    if (scale === 'x') {
                        const { min, max } = u.scales.x;
                        const xData = u.data[0];

                        if (min === xData[0] && max === xData[xData.length - 1]) {
                            isZoomed = false
                            $('#chart-paused-warning').hide()
                        }
                    }
                }
            ]
        }
    };

    // Dark theme: match dashboard surfaces (grid, ticks, axes, cursor)
    opts.axes = opts.axes.map(ax => ({
        ...ax,
        stroke: 'rgba(255,255,255,0.88)',
        ticks: { ...(ax.ticks || {}), stroke: 'rgba(255,255,255,0.45)', width: 1 },
        grid: { ...(ax.grid || {}), stroke: 'rgba(255,255,255,0.06)', width: 1 },
    }));
    opts.cursor = { ...opts.cursor, stroke: 'rgba(255,255,255,0.55)' };

    if (isZoomed) {
        return;
    }

    const plotToUpdate = uplots.find(plot => plot.id === uplotId);
    if (plotToUpdate && plotToUpdate.seriesKeys === seriesKeys && plotToUpdate.mobileAxes === mobileAxes) {

        // Chart already exists, update the data and return so we don't rebuilt the whole HTML
        const w = $uplot.width();
        if (plotToUpdate.uplot.width !== w || plotToUpdate.uplot.height !== plotHeight) {
            plotToUpdate.uplot.setSize({ width: w, height: plotHeight });
        }
        plotToUpdate.uplot.setData(dataRows);
        plotToUpdate.dataRows = dataRows;
        plotToUpdate.series = series;
        return;
    }

    if (plotToUpdate) plotToUpdate.uplot.destroy();
    $uplot.html('');
    opts = applyLegend(opts, chartConfig.legendStorageKey || uplotId);
    const vocAxis = opts.axes.find(axis => axis.scale === 'VOC');
    if (vocAxis) vocAxis.show = opts.series.some(serie => serie.scale === 'VOC' && serie.show !== false);
    const newUplot = new uPlot(opts, dataRows, $uplot[0]);
    if (chartConfig.collapsibleLegend) {
        const legend = $uplot[0].querySelector('.u-legend');
        if (legend) {
            const details = document.createElement('details');
            details.className = 'c3d-chart-legend';
            details.open = !window.matchMedia('(max-width: 767px)').matches;
            const summary = document.createElement('summary');
            summary.textContent = `Chart series (${series.length - 1})`;
            details.appendChild(summary);
            legend.parentNode.insertBefore(details, legend);
            details.appendChild(legend);
        }
    }

    let newUplotReference = { id: uplotId, uplot: newUplot, seriesKeys, chartConfig, mobileAxes, name, dataRows, series };
    if (plotToUpdate) {
        uplots = uplots.map(uplot => uplot.id === plotToUpdate.id ? newUplotReference : uplot)
    } else {
        // This was the initial build and we want to create the reference in the uplot list
       uplots.push(newUplotReference);
    }
    addSaveLegendHandler();
}

function readLegendPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
        return {};
    }
}

function applyLegend(opts, storageKey) {
    const savedValuesForUplotId = legendPreferencesByChart.has(storageKey)
        ? legendPreferencesByChart.get(storageKey) : readLegendPreferences()[storageKey];
    if (!Array.isArray(savedValuesForUplotId)) return opts;

    savedValuesForUplotId.forEach((element, index) => {
        if (!element || typeof element !== 'object') return;
        const matchingSeries = element.key
            ? opts.series.find(serie => serie.key === element.key)
            : opts.series[index];
        if (element.show === false && matchingSeries) matchingSeries.show = false;
    });
    return opts
}

function resetLegendPreferences(storageKey) {
    legendPreferencesByChart.set(storageKey, []);
}

function addSaveLegendHandler() {
    $(".u-legend .u-series").off('click.c3dLegend').on('click.c3dLegend', function () {
        const cacheData = readLegendPreferences();
        uplots.forEach(plot => {
            const storageKey = plot.chartConfig.legendStorageKey || plot.id;
            cacheData[storageKey] = plot.uplot.series.map(serie => ({key:serie.key, show:serie.show !== false}));
            legendPreferencesByChart.set(storageKey, cacheData[storageKey]);
        });
        try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cacheData)); } catch (error) {}
    });
}

function prepareAxis(series, chartConfig) {
    let axes = [{}];
    const mobileAxisScales = window.matchMedia && window.matchMedia('(max-width: 767px)').matches
        ? chartConfig.mobileAxisScales : null;
    const orderedSeries = chartConfig.desktopAxisScales && !mobileAxisScales
        ? chartConfig.desktopAxisScales.map(scale => series.find(serie => serie.scale === scale)).filter(Boolean)
        : series.slice(1);
    for (const serie of orderedSeries) {
        const scale = serie.scale;

        // All series remain plotted; the live legend carries values for scales
        // whose axis would leave too little room for the plot on a phone.
        if (mobileAxisScales && !mobileAxisScales.includes(scale)) continue;

        const found = axes.some(axis => axis.scale === scale);

        const decimalPlaces = determineDecimalPlaces(scale);

        if (!found && decimalPlaces !== null) {
            const config = ALL_CHART_CONFIG.find(config => config.key === serie.key);
            const label = config?.overrideAxisLabel ?? scale;
            axes.push({
                    labelSize: 16,
                    gap: 8,
                    size: scale === 'RPM' ? 72 : 62,
                    side: chartConfig.axisSides?.[scale] ?? 3,
                    grid: {show: false},
                    label,
                    scale,
                    values: (self, ticks) => ticks.map(rawValue => rawValue.toFixed(decimalPlaces)),
                }
            )
        }
    }

    if (!chartConfig.axisSides) {
        let halfOfAxisCount = parseInt(axes.length / 2) + 1;
        for (let j = halfOfAxisCount; j < axes.length; j++) {
            axes[j].side = 1;
        }
    }
    if (axes[1]) {
        axes[1].grid.show = true;
    }
    return axes;
}

function determineDecimalPlaces(scale) {
    let zeroPlaceScales = ["px", "#", "Pressure", "RPM", "VOC"];
    let onePlaceScales = ["s", "mm", "mm/s", "°C"];

    if (zeroPlaceScales.includes(scale)) {
        return 0;
    } else if (onePlaceScales.includes(scale)) {
        return 1;
    } else {
        return null;
    }
}

function aggregateFunc(v, aggregate) {
    let val = parseFloat(v / 1000000000);
    if (aggregate == 0) return val;
    return Math.round(val / aggregate) * aggregate;
}

function getSeries(axes) {
    let fmt = uPlot.fmtDate("{HH}:{mm}:{ss}");
    let series = [{value: (self, ts) => ts !== null ? fmt(new Date(ts * 1000)) : '--'}];


    axes.forEach((element, key) => {
        const config = ALL_CHART_CONFIG.find(config => config.key === element.Key);
        const style = SERIES_STYLES[element.Key] || {};
        const label = config?.overrideLabel ?? element.Name;
        const unit = config?.overrideUnit ?? element.Type;
        series.push({
            key: element.Key,
            show: true,
            // Chart-only null rows mark global recording gaps; don't let uPlot bridge them.
            spanGaps: false,
            label,
            scale: element.Type,
            value: (self, rawValue) => (rawValue != null ? rawValue.toFixed(element.Decimal) + unit : ""),
            stroke: style.stroke || ("#" + ColourValues[key] + "cc"),
            dash: style.dash,
            width: style.width || 1.5,
        });
    });
    return series;
}

function downloadCSV(series, o) {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    let p = "";
    for (j = 0; j < series.length; j++) {
        if (j == 0) {
            p += "Timestamp,";
        } else {
            p += series[j].label + ",";
        }
    }
    p += "\n\r";
    let iT = o.length;
    let jT = o[0].length
    for (j = 0; j < jT; j++) {
        for (i = 0; i < iT; i++) {
            if (o[i][j] === null) p += ",";
            else p += o[i][j] + ",";
        }
        p += "\n\r";
    }
    const blob = new Blob([p], {type: "octet/stream"}),
        url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = "nanodlp.csv";
    a.click();
    window.URL.revokeObjectURL(url);
}

const processData = (dataResponse, series) => {
    let previousAggregateValue;
    const processedData = series.map(() => []);
    let dataPointIndex = 0;

    dataResponse
        .filter(i => i['ID'])
        .forEach(responseItem => {
            const currentAggregateValue = aggregateFunc(responseItem['ID'], 0);
            if (currentAggregateValue != previousAggregateValue) {
                for (let j = 0; j < series.length; j++) {
                    processedData[j][dataPointIndex] = null;
                }
                processedData[0][dataPointIndex] = currentAggregateValue;
                previousAggregateValue = currentAggregateValue;
                dataPointIndex++;
            }

            processedData[responseItem['T'] + 1][dataPointIndex - 1] = responseItem['V'];
        })

    return processedData
}

/**
 * Iterates through a uplot dataset and backfills any null values where possible with the last non-null element for that
 * series. Avoiding null datapoints in uplot allows the legend to work better by showing less blank values.
 *
 * If no last non-null element exists, it will keep the null.
 *
 * @param data - An array of arrays of elements for the chart. All inner arrays should be equal length.
 */
const backFillData = (data) => {
    return data.map(serie => {
        // starting from index 1 because the first item won't have a previous element to pull from
        for (let serieElemIdx = 1; serieElemIdx < serie.length; serieElemIdx++) {

            const serieElem = serie[serieElemIdx];
            if (serieElem !== null) {
                continue;
            }

            serie[serieElemIdx] = serie[serieElemIdx - 1];
        }
        return serie;
    });
}

/** Add chart-only null rows at long global timestamp gaps after sparse-series backfill. */
const addChartGapMarkers = (data, maxGapSeconds = 300) => {
    if (data.length === 0 || data[0].length < 2) return data;

    const chartData = data.map(serie => serie.slice());
    for (let idx = chartData[0].length - 1; idx > 0; idx--) {
        const previousTimestamp = chartData[0][idx - 1];
        const currentTimestamp = chartData[0][idx];
        if (currentTimestamp - previousTimestamp <= maxGapSeconds) continue;

        chartData[0].splice(idx, 0, (previousTimestamp + currentTimestamp) / 2);
        for (let seriesIdx = 1; seriesIdx < chartData.length; seriesIdx++) {
            chartData[seriesIdx].splice(idx, 0, null);
        }
    }
    return chartData;
};


function buildChartFromData(name, dataResponse, exp, axes, chartConfigs) {
    if (dataResponse.length === 0) {
        return;
    }

    const series = getSeries(axes);
    const processedData = processData(dataResponse, series);
    const backFilledData = backFillData(processedData);

    const cacheKey = chartConfigs.map(config => config.uplotId).join('|');
    const serializedResponse = JSON.stringify(dataResponse);
    if (cachedDataByChart.get(cacheKey) === serializedResponse && !exp) return;
    cachedDataByChart.set(cacheKey, serializedResponse);

    if (exp) return downloadCSV(series, backFilledData);

    const chartData = addChartGapMarkers(backFilledData);

    chartConfigs.forEach(chartConfig => {
        renderSplitChart(series, chartData, chartConfig, name);
    })

}

function renderSplitChart(series, backFilledData, chartConfig, name) {
    const backFilledDataForChart = backFilledData.filter((dataSeries, idx) => idx === 0 || chartConfig.fields.some(conf => conf.id + 1 === idx))
    const dataWithoutNulls = backFilledDataForChart.filter(isNotAllNull);

    const seriesForChart = series.filter((i, idx) => idx === 0 || chartConfig.fields.some((conf) => conf.key === i.key) )
    const seriesWithoutNulls = seriesForChart.filter((_, index) => isNotAllNull(backFilledDataForChart[index]));

    renderChart(name, dataWithoutNulls, seriesWithoutNulls, chartConfig);
}

function getPlotHeight(chartConfig) {
    const configuredHeight = chartConfig && chartConfig.height;
    const desktopHeight = Number.isFinite(configuredHeight) ? configuredHeight : 420;
    return window.matchMedia && window.matchMedia('(max-width: 767px)').matches
        ? Math.min(desktopHeight, 320)
        : desktopHeight;
}

function minimumSpanRange(minimumSpan) {
    return function (_uplot, min, max) {
        if (!Number.isFinite(min) || !Number.isFinite(max) || max - min >= minimumSpan) {
            return [min, max];
        }
        const midpoint = (min + max) / 2;
        return [midpoint - minimumSpan / 2, midpoint + minimumSpan / 2];
    };
}

function buildScaleOptions(chartConfig) {
    const constraints = chartConfig.minimumScaleSpans || {};
    const scales = Object.keys(constraints).reduce((scales, scaleName) => {
        const minimumSpan = Number(constraints[scaleName]);
        if (Number.isFinite(minimumSpan) && minimumSpan > 0) {
            scales[scaleName] = { range: minimumSpanRange(minimumSpan) };
        }
        return scales;
    }, {});
    const fixedRanges = chartConfig.fixedScaleRanges || {};
    Object.keys(fixedRanges).forEach(scaleName => {
        const range = fixedRanges[scaleName];
        if (Array.isArray(range) && range.length === 2) {
            scales[scaleName] = { range: range.slice() };
        }
    });
    if (chartConfig.roundedRpmScale) {
        // uPlot supplies the maximum from the visible time window, including
        // historical points. Grow at once; only shrink after a stable interval.
        const state = chartConfig.rpmScaleState || (chartConfig.rpmScaleState = {
            ceiling: 1000, pending: null, since: 0, timer: null,
        });
        scales.RPM = { range: function (plot, _min, max) {
            const target = Math.max(1000, Math.ceil(Math.max(0, Number.isFinite(max) ? max : 0) / 1000) * 1000);
            if (target >= state.ceiling) {
                state.ceiling = target;
                state.pending = null;
                clearTimeout(state.timer);
                state.timer = null;
            } else {
                if (state.pending !== target) {
                    state.pending = target;
                    state.since = Date.now();
                    clearTimeout(state.timer);
                    state.timer = setTimeout(function () {
                        state.timer = null;
                        const current = uplots.find(entry => entry.id === chartConfig.uplotId);
                        if (current && current.uplot === plot) {
                            // Re-evaluate the visible window even when no new
                            // samples arrive after a range selection.
                            plot.setScale('RPM', { min: 0, max: state.pending });
                        }
                    }, 10000);
                } else if (Date.now() - state.since >= 10000) {
                    state.ceiling = target;
                    state.pending = null;
                    clearTimeout(state.timer);
                    state.timer = null;
                }
            }
            return [0, state.ceiling];
        } };
    }
    return scales;
}

let analyticsResizeTimer;
window.addEventListener('resize', function () {
    clearTimeout(analyticsResizeTimer);
    analyticsResizeTimer = setTimeout(function () {
        uplots.forEach(function (plot) {
            const container = document.querySelector(plot.id);
            if (!container) return;
            const mobileAxes = !!(plot.chartConfig.mobileAxisScales && window.matchMedia('(max-width: 767px)').matches);
            if (mobileAxes !== plot.mobileAxes) {
                renderChart(plot.name, plot.dataRows, plot.series, plot.chartConfig);
                return;
            }
            plot.uplot.setSize({
                width: $(container).width(),
                height: getPlotHeight(plot.chartConfig),
            });
        });
    }, 120);
});
