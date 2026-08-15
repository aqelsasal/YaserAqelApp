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
  Briefcase, 
  ChevronLeft, 
  ArrowLeft, 
  ArrowRight,
  Coins, 
  Receipt,
  User,
  Clock,
  Search,
  Filter,
  Info,
  Pencil,
  DollarSign,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp
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
  Employee, 
  LedgerEntry, 
  calculateDaysOfWork, 
  calculateActualDaysOfWork,
  formatCurrency, 
  formatDateArabic,
  cleanLedgerDescription,
  exportToCSV,
  exportMultiSheetXLSX,
  printPDF
} from '../types';

interface EmployeesProps {
  employees: Employee[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'ledger'>) => void;
  onDeleteEmployee: (id: string) => void;
  onUpdateEmployee?: (id: string, updatedData: Omit<Employee, 'id' | 'ledger' | 'createdBy'>) => void;
  onAddEmployeeLedgerEntry: (employeeId: string, entry: Omit<LedgerEntry, 'id'>) => void;
  onDeleteEmployeeLedgerEntry: (employeeId: string, entryId: string) => void;
  onUpdateEmployeeLedgerEntry?: (employeeId: string, entryId: string, updatedEntry: Omit<LedgerEntry, 'id' | 'createdBy'>) => void;
  onAddEmployeeExtraPeriod?: (employeeId: string, startDate: string, endDate: string) => void;
  onDeleteEmployeeExtraPeriod?: (employeeId: string, periodId: string) => void;
  onTransferEmployeeToWorker?: (employee: Employee) => void;
  setActiveTab?: (tab: string) => void;
  currency?: string;
  sharedRole?: 'owner' | 'read' | 'add' | 'full';
}

export const getEmployeeTotalDays = (e: Employee, isOwner: boolean = true) => {
  const mainDays = calculateDaysOfWork(e.startDate, e.endDate, isOwner);
  const extraDays = (e.extraPeriods || []).reduce((sum, p) => sum + calculateDaysOfWork(p.startDate, p.endDate, isOwner), 0);
  return mainDays + extraDays;
};

export const getEmployeeActualDays = (e: Employee, isOwner: boolean = true) => {
  const mainActualDays = calculateActualDaysOfWork(e.startDate, e.endDate, isOwner);
  const extraActualDays = (e.extraPeriods || []).reduce((sum, p) => sum + calculateActualDaysOfWork(p.startDate, p.endDate, isOwner), 0);
  return mainActualDays + extraActualDays;
};

