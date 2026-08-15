/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { isOwnerUser } from './AttributionBadge';
import { AmountInWords } from './AmountInWords';
import { 
  Coins, 
  Search, 
  Users, 
  Briefcase, 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  FileText, 
  ArrowLeft,
  X,
  Eye,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Trash2,
  Pencil
} from 'lucide-react';
import { 
  Worker, 
  Employee, 
  Supplier, 
  formatCurrency, 
  formatDateArabic, 
  exportToXLSX, 
  exportMultiSheetXLSX,
  printPDF 
} from '../types';
import * as XLSX from 'xlsx';
import AttributionBadge from './AttributionBadge';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface DebtsProps {
  workers: Worker[];
  employees: Employee[];
  suppliers: Supplier[];
  currency?: string;
  setActiveTab: (tab: string) => void;
  sharedRole?: string;
  onAddWorkerLedgerEntry?: (workerId: string, entryData: any) => void;
  onAddEmployeeLedgerEntry?: (employeeId: string, entryData: any) => void;
  onAddSupplierLedgerEntry?: (supplierId: string, entryData: any) => void;
}

interface ExternalDebtAccount {
  id: string;
  name: string;
  profession: string;
  ledger: {
    id: string;
    date: string;
    amountForHim: number;
    amountOnHim: number;
    description: string;
    notes: string;
    currency: string;
    createdBy?: string;
  }[];
}

interface DebtAccountItem {
  id: string;
  name: string;
  type: 'worker' | 'employee' | 'supplier' | 'external';
  typeLabel: string;
  profession: string;
  totalForHim: number; // إجمالي له
  totalOnHim: number;  // إجمالي عليه
  netBalance: number;  // الصافي (له - عليه)
  currency: string;
  lastDate: string;
  ledgerCount: number;
  originalEntity: Worker | Employee | Supplier | ExternalDebtAccount;
}

