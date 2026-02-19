from typing import List

import numpy as np
from statsmodels.tsa.ar_model import AutoReg
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX


def _sarimax_returns_forecast(series: List[float], steps: int) -> List[float]:
    """
    Forecast log-returns then reconstruct prices.
    Modeling returns usually keeps short-term movement more realistic than
    direct level forecasting, which can look overly straight.
    """
    prices = np.asarray(series, dtype=float)
    if np.any(prices <= 0):
        raise ValueError("Prices must be positive for log-return modeling")

    log_returns = np.diff(np.log(prices))
    if len(log_returns) < 30:
        raise ValueError("Insufficient points for return-based SARIMAX")

    model = SARIMAX(
        log_returns,
        order=(2, 0, 2),
        trend="c",
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    model_fit = model.fit(disp=False)
    forecast_returns = np.asarray(model_fit.forecast(steps=steps), dtype=float)

    last_log_price = float(np.log(prices[-1]))
    future_log_prices = last_log_price + np.cumsum(forecast_returns)
    return np.exp(future_log_prices).tolist()


def _stochastic_ar_bootstrap_forecast(series: List[float], steps: int) -> List[float]:
    """
    Forecast log-returns with AutoReg and add bootstrapped residual shocks.
    Produces a single realistic scenario path instead of an over-smoothed mean line.
    """
    prices = np.asarray(series, dtype=float)
    if np.any(prices <= 0):
        raise ValueError("Prices must be positive for log-return modeling")

    log_returns = np.diff(np.log(prices))
    if len(log_returns) < 40:
        raise ValueError("Insufficient points for stochastic return model")

    lags = max(2, min(8, len(log_returns) // 15))
    model = AutoReg(log_returns, lags=lags, old_names=False)
    fitted = model.fit()

    residuals = np.asarray(fitted.resid, dtype=float)
    residuals = residuals[np.isfinite(residuals)]
    if residuals.size < 20:
        raise ValueError("Not enough residuals for bootstrap simulation")

    recent_residuals = residuals[-min(252, residuals.size):]
    low_q, high_q = np.quantile(log_returns, [0.01, 0.99])

    seed = int(abs(np.sum(np.round(log_returns[-60:] * 1_000_000)))) % (2**32 - 1)
    rng = np.random.default_rng(seed)

    params = np.asarray(fitted.params, dtype=float)
    intercept = params[0]
    coefs = params[1:]

    history = log_returns.tolist()
    simulated_returns = []
    for _ in range(steps):
        lag_values = np.array([history[-i] for i in range(1, lags + 1)], dtype=float)
        mean_return = float(intercept + np.dot(coefs, lag_values))
        shock = float(rng.choice(recent_residuals)) * 0.9
        next_return = float(np.clip(mean_return + shock, low_q, high_q))
        history.append(next_return)
        simulated_returns.append(next_return)

    future_log_prices = np.log(prices[-1]) + np.cumsum(np.asarray(simulated_returns, dtype=float))
    return np.exp(future_log_prices).tolist()

def _sarimax_forecast(series: List[float], steps: int) -> List[float]:
    """
    Trend-aware forecast using SARIMAX with drift.
    This generally avoids the flat-line behavior of ARIMA(5,1,0) without trend.
    """
    model = SARIMAX(
        series,
        order=(2, 1, 2),
        trend="c",
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    model_fit = model.fit(disp=False)
    return model_fit.forecast(steps=steps).tolist()


def _holt_trend_forecast(series: List[float], steps: int) -> List[float]:
    """Fallback trend model for series where SARIMAX fitting is unstable."""
    model = ExponentialSmoothing(
        series,
        trend="add",
        damped_trend=True,
        seasonal=None,
        initialization_method="estimated",
    )
    model_fit = model.fit(optimized=True)
    return model_fit.forecast(steps).tolist()


def _recent_slope_projection(series: List[float], steps: int) -> List[float]:
    """Last-resort deterministic projection based on recent linear slope."""
    window = min(30, len(series))
    y = np.asarray(series[-window:], dtype=float)
    x = np.arange(window, dtype=float)
    slope, _ = np.polyfit(x, y, 1)
    last_value = float(series[-1])
    return [last_value + slope * (i + 1) for i in range(steps)]


def forecast_series(series: List[float], steps: int = 10) -> List[float]:
    if len(series) < 30:
        raise ValueError("Insufficient data for forecasting (need at least 30 points)")

    attempts = [_sarimax_returns_forecast, _sarimax_forecast, _holt_trend_forecast, _recent_slope_projection]
    for method in attempts:
        try:
            forecast = method(series, steps)
            if len(forecast) == steps:
                return [float(v) for v in forecast]
        except Exception:
            continue

    raise ValueError("Unable to fit forecasting model for the provided data")

def predict_prices(historical_prices: List[float], days: int, model: str = "stochastic") -> List[float]:
    """
    Forecast model options:
    - stochastic: AutoReg returns + residual bootstrap (default)
    - sarimax: deterministic SARIMAX-returns path
    - trend: deterministic trend-focused fallback stack
    """
    key = (model or "stochastic").strip().lower()

    if key in {"stochastic", "stochastic_ar", "realistic"}:
        return _stochastic_ar_bootstrap_forecast(historical_prices, days)

    if key in {"sarimax", "arima"}:
        return _sarimax_returns_forecast(historical_prices, days)

    if key in {"trend", "holt"}:
        attempts = [_sarimax_forecast, _holt_trend_forecast, _recent_slope_projection]
        for method in attempts:
            try:
                forecast = method(historical_prices, days)
                if len(forecast) == days:
                    return [float(v) for v in forecast]
            except Exception:
                continue

    return forecast_series(historical_prices, days)