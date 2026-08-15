/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  FileText, 
  Grid, 
  Briefcase, 
  Truck, 
  Wallet, 
  Coins, 
  Database,
  Building2,
  X
} from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNavigation({
  activeTab,
  onTabChange
}: BottomNavigationProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "More" popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreOpen]);

  // If user is on dashboard, bottom navigation is hidden according to requirement
  if (activeTab === 'dashboard') {
    return null;
  }

  const secondaryTabs = ['projects', 'reports', 'suppliers', 'budget', 'debts', 'backup'];
  const isMoreActive = secondaryTabs.includes(activeTab);

  const handleSelectTab = (tab: string) => {
    onTabChange(tab);
    setIsMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none dir-rtl p-1 sm:p-1.5 pb-[calc(0.1rem+env(safe-area-inset-bottom,0px))] sm:pb-1">
      
      {/* "More" Sheet / Popover */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs pointer-events-auto flex items-end justify-center pb-16 sm:pb-20 px-3" onClick={() => setIsMoreOpen(false)}>
          <div 
            ref={moreRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl sm:rounded-2xl shadow-2xl p-4 space-y-3 animate-slide-up text-right text-white mb-2"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-extrabold text-sm flex items-center gap-2 text-slate-200">
                <Grid size={18} className="text-sky-400" />
                جميع أقسام ونوافذ التطبيق
              </span>
              <button 
                onClick={() => setIsMoreOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Projects Hub */}
              <button
                onClick={() => handleSelectTab('projects')}
                className={`p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'projects' ? 'bg-white/20' : 'bg-sky-500/20 text-sky-400'}`}>
                  <Building2 size={18} />
                </div>
                <div>
                  <span className="block font-bold">إدارة المشاريع</span>
                  <span className="text-[10px] text-slate-400 font-normal">لوحة التحكم والتبديل</span>
                </div>
              </button>
              {/* Reports */}
              <button
                onClick={() => handleSelectTab('reports')}
                className={`p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'reports' ? 'bg-white/20' : 'bg-violet-500/20 text-violet-400'}`}>
                  <FileText size={18} />
                </div>
                <div>
                  <span className="block font-bold">التقارير</span>
                  <span className="text-[10px] text-slate-400 font-normal">كشوفات وتقارير مالية</span>
                </div>
              </button>

              {/* Suppliers */}
              <button
                onClick={() => handleSelectTab('suppliers')}
                className={`p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'suppliers'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'suppliers' ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'}`}>
                  <Truck size={18} />
                </div>
                <div>
                  <span className="block font-bold">الموردين</span>
                  <span className="text-[10px] text-slate-400 font-normal">توريد المواد والحسابات</span>
                </div>
              </button>

              {/* Budget */}
              <button
                onClick={() => handleSelectTab('budget')}
                className={`p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'budget'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'budget' ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  <Wallet size={18} />
                </div>
                <div>
                  <span className="block font-bold">الميزانية العامة</span>
                  <span className="text-[10px] text-slate-400 font-normal">تغذية الصندوق العام</span>
                </div>
              </button>

              {/* Debts */}
              <button
                onClick={() => handleSelectTab('debts')}
                className={`p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'debts'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'debts' ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'}`}>
                  <Coins size={18} />
                </div>
                <div>
                  <span className="block font-bold">الديون والالتزامات</span>
                  <span className="text-[10px] text-slate-400 font-normal">المستحقات الآجلة</span>
                </div>
              </button>

              {/* Backup */}
              <button
                onClick={() => handleSelectTab('backup')}
                className={`col-span-2 p-3 rounded-2xl flex items-center gap-3 text-xs font-bold transition-all text-right cursor-pointer ${
                  activeTab === 'backup'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'backup' ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'}`}>
                  <Database size={18} />
                </div>
                <div>
                  <span className="block font-bold">النسخ الاحتياطي</span>
                  <span className="text-[10px] text-slate-400 font-normal">تصدير واستعادة قواعد البيانات</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Persistent Bottom Navigation Bar */}
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white border border-slate-800/80 shadow-2xl px-2 py-2 max-w-lg mx-auto rounded-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-around gap-1">
          
          {/* 1. Dashboard (الرئيسية) */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer min-w-[60px] ${
              activeTab === 'dashboard'
                ? 'text-sky-400 bg-sky-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-1 font-semibold">الرئيسية</span>
          </button>

          {/* 2. Expenses (النفقات) */}
          <button
            onClick={() => handleSelectTab('expenses')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer min-w-[60px] ${
              activeTab === 'expenses'
                ? 'text-rose-400 bg-rose-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp size={20} className={activeTab === 'expenses' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-1 font-semibold">النفقات</span>
          </button>

          {/* 3. Workers (العمال) */}
          <button
            onClick={() => handleSelectTab('workers')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer min-w-[60px] ${
              activeTab === 'workers'
                ? 'text-sky-400 bg-sky-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={20} className={activeTab === 'workers' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-1 font-semibold">العمال</span>
          </button>

          {/* 4. Employees (الموظفين) */}
          <button
            onClick={() => handleSelectTab('employees')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer min-w-[60px] ${
              activeTab === 'employees'
                ? 'text-indigo-400 bg-indigo-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase size={20} className={activeTab === 'employees' ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-1 font-semibold">الموظفين</span>
          </button>

          {/* 5. More (المزيد) */}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer min-w-[60px] ${
              isMoreActive || isMoreOpen
                ? 'text-amber-400 bg-amber-500/10 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-1.5 right-3.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            <Grid size={20} className={isMoreActive || isMoreOpen ? 'scale-110 transition-transform' : ''} />
            <span className="text-[10px] mt-1 font-semibold">المزيد</span>
          </button>

        </div>
      </div>

    </div>
  );
}