export default function Debts({
  workers = [],
  employees = [],
  suppliers = [],
  currency = 'YER',
  setActiveTab,
  sharedRole,
  onAddWorkerLedgerEntry,
  onAddEmployeeLedgerEntry,
  onAddSupplierLedgerEntry
}: DebtsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'worker' | 'employee' | 'supplier' | 'external'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'forHim' | 'onHim' | 'settled'>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currency);
  
  // External debts state saved in localStorage
  const [externalAccounts, setExternalAccounts] = useState<ExternalDebtAccount[]>(() => {
    try {
      const saved = localStorage.getItem('site_external_debts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Modal for viewing detailed ledger of a selected entity
  const [activeDetailItem, setActiveDetailItem] = useState<DebtAccountItem | null>(null);

  // Modal for adding a new debt / ledger entry directly
  const [showAddDebtModal, setShowAddDebtModal] = useState<boolean>(false);

  // Lock background scroll when any debt modal is open
  useBodyScrollLock(Boolean(activeDetailItem || showAddDebtModal));
  const [newDebtData, setNewDebtData] = useState({
    category: 'worker' as 'worker' | 'employee' | 'supplier' | 'external',
    entityId: '',
    customName: '',
    customProfession: 'التزام دائن خارجي',
    entryType: 'forHim' as 'forHim' | 'onHim', // forHim = له (التزام على المشروع), onHim = عليه (سلفة للمشروع)
    amount: '',
    currency: currency,
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: ''
  });

  // Active currencies in system
  const currencies = ['YER', 'SAR', 'USD'];

  const saveExternalAccounts = (accounts: ExternalDebtAccount[]) => {
    setExternalAccounts(accounts);
    try {
      localStorage.setItem('site_external_debts', JSON.stringify(accounts));
    } catch (e) {}
  };

  // Process all accounts into a normalized list
  const accountItems: DebtAccountItem[] = [];

  // 1. Process Workers
  workers.forEach(w => {
    const ledger = w.ledger || [];
    const balancesByCur: Record<string, { forHim: number; onHim: number; lastDate: string }> = {};

    ledger.forEach(entry => {
      const cur = entry.currency || 'YER';
      if (!balancesByCur[cur]) balancesByCur[cur] = { forHim: 0, onHim: 0, lastDate: '' };
      balancesByCur[cur].forHim += entry.amountForHim || 0;
      balancesByCur[cur].onHim += entry.amountOnHim || 0;
      if (!balancesByCur[cur].lastDate || entry.date > balancesByCur[cur].lastDate) {
        balancesByCur[cur].lastDate = entry.date;
      }
    });

    if (Object.keys(balancesByCur).length === 0) {
      balancesByCur['YER'] = { forHim: 0, onHim: 0, lastDate: w.startDate || '' };
    }

    Object.entries(balancesByCur).forEach(([cur, val]) => {
      accountItems.push({
        id: `worker_${w.id}_${cur}`,
        name: w.name,
        type: 'worker',
        typeLabel: 'عامل / مقاول',
        profession: w.profession || 'عامل موقع',
        totalForHim: val.forHim,
        totalOnHim: val.onHim,
        netBalance: val.forHim - val.onHim,
        currency: cur,
        lastDate: val.lastDate,
        ledgerCount: ledger.length,
        originalEntity: w
      });
    });
  });

  // 2. Process Employees (including المهندس فكري)
  employees.forEach(e => {
    const ledger = e.ledger || [];
    const balancesByCur: Record<string, { forHim: number; onHim: number; lastDate: string }> = {};

    ledger.forEach(entry => {
      const cur = entry.currency || 'YER';
      if (!balancesByCur[cur]) balancesByCur[cur] = { forHim: 0, onHim: 0, lastDate: '' };
      balancesByCur[cur].forHim += entry.amountForHim || 0;
      balancesByCur[cur].onHim += entry.amountOnHim || 0;
      if (!balancesByCur[cur].lastDate || entry.date > balancesByCur[cur].lastDate) {
        balancesByCur[cur].lastDate = entry.date;
      }
    });

    if (Object.keys(balancesByCur).length === 0) {
      balancesByCur['YER'] = { forHim: 0, onHim: 0, lastDate: e.startDate || '' };
    }

    Object.entries(balancesByCur).forEach(([cur, val]) => {
      accountItems.push({
        id: `emp_${e.id}_${cur}`,
        name: e.name,
        type: 'employee',
        typeLabel: 'موظف / مهندس',
        profession: e.profession || 'موظف وإشراف',
        totalForHim: val.forHim,
        totalOnHim: val.onHim,
        netBalance: val.forHim - val.onHim,
        currency: cur,
        lastDate: val.lastDate,
        ledgerCount: ledger.length,
        originalEntity: e
      });
    });
  });

  // 3. Process Suppliers
  suppliers.forEach(s => {
    const ledger = s.ledger || [];
    const balancesByCur: Record<string, { forHim: number; onHim: number; lastDate: string }> = {};

    ledger.forEach(entry => {
      const cur = entry.currency || 'YER';
      if (!balancesByCur[cur]) balancesByCur[cur] = { forHim: 0, onHim: 0, lastDate: '' };
      balancesByCur[cur].forHim += entry.amountForHim || 0;
      balancesByCur[cur].onHim += entry.amountOnHim || 0;
      if (!balancesByCur[cur].lastDate || entry.date > balancesByCur[cur].lastDate) {
        balancesByCur[cur].lastDate = entry.date;
      }
    });

    if (Object.keys(balancesByCur).length === 0) {
      balancesByCur['YER'] = { forHim: 0, onHim: 0, lastDate: '' };
    }

    Object.entries(balancesByCur).forEach(([cur, val]) => {
      accountItems.push({
        id: `supplier_${s.id}_${cur}`,
        name: s.name,
        type: 'supplier',
        typeLabel: 'مورد / شركة',
        profession: s.materialType || 'توريدات مواد',
        totalForHim: val.forHim,
        totalOnHim: val.onHim,
        netBalance: val.forHim - val.onHim,
        currency: cur,
        lastDate: val.lastDate,
        ledgerCount: ledger.length,
        originalEntity: s
      });
    });
  });

  // 4. Process External Debts
  externalAccounts.forEach(ext => {
    const ledger = ext.ledger || [];
    const balancesByCur: Record<string, { forHim: number; onHim: number; lastDate: string }> = {};

    ledger.forEach(entry => {
      const cur = entry.currency || 'YER';
      if (!balancesByCur[cur]) balancesByCur[cur] = { forHim: 0, onHim: 0, lastDate: '' };
      balancesByCur[cur].forHim += entry.amountForHim || 0;
      balancesByCur[cur].onHim += entry.amountOnHim || 0;
      if (!balancesByCur[cur].lastDate || entry.date > balancesByCur[cur].lastDate) {
        balancesByCur[cur].lastDate = entry.date;
      }
    });

    if (Object.keys(balancesByCur).length === 0) {
      balancesByCur['YER'] = { forHim: 0, onHim: 0, lastDate: '' };
    }

    Object.entries(balancesByCur).forEach(([cur, val]) => {
      accountItems.push({
        id: `ext_${ext.id}_${cur}`,
        name: ext.name,
        type: 'external',
        typeLabel: 'جهة / دائن خارجي',
        profession: ext.profession || 'التزام دائن',
        totalForHim: val.forHim,
        totalOnHim: val.onHim,
        netBalance: val.forHim - val.onHim,
        currency: cur,
        lastDate: val.lastDate,
        ledgerCount: ledger.length,
        originalEntity: ext
      });
    });
  });

  // Filter accounts
  const filteredAccounts = accountItems.filter(item => {
    // Search term filter
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.profession.toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter
    const matchesType = typeFilter === 'all' || item.type === typeFilter;

    // Currency filter
    const matchesCurrency = selectedCurrency === 'all' || item.currency === selectedCurrency;

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'forHim') matchesStatus = item.netBalance > 0;
    if (statusFilter === 'onHim') matchesStatus = item.netBalance < 0;
    if (statusFilter === 'settled') matchesStatus = item.netBalance === 0;

    return matchesSearch && matchesType && matchesCurrency && matchesStatus;
  });

  // Sort by highest balance impact
  filteredAccounts.sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

  // Compute overall KPI summaries per currency
  const kpisByCurrency: Record<string, { totalLiabilitiesForHim: number; totalReceivablesOnHim: number; countForHim: number; countOnHim: number }> = {};

  currencies.forEach(cur => {
    kpisByCurrency[cur] = {
      totalLiabilitiesForHim: 0,
      totalReceivablesOnHim: 0,
      countForHim: 0,
      countOnHim: 0
    };
  });

  accountItems.forEach(item => {
    const cur = item.currency || 'YER';
    if (!kpisByCurrency[cur]) {
      kpisByCurrency[cur] = { totalLiabilitiesForHim: 0, totalReceivablesOnHim: 0, countForHim: 0, countOnHim: 0 };
    }

    if (item.netBalance > 0) {
      kpisByCurrency[cur].totalLiabilitiesForHim += item.netBalance;
      kpisByCurrency[cur].countForHim++;
    } else if (item.netBalance < 0) {
      kpisByCurrency[cur].totalReceivablesOnHim += Math.abs(item.netBalance);
      kpisByCurrency[cur].countOnHim++;
    }
  });

  const activeKpi = kpisByCurrency[selectedCurrency === 'all' ? currency : selectedCurrency] || {
    totalLiabilitiesForHim: 0,
    totalReceivablesOnHim: 0,
    countForHim: 0,
    countOnHim: 0
  };

  // Export to Multi-sheet Excel (.xlsx) with complete details
  const handleExportExcel = () => {
    // Sheet 1: Summary of Debt Accounts
    const summaryHeaders = [
      'اسم الحساب / الجهة',
      'الصلة / الفئة',
      'المهنة / البيان',
      'إجمالي له (مستحقاته)',
      'إجمالي عليه (سلف ومدفوعات)',
      'الصافي النهائية',
      'حالة الحساب',
      'العملة',
      'تاريخ آخر حركة'
    ];

    const summaryRows = filteredAccounts.map(a => [
      a.name,
      a.typeLabel,
      a.profession,
      a.totalForHim,
      a.totalOnHim,
      Math.abs(a.netBalance),
      a.netBalance > 0 ? 'مستحق له (الالتزام على المشروع)' : a.netBalance < 0 ? 'مستحق عليه (سلفة للمشروع)' : 'خالص / متزن',
      a.currency,
      a.lastDate || '-'
    ]);

    // Sheet 2: Detailed Ledger Movements for all filtered debt accounts
    const ledgerHeaders = [
      'اسم الحساب / الجهة',
      'الصلة / الفئة',
      'المهنة / البيان',
      'تاريخ الحركة',
      'البيان / الوصف التفصيلي',
      'مبلغ له (مستحقات)',
      'مبلغ عليه (سلف / سداد)',
      'العملة',
      'الملاحظات',
      'بواسطة'
    ];

    const ledgerRows: (string | number)[][] = [];
    filteredAccounts.forEach(account => {
      let ledgerEntries: any[] = [];
      if ('ledger' in account.originalEntity && Array.isArray(account.originalEntity.ledger)) {
        ledgerEntries = account.originalEntity.ledger;
      }

      ledgerEntries.forEach(entry => {
        ledgerRows.push([
          account.name,
          account.typeLabel,
          account.profession,
          entry.date,
          entry.description,
          entry.amountForHim || 0,
          entry.amountOnHim || 0,
          entry.currency || account.currency,
          entry.notes || '-',
          (entry.createdBy && !isOwnerUser(entry.createdBy)) ? entry.createdBy : '-'
        ]);
      });
    });
    ledgerRows.sort((a, b) => (b[3] as string).localeCompare(a[3] as string));

    exportMultiSheetXLSX(`كشف_الديون_والالتزامات_المفصل_${selectedCurrency}_${new Date().toISOString().split('T')[0]}`, [
      { sheetName: 'ملخص الديون والالتزامات', headers: summaryHeaders, rows: summaryRows },
      { sheetName: 'تفاصيل حركات كشف الحسابات', headers: ledgerHeaders, rows: ledgerRows }
    ]);
  };

  // Print PDF Report with Summary Table and Detailed Transaction Ledgers
  const handlePrintPDF = () => {
    const title = `كشف الديون والالتزامات المستحقة للمشروع - ${selectedCurrency}`;

    const rowsHtml = filteredAccounts.map((a, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-weight: bold;">${a.name}</td>
        <td>${a.typeLabel} (${a.profession})</td>
        <td style="color: #15803d; font-weight: bold; font-family: monospace;">${formatCurrency(a.totalForHim, a.currency)}</td>
        <td style="color: #b91c1c; font-weight: bold; font-family: monospace;">${formatCurrency(a.totalOnHim, a.currency)}</td>
        <td style="font-weight: bold; color: ${a.netBalance > 0 ? '#b91c1c' : a.netBalance < 0 ? '#0369a1' : '#475569'}; font-family: monospace;">
          ${formatCurrency(Math.abs(a.netBalance), a.currency)}
        </td>
        <td style="text-align: center;">
          <span style="font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${a.netBalance > 0 ? 'background: #fef2f2; color: #b91c1c;' : a.netBalance < 0 ? 'background: #f0f9ff; color: #0369a1;' : 'background: #f1f5f9; color: #475569;'}">
            ${a.netBalance > 0 ? 'التزام على المشروع (له)' : a.netBalance < 0 ? 'دين للمشروع (عليه)' : 'متزن'}
          </span>
        </td>
      </tr>
    `).join('');

    let detailedLedgersHtml = '';
    filteredAccounts.forEach(account => {
      let ledgerEntries: any[] = [];
      if ('ledger' in account.originalEntity && Array.isArray(account.originalEntity.ledger)) {
        ledgerEntries = account.originalEntity.ledger;
      }

      const sortedEntries = [...ledgerEntries].sort((x, y) => y.date.localeCompare(x.date));

      let ledgerRowsHtml = '';
      sortedEntries.forEach(e => {
        ledgerRowsHtml += `
          <tr>
            <td style="font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatDateArabic(e.date)}</td>
            <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.description}</td>
            <td style="color: #15803d; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${(e.amountForHim || 0) > 0 ? formatCurrency(e.amountForHim, account.currency) : '-'}</td>
            <td style="color: #dc2626; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${(e.amountOnHim || 0) > 0 ? formatCurrency(e.amountOnHim, account.currency) : '-'}</td>
            <td style="font-size: 11px; color: #64748b; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.notes || '-'}</td>
          </tr>
        `;
      });

      detailedLedgersHtml += `
        <div style="margin-top: 25px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: bold; font-size: 14px;">⚖️ ${account.name}</span>
              <span style="font-size: 12px; color: #94a3b8; margin-right: 8px;">(${account.typeLabel} - ${account.profession})</span>
            </div>
            <div style="font-size: 12px; font-weight: bold;">
              <span style="color: #4ade80; margin-left: 8px;">له: ${formatCurrency(account.totalForHim, account.currency)}</span> | 
              <span style="color: #f87171; margin-left: 8px;">عليه: ${formatCurrency(account.totalOnHim, account.currency)}</span> | 
              <span style="color: ${account.netBalance > 0 ? '#f87171' : '#60a5fa'};">الصافي: ${account.netBalance > 0 ? formatCurrency(account.netBalance, account.currency) : formatCurrency(Math.abs(account.netBalance), account.currency)}</span>
            </div>
          </div>
          <table style="margin: 0; width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 15%;">التاريخ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35%;">البيان / الحركة</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">مبلغ له (التزام/مستحق)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">مبلغ عليه (سداد/سلفة)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${sortedEntries.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 10px; border: 1px solid #cbd5e1;">لا توجد معاملات تفصيلية مسجلة في هذا الحساب حالياً.</td></tr>' : ledgerRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    const htmlContent = `
      <div style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 10px;">
        <h2 style="color: #1e293b; text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; font-size: 20px;">
          📊 كشف تفصيلي بالديون والالتزامات المستحقة (عمال، موظفين، موردين)
        </h2>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; color: #475569;">
          <div><strong>العملة المحددة:</strong> ${selectedCurrency}</div>
          <div><strong>تاريخ استخراج التقرير:</strong> ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 6px;">ملخص الالتزامات والديون الإجمالية:</div>
          <div style="display: flex; gap: 20px; font-size: 12px;">
            <div>🔴 <strong>إجمالي التزامات المستحقة للغير (له):</strong> <span style="color: #b91c1c; font-weight: bold;">${formatCurrency(activeKpi.totalLiabilitiesForHim, selectedCurrency)}</span></div>
            <div>🔵 <strong>إجمالي ديون وسلف المقيدة على الغير (عليه):</strong> <span style="color: #0369a1; font-weight: bold;">${formatCurrency(activeKpi.totalReceivablesOnHim, selectedCurrency)}</span></div>
          </div>
        </div>

        <!-- SECTION 1: SUMMARY TABLE -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px;">
            أولاً: جدول ملخص أرصدة كافة حسابات الديون والالتزامات
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
            <thead>
              <tr style="background-color: #0f172a; color: white;">
                <th style="padding: 8px; border: 1px solid #334155; text-align: center; width: 35px;">#</th>
                <th style="padding: 8px; border: 1px solid #334155;">اسم الحساب</th>
                <th style="padding: 8px; border: 1px solid #334155;">الفئة والمهنة</th>
                <th style="padding: 8px; border: 1px solid #334155;">له (مستحقات)</th>
                <th style="padding: 8px; border: 1px solid #334155;">عليه (سلف/مدفوعات)</th>
                <th style="padding: 8px; border: 1px solid #334155;">الصافي النهائي</th>
                <th style="padding: 8px; border: 1px solid #334155; text-align: center;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAccounts.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 12px;">لا توجد حسابات مطابقة.</td></tr>' : rowsHtml}
            </tbody>
          </table>
        </div>

        <!-- SECTION 2: DETAILED TRANSACTION LEDGERS -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
            ثانياً: كشوفات تفصيلية بكافة العمليات المالية المدخلة لكل حساب
          </h3>
          ${filteredAccounts.length === 0 ? '<p style="text-align: center; color: #94a3b8;">لا توجد تفاصيل متاحة.</p>' : detailedLedgersHtml}
        </div>
      </div>
    `;

    printPDF(`كشف الديون والالتزامات التفصيلي الشامل`, htmlContent);
  };

  // Generate WhatsApp Share text summary
  const getWhatsAppShareText = () => {
    const totalLiabilitiesStr = formatCurrency(activeKpi.totalLiabilitiesForHim, selectedCurrency);
    const totalReceivablesStr = formatCurrency(activeKpi.totalReceivablesOnHim, selectedCurrency);

    const topItems = filteredAccounts.slice(0, 10).map(a => {
      const statusStr = a.netBalance > 0 ? `له ${formatCurrency(a.netBalance, a.currency)}` : a.netBalance < 0 ? `عليه ${formatCurrency(Math.abs(a.netBalance), a.currency)}` : 'متزن';
      return `• ${a.name} [${a.typeLabel}]: ${statusStr}`;
    }).join('\n');

    return `⚠️ تقرير الديون والالتزامات المستحقة للمشروع (${selectedCurrency}):
📅 التاريخ: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}

🔴 إجمالي الالتزامات المستحقة للغير (عمال/موظفين/موردين): ${totalLiabilitiesStr}
🔵 إجمالي السلف والديون المستحقة للمشروع لدى الغير: ${totalReceivablesStr}

📋 أبرز الحسابات والبيانات:
${topItems}`;
  };

  // Excel File upload/import handler for Debts and Ledger entries
  const handleDebtsExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const entityName = row['الاسم'] || row['اسم الحساب'] || row['اسم العامل'] || row['اسم المورد'] || row['اسم الموظف'] || row['الجهة'] || row['Name'] || row['name'];
          const dateVal = row['التاريخ'] || row['تاريخ'] || row['Date'] || row['date'];
          const desc = row['البيان'] || row['الوصف'] || row['السبب'] || row['Description'] || row['description'];
          const amountForHim = parseFloat(row['له'] || row['مستحقات له'] || row['تغذية له'] || row['AmountForHim'] || 0);
          const amountOnHim = parseFloat(row['عليه'] || row['سلفة'] || row['دفعة مقدما'] || row['AmountOnHim'] || 0);
          const notesVal = row['الملاحظات'] || row['ملاحظات'] || row['Notes'] || row['notes'] || '';

          if (entityName && (amountForHim > 0 || amountOnHim > 0)) {
            const cleanName = String(entityName).trim().toLowerCase();
            
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

            const entryDate = parseDate(dateVal);
            const entryDesc = desc ? String(desc).trim() : (amountForHim > 0 ? 'قيد مستحقات مستورد' : 'دفعة / سلفة مستوردة');
            const entryNotes = String(notesVal).trim();

            // Check Workers
            const matchedWorker = workers.find(w => w.name.trim().toLowerCase() === cleanName);
            if (matchedWorker && onAddWorkerLedgerEntry) {
              onAddWorkerLedgerEntry(matchedWorker.id, {
                date: entryDate,
                description: entryDesc,
                amountForHim: isNaN(amountForHim) ? 0 : amountForHim,
                amountOnHim: isNaN(amountOnHim) ? 0 : amountOnHim,
                notes: entryNotes
              });
              count++;
              return;
            }

            // Check Employees
            const matchedEmployee = employees.find(emp => emp.name.trim().toLowerCase() === cleanName);
            if (matchedEmployee && onAddEmployeeLedgerEntry) {
              onAddEmployeeLedgerEntry(matchedEmployee.id, {
                date: entryDate,
                description: entryDesc,
                amountForHim: isNaN(amountForHim) ? 0 : amountForHim,
                amountOnHim: isNaN(amountOnHim) ? 0 : amountOnHim,
                notes: entryNotes
              });
              count++;
              return;
            }

            // Check Suppliers
            const matchedSupplier = suppliers.find(s => s.name.trim().toLowerCase() === cleanName);
            if (matchedSupplier && onAddSupplierLedgerEntry) {
              onAddSupplierLedgerEntry(matchedSupplier.id, {
                date: entryDate,
                description: entryDesc,
                amountForHim: isNaN(amountForHim) ? 0 : amountForHim,
                amountOnHim: isNaN(amountOnHim) ? 0 : amountOnHim,
                notes: entryNotes
              });
              count++;
              return;
            }
          }
        });

        if (count > 0) {
          if (typeof window !== 'undefined' && (window as any).showToast) {
            (window as any).showToast(`تم استيراد ${count} حركات ديون والتزامات إلى الحسابات المطابقة بنجاح!`);
          }
        } else {
          if (typeof window !== 'undefined' && (window as any).showToast) {
            (window as any).showToast('لم يتم العثور على أسماء حسابات مطابقة في كشف الديون. يرجى التأكد من تطابق اسم الحساب مع أسماء العمال أو الموظفين أو الموردين.');
          }
        }
      } catch (err) {
        console.error('Debts Excel import error:', err);
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من صيغة الملف.');
        }
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Submit handler for adding a debt entry
  const handleSaveNewDebtEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newDebtData.amount);
    if (isNaN(amt) || amt <= 0) {
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('⚠️ يرجى أدخال مبلغ صحيح أكبر من الصفر.');
      }
      return;
    }

    const entryPayload = {
      date: newDebtData.date || new Date().toISOString().split('T')[0],
      amountForHim: newDebtData.entryType === 'forHim' ? amt : 0,
      amountOnHim: newDebtData.entryType === 'onHim' ? amt : 0,
      description: newDebtData.description.trim() || (newDebtData.entryType === 'forHim' ? 'قيد التزام دائن مستحق' : 'سداد / سلفة مقيدة'),
      notes: newDebtData.notes.trim(),
      currency: newDebtData.currency
    };

    if (newDebtData.category === 'worker') {
      if (!newDebtData.entityId) {
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('⚠️ يرجى اختيار العامل من القائمة.');
        }
        return;
      }
      if (onAddWorkerLedgerEntry) {
        onAddWorkerLedgerEntry(newDebtData.entityId, entryPayload);
      }
    } else if (newDebtData.category === 'employee') {
      if (!newDebtData.entityId) {
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('⚠️ يرجى اختيار الموظف أو المهندس من القائمة.');
        }
        return;
      }
      if (onAddEmployeeLedgerEntry) {
        onAddEmployeeLedgerEntry(newDebtData.entityId, entryPayload);
      }
    } else if (newDebtData.category === 'supplier') {
      if (!newDebtData.entityId) {
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('⚠️ يرجى اختيار المورد من القائمة.');
        }
        return;
      }
      if (onAddSupplierLedgerEntry) {
        onAddSupplierLedgerEntry(newDebtData.entityId, entryPayload);
      }
    } else if (newDebtData.category === 'external') {
      const entityName = newDebtData.customName.trim();
      if (!entityName) {
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast('⚠️ يرجى أدخال اسم الجهة أو الشخص الدائن الخارجي.');
        }
        return;
      }

      let extList = [...externalAccounts];
      let matched = extList.find(x => x.name.trim().toLowerCase() === entityName.toLowerCase());
      
      const newLedgerItem = {
        id: 'extled_' + Date.now().toString(),
        ...entryPayload,
        createdBy: 'النظام'
      };

      if (matched) {
        matched.ledger = [newLedgerItem, ...matched.ledger];
      } else {
        const newExt: ExternalDebtAccount = {
          id: 'ext_' + Date.now().toString(),
          name: entityName,
          profession: newDebtData.customProfession.trim() || 'التزام دائن خارجي',
          ledger: [newLedgerItem]
        };
        extList.push(newExt);
      }
      saveExternalAccounts(extList);
    }

    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast('✅ تم تسجيل قيد الدين / الالتزام بنجاح في كشف الحساب المالي!');
    }

    setShowAddDebtModal(false);
    setNewDebtData({
      category: 'worker',
      entityId: '',
      customName: '',
      customProfession: 'التزام دائن خارجي',
      entryType: 'forHim',
      amount: '',
      currency: currency,
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: ''
    });
  };

  return (
    <div className="space-y-6 dir-rtl text-right animate-fade-in pb-12">
      {/* Top Header Banner */}
      <PageHeaderCard
        title="سجل الديون والالتزامات المالية المستحقة"
        description="سجل تفصيلي دقيق لمستحقات وديون العمال والمقاولين والمهندسين والموردين والجهات الدائنة والمدينة على المشروع."
        icon={<Coins size={20} />}
        onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
        optionsMenu={
          <OptionsMenu 
            onExportExcel={handleExportExcel}
            onExportPDF={handlePrintPDF}
            onImportExcel={sharedRole !== 'read' ? handleDebtsExcelImport : undefined}
            shareTitle="سجل الديون والالتزامات المالية المستحقة"
            shareText={getWhatsAppShareText()}
          />
        }
      />

      {/* Currency Selector Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
          <Filter size={15} className="text-amber-600" />
          اختر العملة لعرض الملخص والمجاميع:
        </span>
        <div className="flex items-center gap-1.5">
          {currencies.map(cur => (
            <button
              key={cur}
              onClick={() => setSelectedCurrency(cur)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                selectedCurrency === cur 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cur === 'YER' ? 'ريال يمني (YER)' : cur === 'SAR' ? 'ريال سعودي (SAR)' : 'دولار أمريكي (USD)'}
            </button>
          ))}
          <button
            onClick={() => setSelectedCurrency('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              selectedCurrency === 'all' 
                ? 'bg-slate-800 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            كافة العملات
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Liabilities Owed BY Project Card */}
        <div className="bg-gradient-to-br from-rose-50 via-white to-rose-50/30 p-5 rounded-2xl border border-rose-200 shadow-2xs relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-800">إجمالي الالتزامات المستحقة للغير (على المشروع)</span>
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-900 dir-ltr text-right">
            {formatCurrency(activeKpi.totalLiabilitiesForHim, selectedCurrency === 'all' ? currency : selectedCurrency)}
          </div>
          <p className="text-[11px] text-rose-600/80 mt-2 font-medium">
            مستحقات واجبة السدد لـ {activeKpi.countForHim} حسابات (عمال، موظفين، موردين).
          </p>
        </div>

        {/* Total Debts Owed TO Project Card */}
        <div className="bg-gradient-to-br from-sky-50 via-white to-sky-50/30 p-5 rounded-2xl border border-sky-200 shadow-2xs relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-sky-800">إجمالي السلف والديون المقيدة على الغير (لصالح المشروع)</span>
            <div className="p-2 bg-sky-500/10 text-sky-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-900 dir-ltr text-right">
            {formatCurrency(activeKpi.totalReceivablesOnHim, selectedCurrency === 'all' ? currency : selectedCurrency)}
          </div>
          <p className="text-[11px] text-sky-600/80 mt-2 font-medium">
            سلف ومبالغ مدفوعة مقيدة لصالح المشروع لدى {activeKpi.countOnHim} أطراف.
          </p>
        </div>

        {/* Breakdown Summary Badge Card */}
        <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 p-5 rounded-2xl border border-amber-200 shadow-2xs relative sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-900">توزيع الحسابات حسب الفئة</span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {filteredAccounts.length} حساب
            </span>
          </div>

          <div className="space-y-1.5 mt-3 text-xs text-slate-700">
            <div className="flex items-center justify-between p-1.5 bg-white/80 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1.5 font-bold">
                <Users size={14} className="text-sky-500" /> العمال الميدانيين:
              </span>
              <span className="font-extrabold">{accountItems.filter(i => i.type === 'worker').length} حساب</span>
            </div>

            <div className="flex items-center justify-between p-1.5 bg-white/80 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1.5 font-bold">
                <Briefcase size={14} className="text-indigo-500" /> الموظفين والمهندسين:
              </span>
              <span className="font-extrabold">{accountItems.filter(i => i.type === 'employee').length} حساب</span>
            </div>

            <div className="flex items-center justify-between p-1.5 bg-white/80 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1.5 font-bold">
                <Truck size={14} className="text-amber-500" /> الموردين والشركات:
              </span>
              <span className="font-extrabold">{accountItems.filter(i => i.type === 'supplier').length} حساب</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="ابحث باسم الموظف أو المهندس أو العامل أو المورد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                typeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كافة الفئات
            </button>
            <button
              onClick={() => setTypeFilter('worker')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                typeFilter === 'worker' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              <Users size={13} /> العمال والمقاولين
            </button>
            <button
              onClick={() => setTypeFilter('employee')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                typeFilter === 'employee' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <Briefcase size={13} /> الموظفين والمهندسين
            </button>
            <button
              onClick={() => setTypeFilter('supplier')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                typeFilter === 'supplier' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <Truck size={13} /> الموردين والشركات
            </button>
            <button
              onClick={() => setTypeFilter('external')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                typeFilter === 'external' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Coins size={13} /> جهات ودائنون خارجيون
            </button>
          </div>
        </div>

        {/* Status Filter Sub-bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-500 text-[11px]">حالة الرصيد:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              statusFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setStatusFilter('forHim')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              statusFilter === 'forHim' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            التزام على المشروع (له &gt; 0)
          </button>
          <button
            onClick={() => setStatusFilter('onHim')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              statusFilter === 'onHim' ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'text-sky-600 hover:bg-sky-50'
            }`}
          >
            دين للمشروع (عليه &gt; 0)
          </button>
          <button
            onClick={() => setStatusFilter('settled')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
              statusFilter === 'settled' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            حسابات متزنة (0.00)
          </button>
        </div>
      </div>

      {/* Main Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <Coins size={17} className="text-amber-600" />
              جدول كشوفات الحسابات والديون التفصيلي
            </h3>
            <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
              عرض {filteredAccounts.length} من {accountItems.length} حساب
            </span>
          </div>

          {sharedRole !== 'read' && (
            <button
              onClick={() => {
                setNewDebtData(prev => ({
                  ...prev,
                  category: 'worker',
                  entityId: workers[0]?.id || '',
                  entryType: 'forHim'
                }));
                setShowAddDebtModal(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-black text-xs py-2 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-amber-400/50"
            >
              <span>+ تسجيل قيد دين / التزام جديد</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3.5">الاسم والجهة</th>
                <th className="p-3.5">الفئة والمهنة</th>
                <th className="p-3.5 text-emerald-700">له (مستحقاته)</th>
                <th className="p-3.5 text-rose-700">عليه (سلف ومدفوعات)</th>
                <th className="p-3.5">الصافي النهائي</th>
                <th className="p-3.5">حالة الرصيد</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <AlertTriangle size={32} className="mx-auto mb-2 text-slate-300" />
                    لا توجد حسابات أو ديون مطابقة لمعايير البحث الحالية.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => {
                  const isForHim = account.netBalance > 0;
                  const isOnHim = account.netBalance < 0;
                  const isSettled = account.netBalance === 0;

                  return (
                    <tr key={account.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          {account.type === 'worker' && <Users size={15} className="text-sky-500" />}
                          {account.type === 'employee' && <Briefcase size={15} className="text-indigo-500" />}
                          {account.type === 'supplier' && <Truck size={15} className="text-amber-500" />}
                          {account.type === 'external' && <Coins size={15} className="text-purple-500" />}
                          <span>{account.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          آخر حركة: {account.lastDate ? formatDateArabic(account.lastDate) : 'لا توجد حركات'} ({account.ledgerCount} حركات مقيدة)
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          account.type === 'worker' 
                            ? 'bg-sky-50 text-sky-700 border border-sky-200/60' 
                            : account.type === 'employee' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' 
                            : account.type === 'supplier'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                            : 'bg-purple-50 text-purple-800 border border-purple-200/60'
                        }`}>
                          {account.typeLabel} - {account.profession}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-emerald-700 text-sm dir-ltr text-right">
                        {formatCurrency(account.totalForHim, account.currency)}
                      </td>

                      <td className="p-3.5 font-bold text-rose-700 text-sm dir-ltr text-right">
                        {formatCurrency(account.totalOnHim, account.currency)}
                      </td>

                      <td className="p-3.5 font-extrabold text-sm dir-ltr text-right">
                        <span className={isForHim ? 'text-rose-700' : isOnHim ? 'text-sky-700' : 'text-slate-600'}>
                          {formatCurrency(Math.abs(account.netBalance), account.currency)}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {isForHim && (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                            <TrendingDown size={12} /> التزام على المشروع (له)
                          </span>
                        )}
                        {isOnHim && (
                          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                            <TrendingUp size={12} /> دين للمشروع (عليه)
                          </span>
                        )}
                        {isSettled && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                            <CheckCircle2 size={12} /> خالص / متزن
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {sharedRole !== 'read' && (
                            <button
                              onClick={() => {
                                const realId = (account.originalEntity as any).id;
                                setNewDebtData({
                                  category: account.type,
                                  entityId: realId,
                                  customName: account.name,
                                  customProfession: account.profession,
                                  entryType: 'forHim',
                                  amount: '',
                                  currency: account.currency,
                                  date: new Date().toISOString().split('T')[0],
                                  description: '',
                                  notes: ''
                                });
                                setShowAddDebtModal(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
                              title="تسجيل حركة دين أو سداد سريعة لهذا الحساب"
                            >
                              + حركة جديدة
                            </button>
                          )}

                          <button
                            onClick={() => setActiveDetailItem(account)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>التفاصيل</span>
                          </button>

                          {account.type === 'external' && sharedRole !== 'read' && sharedRole !== 'add' && (
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف الحساب الخارجي (${account.name}) وكافة حركاته المالية؟`)) {
                                  const updated = externalAccounts.filter(x => x.id !== account.originalEntity.id);
                                  saveExternalAccounts(updated);
                                  if (typeof window !== 'undefined' && (window as any).showToast) {
                                    (window as any).showToast(`تم حذف الحساب الخارجي (${account.name}) بنجاح.`);
                                  }
                                }
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] py-1.5 px-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              title="حذف الحساب الخارجي"
                            >
                              <Trash2 size={13} />
                              <span>حذف</span>
                            </button>
                          )}

                          {account.type !== 'external' && (
                            <button
                              onClick={() => {
                                if (account.type === 'worker') setActiveTab('workers');
                                if (account.type === 'employee') setActiveTab('employees');
                                if (account.type === 'supplier') setActiveTab('suppliers');
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] py-1.5 px-2 rounded-lg transition-colors cursor-pointer"
                              title="الانتقال إلى النافذة المخصصة"
                            >
                              <ArrowLeft size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Debt / Commitment Movement Modal */}
      {showAddDebtModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full animate-scale-up my-auto max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-700 rounded-xl">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تسجيل قيد دين / التزام مالي جديد</h3>
                  <p className="text-[11px] text-slate-400">تقييد مستحقات أو سلف لحسابات العمال، المهندسين، الموردين، أو دائن خارجي</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDebtModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewDebtEntry} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
                
                {/* Category Selector */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">فئة الحساب المعني:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNewDebtData(prev => ({
                          ...prev,
                          category: 'worker',
                          entityId: workers[0]?.id || ''
                        }));
                      }}
                      className={`p-2 rounded-xl text-center font-bold cursor-pointer transition-all border ${
                        newDebtData.category === 'worker' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      عامل / مقاول
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewDebtData(prev => ({
                          ...prev,
                          category: 'employee',
                          entityId: employees[0]?.id || ''
                        }));
                      }}
                      className={`p-2 rounded-xl text-center font-bold cursor-pointer transition-all border ${
                        newDebtData.category === 'employee' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      موظف / مهندس
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewDebtData(prev => ({
                          ...prev,
                          category: 'supplier',
                          entityId: suppliers[0]?.id || ''
                        }));
                      }}
                      className={`p-2 rounded-xl text-center font-bold cursor-pointer transition-all border ${
                        newDebtData.category === 'supplier' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      مورد / شركة
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewDebtData(prev => ({
                          ...prev,
                          category: 'external',
                          entityId: ''
                        }));
                      }}
                      className={`p-2 rounded-xl text-center font-bold cursor-pointer transition-all border ${
                        newDebtData.category === 'external' ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      دائن / جهة خارجية
                    </button>
                  </div>
                </div>

                {/* Entity Selector or Input */}
                {newDebtData.category === 'worker' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اختر العامل / المقاول:</label>
                    <select
                      value={newDebtData.entityId}
                      onChange={(e) => setNewDebtData(prev => ({ ...prev, entityId: e.target.value }))}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.profession})</option>
                      ))}
                    </select>
                  </div>
                )}

                {newDebtData.category === 'employee' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اختر الموظف / المهندس:</label>
                    <select
                      value={newDebtData.entityId}
                      onChange={(e) => setNewDebtData(prev => ({ ...prev, entityId: e.target.value }))}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.profession})</option>
                      ))}
                    </select>
                  </div>
                )}

                {newDebtData.category === 'supplier' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اختر المورد / الشركة:</label>
                    <select
                      value={newDebtData.entityId}
                      onChange={(e) => setNewDebtData(prev => ({ ...prev, entityId: e.target.value }))}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.materialType})</option>
                      ))}
                    </select>
                  </div>
                )}

                {newDebtData.category === 'external' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">اسم الجهة أو الشخص الدائن:</label>
                      <input
                        type="text"
                        placeholder="مثال: مكتب استشارات هندسية / دائن خارجي"
                        value={newDebtData.customName}
                        onChange={(e) => setNewDebtData(prev => ({ ...prev, customName: e.target.value }))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">الصلة / نوع التسمية:</label>
                      <input
                        type="text"
                        placeholder="مثال: إيجار معُدّات / تمويل خارجي"
                        value={newDebtData.customProfession}
                        onChange={(e) => setNewDebtData(prev => ({ ...prev, customProfession: e.target.value }))}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Entry Type Selector */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">نوع القيد المالي:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDebtData(prev => ({ ...prev, entryType: 'forHim' }))}
                      className={`p-3 rounded-xl border font-extrabold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        newDebtData.entryType === 'forHim'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-emerald-700 font-black">🔴 له (مستحق للطرف / التزام دائن)</span>
                      <span className="text-[10px] text-slate-500 font-normal">أجور غير مدفوعة، قيمة توريدات آجل، التزام مستحق</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewDebtData(prev => ({ ...prev, entryType: 'onHim' }))}
                      className={`p-3 rounded-xl border font-extrabold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                        newDebtData.entryType === 'onHim'
                          ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-rose-700 font-black">🔵 عليه (سداد / سلفة مقيدة للطرف)</span>
                      <span className="text-[10px] text-slate-500 font-normal">سداد مستحقات سابقة، سلفة مسحوبة، خصم</span>
                    </button>
                  </div>
                </div>

                {/* Amount and Currency */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-700 font-bold mb-1">المبلغ:</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="أدخل المبلغ..."
                      value={newDebtData.amount}
                      onChange={(e) => setNewDebtData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:border-amber-500 dir-ltr text-right"
                      required
                    />
                    <AmountInWords amount={newDebtData.amount} currency={newDebtData.currency} />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">العملة:</label>
                    <select
                      value={newDebtData.currency}
                      onChange={(e) => setNewDebtData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      <option value="YER">ريال يمني (YER)</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">التاريخ:</label>
                  <input
                    type="date"
                    value={newDebtData.date}
                    onChange={(e) => setNewDebtData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">البيان / السبب:</label>
                  <input
                    type="text"
                    placeholder="مثال: أجور عمل أسبوعي، مستحقات توريد خرسانة بالآجل، سداد دفعة نقدية..."
                    value={newDebtData.description}
                    onChange={(e) => setNewDebtData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ملاحظات إضافية:</label>
                  <textarea
                    rows={2}
                    placeholder="أي تفاصيل أو ملاحظات أخرى..."
                    value={newDebtData.notes}
                    onChange={(e) => setNewDebtData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddDebtModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ وتسجيل القيد
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Detail Ledger Modal for Selected Entity */}
      {activeDetailItem && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full animate-scale-up my-auto max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] mb-1">
                  كشف حساب مالي تفصيلي
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>{activeDetailItem.name}</span>
                  <span className="text-xs font-semibold text-slate-400">({activeDetailItem.profession})</span>
                </h3>
              </div>

              <button
                onClick={() => setActiveDetailItem(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Quick Balances Summary Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">إجمالي المبالغ له (مستحقات)</span>
                  <span className="font-black text-emerald-700 text-sm dir-ltr block text-right">
                    {formatCurrency(activeDetailItem.totalForHim, activeDetailItem.currency)}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-rose-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">إجمالي المبالغ عليه (سلف)</span>
                  <span className="font-black text-rose-700 text-sm dir-ltr block text-right">
                    {formatCurrency(activeDetailItem.totalOnHim, activeDetailItem.currency)}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-amber-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الصافي الحالي</span>
                  <span className={`font-black text-sm dir-ltr block text-right ${activeDetailItem.netBalance > 0 ? 'text-rose-700' : activeDetailItem.netBalance < 0 ? 'text-sky-700' : 'text-slate-600'}`}>
                    {formatCurrency(Math.abs(activeDetailItem.netBalance), activeDetailItem.currency)}
                  </span>
                </div>
              </div>

              {/* Detailed Ledger Transactions Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700">
                  جميع العمليات والحركات المالية المقيدة للحساب ({activeDetailItem.originalEntity.ledger?.length || 0} عملية):
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5">البيان والتفاصيل</th>
                        <th className="p-2.5 text-emerald-700">له</th>
                        <th className="p-2.5 text-rose-700">عليه</th>
                        <th className="p-2.5">أضيف بواسطة</th>
                        {activeDetailItem.type === 'external' && sharedRole !== 'read' && sharedRole !== 'add' && (
                          <th className="p-2.5 text-center">إجراءات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {(!activeDetailItem.originalEntity.ledger || activeDetailItem.originalEntity.ledger.length === 0) ? (
                        <tr>
                          <td colSpan={activeDetailItem.type === 'external' ? 6 : 5} className="p-8 text-center text-slate-400">
                            لا توجد عمليات مقيدة لهذا الحساب حالياً.
                          </td>
                        </tr>
                      ) : (
                        activeDetailItem.originalEntity.ledger.map((entry, idx) => (
                          <tr key={entry.id || idx} className="hover:bg-slate-50">
                            <td className="p-2.5 whitespace-nowrap text-slate-500 font-semibold">
                              {formatDateArabic(entry.date)}
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-800">{entry.description}</div>
                              {entry.notes && <div className="text-[10px] text-slate-400 mt-0.5">{entry.notes}</div>}
                            </td>
                            <td className="p-2.5 font-bold text-emerald-700 dir-ltr text-right">
                              {entry.amountForHim > 0 ? formatCurrency(entry.amountForHim, entry.currency || activeDetailItem.currency) : '-'}
                            </td>
                            <td className="p-2.5 font-bold text-rose-700 dir-ltr text-right">
                              {entry.amountOnHim > 0 ? formatCurrency(entry.amountOnHim, entry.currency || activeDetailItem.currency) : '-'}
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-400">
                              {(entry.createdBy && !isOwnerUser(entry.createdBy)) ? entry.createdBy : '-'}
                            </td>
                            {activeDetailItem.type === 'external' && sharedRole !== 'read' && sharedRole !== 'add' && (
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={() => {
                                    if (confirm(`هل أنت متأكد من حذف هذه الحركة المالية (${entry.description})؟`)) {
                                      const updated = externalAccounts.map(x => {
                                        if (x.id === activeDetailItem.originalEntity.id) {
                                          return {
                                            ...x,
                                            ledger: x.ledger.filter(l => l.id !== entry.id)
                                          };
                                        }
                                        return x;
                                      });
                                      saveExternalAccounts(updated);
                                      setActiveDetailItem(null);
                                      if (typeof window !== 'undefined' && (window as any).showToast) {
                                        (window as any).showToast('تم حذف الحركة المالية بنجاح.');
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                                  title="حذف الحركة"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
              <button
                onClick={() => {
                  const type = activeDetailItem.type;
                  setActiveDetailItem(null);
                  if (type === 'worker') setActiveTab('workers');
                  if (type === 'employee') setActiveTab('employees');
                  if (type === 'supplier') setActiveTab('suppliers');
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>الانتقال إلى كشف الحساب الكامل في {activeDetailItem.typeLabel}</span>
                <ArrowLeft size={14} />
              </button>

              <button
                onClick={() => setActiveDetailItem(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      <AttributionBadge />
    </div>
  );
}
