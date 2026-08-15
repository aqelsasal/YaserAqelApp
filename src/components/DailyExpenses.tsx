/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { 
  PlusCircle, 
  Trash2, 
  Search, 
  Calendar, 
  ArrowLeftRight, 
  Tag, 
  Filter,
  DollarSign,
  AlertCircle,
  ArrowLeft,
  Pencil,
  FileSpreadsheet,
  FileText,
  Check,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AmountInWords } from './AmountInWords';
import { 
  Expense, 
  Worker, 
  Supplier, 
  Employee,
  formatCurrency, 
  formatDateArabic,
  exportToCSV,
  printPDF
} from '../types';
import AttributionBadge from './AttributionBadge';
import Calculator from './Calculator';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';
import { PostingAccountSelect } from './PostingAccountSelect';
import ExcelColumnFilter, { ColumnFilterConfig, ActiveColumnFilter, ColumnSortState } from './ExcelColumnFilter';
import { useBodyScrollLock } from '../utils/modalScrollLock';
import * as XLSX from 'xlsx';

interface DailyExpensesProps {
  expenses: Expense[];
  workers: Worker[];
  suppliers: Supplier[];
  employees?: Employee[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense?: (id: string, updatedData: Omit<Expense, 'id' | 'createdBy'>) => void;
  setActiveTab?: (tab: string) => void;
  currency?: string;
  sharedRole?: string;
}

export default function DailyExpenses({
  expenses,
  workers,
  suppliers,
  employees = [],
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  setActiveTab,
  currency = 'YER',
  sharedRole = 'admin'
}: DailyExpensesProps) {
  // Get current date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Category Options
  const EXPENSE_CATEGORIES = [
    'مواد استهلاكية',
    'مواد غذائية',
    'مواد بناء وكهرباء',
    'اصول مضافة'
  ];

  // Ref for description input field to focus when pressing Next/Enter on amount
  const descriptionInputRef = React.useRef<HTMLInputElement>(null);

  // Form states
  const [date, setDate] = useState(getTodayString());
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseType, setExpenseType] = useState<'direct' | 'indirect'>('direct');
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [postTo, setPostTo] = useState(''); // Format: "type:id" (e.g., "worker:123" or "supplier:456")
  const [itemCurrency, setItemCurrency] = useState(currency);

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingPostTo, setEditingPostTo] = useState('');

  // Lock background scroll when modal is open
  useBodyScrollLock(Boolean(editingExpense));

  const toggleEditingCategory = (cat: string) => {
    if (!editingExpense) return;
    const current = editingExpense.categories || [];
    const updated = current.includes(cat)
      ? current.filter(c => c !== cat)
      : [...current, cat];
    setEditingExpense({ ...editingExpense, categories: updated });
  };

  // Submit hander for edit expense
  const handleEditExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    let recipientType: 'worker' | 'employee' | 'supplier' | 'none' = 'none';
    let recipientId = '';
    let recipientName = '';

    if (editingPostTo) {
      const [type, id] = editingPostTo.split(':');
      if (type === 'worker') {
        const worker = workers.find(w => w.id === id);
        if (worker) {
          recipientType = 'worker';
          recipientId = id;
          recipientName = worker.name;
        }
      } else if (type === 'employee') {
        const emp = employees.find(e => e.id === id);
        if (emp) {
          recipientType = 'employee';
          recipientId = id;
          recipientName = emp.name;
        }
      } else if (type === 'supplier') {
        const supplier = suppliers.find(s => s.id === id);
        if (supplier) {
          recipientType = 'supplier';
          recipientId = id;
          recipientName = supplier.name;
        }
      }
    }

    if (onUpdateExpense) {
      onUpdateExpense(editingExpense.id, {
        date: editingExpense.date,
        amount: editingExpense.amount,
        description: editingExpense.description,
        expenseType: editingExpense.expenseType || 'direct',
        categories: editingExpense.categories || [],
        notes: editingExpense.notes,
        recipientType,
        recipientId,
        recipientName,
        currency: editingExpense.currency || 'YER'
      });
    }
    setEditingExpense(null);
  };

  // Filter states
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<'all' | 'direct' | 'indirect'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  type ExpenseSortOption = 'date-desc' | 'date-asc' | 'desc-alpha' | 'recipient-alpha' | 'amount-desc';
  const [sortOrder, setSortOrder] = useState<ExpenseSortOption>('date-desc'); // Default desc: newest to oldest date

  // Notification state
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Reset date and itemCurrency on mount or when currency prop changes
  useEffect(() => {
    setDate(getTodayString());
  }, []);

  useEffect(() => {
    setItemCurrency(currency);
  }, [currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('الرجاء إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('الرجاء إدخال البيان.');
      return;
    }

    let recipientId = '';
    let recipientType: 'worker' | 'employee' | 'supplier' | 'none' = 'none';
    let recipientName = '';

    if (postTo && postTo !== 'none') {
      const [type, id] = postTo.split(':');
      recipientId = id;
      if (type === 'worker') {
        recipientType = 'worker';
        const w = workers.find(item => item.id === id);
        recipientName = w ? w.name : '';
      } else if (type === 'employee') {
        recipientType = 'employee';
        const emp = employees.find(item => item.id === id);
        recipientName = emp ? emp.name : '';
      } else if (type === 'supplier') {
        recipientType = 'supplier';
        const s = suppliers.find(item => item.id === id);
        recipientName = s ? s.name : '';
      }
    }

    onAddExpense({
      date,
      amount: parsedAmount,
      description: description.trim(),
      expenseType,
      categories,
      notes: notes.trim(),
      recipientId,
      recipientType,
      recipientName,
      currency: itemCurrency
    });

    // Reset Form
    setAmount('');
    setDescription('');
    setExpenseType('direct');
    setCategories([]);
    setNotes('');
    setPostTo('');
    setSuccessMsg('تم تسجيل النفقة وترحيلها بنجاح!');
    
    // Auto clear success message
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Excel Column Filter State
  const [columnFilters, setColumnFilters] = useState<Record<string, ActiveColumnFilter>>({});
  const [activeColumnSort, setActiveColumnSort] = useState<ColumnSortState | null>(null);

  const handleColumnFilterChange = (key: string, filter: ActiveColumnFilter | null) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (!filter) {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  };

  const handleColumnSortChange = (sort: ColumnSortState | null) => {
    setActiveColumnSort(sort);
  };

  const handleClearAllColumnFilters = () => {
    setColumnFilters({});
    setActiveColumnSort(null);
  };

  // Column Configurations for Excel Filtering
  const columnConfigs: Record<string, ColumnFilterConfig<Expense>> = {
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
      getValue: (e) => e.description
    },
    expenseType: {
      key: 'expenseType',
      title: 'نوع النفقة',
      sortType: 'string',
      getValue: (e) => (e.expenseType === 'indirect' ? 'غير مباشر' : 'مباشر'),
      getDisplayValue: (val) => (val === 'indirect' || val === 'غير مباشر' ? 'نفقات غير مباشرة' : 'نفقات مباشرة')
    },
    categories: {
      key: 'categories',
      title: 'الفئة',
      sortType: 'string',
      getValue: (e) => (e.categories && e.categories.length > 0 ? e.categories : (e.category ? [e.category] : []))
    },
    recipient: {
      key: 'recipient',
      title: 'الترحيل',
      sortType: 'string',
      getValue: (e) => {
        if (e.recipientType === 'worker') return `عامل: ${e.recipientName || ''}`;
        if (e.recipientType === 'employee') return `موظف: ${e.recipientName || ''}`;
        if (e.recipientType === 'supplier') return `مورد: ${e.recipientName || ''}`;
        return 'مصروف عام (غير مرحل)';
      }
    },
    amount: {
      key: 'amount',
      title: 'المبلغ',
      sortType: 'number',
      getValue: (e) => e.amount,
      getDisplayValue: (val) => formatCurrency(Number(val), currency)
    },
    notes: {
      key: 'notes',
      title: 'ملاحظات',
      sortType: 'string',
      getValue: (e) => e.notes || ''
    }
  };

  // Base filtered expenses matching top search & filter tools
  const baseFilteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = 
        !searchTerm ||
        exp.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        exp.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.categories && exp.categories.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (exp.category && exp.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStartDate = !startDateFilter || exp.date >= startDateFilter;
      const matchesEndDate = !endDateFilter || exp.date <= endDateFilter;
      const matchesExpenseType = expenseTypeFilter === 'all' || (exp.expenseType || 'direct') === expenseTypeFilter;
      const matchesCategory = categoryFilter === 'all' || 
        (exp.categories && exp.categories.includes(categoryFilter)) ||
        exp.category === categoryFilter;

      return matchesSearch && matchesStartDate && matchesEndDate && matchesExpenseType && matchesCategory;
    });
  }, [expenses, searchTerm, startDateFilter, endDateFilter, expenseTypeFilter, categoryFilter]);

  // Filtered Expenses logic (cascading with column filters)
  const filteredExpenses = useMemo(() => {
    return baseFilteredExpenses.filter(exp => {
      // Apply Excel column filters
      for (const [colKey, filter] of Object.entries(columnFilters) as [string, ActiveColumnFilter][]) {
        const config = columnConfigs[colKey];
        if (!config || !filter || !filter.selectedValues) continue;

        const allowedSet = new Set(filter.selectedValues);
        const raw = config.getValue(exp);

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
  }, [baseFilteredExpenses, columnFilters, columnConfigs]);

  // Sorted Expenses logic (Active Column Sort overrides general sortOrder)
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (activeColumnSort) {
      const config = columnConfigs[activeColumnSort.key];
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

        return activeColumnSort.direction === 'asc' ? comp : -comp;
      }
    }

    if (sortOrder === 'date-asc') {
      return a.date.localeCompare(b.date);
    }
    if (sortOrder === 'desc-alpha') {
      return (a.description || '').localeCompare(b.description || '', 'ar');
    }
    if (sortOrder === 'recipient-alpha') {
      const getRecipientLabel = (item: typeof a) => {
        if (item.recipientType === 'worker') return `عامل: ${item.recipientName || ''}`;
        if (item.recipientType === 'employee') return `موظف: ${item.recipientName || ''}`;
        if (item.recipientType === 'supplier') return `مورد: ${item.recipientName || ''}`;
        return 'مصروف عام';
      };
      return getRecipientLabel(a).localeCompare(getRecipientLabel(b), 'ar');
    }
    if (sortOrder === 'amount-desc') {
      return b.amount - a.amount;
    }
    // Default: date-desc (من الأحدث للأقدم)
    return b.date.localeCompare(a.date);
  });

  const hasActiveColumnFilters = Object.keys(columnFilters).length > 0 || activeColumnSort !== null;

  // Calculate sum of filtered grouped by currency
  const totalsByCurrency = filteredExpenses.reduce((acc, curr) => {
    const code = curr.currency || 'YER';
    acc[code] = (acc[code] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  // Excel File upload/import handler
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const desc = row['البيان'] || row['البيان اليومي'] || row['الوصف'] || row['Description'] || row['description'] || row['statement'];
          const amt = parseFloat(row['المبلغ'] || row['القيمة'] || row['Amount'] || row['amount']);
          const cur = row['العملة'] || row['currency'] || row['Currency'] || currency || 'YER';
          const noteVal = row['الملاحظات'] || row['ملاحظات'] || row['Notes'] || row['notes'] || '';
          const recipientVal = row['الترحيل'] || row['الاسم المرحل إليه'] || row['اسم الطرف الآخر'] || row['اسم العامل'] || row['اسم المورد'] || row['Recipient'] || row['recipient'];

          const categoryVal = row['الفئة'] || row['فئة'] || row['Category'] || row['category'];
          let importedCategories: string[] = [];
          if (categoryVal) {
            importedCategories = String(categoryVal).split(/[,;/\n]+/).map(s => s.trim()).filter(Boolean);
          }

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

            const parsedDate = parseDate(dateVal);

            let recipientType: 'worker' | 'supplier' | 'none' = 'none';
            let recipientId = '';
            let recipientName = '';
            let extraNotes = String(noteVal).trim();

            if (recipientVal) {
              const cleanRecName = String(recipientVal).trim().toLowerCase();
              const matchedWorker = workers.find(w => w.name.trim().toLowerCase() === cleanRecName);
              if (matchedWorker) {
                recipientType = 'worker';
                recipientId = matchedWorker.id;
                recipientName = matchedWorker.name;
              } else {
                const matchedSupplier = suppliers.find(s => s.name.trim().toLowerCase() === cleanRecName);
                if (matchedSupplier) {
                  recipientType = 'supplier';
                  recipientId = matchedSupplier.id;
                  recipientName = matchedSupplier.name;
                } else {
                  const importedNameStr = `[مستلم مستورد: ${recipientVal}]`;
                  extraNotes = extraNotes ? `${extraNotes} | ${importedNameStr}` : importedNameStr;
                }
              }
            }

            onAddExpense({
              date: parsedDate,
              amount: amt,
              description: String(desc).trim(),
              categories: importedCategories,
              notes: extraNotes,
              recipientId,
              recipientType,
              recipientName,
              currency: String(cur).trim()
            });
            count++;
          }
        });

        alert(`تم استيراد ${count} عملية صرف بنجاح من ملف Excel!`);
      } catch (err) {
        console.error("Error reading Excel expenses:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel للنفقات. يرجى التأكد من أن الأعمدة مطابقة (التاريخ، البيان، المبلغ، العملة، ملاحظات، الترحيل).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    const headers = [
      'التاريخ',
      'البيان',
      'نوع النفقة',
      'الفئة',
      'الترحيل',
      'نوع الترحيل',
      'المبلغ',
      'العملة',
      'الملاحظات'
    ];

    const rows = sortedExpenses.map(exp => {
      let recipientTypeStr = 'مصروف عام';
      if (exp.recipientType === 'worker') {
        recipientTypeStr = 'عامل';
      } else if (exp.recipientType === 'supplier') {
        recipientTypeStr = 'مورد';
      } else if (exp.recipientType === 'employee') {
        recipientTypeStr = 'موظف';
      }

      const typeStr = (exp.expenseType || 'direct') === 'indirect' ? 'نفقات غير مباشرة' : 'نفقات مباشرة';
      const categoryStr = exp.categories?.length ? exp.categories.join(' - ') : (exp.category || '-');

      return [
        exp.date,
        exp.description,
        typeStr,
        categoryStr,
        exp.recipientName || '-',
        recipientTypeStr,
        exp.amount.toString(),
        exp.currency || 'YER',
        exp.notes || '-'
      ];
    });

    exportToCSV('سجل_النفقات_اليومية_المصفى', headers, rows);
  };

  const handlePrintAllExpensesPDF = () => {
    // Group expenses by date
    const dailyMap: Record<string, {
      date: string;
      directAmount: Record<string, number>;
      indirectAmount: Record<string, number>;
      totalAmount: Record<string, number>;
      count: number;
      items: Expense[];
    }> = {};

    sortedExpenses.forEach(exp => {
      const d = exp.date;
      const cur = exp.currency || currency || 'YER';
      const isIndirect = (exp.expenseType || 'direct') === 'indirect';

      if (!dailyMap[d]) {
        dailyMap[d] = {
          date: d,
          directAmount: {},
          indirectAmount: {},
          totalAmount: {},
          count: 0,
          items: []
        };
      }

      const entry = dailyMap[d];
      entry.items.push(exp);
      entry.count += 1;

      if (isIndirect) {
        entry.indirectAmount[cur] = (entry.indirectAmount[cur] || 0) + exp.amount;
      } else {
        entry.directAmount[cur] = (entry.directAmount[cur] || 0) + exp.amount;
      }
      entry.totalAmount[cur] = (entry.totalAmount[cur] || 0) + exp.amount;
    });

    const sortedDays = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    // Summary table rows (First section: Summary by Day)
    let dailySummaryRowsHtml = '';
    sortedDays.forEach(day => {
      const totalCurrencies = Object.keys(day.totalAmount);
      totalCurrencies.forEach(cur => {
        const directVal = day.directAmount[cur] || 0;
        const indirectVal = day.indirectAmount[cur] || 0;
        const totalVal = day.totalAmount[cur] || 0;

        dailySummaryRowsHtml += `
          <tr>
            <td style="font-weight: bold;">${formatDateArabic(day.date)}</td>
            <td style="text-align: center; font-weight: bold;">${day.count} عملية</td>
            <td style="color: #059669; font-weight: bold;">${formatCurrency(directVal, cur)}</td>
            <td style="color: #d97706; font-weight: bold;">${formatCurrency(indirectVal, cur)}</td>
            <td style="color: #b91c1c; font-weight: bold; font-size: 14px;">${formatCurrency(totalVal, cur)}</td>
            <td style="font-size: 11px; font-weight: bold;">${cur}</td>
          </tr>
        `;
      });
    });

    // Detailed separate tables for each day
    let dailyDetailedTablesHtml = '';
    sortedDays.forEach(day => {
      const dayTotalsStr = Object.entries(day.totalAmount)
        .map(([c, v]) => formatCurrency(v, c))
        .join(' | ');

      let dayItemsRows = '';
      day.items.forEach(exp => {
        let recipientStr = '- مصروف عام -';
        if (exp.recipientType === 'worker') {
          recipientStr = `${exp.recipientName} (عامل)`;
        } else if (exp.recipientType === 'supplier') {
          recipientStr = `${exp.recipientName} (مورد)`;
        } else if (exp.recipientType === 'employee') {
          recipientStr = `${exp.recipientName} (موظف)`;
        }

        const typeStr = (exp.expenseType || 'direct') === 'indirect' ? 'غير مباشرة' : 'مباشرة';
        const typeBadgeColor = (exp.expenseType || 'direct') === 'indirect' ? '#d97706' : '#059669';
        const typeBgColor = (exp.expenseType || 'direct') === 'indirect' ? '#fef3c7' : '#d1fae5';
        const categoryStr = exp.categories?.length ? exp.categories.join('، ') : (exp.category || '-');

        dayItemsRows += `
          <tr>
            <td style="font-weight: bold;">${exp.description}</td>
            <td style="text-align: center;"><span style="background-color: ${typeBgColor}; color: ${typeBadgeColor}; font-weight: bold; font-size: 11px; padding: 2px 8px; border-radius: 4px;">${typeStr}</span></td>
            <td style="font-size: 11px;">${categoryStr}</td>
            <td>${recipientStr}</td>
            <td style="font-weight: bold; color: #b91c1c;">${formatCurrency(exp.amount, exp.currency || currency || 'YER')}</td>
            <td style="font-size: 11px; color: #64748b;">${exp.notes || '-'}</td>
          </tr>
        `;
      });

      dailyDetailedTablesHtml += `
        <div style="margin-top: 20px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 13px;">📅 العمليات المالية ليوم: ${formatDateArabic(day.date)} (${day.count} عملية)</span>
            <span style="background-color: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">إجمالي اليوم: ${dayTotalsStr}</span>
          </div>
          <table style="margin: 0; width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">البيان (المصروف)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">نوع النفقة</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">الفئة</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">الترحيل لحساب</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">المبلغ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${dayItemsRows}
            </tbody>
          </table>
        </div>
      `;
    });

    const totalText = Object.entries(totalsByCurrency)
      .map(([cur, val]) => `<strong>${formatCurrency(Number(val), cur)}</strong>`)
      .join(' | ');

    const htmlContent = `
      <div class="header" style="text-align: center; margin-bottom: 20px;">
        <h1 class="title" style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">كشف النفقات والمصاريف اليومية الشامل التفصيلي</h1>
        <div class="meta" style="font-size: 12px; color: #64748b;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
      </div>

      <div class="info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div><strong>إجمالي عدد العمليات:</strong> ${filteredExpenses.length} عملية</div>
        <div><strong>عدد الأيام المصروف فيها:</strong> ${sortedDays.length} يوم</div>
        <div><strong>نطاق التصفية:</strong> ${startDateFilter ? `من ${formatDateArabic(startDateFilter)}` : 'الكل'} ${endDateFilter ? `إلى ${formatDateArabic(endDateFilter)}` : ''}</div>
      </div>

      <!-- SECTION 1: DAILY SUMMARY TABLE -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px;">
          أولاً: جدول ملخص إجمالي النفقات لكل يوم
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              <th style="padding: 8px; border: 1px solid #334155;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: center;">عدد العمليات</th>
              <th style="padding: 8px; border: 1px solid #334155;">نفقات مباشرة</th>
              <th style="padding: 8px; border: 1px solid #334155;">نفقات غير مباشرة</th>
              <th style="padding: 8px; border: 1px solid #334155;">إجمالي اليوم</th>
              <th style="padding: 8px; border: 1px solid #334155;">العملة</th>
            </tr>
          </thead>
          <tbody>
            ${filteredExpenses.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">لا توجد مصاريف مسجلة حالياً.</td></tr>' : dailySummaryRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- SECTION 2: DETAILED SEPARATE TABLES FOR EACH DAY -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
          ثانياً: جداول منفصلة لكافة العمليات المالية التفصيلية لكل يوم
        </h3>
        ${filteredExpenses.length === 0 ? '<p style="text-align: center; color: #94a3b8;">لا توجد بيانات تفصيلية.</p>' : dailyDetailedTablesHtml}
      </div>

      <!-- TOTAL SUMMARY FOOTER -->
      <div style="margin-top: 25px; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center; page-break-inside: avoid;">
        <span style="font-size: 14px; font-weight: bold; color: #991b1b;">إجمالي النفقات والمصاريف الكلي: </span>
        <span style="font-size: 18px; font-weight: 800; color: #b91c1c; margin-right: 10px;">${totalText || '0'}</span>
      </div>
    `;

    printPDF('تقرير النفقات والمصاريف اليومية للموقع', htmlContent);
  };

  return (
    <div className="space-y-4 animate-fade-in" id="expenses-section">
      {/* Page Header */}
      <PageHeaderCard
        title="سجل المصاريف والنفقات اليومية"
        description="تسجيل المصاريف والمدفوعات اليومية للموقع والنثريات وترحيلها مباشرة لحسابات العمال والموردين."
        icon={<TrendingUp size={20} />}
        onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
        optionsMenu={
          <OptionsMenu 
            onExportExcel={handleExportExcel}
            onExportPDF={handlePrintAllExpensesPDF}
            onImportExcel={sharedRole !== 'read' ? handleExcelImport : undefined}
            shareTitle="تقرير النفقات والمصاريف اليومية للموقع"
            shareText={(() => {
              const totalText = Object.entries(totalsByCurrency)
                .map(([cur, val]) => `${formatCurrency(Number(val), cur)}`)
                .join(' | ');

              const lastEntries = sortedExpenses.slice(0, 15);
              const entriesText = lastEntries.length > 0
                ? '\n📋 تفاصيل أحدث المصاريف المقيدة:\n' + lastEntries.map(e => {
                    const recipientStr = e.recipientType !== 'none' ? ` [مرحل لـ: ${e.recipientName}]` : '';
                    return `- ${e.date} | ${e.description} ⟸ ${formatCurrency(e.amount, e.currency || currency)}${recipientStr}`;
                  }).join('\n')
                : '\n(لا توجد نفقات مطابقة)';

              return `💸 تقرير المصاريف والنفقات اليومية للموقع\n📅 تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}\n\n📊 ملخص إجمالي المصاريف:\nإجمالي المجموع: ${totalText || '0'}\nعدد العمليات: ${filteredExpenses.length} عملية\n${entriesText}\n\n*تم استخراجه ومشاركته من كشوفات المقاولات*`;
            })()}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Expense Entry Form */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs h-fit" id="expense-form-container">
          {sharedRole === 'read' ? (
            <div className="text-center py-8 space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Tag size={24} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">وضع عرض الحساب المشترك</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                تمت دعوتك بصلاحية (عرض فقط). لا يمكنك إضافة نفقات جديدة أو ترحيل مبالغ لحسابات العمال والموردين.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(!isAddExpenseOpen)}
                className="w-full flex items-center justify-between text-right font-bold text-slate-800 text-sm sm:text-base hover:text-rose-600 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={20} className="text-rose-500" />
                  <span>إضافة نفقة جديدة</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-normal">
                  <span className="text-slate-400 text-xs hidden sm:inline">{isAddExpenseOpen ? 'إخفاء' : 'إظهار النموذج'}</span>
                  {isAddExpenseOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isAddExpenseOpen && (
                <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100 mt-3">
                
                {/* Date Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 transition-colors pr-10"
                      required
                    />
                    <Calendar size={18} className="absolute top-1/2 -translate-y-1/2 right-3.5 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-[10px] text-slate-400">يتم تحديد التاريخ تلقائياً ويمكنك تعديله من التقويم.</span>
                </div>

                {/* Amount & Currency */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">المبلغ</label>
                    <div className="flex gap-1.5 items-center">
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            descriptionInputRef.current?.focus();
                          }
                        }}
                        placeholder="مثال: 50000"
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 transition-colors"
                        required
                        min="1"
                      />
                      <Calculator onApply={(val) => setAmount(String(val))} />
                    </div>
                    <AmountInWords amount={amount} currency={itemCurrency} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">العملة</label>
                    <select
                      value={itemCurrency}
                      onChange={(e) => setItemCurrency(e.target.value)}
                      tabIndex={-1}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 transition-colors cursor-pointer"
                    >
                      <option value="YER">﷼ يمني</option>
                      <option value="SAR">﷼ سعودي</option>
                      <option value="USD">$ دولار</option>
                    </select>
                  </div>
                </div>

                {/* Description / Statement */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">البيان</label>
                  <input 
                    ref={descriptionInputRef}
                    type="text" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثال: شراء إسمنت مقاوم / دفعة أجور"
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 transition-colors"
                    required
                  />
                </div>

                {/* Expense Type (Direct vs Indirect) Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">نوع النفقة</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setExpenseType('direct')}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                        expenseType === 'direct'
                          ? 'bg-rose-50 border border-rose-200 text-rose-800'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                        expenseType === 'direct' 
                          ? 'bg-rose-600 border-rose-600 text-white shadow-2xs' 
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}>
                        <Check size={12} strokeWidth={3} className={expenseType === 'direct' ? 'opacity-100' : 'opacity-0'} />
                      </div>
                      <span className="truncate">نفقات مباشرة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpenseType('indirect')}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                        expenseType === 'indirect'
                          ? 'bg-amber-50 border border-amber-200 text-amber-800'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                        expenseType === 'indirect' 
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs' 
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}>
                        <Check size={12} strokeWidth={3} className={expenseType === 'indirect' ? 'opacity-100' : 'opacity-0'} />
                      </div>
                      <span className="truncate">نفقات غير مباشرة</span>
                    </button>
                  </div>
                </div>

                {/* Category ("الفئة") Multi-Select Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">الفئة</label>
                    <span className="text-[10px] text-slate-400">(يمكنك اختيار أكثر من خيار)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const isSelected = categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                            isSelected
                              ? 'bg-rose-50 border border-rose-300 text-rose-800'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                            isSelected 
                              ? 'bg-rose-600 border-rose-600 text-white shadow-2xs' 
                              : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                          }`}>
                            <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                          </div>
                          <span className="truncate">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Post / Transfer To Account Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                    <ArrowLeftRight size={14} className="text-rose-500" />
                    ترحيل إلى حساب (اختياري)
                  </label>
                  <PostingAccountSelect 
                    value={postTo}
                    onChange={setPostTo}
                    workers={workers}
                    employees={employees}
                    suppliers={suppliers}
                  />
                  <span className="text-[10px] text-slate-400 leading-relaxed block">
                    عند اختيار عامل، موظف، أو مورد، سيتم ترحيل المبلغ كـ <strong>"مبلغ عليه"</strong> في كشف حسابه تلقائياً مع الاحتفاظ بنسخة هنا.
                  </span>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات إضافية حول العملية..."
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 transition-colors resize-none"
                  />
                </div>

                {/* Alerts */}
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button 
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlusCircle size={18} />
                  تسجيل وترحيل النفقة
                </button>
              </form>
              )}
            </>
          )}
        </div>

        {/* Expenses List & Filters */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Filters card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs transition-all" id="expenses-filters">
            <button
              type="button"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="w-full flex items-center justify-between text-right font-bold text-slate-700 text-sm hover:text-slate-900 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <span>أدوات البحث والتصفية</span>
                {(searchTerm || startDateFilter || endDateFilter || sortOrder !== 'date-desc' || expenseTypeFilter !== 'all') && (
                  <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    فلتر نشط
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-normal">
                <span className="text-slate-400 text-xs hidden sm:inline">{isFiltersOpen ? 'إخفاء' : 'عرض الخيارات'}</span>
                {isFiltersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>
            
            {isFiltersOpen && (
              <div className="pt-3 space-y-4 border-t border-slate-100 mt-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Search text */}
                  <div className="relative">
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="بحث في البيان، الملاحظات..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-rose-500 transition-colors"
                    />
                    <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                  </div>

                  {/* Start Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">من:</span>
                    <input 
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-rose-500"
                    />
                  </div>

                  {/* End Date */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">إلى:</span>
                    <input 
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-rose-500"
                    />
                  </div>

                  {/* Sort Order Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">الترتيب:</span>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as ExpenseSortOption)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-rose-500 cursor-pointer"
                    >
                      <option value="date-desc">من الأحدث إلى الأقدم ⬇️ (افتراضي)</option>
                      <option value="date-asc">من الأقبل إلى الأحدث ⬆️</option>
                      <option value="desc-alpha">أبجدياً حسب البيان (أ - ي) 🔤</option>
                      <option value="recipient-alpha">أبجدياً حسب الترحيل والاسم 👤</option>
                      <option value="amount-desc">حسب المبلغ (الأعلى أولاً) 💰</option>
                    </select>
                  </div>

                  {/* Expense Type Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">نوع النفقة:</span>
                    <select
                      value={expenseTypeFilter}
                      onChange={(e) => setExpenseTypeFilter(e.target.value as 'all' | 'direct' | 'indirect')}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-rose-500 cursor-pointer"
                    >
                      <option value="all">كافة النفقات (مباشرة وغير مباشرة)</option>
                      <option value="direct">نفقات مباشرة فقط</option>
                      <option value="indirect">نفقات غير مباشرة فقط</option>
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">الفئة:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-rose-500 cursor-pointer"
                    >
                      <option value="all">كافة الفئات</option>
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clear filters shortcut */}
                {(searchTerm || startDateFilter || endDateFilter || sortOrder !== 'date-desc' || expenseTypeFilter !== 'all' || categoryFilter !== 'all') && (
                  <div className="flex justify-end">
                    <button 
                      onClick={() => {
                        setSearchTerm('');
                        setStartDateFilter('');
                        setEndDateFilter('');
                        setSortOrder('date-desc');
                        setExpenseTypeFilter('all');
                        setCategoryFilter('all');
                      }}
                      className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      إعادة تعيين الفلاتر
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expenses Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="expenses-table-card">
            
            {/* Table Header / Totals */}
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-slate-800 text-base">سجل النفقات اليومية</h4>
                <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                  {sortedExpenses.length} عمليات
                </span>
                {hasActiveColumnFilters && (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded-lg text-xs font-bold">
                    <Filter size={12} className="fill-current text-rose-600" />
                    <span>تصفية مخصصة للأعمدة</span>
                    <button
                      type="button"
                      onClick={handleClearAllColumnFilters}
                      className="text-[10px] text-rose-600 hover:text-rose-800 hover:underline mr-1 cursor-pointer font-bold"
                    >
                      إلغاء فلاتر الأعمدة ✕
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                  {activeColumnSort ? `مرتبة حسب عمود: ${columnConfigs[activeColumnSort.key]?.title} (${activeColumnSort.direction === 'asc' ? 'تصاعدي' : 'تنازلي'})` :
                   sortOrder === 'date-desc' ? 'مرتبة من الأحدث للأقدم' :
                   sortOrder === 'date-asc' ? 'مرتبة من الأقدم للأحدث' :
                   sortOrder === 'desc-alpha' ? 'مرتبة أبجدياً حسب البيان' :
                   sortOrder === 'recipient-alpha' ? 'مرتبة أبجدياً حسب الترحيل' :
                   'مرتبة حسب المبلغ الأكبر'}
                </span>
              </div>
              <div className="text-slate-700 text-xs font-bold flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                <span>المجموع المصفى:</span>
                {Object.keys(totalsByCurrency).length === 0 ? (
                  <span className="text-slate-400">0</span>
                ) : (
                  Object.entries(totalsByCurrency).map(([cur, val]) => (
                    <span key={cur} className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg border border-rose-100 text-xs font-extrabold font-mono">
                      {formatCurrency(Number(val), cur)}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Desktop & Mobile Responsive view */}
            <div className="overflow-x-auto">
              {sortedExpenses.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <p className="text-slate-400 text-sm font-medium">لا توجد مصاريف مطابقة لخيارات البحث</p>
                  <p className="text-xs text-slate-300">أدخل نفقات جديدة أو قم بتغيير فلاتر التصفية</p>
                </div>
              ) : (
                <table className="w-full text-right text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 text-xs font-bold">
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1">
                          <span>التاريخ</span>
                          <ExcelColumnFilter
                            config={columnConfigs.date}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.date}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 min-w-[280px] sm:min-w-[380px]">
                        <div className="flex items-center justify-between gap-1">
                          <span>البيان</span>
                          <ExcelColumnFilter
                            config={columnConfigs.description}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.description}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1">
                          <span>نوع النفقة</span>
                          <ExcelColumnFilter
                            config={columnConfigs.expenseType}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.expenseType}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1">
                          <span>الفئة</span>
                          <ExcelColumnFilter
                            config={columnConfigs.categories}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.categories}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1">
                          <span>الترحيل</span>
                          <ExcelColumnFilter
                            config={columnConfigs.recipient}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.recipient}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-between gap-1">
                          <span>المبلغ</span>
                          <ExcelColumnFilter
                            config={columnConfigs.amount}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.amount}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 max-w-[160px]">
                        <div className="flex items-center justify-between gap-1">
                          <span>ملاحظات</span>
                          <ExcelColumnFilter
                            config={columnConfigs.notes}
                            data={baseFilteredExpenses}
                            allColumnFilters={columnFilters}
                            allConfigs={columnConfigs}
                            activeFilter={columnFilters.notes}
                            onFilterChange={handleColumnFilterChange}
                            activeSort={activeColumnSort}
                            onSortChange={handleColumnSortChange}
                            accentColor="rose"
                          />
                        </div>
                      </th>
                      <th className="p-3.5 text-center whitespace-nowrap">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                        {/* Date */}
                        <td className="p-4 whitespace-nowrap text-xs font-medium">
                          {formatDateArabic(exp.date)}
                        </td>
                        
                        {/* Statement */}
                        <td className="p-4 font-semibold text-slate-800 min-w-[280px] sm:min-w-[380px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{exp.description}</span>
                            <AttributionBadge createdBy={exp.createdBy} />
                          </div>
                        </td>

                        {/* Expense Type Badge */}
                        <td className="p-4 whitespace-nowrap text-xs">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            (exp.expenseType || 'direct') === 'direct'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {(exp.expenseType || 'direct') === 'direct' ? 'نفقات مباشرة' : 'نفقات غير مباشرة'}
                          </span>
                        </td>

                        {/* Categories Badges */}
                        <td className="p-4 whitespace-nowrap text-xs">
                          {exp.categories && exp.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {exp.categories.map((cat) => (
                                <span key={cat} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : exp.category ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {exp.category}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>

                        {/* Recipient posted */}
                        <td className="p-4 whitespace-nowrap text-xs">
                          {exp.recipientType !== 'none' ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                              exp.recipientType === 'worker' 
                                ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                                : exp.recipientType === 'employee'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              <Tag size={12} />
                              {exp.recipientName}
                              <span className="text-[9px] opacity-70">
                                ({exp.recipientType === 'worker' ? 'عامل' : exp.recipientType === 'employee' ? 'موظف' : 'مورد'})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">- مصروف عام -</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="p-4 whitespace-nowrap font-bold text-slate-900">
                          {formatCurrency(exp.amount, exp.currency || 'YER')}
                        </td>

                        {/* Notes */}
                        <td className="p-4 text-slate-500 text-xs max-w-[160px] truncate" title={exp.notes}>
                          {exp.notes || <span className="text-slate-300">-</span>}
                        </td>

                        {/* Actions */}
                        <td className="p-4 whitespace-nowrap text-center flex items-center justify-center gap-1.5">
                          {sharedRole !== 'read' && (
                            <button 
                              onClick={() => {
                                setEditingExpense(exp);
                                setEditingPostTo(exp.recipientType !== 'none' ? `${exp.recipientType}:${exp.recipientId}` : '');
                              }}
                              className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="تعديل النفقة"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {sharedRole !== 'read' && sharedRole !== 'add' && (
                            <button 
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذه النفقة؟ سيتم إلغاء ترحيلها من حساب العامل/المورد تلقائياً إذا كانت مرحلة.')) {
                                  onDeleteExpense(exp.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="حذف النفقة"
                            >
                              <Trash2 size={16} />
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
      {/* Edit Expense Modal */}
      {editingExpense && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل النفقة اليومية</h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditExpenseSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <input 
                    type="date" 
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">المبلغ</label>
                    <div className="flex gap-1.5 items-center">
                      <input 
                        type="number" 
                        value={editingExpense.amount}
                        onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 font-mono text-left"
                        required
                        min="1"
                      />
                      <Calculator onApply={(val) => setEditingExpense({ ...editingExpense, amount: val })} />
                    </div>
                    <AmountInWords amount={editingExpense.amount} currency={editingExpense.currency || 'YER'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">العملة</label>
                    <select 
                      value={editingExpense.currency || 'YER'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, currency: e.target.value })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 cursor-pointer"
                    >
                      <option value="YER">﷼ يمني</option>
                      <option value="SAR">﷼ سعودي</option>
                      <option value="USD">$ دولار</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">البيان</label>
                  <input 
                    type="text" 
                    value={editingExpense.description}
                    onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500"
                    required
                  />
                </div>

                {/* Expense Type (Direct vs Indirect) Selector in Edit Modal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">نوع النفقة</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingExpense({ ...editingExpense, expenseType: 'direct' })}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                        (editingExpense.expenseType || 'direct') === 'direct'
                          ? 'bg-rose-50 border border-rose-200 text-rose-800'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                        (editingExpense.expenseType || 'direct') === 'direct' 
                          ? 'bg-rose-600 border-rose-600 text-white shadow-2xs' 
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}>
                        <Check size={12} strokeWidth={3} className={(editingExpense.expenseType || 'direct') === 'direct' ? 'opacity-100' : 'opacity-0'} />
                      </div>
                      <span className="truncate">نفقات مباشرة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingExpense({ ...editingExpense, expenseType: 'indirect' })}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                        (editingExpense.expenseType || 'direct') === 'indirect'
                          ? 'bg-amber-50 border border-amber-200 text-amber-800'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                        (editingExpense.expenseType || 'direct') === 'indirect' 
                          ? 'bg-amber-600 border-amber-600 text-white shadow-2xs' 
                          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                      }`}>
                        <Check size={12} strokeWidth={3} className={(editingExpense.expenseType || 'direct') === 'indirect' ? 'opacity-100' : 'opacity-0'} />
                      </div>
                      <span className="truncate">نفقات غير مباشرة</span>
                    </button>
                  </div>
                </div>

                {/* Category ("الفئة") Multi-Select Section in Edit Modal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">الفئة</label>
                    <span className="text-[10px] text-slate-400">(يمكنك اختيار أكثر من خيار)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const isSelected = (editingExpense.categories || []).includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleEditingCategory(cat)}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer select-none text-xs font-bold ${
                            isSelected
                              ? 'bg-rose-50 border border-rose-300 text-rose-800'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-all shrink-0 ${
                            isSelected 
                              ? 'bg-rose-600 border-rose-600 text-white shadow-2xs' 
                              : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                          }`}>
                            <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                          </div>
                          <span className="truncate">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ترحيل إلى حساب</label>
                  <PostingAccountSelect 
                    value={editingPostTo}
                    onChange={setEditingPostTo}
                    workers={workers}
                    employees={employees}
                    suppliers={suppliers}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <textarea 
                    value={editingExpense.notes || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-rose-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingExpense(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
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
