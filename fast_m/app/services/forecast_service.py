# app/services/forecast_service.py
import os
import re
import numpy as np
import pandas as pd
from datetime import datetime

try:
    from statsmodels.tsa.arima.model import ARIMA
    STATSMODELS_AVAILABLE = True
    IMPORT_ERROR = None
except ImportError as e:
    STATSMODELS_AVAILABLE = False
    IMPORT_ERROR = str(e)


class ForecastService:

    def detect_year_columns(self, df):
        year_columns = []
        available_years = []
        year_pattern = re.compile(r'^\d{4}$')

        for col in df.columns:
            col_str = str(col).strip()
            if year_pattern.match(col_str):
                year = int(col_str)
                if 1900 <= year <= 2099:
                    year_columns.append(col)
                    available_years.append(year)

        if available_years:
            sorted_pairs = sorted(zip(available_years, year_columns))
            available_years = [p[0] for p in sorted_pairs]
            year_columns = [p[1] for p in sorted_pairs]

        return year_columns, available_years

    def extract_time_series(self, row, year_columns, available_years):
        values = [row.get(col, np.nan) for col in year_columns]
        ts = pd.Series(values, index=pd.to_datetime(available_years, format='%Y'))
        return ts.dropna()

    def linear_forecast(self, ts_data, target_years):
        try:
            x = np.arange(len(ts_data))
            y = ts_data.values

            slope, intercept = np.polyfit(x, y, 1)

            last_data_year = ts_data.index[-1].year
            filtered_years, filtered_values = [], []

            for target_year in target_years:
                if target_year > last_data_year:
                    years_ahead = target_year - last_data_year
                    future_x = len(ts_data) - 1 + years_ahead
                    predicted_value = slope * future_x + intercept
                    filtered_years.append(target_year)
                    filtered_values.append(float(predicted_value))

            forecast_data = {
                "years": filtered_years,
                "values": filtered_values,
                "confidence_interval": None
            }

            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

            model_summary = {
                "method": "Linear Regression",
                "slope": float(slope),
                "intercept": float(intercept),
                "r_squared": float(r_squared),
                "historical_data_points": len(ts_data)
            }

            return {"forecast_data": forecast_data, "model_summary": model_summary}

        except Exception:
            return None

    def arima_forecast(self, ts_data, target_years):
        try:
            max_year = max(target_years)
            last_data_year = ts_data.index[-1].year
            steps_needed = max_year - last_data_year

            if steps_needed <= 0:
                return None

            arima_orders = [
                (1, 1, 1), (0, 1, 1), (1, 0, 1),
                (0, 1, 0), (1, 1, 0), (2, 1, 1), (1, 1, 2)
            ]

            model_fit = None
            best_order = None

            for order in arima_orders:
                try:
                    model = ARIMA(ts_data, order=order)
                    model_fit = model.fit()
                    best_order = order
                    break
                except:
                    continue

            if model_fit is None:
                return None

            forecast = model_fit.forecast(steps=steps_needed)
            conf_int = model_fit.get_forecast(steps=steps_needed).conf_int()
            forecast_years = list(range(last_data_year + 1, last_data_year + steps_needed + 1))

            filtered_years = []
            filtered_values = []
            lower = []
            upper = []

            for y in target_years:
                if y in forecast_years:
                    idx = forecast_years.index(y)
                    filtered_years.append(y)
                    filtered_values.append(float(forecast.iloc[idx]))
                    lower.append(float(conf_int.iloc[idx, 0]))
                    upper.append(float(conf_int.iloc[idx, 1]))

            forecast_data = {
                "years": filtered_years,
                "values": filtered_values,
                "confidence_interval": {"lower": lower, "upper": upper}
            }

            model_summary = {
                "method": f"ARIMA{best_order}",
                "aic": float(model_fit.aic),
                "bic": float(model_fit.bic),
                "log_likelihood": float(model_fit.llf),
                "total_forecast_steps": steps_needed,
                "historical_data_points": len(ts_data)
            }

            return {"forecast_data": forecast_data, "model_summary": model_summary}

        except Exception:
            return None

    def process_forecast(self, method, forecast_type, target_years, csv_filename):
        csv_path = os.path.join("media", "temp", csv_filename)

        if not os.path.exists(csv_path):
            return {"success": False, "message": f"CSV not found at {csv_path}"}

        df = pd.read_csv(csv_path)
        if df.empty:
            return {"success": False, "message": "CSV empty"}

        year_columns, available_years = self.detect_year_columns(df)
        if not year_columns:
            return {"success": False, "message": "No valid year columns found"}

        max_available_year = max(available_years)
        invalid_targets = [y for y in target_years if y <= max_available_year]

        if invalid_targets:
            return {"success": False,
                    "message": f"Target years must be > {max_available_year}. Invalid: {invalid_targets}"}

        results = []
        use_arima = (method == "arima" and STATSMODELS_AVAILABLE)

        for _, row in df.iterrows():
            ts = self.extract_time_series(row, year_columns, available_years)
            if ts.empty or len(ts) < 3:
                continue

            forecast = (
                self.arima_forecast(ts, target_years)
                if use_arima else self.linear_forecast(ts, target_years)
            )
            if not forecast:
                continue

            results.append({
                "village_info": {
                    "village": str(row.get("village")),
                },
                "historical_data": {
                    "years": ts.index.year.tolist(),
                    "values": ts.values.tolist(),
                },
                "forecast_data": forecast["forecast_data"],
                "model_summary": forecast["model_summary"]
            })

        return {
            "success": True,
            "method": method,
            "available_years": available_years,
            "villages": results
        }
