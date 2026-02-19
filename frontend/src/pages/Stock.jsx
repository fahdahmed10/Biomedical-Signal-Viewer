import { useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import './Stock.css';

const API_BASE_CANDIDATES = ['http://localhost:8000', 'http://127.0.0.1:8001'];

async function apiFetch(path, options = {}) {
  let lastError = null;

  for (const base of API_BASE_CANDIDATES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Backend is not reachable on expected ports (8000/8001).');
}

function Stock() {
  const [catalog, setCatalog] = useState({ stock: [], currency: [], mineral: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [fileId, setFileId] = useState(null);
  const [seriesName, setSeriesName] = useState('');
  const [chartData, setChartData] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [predictionDays, setPredictionDays] = useState(10);
  const [category, setCategory] = useState('stock');
  const [period, setPeriod] = useState('2y');
  const [symbol, setSymbol] = useState('');
  const [viewMode, setViewMode] = useState('full');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const optionsForCategory = useMemo(() => catalog[category] ?? [], [catalog, category]);

  useEffect(() => {
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setError('');
      try {
        const res = await apiFetch('/stockmarket/catalog');
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to load symbols');
        }
        const result = await res.json();
        setCatalog(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, []);

  useEffect(() => {
    if (optionsForCategory.length > 0) {
      setSymbol(optionsForCategory[0].symbol);
    }
  }, [optionsForCategory]);

  const handleFetchData = async () => {
    if (!symbol) return;

    setLoading(true);
    setError('');
    setForecast(null);
    setChartData([]);
    setFileId(null);

    const formData = new FormData();
    formData.append('symbol', symbol);
    formData.append('category', category);
    formData.append('period', period);

    try {
      const res = await apiFetch('/stockmarket/fetch', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to fetch market data');
      }

      const result = await res.json();
      setFileId(result.file_id);
      setSeriesName(result.symbol);
      setChartData(result.data);
      setViewMode('full');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async () => {
    if (!fileId) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/stockmarket/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          days: predictionDays,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Prediction failed');
      }

      const result = await res.json();
      setForecast(result);
      setViewMode('focus');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadStockFile = async (file) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const acceptedExtensions = ['.csv', '.xlsx', '.xls'];
    const isSupported = acceptedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      setError('Unsupported file type. Please upload CSV, XLSX, or XLS.');
      return;
    }

    setLoading(true);
    setError('');
    setForecast(null);
    setChartData([]);
    setFileId(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/stockmarket/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to upload and parse file');
      }

      const result = await res.json();
      setFileId(result.file_id);
      setSeriesName(result.symbol || file.name);
      setChartData(result.data || []);
      setViewMode('full');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    const droppedFile = event.dataTransfer?.files?.[0];
    await uploadStockFile(droppedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleFileInputChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    await uploadStockFile(selectedFile);
    event.target.value = '';
  };

  const traces = [];
  const forecastStartDate = chartData.length ? chartData[chartData.length - 1].date : null;
  const forecastEndDate = forecast?.forecast_dates?.length
    ? forecast.forecast_dates[forecast.forecast_dates.length - 1]
    : null;

  const focusWindowSize = Math.max(120, predictionDays * 8);
  const focusStartDate = chartData.length
    ? chartData[Math.max(0, chartData.length - focusWindowSize)].date
    : null;

  if (chartData.length > 0) {
    traces.push({
      x: chartData.map((d) => d.date),
      y: chartData.map((d) => d.close),
      type: 'scatter',
      mode: 'lines',
      name: 'Historical',
      line: { color: '#2563eb', width: 2 },
    });
  }

  if (forecast) {
    const lastHistoricalPoint = chartData.length ? chartData[chartData.length - 1] : null;
    const forecastX = lastHistoricalPoint
      ? [lastHistoricalPoint.date, ...forecast.forecast_dates]
      : forecast.forecast_dates;
    const forecastY = lastHistoricalPoint
      ? [lastHistoricalPoint.close, ...forecast.forecast_values]
      : forecast.forecast_values;

    traces.push({
      x: forecastX,
      y: forecastY,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Forecast',
      line: { color: '#ef4444', dash: 'dash', width: 2.5 },
      marker: { size: 4, color: '#ef4444' },
    });
  }

  const shouldUseFocusRange = viewMode === 'focus' && focusStartDate && forecastEndDate;

  const layout = {
    title: seriesName ? `${seriesName} (${category})` : 'Select category and symbol to load real data',
    xaxis: {
      title: 'Date',
      rangeslider: { visible: true },
      rangeselector: {
        buttons: [
          { count: 1, label: '1m', step: 'month', stepmode: 'backward' },
          { count: 3, label: '3m', step: 'month', stepmode: 'backward' },
          { count: 6, label: '6m', step: 'month', stepmode: 'backward' },
          { step: 'all', label: 'All' },
        ],
      },
      range: shouldUseFocusRange ? [focusStartDate, forecastEndDate] : undefined,
    },
    yaxis: { title: 'Price' },
    hovermode: 'x unified',
    shapes: forecastStartDate
      ? [
          {
            type: 'line',
            x0: forecastStartDate,
            x1: forecastStartDate,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: '#94a3b8', dash: 'dot', width: 1.5 },
          },
        ]
      : [],
    annotations: forecastStartDate
      ? [
          {
            x: forecastStartDate,
            y: 1,
            yref: 'paper',
            text: 'Forecast starts',
            showarrow: true,
            arrowhead: 2,
            ay: -28,
          },
        ]
      : [],
  };

  return (
    <div className="stock-page">
      <div className="market-bg" aria-hidden="true">
        <div className="market-grid" />
        <div className="market-wave market-wave-1" />
        <div className="market-wave market-wave-2" />
        <span className="ticker ticker-1">AAPL ▲ +1.42%</span>
        <span className="ticker ticker-2">EUR/USD ▼ -0.23%</span>
        <span className="ticker ticker-3">GOLD ▲ +0.67%</span>
      </div>

      <div className="page-container">
        <h1>Stock Market / Trading Signals</h1>

        <div className="upload-section">
          <div
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <p>Drag & drop a CSV/XLSX file here, or click to browse</p>
          </div>

          <div className="selectors">
            <label>
              Category:
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="stock">Stock</option>
                <option value="currency">Currency</option>
                <option value="mineral">Mineral</option>
              </select>
            </label>

            <label>
              Type:
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={!optionsForCategory.length}>
                {optionsForCategory.map((option) => (
                  <option key={option.symbol} value={option.symbol}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              History:
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="6mo">6 months</option>
                <option value="1y">1 year</option>
                <option value="2y">2 years</option>
                <option value="5y">5 years</option>
                <option value="10y">10 years</option>
              </select>
            </label>

            <button onClick={handleFetchData} disabled={loading || !symbol || catalogLoading}>
              Load Real Data
            </button>
          </div>

          {fileId && (
            <div className="prediction-controls">
              <label>
                Forecast horizon:
                <select value={predictionDays} onChange={(e) => setPredictionDays(parseInt(e.target.value, 10))}>
                  <option value={5}>1 week (5 trading days)</option>
                  <option value={10}>2 weeks (10 trading days)</option>
                  <option value={20}>1 month (20 trading days)</option>
                  <option value={30}>~6 weeks (30 trading days)</option>
                  <option value={60}>~3 months (60 trading days)</option>
                </select>
              </label>
              <button onClick={handlePredict} disabled={loading || !fileId}>
                Run Prediction
              </button>
            </div>
          )}
        </div>

        {loading && <p className="loading">⏳ Loading...</p>}
        {error && <p className="error">❌ Error: {error}</p>}

        {traces.length > 0 && (
          <div className="chart-container">
            {forecast && (
              <div className="view-mode-controls">
                <button
                  className={viewMode === 'focus' ? 'active' : ''}
                  onClick={() => setViewMode('focus')}
                  type="button"
                >
                  Focus Forecast
                </button>
                <button
                  className={viewMode === 'full' ? 'active' : ''}
                  onClick={() => setViewMode('full')}
                  type="button"
                >
                  Full History
                </button>
                <span className="view-hint">Use the mini range slider under the chart for quick zoom.</span>
              </div>
            )}
            <Plot
              data={traces}
              layout={layout}
              config={{ responsive: true }}
              style={{ width: '100%', height: '500px' }}
            />
          </div>
        )}

        {!chartData.length && !loading && !error && (
          <p className="info">📊 Choose a category and type, then load real data to visualize and predict.</p>
        )}
      </div>
    </div>
  );
}

export default Stock;