export default function Employees({
  employees,
  onAddEmployee,
  onDeleteEmployee,
  onUpdateEmployee,
  onAddEmployeeLedgerEntry,
  onDeleteEmployeeLedgerEntry,
  onUpdateEmployeeLedgerEntry,
  onAddEmployeeExtraPeriod,
  onDeleteEmployeeExtraPeriod,
  onTransferEmployeeToWorker,
  setActiveTab,
  currency = 'YER',
  sharedRole = 'owner'
}: EmployeesProps) {
  
  // Selection & Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Edit states
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingEmployeeLedger, setEditingEmployeeLedger] = useState<{ employeeId: string; entry: LedgerEntry } | null>(null);

  // Lock background scroll when modal is open
  useBodyScrollLock(Boolean(editingEmployee || editingEmployeeLedger));

  // Add Employee form
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeProfession, setNewEmployeeProfession] = useState('');
  const [newEmployeeStartDate, setNewEmployeeStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newEmployeeEndDate, setNewEmployeeEndDate] = useState('');
  const [newEmployeeDailyWage, setNewEmployeeDailyWage] = useState('');
  const [newEmployeePhoneNumbers, setNewEmployeePhoneNumbers] = useState<string[]>(['']);
  const [newEmployeeNotes, setNewEmployeeNotes] = useState('');

  // Extra Work Period form states
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraStart, setExtraStart] = useState('');
  const [extraEnd, setExtraEnd] = useState('');
  const [extraFormError, setExtraFormError] = useState('');

  // Add Employee Ledger Entry form
  const [ledgerDate, setLedgerDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [ledgerAmountOnHim, setLedgerAmountOnHim] = useState(''); // عليه (سلفة / دفعة)
  const [ledgerAmountForHim, setLedgerAmountForHim] = useState(''); // له (إضافة / مكافأة)
  const [ledgerDescription, setLedgerDescription] = useState('');
  const [ledgerNotes, setLedgerNotes] = useState('');
  const [ledgerCurrency, setLedgerCurrency] = useState(currency);
  const [showAddLedgerForm, setShowAddLedgerForm] = useState(false);

  // Search filter & sort filters
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeSortOrder, setEmployeeSortOrder] = useState<'asc' | 'desc'>('desc'); // Default desc: newest first
  
  // Ledger filters state
  const [isLedgerFiltersOpen, setIsLedgerFiltersOpen] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'onHim' | 'forHim'>('all');
  const [ledgerSortOption, setLedgerSortOption] = useState<'date-desc' | 'date-asc' | 'desc-alpha' | 'amountOnHim-desc' | 'amountForHim-desc'>('date-desc');

  // Error/Success alerts
  const [employeeError, setEmployeeError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  useEffect(() => {
    setLedgerCurrency(currency);
  }, [currency]);

  // Automated daily wage calculation effect for employees
  useEffect(() => {
    if (!onUpdateEmployeeLedgerEntry || !onAddEmployeeLedgerEntry) return;

    employees.forEach(emp => {
      if (!emp.startDate) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const effectiveEndDate = emp.endDate ? emp.endDate : todayStr;

      const totalDays = getEmployeeTotalDays(emp, sharedRole === 'owner');
      const hasDailyWage = (emp.dailyWage || 0) > 0;
      const calculatedWage = hasDailyWage ? totalDays * emp.dailyWage : 0;

      const startDateFormatted = formatDateArabic(emp.startDate);
      const endDateFormatted = emp.endDate ? formatDateArabic(emp.endDate) : formatDateArabic(effectiveEndDate);
      const autoDescription = `مجموع أجور العمل لعدد (${totalDays}) أيام وذلك للفترة من (${startDateFormatted}) إلى (${endDateFormatted})`;

      // Find existing auto daily wage entry in employee's ledger
      const existingAutoEntry = emp.ledger.find(
        entry => entry.isAutoDailyWage || entry.id === `auto_wage_${emp.id}` || entry.id.startsWith(`auto_wage_`)
      );

      if (hasDailyWage) {
        if (existingAutoEntry) {
          // Update existing auto entry if amount, description, or date has changed
          if (
            existingAutoEntry.amountForHim !== calculatedWage ||
            existingAutoEntry.description !== autoDescription ||
            existingAutoEntry.date !== effectiveEndDate
          ) {
            onUpdateEmployeeLedgerEntry(emp.id, existingAutoEntry.id, {
              date: effectiveEndDate,
              amountOnHim: existingAutoEntry.amountOnHim || 0,
              amountForHim: calculatedWage,
              description: autoDescription,
              notes: 'تم الاحتساب والتحديث تلقائياً بناءً على الأجر اليومي وعدد أيام العمل',
              isAutoDailyWage: true,
              currency: existingAutoEntry.currency || currency || 'YER'
            });
          }
        } else {
          // Create new single auto daily wage entry
          onAddEmployeeLedgerEntry(emp.id, {
            date: effectiveEndDate,
            amountOnHim: 0,
            amountForHim: calculatedWage,
            description: autoDescription,
            notes: 'تم الاحتساب والتحديث تلقائياً بناءً على الأجر اليومي وعدد أيام العمل',
            isAutoDailyWage: true,
            currency: currency || 'YER'
          });
        }
      } else {
        // If daily wage is 0, reset auto entry if exists
        if (existingAutoEntry && existingAutoEntry.amountForHim !== 0) {
          onUpdateEmployeeLedgerEntry(emp.id, existingAutoEntry.id, {
            date: effectiveEndDate,
            amountOnHim: existingAutoEntry.amountOnHim || 0,
            amountForHim: 0,
            description: 'لا يوجد أجر يومي محدد للموظف',
            notes: 'الأجر اليومي غير محدد',
            isAutoDailyWage: true,
            currency: existingAutoEntry.currency || currency || 'YER'
          });
        }
      }
    });
  }, [employees, currency, sharedRole, onUpdateEmployeeLedgerEntry, onAddEmployeeLedgerEntry]);

  // Find active employee details
  const activeEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Filter and sort employees list
  const sortedEmployees = useMemo(() => {
    let list = employees.filter(emp => 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.phoneNumbers && emp.phoneNumbers.some(p => p.includes(searchQuery)))
    );
    return list.sort((a, b) => {
      const dateA = a.startDate || '';
      const dateB = b.startDate || '';
      return employeeSortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });
  }, [employees, searchQuery, employeeSortOrder]);

  // Excel Column Filter State for Employee Ledger
  const [employeeLedgerColumnFilters, setEmployeeLedgerColumnFilters] = useState<Record<string, ActiveColumnFilter>>({});
  const [employeeLedgerColumnSort, setEmployeeLedgerColumnSort] = useState<ColumnSortState | null>(null);

  const handleEmployeeLedgerFilterChange = (key: string, filter: ActiveColumnFilter | null) => {
    setEmployeeLedgerColumnFilters(prev => {
      const next = { ...prev };
      if (!filter) {
        delete next[key];
      } else {
        next[key] = filter;
      }
      return next;
    });
  };

  const handleEmployeeLedgerSortChange = (sort: ColumnSortState | null) => {
    setEmployeeLedgerColumnSort(sort);
  };

  const handleClearEmployeeLedgerFilters = () => {
    setEmployeeLedgerColumnFilters({});
    setEmployeeLedgerColumnSort(null);
  };

  const employeeLedgerColumnConfigs: Record<string, ColumnFilterConfig<LedgerEntry>> = {
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
      title: 'عليه (سلفة/دفعة)',
      sortType: 'number',
      getValue: (e) => e.amountOnHim,
      getDisplayValue: (val) => Number(val) > 0 ? formatCurrency(Number(val), currency || 'YER') : '-'
    },
    amountForHim: {
      key: 'amountForHim',
      title: 'له (أجور/استحقاق)',
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

  // Base filtered employee ledger entries (matching top search, date, type filters)
  const baseFilteredLedger = useMemo(() => {
    if (!activeEmployee) return [];
    return activeEmployee.ledger.filter(entry => {
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
  }, [activeEmployee, ledgerSearchTerm, ledgerStartDate, ledgerEndDate, ledgerTypeFilter]);

  // Active employee filtered & sorted ledger entries (cascading with column filters)
  const sortedLedger = useMemo(() => {
    // Filter
    const filtered = baseFilteredLedger.filter(entry => {
      // Apply column filters
      for (const [colKey, filter] of Object.entries(employeeLedgerColumnFilters) as [string, ActiveColumnFilter][]) {
        const config = employeeLedgerColumnConfigs[colKey];
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

    // Sort
    return filtered.sort((a, b) => {
      if (employeeLedgerColumnSort) {
        const config = employeeLedgerColumnConfigs[employeeLedgerColumnSort.key];
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

          return employeeLedgerColumnSort.direction === 'asc' ? comp : -comp;
        }
      }

      if (ledgerSortOption === 'date-asc') {
        return (a.date || '').localeCompare(b.date || '');
      } else if (ledgerSortOption === 'desc-alpha') {
        return (a.description || '').localeCompare(b.description || '', 'ar');
      } else if (ledgerSortOption === 'amountOnHim-desc') {
        return b.amountOnHim - a.amountOnHim;
      } else if (ledgerSortOption === 'amountForHim-desc') {
        return b.amountForHim - a.amountForHim;
      }
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [activeEmployee, ledgerSearchTerm, ledgerStartDate, ledgerEndDate, ledgerTypeFilter, ledgerSortOption, employeeLedgerColumnFilters, employeeLedgerColumnSort]);

  const hasActiveEmployeeLedgerColumnFilters = Object.keys(employeeLedgerColumnFilters).length > 0 || employeeLedgerColumnSort !== null;

  const isLedgerFilterActive = Boolean(
    ledgerSearchTerm || ledgerStartDate || ledgerEndDate || ledgerTypeFilter !== 'all' || ledgerSortOption !== 'date-desc' || hasActiveEmployeeLedgerColumnFilters
  );

  // Form submit for new employee
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeError('');

    if (!newEmployeeName.trim()) {
      setEmployeeError('الرجاء إدخال اسم الموظف.');
      return;
    }
    if (!newEmployeeProfession.trim()) {
      setEmployeeError('الرجاء إدخال المسمى الوظيفي.');
      return;
    }
    if (!newEmployeeStartDate) {
      setEmployeeError('الرجاء اختيار تاريخ البدء.');
      return;
    }
    if (newEmployeeEndDate && new Date(newEmployeeStartDate) > new Date(newEmployeeEndDate)) {
      setEmployeeError('تاريخ البدء يجب أن يكون قبل أو يساوي تاريخ الانتهاء.');
      return;
    }

    if (newEmployeePhoneNumbers.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      setEmployeeError('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567).');
      return;
    }

    const validPhones = newEmployeePhoneNumbers.map(p => p.trim()).filter(p => p.length === 9);

    onAddEmployee({
      name: newEmployeeName.trim(),
      profession: newEmployeeProfession.trim(),
      startDate: newEmployeeStartDate,
      endDate: newEmployeeEndDate || '',
      dailyWage: Number(newEmployeeDailyWage) || 0,
      phoneNumbers: validPhones,
      notes: newEmployeeNotes.trim()
    });

    // Reset Form
    setNewEmployeeName('');
    setNewEmployeeProfession('');
    setNewEmployeeStartDate(new Date().toISOString().split('T')[0]);
    setNewEmployeeEndDate('');
    setNewEmployeeDailyWage('');
    setNewEmployeePhoneNumbers(['']);
    setNewEmployeeNotes('');
    setShowAddEmployeeForm(false);
  };

  // Submit handler for editing employee
  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const rawPhones = editingEmployee.phoneNumbers || [];
    if (rawPhones.some(p => p.trim().length > 0 && p.trim().length < 9)) {
      alert('رقم الهاتف يجب أن يتكون من 9 أرقام (مثال: 771234567)');
      return;
    }
    const cleanPhones = rawPhones.map(p => p.trim()).filter(p => p.length === 9);

    if (onUpdateEmployee) {
      onUpdateEmployee(editingEmployee.id, {
        name: editingEmployee.name,
        profession: editingEmployee.profession,
        startDate: editingEmployee.startDate,
        endDate: editingEmployee.endDate || '',
        dailyWage: Number(editingEmployee.dailyWage) || 0,
        phoneNumbers: cleanPhones,
        notes: editingEmployee.notes || ''
      });
    }
    setEditingEmployee(null);
  };

  // Submit handler for editing ledger entry
  const handleEditEmployeeLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployeeLedger) return;
    if (onUpdateEmployeeLedgerEntry) {
      onUpdateEmployeeLedgerEntry(editingEmployeeLedger.employeeId, editingEmployeeLedger.entry.id, {
        date: editingEmployeeLedger.entry.date,
        amountOnHim: editingEmployeeLedger.entry.amountOnHim,
        amountForHim: editingEmployeeLedger.entry.amountForHim,
        description: editingEmployeeLedger.entry.description,
        notes: editingEmployeeLedger.entry.notes,
        currency: editingEmployeeLedger.entry.currency || 'YER'
      });
    }
    setEditingEmployeeLedger(null);
  };

  // Bulk Excel import for new employees list
  const handleAllEmployeesExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (!data || data.length === 0) {
          alert('ملف Excel فارغ أو غير صالح.');
          return;
        }

        let count = 0;
        data.forEach(row => {
          const name = row['الاسم'] || row['اسم الموظف'] || row['الموظف'] || row['Name'] || row['name'];
          const profession = row['المسمى الوظيفي'] || row['المهنة'] || row['التخصص'] || row['Profession'] || 'موظف';
          const dailyWage = Number(row['الأجر اليومي'] || row['الراتب اليومي'] || row['DailyWage'] || 0);
          const startDate = row['تاريخ البدء'] || row['تاريخ المباشرة'] || row['StartDate'] || new Date().toISOString().split('T')[0];
          const endDate = row['تاريخ الانتهاء'] || row['EndDate'] || '';
          const phoneRaw = row['رقم الهاتف'] || row['الهاتف'] || row['رقم الجوال'] || row['الجوال'] || row['Phone'] || row['phone'] || '';

          const phoneNumbers: string[] = [];
          if (phoneRaw) {
            String(phoneRaw).split(/[,;/\n]+/).forEach(p => {
              const digits = p.replace(/\D/g, '').slice(0, 9);
              if (digits.length === 9) phoneNumbers.push(digits);
            });
          }

          if (name && String(name).trim()) {
            const parseDate = (d: any) => {
              if (typeof d === 'number') {
                const dateObj = XLSX.SSF.parse_date_code(d);
                return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
              }
              const stringDate = String(d).trim();
              const parsed = Date.parse(stringDate);
              if (!isNaN(parsed)) {
                return new Date(parsed).toISOString().split('T')[0];
              }
              return stringDate;
            };

            onAddEmployee({
              name: String(name).trim(),
              profession: String(profession).trim(),
              dailyWage: isNaN(dailyWage) ? 0 : dailyWage,
              startDate: parseDate(startDate),
              endDate: endDate ? parseDate(endDate) : '',
              phoneNumbers
            });
            count++;
          }
        });

        alert(`تم استيراد ${count} موظف بنجاح من ملف Excel!`);
      } catch (err) {
        console.error("Error reading Excel for employees:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من مطابقة اسم العامود (الاسم، المسمى الوظيفي، الأجر اليومي، تاريخ البدء).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Export all employees summary and detailed ledgers to Multi-sheet Excel
  const handleExportAllEmployeesExcel = () => {
    const summaryHeaders = [
      'م', 
      'اسم الموظف', 
      'المسمى الوظيفي', 
      'رقم الهاتف',
      'الأجر اليومي', 
      'تاريخ البدء', 
      'تاريخ الانتهاء', 
      'أيام العمل', 
      'إجمالي له (أجور)', 
      'إجمالي عليه (سلف)', 
      'صافي المستحق', 
      'العملة', 
      'الحالة'
    ];

    let totalWagesSum = 0;
    let totalAdvancesSum = 0;

    const summaryRows: (string | number)[][] = sortedEmployees.map((emp, index) => {
      const days = getEmployeeTotalDays(emp, sharedRole === 'owner');
      const totalOnHim = emp.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = emp.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;

      totalWagesSum += totalForHim;
      totalAdvancesSum += totalOnHim;

      let status = 'خالص الطرفين';
      if (net > 0) status = 'له مستحقات';
      else if (net < 0) status = 'عليه سلفة';

      return [
        index + 1,
        emp.name,
        emp.profession,
        emp.phoneNumbers?.join(' - ') || '-',
        emp.dailyWage || 0,
        emp.startDate,
        emp.endDate || 'مستمر',
        days,
        totalForHim,
        totalOnHim,
        net,
        currency,
        status
      ];
    });

    const totalNet = totalWagesSum - totalAdvancesSum;

    summaryRows.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    summaryRows.push(['الإجمالي العام', '', '', '', '', '', '', '', totalWagesSum, totalAdvancesSum, totalNet, currency, totalNet > 0 ? 'له مستحقات' : totalNet < 0 ? 'عليه سلف' : 'متوازن']);

    // Sheet 2: Detailed ledger entries for ALL employees
    const ledgerHeaders = [
      'اسم الموظف',
      'المسمى الوظيفي',
      'تاريخ الحركة',
      'البيان / الوصف التفصيلي',
      'مبلغ له (رواتب ومستحقات)',
      'مبلغ عليه (سلف ومسحوبات)',
      'العملة',
      'الملاحظات',
      'بواسطة'
    ];

    const ledgerRows: (string | number)[][] = [];
    sortedEmployees.forEach(e => {
      e.ledger.forEach(entry => {
        ledgerRows.push([
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
      });
    });
    ledgerRows.sort((a, b) => (b[2] as string).localeCompare(a[2] as string));

    exportMultiSheetXLSX(`كشف_الموظفين_التفصيلي_الشامل_${new Date().toISOString().split('T')[0]}`, [
      { sheetName: 'سجل الموظفين العام', headers: summaryHeaders, rows: summaryRows },
      { sheetName: 'تفاصيل حركات كشف الموظفين', headers: ledgerHeaders, rows: ledgerRows }
    ]);
  };

  // Print All Employees PDF with Summary and Detailed Ledgers
  const handlePrintAllEmployeesPDF = () => {
    let totalWagesSum = 0;
    let totalAdvancesSum = 0;

    const summaryRowsHtml = sortedEmployees.map((emp, idx) => {
      const days = getEmployeeTotalDays(emp, sharedRole === 'owner');
      const totalOnHim = emp.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = emp.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;

      totalWagesSum += totalForHim;
      totalAdvancesSum += totalOnHim;

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${emp.name}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${emp.profession}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${emp.dailyWage ? formatCurrency(emp.dailyWage, currency) : '-'}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${days} يوم</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #10b981; font-weight: bold;">${formatCurrency(totalForHim, currency)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #e11d48; font-weight: bold;">${formatCurrency(totalOnHim, currency)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: ${net >= 0 ? '#10b981' : '#e11d48'};">
            ${net === 0 ? 'خالص' : net > 0 ? `له (${formatCurrency(net, currency)})` : `عليه (${formatCurrency(Math.abs(net), currency)})`}
          </td>
        </tr>
      `;
    }).join('');

    let employeesDetailedLedgersHtml = '';
    sortedEmployees.forEach(emp => {
      const days = getEmployeeTotalDays(emp, sharedRole === 'owner');
      const totalOnHim = emp.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
      const totalForHim = emp.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
      const net = totalForHim - totalOnHim;

      let ledgerRowsHtml = '';
      emp.ledger.forEach(e => {
        ledgerRowsHtml += `
          <tr>
            <td style="font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${formatDateArabic(e.date)}</td>
            <td style="font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.description}</td>
            <td style="color: #dc2626; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.amountOnHim > 0 ? formatCurrency(e.amountOnHim, currency) : '-'}</td>
            <td style="color: #10b981; font-family: monospace; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.amountForHim > 0 ? formatCurrency(e.amountForHim, currency) : '-'}</td>
            <td style="font-size: 11px; color: #64748b; padding: 6px 8px; border: 1px solid #cbd5e1;">${e.notes || '-'}</td>
          </tr>
        `;
      });

      employeesDetailedLedgersHtml += `
        <div style="margin-top: 25px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e1b4b; color: #ffffff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: bold; font-size: 14px;">👔 الموظف: ${emp.name}</span>
              <span style="font-size: 12px; color: #a5b4fc; margin-right: 8px;">(${emp.profession} - ${days} يوم عمل - أجر يومي: ${emp.dailyWage ? formatCurrency(emp.dailyWage, currency) : '-'})</span>
            </div>
            <div style="font-size: 12px; font-weight: bold;">
              <span style="color: #f87171; margin-left: 8px;">عليه: ${formatCurrency(totalOnHim, currency)}</span> | 
              <span style="color: #34d399; margin-left: 8px;">له: ${formatCurrency(totalForHim, currency)}</span> | 
              <span style="color: #818cf8;">الصافي: ${net >= 0 ? formatCurrency(net, currency) : `-${formatCurrency(Math.abs(net), currency)}`}</span>
            </div>
          </div>
          <table style="margin: 0; width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 15%;">التاريخ</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 35%;">البيان / الوصف</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">عليه (سلف)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 18%;">له (راتب)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${emp.ledger.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 10px; border: 1px solid #cbd5e1;">لا توجد معاملات مسجلة لهذا الموظف حالياً.</td></tr>' : ledgerRowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });

    const netSum = totalWagesSum - totalAdvancesSum;

    const htmlContent = `
      <div style="direction: rtl; font-family: sans-serif; padding: 10px;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; color: #1e293b; font-size: 20px;">تقرير حسابات الموظفين والكادر الإداري الشامل</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">شركة ورلد أوف إيليتس للمقاولات والخدمات</p>
          </div>
          <div style="text-align: left; font-size: 12px; color: #64748b;">
            تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
          </div>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px;">
          <div><strong>عدد الموظفين:</strong> ${sortedEmployees.length} موظف</div>
          <div><strong>إجمالي الاستحقاقات (له):</strong> <span style="color: #10b981; font-weight: bold;">${formatCurrency(totalWagesSum, currency)}</span></div>
          <div><strong>إجمالي السلف والمدفوعات (عليه):</strong> <span style="color: #e11d48; font-weight: bold;">${formatCurrency(totalAdvancesSum, currency)}</span></div>
        </div>

        <!-- SECTION 1: SUMMARY TABLE -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 6px; margin-bottom: 12px;">
            أولاً: جدول ملخص حسابات وأرصدة الموظفين
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #6366f1; color: white;">
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; width: 35px;">#</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">اسم الموظف</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">المسمى الوظيفي</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الأجر اليومي</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">أيام العمل</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">المستحق له</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">المدفوع عليه</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">الرصيد الصافي</th>
              </tr>
            </thead>
            <tbody>
              ${sortedEmployees.length === 0 ? '<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 12px;">لا يوجد موظفين مسجلين.</td></tr>' : summaryRowsHtml}
            </tbody>
          </table>

          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; font-size: 13px;">
            <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">الخلاصة المالية للموظفين:</div>
            <div>• إجمالي الأجور المستحقة للموظفين: <strong>${formatCurrency(totalWagesSum, currency)}</strong></div>
            <div>• إجمالي السلف والمدفوعات المسددة للموظفين: <strong>${formatCurrency(totalAdvancesSum, currency)}</strong></div>
            <div style="font-size: 14px; font-weight: bold; color: ${netSum >= 0 ? '#10b981' : '#e11d48'}; margin-top: 6px;">
              • صافي الأرصدة الإجمالية: ${netSum >= 0 ? `صافي مستحقات للموظفين (${formatCurrency(netSum, currency)})` : `صافي سلف زائدة على الموظفين (${formatCurrency(Math.abs(netSum), currency)})`}
            </div>
          </div>
        </div>

        <!-- SECTION 2: DETAILED LEDGERS FOR ALL EMPLOYEES -->
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 6px; margin-bottom: 12px; page-break-before: always;">
            ثانياً: كشوفات تفصيلية بكافة الحركات والعمليات المالية لكل موظف
          </h3>
          ${sortedEmployees.length === 0 ? '<p style="text-align: center; color: #94a3b8;">لا توجد بيانات تفصيلية.</p>' : employeesDetailedLedgersHtml}
        </div>
      </div>
    `;

    printPDF('تقرير الموظفين الشامل التفصيلي', htmlContent);
  };

  // Excel File upload/import handler for active employee's ledger
  const handleEmployeeLedgerExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployeeId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (!data || data.length === 0) {
          alert('ملف Excel فارغ أو غير صالح.');
          return;
        }

        let count = 0;
        data.forEach(row => {
          const dateVal = row['التاريخ'] || row['تاريخ'] || row['Date'] || row['date'] || new Date().toISOString().split('T')[0];
          const desc = row['البيان'] || row['الوصف'] || row['Description'] || row['description'] || 'حركة مستوردة من Excel';
          const onHim = Number(row['المبلغ عليه'] || row['عليه'] || row['OnHim'] || row['amountOnHim'] || 0);
          const forHim = Number(row['المبلغ له'] || row['له'] || row['ForHim'] || row['amountForHim'] || 0);
          const notes = row['ملاحظات'] || row['Notes'] || '';
          const cur = row['العملة'] || row['Currency'] || currency;

          if (onHim > 0 || forHim > 0 || desc) {
            const parseDate = (d: any) => {
              if (typeof d === 'number') {
                const dateObj = XLSX.SSF.parse_date_code(d);
                return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
              }
              const stringDate = String(d).trim();
              const parsed = Date.parse(stringDate);
              if (!isNaN(parsed)) {
                return new Date(parsed).toISOString().split('T')[0];
              }
              return stringDate;
            };

            onAddEmployeeLedgerEntry(selectedEmployeeId, {
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
        console.error("Error reading Excel for employee ledger:", err);
        alert('حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من أن الأعمدة مطابقة (التاريخ، البيان، مبلغ عليه، مبلغ له).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Form submit for adding manual ledger entry
  const handleAddLedgerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLedgerError('');

    if (!selectedEmployeeId) return;

    const onHim = Number(ledgerAmountOnHim) || 0;
    const forHim = Number(ledgerAmountForHim) || 0;

    if (onHim <= 0 && forHim <= 0) {
      setLedgerError('يجب إدخال مبلغ في خانة "عليه" أو "له".');
      return;
    }
    if (!ledgerDescription.trim()) {
      setLedgerError('الرجاء إدخال بيان الحركة.');
      return;
    }
    if (!ledgerDate) {
      setLedgerError('الرجاء اختيار تاريخ الحركة.');
      return;
    }

    onAddEmployeeLedgerEntry(selectedEmployeeId, {
      date: ledgerDate,
      amountOnHim: onHim,
      amountForHim: forHim,
      description: ledgerDescription.trim(),
      notes: ledgerNotes.trim(),
      currency: ledgerCurrency
    });

    // Reset ledger form
    setLedgerAmountOnHim('');
    setLedgerAmountForHim('');
    setLedgerDescription('');
    setLedgerNotes('');
  };

  // Form submit for extra work period
  const handleAddExtraPeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExtraFormError('');

    if (!selectedEmployeeId || !onAddEmployeeExtraPeriod) return;
    if (!extraStart) {
      setExtraFormError('الرجاء تحديد تاريخ بدء الفترة الإضافية.');
      return;
    }
    if (extraEnd && new Date(extraStart) > new Date(extraEnd)) {
      setExtraFormError('تاريخ البدء يجب أن يكون قبل أو يساوي تاريخ الانتهاء.');
      return;
    }

    onAddEmployeeExtraPeriod(selectedEmployeeId, extraStart, extraEnd || '');

    // Reset
    setExtraStart('');
    setExtraEnd('');
    setShowExtraForm(false);
  };

  // Export Employee Ledger to CSV
  const handleExportLedgerCSV = (employee: Employee) => {
    const headers = ['التاريخ', 'البيان', 'المبلغ عليه (دفعة/سلفة)', 'المبلغ له (أجور)', 'العملة', 'ملاحظات', 'تم الترحيل'];
    const sortedLedger = [...employee.ledger].sort((a, b) => b.date.localeCompare(a.date));
    const data = sortedLedger.map(entry => [
      formatDateArabic(entry.date),
      entry.description,
      entry.amountOnHim,
      entry.amountForHim,
      entry.currency || currency,
      entry.notes || '-',
      entry.isPosted ? 'نعم (من النفقات)' : 'لا'
    ]);

    const totalOnHim = employee.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
    const totalForHim = employee.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
    const net = totalForHim - totalOnHim;

    data.push(['', '', '', '', '', '', '']);
    data.push(['الإجمالي له', '', '', totalForHim, currency, '', '']);
    data.push(['الإجمالي عليه', '', totalOnHim, '', currency, '', '']);
    data.push(['صافي الرصيد المستحق', '', '', net, currency, net > 0 ? 'له مستحقات' : net < 0 ? 'عليه سلفة' : 'خالص', '']);

    const stringData: string[][] = data.map(row => row.map(cell => String(cell)));
    exportToCSV(`كشف_حساب_الموظف_${employee.name.replace(/\s+/g, '_')}`, headers, stringData);
  };

  // Print Employee PDF
  const handlePrintEmployeePDF = (employee: Employee) => {
    const totalDays = getEmployeeTotalDays(employee, sharedRole === 'owner');
    const totalOnHim = employee.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
    const totalForHim = employee.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
    const net = totalForHim - totalOnHim;

    const htmlContent = `
      <div style="direction: rtl; font-family: sans-serif; padding: 20px;">
        <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; color: #1e293b; font-size: 20px;">كشف حساب تفصيلي للموظف</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">تطبيق إدارة مشاريع المقاولات والإنشاءات</p>
          </div>
          <div style="text-align: left; font-size: 12px; color: #64748b;">
            تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
          </div>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
            <div><strong>اسم الموظف:</strong> ${employee.name}</div>
            <div><strong>المسمى الوظيفي:</strong> ${employee.profession}</div>
            <div><strong>الأجر اليومي:</strong> ${employee.dailyWage ? formatCurrency(employee.dailyWage, currency) : 'غير محدد'}</div>
            <div><strong>تاريخ البدء:</strong> ${formatDateArabic(employee.startDate)}</div>
            <div><strong>تاريخ الانتهاء:</strong> ${employee.endDate ? formatDateArabic(employee.endDate) : 'مستمر'}</div>
            <div><strong>إجمالي أيام العمل:</strong> ${totalDays} يوم</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #6366f1; color: white;">
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">التاريخ</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">البيان التفصيلي</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">المبلغ عليه (مدفوعات)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">المبلغ له (أجور)</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">العملة</th>
            </tr>
          </thead>
          <tbody>
            ${[...employee.ledger].sort((a, b) => b.date.localeCompare(a.date)).map((e, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${formatDateArabic(e.date)}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.description} ${e.isPosted ? '<span style="color:#6366f1;">(مرحّل)</span>' : ''}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #e11d48; font-weight: bold;">${e.amountOnHim ? formatCurrency(e.amountOnHim, e.currency || currency) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #10b981; font-weight: bold;">${e.amountForHim ? formatCurrency(e.amountForHim, e.currency || currency) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${e.currency || currency}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; font-size: 13px; font-weight: bold; text-align: left; display: flex; justify-content: space-between;">
          <span>إجمالي له: ${formatCurrency(totalForHim, currency)}</span>
          <span>إجمالي عليه: ${formatCurrency(totalOnHim, currency)}</span>
          <span>صافي المستحق: ${formatCurrency(net, currency)} (${net >= 0 ? 'له' : 'عليه'})</span>
        </div>
      </div>
    `;

    printPDF(`كشف_حساب_الموظف_${employee.name}`, htmlContent);
  };

  return (
    <div className="space-y-4 animate-fade-in" id="employees-section">
      {/* Detail View of a Selected Employee */}
      {activeEmployee ? (
        <div className="space-y-4">
          
          {/* Detail Header / Nav back */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-800">{activeEmployee.name}</h2>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">{activeEmployee.profession}</span>
                    {activeEmployee.dailyWage > 0 && (
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        الأجر اليومي: {formatCurrency(activeEmployee.dailyWage, currency)}
                      </span>
                    )}
                    <AttributionBadge createdBy={activeEmployee.createdBy} updatedBy={activeEmployee.updatedBy} />
                  </div>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-1.5">
                    <Calendar size={13} />
                    تاريخ العمل: {formatDateArabic(activeEmployee.startDate)} إلى {activeEmployee.endDate ? formatDateArabic(activeEmployee.endDate) : 'الآن (مستمر)'}
                  </p>
                  <PhoneNumbersDisplay phoneNumbers={activeEmployee.phoneNumbers} className="mt-2" />
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
                  onClick={() => { setSelectedEmployeeId(null); setLedgerError(''); }}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] border border-slate-200/90 rounded-lg shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center gap-1.5 cursor-pointer shrink-0 w-full justify-center"
                  title="الرجوع لقائمة الموظفين"
                >
                  <ArrowLeft size={14} className="text-slate-700 shrink-0" />
                  <span>الرجوع لقائمة الموظفين</span>
                </button>

                <OptionsMenu 
                  onExportExcel={() => handleExportLedgerCSV(activeEmployee)}
                  onExportPDF={() => handlePrintEmployeePDF(activeEmployee)}
                  onImportExcel={sharedRole !== 'read' ? handleEmployeeLedgerExcelImport : undefined}
                  shareTitle={`كشف حساب الموظف: ${activeEmployee.name}`}
                  shareText={(() => {
                    const days = getEmployeeTotalDays(activeEmployee, sharedRole === 'owner');
                    const totalOnHim = activeEmployee.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = activeEmployee.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    const status = net === 0 ? 'متوازن' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`;

                    return `👔 كشف حساب الموظف التفصيلي: ${activeEmployee.name}\n💼 المسمى: ${activeEmployee.profession}\n📅 فترة العمل: من ${activeEmployee.startDate} إلى ${activeEmployee.endDate || 'الآن'}\n⏱️ أيام العمل المحتسبة: ${days} يوم\n💰 الأجر اليومي: ${formatCurrency(activeEmployee.dailyWage, currency)}\n\n💰 إجمالي الأجور المستحقة (له): ${formatCurrency(totalForHim, currency)}\n💸 إجمالي السلف/المدفوعات (عليه): ${formatCurrency(totalOnHim, currency)}\n⚖️ الصافي المالي الحالي: ${status}\n\n*تم استخراجه ومشاركته من كشوفات المقاولات*`;
                  })()}
                />
              </div>
            </div>

            {/* Actions for active employee */}
            {(sharedRole !== 'read' || onTransferEmployeeToWorker) && (
              <div className="flex items-center gap-2.5 flex-wrap w-full pt-1">
                {sharedRole !== 'read' && (
                  <button 
                    onClick={() => setEditingEmployee(activeEmployee)}
                    className="h-9 px-3.5 bg-white hover:bg-amber-50 text-amber-800 font-bold text-xs border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    title="تعديل بيانات وتواريخ الموظف"
                  >
                    <Pencil size={15} className="text-amber-600 shrink-0" />
                    <span>تعديل</span>
                  </button>
                )}

                {sharedRole !== 'read' && onTransferEmployeeToWorker && (
                  <button 
                    onClick={() => {
                      if (confirm(`هل ترغب بنقل كافة بيانات الموظف "${activeEmployee.name}" إلى نافذة العمال؟`)) {
                        onTransferEmployeeToWorker(activeEmployee);
                      }
                    }}
                    className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    title="تحويل الموظف إلى قسم العمال"
                  >
                    <ArrowRightLeft size={15} className="text-slate-600 shrink-0" />
                    <span>تحويل لعمال</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats summary banner for active employee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Stat 1: Working Days */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-semibold block">إجمالي أيام العمل</span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">
                    {getEmployeeTotalDays(activeEmployee, sharedRole === 'owner')} يوم
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Clock size={20} />
                </div>
              </div>
              
              {/* Extra Periods trigger */}
              {sharedRole !== 'read' && onAddEmployeeExtraPeriod && (
                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">فترات إضافية: {(activeEmployee.extraPeriods || []).length}</span>
                  <button 
                    onClick={() => setShowExtraForm(!showExtraForm)}
                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle size={12} />
                    إضافة فترة عمل
                  </button>
                </div>
              )}
            </div>

            {/* Stat 2: Total For Him (Wage) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-semibold block">إجمالي المستحق له (أجور)</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">
                    {formatCurrency(activeEmployee.ledger.reduce((sum, e) => sum + e.amountForHim, 0), currency)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Receipt size={20} />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-50">مجموع استحقاق الأجر اليومي والمكافآت</p>
            </div>

            {/* Stat 3: Total On Him (Payments/Advances) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-semibold block">إجمالي المدفوع عليه (سلف)</span>
                  <span className="text-2xl font-black text-rose-600 mt-1 block">
                    {formatCurrency(activeEmployee.ledger.reduce((sum, e) => sum + e.amountOnHim, 0), currency)}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                  <Coins size={20} />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-50">السلفات النقدية والمبالغ المسددة له</p>
            </div>

            {/* Stat 4: Net Balance */}
            {(() => {
              const totalOnHim = activeEmployee.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
              const totalForHim = activeEmployee.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
              const net = totalForHim - totalOnHim;
              return (
                <div className={`p-5 rounded-2xl border shadow-xs ${net > 0 ? 'bg-emerald-600 text-white border-emerald-600' : net < 0 ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-800 text-white border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white/80 text-xs font-semibold block">صافي الرصيد الحالي</span>
                      <span className="text-2xl font-black mt-1 block">
                        {formatCurrency(Math.abs(net), currency)}
                      </span>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                      <Briefcase size={20} />
                    </div>
                  </div>
                  <p className="text-[11px] text-white/90 font-bold mt-3 pt-3 border-t border-white/10">
                    {net === 0 ? 'خالص الطرفين لا يوجد مستحقات' : net > 0 ? 'المطالبة: للموظف مستحقات بذمتك' : 'المطالبة: على الموظف سلفة زائدة'}
                  </p>
                </div>
              );
            })()}

          </div>

          {/* Form for adding extra work period */}
          {showExtraForm && sharedRole !== 'read' && (
            <div className="bg-indigo-50/60 border border-indigo-100 p-5 rounded-2xl animate-fade-in space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-1.5">
                  <Calendar size={16} />
                  تسجيل فترة عمل إضافية للموظف ({activeEmployee.name})
                </h4>
                <button 
                  onClick={() => setShowExtraForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  إلغاء
                </button>
              </div>

              {extraFormError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                  {extraFormError}
                </p>
              )}

              <form onSubmit={handleAddExtraPeriodSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">تاريخ بدء الفترة الإضافية</label>
                  <input 
                    type="date"
                    value={extraStart}
                    onChange={(e) => setExtraStart(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">تاريخ الانتهاء (اختياري)</label>
                  <input 
                    type="date"
                    value={extraEnd}
                    onChange={(e) => setExtraEnd(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                  />
                </div>

                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle size={15} />
                  إضافة الفترة الإضافية
                </button>
              </form>

              {/* Extra periods list table */}
              {(activeEmployee.extraPeriods || []).length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-100 space-y-1">
                  <span className="text-xs font-bold text-indigo-900 block mb-1">الفترات الإضافية المسجلة سابقاً:</span>
                  {(activeEmployee.extraPeriods || []).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-indigo-100">
                      <span>من {formatDateArabic(p.startDate)} إلى {p.endDate ? formatDateArabic(p.endDate) : 'مستمر'} ({calculateDaysOfWork(p.startDate, p.endDate, sharedRole === 'owner')} يوم)</span>
                      {onDeleteEmployeeExtraPeriod && (
                        <button 
                          onClick={() => onDeleteEmployeeExtraPeriod(activeEmployee.id, p.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold p-1"
                          title="حذف الفترة"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ledger Section (Grid layout: Left = Form, Right = Transactions Table) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            
            {/* Left Col: Add Ledger Entry Form */}
            {sharedRole !== 'read' && (
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setShowAddLedgerForm(!showAddLedgerForm)}
                  className="w-full font-bold text-slate-800 text-sm flex items-center justify-between hover:text-indigo-600 transition-colors cursor-pointer text-right py-1"
                >
                  <div className="flex items-center gap-2">
                    <PlusCircle size={18} className="text-indigo-600" />
                    <span>إضافة حركة مالية جديدة للكشف</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors">
                    <span>{showAddLedgerForm ? 'طي النموذج' : 'إظهار النموذج'}</span>
                    {showAddLedgerForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {showAddLedgerForm && (
                  <div className="pt-3.5 mt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                    <div className="flex justify-end">
                      <Calculator onApply={(val) => setLedgerAmountOnHim(String(val))} buttonTitle="حاسبة" />
                    </div>

                    {ledgerError && (
                      <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                        {ledgerError}
                      </p>
                    )}

                    <form onSubmit={handleAddLedgerSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                        <input 
                          type="date"
                          value={ledgerDate}
                          onChange={(e) => setLedgerDate(e.target.value)}
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-rose-600 block">المبلغ عليه (دفعة/سلفة)</label>
                          <input 
                            type="number"
                            step="any"
                            value={ledgerAmountOnHim}
                            onChange={(e) => setLedgerAmountOnHim(e.target.value)}
                            placeholder="0"
                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-hidden focus:border-rose-500"
                          />
                          <AmountInWords amount={ledgerAmountOnHim} currency={ledgerCurrency} />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-emerald-600 block">المبلغ له (إضافة/أجور)</label>
                          <input 
                            type="number"
                            step="any"
                            value={ledgerAmountForHim}
                            onChange={(e) => setLedgerAmountForHim(e.target.value)}
                            placeholder="0"
                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-hidden focus:border-emerald-500"
                          />
                          <AmountInWords amount={ledgerAmountForHim} currency={ledgerCurrency} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">العملة المستخدمة</label>
                        <select
                          value={ledgerCurrency}
                          onChange={(e) => setLedgerCurrency(e.target.value)}
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="YER">ريال يمني (YER)</option>
                          <option value="SAR">ريال سعودي (SAR)</option>
                          <option value="USD">دولار أمريكي (USD)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">بيان الحركة المالية</label>
                        <input 
                          type="text"
                          value={ledgerDescription}
                          onChange={(e) => setLedgerDescription(e.target.value)}
                          placeholder="مثال: سلفة نقدية أو مكافأة إنجاز"
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                        <input 
                          type="text"
                          value={ledgerNotes}
                          onChange={(e) => setLedgerNotes(e.target.value)}
                          placeholder="رقم الوصل، تفاصيل إضافية..."
                          className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <PlusCircle size={16} />
                        حفظ القيد في الكشف
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Right Col: Ledger Transactions Log Table */}
            <div className={`space-y-3 ${sharedRole === 'read' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
              {/* Ledger Filters Card */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-100 shadow-xs transition-all" id="employee-ledger-filters">
                <button
                  type="button"
                  onClick={() => setIsLedgerFiltersOpen(!isLedgerFiltersOpen)}
                  className="w-full flex items-center justify-between text-right font-bold text-slate-700 text-xs sm:text-sm hover:text-slate-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-indigo-500" />
                    <span>أدوات البحث والتصفية (سجل الكشوفات والحركات التفصيلي)</span>
                    {isLedgerFilterActive && (
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
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
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-indigo-500 transition-colors"
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
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      {/* End Date */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">إلى:</span>
                        <input 
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      {/* Sort Order Filter */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">الترتيب:</span>
                        <select
                          value={ledgerSortOption}
                          onChange={(e) => setLedgerSortOption(e.target.value as any)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-indigo-500 cursor-pointer"
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
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-hidden focus:border-indigo-500 cursor-pointer"
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
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold cursor-pointer"
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
                    <h3 className="font-bold text-slate-800 text-sm">سجل الكشوفات والحركات التفصيلي للموظف</h3>
                    {hasActiveEmployeeLedgerColumnFilters && (
                      <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-lg text-xs font-bold">
                        <Filter size={12} className="fill-current text-indigo-600" />
                        <span>تصفية مخصصة للأعمدة</span>
                        <button
                          type="button"
                          onClick={handleClearEmployeeLedgerFilters}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline mr-1 cursor-pointer font-bold"
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
                      <p className="text-xs text-slate-300">قم بإضافة حركة مالية جديدة أو تحديد الأجر اليومي للموظف</p>
                    </div>
                  ) : (
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>التاريخ</span>
                              <ExcelColumnFilter
                                config={employeeLedgerColumnConfigs.date}
                                data={baseFilteredLedger}
                                allColumnFilters={employeeLedgerColumnFilters}
                                allConfigs={employeeLedgerColumnConfigs}
                                activeFilter={employeeLedgerColumnFilters.date}
                                onFilterChange={handleEmployeeLedgerFilterChange}
                                activeSort={employeeLedgerColumnSort}
                                onSortChange={handleEmployeeLedgerSortChange}
                                accentColor="indigo"
                              />
                            </div>
                          </th>
                          <th className="p-3 min-w-[280px] sm:min-w-[360px] w-2/5">
                            <div className="flex items-center justify-between gap-1">
                              <span>البيان</span>
                              <ExcelColumnFilter
                                config={employeeLedgerColumnConfigs.description}
                                data={baseFilteredLedger}
                                allColumnFilters={employeeLedgerColumnFilters}
                                allConfigs={employeeLedgerColumnConfigs}
                                activeFilter={employeeLedgerColumnFilters.description}
                                onFilterChange={handleEmployeeLedgerFilterChange}
                                activeSort={employeeLedgerColumnSort}
                                onSortChange={handleEmployeeLedgerSortChange}
                                accentColor="indigo"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-rose-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>عليه (سلفة/دفعة)</span>
                              <ExcelColumnFilter
                                config={employeeLedgerColumnConfigs.amountOnHim}
                                data={baseFilteredLedger}
                                allColumnFilters={employeeLedgerColumnFilters}
                                allConfigs={employeeLedgerColumnConfigs}
                                activeFilter={employeeLedgerColumnFilters.amountOnHim}
                                onFilterChange={handleEmployeeLedgerFilterChange}
                                activeSort={employeeLedgerColumnSort}
                                onSortChange={handleEmployeeLedgerSortChange}
                                accentColor="rose"
                              />
                            </div>
                          </th>
                          <th className="p-3 text-emerald-600 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1">
                              <span>له (أجور/استحقاق)</span>
                              <ExcelColumnFilter
                                config={employeeLedgerColumnConfigs.amountForHim}
                                data={baseFilteredLedger}
                                allColumnFilters={employeeLedgerColumnFilters}
                                allConfigs={employeeLedgerColumnConfigs}
                                activeFilter={employeeLedgerColumnFilters.amountForHim}
                                onFilterChange={handleEmployeeLedgerFilterChange}
                                activeSort={employeeLedgerColumnSort}
                                onSortChange={handleEmployeeLedgerSortChange}
                                accentColor="emerald"
                              />
                            </div>
                          </th>
                          <th className="p-3">
                            <div className="flex items-center justify-between gap-1">
                              <span>ملاحظات</span>
                              <ExcelColumnFilter
                                config={employeeLedgerColumnConfigs.notes}
                                data={baseFilteredLedger}
                                allColumnFilters={employeeLedgerColumnFilters}
                                allConfigs={employeeLedgerColumnConfigs}
                                activeFilter={employeeLedgerColumnFilters.notes}
                                onFilterChange={handleEmployeeLedgerFilterChange}
                                activeSort={employeeLedgerColumnSort}
                                onSortChange={handleEmployeeLedgerSortChange}
                                accentColor="indigo"
                              />
                            </div>
                          </th>
                          {sharedRole !== 'read' && <th className="p-3 text-center whitespace-nowrap">إجراءات</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedLedger.map((e) => (
                          <tr key={e.id} className={`transition-colors ${e.isAutoDailyWage ? 'bg-indigo-50/40 hover:bg-indigo-50/70' : 'hover:bg-slate-50/50'}`}>
                            <td className="p-3 whitespace-nowrap text-slate-500">{formatDateArabic(e.date)}</td>
                            <td className="p-3 font-semibold text-slate-800 min-w-[280px] sm:min-w-[360px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{cleanLedgerDescription(e.description)}</span>
                              {e.isAutoDailyWage && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md border border-indigo-200">
                                  احتساب تلقائي للأجر اليومي ⚙️
                                </span>
                              )}
                              {e.isPosted && (
                                <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 font-bold px-1.5 py-0.5 rounded-sm">
                                  مرحلة تلقائياً من النفقات اليومية
                                </span>
                              )}
                              </div>
                            </td>
                            <td className="p-3 font-bold text-rose-600 font-mono">
                              {e.amountOnHim > 0 ? formatCurrency(e.amountOnHim, e.currency || currency) : '-'}
                            </td>
                            <td className="p-3 font-bold text-emerald-600 font-mono">
                              {e.amountForHim > 0 ? formatCurrency(e.amountForHim, e.currency || currency) : '-'}
                            </td>
                            <td className="p-3 text-slate-400 max-w-[150px] truncate">{e.notes || '-'}</td>
                            {sharedRole !== 'read' && (
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {onUpdateEmployeeLedgerEntry && (
                                    <button 
                                      onClick={() => setEditingEmployeeLedger({ employeeId: activeEmployee.id, entry: e })}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                      title="تعديل الحركة المالية"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  )}
                                  {sharedRole !== 'add' && onDeleteEmployeeLedgerEntry && (
                                    <button 
                                      onClick={() => {
                                        if (confirm(`هل أنت متأكد من حذف الحركة المالية (${e.description}) من كشف حساب الموظف؟`)) {
                                          onDeleteEmployeeLedgerEntry(activeEmployee.id, e.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                      title="حذف الحركة المالية"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
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
        /* List View of All Employees */
        <div className="space-y-6">
          
          {/* Main Header Card */}
          <PageHeaderCard
            title="سجل الموظفين والمهندسين والإداريين"
            description="إدارة الكادر الفني والإداري والمهندسين وتتبع أجورهم وسلفهم ومستحقاتهم بدقة."
            icon={<Briefcase size={20} />}
            onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
            optionsMenu={
              <OptionsMenu 
                onExportExcel={handleExportAllEmployeesExcel}
                onExportPDF={handlePrintAllEmployeesPDF}
                onImportExcel={sharedRole !== 'read' ? handleAllEmployeesExcelImport : undefined}
                shareTitle="كشوفات حسابات الموظفين - التقرير الشامل"
                shareText={(() => {
                  let totalWagesSum = 0;
                  let totalAdvancesSum = 0;
                  employees.forEach(emp => {
                    totalWagesSum += emp.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    totalAdvancesSum += emp.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                  });
                  const net = totalWagesSum - totalAdvancesSum;
                  let status = 'متوازن';
                  if (net > 0) status = `صافي مستحقات للموظفين: ${formatCurrency(net, currency)}`;
                  else if (net < 0) status = `صافي سلف على الموظفين: ${formatCurrency(Math.abs(net), currency)}`;

                  return `📋 ملخص كشوفات حسابات الموظفين:\n👥 إجمالي عدد الموظفين: ${employees.length} موظف\n💰 إجمالي الاستحقاقات (له): ${formatCurrency(totalWagesSum, currency)}\n💸 إجمالي السلف والمدفوعات (عليه): ${formatCurrency(totalAdvancesSum, currency)}\n⚖️ الصافي الإجمالي العام: ${status}`;
                })()}
              />
            }
          />

          {/* Main Content Grid: Left = Add Employee Form, Right = Employees Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            
            {/* Column 1: Add Employee Form */}
            {sharedRole !== 'read' && (
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
                  className="w-full font-bold text-slate-800 text-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus size={16} className="text-indigo-600" />
                    <span>تسجيل موظف جديد</span>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1 transition-all ${
                    showAddEmployeeForm 
                      ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}>
                    {showAddEmployeeForm ? 'إخفاء البيانات ▲' : '+ تسجيل موظف جديد ▼'}
                  </span>
                </button>

                {showAddEmployeeForm && (
                  <div className="pt-3 border-t border-slate-100 animate-slide-up space-y-3">
                    {employeeError && (
                      <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                        {employeeError}
                      </p>
                    )}

                    <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">اسم الموظف الثلاثي</label>
                        <input 
                          type="text"
                          value={newEmployeeName}
                          onChange={(e) => setNewEmployeeName(e.target.value)}
                          placeholder="مثال: محمد علي حسن"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">المسمى الوظيفي / القسم</label>
                        <input 
                          type="text"
                          value={newEmployeeProfession}
                          onChange={(e) => setNewEmployeeProfession(e.target.value)}
                          placeholder="مثال: مهندس موقع، مشرف، محاسب..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                          required
                        />
                      </div>

                      <PhoneNumbersInput 
                        phoneNumbers={newEmployeePhoneNumbers} 
                        onChange={setNewEmployeePhoneNumbers} 
                      />

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-emerald-700 block">الأجر اليومي (اختياري)</label>
                        <input 
                          type="number"
                          step="any"
                          value={newEmployeeDailyWage}
                          onChange={(e) => setNewEmployeeDailyWage(e.target.value)}
                          placeholder="مثال: 5000 (سيتم احتساب مجموع الأجور تلقائياً)"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:outline-hidden focus:border-emerald-500"
                        />
                        <AmountInWords amount={newEmployeeDailyWage} currency={currency} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">تاريخ البدء</label>
                          <input 
                            type="date"
                            value={newEmployeeStartDate}
                            onChange={(e) => setNewEmployeeStartDate(e.target.value)}
                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">تاريخ الانتهاء (اختياري)</label>
                          <input 
                            type="date"
                            value={newEmployeeEndDate}
                            onChange={(e) => setNewEmployeeEndDate(e.target.value)}
                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                        <textarea 
                          value={newEmployeeNotes}
                          onChange={(e) => setNewEmployeeNotes(e.target.value)}
                          placeholder="أي ملاحظات تفصيلية حول الموظف..."
                          rows={2}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500 resize-none"
                        />
                      </div>

                      {newEmployeeStartDate && (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1 text-xs text-slate-600">
                          <div className="flex justify-between items-center font-semibold">
                            <span>أيام العمل المحتسبة:</span>
                            <span className="font-bold text-indigo-700 text-sm">
                              {calculateDaysOfWork(newEmployeeStartDate, newEmployeeEndDate, sharedRole === 'owner')} يوم
                            </span>
                          </div>
                          {Number(newEmployeeDailyWage) > 0 && (
                            <div className="flex justify-between items-center text-emerald-700 font-extrabold pt-1 border-t border-indigo-100">
                              <span>إجمالي الأجر التلقائي:</span>
                              <span>{formatCurrency(calculateDaysOfWork(newEmployeeStartDate, newEmployeeEndDate, sharedRole === 'owner') * Number(newEmployeeDailyWage), currency)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <button 
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <PlusCircle size={16} />
                        حفظ الموظف الجديد
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Column 2 & 3: Employees list cards */}
            <div className={sharedRole === 'read' ? 'lg:col-span-3 space-y-4' : 'lg:col-span-2 space-y-4'}>
              
              {/* Search Card & Sort Filter */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن موظف بالاسم أو المسمى الوظيفي..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs pr-8 focus:outline-hidden focus:border-indigo-500 transition-colors"
                  />
                  <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-2.5 text-slate-400" />
                </div>
                
                {/* Employees Sort Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shrink-0 w-full sm:w-auto">
                  <span className="text-slate-400 font-medium">الترتيب:</span>
                  <select
                    value={employeeSortOrder}
                    onChange={(e) => setEmployeeSortOrder(e.target.value as 'asc' | 'desc')}
                    className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer text-xs"
                  >
                    <option value="desc">تاريخ البدء: الأحدث أولاً ⬇️ (افتراضي)</option>
                    <option value="asc">تاريخ البدء: الأقدم أولاً ⬆️</option>
                  </select>
                </div>
              </div>

              {/* Employees Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedEmployees.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-xs md:col-span-2">
                    <p className="text-slate-400 text-sm font-medium">لا يوجد موظفون يطابقون البحث</p>
                    <p className="text-xs text-slate-300 mt-1">أدخل موظفين جدداً للبدء في التتبع</p>
                  </div>
                ) : (
                  sortedEmployees.map(emp => {
                    const days = getEmployeeTotalDays(emp, sharedRole === 'owner');
                    const totalOnHim = emp.ledger.reduce((sum, e) => sum + e.amountOnHim, 0);
                    const totalForHim = emp.ledger.reduce((sum, e) => sum + e.amountForHim, 0);
                    const net = totalForHim - totalOnHim;
                    
                    return (
                      <div 
                        key={emp.id}
                        className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:border-indigo-200 transition-all group flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          
                          {/* Header: Name & Profession */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-50 pb-3">
                            <div className="space-y-1">
                              <h3 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                <User size={15} className="text-indigo-500 shrink-0" />
                                {emp.name}
                              </h3>
                              <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                                {emp.profession}
                              </span>
                            </div>
                            <AttributionBadge createdBy={emp.createdBy} updatedBy={emp.updatedBy} />
                          </div>

                          {/* Daily wage & dates */}
                          <div className="space-y-1.5 text-xs text-slate-500">
                            {emp.dailyWage > 0 && (
                              <div className="flex items-center justify-between font-bold text-emerald-700 bg-emerald-50/70 px-2.5 py-1 rounded-lg">
                                <span>الأجر اليومي:</span>
                                <span>{formatCurrency(emp.dailyWage, currency)} / يوم</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[11px]">
                              <span>تاريخ العمل:</span>
                              <span className="font-semibold text-slate-700">{formatDateArabic(emp.startDate)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span>أيام العمل المحتسبة:</span>
                              <span className="font-bold text-indigo-600">{days} يوم</span>
                            </div>
                            <PhoneNumbersDisplay phoneNumbers={emp.phoneNumbers} className="pt-1" />
                          </div>

                          {/* Account Summary breakdown */}
                          <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-slate-500">
                              <span>له (مستحقات أجور):</span>
                              <span className="font-bold text-emerald-600 font-mono">{formatCurrency(totalForHim, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500">
                              <span>عليه (سلف نقدية):</span>
                              <span className="font-bold text-rose-600 font-mono">{formatCurrency(totalOnHim, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center font-bold text-slate-800 pt-1 border-t border-slate-100">
                              <span>الصافي الحالي:</span>
                              <span className={`font-mono ${net > 0 ? 'text-emerald-600 font-black' : net < 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                                {net === 0 ? 'خالص الطرفين' : net > 0 ? `له: ${formatCurrency(net, currency)}` : `عليه: ${formatCurrency(Math.abs(net), currency)}`}
                              </span>
                            </div>
                          </div>

                          {emp.notes && (
                            <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-2 rounded-lg text-right font-medium">
                              <span className="font-bold text-slate-400 text-[10px] block mb-0.5">ملاحظات:</span>
                              {emp.notes}
                            </div>
                          )}

                        </div>

                        {/* Action section footer */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                          <span className="text-xs font-bold text-slate-400">كشف حساب الموظف:</span>
                          
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => setSelectedEmployeeId(emp.id)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-1.5 px-3 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              عرض الكشف
                              <ChevronLeft size={14} className="rotate-180" />
                            </button>
                            {sharedRole !== 'read' && (
                              <button 
                                onClick={() => setEditingEmployee(emp)}
                                className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات وتواريخ الموظف"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {sharedRole !== 'read' && onTransferEmployeeToWorker && (
                              <button 
                                onClick={() => {
                                  if (confirm(`هل ترغب بنقل الموظف "${emp.name}" إلى نافذة العمال؟`)) {
                                    onTransferEmployeeToWorker(emp);
                                  }
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="تحويل لعمال"
                              >
                                <ArrowRightLeft size={14} />
                              </button>
                            )}
                            {sharedRole !== 'read' && sharedRole !== 'add' && (
                              <button 
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف الموظف ${emp.name}؟ سيتم حذف كافة سجلات كشف حسابه تلقائياً.`)) {
                                    onDeleteEmployee(emp.id);
                                  }
                                }}
                                className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="حذف الموظف"
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

      {/* Edit Employee Modal */}
      {editingEmployee && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل بيانات الموظف</h3>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditEmployeeSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">اسم الموظف</label>
                  <input 
                    type="text" 
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">المسمى الوظيفي / التخصص</label>
                  <input 
                    type="text" 
                    value={editingEmployee.profession}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, profession: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>

                <PhoneNumbersInput 
                  phoneNumbers={editingEmployee.phoneNumbers || ['']} 
                  onChange={(phones) => setEditingEmployee({ ...editingEmployee, phoneNumbers: phones })} 
                />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-emerald-700 block">الأجر اليومي (اختياري)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={editingEmployee.dailyWage || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, dailyWage: Number(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                  />
                  <AmountInWords amount={editingEmployee.dailyWage} currency={editingEmployee.currency || 'YER'} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تاريخ بدء العمل</label>
                  <input 
                    type="date" 
                    value={editingEmployee.startDate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تاريخ الانتهاء (اختياري)</label>
                  <input 
                    type="date" 
                    value={editingEmployee.endDate || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات (اختياري)</label>
                  <textarea 
                    value={editingEmployee.notes || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, notes: e.target.value })}
                    rows={2}
                    placeholder="أي ملاحظات..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-hidden focus:border-indigo-500 resize-none"
                  />
                </div>

                {editingEmployee.startDate && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1 text-xs text-slate-700">
                    <div className="flex justify-between items-center font-semibold">
                      <span>المدة الإجمالية:</span>
                      <span className="font-bold text-indigo-700 text-sm">
                        {calculateDaysOfWork(editingEmployee.startDate, editingEmployee.endDate, sharedRole === 'owner')} {editingEmployee.endDate ? 'يوم عمل' : 'يوم عمل حتى اليوم'}
                      </span>
                    </div>
                    {editingEmployee.dailyWage > 0 && (
                      <div className="flex justify-between items-center font-bold text-emerald-700 pt-1 border-t border-indigo-100">
                        <span>إجمالي الأجر اليومي المحتسب:</span>
                        <span>{formatCurrency(calculateDaysOfWork(editingEmployee.startDate, editingEmployee.endDate, sharedRole === 'owner') * editingEmployee.dailyWage, currency)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ledger Entry Modal */}
      {editingEmployeeLedger && (
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
              <h3 className="font-bold text-slate-800 text-base sm:text-lg">تعديل الحركة المالية</h3>
              <button
                type="button"
                onClick={() => setEditingEmployeeLedger(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditEmployeeLedgerSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">التاريخ</label>
                  <input 
                    type="date" 
                    value={editingEmployeeLedger.entry.date}
                    onChange={(e) => setEditingEmployeeLedger({
                      ...editingEmployeeLedger,
                      entry: { ...editingEmployeeLedger.entry, date: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-rose-600 block">المبلغ عليه (سلفة/دفعة)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={editingEmployeeLedger.entry.amountOnHim}
                      onChange={(e) => setEditingEmployeeLedger({
                        ...editingEmployeeLedger,
                        entry: { ...editingEmployeeLedger.entry, amountOnHim: Number(e.target.value) || 0 }
                      })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:outline-hidden focus:border-rose-500"
                    />
                    <AmountInWords amount={editingEmployeeLedger.entry.amountOnHim} currency={editingEmployeeLedger.entry.currency || 'YER'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-600 block">المبلغ له (أجور)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={editingEmployeeLedger.entry.amountForHim}
                      onChange={(e) => setEditingEmployeeLedger({
                        ...editingEmployeeLedger,
                        entry: { ...editingEmployeeLedger.entry, amountForHim: Number(e.target.value) || 0 }
                      })}
                      className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                    />
                    <AmountInWords amount={editingEmployeeLedger.entry.amountForHim} currency={editingEmployeeLedger.entry.currency || 'YER'} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">البيان</label>
                  <input 
                    type="text" 
                    value={editingEmployeeLedger.entry.description}
                    onChange={(e) => setEditingEmployeeLedger({
                      ...editingEmployeeLedger,
                      entry: { ...editingEmployeeLedger.entry, description: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">العملة</label>
                  <select
                    value={editingEmployeeLedger.entry.currency || currency || 'YER'}
                    onChange={(e) => setEditingEmployeeLedger({
                      ...editingEmployeeLedger,
                      entry: { ...editingEmployeeLedger.entry, currency: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-bold focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="YER">ريال يمني (YER)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">ملاحظات</label>
                  <input 
                    type="text" 
                    value={editingEmployeeLedger.entry.notes || ''}
                    onChange={(e) => setEditingEmployeeLedger({
                      ...editingEmployeeLedger,
                      entry: { ...editingEmployeeLedger.entry, notes: e.target.value }
                    })}
                    className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingEmployeeLedger(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  حفظ التعديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
