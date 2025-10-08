import pandas as pd
import numpy as np
from datetime import datetime
import os
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

try:
    from statsmodels.tsa.arima.model import ARIMA
    STATSMODELS_AVAILABLE = True
    IMPORT_ERROR = None
except ImportError as e:
    STATSMODELS_AVAILABLE = False
    IMPORT_ERROR = str(e)

class GroundwaterForecastView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Extract payload data
        method = request.data.get('method')
        forecast_type = request.data.get('forecast_type')
        target_years = request.data.get('target_years')
        timeseries_yearly_csv_filename = request.data.get('timeseries_yearly_csv_filename')

        # Validate required fields
        if not all([method, forecast_type, target_years, timeseries_yearly_csv_filename]):
            return Response(
                {"success": False, "message": "Missing required fields: method, forecast_type, target_years, or timeseries_yearly_csv_filename"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if method not in ['linear_regression', 'arima']:
            return Response(
                {"success": False, "message": "method must be 'linear_regression' or 'arima'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if forecast_type not in ['single', 'range']:
            return Response(
                {"success": False, "message": "forecast_type must be 'single' or 'range'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(target_years, list):
            return Response(
                {"success": False, "message": "target_years must be a list of years"},
                status=status.HTTP_400_BAD_REQUEST
            )

        for year in target_years:
            if not isinstance(year, int) or year <= 1900 or year > 2099:
                return Response(
                    {"success": False, "message": "All target_years must be integers between 1900 and 2099"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            # Fetch CSV from media/temp/
            csv_path = os.path.join('media', 'temp', timeseries_yearly_csv_filename)
            if not os.path.exists(csv_path):
                return Response(
                    {"success": False, "message": f"CSV file not found at {csv_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            df = pd.read_csv(csv_path)
            if df.empty:
                return Response(
                    {"success": False, "message": "CSV file is empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Auto-detect year columns from CSV
            year_columns, available_years = self.detect_year_columns(df)
            if not year_columns:
                return Response(
                    {"success": False, "message": "No valid year columns found in CSV. Year columns should be 4-digit numbers (e.g., 2011, 2012, etc.)"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate required base columns
            required_base_columns = ['village']
            missing_columns = [col for col in required_base_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {"success": False, "message": f"Missing required columns in CSV: {', '.join(missing_columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate target years
            max_available_year = max(available_years)
            invalid_targets = [year for year in target_years if year <= max_available_year]
            if invalid_targets:
                return Response(
                    {"success": False, "message": f"Target years must be greater than the latest available year ({max_available_year}). Invalid years: {invalid_targets}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Perform forecasting
            results = []
            use_arima = method == 'arima' and STATSMODELS_AVAILABLE
            
            for _, row in df.iterrows():
                try:
                    ts_data = self.extract_time_series(row, year_columns, available_years)
                    if ts_data.empty or ts_data.isnull().all() or len(ts_data) < 3:
                        continue

                    forecast_result = self.arima_forecast(ts_data, target_years) if use_arima else self.linear_forecast(ts_data, target_years)
                    if forecast_result is None:
                        continue

                    village_result = {
                        "village_info": {
                            "village": str(row['village']),
                            "vlcode": str(row.get('vlcode', '')) if pd.notnull(row.get('vlcode')) else None,
                            "gram_panch": str(row.get('gram_panch', '')) if pd.notnull(row.get('gram_panch')) else None,
                            "block": str(row.get('block', '')) if pd.notnull(row.get('block')) else None,
                            "district": str(row.get('district', '')) if pd.notnull(row.get('district')) else None,
                            "state": str(row.get('state_name', '')) if pd.notnull(row.get('state_name')) else None,
                        },
                        "historical_data": {
                            "years": ts_data.index.year.tolist(),
                            "values": ts_data.values.tolist(),
                            "data_points": len(ts_data)
                        },
                        "forecast_data": forecast_result["forecast_data"],
                        "model_summary": forecast_result["model_summary"]
                    }
                    results.append(village_result)

                except Exception as e:
                    print(f"Error processing village {row.get('village', 'unknown')}: {str(e)}")
                    continue

            if not results:
                return Response(
                    {"success": False, "message": "No villages have sufficient valid data for forecasting (minimum 3 data points required)"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            response_data = {
                "success": True,
                "message": f"{'ARIMA' if use_arima else 'Linear Regression'} forecast generated for {len(results)} villages",
                "parameters": {
                    "method": "ARIMA" if use_arima else "Linear Regression",
                    "forecast_type": forecast_type,
                    "target_years": target_years,
                    "timeseries_yearly_csv_filename": timeseries_yearly_csv_filename,
                    "available_years": available_years,
                    "year_range": f"{min(available_years)}-{max(available_years)}"
                },
                "total_villages_processed": len(results),
                "villages": results
            }
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"success": False, "message": f"Error generating forecast: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def detect_year_columns(self, df):
        """Auto-detect year columns from CSV headers"""
        year_columns = []
        available_years = []
        
        # Pattern to match 4-digit years
        year_pattern = re.compile(r'^\d{4}$')
        
        for col in df.columns:
            col_str = str(col).strip()
            if year_pattern.match(col_str):
                try:
                    year = int(col_str)
                    if 1900 <= year <= 2099:  # Reasonable year range
                        year_columns.append(col)
                        available_years.append(year)
                except ValueError:
                    continue
        
        # Sort by year
        if available_years:
            sorted_pairs = sorted(zip(available_years, year_columns))
            available_years = [pair[0] for pair in sorted_pairs]
            year_columns = [pair[1] for pair in sorted_pairs]
        
        return year_columns, available_years

    def extract_time_series(self, row, year_columns, available_years):
        """Extract yearly time series data from CSV row"""
        values = [row.get(col, np.nan) for col in year_columns]
        ts = pd.Series(values, index=pd.to_datetime(available_years, format='%Y'))
        return ts.dropna()

    def arima_forecast(self, ts_data, target_years):
        try:
            max_year = max(target_years)
            last_data_year = ts_data.index[-1].year
            steps_needed = max_year - last_data_year
            if steps_needed <= 0:
                return None

            arima_orders = [(1,1,1), (0,1,1), (1,0,1), (0,1,0), (1,1,0), (2,1,1), (1,1,2)]
            model_fit, best_order = None, None

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
            forecast_conf_int = model_fit.get_forecast(steps=steps_needed).conf_int()
            forecast_years_all = list(range(last_data_year + 1, last_data_year + steps_needed + 1))

            filtered_years, filtered_values, filtered_lower, filtered_upper = [], [], [], []
            for target_year in target_years:
                if target_year in forecast_years_all:
                    index = forecast_years_all.index(target_year)
                    filtered_years.append(target_year)
                    filtered_values.append(float(forecast.iloc[index]) if hasattr(forecast, 'iloc') else float(forecast[index]))
                    filtered_lower.append(float(forecast_conf_int.iloc[index, 0]) if hasattr(forecast_conf_int, 'iloc') else float(forecast_conf_int[index, 0]))
                    filtered_upper.append(float(forecast_conf_int.iloc[index, 1]) if hasattr(forecast_conf_int, 'iloc') else float(forecast_conf_int[index, 1]))

            forecast_data = {
                "years": filtered_years,
                "values": filtered_values,
                "confidence_interval": {
                    "lower": filtered_lower,
                    "upper": filtered_upper
                }
            } if len(target_years) > 1 else {
                "year": filtered_years[0] if filtered_years else None,
                "value": filtered_values[0] if filtered_values else None,
                "confidence_interval": {
                    "lower": filtered_lower[0] if filtered_lower else None,
                    "upper": filtered_upper[0] if filtered_upper else None
                } if filtered_lower and filtered_upper else None
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

        except Exception as e:
            print(f"ARIMA forecast error: {str(e)}")
            return None

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
            } if len(target_years) > 1 else {
                "year": filtered_years[0] if filtered_years else None,
                "value": filtered_values[0] if filtered_values else None,
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

        except Exception as e:
            print(f"Linear forecast error: {str(e)}")
            return None