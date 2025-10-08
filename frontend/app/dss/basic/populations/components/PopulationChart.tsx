//app\dss\basic\populations\components\PopulationChart.tsx
'use client'

import { Line, Bar } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  LineElement, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  Tooltip, 
  Legend,
  BarElement
} from "chart.js";
import { useMemo } from "react";

// Register Chart.js components
ChartJS.register(
  LineElement, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  Tooltip, 
  Legend,
  BarElement
);

interface PopulationChartProps {
  results: any;
  intermediateYear?: number | null; // Add intermediateYear prop
}

const processData = (results: any, intermediateYear?: number | null) => {
  if (!results) return { labels: [], datasets: [] };

  const allYears = new Set<number>();
  const models = Object.keys(results);

  // Collect all years from all models
  models.forEach((model) => {
    Object.keys(results[model]).forEach((year) => {
      const yearNum = Number(year);
      if (!isNaN(yearNum)) {
        allYears.add(yearNum);
      }
    });
  });

 // Sort years chronologically
 const allYearsArray = Array.from(allYears).sort((a, b) => a - b);
  
 let yearsArray: number[];
 
 // If we have only one year, keep it as is
 if (allYearsArray.length === 1) {
   yearsArray = allYearsArray;
 } 
 // If we have more than one year, apply 5-year gap filtering
 else if (allYearsArray.length > 1) {
   const firstYear = allYearsArray[0];
   yearsArray = allYearsArray.filter(year => (year - firstYear) % 5 === 0);
   
   // Ensure we always include the last year if it's not already included
   const lastYear = allYearsArray[allYearsArray.length - 1];
   if (!yearsArray.includes(lastYear)) {
     yearsArray.push(lastYear);
   }
   // Ensure intermediate year is included if provided
   if (intermediateYear && !yearsArray.includes(intermediateYear)) {
     yearsArray.push(intermediateYear);
     yearsArray.sort((a, b) => a - b); // Re-sort after adding
   }
 } else {
   yearsArray = allYearsArray;
 }

 return {
  labels: yearsArray.map(String), // X-axis labels (years)
  datasets: models.map((model, index) => {
    const colors = ["#FF0000", "#0000FF", "#00FF00", "#FFFF00", "#800080", "#FFA500"];
    const baseColor = colors[index % 6];
    
    return {
      label: model,
      data: yearsArray.map(year => results[model][year] || null),
      borderColor: baseColor,
      backgroundColor: yearsArray.length <= 2 
        ? `${baseColor}B3` // 70% opacity for bar charts
        : "rgba(0, 0, 0, 0)", // Transparent fill for line chart
      tension: 0.4, // Smooth curve
      fill: false, // Don't fill area under line
      borderWidth: 3, // Standard line weight
      pointRadius: 4, // Standard point size for all years
      pointBackgroundColor: baseColor,
      pointBorderColor: baseColor,
      pointBorderWidth: 1 // Standard border width for all points

    };
  })
};
};

const PopulationChart = ({ results, intermediateYear }: PopulationChartProps) => {
  const chartData = useMemo(() => processData(results, intermediateYear), [results, intermediateYear]);
  
  // Check if we have only two years or few data points
  const hasOnlyTwoYears = chartData.labels.length <= 2;

  const options = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      right: 10,
      left: 10,
      top: 10,
      bottom: 10
    }
  },
  scales: {
    x: { 
      title: { 
        display: true, 
        text: "Year" 
      },
      ticks: {
        maxRotation: 45,
        minRotation: 0
      },
      grid: {
        color: (context: any) => {
          if (context.tick && typeof context.tick.value === 'number') {
            const year = chartData.labels[context.tick.value];
            if (intermediateYear && parseInt(year) === intermediateYear) {
              return '#FF0000'; // Red color for intermediate year grid line
            }
          }
          return 'rgba(0, 0, 0, 0.1)'; // Default grid color
        },
        lineWidth: (context: any) => {
          if (context.tick && typeof context.tick.value === 'number') {
            const year = chartData.labels[context.tick.value];
            if (intermediateYear && parseInt(year) === intermediateYear) {
              return 3; // Thicker line for intermediate year
            }
          }
          return 1; // Default line width
        }
      }
    },
    y: { 
      title: { 
        display: true, 
        text: "Population" 
      },
      beginAtZero: false
    }
  },
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (context: any) => {
          const year = context[0].label;
          if (intermediateYear && parseInt(year) === intermediateYear) {
            return `${year} (Intermediate Year)`;
          }
          return year;
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  }
};

  return (
    <div className="mt-6 w-full">
      <h2 className="text-lg font-semibold mb-1">
        Population {hasOnlyTwoYears ? "Comparison" : "Projection"}
      </h2>
      <div style={{ height: "440px", width: "100%" }}>
        {hasOnlyTwoYears ? (
          <Bar data={chartData} options={options} />
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
      {intermediateYear && chartData.labels.includes(intermediateYear.toString()) && (
        <div className="mt-4 text-center">
          <span className="text-sm font-medium text-white bg-blue-500 px-3 py-1 rounded">
            Intermediate Year: {intermediateYear}
          </span>
        </div>
      )}
    </div>
  );
};

export default PopulationChart;