// Plotly-style "nice" tick step selection: picks a round step (1/2/5 x 10^n)
// that yields roughly 5-8 ticks across the data range, matching the axis
// look of the original Plotly charts instead of Recharts' default ticker.
export function niceTicks(min: number, max: number): { domain: [number, number]; ticks: number[] } {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const roughStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let step: number;
  if (residual > 5) step = 10 * magnitude;
  else if (residual > 2) step = 5 * magnitude;
  else if (residual > 1) step = 2 * magnitude;
  else step = magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + step / 2; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return { domain: [niceMin, niceMax], ticks };
}

export const DAY_TICKS = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
