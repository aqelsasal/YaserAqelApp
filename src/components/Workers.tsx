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
  Hammer, 
  ChevronLeft, 
  ArrowLeft, 
  Coins, 
  Receipt,
  User,
  Clock,
  Search,
  Filter,
  Info,
  Pencil,
  UserCheck,
  ArrowRightLeft,
  Users,
  ChevronDown,
  ChevronUp,
  Utensils,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import AttributionBadge from './AttributionBadge';
import Calculator from './Calculator';
import ShareMenu from './ShareMenu';
import OptionsMenu from './OptionsMenu';
import PhoneNumbersInput, { PhoneNumbersDisplay } from './PhoneNumbersInput';
import ExcelColumnFilter, { ColumnFilterConfig, ActiveColumnFilter, ColumnSortState } from './ExcelColumnFilter';
import { useBodyScrollLock } from '../utils/modalScrollLock';
import { 
  Worker, 
  LedgerEntry, 
  NutritionPeriod,
  calculateDaysOfWork, 
  calculateActualDaysOfWork,
  calculateNutritionDays,
  formatCurrency, 
  formatDateArabic,
  cleanLedgerDescription,
  exportToCSV,
  exportMultiSheetXLSX,
  printPDF
} from '../types';

interface WorkersProps {
  workers: Worker[];
  onAddWorker: (worker: Omit<Worker, 'id' | 'ledger'>) => void;
  onDeleteWorker: (id: string) => void;
  onUpdateWorker?: (id: string, updatedData: Omit<Worker, 'id' | 'ledger' | 'createdBy'>) => void;
  onAddWorkerLedgerEntry: (workerId: string, entry: Omit<LedgerEntry, 'id'>) => void;
  onDeleteWorkerLedgerEntry: (workerId: string, entryId: string) => void;
  onUpdateWorkerLedgerEntry?: (workerId: string, entryId: string, updatedEntry: Omit<LedgerEntry, 'id' | 'createdBy'>) => void;
  onAddWorkerExtraPeriod?: (workerId: string, startDate: string, endDate: string) => void;
  onDeleteWorkerExtraPeriod?: (workerId: string, periodId: string) => void;
  onAddWorkerNutritionPeriod?: (workerId: string, nutrition: Omit<NutritionPeriod, 'id'>) => void;
  onUpdateWorkerNutritionPeriod?: (workerId: string, nutritionId: string, updatedNutrition: Partial<Omit<NutritionPeriod, 'id'>>) => void;
  onDeleteWorkerNutritionPeriod?: (workerId: string, nutritionId: string) => void;
  onTransferWorkerToEmployee?: (worker: Worker) => void;
  setActiveTab?: (tab: string) => void;
  currency?: string;
  sharedRole?: 'owner' | 'read' | 'add' | 'full';
}

// Calculate accumulated days of work including extra periods
export const getWorkerTotalDays = (w: Worker, isOwner: boolean = true) => {
  const mainDays = calculateDaysOfWork(w.startDate, w.endDate, isOwner);
  const extraDays = (w.extraPeriods || []).reduce((sum, p) => sum + calculateDaysOfWork(p.startDate, p.endDate, isOwner), 0);
  return mainDays + extraDays;
};

// Calculate actual accumulated days of work dynamically up to today (the phone's current date)
export const getWorkerActualDays = (w: Worker, isOwner: boolean = true) => {
  const mainActualDays = calculateActualDaysOfWork(w.startDate, w.endDate, isOwner);
  const extraActualDays = (w.extraPeriods || []).reduce((sum, p) => sum + calculateActualDaysOfWork(p.startDate, p.endDate, isOwner), 0);
  return mainActualDays + extraActualDays;
};

