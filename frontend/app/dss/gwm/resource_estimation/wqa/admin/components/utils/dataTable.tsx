import React, { useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, Edit2, Save, X, ArrowUpDown, ArrowUp, ArrowDown, MapPin, Eye } from 'lucide-react';

interface WQIDataRow {
  Location: string;
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

interface WQIDataTableProps {
  initialData?: WQIDataRow[];
  onDelete?: (row: WQIDataRow) => void;
  onView?: (row: WQIDataRow) => void;
}

type SortField = 'Location';

/* key parameters to preview per card */
const PREVIEW_PARAMS: { key: keyof WQIDataRow; label: string; unit?: string }[] = [
  { key: 'pH_Level', label: 'pH' },
  { key: 'Electrical_Conductivity', label: 'EC', unit: 'µS/cm' },
  { key: 'Hardness', label: 'TH', unit: 'mg/L' },
  { key: 'Fluoride', label: 'F⁻', unit: 'mg/L' },
];

/* all parameters for expanded detail view */
const ALL_PARAMS: { key: keyof WQIDataRow; label: string; unit?: string }[] = [
  { key: 'pH_Level', label: 'pH' },
  { key: 'Electrical_Conductivity', label: 'EC', unit: 'µS/cm' },
  { key: 'Hardness', label: 'Hardness', unit: 'mg/L' },
  { key: 'Arsenic', label: 'As', unit: 'mg/L' },
  { key: 'Fluoride', label: 'F⁻', unit: 'mg/L' },
  { key: 'Iron', label: 'Fe', unit: 'mg/L' },
  { key: 'Nitrate', label: 'NO₃', unit: 'mg/L' },
  { key: 'Chloride', label: 'Cl⁻', unit: 'mg/L' },
  { key: 'Sulfate', label: 'SO₄', unit: 'mg/L' },
  { key: 'Calcium', label: 'Ca²⁺', unit: 'mg/L' },
  { key: 'Magnesium', label: 'Mg²⁺', unit: 'mg/L' },
  { key: 'Sodium', label: 'Na⁺', unit: 'mg/L' },
  { key: 'Potassium', label: 'K⁺', unit: 'mg/L' },
  { key: 'Bicarbonate', label: 'HCO₃', unit: 'mg/L' },
  { key: 'Carbonate', label: 'CO₃', unit: 'mg/L' },
  { key: 'Uranium', label: 'U', unit: 'µg/L' },
];

const fmt = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(2));

const WQIDataTable: React.FC<WQIDataTableProps> = ({ initialData = [], onDelete, onView }) => {
  const [data, setData] = useState<WQIDataRow[]>(initialData);
  const [page, setPage] = useState(1);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editedRow, setEditedRow] = useState<WQIDataRow | null>(null);
  const [sortField, setSortField] = useState<SortField>('Location');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const PER_PAGE = 5;

  React.useEffect(() => { setData(initialData); }, [initialData]);

  /* sort */
  const sorted = [...data].sort((a, b) => {
    const av = a[sortField]; const bv = b[sortField];
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as unknown as number) - (bv as unknown as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const start = (page - 1) * PER_PAGE;
  const visible = sorted.slice(start, start + PER_PAGE);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? sortDir === 'asc'
        ? <ArrowUp className="w-3 h-3 text-blue-600" />
        : <ArrowDown className="w-3 h-3 text-blue-600" />
      : <ArrowUpDown className="w-3 h-3 text-slate-400" />;

  /* edit */
  const startEdit = (globalIdx: number) => {
    setEditingIdx(globalIdx);
    setEditedRow({ ...sorted[globalIdx] });
  };
  const cancelEdit = () => { setEditingIdx(null); setEditedRow(null); };
  const saveEdit = () => {
    if (editingIdx === null || !editedRow) return;
    const orig = sorted[editingIdx];
    const i = data.findIndex(r => r.Location === orig.Location && r.Latitude === orig.Latitude);
    if (i !== -1) { const d = [...data]; d[i] = editedRow; setData(d); }
    setEditingIdx(null); setEditedRow(null);
  };
  const deleteRow = (globalIdx: number) => {
    const orig = sorted[globalIdx];
    const i = data.findIndex(r => r.Location === orig.Location && r.Latitude === orig.Latitude);
    if (i !== -1) setData(data.filter((_, x) => x !== i));
    onDelete?.(orig);
    if (editingIdx === globalIdx) cancelEdit();
    const newTotal = Math.ceil((sorted.length - 1) / PER_PAGE);
    if (page > newTotal && newTotal > 0) setPage(newTotal);
  };
  const fieldChange = (key: keyof WQIDataRow, val: string) => {
    if (!editedRow) return;
    setEditedRow({ ...editedRow, [key]: key === 'Location' ? val : (parseFloat(val) || 0) });
  };

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-6 text-slate-400">
      <MapPin className="w-6 h-6 mb-2 opacity-40" />
      <p className="text-xs">No well points loaded</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      {/* Sort bar */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-slate-400 mr-1">Sort:</span>
        {(['Location'] as SortField[]).map(f => (
          <button
            key={f}

            onClick={() => toggleSort(f)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              sortField === f ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >Locations name
             <SortIcon field={f} />
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-400">{data.length} points</span>
      </div>

      {/* Cards */}
      {visible.map((row, i) => {
        const globalIdx = start + i;
        const isEditing = editingIdx === globalIdx;

        return (
          <div
            key={`${row.Location}-${i}`}
            className={`rounded-lg border transition-all duration-150 overflow-hidden ${
              isEditing ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            {/* Card header row */}
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Location dot */}
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <MapPin className="w-3 h-3 text-blue-600" />
              </div>

              {isEditing ? (
                <input
                  className="flex-1 text-xs font-medium px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/40 bg-white"
                  value={editedRow?.Location ?? ''}
                  onChange={e => fieldChange('Location', e.target.value)}
                  placeholder="Location name"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{row.Location}</p>
                  <p className="text-[10px] text-slate-400">{row.Latitude.toFixed(2)}°N, {row.Longitude.toFixed(2)}°E</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                {isEditing ? (
                  <>
                    <button onClick={saveEdit} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors" title="Save">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors" title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onView?.(row)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View on map">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startEdit(globalIdx)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteRow(globalIdx)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Preview params strip */}
            {!isEditing && (
              <div className="flex gap-2 px-3 pb-2">
                {PREVIEW_PARAMS.map(p => (
                  <div key={p.key} className="flex flex-col items-center bg-slate-50 rounded px-2 py-1 min-w-0">
                    <span className="text-[9px] font-semibold text-slate-400 uppercase">{p.label}</span>
                    <span className="text-[11px] font-bold text-slate-700">{fmt(row[p.key] as number)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit: all numeric parameters */}
            {isEditing && (
              <div className="border-t border-blue-200 px-3 py-2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {ALL_PARAMS.map(p => (
                    <div key={p.key}>
                      <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5">
                        {p.label}{p.unit ? ` (${p.unit})` : ''}
                      </p>
                      <input
                        type="number"
                        step="0.001"
                        className="w-full text-xs px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/40 bg-white"
                        value={editedRow?.[p.key] ?? ''}
                        onChange={e => fieldChange(p.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400">
            {start + 1}–{Math.min(start + PER_PAGE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <span className="text-[10px] font-medium text-slate-600 px-1">{page}/{totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WQIDataTable;
