/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { isOwnerUser } from './AttributionBadge';
import { AmountInWords } from './AmountInWords';
import { 
  PlusCircle, 
  Trash2, 
  UserPlus, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Truck, 
  ChevronLeft, 
  ArrowLeft, 
  Package, 
  Search,
  Filter,
  Info,
  Pencil,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  Supplier, 
  LedgerEntry, 
  formatCurrency, 
  formatDateArabic,
  cleanLedgerDescription,
  exportToCSV,
  exportMultiSheetXLSX,
  printPDF
} from '../types';
import AttributionBadge from './AttributionBadge';
import Calculator from './Calculator';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';
import PhoneNumbersInput, { PhoneNumbersDisplay } from './PhoneNumbersInput';
import ExcelColumnFilter, { ColumnFilterConfig, ActiveColumnFilter, ColumnSortState } from './ExcelColumnFilter';
import { useBodyScrollLock } from '../utils/modalScrollLock';
import * as XLSX from 'xlsx';

interface SuppliersProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'ledger'>) => void;
  onDeleteSupplier: (id: string) => void;
  onUpdateSupplier?: (id: string, updatedData: Omit<Supplier, 'id' | 'ledger' | 'createdBy'>) => void;
  onAddSupplierLedgerEntry: (supplierId: string, entry: Omit<LedgerEntry, 'id'>) => void;
  onDeleteSupplierLedgerEntry: (supplierId: string, entryId: string) => void;
  onUpdateSupplierLedgerEntry?: (supplierId: string, entryId: string, updatedEntry: Omit<LedgerEntry, 'id' | 'createdBy'>) => void;
  setActiveTab?: (tab: string) => void;
  currency?: string;
  sharedRole?: string;
}

