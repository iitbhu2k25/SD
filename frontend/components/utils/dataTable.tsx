import React, { useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Edit2, Save, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// Type definitions
interface WQIDataRow {
  Location: string;
  Year: number;
  Latitude: number;
  Longitude: number;
  pH_Level: number;
  Electrical_Conductivity: number;
  Hardness: number;
  Arsenic: number;
  Fluoride: number;
  Iron: number;
  Nitrate: number;
  Chloride: number;
  Sulfate: number;
  Calcium: number;
  Magnesium: number;
  Sodium: number;
  Potassium: number;
  Bicarbonate: number;
  Carbonate: number;
  Uranium: number;
}

interface Column {
  key: keyof WQIDataRow;
  label: string;
  width: string;
  sortable?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

interface WQIDataTableProps {
  initialData?: WQIDataRow[];
}

const WQIDataTable: React.FC<WQIDataTableProps> = ({ initialData = [] }) => {
  const [data, setData] = useState<WQIDataRow[]>(initialData);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedRow, setEditedRow] = useState<WQIDataRow | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof WQIDataRow | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
   React.useEffect(() => {
    setData(initialData);
  }, [initialData]);
  // Sort data
  const getSortedData = (): WQIDataRow[] => {
    if (!sortColumn || !sortDirection) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }

      return 0;
    });
  };

  // Handle sort
  const handleSort = (column: keyof WQIDataRow) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Get sort icon
  const getSortIcon = (column: keyof WQIDataRow) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  // Calculate pagination
  const sortedData = getSortedData();
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  // View row handler - prints to console with enhanced formatting
  const handleView = (index: number) => {
    const actualIndex = startIndex + index;
    const row = sortedData[actualIndex];

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║              ROW DETAILS - VIEW MODE                  ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║ Row Index: ${actualIndex}`);
    console.log('╠═══════════════════════════════════════════════════════╣');

    // Print each column value
    Object.entries(row).forEach(([key, value]) => {
      const displayValue = typeof value === 'number' ? value.toFixed(3) : value;
      console.log(`║ ${key.padEnd(25)}: ${displayValue}`);
    });

    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // Also log as table for easy viewing
    console.table([row]);
  };

  // Edit handlers
  const handleEdit = (index: number) => {
    const actualIndex = startIndex + index;
    setEditingIndex(actualIndex);
    setEditedRow({ ...sortedData[actualIndex] });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedRow(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editedRow) {
      // Find the original index in unsorted data
      const originalRow = sortedData[editingIndex];
      const originalIndex = data.findIndex(row =>
        row.Location === originalRow.Location &&
        row.Year === originalRow.Year &&
        row.Latitude === originalRow.Latitude
      );

      if (originalIndex !== -1) {
        const newData = [...data];
        newData[originalIndex] = editedRow;
        setData(newData);
      }

      setEditingIndex(null);
      setEditedRow(null);
    }
  };

  const formatValue = (key: keyof WQIDataRow, value: any) => {
    if (typeof value !== 'number') return value;

    // These fields MUST be integers
    const integerFields: (keyof WQIDataRow)[] = [
      'Year',
      'Latitude',
      'Longitude'
    ];

    if (integerFields.includes(key)) {
      return value.toString();
    }

    // All other numeric fields → show 3 decimals
    return value.toFixed(3);
  };

  const handleFieldChange = (field: keyof WQIDataRow, value: string) => {
    if (!editedRow) return;

    setEditedRow(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        [field]: field === 'Location'
          ? value
          : (field === 'Year' ? parseInt(value) || 0 : parseInt(value) || 0)
      };
    });
  };

  // Delete row handler
  const handleDelete = (index: number) => {
    const actualIndex = startIndex + index;
    const rowToDelete = sortedData[actualIndex];

    // Find the original index in unsorted data
    const originalIndex = data.findIndex(row =>
      row.Location === rowToDelete.Location &&
      row.Year === rowToDelete.Year &&
      row.Latitude === rowToDelete.Latitude
    );

    if (originalIndex !== -1) {
      const newData = data.filter((_, i) => i !== originalIndex);
      setData(newData);
    }

    // Cancel editing if the row being edited is deleted
    if (editingIndex === actualIndex) {
      setEditingIndex(null);
      setEditedRow(null);
    }

    // Adjust current page if necessary
    const newTotalPages = Math.ceil((sortedData.length - 1) / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  };

  // Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const columns: Column[] = [
    { key: 'Location', label: 'Location', width: 'w-40', sortable: true },
    { key: 'Year', label: 'Year', width: 'w-40', sortable: true },
    { key: 'Latitude', label: 'Lat', width: 'w-24', sortable: true },
    { key: 'Longitude', label: 'Long', width: 'w-24', sortable: true },
    { key: 'pH_Level', label: 'pH', width: 'w-20', sortable: true },
    { key: 'Electrical_Conductivity', label: 'EC', width: 'w-24', sortable: true },
    { key: 'Hardness', label: 'Hardness', width: 'w-24', sortable: true },
    { key: 'Arsenic', label: 'As', width: 'w-20', sortable: true },
    { key: 'Fluoride', label: 'F', width: 'w-20', sortable: true },
    { key: 'Iron', label: 'Fe', width: 'w-20', sortable: true },
    { key: 'Nitrate', label: 'NO₃', width: 'w-20', sortable: true },
    { key: 'Chloride', label: 'Cl', width: 'w-20', sortable: true },
    { key: 'Sulfate', label: 'SO₄', width: 'w-20', sortable: true },
    { key: 'Calcium', label: 'Ca', width: 'w-20', sortable: true },
    { key: 'Magnesium', label: 'Mg', width: 'w-20', sortable: true },
    { key: 'Sodium', label: 'Na', width: 'w-20', sortable: true },
    { key: 'Potassium', label: 'K', width: 'w-20', sortable: true },
    { key: 'Bicarbonate', label: 'HCO₃', width: 'w-24', sortable: true },
    { key: 'Carbonate', label: 'CO₃', width: 'w-20', sortable: true },
    { key: 'Uranium', label: 'U', width: 'w-20', sortable: true }
  ];

  return (
    <div className="w-full  bg-gray-50 ">
      <div className="bg-white rounded-lg shadow-lg">

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${col.width} ${col.sortable ? 'cursor-pointer hover:bg-gray-200 select-none' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center">
                      {col.label}
                      {col.sortable && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentData.length > 0 ? (
                currentData.map((row, index) => {
                  const actualIndex = startIndex + index;
                  const isEditing = editingIndex === actualIndex;

                  return (
                    <tr key={`${row.Location}-${row.Year}-${index}`} className={`transition-colors ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {columns.map(col => {
                        // All fields are now editable in edit mode
                        const cellValue = isEditing && editedRow ? editedRow[col.key] : row[col.key];

                        return (
                          <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                            {isEditing ? (
                              <input
                                type={col.key === 'Location' ? 'text' : 'number'}
                                step={col.key === 'Location' || col.key === 'Year' ? undefined : '0.001'}
                                value={cellValue}
                                onChange={(e) => handleFieldChange(col.key, e.target.value)}
                                className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            ) : (
                              <span>
                                {formatValue(col.key, cellValue)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                className="inline-flex items-center justify-center p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Save changes"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Cancel editing"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              
                              <button
                                onClick={() => handleEdit(index)}
                                className="inline-flex items-center justify-center p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit row"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(index)}
                                className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {data.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">


            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length}
              </span>

              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-4 py-1 text-sm font-medium text-gray-700">
                  {currentPage} / {totalPages}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WQIDataTable;