export default function Workers({
  workers,
  onAddWorker,
  onDeleteWorker,
  onUpdateWorker,
  onAddWorkerLedgerEntry,
  onDeleteWorkerLedgerEntry,
  onUpdateWorkerLedgerEntry,
  onAddWorkerExtraPeriod,
  onDeleteWorkerExtraPeriod,
  onAddWorkerNutritionPeriod,
  onUpdateWorkerNutritionPeriod,
  onDeleteWorkerNutritionPeriod,
  onTransferWorkerToEmployee,
  setActiveTab,
  currency = 'YER',
  sharedRole = 'owner'
}: WorkersProps) {
  
  // Selection & Form states
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // Edit states
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editingWorkerLedger, setEditingWorkerLedger] = useState<{ workerId: string; entry: LedgerEntry } | null>(null);

  // Excel File upload/import handler for active worker's ledger
  const handleWorkerLedgerExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkerId) return;

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
          const onHim = parseFloat(row['مبلغ عليه'] || row['سلف'] || row['عليه'] || row['دفعة'] || row['On Him'] || row['Debit'] || row['on_him'] || row['debit']) || 0;
          const forHim = parseFloat(row['مبلغ له'] || row['أجر'] || row['مستحقات'] || row['له'] || row['For Him'] || row['Credit'] || row['for_him'] || row['credit']) || 0;
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

            onAddWorkerLedgerEntry(selectedWorkerId, {
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

        alert(`تم استيراد ${count} حركة بنجاح من ملف Excel!`);
      } catch (err) {
        console.error("Error reading Excel for worker ledger:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من أن الأعمدة مطابقة (التاريخ، البيان، مبلغ عليه، مبلغ له).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Submit handler for editing worker
  const handleEditWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    const rawPhones = editingWorker.phoneNumbers || [];
    if (rawPhones.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      alert('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567)');
      return;
    }
    const cleanPhones = rawPhones.map(p => p.trim()).filter(p => p.length === 9);

    if (onUpdateWorker) {
      onUpdateWorker(editingWorker.id, {
        name: editingWorker.name,
        profession: editingWorker.profession,
        startDate: editingWorker.startDate,
        endDate: editingWorker.endDate || '',
        phoneNumbers: cleanPhones,
        notes: editingWorker.notes || ''
      });
    }
    setEditingWorker(null);
  };

  // Submit handler for editing ledger entry
  const handleEditWorkerLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkerLedger) return;
    if (onUpdateWorkerLedgerEntry) {
      onUpdateWorkerLedgerEntry(editingWorkerLedger.workerId, editingWorkerLedger.entry.id, {
        date: editingWorkerLedger.entry.date,
        amountOnHim: editingWorkerLedger.entry.amountOnHim,
        amountForHim: editingWorkerLedger.entry.amountForHim,
        description: editingWorkerLedger.entry.description,
        notes: editingWorkerLedger.entry.notes,
        currency: editingWorkerLedger.entry.currency || 'YER'
      });
    }
    setEditingWorkerLedger(null);
  };
  
  // Add Worker form
  const [showAddWorkerForm, setShowAddWorkerForm] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerProfession, setNewWorkerProfession] = useState('');
  const [newWorkerStartDate, setNewWorkerStartDate] = useState('');
  const [newWorkerEndDate, setNewWorkerEndDate] = useState('');
  const [newWorkerPhoneNumbers, setNewWorkerPhoneNumbers] = useState<string[]>(['']);
  const [newWorkerNotes, setNewWorkerNotes] = useState('');

  // Extra Work Period form states
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraStart, setExtraStart] = useState('');
  const [extraEnd, setExtraEnd] = useState('');
  const [extraFormError, setExtraFormError] = useState('');

  // Nutrition Period Modal & Form States
  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [editingNutritionPeriod, setEditingNutritionPeriod] = useState<NutritionPeriod | null>(null);
  const [nutrWorkerName, setNutrWorkerName] = useState('');
  const [nutrDailyAmount, setNutrDailyAmount] = useState('');
  const [nutrStartDate, setNutrStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [nutrEndDate, setNutrEndDate] = useState('');
  const [nutrNotes, setNutrNotes] = useState('');
  const [nutrFormError, setNutrFormError] = useState('');

  // Lock background scrolling when any modal in Workers is open
  useBodyScrollLock(Boolean(editingWorker || editingWorkerLedger || showNutritionModal));

  // Add Worker Ledger Entry form
  const [ledgerDate, setLedgerDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [ledgerAmountOnHim, setLedgerAmountOnHim] = useState(''); // عليه
  const [ledgerAmountForHim, setLedgerAmountForHim] = useState(''); // له
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [ledgerCurrency, setLedgerCurrency] = useState(currency);
  const [showAddLedgerForm, setShowAddLedgerForm] = useState(false);

  // Search filter & sort filters
  const [searchQuery, setSearchQuery] = useState('');
  const [workerSortOrder, setWorkerSortOrder] = useState<'asc' | 'desc'>('desc'); // Default desc: newest first
  
  // Ledger filters state
  const [isLedgerFiltersOpen, setIsLedgerFiltersOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'onHim' | 'forHim'>('all');
  const [ledgerSortOption, setLedgerSortOption] = useState<'date-desc' | 'date-asc' | 'desc-alpha' | 'amountOnHim-desc' | 'amountForHim-desc'>('date-desc');

  // Error/Success alerts
  const [workerError, setWorkerError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  // Keep ledger currency in sync with global currency selection when prop changes
  useEffect(() => {
    setLedgerCurrency(currency);
  }, [currency]);

  // Find active worker details
  const activeWorker = workers.find(w => w.id === selectedWorkerId);

  // Nutrition Period Modal Handlers
  const handleOpenAddNutritionModal = () => {
    setEditingNutritionPeriod(null);
    setNutrWorkerName(activeWorker?.name || '');
    setNutrDailyAmount('');
    setNutrStartDate(new Date().toISOString().split('T')[0]);
    setNutrEndDate('');
    setNutrNotes('');
    setNutrFormError('');
    setShowNutritionModal(true);
  };

  const handleOpenEditNutritionModal = (period: NutritionPeriod) => {
    setEditingNutritionPeriod(period);
    setNutrWorkerName(period.workerName);
    setNutrDailyAmount(period.dailyAmount.toString());
    setNutrStartDate(period.startDate);
    setNutrEndDate(period.endDate || '');
    setNutrNotes(period.notes || '');
    setNutrFormError('');
    setShowNutritionModal(true);
  };

  const handleNutritionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNutrFormError('');

    if (!nutrWorkerName.trim()) {
      setNutrFormError('الرجاء إدخال اسم العامل / المساعد.');
      return;
    }
    const dailyAmt = parseFloat(nutrDailyAmount);
    if (isNaN(dailyAmt) || dailyAmt <= 0) {
      setNutrFormError('الرجاء إدخال مبلغ تغذية يومي صحيح وأكبر من صفر.');
      return;
    }
    if (!nutrStartDate) {
      setNutrFormError('الرجاء اختيار تاريخ البدء.');
      return;
    }
    if (nutrEndDate && new Date(nutrStartDate) > new Date(nutrEndDate)) {
      setNutrFormError('تاريخ البدء يجب أن يكون قبل أو يساوي تاريخ الانتهاء.');
      return;
    }

    if (activeWorker) {
      if (editingNutritionPeriod) {
        onUpdateWorkerNutritionPeriod?.(activeWorker.id, editingNutritionPeriod.id, {
          workerName: nutrWorkerName.trim(),
          dailyAmount: dailyAmt,
          startDate: nutrStartDate,
          endDate: nutrEndDate || undefined,
          notes: nutrNotes.trim()
        });
      } else {
        onAddWorkerNutritionPeriod?.(activeWorker.id, {
          workerName: nutrWorkerName.trim(),
          dailyAmount: dailyAmt,
          startDate: nutrStartDate,
          endDate: nutrEndDate || undefined,
          notes: nutrNotes.trim()
        });
      }
    }

    setShowNutritionModal(false);
  };

  // Form submit for new worker
  const handleAddWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerError('');

    if (!newWorkerName.trim()) {
      setWorkerError('الرجاء إدخال اسم العامل.');
      return;
    }
    if (!newWorkerProfession.trim()) {
      setWorkerError('الرجاء إدخال مهنة العامل.');
      return;
    }
    if (!newWorkerStartDate) {
      setWorkerError('الرجاء اختيار تاريخ البدء.');
      return;
    }
    if (newWorkerEndDate && new Date(newWorkerStartDate) > new Date(newWorkerEndDate)) {
      setWorkerError('تاريخ البدء يجب أن يكون قبل أو يساوي تاريخ الانتهاء.');
      return;
    }

    if (newWorkerPhoneNumbers.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      setWorkerError('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567).');
      return;
    }

    const validPhones = newWorkerPhoneNumbers.map(p => p.trim()).filter(p => p.length === 9);

    onAddWorker({
      name: newWorkerName.trim(),
      profession: newWorkerProfession.trim(),
      startDate: newWorkerStartDate,
      endDate: newWorkerEndDate || '',
      phoneNumbers: validPhones,
      notes: newWorkerNotes.trim()
    });

    // Reset Form
    setNewWorkerName('');
    setNewWorkerProfession('');
    setNewWorkerStartDate('');
    setNewWorkerEndDate('');
    setNewWorkerPhoneNumbers(['']);
    setNewWorkerNotes('');
    setShowAddWorkerForm(false);
  };

  // Submit Handler for Extra Period
  const handleExtraPeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExtraFormError('');

    if (!extraStart || !extraEnd) {
      setExtraFormError('الرجاء إدخال تاريخ البدء والانتهاء.');
      return;
    }
    if (new Date(extraStart) > new Date(extraEnd)) {
      setExtraFormError('تاريخ البدء يجب أن يكون قبل أو يساوي تاريخ الانتهاء.');
      return;
    }

    if (selectedWorkerId && onAddWorkerExtraPeriod) {
      onAddWorkerExtraPeriod(selectedWorkerId, extraStart, extraEnd);
      setExtraStart('');
      setExtraEnd('');
      setShowExtraForm(false);
    }
  };

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
          // Map properties (support both Arabic and English names)
          const name = row['الاسم'] || row['الاسم الكامل'] || row['Name'] || row['name'];
          const profession = row['المهنة'] || row['الوظيفة'] || row['Profession'] || row['profession'] || row['Job'] || row['job'] || 'عامل';
          let startDate = row['تاريخ البدء'] || row['تاريخ مباشرة العمل'] || row['Start Date'] || row['start_date'] || row['Start'] || row['start'];
          let endDate = row['تاريخ الانتهاء'] || row['End Date'] || row['end_date'] || row['End'] || row['end'] || '';
          const phoneRaw = row['رقم الهاتف'] || row['الهاتف'] || row['رقم الجوال'] || row['الجوال'] || row['Phone'] || row['phone'] || '';

          const phoneNumbers: string[] = [];
          if (phoneRaw) {
            String(phoneRaw).split(/[,;/\n]+/).forEach(p => {
              const digits = p.replace(/\D/g, '').slice(0, 9);
              if (digits.length === 9) phoneNumbers.push(digits);
            });
          }

          if (name && startDate) {
            const parseDate = (d: any) => {
              if (!d) return '';
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

            onAddWorker({
              name: String(name).trim(),
              profession: String(profession).trim(),
              startDate: parseDate(startDate),
              endDate: parseDate(endDate),
              phoneNumbers
            });
            count++;
          }
        });

        alert(`تم استيراد ${count} عامل بنجاح من ملف Excel!`);
      } catch (err) {
        console.error("Error reading Excel:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من أن الأعمدة مطابقة (الاسم، المهنة، تاريخ البدء، تاريخ الانتهاء).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Form submit for worker ledger entry
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
      setLedgerError('الرجاء إدخال البيان للتسجيل.');
      return;
    }

    if (selectedWorkerId) {
      onAddWorkerLedgerEntry(selectedWorkerId, {
        date: ledgerDate,
        amountOnHim: onHim,
        amountForHim: forHim,
        description: ledgerDescription.trim(),
        notes: ledgerNotes.trim(),
        currency: ledgerCurrency
      });

      // Reset Form fields
      setLedgerAmountOnHim('');
      setLedgerAmountForHim('');
      setLedgerDescription('');
      setLedgerNotes('');
    }
  };

  // Export Workers Directory & Detailed Ledgers to Multi-sheet Excel
  const handleExportAllCSV = () => {
    // Sheet 1: Summary of workers
    const summaryHeaders = [
      'الرقم التعريفي',
      'اسم العامل / المقاول',
      'المهنة / التخصص',
      'رقم الهاتف',
      'تاريخ البدء',
      'تاريخ الانتهاء',
      'عدد أيام العمل',
      'إجمالي له (أجور ومكافآت)',
      'إجمالي عليه (سلف ومسحوبات)',
      'صافي الرصيد',
      'الوضع المالي'
    ];

    const summaryRows = workers.map(w => {
      const days = getWorkerTotalDays(w, sharedRole === 'owner');
      const totalOnHim = w.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = w.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;
      const netText = net === 0 ? 'خالص' : net > 0 ? `له: ${net}` : `عليه: ${Math.abs(net)}`;

      return [
        w.id,
        w.name,
        w.profession,
        w.phoneNumbers && w.phoneNumbers.length > 0 ? w.phoneNumbers.join(' - ') : '-',
        w.startDate,
        w.endDate || 'مستمر',
        days.toString(),
        totalForHim,
        totalOnHim,
        net,
        netText
      ];
    });

    // Sheet 2: Detailed ledger entries for ALL workers
    const ledgerHeaders = [
      'اسم العامل',
      'المهنة',
      'تاريخ الحركة',
      'البيان / الوصف التفصيلي',
      'مبلغ له (أجور ومكافآت)',
      'مبلغ عليه (سلف ومسحوبات)',
      'العملة',
      'الملاحظات',
      'بواسطة'
    ];

    const ledgerRows: (string | number)[][] = [];
    workers.forEach(w => {
      w.ledger.forEach(entry => {
        ledgerRows.push([
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
      });
    });
    ledgerRows.sort((a, b) => (b[2] as string).localeCompare(a[2] as string));

    exportMultiSheetXLSX(`تقرير_العمال_التفصيلي_الشامل_${new Date().toISOString().split('T')[0]}`, [
      { sheetName: 'سجل العمال العام', headers: summaryHeaders, rows: summaryRows },
      { sheetName: 'تفاصيل حركات كشف العمال', headers: ledgerHeaders, rows: ledgerRows }
    ]);
  };

  // Export Active Worker's Ledger to CSV
  const handleExportLedgerCSV = (worker: Worker) => {
    const headers = [
      'التاريخ',
      'البيان',
      'مبلغ عليه (سلف)',
      'مبلغ له (أجور/مكافآت)',
      'ملاحظات'
    ];

    const sortedLedger = [...worker.ledger].sort((a, b) => b.date.localeCompare(a.date));
    const rows = sortedLedger.map(e => [
      e.date,
      e.description,
      e.amountOnHim.toString(),
      e.amountForHim.toString(),
      e.notes
    ]);

    exportToCSV(`كشف_حساب_العامل_${worker.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  // Print Active Worker's Ledger as PDF
  const handlePrintWorkerPDF = (worker: Worker) => {
    const days = getWorkerTotalDays(worker, sharedRole === 'owner');
    const totalOnHim = worker.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
    const totalForHim = worker.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
    const net = totalForHim - totalOnHim;

    let ledgerRowsHtml = '';
    const sortedLedgerForPrint = [...worker.ledger].sort((a, b) => b.date.localeCompare(a.date));
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

    let extraPeriodsHtml = '';
    if (worker.extraPeriods && worker.extraPeriods.length > 0) {
      extraPeriodsHtml += `
        <div style="grid-column: span 2; margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
          <span style="font-weight: bold; font-size: 11px; color: #64748b; display: block; margin-bottom: 4px;">فترات العمل الإضافية المضافة:</span>
          <div style="display: flex; flex-direction: column; gap: 4px;">
      `;
      worker.extraPeriods.forEach((p, idx) => {
        const pDays = calculateDaysOfWork(p.startDate, p.endDate);
        extraPeriodsHtml += `
          <div style="font-size: 11px; color: #475569;">
            • فترة ${idx + 1}: من <strong>${formatDateArabic(p.startDate)}</strong> إلى <strong>${formatDateArabic(p.endDate)}</strong> (${pDays} يوم عمل)
          </div>
        `;
      });
      extraPeriodsHtml += `
          </div>
        </div>
      `;
    }

    const htmlContent = `
      <div class="header">
        <h1 class="title">كشف حساب مستحقات العامل</h1>
        <div class="meta">تم استخراج التقرير في: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
      </div>

      <div class="info-grid">
        <div class="info-item"><span class="info-label">اسم العامل:</span> ${worker.name}</div>
        <div class="info-item"><span class="info-label">المهنة / الصفة:</span> ${worker.profession}</div>
        <div class="info-item"><span class="info-label">تاريخ البدء:</span> ${formatDateArabic(worker.startDate)}</div>
        <div class="info-item"><span class="info-label">تاريخ الانتهاء:</span> ${worker.endDate ? formatDateArabic(worker.endDate) : 'مستمر'}</div>
        <div class="info-item" style="grid-column: span 2;"><span class="info-label">عدد أيام العمل الإجمالي المحتسب:</span> ${days} يوم عمل فعلي</div>
        ${extraPeriodsHtml}
      </div>

      <table>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>البيان</th>
            <th>المبلغ عليه (سلف)</th>
            <th>المبلغ له (أجور)</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${worker.ledger.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">لا توجد معاملات مسجلة في هذا الحساب حالياً.</td></tr>' : ledgerRowsHtml}
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-box">إجمالي المبالغ عليه (سلف): <span style="color: #dc2626;">${formatCurrency(totalOnHim)}</span></div>
        <div class="total-box">إجمالي مستحقاته (له): <span style="color: #16a34a;">${formatCurrency(totalForHim)}</span></div>
        <div class="total-box" style="background-color: ${net >= 0 ? '#f0fdf4' : '#fef2f2'}; border-color: ${net >= 0 ? '#bbf7d0' : '#fecaca'};">
          صافي المستحق: 
          <span style="color: ${net >= 0 ? '#15803d' : '#b91c1c'}; font-size: 18px;">
            ${net === 0 ? 'خالص الطرفين' : net > 0 ? `${formatCurrency(net)} (مطلوب تسديده)` : `${formatCurrency(Math.abs(net))} (سلفة زائدة لديه)`}
          </span>
        </div>
      </div>
    `;

    printPDF(`كشف حساب العامل ${worker.name}`, htmlContent);
  };

  // Print Overall Workers Directory to PDF with Summary and Detailed Ledgers
  const handlePrintAllWorkersPDF = () => {
    let grandOnHim = 0;
    let grandForHim = 0;

    let workerSummaryRowsHtml = '';
    let workersDetailedLedgersHtml = '';

    workers.forEach(w => {
      const days = getWorkerTotalDays(w, sharedRole === 'owner');
      const totalOnHim = w.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = w.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;

      grandOnHim += totalOnHim;
      grandForHim += totalForHim;

      // 1. Summary row
      workerSummaryRowsHtml += `
        <tr>
          <td style="font-weight: bold;">${w.name}</td>
          <td>${w.profession}</td>
          <td>${formatDateArabic(w.startDate)} إلى ${w.endDate ? formatDateArabic(w.endDate) : 'مستمر'}</td>
          <td style="text-align: center; font-weight: bold;">${days} يوم</td>
          <td style="color: #dc2626; font-family: monospace;">${formatCurrency(totalOnHim)}</td>
          <td style="color: #16a34a; font-family: monospace;">${formatCurrency(totalForHim)}</td>
          <td style="font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'}; font-family: monospace;">
            ${net === 0 ? 'خالص' : net > 0 ? `له: ${formatCurrency(net)}` : `عليه: ${formatCurrency(Math.abs(net))}`}
          </td>
        </tr>
      `;

      // 2. Detailed ledger table for this worker
      let ledgerRowsHtml = '';
      w.ledger.forEach(e => {
        ledgerRowsHtml += `
          <tr>
            <td style="font-family: monospace;">${formatDateArabic(e.date)}</td>
            <td style="font-weight: bold;">${e.description}</td>
            <td style="color: #dc2626; font-family: monospace;">${e.amountOnHim > 0 ? formatCurrency(e.amountOnHim) : '-'}</td>
            <td style="color: #16a34a; font-family: monospace;">${e.amountForHim > 0 ? formatCurrency(e.amountForHim) : '-'}</td>
            <td style="font-size: 11px; color: #64748b;">${e.notes || '-'}</td>
          </tr>
        `;
      });

      workersDetailedLedgersHtml += `
        <div style="margin-top: 25px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: bold; font-size: 14px;">👷 العامل: ${w.name}</span>
              <span style="font-size: 12px; color: #94a3b8; margin-right: 8px;">(${w.profession} - ${days} يوم عمل)</span>
            </div>
            <div style="font-size: 12px; font-weight: bold;">
              <span style="color: #f87171; margin-left: 8px;">عليه: ${formatCurrency(totalOnHim)}</span> | 
              <span style="color: #4ade80; margin-left: 8px;">له: ${formatCurrency(totalForHim)}</span> | 
              <span style="color: #60a5fa;">الصافي: ${net >= 0 ? formatCurrency(net) : `-${formatCurrency(Math.abs(net))}`}</span>
            </div>
          </div>
          <table style="margin: 0; width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 15%;">التاريخ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35%;">البيان / الحركة</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">عليه (سلف)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">له (أجور)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${w.ledger.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 10px;">لا توجد معاملات مسجلة لهذا العامل حالياً.</td></tr>' : ledgerRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    const grandNet = grandForHim - grandOnHim;

    const htmlContent = `
      <div class="header" style="text-align: center; margin-bottom: 20px;">
        <h1 class="title" style="font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">التقرير الشامل التفصيلي لحسابات العمال والمقاولين</h1>
        <div class="meta" style="font-size: 12px; color: #64748b;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
      </div>

      <div class="info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;">
        <div><strong>إجمالي عدد العمال:</strong> ${workers.length} عامل</div>
        <div><strong>إجمالي الأجور المستحقة (له):</strong> <span style="color: #16a34a; font-weight: bold;">${formatCurrency(grandForHim)}</span></div>
        <div><strong>إجمالي السلف والمسحوبات (عليه):</strong> <span style="color: #dc2626; font-weight: bold;">${formatCurrency(grandOnHim)}</span></div>
      </div>

      <!-- SECTION 1: OVERALL SUMMARY TABLE -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px;">
          أولاً: جدول ملخص حسابات وأرصدة جميع العمال
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              <th style="padding: 8px; border: 1px solid #334155;">الاسم</th>
              <th style="padding: 8px; border: 1px solid #334155;">المهنة</th>
              <th style="padding: 8px; border: 1px solid #334155;">فترة العمل</th>
              <th style="padding: 8px; border: 1px solid #334155; text-align: center;">الأيام</th>
              <th style="padding: 8px; border: 1px solid #334155;">إجمالي عليه (سلف)</th>
              <th style="padding: 8px; border: 1px solid #334155;">إجمالي له (أجور)</th>
              <th style="padding: 8px; border: 1px solid #334155;">صافي الرصيد</th>
            </tr>
          </thead>
          <tbody>
            ${workers.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 12px;">لا يوجد عمال مسجلين حالياً.</td></tr>' : workerSummaryRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">المجموع الكلي:</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #dc2626;">${formatCurrency(grandOnHim)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: #16a34a;">${formatCurrency(grandForHim)}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; color: ${grandNet >= 0 ? '#15803d' : '#b91c1c'};">
                ${grandNet >= 0 ? `له: ${formatCurrency(grandNet)}` : `عليه: ${formatCurrency(Math.abs(grandNet))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- SECTION 2: DETAILED LEDGER TABLES FOR ALL WORKERS -->
      <div style="margin-bottom: 25px;">
        <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
          ثانياً: كشوفات تفصيلية بكافة العمليات والحركات المالية لكل عامل
        </h3>
        ${workers.length === 0 ? '<p style="text-align: center; color: #94a3b8;">لا توجد بيانات تفصيلية.</p>' : workersDetailedLedgersHtml}
      </div>
    `;

    printPDF('التقرير الشامل للعمال ومستحقاتهم', htmlContent);
  };

  // Filter workers based on query
  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    w.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.phoneNumbers && w.phoneNumbers.some(p => p.includes(searchQuery)))
  );

  // Sorted workers list (Default: Oldest to Newest start date)
  const sortedWorkers = [...filteredWorkers].sort((a, b) => {
    const dateA = a.startDate || '';
    const dateB = b.startDate || '';
    const cmp = dateA.localeCompare(dateB);
    return workerSortOrder === 'asc' ? cmp : -cmp;
  });

  // Excel Column Filter State for Worker Ledger
  const [workerLedgerColumnFilters, setWorkerLedgerColumnFilters] = useState<Record<string, ActiveColumnFilter>>({});
  const [workerLedgerColumnSort, setWorkerLedgerColumnSort] = useState<ColumnSortState | null>(null);

  const handleWorkerLedgerFilterChange = (key: string, filter: ActiveColumnFilter | null) => {
    setWorkerLedgerColumnFilters(prev => {
      const next = { ...prev };
      if (!filter) {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  };

  const handleWorkerLedgerSortChange = (sort: ColumnSortState | null) => {
    setWorkerLedgerColumnSort(sort);
  };

  const handleClearWorkerLedgerFilters = () => {
    setWorkerLedgerColumnFilters({});
    setWorkerLedgerColumnSort(null);
  };

  const workerLedgerColumnConfigs: Record<string, ColumnFilterConfig<LedgerEntry>> = {
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
      title: 'مبلغ عليه (سلف)',
      sortType: 'number',
      getValue: (e) => e.amountOnHim,
      getDisplayValue: (val) => Number(val) > 0 ? formatCurrency(Number(val), currency || 'YER') : '-'
    },
    amountForHim: {
      key: 'amountForHim',
      title: 'مبلغ له (مستحقات)',
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

  // Base filtered worker ledger entries (matching top search, date, type filters)
  const baseFilteredLedger = useMemo(() => {
    if (!activeWorker) return [];
    return activeWorker.ledger.filter(entry => {
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
  }, [activeWorker, ledgerSearchTerm, ledgerStartDate, ledgerEndDate, ledgerTypeFilter]);

  // Filtered & Sorted active worker ledger entries (cascading with column filters)
  const filteredLedger = useMemo(() => {
    return baseFilteredLedger.filter(entry => {
      // Apply column filters
      for (const [colKey, filter] of Object.entries(workerLedgerColumnFilters) as [string, ActiveColumnFilter][]) {
        const config = workerLedgerColumnConfigs[colKey];
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
  }, [baseFilteredLedger, workerLedgerColumnFilters, workerLedgerColumnConfigs]);

  const sortedLedger = [...filteredLedger].sort((a, b) => {
    if (workerLedgerColumnSort) {
      const config = workerLedgerColumnConfigs[workerLedgerColumnSort.key];
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

        return workerLedgerColumnSort.direction === 'asc' ? comp : -comp;
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

  const hasActiveWorkerLedgerColumnFilters = Object.keys(workerLedgerColumnFilters).length > 0 || workerLedgerColumnSort !== null;

  const isLedgerFilterActive = Boolean(
    ledgerSearchTerm || ledgerStartDate || ledgerEndDate || ledgerTypeFilter !== 'all' || ledgerSortOption !== 'date-desc' || hasActiveWorkerLedgerColumnFilters
  );

  return (
    <div className="space-y-4 animate-fade-in" id="workers-section">
      
      {/* Dynamic view toggler */}
      {activeWorker ? (
        
        /* --------------------------------- DETAIL VIEW --------------------------------- */
        <div className="space-y-4 animate-fade-in" id="worker-details-pane">
          
          {/* Detail Header / Nav back */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-800">{activeWorker.name}</h2>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">{activeWorker.profession}</span>
                    <AttributionBadge createdBy={activeWorker.createdBy} updatedBy={activeWorker.updatedBy} />
                  </div>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-1.5">
                    <Calendar size={13} />
                    تاريخ العمل: {formatDateArabic(activeWorker.startDate)} إلى {activeWorker.endDate ? formatDateArabic(activeWorker.endDate) : 'الآن (مستمر)'}
                  </p>
                  <PhoneNumbersDisplay phoneNumbers={activeWorker.phoneNumbers} className="mt-2" />
                </div>
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
                  onClick={() => { setSelectedWorkerId(null); setLedgerError(''); }}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 w-full justify-center"
                  title="الرجوع لقائمة العمال"
                >
                  <ArrowLeft size={14} className="text-slate-700 shrink-0" />
                  <span>الرجوع لقائمة العمال</span>
                </button>

                <OptionsMenu 
                  onExportExcel={() => handleExportLedgerCSV(activeWorker)}
                  onExportPDF={() => handlePrintWorkerPDF(activeWorker)}
                  onImportExcel={sharedRole !== 'read' ? handleWorkerLedgerExcelImport : undefined}
                  shareTitle={`كشف حساب العامل: ${activeWorker.name}`}
                  shareText={(() => {
                    const days = getWorkerTotalDays(activeWorker, sharedRole === 'owner');
                    const totalOnHim = activeWorker.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = activeWorker.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    const status = net === 0 ? 'خالص' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`;

                    return `👷 كشف حساب العامل التفصيلي: ${activeWorker.name}\n🔨 المهنة: ${activeWorker.profession}\n📅 تاريخ العمل: من ${activeWorker.startDate} إلى ${activeWorker.endDate || 'الآن'}\n⏱️ أيام العمل المحتسبة: ${days} يوم\n\n💰 إجمالي الاستحقاقات (له): ${formatCurrency(totalForHim, currency)}\n💸 إجمالي السلف/المدفوعات (عليه): ${formatCurrency(totalOnHim, currency)}\n⚖️ الصافي المالي الحالي: ${status}\n\n*تم استخراجه ومشاركته من كشوفات المقاولات*`;
                  })()}
                />
              </div>
            </div>

            {/* Actions for active worker */}
            {(sharedRole !== 'read' || onTransferWorkerToEmployee) && (
              <div className="flex items-center gap-2.5 flex-wrap w-full pt-1">
                {sharedRole !== 'read' && (
                  <button 
                    onClick={() => setEditingWorker(activeWorker)}
                    className="h-9 px-3.5 bg-white hover:bg-amber-50 text-amber-800 font-bold text-xs border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    title="تعديل تاريخ البدء أو الانتهاء أو بيانات العامل"
                  >
                    <Pencil size={15} className="text-amber-600 shrink-0" />
                    <span>تعديل</span>
                  </button>
                )}

                {sharedRole !== 'read' && onTransferWorkerToEmployee && (
                  <button 
                    onClick={() => {
                      if (confirm(`هل ترغب بنقل كافة بيانات العامل "${activeWorker.name}" إلى نافذة الموظفين؟`)) {
                        onTransferWorkerToEmployee(activeWorker);
                      }
                    }}
                    className="h-9 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs border border-indigo-200 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    title="تحويل كشف العامل إلى قسم الموظفين براتب يومي"
                  >
                    <ArrowRightLeft size={15} className="text-indigo-600 shrink-0" />
                    <span>نقل إلى قسم الموظفين</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left Col: Basic Info Metrics & Add Transaction */}
            <div className="space-y-4">
              
              {/* Metrics Box */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b border-slate-50">
                  <Info size={16} className="text-sky-500" />
                  بيانات وحالة العمل
                </h3>
                
                {/* Days of work block */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-600 font-bold">عدد أيام العمل:</span>
                  <span className="font-black text-slate-800 text-sm bg-white border border-slate-200/80 px-3 py-1 rounded-lg shadow-2xs font-mono">
                    {getWorkerTotalDays(activeWorker, sharedRole === 'owner')} يوم عمل
                  </span>
                </div>

                {/* Work Periods List & Add Extra Period Inline Form */}
                <div className="pt-3 border-t border-slate-100 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">فترات العمل المسجلة:</span>
                    {sharedRole !== 'read' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowExtraForm(!showExtraForm);
                          setExtraFormError('');
                        }}
                        className="text-[10px] text-sky-600 hover:text-sky-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle size={12} />
                        إضافة فترة عمل إضافية
                      </button>
                    )}
                  </div>

                  {/* List of Periods */}
                  <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
                    {/* Main Period */}
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg text-[11px] text-slate-600 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        <span>الأساسية: {formatDateArabic(activeWorker.startDate)} إلى {activeWorker.endDate ? formatDateArabic(activeWorker.endDate) : 'الآن'}</span>
                      </div>
                      <span className="bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-800 font-bold font-mono">{calculateDaysOfWork(activeWorker.startDate, activeWorker.endDate, sharedRole === 'owner')} يوم</span>
                    </div>

                    {/* Extra Periods */}
                    {(activeWorker.extraPeriods || []).map((p, idx) => {
                      const pDays = calculateDaysOfWork(p.startDate, p.endDate);
                      return (
                        <div key={p.id} className="flex items-center justify-between bg-sky-50/50 p-2 rounded-lg text-[11px] text-slate-600 font-medium border border-sky-100/30">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>فترة {idx + 1}: {formatDateArabic(p.startDate)} إلى {formatDateArabic(p.endDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="bg-sky-100/60 text-sky-800 px-1.5 py-0.5 rounded font-bold">{pDays} يوم</span>
                            {sharedRole !== 'read' && sharedRole !== 'add' && (
                              <button
                                type="button"
                                onClick={() => onDeleteWorkerExtraPeriod?.(activeWorker.id, p.id)}
                                className="text-rose-500 hover:text-rose-600 cursor-pointer"
                                title="حذف هذه الفترة"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Extra Period Form */}
                  {showExtraForm && (
                    <form onSubmit={handleExtraPeriodSubmit} className="mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5 animate-fade-in text-right">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">تاريخ البدء</label>
                          <input
                            type="date"
                            value={extraStart}
                            onChange={(e) => setExtraStart(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 block">تاريخ الانتهاء</label>
                          <input
                            type="date"
                            value={extraEnd}
                            onChange={(e) => setExtraEnd(e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
                            required
                          />
                        </div>
                      </div>
                      {extraFormError && <p className="text-[10px] text-rose-500">{extraFormError}</p>}
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => { setShowExtraForm(false); setExtraFormError(''); }}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200/50 rounded-lg border border-slate-200 bg-white"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-[10px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
                        >
                          حفظ الفترة
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Ledger balances summary grouped by currency */}
                <div className="space-y-3 pt-2 border-t border-slate-50">
                  {['YER', 'SAR', 'USD'].map(cur => {
                    const totalOnHim = activeWorker.ledger.filter(e => (e.currency || 'YER') === cur).reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = activeWorker.ledger.filter(e => (e.currency || 'YER') === cur).reduce((sum, e) => sum + e.amountForHim, 0);
                    const balance = totalForHim - totalOnHim;
                    
                    if (totalOnHim === 0 && totalForHim === 0) return null;
                    
                    return (
                      <div key={cur} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 font-mono">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                          <span>العملة:</span>
                          <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">{cur}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>عليه (سلف):</span>
                          <span className="font-semibold text-rose-600">{formatCurrency(totalOnHim, cur)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>له (أجور):</span>
                          <span className="font-semibold text-emerald-600">{formatCurrency(totalForHim, cur)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold border-t border-slate-200/50 pt-1.5 mt-1">
                          <span>صافي الرصيد:</span>
                          <span className={balance < 0 ? 'text-rose-600' : balance > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                            {balance === 0 ? 'خالص' : balance > 0 ? `له: ${formatCurrency(balance, cur)}` : `عليه: ${formatCurrency(Math.abs(balance), cur)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {activeWorker.ledger.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2 animate-pulse">لا توجد حركات مالية مسجلة بعد</p>
                  )}
                </div>
              </div>

              {/* Nutrition Periods Card (بيانات التغذية) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Utensils size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">بيانات التغذية</h3>
                      <p className="text-[10px] text-slate-400">خاصة ببيانات وأسعار التغذية للعمال والمساعدين</p>
                    </div>
                  </div>
                  {sharedRole !== 'read' && (
                    <button
                      type="button"
                      onClick={handleOpenAddNutritionModal}
                      className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                      title="إضافة فترة تغذية جديدة"
                    >
                      <PlusCircle size={13} />
                      <span>+ فترة جديدة</span>
                    </button>
                  )}
                </div>

                {/* Nutrition Periods List */}
                {(!activeWorker.nutritionPeriods || activeWorker.nutritionPeriods.length === 0) ? (
                  <div className="text-center py-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-3 space-y-1.5">
                    <p className="text-xs text-slate-400">لا توجد فترات تغذية مسجلة لهذا العامل حالياً</p>
                    {sharedRole !== 'read' && (
                      <button
                        type="button"
                        onClick={handleOpenAddNutritionModal}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold underline inline-block cursor-pointer"
                      >
                        + إضافة التغذية
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                    {activeWorker.nutritionPeriods.map((period) => {
                      const days = calculateNutritionDays(period.startDate, period.endDate);
                      const total = period.dailyAmount * days;
                      const isOpen = !period.endDate;

                      return (
                        <div key={period.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 relative transition-all hover:border-emerald-200">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-xs">{period.workerName}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1 ${
                                isOpen 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-sky-100 text-sky-800 border border-sky-200'
                              }`}>
                                {isOpen ? '🟢 مستمرة' : '🔵 مكتملة'}
                              </span>
                            </div>

                            {sharedRole !== 'read' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditNutritionModal(period)}
                                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل بيانات التغذية"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const confirmText = `هل أنت متأكد من حذف فترة التغذية الخاصة بـ "${period.workerName}"؟`;
                                    if (typeof window === 'undefined' || !window.confirm || window.confirm(confirmText)) {
                                      onDeleteWorkerNutritionPeriod?.(activeWorker.id, period.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف فترة التغذية"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                            <div>
                              <span className="text-slate-400 block text-[10px]">مبلغ التغذية اليومية:</span>
                              <span className="font-bold text-slate-700">{formatCurrency(period.dailyAmount, currency)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">عدد أيام التغذية:</span>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{days} يوم</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60">
                            <span className="text-slate-400 text-[10px]">
                              {formatDateArabic(period.startDate)} {period.endDate ? `إلى ${formatDateArabic(period.endDate)}` : 'إلى الآن (مستمر)'}
                            </span>
                            <div className="text-left font-mono">
                              <span className="text-[10px] text-slate-400 block">إجمالي التغذية:</span>
                              <span className="font-black text-rose-600 text-xs">{formatCurrency(total, currency)}</span>
                            </div>
                          </div>

                          {period.notes && (
                            <p className="text-[10px] text-slate-500 italic bg-white/60 p-1.5 rounded border border-slate-100">
                              📝 {period.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Transaction Form */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setShowAddLedgerForm(!showAddLedgerForm)}
                  className="w-full font-bold text-slate-800 text-sm flex items-center justify-between hover:text-sky-600 transition-colors cursor-pointer text-right py-1"
                >
                  <div className="flex items-center gap-2">
                    <PlusCircle size={18} className="text-sky-500" />
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
                        className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500"
                        required
                      />
                    </div>

                    {/* Amounts row & Currency selector */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 block text-rose-600 truncate">مبلغ عليه</label>
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
                        <label className="text-[10px] font-bold text-slate-500 block text-emerald-600 truncate">مبلغ له</label>
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
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500 cursor-pointer"
                        >
                          <option value="YER">YER</option>
                          <option value="SAR">SAR</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>

                    {/* Statement */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">البيان (نوع الحركة)</label>
                      <input 
                        type="text"
                        placeholder="مثال: سلفة أسبوعية / أجر شهر حزيران"
                        value={ledgerDescription}
                        onChange={(e) => setLedgerDescription(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500"
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">ملاحظات إضافية</label>
                      <textarea 
                        placeholder="أي ملاحظات حول العملية..."
                        value={ledgerNotes}
                        onChange={(e) => setLedgerNotes(e.target.value)}
                        rows={2}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500 resize-none"
                      />
                    </div>

                    {ledgerError && (
                      <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg">{ledgerError}</p>
                    )}

                    <button 
                      type="submit"
                      className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      حفظ في كشف الحساب
                    </button>
                  </form>
                )}
              </div>

            </div>

            {/* Right Col: Ledger Transactions Log Table */}
            <div className="lg:col-span-2 space-y-3">
              {/* Ledger Filters Card */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-xs transition-all" id="worker-ledger-filters">
                <button
                  type="button"
                  onClick={() => setIsLedgerFiltersOpen(!isLedgerFiltersOpen)}
                  className="w-full flex items-center justify-between text-right font-bold text-slate-700 text-xs sm:text-sm hover:text-slate-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-sky-500" />
                    <span>أدوات البحث والتصفية (سجل الكشوفات والحركات التفصيلي)</span>
                    {isLedgerFilterActive && (
                      <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
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
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-sky-500 transition-colors"
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
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500"
                        />
                      </div>

                      {/* End Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">إلى:</span>
                        <input 
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-sky-500"
                        />
                      </div>

                      {/* Sort Order Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">الترتيب:</span>
                        <select
                          value={ledgerSortOption}
                          onChange={(e) => setLedgerSortOption(e.target.value as any)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-sky-500 cursor-pointer"
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
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-sky-500 cursor-pointer"
                        >
                          <option value="all">كافة الحركات المالية (له وعليه)</option>
                          <option value="onHim">مبالغ عليه فقط (سلف / مسحوبات)</option>
                          <option value="forHim">مبالغ له فقط (أجور / مستحقات)</option>
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
                          className="text-[11px] text-sky-600 hover:text-sky-800 hover:underline font-bold cursor-pointer"
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
                    <h3 className="font-bold text-slate-800 text-sm">سجل الكشوفات والحركات التفصيلي</h3>
                    {hasActiveWorkerLedgerColumnFilters && (
                      <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 text-sky-800 px-2 py-0.5 rounded-lg text-xs font-bold">
                        <Filter size={12} className="fill-current text-sky-600" />
                        <span>تصفية مخصصة للأعمدة</span>
                        <button
                          type="button"
                          onClick={handleClearWorkerLedgerFilters}
                          className="text-[10px] text-sky-600 hover:text-sky-800 hover:underline mr-1 cursor-pointer font-bold"
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
                      <p className="text-slate-400 text-sm font-medium">كشف الحساب فارغ حالياً</p>
                      <p className="text-xs text-slate-300">قم بإضافة حركة مالية جديدة أو ترحيل النفقات لهذا العامل</p>
                    </div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>التاريخ</span>
                              <ExcelColumnFilter
                                config={workerLedgerColumnConfigs.date}
                                data={baseFilteredLedger}
                                allColumnFilters={workerLedgerColumnFilters}
                                allConfigs={workerLedgerColumnConfigs}
                                activeFilter={workerLedgerColumnFilters.date}
                                onFilterChange={handleWorkerLedgerFilterChange}
                                activeSort={workerLedgerColumnSort}
                                onSortChange={handleWorkerLedgerSortChange}
                                accentColor="sky"
                              />
                            </div>
                          </th>
                          <th className="p-3 min-w-[280px] sm:min-w-[360px] w-2/5">
                            <div className="flex items-center justify-between gap-1">
                              <span>البيان</span>
                              <ExcelColumnFilter
                                config={workerLedgerColumnConfigs.description}
                                data={baseFilteredLedger}
                                allColumnFilters={workerLedgerColumnFilters}
                                allConfigs={workerLedgerColumnConfigs}
                                activeFilter={workerLedgerColumnFilters.description}
                                onFilterChange={handleWorkerLedgerFilterChange}
                                activeSort={workerLedgerColumnSort}
                                onSortChange={handleWorkerLedgerSortChange}
                                accentColor="sky"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-rose-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>مبلغ عليه (سلف)</span>
                              <ExcelColumnFilter
                                config={workerLedgerColumnConfigs.amountOnHim}
                                data={baseFilteredLedger}
                                allColumnFilters={workerLedgerColumnFilters}
                                allConfigs={workerLedgerColumnConfigs}
                                activeFilter={workerLedgerColumnFilters.amountOnHim}
                                onFilterChange={handleWorkerLedgerFilterChange}
                                activeSort={workerLedgerColumnSort}
                                onSortChange={handleWorkerLedgerSortChange}
                                accentColor="rose"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-emerald-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>مبلغ له (مستحقات)</span>
                              <ExcelColumnFilter
                                config={workerLedgerColumnConfigs.amountForHim}
                                data={baseFilteredLedger}
                                allColumnFilters={workerLedgerColumnFilters}
                                allConfigs={workerLedgerColumnConfigs}
                                activeFilter={workerLedgerColumnFilters.amountForHim}
                                onFilterChange={handleWorkerLedgerFilterChange}
                                activeSort={workerLedgerColumnSort}
                                onSortChange={handleWorkerLedgerSortChange}
                                accentColor="emerald"
                              />
                            </div>
                          </th>
                          <th className="p-3">
                            <div className="flex items-center justify-between gap-1">
                              <span>ملاحظات</span>
                              <ExcelColumnFilter
                                config={workerLedgerColumnConfigs.notes}
                                data={baseFilteredLedger}
                                allColumnFilters={workerLedgerColumnFilters}
                                allConfigs={workerLedgerColumnConfigs}
                                activeFilter={workerLedgerColumnFilters.notes}
                                onFilterChange={handleWorkerLedgerFilterChange}
                                activeSort={workerLedgerColumnSort}
                                onSortChange={handleWorkerLedgerSortChange}
                                accentColor="sky"
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
                            <td className="p-3 font-semibold text-slate-800 min-w-[280px] sm:min-w-[360px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{cleanLedgerDescription(e.description)}</span>
                                {e.isPosted && (
                                  <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-bold px-1.5 py-0.5 rounded-sm">
                                    مرحلة تلقائياً من النفقات اليومية
                                  </span>
                                )}
                                <AttributionBadge createdBy={e.createdBy} />
                              </div>
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
                                    setEditingWorkerLedger({ workerId: activeWorker.id, entry: e });
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
                                    if (confirm('هل أنت متأكد من حذف هذه الحركة؟ (سيتم تحديث النفقات اليومية تلقائياً إذا كانت مرحلة)')) {
                                      onDeleteWorkerLedgerEntry(activeWorker.id, e.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-sm cursor-pointer"
                                  title="حذف القيد"
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
        
        /* --------------------------------- DIRECTORY LIST VIEW --------------------------------- */
        <div className="space-y-6 animate-fade-in" id="workers-list-pane">
          
          {/* Header Row */}
          <PageHeaderCard
            title="سجل عمال المشروع وحساب الأجور"
            description="إدارة العمال وتتبع أجورهم اليومية، السلفيات والخصومات مع استخراج كشوفات تفصيلية."
            icon={<Users size={20} />}
            onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
            optionsMenu={
              <OptionsMenu 
                onExportExcel={handleExportAllCSV}
                onExportPDF={handlePrintAllWorkersPDF}
                onImportExcel={sharedRole !== 'read' ? handleExcelImport : undefined}
                shareTitle="التقرير المالي العام لعمال الموقع"
                shareText={(() => {
                  const workersSummary = workers.map(w => {
                    const days = getWorkerTotalDays(w, sharedRole === 'owner');
                    const totalOnHim = w.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = w.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    const status = net === 0 ? 'خالص' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`;
                    return `- ${w.name} (${w.profession}): ${status} [${days} يوم عمل]`;
                  }).join('\n');

                  return `👷 التقرير المالي العام لعمال الموقع\n📅 تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}\n\n📊 ملخص مستحقات العمال:\n${workers.length === 0 ? 'لا يوجد عمال مسجلين حالياً.' : workersSummary}\n\n*تم توليده ومشاركته من كشوفات المقاولات*`;
                })()}
              />
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Column 1: Add Worker Form Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs h-fit" id="add-worker-form-container">
              {sharedRole === 'read' ? (
                <div className="text-center py-8 space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <User size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">وضع عرض الحساب المشترك</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    تمت دعوتك بصلاحية (عرض فقط). لا يمكنك إضافة عمال جدد أو تسجيل حركات مالية في هذا الكشف.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAddWorkerForm(!showAddWorkerForm)}
                    className="w-full font-bold text-slate-800 flex items-center justify-between text-base cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus size={18} className="text-sky-500" />
                      <span>إضافة عامل جديد للموقع</span>
                    </div>
                    <span className={`text-xs px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all ${
                      showAddWorkerForm 
                        ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                        : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                    }`}>
                      {showAddWorkerForm ? 'إخفاء البيانات ▲' : '+ إضافة عامل جديد ▼'}
                    </span>
                  </button>

                  {showAddWorkerForm && (
                    <div className="pt-4 mt-3 border-t border-slate-100 animate-slide-up">
                      <form onSubmit={handleAddWorkerSubmit} className="space-y-4">
                        
                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">الاسم الكامل</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={newWorkerName}
                              onChange={(e) => setNewWorkerName(e.target.value)}
                              placeholder="مثال: علي جاسم محمد"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 transition-colors pr-9"
                              required
                            />
                            <User size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Profession */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">المهنة / الصفة</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={newWorkerProfession}
                              onChange={(e) => setNewWorkerProfession(e.target.value)}
                              placeholder="مثال: خلفة بناء / نجار مسلح / عامل يومي"
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 transition-colors pr-9"
                              required
                            />
                            <Hammer size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* Phone Number(s) */}
                        <PhoneNumbersInput 
                          phoneNumbers={newWorkerPhoneNumbers} 
                          onChange={setNewWorkerPhoneNumbers} 
                        />

                        {/* Start Date */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">تاريخ مباشرة العمل</label>
                          <div className="relative">
                            <input 
                              type="date" 
                              value={newWorkerStartDate}
                              onChange={(e) => setNewWorkerStartDate(e.target.value)}
                              className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 transition-colors pr-9"
                              required
                            />
                            <Calendar size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        {/* End Date */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">تاريخ انتهاء التعاقد / العمل (اختياري)</label>
                          <div className="relative">
                            <input 
                              type="date" 
                              value={newWorkerEndDate}
                              onChange={(e) => setNewWorkerEndDate(e.target.value)}
                              className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 transition-colors pr-9"
                            />
                            <Calendar size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
                          </div>
                          <span className="text-[10px] text-slate-400">يمكن تركه فارغاً إذا كان العامل مستمراً بالعمل حالياً.</span>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                          <textarea 
                            value={newWorkerNotes}
                            onChange={(e) => setNewWorkerNotes(e.target.value)}
                            placeholder="أي ملاحظات تفصيلية عن العامل أو الاتفاق..."
                            rows={2}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-sky-500 transition-colors resize-none"
                          />
                        </div>

                        {/* Alerts */}
                        {workerError && (
                          <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">{workerError}</p>
                        )}

                        {/* Dynamic Work Days Box */}
                        {newWorkerStartDate && (
                          <div className="space-y-2">
                            <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between text-xs text-slate-600">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Clock size={14} className="text-sky-500" />
                                المدة الإجمالية:
                              </span>
                              <span className="font-bold text-sky-700 text-sm">
                                {calculateDaysOfWork(newWorkerStartDate, newWorkerEndDate, sharedRole === 'owner')} {newWorkerEndDate ? 'يوم عمل' : 'يوم عمل حتى الآن'}
                              </span>
                            </div>

                            <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-xl space-y-1.5 text-right">
                              <span className="text-[11px] text-violet-700 font-bold block">عدد أيام العمل الفعلية (مربع نص تلقائي):</span>
                              <input
                                type="text"
                                readOnly
                                value={sharedRole === 'owner' ? `${calculateActualDaysOfWork(newWorkerStartDate, newWorkerEndDate, true)} يوم عمل فعلي` : 'غير متاح لحسابات المشاركة'}
                                className="w-full text-center p-2 bg-white border border-violet-200 rounded-xl text-violet-800 text-xs font-extrabold focus:outline-hidden"
                              />
                            </div>
                          </div>
                        )}

                        <button 
                          type="submit"
                          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PlusCircle size={18} />
                          تسجيل العامل
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Column 2 & 3: Workers list table */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Search Card & Sort Filter */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن عامل بالاسم أو المهنة..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-sky-500 transition-colors"
                  />
                  <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                </div>
                
                {/* Workers Sort Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shrink-0 w-full sm:w-auto">
                  <span className="text-slate-400 font-medium">الترتيب:</span>
                  <select
                    value={workerSortOrder}
                    onChange={(e) => setWorkerSortOrder(e.target.value as 'asc' | 'desc')}
                    className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="desc">تاريخ البدء: الأحدث أولاً ⬇️ (افتراضي)</option>
                    <option value="asc">تاريخ البدء: الأقدم أولاً ⬆️</option>
                  </select>
                </div>
              </div>

              {/* Workers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedWorkers.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-xs md:col-span-2">
                    <p className="text-slate-400 text-sm font-medium">لا يوجد عمال يطابقون البحث</p>
                    <p className="text-xs text-slate-300 mt-1">أدخل عمالاً جدداً للبدء</p>
                  </div>
                ) : (
                  sortedWorkers.map(w => {
                    const days = getWorkerTotalDays(w, sharedRole === 'owner');
                    const totalOnHim = w.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = w.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    
                    return (
                      <div 
                        key={w.id} 
                        className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 hover:border-sky-200 transition-all flex flex-col justify-between group relative"
                        id={`worker-card-${w.id}`}
                      >
                        {/* Header card */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-800 text-base">{w.name}</h4>
                                <AttributionBadge createdBy={w.createdBy} updatedBy={w.updatedBy} />
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{w.profession}</p>
                            </div>
                            <span className="text-[10px] bg-slate-50 text-slate-500 font-bold px-2 py-0.5 rounded-full border border-slate-100">
                              {days} يوم
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{formatDateArabic(w.startDate)} ⇠ {w.endDate ? formatDateArabic(w.endDate) : 'الآن (مستمر)'}</span>
                          </div>

                          <PhoneNumbersDisplay phoneNumbers={w.phoneNumbers} className="pt-1" />

                          {w.notes && (
                            <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded-lg text-right font-medium">
                              <span className="font-bold text-slate-400 text-[10px] block mb-0.5">ملاحظات:</span>
                              {w.notes}
                            </div>
                          )}
                        </div>

                        {/* Balances per currency */}
                        {(() => {
                          const workerBalances = w.ledger.reduce((acc, entry) => {
                            const cur = entry.currency || 'YER';
                            if (!acc[cur]) acc[cur] = { onHim: 0, forHim: 0 };
                            acc[cur].onHim += entry.amountOnHim || 0;
                            acc[cur].forHim += entry.amountForHim || 0;
                            return acc;
                          }, {} as Record<string, { onHim: number; forHim: number }>);

                          return (
                            <div className="mt-4 pt-4 border-t border-slate-50 space-y-1.5 text-xs text-right">
                              <span className="text-slate-400 block text-[10px] font-bold">حسابات المستحقات بالعملة:</span>
                              {Object.keys(workerBalances).length === 0 ? (
                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                                  <span>YER</span>
                                  <span className="font-bold text-slate-400">خالص الطرفين</span>
                                </div>
                              ) : (
                                Object.entries(workerBalances).map(([cur, b]) => {
                                  const netVal = b.forHim - b.onHim;
                                  return (
                                    <div key={cur} className="flex justify-between items-center border-b border-dashed border-slate-100 last:border-0 pb-1 last:pb-0 font-mono text-[11px]">
                                      <span className="text-slate-500 font-bold">{cur}</span>
                                      <span className={netVal < 0 ? 'text-rose-600 font-extrabold' : netVal > 0 ? 'text-emerald-600 font-extrabold' : 'text-slate-400'}>
                                        {netVal === 0 ? 'خالص' : netVal > 0 ? `له: ${formatCurrency(netVal, cur)}` : `عليه: ${formatCurrency(Math.abs(netVal), cur)}`}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })()}

                        {/* Action section footer */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                          <span className="text-xs font-bold text-slate-400">كشف الحساب الخاص:</span>
                          
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setSelectedWorkerId(w.id)}
                              className="bg-slate-50 hover:bg-sky-50 text-sky-600 font-bold text-xs py-1.5 px-3 rounded-lg border border-slate-200 group-hover:border-sky-200 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              عرض الكشف
                              <ChevronLeft size={14} className="rotate-180" />
                            </button>
                            {sharedRole !== 'read' && (
                              <button 
                                onClick={() => setEditingWorker(w)}
                                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات وتواريخ العامل"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {sharedRole !== 'read' && onTransferWorkerToEmployee && (
                              <button 
                                onClick={() => {
                                  if (confirm(`هل ترغب بنقل العامل "${w.name}" إلى نافذة الموظفين؟`)) {
                                    onTransferWorkerToEmployee(w);
                                  }
                                }}
                                className="p-1.5 hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 rounded-lg transition-colors cursor-pointer"
                                title="نقل إلى قسم الموظفين"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                            )}
                            {sharedRole !== 'read' && sharedRole !== 'add' && (
                              <button 
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف العامل ${w.name}؟ سيتم حذف كافة سجلات كشف حسابه تلقائياً.`)) {
                                    onDeleteWorker(w.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="حذف العامل"
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

      {/* Edit Worker Modal */}
      {editingWorker && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل بيانات العامل</h3>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditWorkerSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">اسم العامل</label>
                  <input 
                    type="text" 
                    value={editingWorker.name}
                    onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">المهنة / التخصص</label>
                  <input 
                    type="text" 
                    value={editingWorker.profession}
                    onChange={(e) => setEditingWorker({ ...editingWorker, profession: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>

                <PhoneNumbersInput 
                  phoneNumbers={editingWorker.phoneNumbers || ['']} 
                  onChange={(phones) => setEditingWorker({ ...editingWorker, phoneNumbers: phones })} 
                />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تاريخ بدء العمل</label>
                  <input 
                    type="date" 
                    value={editingWorker.startDate}
                    onChange={(e) => setEditingWorker({ ...editingWorker, startDate: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تاريخ الانتهاء (اختياري)</label>
                  <input 
                    type="date" 
                    value={editingWorker.endDate || ''}
                    onChange={(e) => setEditingWorker({ ...editingWorker, endDate: e.target.value })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                  <textarea 
                    value={editingWorker.notes || ''}
                    onChange={(e) => setEditingWorker({ ...editingWorker, notes: e.target.value })}
                    rows={2}
                    placeholder="أي ملاحظات..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-sky-500 resize-none"
                  />
                </div>

                {editingWorker.startDate && (
                  <div className="space-y-2">
                    <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Clock size={14} className="text-sky-500" />
                        المدة الإجمالية:
                      </span>
                      <span className="font-bold text-sky-700 text-sm">
                        {calculateDaysOfWork(editingWorker.startDate, editingWorker.endDate, sharedRole === 'owner')} {editingWorker.endDate ? 'يوم عمل' : 'يوم عمل حتى الآن'}
                      </span>
                    </div>

                    <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-xl space-y-1.5 text-right">
                      <span className="text-[11px] text-violet-700 font-bold block">عدد أيام العمل الفعلية (مربع نص تلقائي):</span>
                      <input
                        type="text"
                        readOnly
                        value={sharedRole === 'owner' ? `${calculateActualDaysOfWork(editingWorker.startDate, editingWorker.endDate, true)} يوم عمل فعلي` : 'غير متاح لحسابات المشاركة'}
                        className="w-full text-center p-2 bg-white border border-violet-200 rounded-xl text-violet-800 text-xs font-extrabold focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingWorker(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Worker Ledger Entry Modal */}
      {editingWorkerLedger && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل قيد كشف الحساب</h3>
              <button
                type="button"
                onClick={() => setEditingWorkerLedger(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditWorkerLedgerSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <input 
                    type="date" 
                    value={editingWorkerLedger.entry.date}
                    onChange={(e) => setEditingWorkerLedger({
                      ...editingWorkerLedger,
                      entry: { ...editingWorkerLedger.entry, date: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">مبلغ عليه (سلف / دفعات)</label>
                    <input 
                      type="number" 
                      value={editingWorkerLedger.entry.amountOnHim || ''}
                      onChange={(e) => setEditingWorkerLedger({
                        ...editingWorkerLedger,
                        entry: { ...editingWorkerLedger.entry, amountOnHim: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 font-mono text-left"
                      placeholder="0"
                    />
                    <AmountInWords amount={editingWorkerLedger.entry.amountOnHim} currency={editingWorkerLedger.entry.currency || 'YER'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">مبلغ له (مستحقات / أجر)</label>
                    <input 
                      type="number" 
                      value={editingWorkerLedger.entry.amountForHim || ''}
                      onChange={(e) => setEditingWorkerLedger({
                        ...editingWorkerLedger,
                        entry: { ...editingWorkerLedger.entry, amountForHim: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 font-mono text-left"
                      placeholder="0"
                    />
                    <AmountInWords amount={editingWorkerLedger.entry.amountForHim} currency={editingWorkerLedger.entry.currency || 'YER'} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">العملة</label>
                  <select 
                    value={editingWorkerLedger.entry.currency || 'YER'}
                    onChange={(e) => setEditingWorkerLedger({
                      ...editingWorkerLedger,
                      entry: { ...editingWorkerLedger.entry, currency: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 cursor-pointer"
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
                    value={editingWorkerLedger.entry.description}
                    onChange={(e) => setEditingWorkerLedger({
                      ...editingWorkerLedger,
                      entry: { ...editingWorkerLedger.entry, description: e.target.value }
                    })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <textarea 
                    value={editingWorkerLedger.entry.notes || ''}
                    onChange={(e) => setEditingWorkerLedger({
                      ...editingWorkerLedger,
                      entry: { ...editingWorkerLedger.entry, notes: e.target.value }
                    })}
                    rows={2}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-sky-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingWorkerLedger(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nutrition Modal "بيانات التغذية" */}
      {showNutritionModal && activeWorker && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden my-auto animate-scale-up overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Utensils size={20} className="text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">بيانات التغذية</h3>
                  <p className="text-xs text-emerald-100">للعامل الرئيسي أو العمال المساعدين التابعين له</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowNutritionModal(false)}
                className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleNutritionSubmit} className="p-4 sm:p-5 space-y-4">
              
              {/* Worker Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  اسم العمال / المساعد <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text"
                  value={nutrWorkerName}
                  onChange={(e) => setNutrWorkerName(e.target.value)}
                  placeholder="أدخل اسم العامل الرئيسي أو المساعد"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
                  required
                />
              </div>

              {/* Daily Amount */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  مبلغ التغذية اليومية للعامل ({currency}) <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-1.5 items-center">
                  <input 
                    type="number"
                    value={nutrDailyAmount}
                    onChange={(e) => setNutrDailyAmount(e.target.value)}
                    placeholder="مثال: 5000"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-mono font-bold focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all min-w-0"
                    required
                  />
                  <Calculator onApply={(val) => setNutrDailyAmount(String(val))} buttonTitle="حسابة المبلغ اليومي" />
                </div>
                <AmountInWords amount={nutrDailyAmount} currency={currency} />
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    تاريخ البدء <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    value={nutrStartDate}
                    onChange={(e) => setNutrStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    تاريخ الانتهاء <span className="text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <input 
                    type="date"
                    value={nutrEndDate}
                    onChange={(e) => setNutrEndDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
                  />
                  <span className="text-[10px] text-slate-400 block">* اتركه فارغاً إذا كانت الفترة مستمرة.</span>
                </div>
              </div>

              {/* Dynamic Real-Time Calculation Box */}
              {(() => {
                const calcDays = calculateNutritionDays(nutrStartDate, nutrEndDate);
                const dailyVal = parseFloat(nutrDailyAmount) || 0;
                const calcTotal = dailyVal * calcDays;
                const isOngoing = !nutrEndDate;

                return (
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-900">حالة فترة التغذية:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        isOngoing 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-sky-100 text-sky-800 border border-sky-300'
                      }`}>
                        {isOngoing ? '🟢 مستمرة (غير محددة بنهاية)' : '🔵 مكتملة'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200/50">
                      <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                        <span className="text-[10px] text-slate-500 block">عدد أيام التغذية:</span>
                        <span className="font-black text-emerald-800 text-sm">{calcDays} يوم</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-emerald-100 text-center">
                        <span className="text-[10px] text-slate-500 block">إجمالي التغذية المحتسب:</span>
                        <span className="font-black text-rose-600 text-sm">{formatCurrency(calcTotal, currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">ملاحظات</label>
                <textarea 
                  value={nutrNotes}
                  onChange={(e) => setNutrNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية حول التغذية..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white resize-none"
                />
              </div>

              {nutrFormError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">{nutrFormError}</p>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                {editingNutritionPeriod && sharedRole !== 'read' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const confirmText = `هل أنت متأكد من حذف فترة التغذية الخاصة بـ "${editingNutritionPeriod.workerName}"؟`;
                      if (typeof window === 'undefined' || !window.confirm || window.confirm(confirmText)) {
                        onDeleteWorkerNutritionPeriod?.(activeWorker.id, editingNutritionPeriod.id);
                        setShowNutritionModal(false);
                      }
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>حذف الفترة</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNutritionModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Utensils size={14} />
                    <span>{editingNutritionPeriod ? 'حفظ التعديلات' : 'إضافة التغذية وحفظ الكشف'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
