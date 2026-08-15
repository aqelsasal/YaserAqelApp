/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { AmountInWords } from './AmountInWords';
import { 
  PlusCircle, 
  Trash2, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  Search, 
  Calendar,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Pencil
} from 'lucide-react';
import { 
  BudgetItem, 
  Expense, 
  Worker,
  Employee,
  Supplier,
  formatCurrency, 
  formatDateArabic,
  exportToCSV,
  exportToXLSX,
  printPDF
} from '../types';
import * as XLSX from 'xlsx';
import AttributionBadge from './AttributionBadge';
import Calculator from './Calculator';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface BudgetProps {
  budget: BudgetItem[];
  expenses: Expense[];
  onAddBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  onDeleteBudgetItem: (id: string) => void;
  onUpdateBudgetItem?: (id: string, updatedData: Omit<BudgetItem, 'id' | 'createdBy'>) => void;
  setActiveTab?: (tab: string) => void;
  currency?: string;
  workers?: Worker[];
  employees?: Employee[];
  suppliers?: Supplier[];
  sharedRole?: string;
}

export default function Budget({
  budget,
  expenses,
  onAddBudgetItem,
  onDeleteBudgetItem,
  onUpdateBudgetItem,
  setActiveTab,
  currency = 'YER',
  workers = [],
  employees = [],
  suppliers = [],
  sharedRole = 'admin'
}: BudgetProps) {
  
  // Local states for add form
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Edit states for budget item
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem | null>(null);

  // Lock background scroll when budget modal is open
  useBodyScrollLock(Boolean(editingBudgetItem));

  // Submit handler for edit budget item
  const handleEditBudgetItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudgetItem) return;
    if (onUpdateBudgetItem) {
      onUpdateBudgetItem(editingBudgetItem.id, {
        date: editingBudgetItem.date,
        description: editingBudgetItem.description,
        amount: editingBudgetItem.amount,
        currency: editingBudgetItem.currency || 'YER',
        notes: editingBudgetItem.notes || ''
      });
    }
    setEditingBudgetItem(null);
  };
  const [showAddFundingForm, setShowAddFundingForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [itemCurrency, setItemCurrency] = useState(currency);

  // Search filter & sort order
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default desc: newest to oldest date

  // Alerts
  const [errorMsg, setErrorMsg] = useState('');

  // Keep item currency in sync with global currency selection when prop changes
  useEffect(() => {
    setItemCurrency(currency);
  }, [currency]);

  // Totals calculations per currency
  const activeCurrencies = ['YER', 'SAR', 'USD'];

  const fundingByCurrency = budget.reduce((acc, item) => {
    const cur = item.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + item.amount;
    return acc;
  }, {} as Record<string, number>);

  const expensesByCurrency = expenses.reduce((acc, exp) => {
    const cur = exp.currency || 'YER';
    acc[cur] = (acc[cur] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  // Company Debts = Workers Net (For - On) + Employees Net (For - On) + Suppliers Net (For - On) + External Debts
  const workerDebtsByCurrency = workers.reduce((acc, w) => {
    const balances = w.ledger.reduce((lAcc, entry) => {
      const cur = entry.currency || 'YER';
      if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
      lAcc[cur].onHim += entry.amountOnHim || 0;
      lAcc[cur].forHim += entry.amountForHim || 0;
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

  const employeeDebtsByCurrency = employees.reduce((acc, e) => {
    const balances = e.ledger.reduce((lAcc, entry) => {
      const cur = entry.currency || 'YER';
      if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
      lAcc[cur].onHim += entry.amountOnHim || 0;
      lAcc[cur].forHim += entry.amountForHim || 0;
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

  const supplierDebtsByCurrency = suppliers.reduce((acc, s) => {
    const balances = s.ledger.reduce((lAcc, entry) => {
      const cur = entry.currency || 'YER';
      if (!lAcc[cur]) lAcc[cur] = { onHim: 0, forHim: 0 };
      lAcc[cur].onHim += entry.amountOnHim || 0;
      lAcc[cur].forHim += entry.amountForHim || 0;
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

  const debtsByCurrency = {} as Record<string, number>;
  activeCurrencies.forEach(cur => {
    const totalDebts = (workerDebtsByCurrency[cur] || 0) + 
                       (employeeDebtsByCurrency[cur] || 0) + 
                       (supplierDebtsByCurrency[cur] || 0) + 
                       (externalDebtsByCurrency[cur] || 0);
    if (totalDebts > 0) {
      debtsByCurrency[cur] = totalDebts;
    }
  });

  const remainingByCurrency = {} as Record<string, number>;
  activeCurrencies.forEach(cur => {
    remainingByCurrency[cur] = (fundingByCurrency[cur] || 0) - (expensesByCurrency[cur] || 0);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('الرجاء إدخال مبلغ تمويل صحيح أكبر من الصفر.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('الرجاء إدخال بيان عملية التمويل.');
      return;
    }

    onAddBudgetItem({
      date,
      amount: parsedAmount,
      description: description.trim(),
      notes: notes.trim(),
      currency: itemCurrency
    });

    // Reset Form
    setAmount('');
    setDescription('');
    setNotes('');
    setShowAddFundingForm(false);
  };

  // Filtered logs
  const filteredBudget = budget.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorted budget logs (Default: Oldest to Newest date)
  const sortedBudget = [...filteredBudget].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Export Budget Logs to Excel
  const handleExportExcel = () => {
    const headers = [
      'التاريخ',
      'البيان (مصدر التمويل)',
      'المبلغ',
      'العملة',
      'ملاحظات'
    ];

    const rows = sortedBudget.map(item => [
      item.date,
      item.description,
      item.amount.toString(),
      item.currency || currency || 'YER',
      item.notes || ''
    ]);

    exportToXLSX('سجل_تمويل_الميزانية_المشروع', headers, rows);
  };

  // Import Budget Logs from Excel File (.xlsx, .xls)
  const handleBudgetExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        let count = 0;
        rows.forEach((row: any) => {
          const dateVal = row['التاريخ'] || row['تاريخ'] || row['Date'] || row['date'];
          const desc = row['البيان'] || row['مصدر التمويل'] || row['الجهة المموله'] || row['الوصف'] || row['Description'] || row['description'] || row['statement'];
          const amt = parseFloat(row['المبلغ'] || row['القيمة'] || row['Amount'] || row['amount']);
          const cur = row['العملة'] || row['currency'] || row['Currency'] || currency || 'YER';
          const noteVal = row['الملاحظات'] || row['ملاحظات'] || row['Notes'] || row['notes'] || '';

          if (dateVal && desc && !isNaN(amt) && amt > 0) {
            const parseDate = (d: any) => {
              if (!d) return new Date().toISOString().split('T')[0];
              if (typeof d === 'number') {
                const dateObj = new Date((d - 25569) * 86400 * 1000);
                return dateObj.toISOString().split('T')[0];
              }
              const stringDate = String(d).trim();
              const parsed = Date.parse(stringDate);
              if (!isNaN(parsed)) {
                return new Date(parsed).toISOString().split('T')[0];
              }
              return stringDate;
            };

            onAddBudgetItem({
              date: parseDate(dateVal),
              amount: amt,
              description: String(desc).trim(),
              notes: String(noteVal).trim(),
              currency: String(cur).trim().toUpperCase()
            });
            count++;
          }
        });

        if (count > 0) {
          if (typeof window !== 'undefined' && (window as any).showToast) {
            (window as any).showToast(`تم استيراد ${count} دفعة تمويل من ملف Excel بنجاح!`);
          }
        } else {
          if (typeof window !== 'undefined' && (window as any).showToast) {
            (window as any).showToast('لم يتم العثور على بيانات تمويل صالحة في ملف Excel. تأكد من وجود أعمدة: التاريخ، البيان، المبلغ.');
          }
        }
      } catch (err) {
        console.error('Budget Excel import error:', err);
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من صيغة الملف.');
        }
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Export/Print Budget PDF Report with Summary and Detailed Transaction Log
  const handlePrintBudgetPDF = () => {
    // 1. Group by currency for summary table
    const fundingByCurrencyMap: Record<string, { totalAmount: number; count: number }> = {};
    // Group by source description for summary
    const fundingBySourceMap: Record<string, { totalAmount: number; currency: string; count: number }> = {};

    sortedBudget.forEach(b => {
      const cur = b.currency || currency || 'YER';
      if (!fundingByCurrencyMap[cur]) {
        fundingByCurrencyMap[cur] = { totalAmount: 0, count: 0 };
      }
      fundingByCurrencyMap[cur].totalAmount += b.amount;
      fundingByCurrencyMap[cur].count += 1;

      const sourceKey = `${b.description.trim()}___${cur}`;
      if (!fundingBySourceMap[sourceKey]) {
        fundingBySourceMap[sourceKey] = { totalAmount: 0, currency: cur, count: 0 };
      }
      fundingBySourceMap[sourceKey].totalAmount += b.amount;
      fundingBySourceMap[sourceKey].count += 1;
    });

    // Summary Rows HTML
    let summarySourceRowsHtml = '';
    Object.entries(fundingBySourceMap).forEach(([key, val], idx) => {
      const descName = key.split('___')[0];
      summarySourceRowsHtml += `
        <tr>
          <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1;">${descName}</td>
          <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1;">${val.count} دفعة</td>
          <td style="font-weight: bold; color: #15803d; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatCurrency(val.totalAmount, val.currency)}</td>
        </tr>
      `;
    });

    // Detailed Log Rows HTML
    let rowsHtml = '';
    sortedBudget.forEach(b => {
      rowsHtml += `
        <tr>
          <td style="font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatDateArabic(b.date)}</td>
          <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1;">${b.description}</td>
          <td style="font-weight: bold; color: #15803d; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatCurrency(b.amount, b.currency || currency || 'YER')}</td>
          <td style="font-size: 11px; color: #64748b; padding: 6px 8px; border: 1px solid #cbd5e1;">${b.notes || '-'}</td>
        </tr>
      `;
    });

    const fundingText = Object.entries(fundingByCurrencyMap)
      .map(([cur, val]) => `<strong>${formatCurrency(val.totalAmount, cur)}</strong> (${val.count} عملية)`)
      .join(' | ');

    const htmlContent = `
      <div style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 10px;">
        <h2 style="color: #1e293b; text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; font-size: 20px;">
          💰 كشف الميزانية العامة وتغذية الخزينة والصندوق الشامل التفصيلي
        </h2>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: #475569;">
          <div><strong>إجمالي عمليات التمويل:</strong> ${sortedBudget.length} دفعة تمويلية</div>
          <div><strong>تاريخ استخراج التقرير:</strong> ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
        </div>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: bold; color: #166534; margin-bottom: 4px;">إجمالي الميزانية والتمويل المستلم للصندوق:</div>
          <div style="font-size: 16px; font-weight: bold; color: #15803d;">${fundingText || '0'}</div>
        </div>

        <!-- SECTION 1: SUMMARY TABLE BY SOURCE -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #16a34a; padding-bottom: 6px; margin-bottom: 12px;">
            أولاً: ملخص إجمالي التمويل المودع حسب المصدر والجهة
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #14532d; color: white;">
                <th style="padding: 8px; border: 1px solid #166534; text-align: center; width: 35px;">#</th>
                <th style="padding: 8px; border: 1px solid #166534;">البيان / جهة التمويل</th>
                <th style="padding: 8px; border: 1px solid #166534; text-align: center;">عدد الدفعات</th>
                <th style="padding: 8px; border: 1px solid #166534;">إجمالي التمويل</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(fundingBySourceMap).length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 10px;">لا توجد مصادر تمويل مضافه.</td></tr>' : summarySourceRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- SECTION 2: DETAILED TRANSACTION LOG -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #16a34a; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
            ثانياً: سجل تفصيلي بكافة دفعات وإيداعات التمويل المقيدة بالخزينة
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
            <thead>
              <tr style="background-color: #0f172a; color: white;">
                <th style="padding: 8px; border: 1px solid #334155; width: 15%;">التاريخ</th>
                <th style="padding: 8px; border: 1px solid #334155; width: 35%;">البيان (مصدر التمويل / إيداع)</th>
                <th style="padding: 8px; border: 1px solid #334155; width: 25%;">المبلغ التمويلي</th>
                <th style="padding: 8px; border: 1px solid #334155;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${sortedBudget.length === 0 ? '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">لا توجد دفعات تمويل مقيدة حالياً.</td></tr>' : rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    printPDF('كشف الميزانية العامة وتغذية الخزينة الشامل التفصيلي', htmlContent);
  };

  return (
    <div className="space-y-4 animate-fade-in" id="budget-section">
      
      {/* Header */}
      <PageHeaderCard
        title="الميزانية العامة وتغذية الصندوق"
        description="إدارة ميزانية المشروع وتغذية الصندوق الاستثماري لتغطية كافة أجور العمال والمصاريف."
        icon={<Wallet size={20} />}
        onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
        optionsMenu={
          <OptionsMenu 
            onExportExcel={handleExportExcel}
            onExportPDF={handlePrintBudgetPDF}
            onImportExcel={sharedRole !== 'read' ? handleBudgetExcelImport : undefined}
            shareTitle="الميزانية العامة وصندوق الموقع"
            shareText={(() => {
              const fundingStr = Object.entries(fundingByCurrency)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const expensesStr = Object.entries(expensesByCurrency)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const remainingStr = Object.entries(remainingByCurrency)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const debtsStr = Object.entries(debtsByCurrency)
                .map(([cur, val]) => `${formatCurrency(val, cur)}`)
                .join(' | ') || '0';

              const lastEntries = filteredBudget.slice(-10);
              const entriesText = lastEntries.length > 0
                ? '\n📋 آخر دفعات التمويل المقيدة:\n' + lastEntries.map(b => 
                    `- ${b.date} | ${b.description} ⟸ ${formatCurrency(b.amount, b.currency || currency)}`
                  ).join('\n')
                : '\n(لا توجد عمليات تمويل مقيدة)';

              return `💰 الميزانية العامة وصندوق موقع المقاولات\n📅 تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}\n\n📊 الحالة المالية للموقع:\n🟢 إجمالي التمويل المستلم: ${fundingStr}\n🔴 إجمالي النفقات والمصاريف: ${expensesStr}\n💳 الرصيد المتبقي بالخزينة: ${remainingStr}\n⚠️ إجمالي ديون الموقع للغير: ${debtsStr}\n${entriesText}\n\n*تم استخراجه ومشاركته من كشوفات المقاولات*`;
            })()}
          />
        }
      />

      {/* Budget Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Funding */}
        <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-slate-600 font-medium text-xs">إجمالي التمويل المتوفر</span>
            <Wallet size={18} />
          </div>
          <div className="mt-3 space-y-1">
            {activeCurrencies.map(cur => {
              const val = fundingByCurrency[cur] || 0;
              return (
                <div key={cur} className="flex justify-between items-center border-b border-dashed border-emerald-100/50 pb-0.5 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{cur}</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{formatCurrency(val, cur)}</span>
                </div>
              );
            })}
            <span className="text-[9px] text-slate-400 block mt-1.5 pt-1 border-t border-slate-50">مجموع رأس المال المسجل كمدخلات</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-rose-50 to-white p-5 rounded-2xl border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-slate-600 font-medium text-xs">إجمالي المصروفات</span>
            <TrendingUp size={18} />
          </div>
          <div className="mt-3 space-y-1">
            {activeCurrencies.map(cur => {
              const val = expensesByCurrency[cur] || 0;
              return (
                <div key={cur} className="flex justify-between items-center border-b border-dashed border-rose-100/50 pb-0.5 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{cur}</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{formatCurrency(val, cur)}</span>
                </div>
              );
            })}
            <span className="text-[9px] text-slate-400 block mt-1.5 pt-1 border-t border-slate-50">مجموع النفقات اليومية المقتطعة</span>
          </div>
        </div>

        {/* Company Debts */}
        <div className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-2xl border border-purple-100 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-slate-600 font-medium text-xs">ديون الشركة المستحقة</span>
            <AlertTriangle size={18} className="text-purple-500" />
          </div>
          <div className="mt-3 space-y-1">
            {activeCurrencies.map(cur => {
              const val = debtsByCurrency[cur] || 0;
              return (
                <div key={cur} className="flex justify-between items-center border-b border-dashed border-purple-100/50 pb-0.5 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{cur}</span>
                  <span className="text-sm font-bold text-purple-700 font-mono">{formatCurrency(val, cur)}</span>
                </div>
              );
            })}
            <span className="text-[9px] text-slate-400 block mt-1.5 pt-1 border-t border-slate-50">مستحقات العمال والموردين المتبقية</span>
          </div>
        </div>

        {/* Net Treasury */}
        <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-slate-600 font-medium text-xs">الرصيد الفعلي (الخزينة)</span>
            <DollarSign size={18} className="text-blue-500" />
          </div>
          <div className="mt-3 space-y-1">
            {activeCurrencies.map(cur => {
              const val = remainingByCurrency[cur] || 0;
              const isNegative = val < 0;
              return (
                <div key={cur} className="flex justify-between items-center border-b border-dashed border-blue-100/30 pb-0.5 last:border-0 last:pb-0">
                  <span className="text-[10px] text-slate-400 font-mono font-bold">{cur}</span>
                  <span className={`text-sm font-bold font-mono ${isNegative ? 'text-rose-600' : 'text-slate-800'}`}>
                    {formatCurrency(val, cur)}
                  </span>
                </div>
              );
            })}
            <span className="text-[9px] text-slate-400 block mt-1.5 pt-1 border-t border-slate-50">رصيد الخزينة إيجابي وآمن</span>
          </div>
        </div>

      </div>

      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Col: Add Funding Form */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs h-fit" id="funding-form-container">
          {sharedRole === 'read' ? (
            <div className="text-center py-8 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Wallet size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">وضع عرض الحساب المشترك</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                تمت دعوتك بصلاحية (عرض فقط). لا يمكنك إضافة تمويل جديد أو تعديل بيانات ميزانية المشروع.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowAddFundingForm(!showAddFundingForm)}
                className="w-full font-bold text-slate-800 flex items-center justify-between text-base cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={20} className="text-emerald-500" />
                  <span>تغذية الصندوق / تمويل جديد</span>
                </div>
                <span className={`text-xs px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all ${
                  showAddFundingForm 
                    ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}>
                  {showAddFundingForm ? 'إخفاء البيانات ▲' : '+ إضافة ▼'}
                </span>
              </button>

              {showAddFundingForm && (
                <div className="pt-4 mt-3 border-t border-slate-100 animate-slide-up">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                      <div className="relative">
                        <input 
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500"
                          required
                        />
                        <Calendar size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Amount & Currency */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">مبلغ التغذية</label>
                        <div className="flex gap-1.5 items-center">
                          <input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="مثال: 10000000"
                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500"
                            required
                            min="1"
                          />
                          <Calculator onApply={(val) => setAmount(String(val))} />
                        </div>
                        <AmountInWords amount={amount} currency={itemCurrency} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">العملة</label>
                        <select
                          value={itemCurrency}
                          onChange={(e) => setItemCurrency(e.target.value)}
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="YER">﷼ يمني</option>
                          <option value="SAR">﷼ سعودي</option>
                          <option value="USD">$ دولار</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">البيان (مصدر التمويل)</label>
                      <input 
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="مثال: دفعة المستثمر الأولى / تمويل جيب ذاتي"
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500"
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="تفاصيل إضافية حول دفعة التمويل..."
                        rows={2}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500 resize-none"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl">{errorMsg}</p>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <PlusCircle size={18} />
                      إضافة مبلغ التمويل
                    </button>

                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Col: Funding Logs List */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Search Box & Sort Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في سجل عمليات التمويل والودائع..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-emerald-500"
              />
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              {/* Sort filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs w-full sm:w-auto">
                <span className="text-slate-400 font-medium">الترتيب:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer text-xs w-full sm:w-auto"
                >
                  <option value="desc">من الأحدث إلى الأقدم ⬇️ (افتراضي)</option>
                  <option value="asc">من الأقدم إلى الأحدث ⬆️</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="budget-table-card">
            <div className="p-5 border-b border-slate-100 bg-slate-50/40">
              <h3 className="font-bold text-slate-800 text-sm">أرشيف عمليات تمويل صندوق المشروع</h3>
            </div>

            <div className="overflow-x-auto">
              {sortedBudget.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <p className="text-slate-400 text-sm font-medium">سجل التمويل فارغ حالياً</p>
                  <p className="text-xs text-slate-300">أضف دفعات تمويل لتتمكن من تغطية مصاريف المشروع</p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">البيان (المصدر)</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">ملاحظات</th>
                      <th className="p-3 text-center">العمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedBudget.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                        <td className="p-3 whitespace-nowrap text-slate-500">{formatDateArabic(item.date)}</td>
                        <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span>{item.description}</span>
                          <AttributionBadge createdBy={item.createdBy} />
                        </td>
                        <td className="p-3 font-extrabold text-emerald-600">{formatCurrency(item.amount, item.currency || 'YER')}</td>
                        <td className="p-3 text-slate-400 max-w-xs truncate" title={item.notes}>{item.notes || '-'}</td>
                        <td className="p-3 text-center flex items-center justify-center gap-1.5">
                          {sharedRole !== 'read' && (
                            <button 
                              onClick={() => setEditingBudgetItem(item)}
                              className="p-1 hover:bg-slate-50 text-slate-300 hover:text-sky-600 rounded-sm cursor-pointer"
                              title="تعديل التمويل"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {sharedRole !== 'read' && sharedRole !== 'add' && (
                            <button 
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف دفعة التمويل هذه؟ سيتم اقتطاعها من إجمالي الميزانية.')) {
                                  onDeleteBudgetItem(item.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-sm cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Edit Budget Item Modal */}
      {editingBudgetItem && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full animate-scale-up my-auto max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل دفعة التمويل</h3>
              <button
                type="button"
                onClick={() => setEditingBudgetItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditBudgetItemSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <input 
                    type="date" 
                    value={editingBudgetItem.date}
                    onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, date: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">المبلغ</label>
                    <div className="flex gap-1.5 items-center">
                      <input 
                        type="number" 
                        value={editingBudgetItem.amount}
                        onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500 font-mono text-left"
                        required
                        min="1"
                      />
                      <Calculator onApply={(val) => setEditingBudgetItem({ ...editingBudgetItem, amount: val })} />
                    </div>
                    <AmountInWords amount={editingBudgetItem.amount} currency={editingBudgetItem.currency || 'YER'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">العملة</label>
                    <select 
                      value={editingBudgetItem.currency || 'YER'}
                      onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, currency: e.target.value })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="YER">﷼ يمني</option>
                      <option value="SAR">﷼ سعودي</option>
                      <option value="USD">$ دولار</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">البيان (المصدر)</label>
                  <input 
                    type="text" 
                    value={editingBudgetItem.description}
                    onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, description: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <textarea 
                    value={editingBudgetItem.notes || ''}
                    onChange={(e) => setEditingBudgetItem({ ...editingBudgetItem, notes: e.target.value })}
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-emerald-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingBudgetItem(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
