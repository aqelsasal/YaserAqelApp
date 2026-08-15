/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Truck, 
  Wallet, 
  ArrowUpRight, 
  AlertTriangle,
  FileText,
  DollarSign,
  Coins,
  Share2,
  Copy,
  Check,
  Cloud,
  Lock,
  Unlock,
  RefreshCw,
  Globe,
  Info,
  Briefcase,
  Database,
  BarChart2,
  PieChart as PieChartIcon,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Worker, 
  Supplier, 
  Employee,
  Expense, 
  BudgetItem, 
  formatCurrency 
} from '../types';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface DashboardProps {
  expenses: Expense[];
  workers: Worker[];
  suppliers: Supplier[];
  employees?: Employee[];
  budget: BudgetItem[];
  setActiveTab: (tab: string) => void;
  currency?: string;
  projectId?: string;
  sharedRole?: string;
  syncStatus?: 'idle' | 'loading' | 'success' | 'error';
  onSetProjectId?: (id: string) => void;
  onCreateShareLink?: (role?: 'read' | 'add' | 'full') => Promise<string>;
  onCancelCloudSync?: () => Promise<void> | void;
  onRestoreOwnerRole?: () => void;
}

export default function Dashboard({ 
  expenses, 
  workers, 
  suppliers, 
  employees = [],
  budget, 
  setActiveTab,
  currency = 'YER',
  projectId,
  sharedRole,
  syncStatus,
  onSetProjectId,
  onCreateShareLink,
  onCancelCloudSync,
  onRestoreOwnerRole
}: DashboardProps) {
  const [copiedRole, setCopiedRole] = React.useState<string | null>(null);
  const [generatingRole, setGeneratingRole] = React.useState<string | null>(null);
  const [shareInputId, setShareInputId] = React.useState<string>('');
  const [shareInputError, setShareInputError] = React.useState<string>('');
  const [showShareModal, setShowShareModal] = React.useState<boolean>(false);

  useBodyScrollLock(showShareModal);

  // Always scroll to top of window when Dashboard opens / project changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [projectId]);

  const handleCopyLink = async (role: 'read' | 'add' | 'full') => {
    if (!onCreateShareLink) return;
    try {
      setGeneratingRole(role);
      const link = await onCreateShareLink(role);
      if (link) {
        await navigator.clipboard.writeText(link);
        setCopiedRole(role);
        setTimeout(() => setCopiedRole(null), 2500);
      }
    } catch (err) {
      console.error("Failed to generate and copy link:", err);
    } finally {
      setGeneratingRole(null);
    }
  };

  const handleCopyProjectId = async () => {
    if (!projectId) return;
    try {
      await navigator.clipboard.writeText(projectId);
      setCopiedRole('projectId');
      setTimeout(() => setCopiedRole(null), 2500);
    } catch (err) {
      console.error("Failed to copy project ID:", err);
    }
  };

  const handleJoinProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareInputId.trim()) {
      setShareInputError('يرجى إدخال رمز المشروع أولاً');
      return;
    }
    if (onSetProjectId) {
      onSetProjectId(shareInputId.trim());
      setShareInputId('');
      setShareInputError('');
    }
  };
  
  // Calculate Totals per Currency
  const budgetByCurrency = budget.reduce((acc, item) => {
    const cur = item.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const expensesByCurrency = expenses.reduce((acc, item) => {
    const cur = item.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  // External debts helper
  const externalDebtsByCurrency = (() => {
    try {
      const saved = localStorage.getItem('site_external_debts');
      if (!saved) return {};
      const extAccounts = JSON.parse(saved);
      if (!Array.isArray(extAccounts)) return {};
      return extAccounts.reduce((acc: Record<string, number>, ext: any) => {
        const balances: Record<string, { forHim: number; onHim: number }> = {};
        (ext.ledger || []).forEach((entry: any) => {
          const cur = entry.currency || 'YER';
          if (!balances[cur]) balances[cur] = { forHim: 0, onHim: 0 };
          balances[cur].forHim += entry.amountForHim || 0;
          balances[cur].onHim += entry.amountOnHim || 0;
        });
        Object.entries(balances).forEach(([cur, val]) => {
          const net = val.forHim - val.onHim;
          if (net > 0) {
            acc[cur] = (acc[cur] || 0) + net;
          }
        });
        return acc;
      }, {});
    } catch (e) {
      return {};
    }
  })();

  // Debts per currency: (forHim - onHim) when positive across Workers, Suppliers, Employees, and External Accounts
  const debtsByCurrency = ['YER', 'SAR', 'USD'].reduce((acc, cur) => {
    let debt = 0;
    workers.forEach(w => {
      const onHim = w.ledger.filter(e => (e.currency || 'YER') === cur).reduce((s, e) => s + e.amountOnHim, 0);
      const forHim = w.ledger.filter(e => (e.currency || 'YER') === cur).reduce((s, e) => s + e.amountForHim, 0);
      const bal = forHim - onHim;
      if (bal > 0) debt += bal;
    });
    suppliers.forEach(s => {
      const onHim = s.ledger.filter(e => (e.currency || 'YER') === cur).reduce((s, e) => s + e.amountOnHim, 0);
      const forHim = s.ledger.filter(e => (e.currency || 'YER') === cur).reduce((s, e) => s + e.amountForHim, 0);
      const bal = forHim - onHim;
      if (bal > 0) debt += bal;
    });
    employees.forEach(e => {
      const onHim = e.ledger.filter(entry => (entry.currency || 'YER') === cur).reduce((s, entry) => s + entry.amountOnHim, 0);
      const forHim = e.ledger.filter(entry => (entry.currency || 'YER') === cur).reduce((s, entry) => s + entry.amountForHim, 0);
      const bal = forHim - onHim;
      if (bal > 0) debt += bal;
    });
    if (externalDebtsByCurrency[cur]) {
      debt += externalDebtsByCurrency[cur];
    }
    acc[cur] = debt;
    return acc;
  }, {} as Record<string, number>);

  // Worker totals grouped by currency
  const workerTotalsByCurrency = workers.reduce((acc, w) => {
    w.ledger.forEach(e => {
      const cur = e.currency || 'YER';
      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
      acc[cur].onHim += e.amountOnHim;
      acc[cur].forHim += e.amountForHim;
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  // Supplier totals grouped by currency
  const supplierTotalsByCurrency = suppliers.reduce((acc, s) => {
    s.ledger.forEach(e => {
      const cur = e.currency || 'YER';
      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
      acc[cur].onHim += e.amountOnHim;
      acc[cur].forHim += e.amountForHim;
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  // Employee totals grouped by currency
  const employeeTotalsByCurrency = employees.reduce((acc, emp) => {
    emp.ledger.forEach(e => {
      const cur = e.currency || 'YER';
      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
      acc[cur].onHim += e.amountOnHim;
      acc[cur].forHim += e.amountForHim;
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  const [chartCurrency, setChartCurrency] = React.useState<string>(currency || 'YER');

  React.useEffect(() => {
    if (currency) setChartCurrency(currency);
  }, [currency]);

  // 📊 Chart Datasets
  const CATEGORY_COLORS: Record<string, string> = {
    'موارد ومواد بناء': '#f59e0b',
    'أجور وعمالة': '#0284c7',
    'مرتبات وموظفين': '#6366f1',
    'نقل وشحن': '#8b5cf6',
    'معدات وآليات': '#ec4899',
    'مصاريف إدارية وموقع': '#10b981',
    'أخرى': '#64748b'
  };

  const categoryExpensesMap = expenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if (cur === chartCurrency) {
      let cat = exp.category;
      if (!cat) {
        if (exp.recipientType === 'worker') cat = 'أجور وعمالة';
        else if (exp.recipientType === 'employee') cat = 'مرتبات وموظفين';
        else if (exp.recipientType === 'supplier') cat = 'موارد ومواد بناء';
        else cat = 'مصاريف إدارية وموقع';
      }
      acc[cat] = (acc[cat] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(categoryExpensesMap).map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name] || '#64748b'
  })).filter(item => item.value > 0);

  const financialOverviewData = ['YER', 'SAR', 'USD'].map(cur => {
    const b = budgetByCurrency[cur] || 0;
    const e = expensesByCurrency[cur] || 0;
    const rem = b - e;
    const d = debtsByCurrency[cur] || 0;
    return {
      currency: cur,
      'الميزانية المتاحة': b,
      'إجمالي المصاريف': e,
      'السيولة المتبقية': rem > 0 ? rem : 0,
      'الديون المستحقة': d
    };
  }).filter(item => item['الميزانية المتاحة'] > 0 || item['إجمالي المصاريف'] > 0 || item['الديون المستحقة'] > 0);

  const workerDebt = workers.reduce((s, w) => {
    const bal = w.ledger.reduce((l, entry) => (entry.currency || 'YER') === chartCurrency ? l + (entry.amountForHim - entry.amountOnHim) : l, 0);
    return bal > 0 ? s + bal : s;
  }, 0);

  const employeeDebt = employees.reduce((s, emp) => {
    const bal = emp.ledger.reduce((l, entry) => (entry.currency || 'YER') === chartCurrency ? l + (entry.amountForHim - entry.amountOnHim) : l, 0);
    return bal > 0 ? s + bal : s;
  }, 0);

  const supplierDebt = suppliers.reduce((s, sup) => {
    const bal = sup.ledger.reduce((l, entry) => (entry.currency || 'YER') === chartCurrency ? l + (entry.amountForHim - entry.amountOnHim) : l, 0);
    return bal > 0 ? s + bal : s;
  }, 0);

  const extDebt = externalDebtsByCurrency[chartCurrency] || 0;

  const entityDebtsData = [
    { name: 'مستحقات العمال', value: workerDebt, fill: '#0284c7' },
    { name: 'مستحقات الموظفين', value: employeeDebt, fill: '#6366f1' },
    { name: 'مستحقات الموردين', value: supplierDebt, fill: '#f59e0b' },
    { name: 'ذمم وديون خارجية', value: extDebt, fill: '#ef4444' }
  ].filter(item => item.value > 0);

  const dailyExpenseMap = expenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if (cur === chartCurrency) {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const dailyTrendData = Object.entries(dailyExpenseMap)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-10)
    .map(([date, amount]) => ({
      date: date.substring(5),
      'المبلغ المصروف': amount
    }));

  // Active currency selected states for metrics
  const totalBudget = budgetByCurrency[currency] || 0;
  const totalExpenses = expensesByCurrency[currency] || 0;
  const remainingBudget = totalBudget - totalExpenses;
  const totalDebts = debtsByCurrency[currency] || 0;

  const budgetUsagePercent = totalBudget > 0 
    ? Math.min(100, Math.round((totalExpenses / totalBudget) * 100)) 
    : 0;

  return (
    <div className="space-y-2.5 animate-fade-in" id="dashboard-tab">
      {/* 🌐 Cloud Sharing and Collaboration Modal */}
      {showShareModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in text-right overscroll-contain" 
          dir="rtl"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">المشاركة السحابية والعمل التعاوني المشترك</h3>
                  <p className="text-slate-400 text-[10px] sm:text-[11px] mt-0.5">مشاركة المشروع وصلاحيات الحسابات والشركاء لحظة بلحظة</p>
                </div>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Check if current user is guest or owner */}
              {(sharedRole && sharedRole !== 'owner') || (projectId && sharedRole !== 'owner') ? (
                /* ---------------- PARTICIPANT / GUEST VIEW ---------------- */
                <div className="p-8 text-center bg-rose-50 border border-rose-100 rounded-2xl space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold animate-pulse">
                    🔒
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-rose-800 font-extrabold text-base">صلاحية المشاركة مقيدة</h4>
                    <p className="text-rose-700 text-sm font-black leading-relaxed">
                      "صلاحية المشاركة مع اخرين تتم فقط بواسطة المهندس/ياسر عقيل للتواصل 771999911"
                    </p>
                  </div>
                  <p className="text-slate-500 text-xs">
                    بصفتك مستخدم مشارك في هذا المشروع، لا تملك الصلاحية لتعديل أو مشاركة روابط دعوة جديدة مع الآخرين.
                  </p>

                  {/* Owner quick unlock button for app installed via webintoapp or webview */}
                  <div className="pt-4 border-t border-rose-200/80">
                    <button
                      type="button"
                      onClick={() => {
                        if (onRestoreOwnerRole) {
                          onRestoreOwnerRole();
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>👑</span>
                      <span>أنا مالك المشروع (المهندس/ياسر عقيل) - استعادة حساب وصلاحية المالك</span>
                    </button>
                    <p className="text-[11px] text-slate-500 mt-2">
                      اضغط على الزر أعلاه للعودة كمالك رئيسي فوراً وفتح كافة خيارات المزامنة والمشاركة
                    </p>
                  </div>
                </div>
              ) : (
                /* ---------------- OWNER VIEW ---------------- */
                <div className="space-y-6">
                  {!projectId ? (
                    /* ---------------- NOT CONNECTED VIEW ---------------- */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Create New Shared Project */}
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <span className="inline-block text-[10px] bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full font-bold">مزامنة سحابية جديدة</span>
                          <h4 className="font-extrabold text-slate-800 text-sm">تفعيل مزامنة سحابية لهذا المشروع</h4>
                          <p className="text-slate-400 text-xs leading-relaxed">
                            سيتم ترحيل ميزانيتك ومصاريفك الحالية للسحابة فوراً مع إنشاء روابط دعوة مخصصة لمن تريد مشاركة الحسابات معهم.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            setGeneratingRole('full');
                            await onCreateShareLink?.('full');
                            setGeneratingRole(null);
                          }}
                          disabled={generatingRole !== null}
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          {generatingRole === 'full' ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Cloud className="w-4 h-4" />
                              <span>تفعيل المزامنة وتوليد روابط الدعوة</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Join Existing Shared Project */}
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">انضمام لمشروع</span>
                          <h4 className="font-extrabold text-slate-800 text-sm">الانضمام لمشروع تعاوني قائم</h4>
                          <p className="text-slate-400 text-xs leading-relaxed">
                            إذا قام مهندس أو محاسب آخر بإنشاء المشروع ومشاركته معك، يمكنك وضع معرف المشروع هنا للمزامنة والعمل معه.
                          </p>
                        </div>
                        <form onSubmit={handleJoinProjectSubmit} className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="أدخل معرف المشروع (Project ID)..."
                              value={shareInputId}
                              onChange={(e) => {
                                setShareInputId(e.target.value);
                                setShareInputError('');
                              }}
                              className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-amber-500 text-left"
                              dir="ltr"
                            />
                            <button
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                            >
                              ربط الحساب
                            </button>
                          </div>
                          {shareInputError && (
                            <p className="text-rose-500 text-[10px] font-bold">{shareInputError}</p>
                          )}
                        </form>
                      </div>
                    </div>
                  ) : (
                    /* ---------------- CONNECTED VIEW ---------------- */
                    <div className="space-y-6">
                      {/* Sync Header Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Project ID */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">معرف المشروع السحابي (ID)</span>
                            <span className="font-mono text-xs font-bold text-slate-700 select-all">{projectId}</span>
                          </div>
                          <button
                            onClick={handleCopyProjectId}
                            className="p-1.5 hover:bg-slate-200/50 rounded-lg text-slate-500 transition-colors cursor-pointer"
                            title="نسخ معرف المشروع"
                          >
                            {copiedRole === 'projectId' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>

                        {/* Sync Status */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                            <RefreshCw size={15} />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-bold">حالة المزامنة السحابية</span>
                            <span className="text-xs font-bold text-slate-700">
                              {syncStatus === 'loading' && '⏳ جاري المزامنة السحابية...'}
                              {syncStatus === 'error' && '❌ فشل الاتصال بالسيرفر'}
                              {(syncStatus === 'success' || syncStatus === 'idle' || !syncStatus) && '✅ البيانات مؤمنة ومحدثة على السحابة'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sharing invitation links */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                          <Info size={14} className="text-sky-500" />
                          روابط دعوة الشركاء والمشرفين (اضغط لتوليد ونسخ الرابط):
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Link Owner / Full */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800">صلاحيات كاملة 🛠️</span>
                                <span className="text-[9px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded font-bold">ثقة كاملة</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                يسمح للشريك بمشاهدة وإضافة وتعديل وحذف كافة العمليات الحسابية والعمال والبودجيت.
                              </p>
                            </div>
                            <button
                              onClick={() => handleCopyLink('full')}
                              disabled={generatingRole !== null}
                              className="w-full bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-800 font-bold border border-sky-100 rounded-xl py-2 px-3 text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              {generatingRole === 'full' ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : copiedRole === 'full' ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">تم نسخ الرابط!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>رابط شريك بتعديل كامل</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Link Add Only (REWORKED AS THE REQUESTED READ-AND-ADD OPTION) */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800">الاطلاع فقط مع إدخال بيانات جديدة 📝</span>
                                <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-bold">مقيد آمن</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                يسمح للمشرف بالاطلاع الكامل وإضافة بيانات ونفقات جديدة فقط، ولا يملك أي صلاحية لتعديل أو حذف العمليات السابقة.
                              </p>
                            </div>
                            <button
                              onClick={() => handleCopyLink('add')}
                              disabled={generatingRole !== null}
                              className="w-full bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 font-bold border border-amber-100 rounded-xl py-2 px-3 text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              {generatingRole === 'add' ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : copiedRole === 'add' ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">تم نسخ الرابط!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>رابط الاطلاع وإضافة جديد فقط</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Link Read Only */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3 md:col-span-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800">مراقب مالي (عرض وتقارير فقط) 👁️</span>
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">عرض فقط</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                يسمح للمستثمر أو الممول برؤية كشوفات الحساب والتقارير والديون دون إمكانية إضافة أو تغيير أي شيء.
                              </p>
                            </div>
                            <button
                              onClick={() => handleCopyLink('read')}
                              disabled={generatingRole !== null}
                              className="w-full bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 font-bold border border-emerald-100 rounded-xl py-2.5 px-3 text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              {generatingRole === 'read' ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : copiedRole === 'read' ? (
                                <>
                                  <Check size={12} className="text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">تم نسخ الرابط!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>رابط عرض وتقارير فقط</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quit/Disconnect Cloud project */}
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button
                          onClick={async () => {
                            if (confirm('هل أنت متأكد من إلغاء المزامنة السحابية؟ سيؤدي ذلك لتعطيل وإلغاء كافة روابط الدعوة نهائياً ومنع الوصول عبرها والعودة للوضع المحلي.')) {
                              if (onCancelCloudSync) {
                                await onCancelCloudSync();
                              } else {
                                onSetProjectId?.('');
                              }
                              setShowShareModal(false);
                            }
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline transition-colors cursor-pointer"
                        >
                          🔴 إلغاء المزامنة السحابية للعودة للوضع المحلي الفردي الموقّت
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowShareModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-5 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🚀 INTEGRATED EXECUTIVE ACCESS & CLOUD SYNC HUB */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-800 shadow-md relative overflow-hidden space-y-3.5" id="quick-links-panel">
        {/* Ambient Decorative Lighting */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full filter blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -ml-10 -mb-10"></div>

        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-400/30 shadow-2xs">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-xs sm:text-sm">الوصول السريع إلى النوافذ والأقسام</h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-semibold">تنقل مباشر وسلس لكافة الوحدات الماليّة، العمالة، والإحصائيات</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60">
            <Sparkles size={11} className="text-amber-400" />
            <span>لوحة التحكم الموحدة</span>
          </div>
        </div>

        {/* Quick Navigation Cards Grid (8 Items) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5 relative z-10">
          
          {/* Daily Expenses */}
          <button 
            onClick={() => setActiveTab('expenses')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/70 hover:border-rose-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-rose-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <TrendingUp size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-rose-300 transition-colors">النفقات اليومية</span>
          </button>

          {/* Workers */}
          <button 
            onClick={() => setActiveTab('workers')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-sky-950/40 border border-slate-700/70 hover:border-sky-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-sky-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Users size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-sky-300 transition-colors">إدارة العمال</span>
          </button>

          {/* Employees */}
          <button 
            onClick={() => setActiveTab('employees')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-indigo-950/40 border border-slate-700/70 hover:border-indigo-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Briefcase size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">إدارة الموظفين</span>
          </button>

          {/* Suppliers */}
          <button 
            onClick={() => setActiveTab('suppliers')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-amber-950/40 border border-slate-700/70 hover:border-amber-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Truck size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-amber-300 transition-colors">إدارة الموردين</span>
          </button>

          {/* Budget */}
          <button 
            onClick={() => setActiveTab('budget')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-emerald-950/40 border border-slate-700/70 hover:border-emerald-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Wallet size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-emerald-300 transition-colors">الميزانية العامة</span>
          </button>

          {/* Debts */}
          <button 
            onClick={() => setActiveTab('debts')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-amber-950/40 border border-slate-700/70 hover:border-amber-400/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Coins size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-amber-300 transition-colors">الديون والالتزامات</span>
          </button>

          {/* Reports */}
          <button 
            onClick={() => setActiveTab('reports')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-violet-950/40 border border-slate-700/70 hover:border-violet-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-violet-600 group-hover:text-white transition-all duration-200 shadow-2xs">
              <FileText size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-violet-300 transition-colors">التقارير الشاملة</span>
          </button>

          {/* Backup */}
          <button 
            onClick={() => setActiveTab('backup')}
            className="flex flex-col items-center justify-center p-2 sm:p-2.5 bg-slate-800/80 hover:bg-cyan-950/40 border border-slate-700/70 hover:border-cyan-500/50 rounded-xl shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-200 shadow-2xs">
              <Database size={18} />
            </div>
            <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">النسخ الاحتياطي</span>
          </button>

        </div>

        {/* Integrated Cloud Sharing & Local Mode Sub-Bar */}
        <div className="border-t border-slate-800/80 pt-3 mt-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-amber-500/20 text-amber-400 rounded-md border border-amber-400/30">
              <Share2 size={14} />
            </div>
            <div>
              <span className="font-extrabold text-xs text-white block">المشاركة السحابية والربط المحلي</span>
              <span className="text-[10px] text-slate-400 font-medium">مزامنة البيانات والتعاون المباشر أو الحفظ المحلي المستقل</span>
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 sm:flex-none bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black py-1.5 px-3.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border border-amber-400/40"
            >
              <Share2 size={13} />
              <span>المشاركة السحابية والتعاون</span>
            </button>
            
            {projectId ? (
              <span className="inline-flex items-center justify-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 font-bold shrink-0">
                <Cloud size={11} className="animate-pulse text-emerald-400" />
                <span>مترابط سحابياً</span>
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1 text-[10px] bg-slate-800/90 text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-700 font-bold shrink-0">
                <Lock size={11} className="text-slate-400" />
                <span>وضع محلي فردي</span>
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 📊 INTERACTIVE CHARTS & ANALYTICS SECTION (Placed directly below quick links panel) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5" id="dashboard-charts-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <BarChart2 size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm">التحليلات المالية والرسوم البيانية المباشرة</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">مؤشرات إحصائية تفاعلية لحجم المصاريف، توزيع البنود، وهيكل الالتزامات المالية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">عرض بالعملة:</span>
            <select 
              value={chartCurrency} 
              onChange={(e) => setChartCurrency(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-sky-500 font-mono"
            >
              <option value="YER">الريال اليمني (YER)</option>
              <option value="SAR">الريال السعودي (SAR)</option>
              <option value="USD">الدولار الأمريكي (USD)</option>
            </select>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
          
          {/* Chart 1: Expenses Category Breakdown Pie Chart */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <PieChartIcon size={15} className="text-amber-500" />
                توزيع المصاريف والنفقات حسب البنود ({currency})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">{pieChartData.length} بند</span>
            </div>
            
            {pieChartData.length === 0 ? (
              <div className="h-44 sm:h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>لا توجد مصاريف مخصصة بهذه العملة حالياً</span>
              </div>
            ) : (
              <div className="h-44 sm:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: number) => [formatCurrency(val, currency), 'المبلغ']}
                      contentStyle={{ direction: 'rtl', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={32} 
                      iconType="circle"
                      formatter={(value) => <span className="text-[10px] sm:text-[11px] font-bold text-slate-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 2: Daily Expenses Trend Area Chart */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <TrendingUp size={15} className="text-sky-500" />
                منحنى التدفقات والنفقات اليومية الأخير ({currency})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">آخر العمليات</span>
            </div>

            {dailyTrendData.length === 0 ? (
              <div className="h-44 sm:h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>لا توجد عمليات نفقات مسجلة بهذه العملة</span>
              </div>
            ) : (
              <div className="h-44 sm:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={55} />
                    <Tooltip 
                      formatter={(val: number) => [formatCurrency(val, currency), 'المبلغ']}
                      contentStyle={{ direction: 'rtl', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="المبلغ المصروف" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 3: Financial Indicators Comparison across Currencies BarChart */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
              <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <BarChart2 size={15} className="text-emerald-500" />
                مقارنة الميزانية المتاحة مقابل المصاريف والسيولة والديون
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">شامل كافة العملات</span>
            </div>

            {financialOverviewData.length === 0 ? (
              <div className="h-44 sm:h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>لا توجد بيانات مالية متوفرة</span>
              </div>
            ) : (
              <div className="h-44 sm:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialOverviewData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="currency" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#334155' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={55} />
                    <Tooltip 
                      formatter={(val: number, name: string) => [formatCurrency(val, ''), name]}
                      contentStyle={{ direction: 'rtl', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={32} iconType="circle" formatter={(val) => <span className="text-[10px] sm:text-[11px] font-bold text-slate-600">{val}</span>} />
                    <Bar dataKey="الميزانية المتاحة" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="إجمالي المصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="السيولة المتبقية" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="الديون المستحقة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Chart 4: Debts Distribution by Entity BarChart */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <Coins size={16} className="text-indigo-500" />
                توزيع مستحقات الديون المطلوبة للغير حسب الجهة ({currency})
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">عمال، موظفين، موردين</span>
            </div>

            {entityDebtsData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>لا توجد ديون مستحقة مسجلة بهذه العملة 🎉</span>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entityDebtsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#334155' }} width={110} />
                    <Tooltip 
                      formatter={(val: number) => [formatCurrency(val, currency), 'المستحق الصافي']}
                      contentStyle={{ direction: 'rtl', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {entityDebtsData.map((entry, index) => (
                        <Cell key={`debt-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Budget Card */}
        <div 
          onClick={() => setActiveTab('budget')}
          className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100 shadow-xs hover:border-emerald-200 transition-all cursor-pointer group"
          id="kpi-budget"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium text-sm">إجمالي الميزانية</span>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
              <Wallet size={20} />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalBudget, currency)}</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono border-t border-emerald-100/50 pt-1.5 mt-1">
              {Object.entries(budgetByCurrency).map(([cur, val]) => (
                <span key={cur} className={cur === currency ? 'font-bold text-emerald-600' : ''}>
                  {cur}: {formatCurrency(val, cur)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div 
          onClick={() => setActiveTab('expenses')}
          className="bg-gradient-to-br from-rose-50 to-white p-6 rounded-2xl border border-rose-100 shadow-xs hover:border-rose-200 transition-all cursor-pointer group"
          id="kpi-expenses"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium text-sm">النفقات اليومية</span>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalExpenses, currency)}</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono border-t border-rose-100/50 pt-1.5 mt-1">
              {Object.entries(expensesByCurrency).map(([cur, val]) => (
                <span key={cur} className={cur === currency ? 'font-bold text-rose-600' : ''}>
                  {cur}: {formatCurrency(val, cur)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Net Remaining Card */}
        <div 
          className={`p-6 rounded-2xl border shadow-xs transition-all ${
            remainingBudget < 0 
              ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200' 
              : 'bg-gradient-to-br from-blue-50 to-white border-blue-100'
          }`}
          id="kpi-remaining"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium text-sm">الميزانية المتبقية</span>
            <div className={`p-2.5 rounded-xl ${
              remainingBudget < 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
            }`}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              {formatCurrency(remainingBudget, currency)}
            </h3>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono border-t border-slate-100 pt-1.5 mt-1">
              {['YER', 'SAR', 'USD'].map(cur => {
                const rem = (budgetByCurrency[cur] || 0) - (expensesByCurrency[cur] || 0);
                if (!budgetByCurrency[cur] && !expensesByCurrency[cur]) return null;
                return (
                  <span key={cur} className={cur === currency ? (rem < 0 ? 'font-bold text-rose-600' : 'font-bold text-blue-600') : ''}>
                    {cur}: {formatCurrency(rem, cur)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* New KPI: Company Debts (بند الديون والالتزامات المستحقة) */}
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl border border-amber-100 shadow-xs hover:border-amber-200 transition-all cursor-pointer group"
          id="kpi-debts"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600 font-medium text-sm">الديون المستحقة</span>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
              <Coins size={20} />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalDebts, currency)}</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono border-t border-amber-100/50 pt-1.5 mt-1">
              {Object.entries(debtsByCurrency).map(([cur, val]) => {
                if (val === 0) return null;
                return (
                  <span key={cur} className={cur === currency ? 'font-bold text-amber-600' : ''}>
                    {cur}: {formatCurrency(val, cur)}
                  </span>
                );
              })}
              {Object.values(debtsByCurrency).every(v => v === 0) && (
                <span className="text-[10px] text-slate-400">لا توجد ديون</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Progress & Warning Zone */}
      {totalBudget > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-3" id="budget-utilization-section">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">نسبة استهلاك الميزانية ({currency})</span>
            <span className={`text-sm font-bold ${budgetUsagePercent > 90 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {budgetUsagePercent}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                budgetUsagePercent > 90 ? 'bg-rose-500' : budgetUsagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${budgetUsagePercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>تم صرف: {formatCurrency(totalExpenses, currency)}</span>
            <span>الميزانية المرصودة: {formatCurrency(totalBudget, currency)}</span>
          </div>
        </div>
      )}

      {/* Ledger Balances Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Workers Ledger Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs" id="dashboard-workers-summary">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-sky-500" />
              ملخص حسابات العمال
            </h3>
            <button 
              onClick={() => setActiveTab('workers')} 
              className="text-xs text-sky-600 hover:underline font-semibold flex items-center gap-1"
            >
              عرض الكل
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mb-4">
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
              <span className="text-xs text-slate-500 block">إجمالي السلف (عليهم)</span>
              <span className="font-bold text-rose-700 text-base">
                {formatCurrency(workerTotalsByCurrency[currency]?.onHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(workerTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.onHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.onHim, cur)}</span>;
                })}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="text-xs text-slate-500 block">إجمالي المستحقات (لهم)</span>
              <span className="font-bold text-emerald-700 text-base">
                {formatCurrency(workerTotalsByCurrency[currency]?.forHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(workerTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.forHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.forHim, cur)}</span>;
                })}
              </div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {workers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا يوجد عمال مضافين حالياً</p>
            ) : (
              workers.slice(0, 4).map(w => {
                const balances = w.ledger.reduce((acc, e) => {
                  const cur = e.currency || 'YER';
                  if (!acc[cur]) acc[cur] = 0;
                  acc[cur] += e.amountForHim - e.amountOnHim;
                  return acc;
                }, {} as Record<string, number>);

                const activeBalances = Object.entries(balances).filter(([_, val]) => val !== 0);

                return (
                  <div key={w.id} className="p-2 hover:bg-slate-50 rounded-lg text-xs border-b border-slate-50 last:border-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{w.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{w.profession}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end font-mono text-[10px]">
                      {activeBalances.length === 0 ? (
                        <span className="text-slate-400">خالص الطرفين</span>
                      ) : (
                        activeBalances.map(([cur, val]) => (
                          <span key={cur} className={val < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {cur}: {val > 0 ? 'له' : 'عليه'} {formatCurrency(Math.abs(val), cur)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Employees Ledger Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs" id="dashboard-employees-summary">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Briefcase size={18} className="text-indigo-600" />
              ملخص حسابات الموظفين
            </h3>
            <button 
              onClick={() => setActiveTab('employees')} 
              className="text-xs text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              عرض الكل
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mb-4">
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
              <span className="text-xs text-slate-500 block">إجمالي السلف (عليهم)</span>
              <span className="font-bold text-rose-700 text-base font-mono">
                {formatCurrency(employeeTotalsByCurrency[currency]?.onHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(employeeTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.onHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.onHim, cur)}</span>;
                })}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="text-xs text-slate-500 block">إجمالي المستحقات (لهم)</span>
              <span className="font-bold text-emerald-700 text-base font-mono">
                {formatCurrency(employeeTotalsByCurrency[currency]?.forHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(employeeTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.forHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.forHim, cur)}</span>;
                })}
              </div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا يوجد موظفين مضافين حالياً</p>
            ) : (
              employees.slice(0, 4).map(e => {
                const balances = e.ledger.reduce((acc, entry) => {
                  const cur = entry.currency || 'YER';
                  if (!acc[cur]) acc[cur] = 0;
                  acc[cur] += entry.amountForHim - entry.amountOnHim;
                  return acc;
                }, {} as Record<string, number>);

                const activeBalances = Object.entries(balances).filter(([_, val]) => val !== 0);

                return (
                  <div key={e.id} className="p-2 hover:bg-slate-50 rounded-lg text-xs border-b border-slate-50 last:border-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{e.name}</span>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">{e.profession}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end font-mono text-[10px]">
                      {activeBalances.length === 0 ? (
                        <span className="text-slate-400">خالص الطرفين</span>
                      ) : (
                        activeBalances.map(([cur, val]) => (
                          <span key={cur} className={val < 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {cur}: {val > 0 ? 'له' : 'عليه'} {formatCurrency(Math.abs(val), cur)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Suppliers Ledger Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs" id="dashboard-suppliers-summary">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Truck size={18} className="text-amber-500" />
              ملخص حسابات الموردين
            </h3>
            <button 
              onClick={() => setActiveTab('suppliers')} 
              className="text-xs text-amber-600 hover:underline font-semibold flex items-center gap-1"
            >
              عرض الكل
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mb-4">
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
              <span className="text-xs text-slate-500 block">إجمالي المسدد (عليهم)</span>
              <span className="font-bold text-rose-700 text-base">
                {formatCurrency(supplierTotalsByCurrency[currency]?.onHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(supplierTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.onHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.onHim, cur)}</span>;
                })}
              </div>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <span className="text-xs text-slate-500 block">قيمة المواد (لهم)</span>
              <span className="font-bold text-emerald-700 text-base">
                {formatCurrency(supplierTotalsByCurrency[currency]?.forHim || 0, currency)}
              </span>
              <div className="flex flex-wrap justify-center gap-x-2 text-[9px] text-slate-400 mt-1 font-mono">
                {Object.entries(supplierTotalsByCurrency).map(([cur, totals]) => {
                  if (cur === currency || totals.forHim === 0) return null;
                  return <span key={cur}>{cur}: {formatCurrency(totals.forHim, cur)}</span>;
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا يوجد موردين مضافين حالياً</p>
            ) : (
              suppliers.slice(0, 4).map(s => {
                const balances = s.ledger.reduce((acc, e) => {
                  const cur = e.currency || 'YER';
                  if (!acc[cur]) acc[cur] = 0;
                  acc[cur] += e.amountForHim - e.amountOnHim;
                  return acc;
                }, {} as Record<string, number>);

                const activeBalances = Object.entries(balances).filter(([_, val]) => val !== 0);

                return (
                  <div key={s.id} className="p-2 hover:bg-slate-50 rounded-lg text-xs border-b border-slate-50 last:border-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{s.materialType}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end font-mono text-[10px]">
                      {activeBalances.length === 0 ? (
                        <span className="text-slate-400">خالص الطرفين</span>
                      ) : (
                        activeBalances.map(([cur, val]) => (
                          <span key={cur} className={val < 0 ? 'text-rose-600' : 'text-purple-600'}>
                            {cur}: {val > 0 ? 'له' : 'عليه'} {formatCurrency(Math.abs(val), cur)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
