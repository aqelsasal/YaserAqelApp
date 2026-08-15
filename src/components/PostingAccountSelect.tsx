import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, HardHat, Briefcase, Truck } from 'lucide-react';
import { Worker, Employee, Supplier } from '../types';

interface PostingAccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  workers: Worker[];
  employees: Employee[];
  suppliers: Supplier[];
  disabled?: boolean;
}

export const PostingAccountSelect: React.FC<PostingAccountSelectProps> = ({
  value,
  onChange,
  workers,
  employees,
  suppliers,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine selected object details
  let selectedType: 'worker' | 'employee' | 'supplier' | 'none' = 'none';
  let selectedName = '';
  let selectedSub = '';

  if (value && value !== 'none') {
    const [type, id] = value.split(':');
    if (type === 'worker') {
      const w = workers.find(item => item.id === id);
      if (w) {
        selectedType = 'worker';
        selectedName = w.name;
        selectedSub = w.profession || 'عامل';
      }
    } else if (type === 'employee') {
      const emp = employees.find(item => item.id === id);
      if (emp) {
        selectedType = 'employee';
        selectedName = emp.name;
        selectedSub = emp.profession || 'موظف';
      }
    } else if (type === 'supplier') {
      const s = suppliers.find(item => item.id === id);
      if (s) {
        selectedType = 'supplier';
        selectedName = s.name;
        selectedSub = s.materialType || 'مورد';
      }
    }
  }

  // Filter items based on search
  const term = searchTerm.trim().toLowerCase();
  const filteredWorkers = workers.filter(w => 
    !term || w.name.toLowerCase().includes(term) || (w.profession && w.profession.toLowerCase().includes(term))
  );
  const filteredEmployees = employees.filter(e => 
    !term || e.name.toLowerCase().includes(term) || (e.profession && e.profession.toLowerCase().includes(term))
  );
  const filteredSuppliers = suppliers.filter(s => 
    !term || s.name.toLowerCase().includes(term) || (s.materialType && s.materialType.toLowerCase().includes(term))
  );

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="relative w-full text-right dir-rtl" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[42px] px-3 bg-white border rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 shadow-2xs cursor-pointer ${
          isOpen ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate text-right">
          {selectedType === 'worker' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-xs font-extrabold border border-sky-200">
              <HardHat size={14} className="text-sky-600" />
              <span>{selectedName}</span>
              <span className="text-[10px] font-semibold text-sky-600">({selectedSub})</span>
            </span>
          )}

          {selectedType === 'employee' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-xs font-extrabold border border-indigo-200">
              <Briefcase size={14} className="text-indigo-600" />
              <span>{selectedName}</span>
              <span className="text-[10px] font-semibold text-indigo-600">({selectedSub})</span>
            </span>
          )}

          {selectedType === 'supplier' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-extrabold border border-amber-200">
              <Truck size={14} className="text-amber-600" />
              <span>{selectedName}</span>
              <span className="text-[10px] font-semibold text-amber-600">({selectedSub})</span>
            </span>
          )}

          {selectedType === 'none' && (
            <span className="text-slate-500 font-medium">-- مصروف عام (بدون ترحيل لحساب) --</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && value !== 'none' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              title="إلغاء الترحيل"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-rose-500' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-right animate-scale-up max-h-80 flex flex-col dir-rtl">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم العامل، الموظف، أو المورد..."
                className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:border-rose-500"
              />
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* List Options */}
          <div className="overflow-y-auto p-1.5 space-y-2 text-xs">
            {/* General Expense Option */}
            <div
              onClick={() => handleSelect('')}
              className={`p-3 sm:p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between min-h-[44px] ${
                !value || value === 'none'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold'
                  : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-600 font-medium'
              }`}
            >
              <span className="text-xs sm:text-sm">-- مصروف عام (بدون ترحيل لحساب) --</span>
              {(!value || value === 'none') && <Check size={16} className="text-rose-600 shrink-0" />}
            </div>

            {/* 1. Employees Group (الموظفين - أولاً) */}
            {employees.length > 0 && (filteredEmployees.length > 0 || !term) && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-100 to-indigo-50/80 px-3 py-2 font-extrabold text-indigo-900 border-r-4 border-indigo-500 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={15} className="text-indigo-600" />
                    <span className="text-xs sm:text-sm">مجموعة الموظفين</span>
                    <span className="text-[10px] font-normal text-indigo-700">(سيقيد سلفة/دفعة)</span>
                  </div>
                  <span className="bg-indigo-200/80 text-indigo-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    {filteredEmployees.length}
                  </span>
                </div>

                <div className="p-1.5 space-y-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="text-slate-400 text-[11px] p-2 text-center">لا يوجد موظفين مطابقين للبحث</div>
                  ) : (
                    filteredEmployees.map(e => {
                      const valKey = `employee:${e.id}`;
                      const isSelected = value === valKey;
                      return (
                        <div
                          key={valKey}
                          onClick={() => handleSelect(valKey)}
                          className={`px-3 py-2.5 sm:py-3 rounded-xl border-r-3 transition-all cursor-pointer flex items-center justify-between text-xs sm:text-sm min-h-[44px] ${
                            isSelected
                              ? 'bg-indigo-100 text-indigo-950 border-indigo-600 font-extrabold shadow-2xs'
                              : 'bg-white hover:bg-indigo-50/80 text-slate-800 border-indigo-300 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                            <span className="truncate font-bold">{e.name}</span>
                            <span className="text-[11px] text-slate-500 truncate">({e.profession || 'موظف'})</span>
                          </div>
                          {isSelected && <Check size={16} className="text-indigo-700 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 2. Workers Group (العمال - ثانياً) */}
            {workers.length > 0 && (filteredWorkers.length > 0 || !term) && (
              <div className="rounded-xl border border-sky-100 bg-sky-50/20 overflow-hidden">
                <div className="bg-gradient-to-r from-sky-100 to-sky-50/80 px-3 py-2 font-extrabold text-sky-900 border-r-4 border-sky-500 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <HardHat size={15} className="text-sky-600" />
                    <span className="text-xs sm:text-sm">مجموعة العُمَّال</span>
                    <span className="text-[10px] font-normal text-sky-700">(سيقيد سلفة/أجور)</span>
                  </div>
                  <span className="bg-sky-200/80 text-sky-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    {filteredWorkers.length}
                  </span>
                </div>

                <div className="p-1.5 space-y-1">
                  {filteredWorkers.length === 0 ? (
                    <div className="text-slate-400 text-[11px] p-2 text-center">لا يوجد عمال مطابقين للبحث</div>
                  ) : (
                    filteredWorkers.map(w => {
                      const valKey = `worker:${w.id}`;
                      const isSelected = value === valKey;
                      return (
                        <div
                          key={valKey}
                          onClick={() => handleSelect(valKey)}
                          className={`px-3 py-2.5 sm:py-3 rounded-xl border-r-3 transition-all cursor-pointer flex items-center justify-between text-xs sm:text-sm min-h-[44px] ${
                            isSelected
                              ? 'bg-sky-100 text-sky-950 border-sky-600 font-extrabold shadow-2xs'
                              : 'bg-white hover:bg-sky-50/80 text-slate-800 border-sky-300 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                            <span className="truncate font-bold">{w.name}</span>
                            <span className="text-[11px] text-slate-500 truncate">({w.profession || 'عامل'})</span>
                          </div>
                          {isSelected && <Check size={16} className="text-sky-700 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 3. Suppliers Group (الموردين - ثالثاً) */}
            {suppliers.length > 0 && (filteredSuppliers.length > 0 || !term) && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/20 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-100 to-amber-50/80 px-3 py-2 font-extrabold text-amber-900 border-r-4 border-amber-500 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Truck size={15} className="text-amber-600" />
                    <span className="text-xs sm:text-sm">مجموعة الموردين</span>
                    <span className="text-[10px] font-normal text-amber-700">(سيقيد تسديد/مواد)</span>
                  </div>
                  <span className="bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    {filteredSuppliers.length}
                  </span>
                </div>

                <div className="p-1.5 space-y-1">
                  {filteredSuppliers.length === 0 ? (
                    <div className="text-slate-400 text-[11px] p-2 text-center">لا يوجد موردين مطابقين للبحث</div>
                  ) : (
                    filteredSuppliers.map(s => {
                      const valKey = `supplier:${s.id}`;
                      const isSelected = value === valKey;
                      return (
                        <div
                          key={valKey}
                          onClick={() => handleSelect(valKey)}
                          className={`px-3 py-2.5 sm:py-3 rounded-xl border-r-3 transition-all cursor-pointer flex items-center justify-between text-xs sm:text-sm min-h-[44px] ${
                            isSelected
                              ? 'bg-amber-100 text-amber-950 border-amber-600 font-extrabold shadow-2xs'
                              : 'bg-white hover:bg-amber-50/80 text-slate-800 border-amber-300 font-semibold'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                            <span className="truncate font-bold">{s.name}</span>
                            <span className="text-[11px] text-slate-500 truncate">({s.materialType || 'مورد'})</span>
                          </div>
                          {isSelected && <Check size={16} className="text-amber-700 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
