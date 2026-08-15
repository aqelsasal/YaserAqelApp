/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { isOwnerUser } from './AttributionBadge';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Calendar, 
  Filter, 
  TrendingUp, 
  Wallet, 
  Users, 
  Truck, 
  Coins, 
  ArrowLeft, 
  Info, 
  X,
  Check,
  Download,
  LayoutDashboard,
  Briefcase,
  PieChart,
  BarChart2
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
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts';
import { COMPANY_LOGO_BASE64 } from '../companyLogo';
import { 
  BudgetItem, 
  Expense, 
  Worker, 
  Supplier, 
  Employee,
  formatCurrency, 
  formatDateArabic,
  printPDF,
  getFormattedReportDate,
  ensureDateInFilename
} from '../types';
import * as XLSX from 'xlsx';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';

interface FinancialReportsProps {
  budget: BudgetItem[];
  expenses: Expense[];
  workers: Worker[];
  suppliers: Supplier[];
  employees?: Employee[];
  currency?: string;
  setActiveTab: (tab: string) => void;
  sharedRole?: string;
}

export default function FinancialReports({
  budget,
  expenses,
  workers,
  suppliers,
  employees = [],
  currency = 'YER',
  setActiveTab,
  sharedRole
}: FinancialReportsProps) {
  // Date filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Section toggle states (to allow customizing the report content)
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currency);
  const [includeDashboard, setIncludeDashboard] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeExpensesSummaryOnly, setIncludeExpensesSummaryOnly] = useState(false);
  const [includeWorkers, setIncludeWorkers] = useState(true);
  const [includeEmployees, setIncludeEmployees] = useState(true);
  const [includeSuppliers, setIncludeSuppliers] = useState(true);
  const [includeDetailedLedgers, setIncludeDetailedLedgers] = useState(true);
  const [includeDebts, setIncludeDebts] = useState(true);

  // Status for showing export toast/feedback
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Filter helper
  const filterByDateRange = (dateStr: string) => {
    if (!dateStr) return true;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // Filtered data sets
  const filteredBudget = budget.filter(item => filterByDateRange(item.date));
  const filteredExpenses = expenses.filter(item => filterByDateRange(item.date));
  
  // For workers, employees, and suppliers, filter ledger entries by date range
  const activeCurrencies = ['YER', 'SAR', 'USD'];

  // 1. Funding Totals
  const fundingTotals = filteredBudget.reduce((acc, item) => {
    const cur = item.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  // 2. Expenses Totals
  const expensesTotals = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  // 3. Workers wages and advances for filtered period
  const workerTotals = workers.reduce((acc, w) => {
    w.ledger.forEach(entry => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
        acc[cur].onHim += entry.amountOnHim || 0;
        acc[cur].forHim += entry.amountForHim || 0;
      }
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  // 4. Employees wages and advances for filtered period
  const employeeTotals = employees.reduce((acc, e) => {
    e.ledger.forEach(entry => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
        acc[cur].onHim += entry.amountOnHim || 0;
        acc[cur].forHim += entry.amountForHim || 0;
      }
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  // 5. Suppliers totals for filtered period
  const supplierTotals = suppliers.reduce((acc, s) => {
    s.ledger.forEach(entry => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
        acc[cur].onHim += entry.amountOnHim || 0;
        acc[cur].forHim += entry.amountForHim || 0;
      }
    });
    return acc;
  }, {} as Record<string, { onHim: number; forHim: number }>);

  // 6. Calculate Debts: Company Debts (لهم - عليهم > 0)
  const workerDebtsByCur = workers.reduce((acc, w) => {
    const balances = w.ledger.reduce((lAcc, entry) => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
        lAcc[cur].onHim += entry.amountOnHim || 0;
        lAcc[cur].forHim += entry.amountForHim || 0;
      }
      return lAcc;
    }, {} as Record<string, { onHim: number; forHim: number }>);

    Object.entries(balances).forEach(([cur, val]) => {
      const net = val.forHim - val.onHim;
      if (net > 0) {
        acc[cur] = (acc[cur] || 0) + net;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const employeeDebtsByCur = employees.reduce((acc, e) => {
    const balances = e.ledger.reduce((lAcc, entry) => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
        lAcc[cur].onHim += entry.amountOnHim || 0;
        lAcc[cur].forHim += entry.amountForHim || 0;
      }
      return lAcc;
    }, {} as Record<string, { onHim: number; forHim: number }>);

    Object.entries(balances).forEach(([cur, val]) => {
      const net = val.forHim - val.onHim;
      if (net > 0) {
        acc[cur] = (acc[cur] || 0) + net;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const supplierDebtsByCur = suppliers.reduce((acc, s) => {
    const balances = s.ledger.reduce((lAcc, entry) => {
      if (filterByDateRange(entry.date)) {
        const cur = entry.currency || 'YER';
        if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
        lAcc[cur].onHim += entry.amountOnHim || 0;
        lAcc[cur].forHim += entry.amountForHim || 0;
      }
      return lAcc;
    }, {} as Record<string, { onHim: number; forHim: number }>);

    Object.entries(balances).forEach(([cur, val]) => {
      const net = val.forHim - val.onHim;
      if (net > 0) {
        acc[cur] = (acc[cur] || 0) + net;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const externalDebtsByCur = (() => {
    try {
      const saved = localStorage.getItem('site_external_debts');
      if (!saved) return {};
      const extAccounts = JSON.parse(saved);
      if (!Array.isArray(extAccounts)) return {};
      return extAccounts.reduce((acc: Record<string, number>, ext: any) => {
        const balances: Record<string, { forHim: number; onHim: number }> = {};
        (ext.ledger || []).forEach((entry: any) => {
          if (filterByDateRange(entry.date)) {
            const cur = entry.currency || 'YER';
            if (!balances[cur]) balances[cur] = { forHim: 0, onHim: 0 };
            balances[cur].forHim += entry.amountForHim || 0;
            balances[cur].onHim += entry.amountOnHim || 0;
          }
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

  const totalDebtsByCur = {} as Record<string, number>;
  activeCurrencies.forEach(cur => {
    const total = (workerDebtsByCur[cur] || 0) + 
                  (supplierDebtsByCur[cur] || 0) + 
                  (employeeDebtsByCur[cur] || 0) + 
                  (externalDebtsByCur[cur] || 0);
    if (total > 0) {
      totalDebtsByCur[cur] = total;
    }
  });

  // Expense distribution by recipient type
  const expenseDistribution = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if (!acc[cur]) acc[cur] = { worker: 0, employee: 0, supplier: 0, none: 0 };
    const type = exp.recipientType || 'none';
    acc[cur][type] = (acc[cur][type] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, { worker: number; employee: number; supplier: number; none: number }>);

  // Expense distribution by expense type (direct vs indirect)
  const directExpensesTotals = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if ((exp.expenseType || 'direct') === 'direct') {
      acc[cur] = (acc[cur] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const indirectExpensesTotals = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if ((exp.expenseType || 'direct') === 'indirect') {
      acc[cur] = (acc[cur] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  // Remaining Cash by currency (Funding - Expenses)
  const cashRemainingByCur = {} as Record<string, number>;
  activeCurrencies.forEach(cur => {
    cashRemainingByCur[cur] = (fundingTotals[cur] || 0) - (expensesTotals[cur] || 0);
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    triggerToast('تم إعادة تعيين فلاتر التاريخ كلياً');
  };

  // Helper to group expenses by date and currency for daily totals view
  const getExpensesByDate = () => {
    const grouped: Record<string, Record<string, { totalAmount: number; count: number; descriptions: string[] }>> = {};
    
    // Sort expenses from newest to oldest date
    const sorted = [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date));

    sorted.forEach(exp => {
      const d = exp.date;
      const cur = exp.currency || 'YER';
      if (!grouped[d]) grouped[d] = {};
      if (!grouped[d][cur]) {
        grouped[d][cur] = { totalAmount: 0, count: 0, descriptions: [] };
      }
      grouped[d][cur].totalAmount += exp.amount;
      grouped[d][cur].count += 1;
      if (exp.description && !grouped[d][cur].descriptions.includes(exp.description)) {
        grouped[d][cur].descriptions.push(exp.description);
      }
    });

    const result: { date: string; currency: string; totalAmount: number; count: number; descriptionSummary: string }[] = [];

    Object.entries(grouped)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .forEach(([date, curMap]) => {
      Object.entries(curMap).forEach(([currency, info]) => {
        result.push({
          date,
          currency,
          totalAmount: info.totalAmount,
          count: info.count,
          descriptionSummary: info.descriptions.join('، ')
        });
      });
    });

    return result;
  };

  // 📊 Chart Datasets for FinancialReports
  const reportCategoryExpenses = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if (cur === selectedCurrency) {
      const cat = exp.category || 'أخرى';
      acc[cat] = (acc[cat] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const reportCategoryChartData = Object.entries(reportCategoryExpenses).map(([name, value]) => ({
    name,
    value,
  })).filter(i => i.value > 0);

  const reportRecipientExpensesData = [
    { name: 'مصاريف العمال', value: expenseDistribution[selectedCurrency]?.worker || 0, fill: '#38bdf8' },
    { name: 'مصاريف الموظفين', value: expenseDistribution[selectedCurrency]?.employee || 0, fill: '#818cf8' },
    { name: 'مصاريف الموردين', value: expenseDistribution[selectedCurrency]?.supplier || 0, fill: '#fbbf24' },
    { name: 'مصاريف عامة', value: expenseDistribution[selectedCurrency]?.none || 0, fill: '#94a3b8' }
  ].filter(i => i.value > 0);

  const reportDebtsDistributionData = [
    { name: 'مستحقات العمال', value: workerDebtsByCur[selectedCurrency] || 0, fill: '#38bdf8' },
    { name: 'مستحقات الموظفين', value: employeeDebtsByCur[selectedCurrency] || 0, fill: '#818cf8' },
    { name: 'مستحقات الموردين', value: supplierDebtsByCur[selectedCurrency] || 0, fill: '#fbbf24' },
    { name: 'ديون خارجية', value: externalDebtsByCur[selectedCurrency] || 0, fill: '#f87171' }
  ].filter(i => i.value > 0);

  const reportDailyExpenseMap = filteredExpenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    if (cur === selectedCurrency) {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const reportDailyTrendData = Object.entries(reportDailyExpenseMap)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .slice(-12)
    .map(([date, amount]) => ({
      date: date.substring(5),
      'المصروف': amount
    }));

  const REPORT_CHART_COLORS = ['#38bdf8', '#fbbf24', '#818cf8', '#34d399', '#f472b6', '#a78bfa', '#94a3b8'];

  // =================================== EXCEL GENERATION ===================================
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Sheet: الملخص العام
      const summaryRows = [
        ['تقرير الملخص المالي العام لمشروع الإعمار والمقاولات'],
        [`فترة التقرير: ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`],
        [`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}`],
        [],
        ['البيان المالي الكلي', 'الريال اليمني (YER)', 'الريال السعودي (SAR)', 'الدولار الأمريكي (USD)'],
        [
          'إجمالي التمويل الموفر', 
          fundingTotals['YER'] || 0, 
          fundingTotals['SAR'] || 0, 
          fundingTotals['USD'] || 0
        ],
        [
          'إجمالي النفقات والمصاريف', 
          expensesTotals['YER'] || 0, 
          expensesTotals['SAR'] || 0, 
          expensesTotals['USD'] || 0
        ],
        [
          '  - نفقات مباشرة', 
          directExpensesTotals['YER'] || 0, 
          directExpensesTotals['SAR'] || 0, 
          directExpensesTotals['USD'] || 0
        ],
        [
          '  - نفقات غير مباشرة', 
          indirectExpensesTotals['YER'] || 0, 
          indirectExpensesTotals['SAR'] || 0, 
          indirectExpensesTotals['USD'] || 0
        ],
        [
          'صافي الصندوق / السيولة المتبقية', 
          cashRemainingByCur['YER'] || 0, 
          cashRemainingByCur['SAR'] || 0, 
          cashRemainingByCur['USD'] || 0
        ],
        [
          'إجمالي الديون المستحقة للعمال والموظفين والموردين', 
          totalDebtsByCur['YER'] || 0, 
          totalDebtsByCur['SAR'] || 0, 
          totalDebtsByCur['USD'] || 0
        ],
        [],
        ['* ملاحظة: صافي الصندوق = إجمالي التمويل - إجمالي المصاريف والنفقات اليومية.'],
        ['* إجمالي الديون المستحقة = مجموع المستحقات الصافية للعمال والموظفين والموردين التي لم تُسدد بعد.']
      ];
      const ws_summary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws_summary, 'الملخص المالي العام');

      // 2. Sheet: سجل التمويل والميزانية
      if (includeBudget) {
        const budgetHeaders = [['التاريخ', 'البيان (مصدر التمويل)', 'المبلغ', 'العملة', 'ملاحظات', 'بواسطة']];
        const sortedBudgetForExport = [...filteredBudget].sort((a, b) => b.date.localeCompare(a.date));
        const budgetData = sortedBudgetForExport.map(item => [
          item.date,
          item.description,
          item.amount,
          item.currency || 'YER',
          item.notes || '-',
          (item.createdBy && !isOwnerUser(item.createdBy)) ? item.createdBy : '-'
        ]);
        const ws_budget = XLSX.utils.aoa_to_sheet([...budgetHeaders, ...budgetData]);
        XLSX.utils.book_append_sheet(wb, ws_budget, 'التمويل والميزانية');
      }

      // 3. Sheet: النفقات اليومية
      if (includeExpenses) {
        if (includeExpensesSummaryOnly) {
          const dailyTotals = getExpensesByDate();
          const expenseHeaders = [['التاريخ', 'عدد العمليات اليومية', 'إجمالي المبلغ اليومي', 'العملة', 'النسبة المئوية من إجمالي المصاريف']];
          const expenseData = dailyTotals.map(item => {
            const totalForCur = expensesTotals[item.currency] || 0;
            const pct = totalForCur > 0 ? `${((item.totalAmount / totalForCur) * 100).toFixed(1)}%` : '0%';
            return [
              item.date,
              item.count,
              item.totalAmount,
              item.currency,
              pct
            ];
          });
          const ws_expenses = XLSX.utils.aoa_to_sheet([...expenseHeaders, ...expenseData]);
          XLSX.utils.book_append_sheet(wb, ws_expenses, 'إجمالي النفقات اليومية');
        } else {
          const expenseHeaders = [['التاريخ', 'البيان والمصروف', 'نوع النفقة', 'المبلغ', 'العملة', 'ترحيل لحساب', 'الاسم المرحل إليه', 'ملاحظات', 'بواسطة']];
          const sortedExpensesForExport = [...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date));
          const expenseData = sortedExpensesForExport.map(exp => [
            exp.date,
            exp.description,
            (exp.expenseType || 'direct') === 'indirect' ? 'نفقات غير مباشرة' : 'نفقات مباشرة',
            exp.amount,
            exp.currency || 'YER',
            exp.recipientType === 'worker' ? 'عامل' : exp.recipientType === 'employee' ? 'موظف' : exp.recipientType === 'supplier' ? 'مورد' : 'مصروف عام',
            exp.recipientName || '-',
            exp.notes || '-',
            (exp.createdBy && !isOwnerUser(exp.createdBy)) ? exp.createdBy : '-'
          ]);
          const ws_expenses = XLSX.utils.aoa_to_sheet([...expenseHeaders, ...expenseData]);
          XLSX.utils.book_append_sheet(wb, ws_expenses, 'النفقات اليومية');
        }
      }

      // 4. Sheet: كشف حسابات العمال + تفاصيل الحركة
      if (includeWorkers) {
        const workerHeaders = [['اسم العامل', 'المهنة', 'تاريخ المباشرة', 'إجمالي الأجور المستحقة (له)', 'إجمالي السلف والمدفوع (عليه)', 'صافي الرصيد الحالي', 'العملة']];
        const workerData: any[] = [];
        
        workers.forEach(w => {
          const balances = w.ledger.reduce((acc, entry) => {
            if (filterByDateRange(entry.date)) {
              const cur = entry.currency || 'YER';
              if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
              acc[cur].onHim += entry.amountOnHim || 0;
              acc[cur].forHim += entry.amountForHim || 0;
            }
            return acc;
          }, {} as Record<string, { onHim: number; forHim: number }>);

          const currencies = Object.keys(balances);
          if (currencies.length === 0) {
            workerData.push([w.name, w.profession, w.startDate, 0, 0, 0, currency]);
          } else {
            currencies.forEach(cur => {
              const val = balances[cur];
              const net = val.forHim - val.onHim;
              workerData.push([
                w.name,
                w.profession,
                w.startDate,
                val.forHim,
                val.onHim,
                net,
                cur
              ]);
            });
          }
        });

        const ws_workers = XLSX.utils.aoa_to_sheet([...workerHeaders, ...workerData]);
        XLSX.utils.book_append_sheet(wb, ws_workers, 'حسابات العمال (ملخص)');
      }

      // Detailed Worker Ledgers Sheet
      if (includeDetailedLedgers && workers.length > 0) {
        const workerLedgerHeaders = [['اسم العامل', 'المهنة / التخصص', 'تاريخ الحركة', 'البيان / الوصف التفصيلي', 'مبلغ له (أجور ومكافآت)', 'مبلغ عليه (سلف ومسحوبات)', 'العملة', 'الملاحظات', 'بواسطة']];
        const workerLedgerData: any[] = [];
        workers.forEach(w => {
          w.ledger.forEach(entry => {
            if (filterByDateRange(entry.date)) {
              workerLedgerData.push([
                w.name,
                w.profession,
                entry.date,
                entry.description,
                entry.amountForHim || 0,
                entry.amountOnHim || 0,
                entry.currency || currency,
                entry.notes || '-',
                (entry.createdBy && !isOwnerUser(entry.createdBy)) ? entry.createdBy : '-'
              ]);
            }
          });
        });
        if (workerLedgerData.length > 0) {
          workerLedgerData.sort((a, b) => b[2].localeCompare(a[2]));
          const ws_worker_ledgers = XLSX.utils.aoa_to_sheet([...workerLedgerHeaders, ...workerLedgerData]);
          XLSX.utils.book_append_sheet(wb, ws_worker_ledgers, 'تفاصيل حركات العمال');
        }
      }

      // 5. Sheet: كشف حسابات الموظفين + تفاصيل الحركة
      if (includeEmployees) {
        const employeeHeaders = [['اسم الموظف', 'المسمى الوظيفي', 'تاريخ المباشرة', 'الأجر اليومي', 'إجمالي المستحقات والرواتب (له)', 'إجمالي السلف والمسحوبات (عليه)', 'صافي الرصيد الحالي', 'العملة']];
        const employeeData: any[] = [];

        employees.forEach(e => {
          const balances = e.ledger.reduce((acc, entry) => {
            if (filterByDateRange(entry.date)) {
              const cur = entry.currency || 'YER';
              if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
              acc[cur].onHim += entry.amountOnHim || 0;
              acc[cur].forHim += entry.amountForHim || 0;
            }
            return acc;
          }, {} as Record<string, { onHim: number; forHim: number }>);

          const currencies = Object.keys(balances);
          if (currencies.length === 0) {
            employeeData.push([e.name, e.profession, e.startDate, e.dailyWage || 0, 0, 0, 0, currency]);
          } else {
            currencies.forEach(cur => {
              const val = balances[cur];
              const net = val.forHim - val.onHim;
              employeeData.push([
                e.name,
                e.profession,
                e.startDate,
                e.dailyWage || 0,
                val.forHim,
                val.onHim,
                net,
                cur
              ]);
            });
          }
        });

        const ws_employees = XLSX.utils.aoa_to_sheet([...employeeHeaders, ...employeeData]);
        XLSX.utils.book_append_sheet(wb, ws_employees, 'حسابات الموظفين (ملخص)');
      }

      // Detailed Employee Ledgers Sheet
      if (includeDetailedLedgers && employees.length > 0) {
        const empLedgerHeaders = [['اسم الموظف', 'المسمى الوظيفي', 'تاريخ الحركة', 'البيان / الوصف التفصيلي', 'مبلغ له (راتب ومستحق)', 'مبلغ عليه (سلفة ومسحوبات)', 'العملة', 'الملاحظات', 'بواسطة']];
        const empLedgerData: any[] = [];
        employees.forEach(e => {
          e.ledger.forEach(entry => {
            if (filterByDateRange(entry.date)) {
              empLedgerData.push([
                e.name,
                e.profession,
                entry.date,
                entry.description,
                entry.amountForHim || 0,
                entry.amountOnHim || 0,
                entry.currency || currency,
                entry.notes || '-',
                (entry.createdBy && !isOwnerUser(entry.createdBy)) ? entry.createdBy : '-'
              ]);
            }
          });
        });
        if (empLedgerData.length > 0) {
          empLedgerData.sort((a, b) => b[2].localeCompare(a[2]));
          const ws_emp_ledgers = XLSX.utils.aoa_to_sheet([...empLedgerHeaders, ...empLedgerData]);
          XLSX.utils.book_append_sheet(wb, ws_emp_ledgers, 'تفاصيل حركات الموظفين');
        }
      }

      // 6. Sheet: كشف حسابات الموردين + تفاصيل الحركة
      if (includeSuppliers) {
        const supplierHeaders = [['اسم المورد', 'نوع المواد', 'إجمالي قيمة التوريد (له)', 'إجمالي المبالغ المسددة (عليه)', 'صافي الرصيد الحالي', 'العملة']];
        const supplierData: any[] = [];

        suppliers.forEach(s => {
          const balances = s.ledger.reduce((acc, entry) => {
            if (filterByDateRange(entry.date)) {
              const cur = entry.currency || 'YER';
              if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
              acc[cur].onHim += entry.amountOnHim || 0;
              acc[cur].forHim += entry.amountForHim || 0;
            }
            return acc;
          }, {} as Record<string, { onHim: number; forHim: number }>);

          const currencies = Object.keys(balances);
          if (currencies.length === 0) {
            supplierData.push([s.name, s.materialType, 0, 0, 0, currency]);
          } else {
            currencies.forEach(cur => {
              const val = balances[cur];
              const net = val.forHim - val.onHim;
              supplierData.push([
                s.name,
                s.materialType,
                val.forHim,
                val.onHim,
                net,
                cur
              ]);
            });
          }
        });

        const ws_suppliers = XLSX.utils.aoa_to_sheet([...supplierHeaders, ...supplierData]);
        XLSX.utils.book_append_sheet(wb, ws_suppliers, 'حسابات الموردين (ملخص)');
      }

      // Detailed Supplier Ledgers Sheet
      if (includeDetailedLedgers && suppliers.length > 0) {
        const supplierLedgerHeaders = [['اسم المورد', 'نوع المواد الموردة', 'تاريخ الحركة', 'البيان / الفاتورة', 'مبلغ له (توريد مواد)', 'مبلغ عليه (سداد / دفعة)', 'العملة', 'الملاحظات', 'بواسطة']];
        const supplierLedgerData: any[] = [];
        suppliers.forEach(s => {
          s.ledger.forEach(entry => {
            if (filterByDateRange(entry.date)) {
              supplierLedgerData.push([
                s.name,
                s.materialType,
                entry.date,
                entry.description,
                entry.amountForHim || 0,
                entry.amountOnHim || 0,
                entry.currency || currency,
                entry.notes || '-',
                (entry.createdBy && !isOwnerUser(entry.createdBy)) ? entry.createdBy : '-'
              ]);
            }
          });
        });
        if (supplierLedgerData.length > 0) {
          supplierLedgerData.sort((a, b) => b[2].localeCompare(a[2]));
          const ws_supplier_ledgers = XLSX.utils.aoa_to_sheet([...supplierLedgerHeaders, ...supplierLedgerData]);
          XLSX.utils.book_append_sheet(wb, ws_supplier_ledgers, 'تفاصيل حركات الموردين');
        }
      }

      // Save workbook
      const fileDate = getFormattedReportDate();
      XLSX.writeFile(wb, ensureDateInFilename(`التقرير_المالي_المفصل_${fileDate}.xlsx`));
      triggerToast('🎉 تم تصدير تقرير Excel الشامل بنجاح! تم حفظ الملف في جهازك.');
    } catch (err) {
      console.error(err);
      triggerToast('❌ فشل تصدير ملف Excel. يرجى التحقق من البيانات.');
    }
  };

  // =================================== PDF/PRINT GENERATION ===================================
  const handleExportPDF = () => {
    const reportTitle = "التقرير المالي الشامل للمشروع";
    const reportDateRange = `الفترة المحددة: من ${startDate ? formatDateArabic(startDate) : 'تأسيس المشروع'} إلى ${endDate ? formatDateArabic(endDate) : 'اليوم الحاضر'}`;
    const extractionDate = new Date().toLocaleDateString('ar-EG-u-nu-latn');

    const compName = localStorage.getItem('site_company_name') || 'شركة ورلد أوف إيليتس للمقاولات والخدمات';
    const projName = localStorage.getItem('site_project_name') || 'مشروع المقاولات والإنشاءات الرئيسي';
    const compAddress = localStorage.getItem('site_company_address') || 'صنعاء - شارع الستين - عمارة النخبة';
    const compPhone = localStorage.getItem('site_company_phone') || '+967 770 000 000 / +967 01 200000';

    let bodyHtml = '';

    // 📊 DASHBOARD VISUAL SUMMARY IN PDF
    if (includeDashboard) {
      const mainFunding = fundingTotals[currency] || 0;
      const mainExpenses = expensesTotals[currency] || 0;
      const usagePct = mainFunding > 0 ? Math.min(100, Math.round((mainExpenses / mainFunding) * 100)) : 0;

      bodyHtml += `
        <div style="margin-bottom: 25px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 15px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #0369a1; font-weight: bold;">📊 لوحة التحليلات المباشرة والداشبورد (Dashboard Summary)</h3>
            <span style="font-size: 10px; background-color: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 12px; font-weight: bold;">العملة الرئيسية: ${currency}</span>
          </div>

          <!-- KPI Cards Grid -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">إجمالي التمويل</div>
              <div style="font-size: 13px; font-weight: bold; color: #16a34a; margin-top: 2px; font-family: monospace;">${formatCurrency(mainFunding, currency)}</div>
            </div>
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">إجمالي المصاريف</div>
              <div style="font-size: 13px; font-weight: bold; color: #dc2626; margin-top: 2px; font-family: monospace;">${formatCurrency(mainExpenses, currency)}</div>
            </div>
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">صافي الصندوق</div>
              <div style="font-size: 13px; font-weight: bold; color: #2563eb; margin-top: 2px; font-family: monospace;">${formatCurrency(cashRemainingByCur[currency] || 0, currency)}</div>
            </div>
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">إجمالي المطلوبات والديون</div>
              <div style="font-size: 13px; font-weight: bold; color: #d97706; margin-top: 2px; font-family: monospace;">${formatCurrency(totalDebtsByCur[currency] || 0, currency)}</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div style="margin-bottom: 12px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 5px;">
              <span>مؤشر استهلاك الميزانية المعتمدة:</span>
              <span>${usagePct}%</span>
            </div>
            <div style="width: 100%; height: 10px; background-color: #e2e8f0; border-radius: 5px; overflow: hidden;">
              <div style="width: ${usagePct}%; height: 100%; background-color: ${usagePct > 90 ? '#dc2626' : '#2563eb'}; border-radius: 5px;"></div>
            </div>
          </div>

          <!-- Distributions -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div>
              <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 4px;">توزيع المصاريف حسب الأطراف (${currency}):</div>
              <table style="margin: 0; font-size: 11px; width: 100%;">
                <tbody>
                  <tr><td>👷 مصاريف وسلف العمال</td><td style="font-weight: bold; font-family: monospace; text-align: left;">${formatCurrency(expenseDistribution[currency]?.worker || 0, currency)}</td></tr>
                  <tr><td>👔 مصاريف وسلف الموظفين</td><td style="font-weight: bold; font-family: monospace; text-align: left;">${formatCurrency(expenseDistribution[currency]?.employee || 0, currency)}</td></tr>
                  <tr><td>🚚 مصاريف ودفعات الموردين</td><td style="font-weight: bold; font-family: monospace; text-align: left;">${formatCurrency(expenseDistribution[currency]?.supplier || 0, currency)}</td></tr>
                  <tr><td>📦 مصاريف عامة وغير مرحلة</td><td style="font-weight: bold; font-family: monospace; text-align: left;">${formatCurrency(expenseDistribution[currency]?.none || 0, currency)}</td></tr>
                </tbody>
              </table>
            </div>

            <div>
              <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 4px;">توزيع الديون والالتزامات المستحقة (${currency}):</div>
              <table style="margin: 0; font-size: 11px; width: 100%;">
                <tbody>
                  <tr><td>👷 ديون ومستحقات العمال</td><td style="font-weight: bold; color: #d97706; font-family: monospace; text-align: left;">${formatCurrency(workerDebtsByCur[currency] || 0, currency)}</td></tr>
                  <tr><td>👔 ديون ومستحقات الموظفين</td><td style="font-weight: bold; color: #d97706; font-family: monospace; text-align: left;">${formatCurrency(employeeDebtsByCur[currency] || 0, currency)}</td></tr>
                  <tr><td>🚚 ديون ومستحقات الموردين</td><td style="font-weight: bold; color: #d97706; font-family: monospace; text-align: left;">${formatCurrency(supplierDebtsByCur[currency] || 0, currency)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    // 📈 1. GENERAL FINANCIAL KPI SUMMARY TABLE
    bodyHtml += `
      <div style="margin-bottom: 25px;">
        <h3 class="report-section-title">أولاً: الخلاصة والمؤشرات المالية العامة</h3>
        <table class="report-data-table">
          <thead>
            <tr>
              <th>المؤشر المالي الكلي</th>
              <th>الريال اليمني (YER)</th>
              <th>الريال السعودي (SAR)</th>
              <th>الدولار الأمريكي (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: bold;">إجمالي التمويل المتوفر (رأس المال)</td>
              <td style="font-weight: bold; color: #16a34a; font-family: monospace;">${formatCurrency(fundingTotals['YER'] || 0, 'YER')}</td>
              <td style="font-weight: bold; color: #16a34a; font-family: monospace;">${formatCurrency(fundingTotals['SAR'] || 0, 'SAR')}</td>
              <td style="font-weight: bold; color: #16a34a; font-family: monospace;">${formatCurrency(fundingTotals['USD'] || 0, 'USD')}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">إجمالي المصاريف والنفقات اليومية</td>
              <td style="font-weight: bold; color: #dc2626; font-family: monospace;">${formatCurrency(expensesTotals['YER'] || 0, 'YER')}</td>
              <td style="font-weight: bold; color: #dc2626; font-family: monospace;">${formatCurrency(expensesTotals['SAR'] || 0, 'SAR')}</td>
              <td style="font-weight: bold; color: #dc2626; font-family: monospace;">${formatCurrency(expensesTotals['USD'] || 0, 'USD')}</td>
            </tr>
            <tr style="font-size: 11px;">
              <td style="padding-right: 20px; color: #047857;">- نفقات مباشرة</td>
              <td style="font-family: monospace; color: #047857;">${formatCurrency(directExpensesTotals['YER'] || 0, 'YER')}</td>
              <td style="font-family: monospace; color: #047857;">${formatCurrency(directExpensesTotals['SAR'] || 0, 'SAR')}</td>
              <td style="font-family: monospace; color: #047857;">${formatCurrency(directExpensesTotals['USD'] || 0, 'USD')}</td>
            </tr>
            <tr style="font-size: 11px;">
              <td style="padding-right: 20px; color: #b45309;">- نفقات غير مباشرة</td>
              <td style="font-family: monospace; color: #b45309;">${formatCurrency(indirectExpensesTotals['YER'] || 0, 'YER')}</td>
              <td style="font-family: monospace; color: #b45309;">${formatCurrency(indirectExpensesTotals['SAR'] || 0, 'SAR')}</td>
              <td style="font-family: monospace; color: #b45309;">${formatCurrency(indirectExpensesTotals['USD'] || 0, 'USD')}</td>
            </tr>
            <tr style="background-color: #f1f5f9;">
              <td style="font-weight: bold;">صافي السيولة المتبقية (الصندوق الجاري)</td>
              <td style="font-weight: bold; color: #2563eb; font-family: monospace;">${formatCurrency(cashRemainingByCur['YER'] || 0, 'YER')}</td>
              <td style="font-weight: bold; color: #2563eb; font-family: monospace;">${formatCurrency(cashRemainingByCur['SAR'] || 0, 'SAR')}</td>
              <td style="font-weight: bold; color: #2563eb; font-family: monospace;">${formatCurrency(cashRemainingByCur['USD'] || 0, 'USD')}</td>
            </tr>
            <tr style="background-color: #fef2f2;">
              <td style="font-weight: bold; color: #854d0e;">إجمالي الديون المستحقة للغير (عمال، موظفين، موردين)</td>
              <td style="font-weight: bold; color: #854d0e; font-family: monospace;">${formatCurrency(totalDebtsByCur['YER'] || 0, 'YER')}</td>
              <td style="font-weight: bold; color: #854d0e; font-family: monospace;">${formatCurrency(totalDebtsByCur['SAR'] || 0, 'SAR')}</td>
              <td style="font-weight: bold; color: #854d0e; font-family: monospace;">${formatCurrency(totalDebtsByCur['USD'] || 0, 'USD')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // 2. CAPITAL FUNDING DETAILS
    if (includeBudget) {
      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h3 class="report-section-title">ثانياً: دفعات تمويل الميزانية ورأس المال</h3>
          ${filteredBudget.length === 0 ? `
            <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد دفعات تمويل مسجلة في هذه الفترة</p>
          ` : `
            <table class="report-data-table">
              <thead>
                <tr>
                  <th style="width: 15%;">التاريخ</th>
                  <th style="width: 40%;">البيان (مصدر التمويل)</th>
                  <th style="width: 20%;">المبلغ</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                ${[...filteredBudget].sort((a, b) => b.date.localeCompare(a.date)).map(item => `
                  <tr>
                    <td style="font-family: monospace;">${item.date}</td>
                    <td>${item.description}</td>
                    <td style="font-weight: bold; font-family: monospace; color: #16a34a;">${formatCurrency(item.amount, item.currency || 'YER')}</td>
                    <td style="font-size: 12px; color: #64748b;">${item.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    // 3. DAILY EXPENSES DETAILS / TOTALS
    if (includeExpenses) {
      if (includeExpensesSummaryOnly) {
        const dailyTotals = getExpensesByDate();
        bodyHtml += `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 class="report-section-title">ثالثاً: إجمالي مبالغ النفقات اليومية لكل يوم (تجميع حسب التاريخ)</h3>
            ${dailyTotals.length === 0 ? `
              <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد نفقات يومية مسجلة في هذه الفترة</p>
            ` : `
              <table class="report-data-table">
                <thead>
                  <tr>
                    <th style="width: 20%;">التاريخ</th>
                    <th style="width: 18%;">عدد العمليات</th>
                    <th style="width: 25%;">إجمالي المبلغ اليومي</th>
                    <th style="width: 15%;">العملة</th>
                    <th style="width: 22%; text-align: center;">النسبة المئوية من إجمالي المصاريف</th>
                  </tr>
                </thead>
                <tbody>
                  ${dailyTotals.map(item => {
                    const totalForCur = expensesTotals[item.currency] || 0;
                    const pct = totalForCur > 0 ? ((item.totalAmount / totalForCur) * 100).toFixed(1) : '0.0';
                    return `
                      <tr>
                        <td style="font-family: monospace;">${item.date}</td>
                        <td style="font-family: monospace; text-align: center;">${item.count} ${item.count === 1 ? 'عملية' : 'عمليات'}</td>
                        <td style="font-weight: bold; font-family: monospace; color: #dc2626;">${formatCurrency(item.totalAmount, item.currency)}</td>
                        <td style="font-family: monospace;">${item.currency}</td>
                        <td style="font-family: monospace; font-weight: bold; color: #2563eb; text-align: center;">${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      } else {
        bodyHtml += `
          <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 class="report-section-title">ثالثاً: كشف النفقات والمصاريف اليومية بالتفصيل</h3>
            ${filteredExpenses.length === 0 ? `
              <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد نفقات يومية مسجلة في هذه الفترة</p>
            ` : `
              <table class="report-data-table">
                <thead>
                  <tr>
                    <th style="width: 14%;">التاريخ</th>
                    <th style="width: 30%;">البيان (المصروف)</th>
                    <th style="width: 16%;">نوع النفقة</th>
                    <th style="width: 16%;">المبلغ</th>
                    <th style="width: 14%;">الترحيل</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...filteredExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(exp => {
                    const isIndirect = (exp.expenseType || 'direct') === 'indirect';
                    return `
                    <tr>
                      <td style="font-family: monospace;">${exp.date}</td>
                      <td>${exp.description}</td>
                      <td style="text-align: center;">
                        <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${isIndirect ? 'background-color: #fef3c7; color: #b45309;' : 'background-color: #d1fae5; color: #047857;'}">
                          ${isIndirect ? 'غير مباشرة' : 'مباشرة'}
                        </span>
                      </td>
                      <td style="font-weight: bold; font-family: monospace; color: #dc2626;">${formatCurrency(exp.amount, exp.currency || 'YER')}</td>
                      <td>
                        ${exp.recipientType === 'worker' ? `<span style="color:#0284c7; font-weight:bold;">عامل: ${exp.recipientName}</span>` : 
                          exp.recipientType === 'employee' ? `<span style="color:#059669; font-weight:bold;">موظف: ${exp.recipientName}</span>` :
                          exp.recipientType === 'supplier' ? `<span style="color:#d97706; font-weight:bold;">مورد: ${exp.recipientName}</span>` : 
                          '<span style="color:#64748b;">مصروف عام</span>'}
                      </td>
                      <td style="font-size: 11px; color: #64748b;">${exp.notes || '-'}</td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        `;
      }
    }

    // 4. WORKERS BALANCES
    if (includeWorkers) {
      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h3 class="report-section-title">رابعاً: كشف مستحقات العمال والذمم</h3>
          ${workers.length === 0 ? `
            <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا يوجد عمال مسجلين في المشروع</p>
          ` : `
            <table class="report-data-table">
              <thead>
                <tr>
                  <th>اسم العامل</th>
                  <th>المهنة / التخصص</th>
                  <th>تاريخ البدء</th>
                  <th>إجمالي مستحقاته (له)</th>
                  <th>إجمالي السلف والمسحوبات (عليه)</th>
                  <th>صافي رصيد العامل</th>
                </tr>
              </thead>
              <tbody>
                ${workers.map(w => {
                  const balances = w.ledger.reduce((acc, entry) => {
                    if (filterByDateRange(entry.date)) {
                      const cur = entry.currency || 'YER';
                      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
                      acc[cur].onHim += entry.amountOnHim || 0;
                      acc[cur].forHim += entry.amountForHim || 0;
                    }
                    return acc;
                  }, {} as Record<string, { onHim: number; forHim: number }>);

                  const curKeys = Object.keys(balances);
                  if (curKeys.length === 0) {
                    return `
                      <tr>
                        <td style="font-weight: bold;">${w.name}</td>
                        <td>${w.profession}</td>
                        <td style="font-family: monospace;">${w.startDate}</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="color: #64748b;">خالص الطرفين</td>
                      </tr>
                    `;
                  }

                  return curKeys.map(cur => {
                    const vals = balances[cur];
                    const net = vals.forHim - vals.onHim;
                    let balanceText = '';
                    if (net === 0) balanceText = '<span style="color: #64748b;">خالص</span>';
                    else if (net > 0) balanceText = `<span style="color: #16a34a; font-weight: bold;">له: ${formatCurrency(net, cur)}</span>`;
                    else balanceText = `<span style="color: #dc2626; font-weight: bold;">عليه: ${formatCurrency(Math.abs(net), cur)}</span>`;

                    return `
                      <tr>
                        <td style="font-weight: bold;">${w.name}</td>
                        <td>${w.profession}</td>
                        <td style="font-family: monospace;">${w.startDate}</td>
                        <td style="font-family: monospace; color: #1e293b;">${formatCurrency(vals.forHim, cur)}</td>
                        <td style="font-family: monospace; color: #64748b;">${formatCurrency(vals.onHim, cur)}</td>
                        <td>${balanceText}</td>
                      </tr>
                    `;
                  }).join('');
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    // 5. EMPLOYEES BALANCES
    if (includeEmployees) {
      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h3 class="report-section-title">خامساً: كشف مستحقات الموظفين والرواتب</h3>
          ${employees.length === 0 ? `
            <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا يوجد موظفين مسجلين في المشروع</p>
          ` : `
            <table class="report-data-table">
              <thead>
                <tr>
                  <th>اسم الموظف</th>
                  <th>المسمى الوظيفي</th>
                  <th>تاريخ المباشرة</th>
                  <th>إجمالي مستحقاته (له)</th>
                  <th>إجمالي السلف والمسحوبات (عليه)</th>
                  <th>صافي رصيد الموظف</th>
                </tr>
              </thead>
              <tbody>
                ${employees.map(e => {
                  const balances = e.ledger.reduce((acc, entry) => {
                    if (filterByDateRange(entry.date)) {
                      const cur = entry.currency || 'YER';
                      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
                      acc[cur].onHim += entry.amountOnHim || 0;
                      acc[cur].forHim += entry.amountForHim || 0;
                    }
                    return acc;
                  }, {} as Record<string, { onHim: number; forHim: number }>);

                  const curKeys = Object.keys(balances);
                  if (curKeys.length === 0) {
                    return `
                      <tr>
                        <td style="font-weight: bold;">${e.name}</td>
                        <td>${e.profession}</td>
                        <td style="font-family: monospace;">${e.startDate}</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="color: #64748b;">خالص الطرفين</td>
                      </tr>
                    `;
                  }

                  return curKeys.map(cur => {
                    const vals = balances[cur];
                    const net = vals.forHim - vals.onHim;
                    let balanceText = '';
                    if (net === 0) balanceText = '<span style="color: #64748b;">خالص</span>';
                    else if (net > 0) balanceText = `<span style="color: #16a34a; font-weight: bold;">له: ${formatCurrency(net, cur)}</span>`;
                    else balanceText = `<span style="color: #dc2626; font-weight: bold;">عليه: ${formatCurrency(Math.abs(net), cur)}</span>`;

                    return `
                      <tr>
                        <td style="font-weight: bold;">${e.name}</td>
                        <td>${e.profession}</td>
                        <td style="font-family: monospace;">${e.startDate}</td>
                        <td style="font-family: monospace; color: #1e293b;">${formatCurrency(vals.forHim, cur)}</td>
                        <td style="font-family: monospace; color: #64748b;">${formatCurrency(vals.onHim, cur)}</td>
                        <td>${balanceText}</td>
                      </tr>
                    `;
                  }).join('');
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    // 6. SUPPLIERS BALANCES
    if (includeSuppliers) {
      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h3 class="report-section-title">سادساً: كشف حسابات الموردين وتوريد المواد</h3>
          ${suppliers.length === 0 ? `
            <p style="text-align: center; font-size: 13px; color: #64748b; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا يوجد موردين مسجلين في المشروع</p>
          ` : `
            <table class="report-data-table">
              <thead>
                <tr>
                  <th>اسم المورد</th>
                  <th>نوع المواد الموردة</th>
                  <th>إجمالي قيمة المواد (له)</th>
                  <th>إجمالي المبالغ المسددة (عليه)</th>
                  <th>صافي الحساب</th>
                </tr>
              </thead>
              <tbody>
                ${suppliers.map(s => {
                  const balances = s.ledger.reduce((acc, entry) => {
                    if (filterByDateRange(entry.date)) {
                      const cur = entry.currency || 'YER';
                      if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
                      acc[cur].onHim += entry.amountOnHim || 0;
                      acc[cur].forHim += entry.amountForHim || 0;
                    }
                    return acc;
                  }, {} as Record<string, { onHim: number; forHim: number }>);

                  const curKeys = Object.keys(balances);
                  if (curKeys.length === 0) {
                    return `
                      <tr>
                        <td style="font-weight: bold;">${s.name}</td>
                        <td>${s.materialType}</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="font-family: monospace;">0</td>
                        <td style="color: #64748b;">خالص الطرفين</td>
                      </tr>
                    `;
                  }

                  return curKeys.map(cur => {
                    const vals = balances[cur];
                    const net = vals.forHim - vals.onHim;
                    let balanceText = '';
                    if (net === 0) balanceText = '<span style="color: #64748b;">خالص</span>';
                    else if (net > 0) balanceText = `<span style="color: #d97706; font-weight: bold;">له: ${formatCurrency(net, cur)}</span>`;
                    else balanceText = `<span style="color: #9333ea; font-weight: bold;">عليه: ${formatCurrency(Math.abs(net), cur)}</span>`;

                    return `
                      <tr>
                        <td style="font-weight: bold;">${s.name}</td>
                        <td>${s.materialType}</td>
                        <td style="font-family: monospace; color: #1e293b;">${formatCurrency(vals.forHim, cur)}</td>
                        <td style="font-family: monospace; color: #64748b;">${formatCurrency(vals.onHim, cur)}</td>
                        <td>${balanceText}</td>
                      </tr>
                    `;
                  }).join('');
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    // 7. DETAILED DEBTS / LIABILITIES
    if (includeDebts) {
      const liabilityItems: { name: string; type: string; details: string; amount: number; currency: string }[] = [];
      
      workers.forEach(w => {
        const balances = w.ledger.reduce((acc, entry) => {
          if (filterByDateRange(entry.date)) {
            const cur = entry.currency || 'YER';
            acc[cur] = (acc[cur] || 0) + (entry.amountForHim - entry.amountOnHim);
          }
          return acc;
        }, {} as Record<string, number>);

        Object.entries(balances).forEach(([cur, bal]) => {
          if (bal > 0) {
            liabilityItems.push({
              name: w.name,
              type: 'عامل مستحق',
              details: w.profession,
              amount: bal,
              currency: cur
            });
          }
        });
      });

      employees.forEach(e => {
        const balances = e.ledger.reduce((acc, entry) => {
          if (filterByDateRange(entry.date)) {
            const cur = entry.currency || 'YER';
            acc[cur] = (acc[cur] || 0) + (entry.amountForHim - entry.amountOnHim);
          }
          return acc;
        }, {} as Record<string, number>);

        Object.entries(balances).forEach(([cur, bal]) => {
          if (bal > 0) {
            liabilityItems.push({
              name: e.name,
              type: 'موظف مستحق',
              details: e.profession,
              amount: bal,
              currency: cur
            });
          }
        });
      });

      suppliers.forEach(s => {
        const balances = s.ledger.reduce((acc, entry) => {
          if (filterByDateRange(entry.date)) {
            const cur = entry.currency || 'YER';
            acc[cur] = (acc[cur] || 0) + (entry.amountForHim - entry.amountOnHim);
          }
          return acc;
        }, {} as Record<string, number>);

        Object.entries(balances).forEach(([cur, bal]) => {
          if (bal > 0) {
            liabilityItems.push({
              name: s.name,
              type: 'مورد مستحق',
              details: s.materialType,
              amount: bal,
              currency: cur
            });
          }
        });
      });

      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <h3 class="report-section-title">سابعاً: تفصيل الديون والالتزامات المستحقة على المشروع</h3>
          ${liabilityItems.length === 0 ? `
            <p style="text-align: center; font-size: 13px; color: #16a34a; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-weight: bold;">🎉 لا توجد التزامات أو ديون مستحقة للغير على المشروع حالياً!</p>
          ` : `
            <table class="report-data-table">
              <thead>
                <tr>
                  <th>اسم الجهة / الشخص</th>
                  <th>نوع الالتزام</th>
                  <th>البيان والتفاصيل</th>
                  <th>المبلغ المستحق</th>
                  <th>العملة</th>
                </tr>
              </thead>
              <tbody>
                ${liabilityItems.map(item => `
                  <tr>
                    <td style="font-weight: bold;">${item.name}</td>
                    <td><span style="font-size:12px; font-weight:bold; color: #78350f; background:#fef3c7; padding:2px 6px; border-radius:4px;">${item.type}</span></td>
                    <td style="color: #64748b;">${item.details}</td>
                    <td style="font-weight: bold; font-family: monospace; color: #b45309;">${formatCurrency(item.amount, item.currency)}</td>
                    <td style="font-family: monospace;">${item.currency}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    // 8. ALL DETAILED TRANSACTIONS LEDGER (FOR WORKERS, EMPLOYEES, SUPPLIERS)
    if (includeDetailedLedgers) {
      const workerEntries = workers.flatMap(w => 
        w.ledger.filter(e => filterByDateRange(e.date)).map(entry => ({ worker: w, entry }))
      ).sort((a, b) => b.entry.date.localeCompare(a.entry.date));

      const employeeEntries = employees.flatMap(emp => 
        emp.ledger.filter(e => filterByDateRange(e.date)).map(entry => ({ employee: emp, entry }))
      ).sort((a, b) => b.entry.date.localeCompare(a.entry.date));

      const supplierEntries = suppliers.flatMap(s => 
        s.ledger.filter(e => filterByDateRange(e.date)).map(entry => ({ supplier: s, entry }))
      ).sort((a, b) => b.entry.date.localeCompare(a.entry.date));

      bodyHtml += `
        <div style="margin-bottom: 25px; page-break-before: always;">
          <h3 class="report-section-title">ثامناً: كشف تفصيلي لكل العمليات والحركات المالية المدخلة (العمال، الموظفين، والموردين)</h3>

          <!-- Workers Detailed Ledgers Table -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: bold; color: #0284c7; margin-bottom: 8px; background-color: #f0f9ff; padding: 6px 10px; border-radius: 4px; border-right: 3px solid #0284c7;">
              👷 تفاصيل جميع العمليات والحركات المالية الخاصة بالعمال (${workerEntries.length} حركة)
            </div>
            ${workerEntries.length === 0 ? `
              <p style="text-align: center; font-size: 12px; color: #64748b; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد حركات عمال مدخلة في هذه الفترة</p>
            ` : `
              <table class="report-data-table">
                <thead>
                  <tr>
                    <th style="width: 12%;">التاريخ</th>
                    <th style="width: 18%;">اسم العامل</th>
                    <th style="width: 14%;">المهنة</th>
                    <th style="width: 26%;">البيان / الوصف التفصيلي</th>
                    <th style="width: 15%;">مبلغ له (أجور)</th>
                    <th style="width: 15%;">مبلغ عليه (سلف)</th>
                  </tr>
                </thead>
                <tbody>
                  ${workerEntries.map(({ worker, entry }) => `
                    <tr>
                      <td style="font-family: monospace;">${entry.date}</td>
                      <td style="font-weight: bold;">${worker.name}</td>
                      <td style="font-size: 11px; color: #475569;">${worker.profession}</td>
                      <td>${entry.description || '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #16a34a;">${entry.amountForHim > 0 ? formatCurrency(entry.amountForHim, entry.currency || currency) : '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #dc2626;">${entry.amountOnHim > 0 ? formatCurrency(entry.amountOnHim, entry.currency || currency) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <!-- Employees Detailed Ledgers Table -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: bold; color: #059669; margin-bottom: 8px; background-color: #f0fdf4; padding: 6px 10px; border-radius: 4px; border-right: 3px solid #059669;">
              👔 تفاصيل جميع العمليات والحركات المالية الخاصة بالموظفين والرواتب (${employeeEntries.length} حركة)
            </div>
            ${employeeEntries.length === 0 ? `
              <p style="text-align: center; font-size: 12px; color: #64748b; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد حركات موظفين مدخلة في هذه الفترة</p>
            ` : `
              <table class="report-data-table">
                <thead>
                  <tr>
                    <th style="width: 12%;">التاريخ</th>
                    <th style="width: 18%;">اسم الموظف</th>
                    <th style="width: 14%;">المسمى الوظيفي</th>
                    <th style="width: 26%;">البيان / الوصف التفصيلي</th>
                    <th style="width: 15%;">مبلغ له (راتب)</th>
                    <th style="width: 15%;">مبلغ عليه (سلفة)</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeeEntries.map(({ employee, entry }) => `
                    <tr>
                      <td style="font-family: monospace;">${entry.date}</td>
                      <td style="font-weight: bold;">${employee.name}</td>
                      <td style="font-size: 11px; color: #475569;">${employee.profession}</td>
                      <td>${entry.description || '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #16a34a;">${entry.amountForHim > 0 ? formatCurrency(entry.amountForHim, entry.currency || currency) : '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #dc2626;">${entry.amountOnHim > 0 ? formatCurrency(entry.amountOnHim, entry.currency || currency) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <!-- Suppliers Detailed Ledgers Table -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: bold; color: #d97706; margin-bottom: 8px; background-color: #fffbeb; padding: 6px 10px; border-radius: 4px; border-right: 3px solid #d97706;">
              🚚 تفاصيل جميع العمليات والحركات المالية الخاصة بالموردين وتوريد المواد (${supplierEntries.length} حركة)
            </div>
            ${supplierEntries.length === 0 ? `
              <p style="text-align: center; font-size: 12px; color: #64748b; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">لا توجد حركات موردين مدخلة في هذه الفترة</p>
            ` : `
              <table class="report-data-table">
                <thead>
                  <tr>
                    <th style="width: 12%;">التاريخ</th>
                    <th style="width: 18%;">اسم المورد</th>
                    <th style="width: 14%;">نوع المواد</th>
                    <th style="width: 26%;">البيان / الفاتورة</th>
                    <th style="width: 15%;">مبلغ له (توريد)</th>
                    <th style="width: 15%;">مبلغ عليه (سداد)</th>
                  </tr>
                </thead>
                <tbody>
                  ${supplierEntries.map(({ supplier, entry }) => `
                    <tr>
                      <td style="font-family: monospace;">${entry.date}</td>
                      <td style="font-weight: bold;">${supplier.name}</td>
                      <td style="font-size: 11px; color: #475569;">${supplier.materialType}</td>
                      <td>${entry.description || '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #16a34a;">${entry.amountForHim > 0 ? formatCurrency(entry.amountForHim, entry.currency || currency) : '-'}</td>
                      <td style="font-weight: bold; font-family: monospace; color: #dc2626;">${entry.amountOnHim > 0 ? formatCurrency(entry.amountOnHim, entry.currency || currency) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

        </div>
      `;
    }

    // Wrap bodyHtml in official repeating Header and Footer document structure
    const fullHtml = `
      <div class="pdf-report-root" dir="rtl">
        <style>
          @media print {
            @page {
              margin: 10mm 10mm 12mm 10mm;
              size: A4 portrait;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            thead.report-header {
              display: table-header-group !important;
            }
            tfoot.report-footer {
              display: table-footer-group !important;
            }
            tr {
              page-break-inside: avoid;
            }
          }

          .report-section-title {
            font-size: 13px;
            font-weight: 800;
            color: #0369a1;
            background-color: #f0f9ff;
            border-right: 4px solid #0284c7;
            border-bottom: 1px solid #bae6fd;
            padding: 8px 12px;
            margin-top: 18px;
            margin-bottom: 10px;
            border-radius: 4px;
            page-break-after: avoid;
          }

          table.report-data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 15px;
            font-size: 11.5px;
          }

          table.report-data-table th {
            background-color: #1e293b !important;
            color: #ffffff !important;
            font-weight: bold;
            text-align: right;
            padding: 8px 10px;
            border: 1px solid #0f172a;
            font-size: 11.5px;
          }

          table.report-data-table td {
            padding: 7px 10px;
            border: 1px solid #cbd5e1;
            text-align: right;
            font-size: 11.5px;
          }

          table.report-data-table tr:nth-child(even) td {
            background-color: #f8fafc;
          }
        </style>

        <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
          <thead class="report-header" style="display: table-header-group;">
            <tr>
              <td style="border: none; padding: 0 0 12px 0;">
                <div style="padding-bottom: 10px; border-bottom: 3px double #0f172a; margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; direction: rtl; gap: 12px;">
                    
                    <!-- Right Side (الجانب الأيمن) -->
                    <div style="text-align: right; flex: 1;">
                      <div style="font-size: 13px; font-weight: bold; color: #0f172a; line-height: 1.3;">${compName}</div>
                      <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">الإدارة المالية والتنفيذية للمشاريع</div>
                      <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">قسم الحسابات والرقابة المالية</div>
                    </div>

                    <!-- Center (الوسط) -->
                    <div style="text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                      <div style="width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d97706; margin-bottom: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.12); background-color: #ffffff;">
                        <img src="${COMPANY_LOGO_BASE64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="شعار الشركة" />
                      </div>
                      <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${reportTitle}</div>
                      <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${reportDateRange}</div>
                    </div>

                    <!-- Left Side (الجانب الأيسر) -->
                    <div style="text-align: left; flex: 1;">
                      <div style="font-size: 10.5px; font-weight: bold; color: #0f172a;">الحسابات وإدارة المشاريع</div>
                      <div style="font-size: 10.5px; font-weight: bold; color: #0284c7; margin-top: 2px;">المشروع: ${projName}</div>
                      <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">تاريخ استخراج التقرير: ${extractionDate}</div>
                      <div style="font-size: 9.5px; font-weight: bold; color: #16a34a; margin-top: 2px;">الحالة: تقرير مالي رسمي معتمد داخلياً</div>
                    </div>

                  </div>
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style="border: none; padding: 0;">
                ${bodyHtml}
              </td>
            </tr>
          </tbody>

          <tfoot class="report-footer" style="display: table-footer-group;">
            <tr>
              <td style="border: none; padding-top: 12px;">
                <div style="border-top: 1.5px solid #cbd5e1; padding-top: 6px; font-size: 10px; color: #475569; display: flex; justify-content: space-between; align-items: center; direction: rtl;">
                  <span style="font-weight: bold; color: #0f172a;">${compName}</span>
                  <span>عنوان الشركة: ${compAddress}</span>
                  <span>أرقام التواصل: ${compPhone}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Call the print utility
    printPDF(reportTitle, fullHtml);
    triggerToast('📋 تم توليد ملف الـ PDF بنجاح في معاينة الطباعة المدمجة!');
  };

  return (
    <div className="space-y-4 animate-fade-in text-right" dir="rtl" id="reports-tab">
      
      {/* Upper Navigation Header */}
      <PageHeaderCard
        title="التقارير والتحليلات المالية الشاملة"
        description="استخراج وطباعة كشوفات الحسابات الإجمالية والتفصيلية والميزانية والديون."
        icon={<FileText size={20} />}
        onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
        optionsMenu={
          <OptionsMenu 
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            shareTitle="التقرير المالي العام والشامل للمشروع"
            shareText={(() => {
              const fundingStr = Object.entries(fundingTotals)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const expensesStr = Object.entries(expensesTotals)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const cashStr = Object.entries(cashRemainingByCur)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const debtsStr = Object.entries(totalDebtsByCur)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              return `📈 التقرير المالي الشامل والنهائي للمشروع\n📅 تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}\n⏱️ فترة التقرير: من ${startDate || 'البداية'} إلى ${endDate || 'اليوم الحاضر'}\n\n📊 الخلاصة والمؤشرات المالية العامة:\n🟢 إجمالي التمويل المتوفر (رأس المال): ${fundingStr}\n🔴 إجمالي المصاريف والنفقات المقيدة: ${expensesStr}\n🔵 صافي السيولة المتبقية بالخزينة: ${cashStr}\n⚠️ إجمالي الديون والالتزامات المستحقة: ${debtsStr}\n\n*تم توليده ومشاركته تلقائياً من تطبيق المدير المالي*`;
            })()}
          />
        }
      />

      {/* Date Filter Panel & Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Filters Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-50 pb-3">
            <Filter size={18} className="text-sky-500" />
            <h3 className="text-sm">تخصيص فترة التقرير والبيانات</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block">من تاريخ (بداية الفترة)</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold focus:outline-hidden focus:border-sky-500 font-mono text-right"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block">إلى تاريخ (نهاية الفترة)</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold focus:outline-hidden focus:border-sky-500 font-mono text-right"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-[11px] text-slate-400">
              💡 اترك حقول التاريخ فارغة لاستخراج التقرير بالكامل منذ تأسيس المشروع.
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <X size={12} />
                إلغاء التصفية
              </button>
            )}
          </div>
        </div>

        {/* Sections Selection Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold border-b border-slate-50 pb-3">
            <Info size={18} className="text-amber-500" />
            <h3 className="text-sm">بنود التقرير المشمولة</h3>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeDashboard}
                onChange={(e) => setIncludeDashboard(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <LayoutDashboard size={15} className="text-sky-600 shrink-0" />
              <span>تضمين داشبورد الرسومات والتحليلات (Dashboard)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeBudget}
                onChange={(e) => setIncludeBudget(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>دفعات التمويل والميزانية</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeExpenses}
                onChange={(e) => setIncludeExpenses(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>كشف النفقات اليومية</span>
            </label>

            <label className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ms-4 transition-all text-xs font-bold ${includeExpenses ? 'bg-slate-50/80 border-slate-200/80 text-slate-800 hover:bg-slate-100/80 cursor-pointer' : 'bg-slate-50/40 border-slate-200/40 text-slate-400 opacity-60 cursor-not-allowed'}`}>
              <input 
                type="checkbox" 
                disabled={!includeExpenses}
                checked={includeExpensesSummaryOnly}
                onChange={(e) => setIncludeExpensesSummaryOnly(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>إجمالي مبالغ النفقات فقط لكل يوم (بدون التفاصيل)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeWorkers}
                onChange={(e) => setIncludeWorkers(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>كشوفات حساب العمال (ملخص تفصيلي)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeEmployees}
                onChange={(e) => setIncludeEmployees(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>كشوفات حساب الموظفين والرواتب (ملخص تفصيلي)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeSuppliers}
                onChange={(e) => setIncludeSuppliers(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>كشوفات حساب الموردين (ملخص تفصيلي)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeDetailedLedgers}
                onChange={(e) => setIncludeDetailedLedgers(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <FileText size={15} className="text-sky-600 shrink-0" />
              <span>كشف تفصيلي لكل العمليات المالية المدخلة (للعمال والموظفين والموردين)</span>
            </label>

            <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors text-xs font-bold text-slate-800">
              <input 
                type="checkbox" 
                checked={includeDebts}
                onChange={(e) => setIncludeDebts(e.target.checked)}
                className="rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>تفصيل الديون والالتزامات</span>
            </label>
          </div>
        </div>

      </div>

      {/* Primary Actions (Export Buttons) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Export to Excel */}
        <div className="bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between space-y-4 border border-emerald-400/20">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="font-extrabold text-base">استخراج ملف Excel للممولين والشركاء 📊</h4>
              <p className="text-emerald-100 text-xs leading-relaxed">
                يقوم بتوليد ملف Excel حقيقي متعدد الجداول (سجلات منفصلة للملخص، الميزانية، المصاريف، حسابات العمال، وحسابات الموردين). مثالي للمراجعة والتحليل والتدقيق المالي المحترف.
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl text-white">
              <FileSpreadsheet size={28} />
            </div>
          </div>
          
          <button
            onClick={handleExportExcel}
            className="w-full bg-white text-emerald-700 hover:bg-emerald-50 font-black py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
          >
            <Download size={15} />
            تصدير تقرير Excel الشامل
          </button>
        </div>

        {/* Export to PDF */}
        <div className="bg-gradient-to-tr from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md flex flex-col justify-between space-y-4 border border-slate-700/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="font-extrabold text-base">طباعة أو توليد كشف PDF فوري 📄</h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                يقوم بتصميم وبناء تقرير ورقي منسق باللغة العربية ومجهّز بالكامل للطباعة المباشرة أو الحفظ كملف PDF متكامل بضغطة زر واحدة. يشمل ترويسة الشركة وجداول العمليات الكاملة.
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-2xl text-white">
              <Printer size={28} />
            </div>
          </div>
          
          <button
            onClick={handleExportPDF}
            className="w-full bg-sky-600 text-white hover:bg-sky-500 font-black py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
          >
            <FileText size={15} />
            عرض وتوليد تقرير PDF المطبوع
          </button>
        </div>

      </div>

      {/* Live Financial Summary Report Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
          <div className="flex items-center gap-2 text-slate-800 font-extrabold">
            <Coins className="text-sky-500" size={18} />
            <h3 className="text-sm">معاينة مباشرة لأرقام التقرير المالي الحالي</h3>
          </div>
          <span className="text-[11px] bg-sky-50 text-sky-700 px-3 py-1 rounded-full font-bold">
            الفترة: {startDate ? formatDateArabic(startDate) : 'البداية'} ⟸ {endDate ? formatDateArabic(endDate) : 'اليوم'}
          </span>
        </div>

        {/* Interactive Report Dashboard preview if included */}
        {includeDashboard && (
          <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-5 shadow-lg border border-slate-800 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="text-sky-400" size={20} />
                <h4 className="font-extrabold text-sm text-slate-100">لوحة تحليلات التقرير المالي (Report Dashboard)</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">تصفح بالعملة:</span>
                <select 
                  value={selectedCurrency} 
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none"
                >
                  <option value="YER">الريال اليمني (YER)</option>
                  <option value="SAR">الريال السعودي (SAR)</option>
                  <option value="USD">الدولار الأمريكي (USD)</option>
                </select>
              </div>
            </div>

            {/* Visual Budget Progress Bar */}
            {(() => {
              const mainFunding = fundingTotals[selectedCurrency] || 0;
              const mainExpenses = expensesTotals[selectedCurrency] || 0;
              const usagePct = mainFunding > 0 ? Math.min(100, Math.round((mainExpenses / mainFunding) * 100)) : 0;
              return (
                <div className="space-y-2 bg-slate-800/80 p-4 rounded-xl border border-slate-700/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">مؤشر استهلاك الميزانية المتاحة ({selectedCurrency}):</span>
                    <span className="font-mono font-bold text-sky-400">{usagePct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${usagePct > 90 ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 to-emerald-400'}`}
                      style={{ width: `${usagePct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>مصروف: {formatCurrency(mainExpenses, selectedCurrency)}</span>
                    <span>تمويل: {formatCurrency(mainFunding, selectedCurrency)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Distribution Breakdown Cards & Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Expenses Breakdown List & Pie Chart */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
                <span className="font-bold text-slate-200 block text-xs border-b border-slate-700/80 pb-2">
                  📊 توزيع المصاريف حسب الأطراف الفاعلة ({selectedCurrency})
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">👷 مصاريف وسلف العمال:</span>
                    <span className="font-mono font-bold text-sky-400">{formatCurrency(expenseDistribution[selectedCurrency]?.worker || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">👔 مصاريف وسلف الموظفين:</span>
                    <span className="font-mono font-bold text-indigo-400">{formatCurrency(expenseDistribution[selectedCurrency]?.employee || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">🚚 مصاريف ودفعات الموردين:</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(expenseDistribution[selectedCurrency]?.supplier || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">📦 مصاريف عامة وغير مرحلة:</span>
                    <span className="font-mono font-bold text-slate-400">{formatCurrency(expenseDistribution[selectedCurrency]?.none || 0, selectedCurrency)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 space-y-1 text-[11px]">
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>• نفقات مباشرة:</span>
                    <span className="font-mono font-bold">{formatCurrency(directExpensesTotals[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-400">
                    <span>• نفقات غير مباشرة:</span>
                    <span className="font-mono font-bold">{formatCurrency(indirectExpensesTotals[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                </div>

                {reportRecipientExpensesData.length > 0 && (
                  <div className="h-44 w-full pt-2 border-t border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportRecipientExpensesData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={50} />
                        <Tooltip 
                          formatter={(val: number) => [formatCurrency(val, selectedCurrency), 'المبلغ']}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {reportRecipientExpensesData.map((e, idx) => (
                            <Cell key={`rep-cell-${idx}`} fill={e.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Debts Breakdown List & Bar Chart */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-3">
                <span className="font-bold text-slate-200 block text-xs border-b border-slate-700/80 pb-2">
                  ⚠️ توزيع المطلوبات والديون للغير ({selectedCurrency})
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">👷 ديون ومستحقات العمال:</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(workerDebtsByCur[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">👔 ديون ومستحقات الموظفين:</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(employeeDebtsByCur[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">🚚 ديون ومستحقات الموردين:</span>
                    <span className="font-mono font-bold text-amber-400">{formatCurrency(supplierDebtsByCur[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-700/80 flex justify-between font-bold">
                    <span className="text-slate-100">إجمالي الالتزامات:</span>
                    <span className="font-mono text-amber-300">{formatCurrency(totalDebtsByCur[selectedCurrency] || 0, selectedCurrency)}</span>
                  </div>
                </div>

                {reportDebtsDistributionData.length > 0 && (
                  <div className="h-44 w-full pt-2 border-t border-slate-700/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportDebtsDistributionData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} width={90} />
                        <Tooltip 
                          formatter={(val: number) => [formatCurrency(val, selectedCurrency), 'المستحق']}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {reportDebtsDistributionData.map((e, idx) => (
                            <Cell key={`debt-cell-${idx}`} fill={e.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>

            {/* Visual Recharts Row 2: Category Pie & Daily Trend Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              
              {/* Category Pie Chart */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-2">
                <span className="font-bold text-slate-200 block text-xs border-b border-slate-700/80 pb-2">
                  🍩 هرمية مصاريف التقرير حسب فئة المصروف
                </span>
                {reportCategoryChartData.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">لا توجد مصاريف مخصصة للتقرير بهذه العملة</p>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={reportCategoryChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {reportCategoryChartData.map((_, idx) => (
                            <Cell key={`cat-cell-${idx}`} fill={REPORT_CHART_COLORS[idx % REPORT_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(val: number) => [formatCurrency(val, selectedCurrency), 'المبلغ']}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(v) => <span className="text-[10px] text-slate-300">{v}</span>} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Daily Trend Area Chart */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-2">
                <span className="font-bold text-slate-200 block text-xs border-b border-slate-700/80 pb-2">
                  📈 اتجاه النفقات اليومية خلال فترة التقرير
                </span>
                {reportDailyTrendData.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">لا توجد حركات يومية بالفترة المحددة</p>
                ) : (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportDailyTrendData}>
                        <defs>
                          <linearGradient id="repColorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={50} />
                        <Tooltip 
                          formatter={(val: number) => [formatCurrency(val, selectedCurrency), 'المصروف']}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', direction: 'rtl' }}
                        />
                        <Area type="monotone" dataKey="المصروف" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#repColorExpense)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Summary Numbers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Capital */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي التمويل المستلم (الميزانية)</span>
            <div className="space-y-0.5">
              {activeCurrencies.map(cur => (
                <div key={cur} className="flex justify-between text-xs font-bold font-mono">
                  <span className="text-slate-400">{cur}</span>
                  <span className="text-slate-800">{formatCurrency(fundingTotals[cur] || 0, cur)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي النفقات والمصاريف المقتطعة</span>
            <div className="space-y-0.5">
              {activeCurrencies.map(cur => (
                <div key={cur} className="flex justify-between text-xs font-bold font-mono">
                  <span className="text-slate-400">{cur}</span>
                  <span className="text-rose-600">{formatCurrency(expensesTotals[cur] || 0, cur)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capital left */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">صافي السيولة المتبقية (الصندوق)</span>
            <div className="space-y-0.5">
              {activeCurrencies.map(cur => (
                <div key={cur} className="flex justify-between text-xs font-bold font-mono">
                  <span className="text-slate-400">{cur}</span>
                  <span className={cashRemainingByCur[cur] < 0 ? 'text-rose-600' : 'text-sky-600'}>
                    {formatCurrency(cashRemainingByCur[cur] || 0, cur)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Debts */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">الديون المستحقة للغير (مطلوبات)</span>
            <div className="space-y-0.5">
              {activeCurrencies.map(cur => (
                <div key={cur} className="flex justify-between text-xs font-bold font-mono">
                  <span className="text-slate-400">{cur}</span>
                  <span className={(totalDebtsByCur[cur] || 0) > 0 ? 'text-amber-600' : 'text-slate-500'}>
                    {formatCurrency(totalDebtsByCur[cur] || 0, cur)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Info Box */}
        <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl text-sky-800 text-[11px] leading-relaxed flex items-start gap-2">
          <Info size={16} className="shrink-0 text-sky-600 mt-0.5" />
          <div>
            <strong>توجيه مالي للتقرير الشامل:</strong> هذا التقرير يضم جميع مخرجات العمليات وحركات كشوف الحسابات. لتصدير تقرير نظيف، ننصح دائماً بوضع الفلاتر المناسبة والتحقق من صحة ترحيل جميع النفقات اليومية إلى حسابات العمال والموردين المناسبين لضمان دقة كشوف الحسابات الفردية والإجمالية للموقع.
          </div>
        </div>
      </div>

      {/* Floating interactive toast notifications inside the page */}
      {toastMsg && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white font-bold text-xs py-3.5 px-6 rounded-xl shadow-xl border border-slate-800 animate-fade-in flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
