//frontend\app\dss\basic\populations\components\cohort.tsx
import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface CohortAgeGroup {
  male: number;
  female: number;
  total: number;
}

interface CohortData {
  year: number;
  data: {
    [ageGroup: string]: CohortAgeGroup;
  };
}

interface CohortProps {
  cohortData: CohortData[];
}

const Cohort: React.FC<CohortProps> = ({ cohortData }) => {
  // State to manage selected year for the pyramid
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Sort age groups by their numeric value for better display
  const sortAgeGroups = (ageGroups: string[]): string[] => {
    return ageGroups.sort((a, b) => {
      if (a === 'total' || b === 'total') {
        return a === 'total' ? 1 : -1; // Put total at the end
      }
      const aNum = parseInt(a.split('-')[0].replace('+', ''));
      const bNum = parseInt(b.split('-')[0].replace('+', ''));
      return aNum - bNum;
    });
  };

  // If no data is found, don't render anything
  if (!cohortData || cohortData.length === 0) {
    return null;
  }

  // Remove duplicate years
  const uniqueCohortData = cohortData.reduce((acc: CohortData[], current) => {
    const existingIndex = acc.findIndex((item) => item.year === current.year);
    if (existingIndex === -1) {
      acc.push(current);
    }
    return acc;
  }, []);

  // Sort by year
  const sortedCohortData = uniqueCohortData.sort((a, b) => a.year - b.year);

  // Set initial selected year to the first year in sortedCohortData
  if (selectedYear === null && sortedCohortData.length > 0) {
    setSelectedYear(sortedCohortData[0].year);
  }

  // Get all unique age groups across all years (excluding 'total')
  const allAgeGroups = Array.from(
    new Set(
      sortedCohortData.flatMap((data) =>
        Object.keys(data.data).filter((key) => key !== 'total')
      )
    )
  );
  const sortedAgeGroups = sortAgeGroups(allAgeGroups);

  // Add 'total' at the end if it exists
  const hasTotal = sortedCohortData.some((data) => data.data.total);
  if (hasTotal) {
    sortedAgeGroups.push('total');
  }

  // Prepare data for the age-sex pyramid (based on selected year)
  const selectedYearData = sortedCohortData.find((data) => data.year === selectedYear)?.data || {};
  const pyramidAgeGroups = sortedAgeGroups
    .filter((ageGroup) => ageGroup !== 'total')
    .reverse(); // Reverse to have youngest at bottom, oldest at top
  const maleData = pyramidAgeGroups.map((ageGroup) =>
    selectedYearData[ageGroup]?.male ? -selectedYearData[ageGroup].male : 0
  ); // Negative for left side
  const femaleData = pyramidAgeGroups.map((ageGroup) =>
    selectedYearData[ageGroup]?.female || 0
  );

  // Chart.js data configuration for the pyramid
  const pyramidChartData = {
    labels: pyramidAgeGroups,
    datasets: [
      {
        label: 'Male',
        data: maleData,
        backgroundColor: 'rgba(37, 99, 235, 0.8)', // Blue, matches table
        borderColor: 'rgba(37, 99, 235, 1)',
        borderWidth: 1,
      },
      {
        label: 'Female',
        data: femaleData,
        backgroundColor: 'rgba(236, 72, 153, 0.8)', // Pink, matches table
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Chart.js options for the pyramid - Fixed TypeScript types
  const pyramidChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Population',
          color: '#374151',
        },
        ticks: {
          callback: function(value: any) {
            return Math.abs(Number(value)).toLocaleString();
          },
          color: '#374151',
        },
        grid: {
          color: '#e5e7eb',
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Age Group',
          color: '#374151',
        },
        ticks: {
          color: '#374151',
        },
        grid: {
          display: false,
        },
        reverse: false,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#374151',
        },
      },
      title: {
        display: true,
        text: `Age-Sex Pyramid (${selectedYear || ''})`,
        color: '#1e40af',
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = Math.abs(context.raw).toLocaleString();
            return `${context.dataset.label}: ${value}`;
          },
        },
      },
    },
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl lg:text-3xl font-bold text-blue-800 mb-6">
        Cohort Analysis {sortedCohortData.length === 1 ? `(${sortedCohortData[0].year})` : ''}
      </h2>

      <div className="w-full flex flex-col xl:flex-row gap-6">
        {/* Table Container */}
        <div className="flex-1 min-w-0 overflow-hidden border border-gray-200 rounded-xl shadow-lg bg-white">
          <div className="w-full overflow-x-auto">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full min-w-max border-collapse">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 sticky top-0 z-20">
                  <tr>
                    <th className="border-b px-3 lg:px-6 py-4 text-left font-semibold text-sm sticky left-0 bg-gray-100 z-30 min-w-[120px]">
                      Age Group
                    </th>
                    {sortedCohortData.map((data, index) => (
                      <th
                        key={data.year}
                        colSpan={3}
                        className={`border-b px-3 lg:px-6 py-4 text-center font-semibold text-sm whitespace-nowrap ${
                          index < sortedCohortData.length - 1 ? 'border-r border-gray-300' : ''
                        }`}
                      >
                        {data.year}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border-b px-3 lg:px-6 py-4 text-left font-semibold text-sm sticky left-0 bg-gray-100 z-30"></th>
                    {sortedCohortData.map((data, index) => (
                      <React.Fragment key={`headers-${data.year}`}>
                        <th className="border-b px-3 lg:px-6 py-4 text-center font-semibold text-sm text-blue-600 whitespace-nowrap min-w-[80px]">
                          Male
                        </th>
                        <th className="border-b px-3 lg:px-6 py-4 text-center font-semibold text-sm text-pink-600 whitespace-nowrap min-w-[80px]">
                          Female
                        </th>
                        <th
                          className={`border-b px-3 lg:px-6 py-4 text-center font-semibold text-sm text-gray-700 whitespace-nowrap min-w-[80px] ${
                            index < sortedCohortData.length - 1 ? 'border-r border-gray-300' : ''
                          }`}
                        >
                          Total
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAgeGroups.map((ageGroup, index) => (
                    <tr
                      key={ageGroup}
                      className={`border-b hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                      } ${ageGroup === 'total' ? 'bg-blue-50 font-semibold border-t-2 border-blue-200' : ''}`}
                    >
                      <td
                        className={`border-b px-3 lg:px-6 py-4 font-medium text-gray-800 sticky left-0 z-10 whitespace-nowrap ${
                          ageGroup === 'total' ? 'bg-blue-50 font-bold text-blue-800' : 'bg-inherit'
                        }`}
                      >
                        {ageGroup === 'total' ? 'TOTAL' : ageGroup}
                      </td>
                      {sortedCohortData.map((data, dataIndex) => (
                        <React.Fragment key={`data-${data.year}-${ageGroup}`}>
                          <td
                            className={`border-b px-3 lg:px-6 py-4 text-center font-medium whitespace-nowrap ${
                              ageGroup === 'total' ? 'text-blue-700 font-bold' : 'text-blue-600'
                            }`}
                          >
                            {data.data[ageGroup]?.male?.toLocaleString() ?? '-'}
                          </td>
                          <td
                            className={`border-b px-3 lg:px-6 py-4 text-center font-medium whitespace-nowrap ${
                              ageGroup === 'total' ? 'text-pink-700 font-bold' : 'text-pink-600'
                            }`}
                          >
                            {data.data[ageGroup]?.female?.toLocaleString() ?? '-'}
                          </td>
                          <td
                            className={`border-b px-3 lg:px-6 py-4 text-center font-semibold whitespace-nowrap ${
                              ageGroup === 'total' ? 'text-gray-800 font-bold' : 'text-gray-700'
                            } ${dataIndex < sortedCohortData.length - 1 ? 'border-r border-gray-300' : ''}`}
                          >
                            {data.data[ageGroup]?.total?.toLocaleString() ?? '-'}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pyramid Chart Container */}
        <div className="w-full xl:w-1/2 xl:max-w-lg border border-gray-200 rounded-xl shadow-lg bg-white p-4">
          <div className="relative w-full">
            {/* Year Selection Dropdown */}
            <div className="absolute top-0 right-0 z-10">
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sortedCohortData.map((data) => (
                  <option key={data.year} value={data.year}>
                    {data.year}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full" style={{ height: '400px' }}>
              <Bar data={pyramidChartData} options={pyramidChartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary section for single year */}
      {sortedCohortData.length === 1 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl lg:text-2xl font-bold text-blue-600">
                {sortedCohortData[0].data.total?.male?.toLocaleString() ||
                  Object.values(sortedCohortData[0].data)
                    .filter((group) => group && typeof group.male === 'number')
                    .reduce((sum, group) => sum + (group.male || 0), 0)
                    .toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Male</div>
            </div>
            <div>
              <div className="text-xl lg:text-2xl font-bold text-pink-600">
                {sortedCohortData[0].data.total?.female?.toLocaleString() ||
                  Object.values(sortedCohortData[0].data)
                    .filter((group) => group && typeof group.female === 'number')
                    .reduce((sum, group) => sum + (group.female || 0), 0)
                    .toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Female</div>
            </div>
            <div>
              <div className="text-xl lg:text-2xl font-bold text-gray-700">
                {sortedCohortData[0].data.total?.total?.toLocaleString() ||
                  Object.values(sortedCohortData[0].data)
                    .filter((group) => group && typeof group.total === 'number')
                    .reduce((sum, group) => sum + (group.total || 0), 0)
                    .toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Population</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cohort;