export default function Suppliers({
  suppliers,
  onAddSupplier,
  onDeleteSupplier,
  onUpdateSupplier,
  onAddSupplierLedgerEntry,
  onDeleteSupplierLedgerEntry,
  onUpdateSupplierLedgerEntry,
  setActiveTab,
  currency = 'YER',
  sharedRole = 'admin'
}: SuppliersProps) {
  
  // Selection states
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Edit Supplier states
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingSupplierLedger, setEditingSupplierLedger] = useState<{ supplierId: string; entry: LedgerEntry } | null>(null);

  // Lock background scroll when modal is open
  useBodyScrollLock(Boolean(editingSupplier || editingSupplierLedger));

  // Submit handlers for editing
  const handleEditSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    const rawPhones = editingSupplier.phoneNumbers || [];
    if (rawPhones.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      alert('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567)');
      return;
    }
    const cleanPhones = rawPhones.map(p => p.trim()).filter(p => p.length === 9);

    if (onUpdateSupplier) {
      onUpdateSupplier(editingSupplier.id, {
        name: editingSupplier.name,
        materialType: editingSupplier.materialType,
        phoneNumbers: cleanPhones,
        notes: editingSupplier.notes || ''
      });
    }
    setEditingSupplier(null);
  };

  const handleEditSupplierLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplierLedger) return;
    if (onUpdateSupplierLedgerEntry) {
      onUpdateSupplierLedgerEntry(editingSupplierLedger.supplierId, editingSupplierLedger.entry.id, {
        date: editingSupplierLedger.entry.date,
        amountOnHim: editingSupplierLedger.entry.amountOnHim,
        amountForHim: editingSupplierLedger.entry.amountForHim,
        description: editingSupplierLedger.entry.description,
        notes: editingSupplierLedger.entry.notes,
        currency: editingSupplierLedger.entry.currency || 'YER'
      });
    }
    setEditingSupplierLedger(null);
  };

  // Add Supplier form
  const [showAddSupplierForm, setShowAddSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newMaterialType, setNewMaterialType] = useState('');
  const [newSupplierPhoneNumbers, setNewSupplierPhoneNumbers] = useState<string[]>(['']);
  const [newSupplierNotes, setNewSupplierNotes] = useState('');

  // Add Supplier Ledger Entry form
  const [ledgerDate, setLedgerDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ledgerAmountOnHim, setLedgerAmountOnHim] = useState(''); // عليه (ما دفعناه له)
  const [ledgerAmountForHim, setLedgerAmountForHim] = useState(''); // له (قيمة المواد الموردة)
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [ledgerCurrency, setLedgerCurrency] = useState(currency);
  const [showAddLedgerForm, setShowAddLedgerForm] = useState(false);

  // Search filter & sort filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSortOrder, setSupplierSortOrder] = useState<'asc' | 'desc'>('desc'); // Default desc: newest first
  
  // Ledger filters state
  const [isLedgerFiltersOpen, setIsLedgerFiltersOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'onHim' | 'forHim'>('all');
  const [ledgerSortOption, setLedgerSortOption] = useState<'date-desc' | 'date-asc' | 'desc-alpha' | 'amountOnHim-desc' | 'amountForHim-desc'>('date-desc');

  // Alerts
  const [supplierError, setSupplierError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  // Keep ledger currency in sync with global currency selection when prop changes
  useEffect(() => {
    setLedgerCurrency(currency);
  }, [currency]);

  // Find active supplier
  const activeSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Form submit for new supplier
  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError('');

    if (!newSupplierName.trim()) {
      setSupplierError('الرجاء إدخال اسم المورد.');
      return;
    }
    if (!newMaterialType.trim()) {
      setSupplierError('الرجاء إدخال نوع المواد الموردة.');
      return;
    }

    if (newSupplierPhoneNumbers.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      setSupplierError('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567).');
      return;
    }

    const validPhones = newSupplierPhoneNumbers.map(p => p.trim()).filter(p => p.length === 9);

    onAddSupplier({
      name: newSupplierName.trim(),
      materialType: newMaterialType.trim(),
      phoneNumbers: validPhones,
      notes: newSupplierNotes.trim()
    });

    // Reset Form
    setNewSupplierName('');
    setNewMaterialType('');
    setNewSupplierPhoneNumbers(['']);
    setNewSupplierNotes('');
    setShowAddSupplierForm(false);
  };

  // Form submit for ledger entry
  const handleAddLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerError('');

    const onHim = parseFloat(ledgerAmountOnHim) || 0;
    const forHim = parseFloat(ledgerAmountForHim) || 0;

    if (onHim === 0 && forHim === 0) {
      setLedgerError('يجب إدخال قيمة في حقل "مبلغ عليه" أو "مبلغ له".');
      return;
    }
    if (onHim < 0 || forHim < 0) {
      setLedgerError('المبالغ يجب أن تكون قيم موجبة.');
      return;
    }
    if (!ledgerDescription.trim()) {
      setLedgerError('الرجاء إدخال البيان.');
      return;
    }

    if (selectedSupplierId) {
      onAddSupplierLedgerEntry(selectedSupplierId, {
        date: ledgerDate,
        amountOnHim: onHim,
        amountForHim: forHim,
        description: ledgerDescription.trim(),
        notes: ledgerNotes.trim(),
        currency: ledgerCurrency
      });

      // Reset fields
      setLedgerAmountOnHim('');
      setLedgerAmountForHim('');
      setLedgerDescription('');
      setLedgerNotes('');
    }
  };

  // Excel File upload/import handler for suppliers list
  const handleSupplierExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          // Map properties (support both Arabic and English names)
          const name = row['الاسم'] || row['اسم المورد'] || row['Name'] || row['name'] || row['المورد'] || row['الموردين'];
          const materialType = row['نوع المواد'] || row['المواد'] || row['المواد الموردة'] || row['Material Type'] || row['material_type'] || row['Type'] || row['type'] || 'مواد عامة';
          const phoneRaw = row['رقم الهاتف'] || row['الهاتف'] || row['رقم الجوال'] || row['الجوال'] || row['Phone'] || row['phone'] || '';

          const phoneNumbers: string[] = [];
          if (phoneRaw) {
            String(phoneRaw).split(/[,;/\n]+/).forEach(p => {
              const digits = p.replace(/\D/g, '').slice(0, 9);
              if (digits.length === 9) phoneNumbers.push(digits);
            });
          }

          if (name) {
            onAddSupplier({
              name: String(name).trim(),
              materialType: String(materialType).trim(),
              phoneNumbers
            });
            count++;
          }
        });

        alert(`تم استيراد ${count} مورد بنجاح من ملف Excel!`);
      } catch (err) {
        console.error("Error reading Excel for suppliers:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من أن الأعمدة مطابقة (اسم المورد، نوع المواد الموردة).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Excel File upload/import handler for active supplier's ledger
  const handleLedgerExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSupplierId) return;

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
          const desc = row['البيان'] || row['التفاصيل'] || row['Description'] || row['description'] || row['Details'] || row['details'] || row['البيان/العمليات'];
          const onHim = parseFloat(row['مبلغ عليه'] || row['المسدد'] || row['سلف'] || row['عليه'] || row['On Him'] || row['Debit'] || row['on_him'] || row['debit']) || 0;
          const forHim = parseFloat(row['مبلغ له'] || row['قيمة المواد'] || row['المواد'] || row['له'] || row['For Him'] || row['Credit'] || row['for_him'] || row['credit']) || 0;
          const notes = row['ملاحظات'] || row['الملاحظات'] || row['Notes'] || row['notes'] || '';
          const cur = row['العملة'] || row['currency'] || row['Currency'] || ledgerCurrency || currency || 'YER';

          if (dateVal && desc && (onHim > 0 || forHim > 0)) {
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

            onAddSupplierLedgerEntry(selectedSupplierId, {
              date: parseDate(dateVal),
              amountOnHim: onHim,
              amountForHim: forHim,
              description: String(desc).trim(),
              notes: String(notes).trim(),
              currency: String(cur).trim()
            });
            count++;
          }
        });

        alert(`تم استيراد عدد ${count} حركة مالية بنجاح إلى كشف حساب المورد!`);
      } catch (err) {
        console.error("Error reading Excel supplier ledger:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel للكشف. يرجى التأكد من مطابقة الأعمدة (التاريخ، البيان، مبلغ عليه، مبلغ له، ملاحظات).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Export Suppliers Directory & Detailed Ledgers to Multi-sheet Excel
  const handleExportAllCSV = () => {
    // Sheet 1: Summary
    const summaryHeaders = [
      'الرقم التعريفي',
      'اسم المورد / الشركة',
      'نوع المواد الموردة',
      'رقم الهاتف',
      'إجمالي له (قيمة البضاعة المستلمة)',
      'إجمالي عليه (دفعات نقدية مسددة)',
      'صافي الرصيد الحالي',
      'الحالة المالية'
    ];

    const summaryRows = suppliers.map(s => {
      const totalOnHim = s.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = s.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;
      const netText = net === 0 ? 'خالص' : net > 0 ? `له: ${net}` : `عليه: ${Math.abs(net)}`;

      return [
        s.id,
        s.name,
        s.materialType,
        s.phoneNumbers?.join(' - ') || '-',
        totalForHim,
        totalOnHim,
        net,
        netText
      ];
    });

    // Sheet 2: Detailed ledger entries for ALL suppliers
    const ledgerHeaders = [
      'اسم المورد',
      'نوع المواد',
      'تاريخ الحركة',
      'البيان / الفاتورة / التفاصيل',
      'مبلغ له (توريد مواد)',
      'مبلغ عليه (سداد / دفعة)',
      'العملة',
      'الملاحظات',
      'بواسطة'
    ];

    const ledgerRows: (string | number)[][] = [];
    suppliers.forEach(s => {
      s.ledger.forEach(entry => {
        ledgerRows.push([
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
      });
    });
    ledgerRows.sort((a, b) => (b[2] as string).localeCompare(a[2] as string));

    exportMultiSheetXLSX(`تقرير_الموردين_التفصيلي_الشامل_${new Date().toISOString().split('T')[0]}`, [
      { sheetName: 'سجل الموردين العام', headers: summaryHeaders, rows: summaryRows },
      { sheetName: 'تفاصيل حركات كشف الموردين', headers: ledgerHeaders, rows: ledgerRows }
    ]);
  };

  // Export Active Supplier's ledger to CSV
  const handleExportLedgerCSV = (supplier: Supplier) => {
    const headers = [
      'التاريخ',
      'البيان',
      'مبلغ عليه (دفعات نقدية مسددة)',
      'مبلغ له (قيمة المواد المستلمة)',
      'ملاحظات'
    ];

    const sortedLedger = [...supplier.ledger].sort((a, b) => b.date.localeCompare(a.date));
    const rows = sortedLedger.map(e => [
      e.date,
      e.description,
      e.amountOnHim.toString(),
      e.amountForHim.toString(),
      e.notes
    ]);

    exportToCSV(`كشف_حساب_المورد_${supplier.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  // Print Active Supplier's Ledger to PDF
  const handlePrintSupplierPDF = (supplier: Supplier) => {
    const totalOnHim = supplier.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
    const totalForHim = supplier.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
    const net = totalForHim - totalOnHim;

    let ledgerRowsHtml = '';
    const sortedLedgerForPrint = [...supplier.ledger].sort((a, b) => b.date.localeCompare(a.date));
    sortedLedgerForPrint.forEach(e => {
      ledgerRowsHtml += `
        <tr>
          <td>${formatDateArabic(e.date)}</td>
          <td style="font-weight: bold;">${e.description}</td>
          <td style="color: #dc2626;">${e.amountOnHim > 0 ? formatCurrency(e.amountOnHim) : '-'}</td>
          <td style="color: #16a34a;">${e.amountForHim > 0 ? formatCurrency(e.amountForHim) : '-'}</td>
          <td style="font-size: 12px; color: #64748b;">${e.notes || '-'}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <div class="header">
        <h1 class="title">كشف حساب ومعاملات المورد</h1>
        <div class="meta">تم استخراج الكشف في: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
      </div>

      <div class="info-grid">
        <div class="info-item"><span class="info-label">اسم المورد:</span> ${supplier.name}</div>
        <div class="info-item"><span class="info-label">نوع المواد الموردة:</span> ${supplier.materialType}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>البيان</th>
            <th>مبلغ عليه (دفعات مسددة له)</th>
            <th>مبلغ له (قيمة مواد مستلمة)</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${supplier.ledger.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">لا توجد تعاملات مسجلة حالياً.</td></tr>' : ledgerRowsHtml}
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-box">إجمالي المسدد له (عليه): <span style="color: #dc2626;">${formatCurrency(totalOnHim)}</span></div>
        <div class="total-box">إجمالي قيمة المواد (له): <span style="color: #16a34a;">${formatCurrency(totalForHim)}</span></div>
        <div class="total-box" style="background-color: ${net >= 0 ? '#f5f3ff' : '#fef2f2'}; border-color: ${net >= 0 ? '#ddd6fe' : '#fecaca'};">
          صافي الرصيد المستحق: 
          <span style="color: ${net >= 0 ? '#6d28d9' : '#b91c1c'}; font-size: 18px;">
            ${net === 0 ? 'خالص الطرفين' : net > 0 ? `${formatCurrency(net)} (مطلوب تسديده له)` : `${formatCurrency(Math.abs(net))} (مستحق لنا كدفعة فائضة لديه)`}
          </span>
        </div>
      </div>
    `;

    printPDF(`كشف حساب المورد ${supplier.name}`, htmlContent);
  };

  // Print all suppliers summary and detailed ledgers PDF
  const handlePrintAllSuppliersPDF = () => {
    let grandOnHim = 0;
    let grandForHim = 0;

    let supplierSummaryRowsHtml = '';
    let suppliersDetailedLedgersHtml = '';

    suppliers.forEach(s => {
      const totalOnHim = s.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = s.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;

      grandOnHim += totalOnHim;
      grandForHim += totalForHim;

      // 1. Summary row
      supplierSummaryRowsHtml += `
        <tr>
          <td style="font-weight: bold;">${s.name}</td>
          <td>${s.materialType}</td>
          <td style="color: #dc2626; font-family: monospace;">${formatCurrency(totalOnHim, currency)}</td>
          <td style="color: #16a34a; font-family: monospace;">${formatCurrency(totalForHim, currency)}</td>
          <td style="font-weight: bold; color: ${net >= 0 ? '#6d28d9' : '#b91c1c'}; font-family: monospace;">
            ${net === 0 ? 'خالص' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`}
          </td>
        </tr>
      `;

      // 2. Detailed ledger table for this supplier
      let ledgerRowsHtml = '';
      const sortedLedgerForPrint = [...s.ledger].sort((a, b) => b.date.localeCompare(a.date));
      sortedLedgerForPrint.forEach(e => {
        ledgerRowsHtml += `
          <tr>
            <td style="font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatDateArabic(e.date)}</td>
            <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.description}</td>
            <td style="color: #dc2626; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.amountOnHim > 0 ? formatCurrency(e.amountOnHim, currency) : '-'}</td>
            <td style="color: #16a34a; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.amountForHim > 0 ? formatCurrency(e.amountForHim, currency) : '-'}</td>
            <td style="font-size: 11px; color: #64748b; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.notes || '-'}</td>
          </tr>
        `;
      });

      suppliersDetailedLedgersHtml += `
        <div style="margin-top: 25px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #4c1d95; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: bold; font-size: 14px;">🚚 المورد: ${s.name}</span>
              <span style="font-size: 12px; color: #ddd6fe; margin-right: 8px;">(${s.materialType})</span>
            </div>
            <div style="font-size: 12px; font-weight: bold;">
              <span style="color: #f87171; margin-left: 8px;">دفعات مسددة له: ${formatCurrency(totalOnHim, currency)}</span> | 
              <span style="color: #4ade80; margin-left: 8px;">قيمة مواد: ${formatCurrency(totalForHim, currency)}</span> | 
              <span style="color: #c4b5fd;">الصافي: ${net >= 0 ? formatCurrency(net, currency) : `-${formatCurrency(Math.abs(net), currency)}`}</span>
            </div>
          </div>
          <table style="margin: 0; width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 15%;">التاريخ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35%;">البيان / الفاتورة</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">عليه (دفعات مسددة له)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">له (قيمة مواد)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${s.ledger.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 10px; border: 1px solid #cbd5e1;">لا توجد معاملات مسجلة لهذا المورد حالياً.</td></tr>' : ledgerRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    const grandNet = grandForHim - grandOnHim;

    const htmlContent = `
      <div class="header" style="text-align: center; margin-bottom: 20px;">
        <h1 class="title" style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">التقرير المالي العام الشامل والتفصيلي للموردين وتوريدات المواد</h1>
        <div class="meta" style="font-size: 12px; color: #64748b;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
      </div>

      <div class="info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div><strong>إجمالي عدد الموردين:</strong> ${suppliers.length} مورد</div>
        <div><strong>إجمالي قيمة توريدات المواد (له):</strong> <span style="color: #16a34a; font-weight: bold;">${formatCurrency(grandForHim, currency)}</span></div>
        <div><strong>إجمالي المبالغ المسددة (عليه):</strong> <span style="color: #dc2626; font-weight: bold;">${formatCurrency(grandOnHim, currency)}</span></div>
      </div>

      <!-- SECTION 1: OVERALL SUMMARY TABLE -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #6d28d9; padding-bottom: 6px; margin-bottom: 12px;">
          أولاً: جدول ملخص حسابات وأرصدة جميع الموردين
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #5b21b6; color: white;">
              <th style="padding: 8px; border: 1px solid #4c1d95;">اسم المورد</th>
              <th style="padding: 8px; border: 1px solid #4c1d95;">نوع المواد</th>
              <th style="padding: 8px; border: 1px solid #4c1d95;">إجمالي المسدد له (عليه)</th>
              <th style="padding: 8px; border: 1px solid #4c1d95;">إجمالي قيمة المواد (له)</th>
              <th style="padding: 8px; border: 1px solid #4c1d95;">صافي رصيد المورد</th>
            </tr>
          </thead>
          <tbody>
            ${suppliers.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">لا يوجد موردين مضافين حالياً.</td></tr>' : supplierSummaryRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f5f3ff; font-weight: bold;">
              <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">المجموع الكلي:</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #dc2626;">${formatCurrency(grandOnHim, currency)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #16a34a;">${formatCurrency(grandForHim, currency)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${grandNet >= 0 ? '#6d28d9' : '#b91c1c'};">
                ${grandNet >= 0 ? `له: ${formatCurrency(grandNet, currency)}` : `عليه: ${formatCurrency(Math.abs(grandNet), currency)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- SECTION 2: DETAILED LEDGER TABLES FOR ALL SUPPLIERS -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #6d28d9; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
          ثانياً: كشوفات تفصيلية بكافة الحركات والعمليات المالية لكل مورد
        </h3>
        ${suppliers.length === 0 ? '<p style="text-align: center; color: #94a3b8;">لا توجد بيانات تفصيلية.</p>' : suppliersDetailedLedgersHtml}
      </div>
    `;

    printPDF('التقرير المالي العام للموردين', htmlContent);
  };

  // Filter suppliers based on query
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.materialType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.phoneNumbers && s.phoneNumbers.some(p => p.includes(searchQuery)))
  );

  // Sorted suppliers list (Default: Oldest to Newest by earliest transaction date or name)
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    const earliestA = a.ledger.length > 0 ? [...a.ledger].sort((x, y) => x.date.localeCompare(y.date))[0].date : '';
    const earliestB = b.ledger.length > 0 ? [...b.ledger].sort((x, y) => x.date.localeCompare(y.date))[0].date : '';
    if (earliestA && earliestB) {
      const cmp = earliestA.localeCompare(earliestB);
      return supplierSortOrder === 'asc' ? cmp : -cmp;
    }
    const nameCmp = a.name.localeCompare(b.name, 'ar');
    return supplierSortOrder === 'asc' ? nameCmp : -nameCmp;
  });

  // Excel Column Filter State for Supplier Ledger
  const [supplierLedgerColumnFilters, setSupplierLedgerColumnFilters] = useState<Record<string, ActiveColumnFilter>>({});
  const [supplierLedgerColumnSort, setSupplierLedgerColumnSort] = useState<ColumnSortState | null>(null);

  const handleSupplierLedgerFilterChange = (key: string, filter: ActiveColumnFilter | null) => {
    setSupplierLedgerColumnFilters(prev => {
      const next = { ...prev };
      if (!filter) {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  };

  const handleSupplierLedgerSortChange = (sort: ColumnSortState | null) => {
    setSupplierLedgerColumnSort(sort);
  };

  const handleClearSupplierLedgerFilters = () => {
    setSupplierLedgerColumnFilters({});
    setSupplierLedgerColumnSort(null);
  };

  const supplierLedgerColumnConfigs: Record<string, ColumnFilterConfig<LedgerEntry>> = {
    date: {
      key: 'date',
      title: 'التاريخ',
      sortType: 'date',
      getValue: (e) => e.date,
      getDisplayValue: (val) => formatDateArabic(String(val))
    },
    description: {
      key: 'description',
      title: 'البيان',
      sortType: 'string',
      getValue: (e) => cleanLedgerDescription(e.description)
    },
    amountOnHim: {
      key: 'amountOnHim',
      title: 'مبلغ عليه (مسدد له)',
      sortType: 'number',
      getValue: (e) => e.amountOnHim,
      getDisplayValue: (val) => Number(val) > 0 ? formatCurrency(Number(val), currency || 'YER') : '-'
    },
    amountForHim: {
      key: 'amountForHim',
      title: 'مبلغ له (قيمة مواد)',
      sortType: 'number',
      getValue: (e) => e.amountForHim,
      getDisplayValue: (val) => Number(val) > 0 ? formatCurrency(Number(val), currency || 'YER') : '-'
    },
    notes: {
      key: 'notes',
      title: 'ملاحظات',
      sortType: 'string',
      getValue: (e) => e.notes || ''
    }
  };

  // Base filtered supplier ledger entries (matching top search, date, type filters)
  const baseFilteredLedger = useMemo(() => {
    if (!activeSupplier) return [];
    return activeSupplier.ledger.filter(entry => {
      if (ledgerSearchTerm.trim()) {
        const term = ledgerSearchTerm.trim().toLowerCase();
        const matchDesc = entry.description.toLowerCase().includes(term);
        const matchNotes = (entry.notes || '').toLowerCase().includes(term);
        if (!matchDesc && !matchNotes) return false;
      }
      if (ledgerStartDate && entry.date < ledgerStartDate) return false;
      if (ledgerEndDate && entry.date > ledgerEndDate) return false;
      if (ledgerTypeFilter === 'onHim' && !(entry.amountOnHim > 0)) return false;
      if (ledgerTypeFilter === 'forHim' && !(entry.amountForHim > 0)) return false;
      return true;
    });
  }, [activeSupplier, ledgerSearchTerm, ledgerStartDate, ledgerEndDate, ledgerTypeFilter]);

  // Filtered & Sorted active supplier ledger entries (cascading with column filters)
  const filteredLedger = useMemo(() => {
    return baseFilteredLedger.filter(entry => {
      // Apply column filters
      for (const [colKey, filter] of Object.entries(supplierLedgerColumnFilters) as [string, ActiveColumnFilter][]) {
        const config = supplierLedgerColumnConfigs[colKey];
        if (!config || !filter || !filter.selectedValues) continue;

        const allowedSet = new Set(filter.selectedValues);
        const raw = config.getValue(entry);

        if (Array.isArray(raw)) {
          if (raw.length === 0) {
            if (!allowedSet.has('(فارغ)')) return false;
          } else {
            const hasAny = raw.some(val => {
              const strVal = val !== null && val !== undefined && String(val).trim() !== '' ? String(val) : '(فارغ)';
              return allowedSet.has(strVal);
            });
            if (!hasAny) return false;
          }
        } else {
          const strVal = raw !== null && raw !== undefined && String(raw).trim() !== '' ? String(raw) : '(فارغ)';
          if (!allowedSet.has(strVal)) return false;
        }
      }

      return true;
    });
  }, [baseFilteredLedger, supplierLedgerColumnFilters, supplierLedgerColumnConfigs]);

  const sortedLedger = [...filteredLedger].sort((a, b) => {
    if (supplierLedgerColumnSort) {
      const config = supplierLedgerColumnConfigs[supplierLedgerColumnSort.key];
      if (config) {
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

        return supplierLedgerColumnSort.direction === 'asc' ? comp : -comp;
      }
    }

    if (ledgerSortOption === 'date-asc') {
      return a.date.localeCompare(b.date);
    } else if (ledgerSortOption === 'desc-alpha') {
      return a.description.localeCompare(b.description, 'ar');
    } else if (ledgerSortOption === 'amountOnHim-desc') {
      return b.amountOnHim - a.amountOnHim;
    } else if (ledgerSortOption === 'amountForHim-desc') {
      return b.amountForHim - a.amountForHim;
    }
    return b.date.localeCompare(a.date);
  });

  const hasActiveSupplierLedgerColumnFilters = Object.keys(supplierLedgerColumnFilters).length > 0 || supplierLedgerColumnSort !== null;

  const isLedgerFilterActive = Boolean(
    ledgerSearchTerm || ledgerStartDate || ledgerEndDate || ledgerTypeFilter !== 'all' || ledgerSortOption !== 'date-desc' || hasActiveSupplierLedgerColumnFilters
  );

  return (
    <div className="space-y-4 animate-fade-in" id="suppliers-section">
      
      {/* Detail vs List views */}
      {activeSupplier ? (
        
        /* -------------------------------- DETAIL ACCOUNT VIEW -------------------------------- */
        <div className="space-y-4 animate-fade-in" id="supplier-details-pane">
          
          {/* Detail Header / Nav back */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4 w-full">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{activeSupplier.name}</h2>
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold">{activeSupplier.materialType}</span>
                  <AttributionBadge createdBy={activeSupplier.createdBy} updatedBy={activeSupplier.updatedBy} />
                </div>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">كشف المعاملات وتفاصيل التوريد والتسديد المتبادل.</p>
                <PhoneNumbersDisplay phoneNumbers={activeSupplier.phoneNumbers} className="mt-2" />
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {setActiveTab && (
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 w-full justify-center"
                    title="الرجوع للرئيسية"
                  >
                    <ArrowLeft size={14} className="text-slate-700 shrink-0" />
                    <span>الرجوع للرئيسية</span>
                  </button>
                )}

                <button 
                  onClick={() => { setSelectedSupplierId(null); setLedgerError(''); }}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 w-full justify-center"
                  title="الرجوع لقائمة الموردين"
                >
                  <ArrowLeft size={14} className="text-slate-700 shrink-0" />
                  <span>الرجوع لقائمة الموردين</span>
                </button>

                <OptionsMenu 
                  onExportExcel={() => handleExportLedgerCSV(activeSupplier)}
                  onExportPDF={() => handlePrintSupplierPDF(activeSupplier)}
                  onImportExcel={sharedRole !== 'read' ? handleLedgerExcelImport : undefined}
                  shareTitle={`كشف حساب المورد: ${activeSupplier.name}`}
                  shareText={((s) => {
                    const totalOnHim = s.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = s.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    let netText = '';
                    if (net === 0) netText = 'خالص الطرفين';
                    else if (net > 0) netText = `له (قيمة توريدات مستحقة بذمتنا): ${formatCurrency(net, currency)}`;
                    else netText = `عليه (مسدد له زيادة): ${formatCurrency(Math.abs(net), currency)}`;

                    const lastEntries = s.ledger.slice(-10);
                    const entriesText = lastEntries.length > 0 
                      ? '\n📋 آخر العمليات المقيدة:\n' + lastEntries.map(e => {
                          const entryAmt = e.amountForHim > 0 
                            ? `له (مواد): ${formatCurrency(e.amountForHim, e.currency || currency)}` 
                            : `عليه (مسدد): ${formatCurrency(e.amountOnHim, e.currency || currency)}`;
                          return `- ${e.date} | ${e.description} ⟸ ${entryAmt}`;
                        }).join('\n')
                      : '\n(لا توجد حركات مالية مقيدة بعد)';

                    return `🚚 كشف حساب المورد: ${s.name}\n📦 نوع المواد: ${s.materialType}\n\n💰 الخلاصة المالية للمورد:\n- إجمالي قيمة التوريد (له): ${formatCurrency(totalForHim, currency)}\n- إجمالي المبالغ المسددة (عليه): ${formatCurrency(totalOnHim, currency)}\n- صافي الحساب الحالي: ${netText}\n${entriesText}\n\n*تم استخراجه من تطبيق المدير المالي*`;
                  })(activeSupplier)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Column 1: Metadata Summary & Transaction Entry Form */}
            <div className="space-y-6">
              
              {/* Balances Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-50">
                  <Info size={16} className="text-amber-500" />
                  حالة الحساب الجاري للمورد
                </h3>

                {/* Ledger balances summary grouped by currency */}
                <div className="space-y-3 pt-2 border-t border-slate-50">
                  {['YER', 'SAR', 'USD'].map(cur => {
                    const totalOnHim = activeSupplier.ledger.filter(e => (e.currency || 'YER') === cur).reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = activeSupplier.ledger.filter(e => (e.currency || 'YER') === cur).reduce((sum, e) => sum + e.amountForHim, 0);
                    const balance = totalForHim - totalOnHim;
                    
                    if (totalOnHim === 0 && totalForHim === 0) return null;
                    
                    return (
                      <div key={cur} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 font-mono">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                          <span>العملة:</span>
                          <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">{cur}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>عليه (مسدد له):</span>
                          <span className="font-semibold text-rose-600">{formatCurrency(totalOnHim, cur)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>له (توريد مواد):</span>
                          <span className="font-semibold text-emerald-600">{formatCurrency(totalForHim, cur)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold border-t border-slate-200/50 pt-1.5 mt-1">
                          <span>صافي الرصيد له:</span>
                          <span className={balance < 0 ? 'text-rose-600' : balance > 0 ? 'text-purple-600' : 'text-slate-400'}>
                            {balance === 0 ? 'خالص' : balance > 0 ? `له: ${formatCurrency(balance, cur)}` : `عليه: ${formatCurrency(Math.abs(balance), cur)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {activeSupplier.ledger.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2 animate-pulse">لا توجد حركات توريد مسجلة بعد</p>
                  )}
                </div>
              </div>

              {/* Entry Form */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setShowAddLedgerForm(!showAddLedgerForm)}
                  className="w-full font-bold text-slate-800 text-sm flex items-center justify-between hover:text-amber-600 transition-colors cursor-pointer text-right py-1"
                >
                  <div className="flex items-center gap-2">
                    <PlusCircle size={18} className="text-amber-500" />
                    <span>إضافة حركة مالية جديدة للكشف</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors">
                    <span>{showAddLedgerForm ? 'طي النموذج' : 'إظهار النموذج'}</span>
                    {showAddLedgerForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {showAddLedgerForm && (
                  <form onSubmit={handleAddLedgerSubmit} className="space-y-3.5 mt-4 pt-3.5 border-t border-slate-100 animate-fade-in">
                    
                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">التاريخ</label>
                      <input 
                        type="date"
                        value={ledgerDate}
                        onChange={(e) => setLedgerDate(e.target.value)}
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-amber-500"
                        required
                      />
                    </div>

                    {/* Amounts Row & Currency Dropdown */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 block text-rose-600 truncate">عليه (مسدد)</label>
                        <div className="flex gap-1 items-center">
                          <input 
                            type="number"
                            placeholder="0"
                            value={ledgerAmountOnHim}
                            onChange={(e) => setLedgerAmountOnHim(e.target.value)}
                            className="w-full h-[42px] px-3 bg-rose-50/20 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-rose-500 min-w-0"
                          />
                          <Calculator onApply={(val) => setLedgerAmountOnHim(String(val))} buttonTitle="حسابة مبلغ عليه" />
                        </div>
                        <AmountInWords amount={ledgerAmountOnHim} currency={ledgerCurrency} />
                      </div>
                      <div className="space-y-1 col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 block text-emerald-600 truncate">له (توريد مواد)</label>
                        <div className="flex gap-1 items-center">
                          <input 
                            type="number"
                            placeholder="0"
                            value={ledgerAmountForHim}
                            onChange={(e) => setLedgerAmountForHim(e.target.value)}
                            className="w-full h-[42px] px-3 bg-emerald-50/20 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-emerald-500 min-w-0"
                          />
                          <Calculator onApply={(val) => setLedgerAmountForHim(String(val))} buttonTitle="حسابة مبلغ له" />
                        </div>
                        <AmountInWords amount={ledgerAmountForHim} currency={ledgerCurrency} />
                      </div>
                      <div className="space-y-1 col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 block truncate">العملة</label>
                        <select
                          value={ledgerCurrency}
                          onChange={(e) => setLedgerCurrency(e.target.value)}
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-amber-500 cursor-pointer"
                        >
                          <option value="YER">YER</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>

                    {/* Statement */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">البيان (تفاصيل التوريد أو الدفعة)</label>
                      <input 
                        type="text"
                        placeholder="مثال: توريد 20 طن رمل / دفعة نقدية وصل 3"
                        value={ledgerDescription}
                        onChange={(e) => setLedgerDescription(e.target.value)}
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-amber-500"
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">ملاحظات</label>
                      <textarea 
                        placeholder="أي ملاحظات تفصيلية..."
                        value={ledgerNotes}
                        onChange={(e) => setLedgerNotes(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-amber-500 resize-none"
                      />
                    </div>

                    {ledgerError && (
                      <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg">{ledgerError}</p>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      حفظ في كشف حساب المورد
                    </button>

                  </form>
                )}
              </div>

            </div>

            {/* Column 2 & 3: Ledger log table */}
            <div className="lg:col-span-2 space-y-3">
              {/* Ledger Filters Card */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-xs transition-all" id="supplier-ledger-filters">
                <button
                  type="button"
                  onClick={() => setIsLedgerFiltersOpen(!isLedgerFiltersOpen)}
                  className="w-full flex items-center justify-between text-right font-bold text-slate-700 text-xs sm:text-sm hover:text-slate-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-purple-600" />
                    <span>أدوات البحث والتصفية (سجل الكشوفات والحركات التفصيلي)</span>
                    {isLedgerFilterActive && (
                      <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        فلتر نشط ({sortedLedger.length} حركات)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-normal">
                    <span className="text-slate-400 text-xs hidden sm:inline">{isLedgerFiltersOpen ? 'إخفاء' : 'عرض الخيارات'}</span>
                    {isLedgerFiltersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>
                
                {isLedgerFiltersOpen && (
                  <div className="pt-3 space-y-3 border-t border-slate-100 mt-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      
                      {/* Search text */}
                      <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
                        <input 
                          type="text"
                          value={ledgerSearchTerm}
                          onChange={(e) => setLedgerSearchTerm(e.target.value)}
                          placeholder="بحث في البيان، الملاحظات..."
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-purple-500 transition-colors"
                        />
                        <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                      </div>

                      {/* Start Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">من:</span>
                        <input 
                          type="date"
                          value={ledgerStartDate}
                          onChange={(e) => setLedgerStartDate(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-purple-500"
                        />
                      </div>

                      {/* End Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">إلى:</span>
                        <input 
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-purple-500"
                        />
                      </div>

                      {/* Sort Order Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">الترتيب:</span>
                        <select
                          value={ledgerSortOption}
                          onChange={(e) => setLedgerSortOption(e.target.value as any)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-purple-500 cursor-pointer"
                        >
                          <option value="date-desc">الأحدث أولاً ⬇️ (افتراضي)</option>
                          <option value="date-asc">الأقدم أولاً ⬆️</option>
                          <option value="desc-alpha">أبجدياً حسب البيان (أ - ي) 🔤</option>
                          <option value="amountOnHim-desc">حسب مبلغ عليه (الأعلى أولاً) 🔴</option>
                          <option value="amountForHim-desc">حسب مبلغ له (الأعلى أولاً) 🟢</option>
                        </select>
                      </div>

                      {/* Transaction Type Filter */}
                      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                        <span className="text-xs text-slate-500 shrink-0">نوع الحركة:</span>
                        <select
                          value={ledgerTypeFilter}
                          onChange={(e) => setLedgerTypeFilter(e.target.value as 'all' | 'onHim' | 'forHim')}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-purple-500 cursor-pointer"
                        >
                          <option value="all">كافة الحركات المالية (له وعليه)</option>
                          <option value="onHim">مبالغ عليه فقط (سلف / مسحوبات)</option>
                          <option value="forHim">مبالغ له فقط (توريد مواد / مستحقات)</option>
                        </select>
                      </div>

                    </div>

                    {/* Clear filters shortcut */}
                    {isLedgerFilterActive && (
                      <div className="flex justify-end pt-1">
                        <button 
                          type="button"
                          onClick={() => {
                            setLedgerSearchTerm('');
                            setLedgerStartDate('');
                            setLedgerEndDate('');
                            setLedgerTypeFilter('all');
                            setLedgerSortOption('date-desc');
                          }}
                          className="text-[11px] text-purple-600 hover:text-purple-800 hover:underline font-bold cursor-pointer"
                        >
                          إلغاء التصفية وإعادة الضبط 🔄
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm">سجل حساب ومعاملات المورد الجاري</h3>
                    {hasActiveSupplierLedgerColumnFilters && (
                      <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-lg text-xs font-bold">
                        <Filter size={12} className="fill-current text-purple-600" />
                        <span>تصفية مخصصة للأعمدة</span>
                        <button
                          type="button"
                          onClick={handleClearSupplierLedgerFilters}
                          className="text-[10px] text-purple-600 hover:text-purple-800 hover:underline mr-1 cursor-pointer font-bold"
                        >
                          إلغاء فلاتر الأعمدة ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-500">عدد الحركات: {sortedLedger.length}</span>
                </div>

                <div className="overflow-x-auto">
                  {sortedLedger.length === 0 ? (
                    <div className="text-center py-12 px-4 space-y-2">
                      <p className="text-slate-400 text-sm font-medium">كشف حساب المورد خالٍ حالياً</p>
                      <p className="text-xs text-slate-300">أدخل حركة توريد أو مبالغ مسددة أو قم بترحيل نفقة لهذا المورد من شاشة النفقات.</p>
                    </div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>التاريخ</span>
                              <ExcelColumnFilter
                                config={supplierLedgerColumnConfigs.date}
                                data={baseFilteredLedger}
                                allColumnFilters={supplierLedgerColumnFilters}
                                allConfigs={supplierLedgerColumnConfigs}
                                activeFilter={supplierLedgerColumnFilters.date}
                                onFilterChange={handleSupplierLedgerFilterChange}
                                activeSort={supplierLedgerColumnSort}
                                onSortChange={handleSupplierLedgerSortChange}
                                accentColor="purple"
                              />
                            </div>
                          </th>
                          <th className="p-3">
                            <div className="flex items-center justify-between gap-1">
                              <span>البيان</span>
                              <ExcelColumnFilter
                                config={supplierLedgerColumnConfigs.description}
                                data={baseFilteredLedger}
                                allColumnFilters={supplierLedgerColumnFilters}
                                allConfigs={supplierLedgerColumnConfigs}
                                activeFilter={supplierLedgerColumnFilters.description}
                                onFilterChange={handleSupplierLedgerFilterChange}
                                activeSort={supplierLedgerColumnSort}
                                onSortChange={handleSupplierLedgerSortChange}
                                accentColor="purple"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-rose-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>مبلغ عليه (مسدد له)</span>
                              <ExcelColumnFilter
                                config={supplierLedgerColumnConfigs.amountOnHim}
                                data={baseFilteredLedger}
                                allColumnFilters={supplierLedgerColumnFilters}
                                allConfigs={supplierLedgerColumnConfigs}
                                activeFilter={supplierLedgerColumnFilters.amountOnHim}
                                onFilterChange={handleSupplierLedgerFilterChange}
                                activeSort={supplierLedgerColumnSort}
                                onSortChange={handleSupplierLedgerSortChange}
                                accentColor="rose"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-emerald-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>مبلغ له (قيمة مواد)</span>
                              <ExcelColumnFilter
                                config={supplierLedgerColumnConfigs.amountForHim}
                                data={baseFilteredLedger}
                                allColumnFilters={supplierLedgerColumnFilters}
                                allConfigs={supplierLedgerColumnConfigs}
                                activeFilter={supplierLedgerColumnFilters.amountForHim}
                                onFilterChange={handleSupplierLedgerFilterChange}
                                activeSort={supplierLedgerColumnSort}
                                onSortChange={handleSupplierLedgerSortChange}
                                accentColor="emerald"
                              />
                            </div>
                          </th>
                          <th className="p-3">
                            <div className="flex items-center justify-between gap-1">
                              <span>ملاحظات</span>
                              <ExcelColumnFilter
                                config={supplierLedgerColumnConfigs.notes}
                                data={baseFilteredLedger}
                                allColumnFilters={supplierLedgerColumnFilters}
                                allConfigs={supplierLedgerColumnConfigs}
                                activeFilter={supplierLedgerColumnFilters.notes}
                                onFilterChange={handleSupplierLedgerFilterChange}
                                activeSort={supplierLedgerColumnSort}
                                onSortChange={handleSupplierLedgerSortChange}
                                accentColor="purple"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-center whitespace-nowrap">العمليات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedLedger.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 whitespace-nowrap text-slate-500">{formatDateArabic(e.date)}</td>
                            <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{cleanLedgerDescription(e.description)}</span>
                              {e.isPosted && (
                                <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-bold px-1.5 py-0.5 rounded-sm">
                                  مرحلة تلقائياً من النفقات اليومية
                                </span>
                              )}
                              <AttributionBadge createdBy={e.createdBy} />
                            </td>
                            <td className="p-3 font-bold text-rose-600">
                              {e.amountOnHim > 0 ? formatCurrency(e.amountOnHim, e.currency || 'YER') : '-'}
                            </td>
                            <td className="p-3 font-bold text-emerald-600">
                              {e.amountForHim > 0 ? formatCurrency(e.amountForHim, e.currency || 'YER') : '-'}
                            </td>
                            <td className="p-3 text-slate-400 max-w-xs truncate" title={e.notes}>
                              {e.notes || '-'}
                            </td>
                            <td className="p-3 text-center flex items-center justify-center gap-1.5">
                              {sharedRole !== 'read' && (
                                <button 
                                  onClick={() => {
                                    setEditingSupplierLedger({ supplierId: activeSupplier.id, entry: e });
                                  }}
                                  className="p-1 hover:bg-slate-50 text-slate-300 hover:text-sky-600 rounded-sm cursor-pointer"
                                  title="تعديل القيد"
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                              {sharedRole !== 'read' && sharedRole !== 'add' && (
                                <button 
                                  onClick={() => {
                                    if (confirm('هل أنت متأكد من حذف هذه العملية؟ (سيتم تحديث النفقات اليومية تلقائياً إذا كانت مرحلة)')) {
                                      onDeleteSupplierLedgerEntry(activeSupplier.id, e.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-sm cursor-pointer"
                                  title="حذف الحركة"
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

        </div>

      ) : (
        
        /* -------------------------------- OVERALL DIRECTORY VIEW -------------------------------- */
        <div className="space-y-6 animate-fade-in" id="suppliers-list-pane">
          
          {/* Header */}
          <PageHeaderCard
            title="كشف حسابات الموردين ومواد البناء"
            description="إدارة الموردين وشركات التوريد، تتبع فواتير المواد، الدفعات النقدية والأرصدة المستحقة."
            icon={<Truck size={20} />}
            onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
            optionsMenu={
              <OptionsMenu 
                onExportExcel={handleExportAllCSV}
                onExportPDF={handlePrintAllSuppliersPDF}
                onImportExcel={sharedRole !== 'read' ? handleSupplierExcelImport : undefined}
                shareTitle="التقرير المالي العام لموردي الموقع"
                shareText={(() => {
                  const suppliersSummary = suppliers.map(s => {
                    const totalOnHim = s.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = s.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    const status = net === 0 ? 'خالص' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`;
                    return `- ${s.name} (${s.materialType}): ${status}`;
                  }).join('\n');

                  return `🚚 التقرير المالي العام لموردي الموقع وتوريد المواد\n📅 تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}\n\n📊 ملخص مستحقات الموردين:\n${suppliers.length === 0 ? 'لا يوجد موردين مسجلين حالياً.' : suppliersSummary}\n\n*تم توليده ومشاركته من كشوفات المقاولات*`;
                })()}
              />
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Column 1: Add Supplier Form */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs h-fit">
              {sharedRole === 'read' ? (
                <div className="text-center py-8 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Truck size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">وضع عرض الحساب المشترك</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تمت دعوتك بصلاحية (عرض فقط). لا يمكنك إضافة موردين جدد أو تسجيل حركات مالية في هذا الكشف.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplierForm(!showAddSupplierForm)}
                    className="w-full font-bold text-slate-800 flex items-center justify-between text-base cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus size={18} className="text-amber-500" />
                      <span>إضافة مورد مواد جديد</span>
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all ${
                      showAddSupplierForm 
                        ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}>
                      {showAddSupplierForm ? 'إخفاء البيانات ▲' : '+ إضافة ▼'}
                    </span>
                  </button>

                  {showAddSupplierForm && (
                    <div className="pt-4 mt-3 border-t border-slate-100 animate-slide-up">
                      <form onSubmit={handleAddSupplierSubmit} className="space-y-4">
                        
                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">اسم المورد / الشركة</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={newSupplierName}
                              onChange={(e) => setNewSupplierName(e.target.value)}
                              placeholder="مثال: شركة الرافدين للمواد الإنشائية"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500 transition-colors pr-9"
                              required
                            />
                            <Truck size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Material Type */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">نوع المواد الموردة</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={newMaterialType}
                              onChange={(e) => setNewMaterialType(e.target.value)}
                              placeholder="مثال: إسمنت، حديد، رمل، طابوق..."
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500 transition-colors pr-9"
                              required
                            />
                            <Package size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <PhoneNumbersInput 
                          phoneNumbers={newSupplierPhoneNumbers} 
                          onChange={setNewSupplierPhoneNumbers} 
                        />

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                          <textarea 
                            value={newSupplierNotes}
                            onChange={(e) => setNewSupplierNotes(e.target.value)}
                            placeholder="أي ملاحظات تفصيلية حول المورد أو شروط التوريد..."
                            rows={2}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-amber-500 transition-colors resize-none"
                          />
                        </div>

                        {supplierError && (
                          <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">{supplierError}</p>
                        )}

                        <button 
                          type="submit"
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PlusCircle size={18} />
                          تسجيل المورد
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Columns 2 & 3: Suppliers cards list */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Search Card & Sort Filter */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن مورد بالاسم أو بنوع المادة..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                  <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                </div>

                {/* Suppliers Sort Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shrink-0 w-full sm:w-auto">
                  <span className="text-slate-400 font-medium">الترتيب:</span>
                  <select
                    value={supplierSortOrder}
                    onChange={(e) => setSupplierSortOrder(e.target.value as 'asc' | 'desc')}
                    className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="desc">تاريخ المعاملات: الأحدث أولاً ⬇️ (افتراضي)</option>
                    <option value="asc">تاريخ المعاملات: الأقدم أولاً ⬆️</option>
                  </select>
                </div>
              </div>

              {/* Suppliers cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedSuppliers.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-xs md:col-span-2">
                    <p className="text-slate-400 text-sm font-medium">لا يوجد موردون يطابقون البحث</p>
                    <p className="text-xs text-slate-300 mt-1">سجل موردين جدداً للبدء في تتبع التوريد</p>
                  </div>
                ) : (
                  sortedSuppliers.map(s => {
                    const totalOnHim = s.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = s.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    
                    return (
                      <div 
                        key={s.id} 
                        className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 hover:border-amber-200 transition-all flex flex-col justify-between group relative"
                        id={`supplier-card-${s.id}`}
                      >
                        {/* Header info */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-800 text-base">{s.name}</h4>
                                <AttributionBadge createdBy={s.createdBy} updatedBy={s.updatedBy} />
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{s.materialType}</p>
                            </div>
                            <span className="text-[10px] bg-slate-50 text-amber-700 border border-amber-100 font-bold px-2 py-0.5 rounded-full">
                              مورد مواد
                            </span>
                          </div>

                          <PhoneNumbersDisplay phoneNumbers={s.phoneNumbers} className="pt-1" />

                          {s.notes && (
                            <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded-lg text-right font-medium">
                              <span className="font-bold text-slate-400 text-[10px] block mb-0.5">ملاحظات:</span>
                              {s.notes}
                            </div>
                          )}
                        </div>

                        {/* Balances per currency */}
                        {(() => {
                          const supplierBalances = s.ledger.reduce((acc, entry) => {
                            const cur = entry.currency || 'YER';
                            if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
                            acc[cur].onHim += entry.amountOnHim || 0;
                            acc[cur].forHim += entry.amountForHim || 0;
                            return acc;
                          }, {} as Record<string, { onHim: number; forHim: number }>);

                          return (
                            <div className="mt-4 pt-4 border-t border-slate-50 space-y-1.5 text-xs text-right">
                              <span className="text-slate-400 block text-[10px] font-bold">حسابات المورد بالعملة:</span>
                              {Object.keys(supplierBalances).length === 0 ? (
                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                                  <span>YER</span>
                                  <span className="font-bold text-slate-400">خالص الطرفين</span>
                                </div>
                              ) : (
                                Object.entries(supplierBalances).map(([cur, b]) => {
                                  const netVal = b.forHim - b.onHim;
                                  return (
                                    <div key={cur} className="flex justify-between items-center border-b border-dashed border-slate-100 last:border-0 pb-1 last:pb-0 font-mono text-[11px]">
                                      <span className="text-slate-500 font-bold">{cur}</span>
                                      <span className={netVal < 0 ? 'text-rose-600 font-extrabold' : netVal > 0 ? 'text-purple-600 font-extrabold' : 'text-slate-400'}>
                                        {netVal === 0 ? 'خالص' : netVal > 0 ? `له: ${formatCurrency(netVal, cur)}` : `عليه: ${formatCurrency(Math.abs(netVal), cur)}`}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })()}

                        {/* Footer details & button */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                          <span className="text-xs font-bold text-slate-400">الكشف الخاص:</span>

                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setSelectedSupplierId(s.id)}
                              className="bg-slate-50 hover:bg-amber-50 text-amber-700 font-bold text-xs py-1.5 px-3 rounded-lg border border-slate-200 group-hover:border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              الكشف الجاري
                              <ChevronLeft size={14} className="rotate-180" />
                            </button>
                            {sharedRole !== 'read' && (
                              <button 
                                onClick={() => setEditingSupplier(s)}
                                className="p-1.5 hover:bg-slate-50 text-slate-300 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                                title="تعديل المورد"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {sharedRole !== 'read' && sharedRole !== 'add' && (
                              <button 
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف المورد ${s.name}؟ سيتم حذف كافة سجلات الكشف الجاري الخاص به تلقائياً.`)) {
                                    onDeleteSupplier(s.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="حذف المورد"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل بيانات المورد</h3>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSupplierSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">اسم المورد</label>
                  <input 
                    type="text" 
                    value={editingSupplier.name}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">نوع المواد الموردة</label>
                  <input 
                    type="text" 
                    value={editingSupplier.materialType}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, materialType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                  <textarea 
                    value={editingSupplier.notes || ''}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                    rows={2}
                    placeholder="أي ملاحظات..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-amber-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingSupplier(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Ledger Modal */}
      {editingSupplierLedger && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل قيد كشف حساب المورد</h3>
              <button
                type="button"
                onClick={() => setEditingSupplierLedger(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSupplierLedgerSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <input 
                    type="date" 
                    value={editingSupplierLedger.entry.date}
                    onChange={(e) => setEditingSupplierLedger({
                      ...editingSupplierLedger,
                      entry: { ...editingSupplierLedger.entry, date: e.target.value }
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">مبلغ عليه (مسدد له)</label>
                    <input 
                      type="number" 
                      value={editingSupplierLedger.entry.amountOnHim || ''}
                      onChange={(e) => setEditingSupplierLedger({
                        ...editingSupplierLedger,
                        entry: { ...editingSupplierLedger.entry, amountOnHim: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500 font-mono text-left"
                      placeholder="0"
                    />
                    <AmountInWords amount={editingSupplierLedger.entry.amountOnHim} currency={editingSupplierLedger.entry.currency || 'YER'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">مبلغ له (قيمة المواد)</label>
                    <input 
                      type="number" 
                      value={editingSupplierLedger.entry.amountForHim || ''}
                      onChange={(e) => setEditingSupplierLedger({
                        ...editingSupplierLedger,
                        entry: { ...editingSupplierLedger.entry, amountForHim: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500 font-mono text-left"
                      placeholder="0"
                    />
                    <AmountInWords amount={editingSupplierLedger.entry.amountForHim} currency={editingSupplierLedger.entry.currency || 'YER'} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">العملة</label>
                  <select 
                    value={editingSupplierLedger.entry.currency || 'YER'}
                    onChange={(e) => setEditingSupplierLedger({
                      ...editingSupplierLedger,
                      entry: { ...editingSupplierLedger.entry, currency: e.target.value }
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500"
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">البيان (نوع الحركة)</label>
                  <input 
                    type="text" 
                    value={editingSupplierLedger.entry.description}
                    onChange={(e) => setEditingSupplierLedger({
                      ...editingSupplierLedger,
                      entry: { ...editingSupplierLedger.entry, description: e.target.value }
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <textarea 
                    value={editingSupplierLedger.entry.notes || ''}
                    onChange={(e) => setEditingSupplierLedger({
                      ...editingSupplierLedger,
                      entry: { ...editingSupplierLedger.entry, notes: e.target.value }
                    })}
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-amber-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingSupplierLedger(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
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
