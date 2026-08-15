/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Filter, 
  ArrowUpAZ, 
  ArrowDownZA, 
  ArrowUp01, 
  ArrowDown10, 
  Calendar,
  Search, 
  Check, 
  X, 
  RotateCcw,
  CheckSquare,
  Square,
  MinusSquare,
  ChevronDown
} from 'lucide-react';

export type ColumnSortType = 'string' | 'number' | 'date';

export interface ColumnFilterConfig<T> {
  key: string;
  title: string;
  sortType?: ColumnSortType;
  getValue: (item: T) => string | number | (string | number)[] | null | undefined;
  getDisplayValue?: (value: string | number) => string;
}

export interface ActiveColumnFilter {
  selectedValues: string[]; // List of string representation of allowed values
}

export interface ColumnSortState {
  key: string;
  direction: 'asc' | 'desc';
}

interface ExcelColumnFilterProps<T> {
  config: ColumnFilterConfig<T>;
  data: T[]; // Base dataset or data filtered by external search tools
  activeFilter?: ActiveColumnFilter;
  onFilterChange: (columnKey: string, filter: ActiveColumnFilter | null) => void;
  activeSort?: ColumnSortState | null;
  onSortChange: (sort: ColumnSortState | null) => void;
  accentColor?: 'rose' | 'sky' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'slate';
  allColumnFilters?: Record<string, ActiveColumnFilter>;
  allConfigs?: Record<string, ColumnFilterConfig<T>> | ColumnFilterConfig<T>[];
}

export default function ExcelColumnFilter<T>({
  config,
  data,
  activeFilter,
  onFilterChange,
  activeSort,
  onSortChange,
  accentColor = 'slate',
  allColumnFilters,
  allConfigs
}: ExcelColumnFilterProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number; left?: number }>({ top: 0, right: 0 });

  // Calculate contextual dataset filtered by all other active column filters (cascading)
  const contextualData = useMemo(() => {
    if (!allColumnFilters || !allConfigs) {
      return data;
    }

    const getConfig = (key: string): ColumnFilterConfig<T> | undefined => {
      if (Array.isArray(allConfigs)) {
        return allConfigs.find(c => c.key === key);
      }
      return allConfigs[key];
    };

    let result = data;
    for (const [colKey, filter] of Object.entries(allColumnFilters)) {
      if (colKey === config.key) continue; // Do NOT filter out alternative options of THIS column
      if (!filter || !filter.selectedValues || filter.selectedValues.length === 0) continue;

      const otherConfig = getConfig(colKey);
      if (!otherConfig) continue;

      const allowedSet = new Set(filter.selectedValues);
      result = result.filter(item => {
        const raw = otherConfig.getValue(item);
        if (Array.isArray(raw)) {
          if (raw.length === 0) {
            return allowedSet.has('(فارغ)');
          }
          return raw.some(val => {
            const strVal = val !== null && val !== undefined && String(val).trim() !== '' ? String(val) : '(فارغ)';
            return allowedSet.has(strVal);
          });
        } else {
          const strVal = raw !== null && raw !== undefined && String(raw).trim() !== '' ? String(raw) : '(فارغ)';
          return allowedSet.has(strVal);
        }
      });
    }

    return result;
  }, [data, allColumnFilters, allConfigs, config.key]);

  // Extract all distinct values and counts for this column from contextualData
  const distinctValuesWithCounts = useMemo(() => {
    const map = new Map<string, { display: string; count: number; rawValue: any }>();

    contextualData.forEach(item => {
      const raw = config.getValue(item);
      
      if (Array.isArray(raw)) {
        if (raw.length === 0) {
          const key = '(فارغ)';
          const curr = map.get(key) || { display: '(فارغ)', count: 0, rawValue: '' };
          curr.count += 1;
          map.set(key, curr);
        } else {
          raw.forEach(val => {
            const strVal = val !== null && val !== undefined && String(val).trim() !== '' ? String(val) : '(فارغ)';
            const display = config.getDisplayValue ? config.getDisplayValue(val) : strVal;
            const curr = map.get(strVal) || { display, count: 0, rawValue: val };
            curr.count += 1;
            map.set(strVal, curr);
          });
        }
      } else {
        const strVal = raw !== null && raw !== undefined && String(raw).trim() !== '' ? String(raw) : '(فارغ)';
        const display = config.getDisplayValue ? config.getDisplayValue(raw ?? '') : strVal;
        const curr = map.get(strVal) || { display, count: 0, rawValue: raw };
        curr.count += 1;
        map.set(strVal, curr);
      }
    });

    const entries = Array.from(map.entries()).map(([value, info]) => ({
      value,
      display: info.display,
      count: info.count,
      rawValue: info.rawValue
    }));

    // Sort distinct values logically based on column type
    entries.sort((a, b) => {
      if (a.value === '(فارغ)') return 1;
      if (b.value === '(فارغ)') return -1;

      if (config.sortType === 'number') {
        const numA = parseFloat(a.value);
        const numB = parseFloat(b.value);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
      }

      // Sort dates from NEWEST to OLDEST (الأحدث أولاً في الأعلى)
      if (config.sortType === 'date') {
        const timeA = Date.parse(a.value) || 0;
        const timeB = Date.parse(b.value) || 0;
        if (timeA && timeB) {
          return timeB - timeA;
        }
        return b.value.localeCompare(a.value);
      }

      return a.display.localeCompare(b.display, 'ar');
    });

    return entries;
  }, [contextualData, config]);

  const allDistinctKeys = useMemo(() => distinctValuesWithCounts.map(d => d.value), [distinctValuesWithCounts]);

  // Draft selected values while modal is open
  const [draftSelected, setDraftSelected] = useState<string[]>([]);

  // Dynamic position calculation anchored next to the button
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupWidth = 310;
    const popupHeight = 440;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal placement: keep in screen boundaries (RTL layout: right-aligned to button)
    let right = viewportWidth - rect.right;
    if (right + popupWidth > viewportWidth - 10) {
      right = Math.max(10, viewportWidth - popupWidth - 10);
    }
    if (right < 10) {
      right = 10;
    }

    // Vertical placement: place below button by default, or above if near bottom of viewport
    let top = rect.bottom + 6;
    if (top + popupHeight > viewportHeight - 10 && rect.top - popupHeight > 10) {
      top = Math.max(10, rect.top - popupHeight - 6);
    }

    setDropdownPosition({
      top,
      right
    });
  }, []);

  // When opening dropdown, initialize draft from activeFilter or select all
  useEffect(() => {
    if (isOpen) {
      if (activeFilter && activeFilter.selectedValues) {
        setDraftSelected([...activeFilter.selectedValues]);
      } else {
        setDraftSelected([...allDistinctKeys]);
      }
      setSearchTerm('');
      updatePosition();
    }
  }, [isOpen, activeFilter, allDistinctKeys, updatePosition]);

  // Update position on scroll (capture: true catches window and any scrollable container/table) and resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter distinct values based on search term
  const filteredDistinctValues = useMemo(() => {
    if (!searchTerm.trim()) return distinctValuesWithCounts;
    const cleanSearch = searchTerm.trim().toLowerCase();
    return distinctValuesWithCounts.filter(item => 
      item.display.toLowerCase().includes(cleanSearch) || 
      item.value.toLowerCase().includes(cleanSearch)
    );
  }, [distinctValuesWithCounts, searchTerm]);

  // Check state of "Select All"
  const isAllFilteredSelected = useMemo(() => {
    if (filteredDistinctValues.length === 0) return false;
    return filteredDistinctValues.every(item => draftSelected.includes(item.value));
  }, [filteredDistinctValues, draftSelected]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredDistinctValues.length === 0) return false;
    const count = filteredDistinctValues.filter(item => draftSelected.includes(item.value)).length;
    return count > 0 && count < filteredDistinctValues.length;
  }, [filteredDistinctValues, draftSelected]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Unselect all matching search
      const toRemove = new Set(filteredDistinctValues.map(i => i.value));
      setDraftSelected(prev => prev.filter(k => !toRemove.has(k)));
    } else {
      // Select all matching search
      const toAdd = filteredDistinctValues.map(i => i.value);
      setDraftSelected(prev => Array.from(new Set([...prev, ...toAdd])));
    }
  };

  const handleToggleItem = (val: string) => {
    setDraftSelected(prev => {
      if (prev.includes(val)) {
        return prev.filter(v => v !== val);
      } else {
        return [...prev, val];
      }
    });
  };

  const handleSelectOnly = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraftSelected([val]);
  };

  const handleApplyFilter = () => {
    // If all distinct values are selected, clear the filter (meaning no filter applied)
    if (draftSelected.length === allDistinctKeys.length || draftSelected.length === 0) {
      onFilterChange(config.key, null);
    } else {
      onFilterChange(config.key, { selectedValues: draftSelected });
    }
    setIsOpen(false);
  };

  const handleClearThisFilter = () => {
    onFilterChange(config.key, null);
    setDraftSelected([...allDistinctKeys]);
    setIsOpen(false);
  };

  const handleSort = (direction: 'asc' | 'desc') => {
    if (activeSort?.key === config.key && activeSort?.direction === direction) {
      // Clear sort if clicking the same active sort direction
      onSortChange(null);
    } else {
      onSortChange({ key: config.key, direction });
    }
    setIsOpen(false);
  };

  const isFilterActive = Boolean(
    activeFilter && 
    activeFilter.selectedValues && 
    activeFilter.selectedValues.length > 0
  );

  const isSorted = activeSort?.key === config.key;
  const sortDirection = isSorted ? activeSort.direction : null;

  // Dynamic sort labels based on column type
  const sortLabels = useMemo(() => {
    if (config.sortType === 'number') {
      return {
        asc: 'فرز من الأصغر إلى الأكبر',
        desc: 'فرز من الأكبر إلى الأصغر',
        iconAsc: ArrowUp01,
        iconDesc: ArrowDown10
      };
    }
    if (config.sortType === 'date') {
      return {
        asc: 'فرز من الأقدم إلى الأحدث',
        desc: 'فرز من الأحدث إلى الأقدم',
        iconAsc: ArrowUp01,
        iconDesc: ArrowDown10
      };
    }
    return {
      asc: 'فرز أبجدياً (أ إلى ي)',
      desc: 'فرز أبجدياً (ي إلى أ)',
      iconAsc: ArrowUpAZ,
      iconDesc: ArrowDownZA
    };
  }, [config.sortType]);

  const IconAsc = sortLabels.iconAsc;
  const IconDesc = sortLabels.iconDesc;

  // Accent color themes
  const colorStyles = {
    rose: {
      activeBtn: 'bg-rose-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-rose-100 hover:text-rose-700 text-slate-400',
      applyBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      activeItem: 'bg-rose-50 text-rose-800'
    },
    sky: {
      activeBtn: 'bg-sky-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-sky-100 hover:text-sky-700 text-slate-400',
      applyBtn: 'bg-sky-600 hover:bg-sky-700 text-white',
      badge: 'bg-sky-100 text-sky-800 border-sky-200',
      activeItem: 'bg-sky-50 text-sky-800'
    },
    indigo: {
      activeBtn: 'bg-indigo-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-indigo-100 hover:text-indigo-700 text-slate-400',
      applyBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      activeItem: 'bg-indigo-50 text-indigo-800'
    },
    emerald: {
      activeBtn: 'bg-emerald-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-emerald-100 hover:text-emerald-700 text-slate-400',
      applyBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      activeItem: 'bg-emerald-50 text-emerald-800'
    },
    amber: {
      activeBtn: 'bg-amber-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-amber-100 hover:text-amber-700 text-slate-400',
      applyBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      activeItem: 'bg-amber-50 text-amber-800'
    },
    purple: {
      activeBtn: 'bg-purple-500 text-white shadow-xs',
      hoverBtn: 'hover:bg-purple-100 hover:text-purple-700 text-slate-400',
      applyBtn: 'bg-purple-600 hover:bg-purple-700 text-white',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      activeItem: 'bg-purple-50 text-purple-800'
    },
    slate: {
      activeBtn: 'bg-slate-700 text-white shadow-xs',
      hoverBtn: 'hover:bg-slate-200 hover:text-slate-800 text-slate-400',
      applyBtn: 'bg-slate-800 hover:bg-slate-900 text-white',
      badge: 'bg-slate-100 text-slate-800 border-slate-200',
      activeItem: 'bg-slate-100 text-slate-800'
    }
  }[accentColor];

  return (
    <div className="relative inline-flex items-center select-none" dir="rtl">
      {/* Header Filter Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`تصفية وفرز عمود: ${config.title}`}
        className={`p-1 mx-1 rounded-md transition-all flex items-center gap-0.5 cursor-pointer text-[11px] ${
          isFilterActive || isSorted
            ? colorStyles.activeBtn
            : colorStyles.hoverBtn
        }`}
      >
        <Filter size={12} className={isFilterActive ? 'fill-current' : ''} />
        {isSorted && (
          <span className="text-[9px] font-extrabold leading-none">
            {sortDirection === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Dropdown Menu Popup (Positioned Fixed to avoid overflow clipping) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            zIndex: 9999
          }}
          className="w-[280px] sm:w-[310px] bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-800 text-xs font-medium animate-fade-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Title */}
          <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="font-bold text-slate-800 text-xs">تصفية وفرز: {config.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200/60 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Sort Section */}
          <div className="p-2 space-y-1 border-b border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => handleSort('asc')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                sortDirection === 'asc' 
                  ? 'bg-rose-50 text-rose-700 font-bold' 
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <IconAsc size={15} className={sortDirection === 'asc' ? 'text-rose-600' : 'text-slate-400'} />
                <span>{sortLabels.asc}</span>
              </div>
              {sortDirection === 'asc' && <Check size={14} className="text-rose-600" />}
            </button>

            <button
              type="button"
              onClick={() => handleSort('desc')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                sortDirection === 'desc' 
                  ? 'bg-rose-50 text-rose-700 font-bold' 
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <IconDesc size={15} className={sortDirection === 'desc' ? 'text-rose-600' : 'text-slate-400'} />
                <span>{sortLabels.desc}</span>
              </div>
              {sortDirection === 'desc' && <Check size={14} className="text-rose-600" />}
            </button>
          </div>

          {/* Clear Filter from this column */}
          {isFilterActive && (
            <div className="px-2 py-1.5 border-b border-slate-100 bg-rose-50/40">
              <button
                type="button"
                onClick={handleClearThisFilter}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-100/60 font-bold text-[11px] transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>مسح التصفية من "{config.title}"</span>
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في القيم المتاحة..."
                className="w-full h-8 pl-7 pr-8 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-rose-500 placeholder:text-slate-400 font-normal transition-colors"
              />
              <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Checklist Area */}
          <div className="p-2">
            {/* Select All Option */}
            <div 
              onClick={handleToggleSelectAll}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100/80 cursor-pointer text-slate-700 font-bold text-xs select-none mb-1 border-b border-slate-100 pb-2"
            >
              <div className="flex items-center gap-2">
                {isAllFilteredSelected ? (
                  <CheckSquare size={16} className="text-rose-600" />
                ) : isSomeFilteredSelected ? (
                  <MinusSquare size={16} className="text-rose-600" />
                ) : (
                  <Square size={16} className="text-slate-300" />
                )}
                <span>(تحديد الكل)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">
                {draftSelected.length} من {allDistinctKeys.length}
              </span>
            </div>

            {/* Scrollable List of Unique Values */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
              {filteredDistinctValues.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  لا توجد نتائج مطابقة للبحث
                </div>
              ) : (
                filteredDistinctValues.map((item) => {
                  const isChecked = draftSelected.includes(item.value);
                  return (
                    <div
                      key={item.value}
                      onClick={() => handleToggleItem(item.value)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                        isChecked ? 'bg-slate-50 text-slate-800 font-semibold' : 'text-slate-600 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isChecked ? (
                          <CheckSquare size={15} className="text-rose-600 shrink-0" />
                        ) : (
                          <Square size={15} className="text-slate-300 group-hover:text-slate-400 shrink-0" />
                        )}
                        <span className="truncate" title={item.display}>
                          {item.display}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 mr-1">
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-md font-mono">
                          {item.count}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleSelectOnly(item.value, e)}
                          title="تحديد هذه القيمة فقط"
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-rose-600 hover:underline px-1 font-normal cursor-pointer"
                        >
                          فقط
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-2.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftSelected([...allDistinctKeys]);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 hover:underline cursor-pointer"
            >
              إلغاء التحديد
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200/70 text-xs font-semibold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyFilter}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${colorStyles.applyBtn}`}
              >
                تطبيق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to apply Excel column filtering and sorting easily to any dataset
 */
export function useExcelTable<T>(
  initialData: T[],
  configs: ColumnFilterConfig<T>[]
) {
  const [columnFilters, setColumnFilters] = useState<Record<string, ActiveColumnFilter>>({});
  const [activeSort, setActiveSort] = useState<ColumnSortState | null>(null);

  const handleFilterChange = (key: string, filter: ActiveColumnFilter | null) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (filter === null) {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  };

  const handleSortChange = (sort: ColumnSortState | null) => {
    setActiveSort(sort);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setActiveSort(null);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  // Filtered and Sorted results
  const filteredAndSortedData = useMemo(() => {
    let result = [...initialData];

    // 1. Apply column filters
    (Object.entries(columnFilters) as [string, ActiveColumnFilter][]).forEach(([colKey, filter]) => {
      const config = configs.find(c => c.key === colKey);
      if (!config || !filter || !filter.selectedValues) return;

      const allowedSet = new Set(filter.selectedValues);

      result = result.filter(item => {
        const raw = config.getValue(item);

        if (Array.isArray(raw)) {
          if (raw.length === 0) {
            return allowedSet.has('(فارغ)');
          }
          // If any item in array matches allowed values
          return raw.some(v => {
            const strVal = v !== null && v !== undefined && String(v).trim() !== '' ? String(v) : '(فارغ)';
            return allowedSet.has(strVal);
          });
        } else {
          const strVal = raw !== null && raw !== undefined && String(raw).trim() !== '' ? String(raw) : '(فارغ)';
          return allowedSet.has(strVal);
        }
      });
    });

    // 2. Apply active column sort (if set)
    if (activeSort) {
      const config = configs.find(c => c.key === activeSort.key);
      if (config) {
        result.sort((a, b) => {
          const rawA = config.getValue(a);
          const rawB = config.getValue(b);

          if (rawA === rawB) return 0;
          if (rawA === null || rawA === undefined || rawA === '') return 1;
          if (rawB === null || rawB === undefined || rawB === '') return -1;

          let comp = 0;
          if (config.sortType === 'number') {
            const numA = typeof rawA === 'number' ? rawA : parseFloat(String(rawA)) || 0;
            const numB = typeof rawB === 'number' ? rawB : parseFloat(String(rawB)) || 0;
            comp = numA - numB;
          } else if (config.sortType === 'date') {
            comp = String(rawA).localeCompare(String(rawB));
          } else {
            const strA = config.getDisplayValue ? config.getDisplayValue(String(rawA)) : String(rawA);
            const strB = config.getDisplayValue ? config.getDisplayValue(String(rawB)) : String(rawB);
            comp = strA.localeCompare(strB, 'ar');
          }

          return activeSort.direction === 'asc' ? comp : -comp;
        });
      }
    }

    return result;
  }, [initialData, columnFilters, activeSort, configs]);

  return {
    filteredAndSortedData,
    columnFilters,
    activeSort,
    handleFilterChange,
    handleSortChange,
    clearAllFilters,
    hasActiveFilters,
    activeFiltersCount: Object.keys(columnFilters).length + (activeSort ? 1 : 0)
  };
}
