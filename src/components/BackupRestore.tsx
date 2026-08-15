import React, { useState, useRef } from 'react';
import PageHeaderCard from './PageHeaderCard';
import { 
  Database, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  FileJson, 
  ShieldCheck, 
  HardDrive, 
  Info, 
  X, 
  Layers, 
  Save, 
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Users,
  Briefcase,
  Truck,
  Wallet,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBodyScrollLock } from '../utils/modalScrollLock';
import { 
  Worker, 
  Supplier, 
  Employee, 
  Expense, 
  BudgetItem, 
  formatCurrency,
  getFormattedReportDate,
  ensureDateInFilename
} from '../types';

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

interface BackupRestoreProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  budget: BudgetItem[];
  setBudget: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  currency: string;
  setCurrency: (c: string) => void;
  projectName: string;
  setProjectName: (p: string) => void;
  companyName: string;
  setCompanyName: (c: string) => void;
  companyAddress: string;
  setCompanyAddress: (a: string) => void;
  companyPhone: string;
  setCompanyPhone: (p: string) => void;
  userName: string;
  setUserName: (u: string) => void;
  setActiveTab: (tab: string) => void;
  sharedRole: 'owner' | 'read' | 'add' | 'full';
}

export default function BackupRestore({
  expenses,
  setExpenses,
  workers,
  setWorkers,
  employees,
  setEmployees,
  suppliers,
  setSuppliers,
  budget,
  setBudget,
  currency,
  setCurrency,
  projectName,
  setProjectName,
  companyName,
  setCompanyName,
  companyAddress,
  setCompanyAddress,
  companyPhone,
  setCompanyPhone,
  userName,
  setUserName,
  setActiveTab,
  sharedRole
}: BackupRestoreProps) {

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [importModalData, setImportModalData] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Lock background scroll when restore modal is open
  useBodyScrollLock(Boolean(importModalData));

  // Helper to fetch external debts from localStorage
  const getExternalDebtsFromStorage = (): ExternalDebtAccount[] => {
    try {
      const saved = localStorage.getItem('site_external_debts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  };

  // Calculations for quick metrics display
  const totalExpensesCount = expenses.length;
  const totalWorkersCount = workers.length;
  const totalEmployeesCount = employees.length;
  const totalSuppliersCount = suppliers.length;
  const totalBudgetCount = budget.length;

  const externalDebts = getExternalDebtsFromStorage();
  const totalExternalDebtsCount = externalDebts.length;

  const totalWorkerLedgerCount = workers.reduce((acc, w) => acc + (w.ledger ? w.ledger.length : 0), 0);
  const totalEmployeeLedgerCount = employees.reduce((acc, e) => acc + (e.ledger ? e.ledger.length : 0), 0);
  const totalSupplierLedgerCount = suppliers.reduce((acc, s) => acc + (s.ledger ? s.ledger.length : 0), 0);
  const totalExternalLedgerCount = externalDebts.reduce((acc, ext) => acc + (ext.ledger ? ext.ledger.length : 0), 0);

  const grandTotalOperationsCount = totalExpensesCount + totalWorkerLedgerCount + totalEmployeeLedgerCount + totalSupplierLedgerCount + totalBudgetCount + totalExternalLedgerCount;

  // Show toast notification
  const triggerToast = (msg: string) => {
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast(msg);
    } else {
      alert(msg);
    }
  };

  // 1. EXPORT FULL SYSTEM JSON BACKUP
  const handleExportJSON = () => {
    try {
      setIsProcessing(true);
      const backupData = {
        app: 'نظام إدارة المقاولات والمشاريع',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        settings: {
          projectName,
          companyName,
          companyAddress,
          companyPhone,
          currency,
          userName
        },
        data: {
          expenses,
          workers,
          employees,
          suppliers,
          budget,
          externalDebts
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const dateStr = getFormattedReportDate();
      const cleanProjName = (projectName || 'المشروع').replace(/[/\\?%*:|"<>]/g, '_');
      link.href = url;
      link.download = ensureDateInFilename(`نسخة_احتياطية_شاملة_${cleanProjName}_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast('✅ تم استخراج وحفظ النسخة الاحتياطية الشاملة بملف JSON بنجاح!');
    } catch (err) {
      console.error('Error exporting JSON backup:', err);
      triggerToast('⚠️ حدث خطأ أثناء إنشاء النسخة الاحتياطية!');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. READ JSON FILE FOR IMPORT
  const handleJSONFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Standardize parsed content structure
        let payloadData = parsed.data || parsed;
        let payloadSettings = parsed.settings || {};

        if (!payloadData.expenses && !payloadData.workers && !payloadData.suppliers && !payloadData.employees && !payloadData.budget) {
          triggerToast('⚠️ الملف المحدد لا يحتوي على بيانات مقبولة للنسخ الاحتياطي!');
          return;
        }

        setImportModalData({
          fileDate: parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('ar-YE') : 'غير محدد',
          settings: payloadSettings,
          expenses: Array.isArray(payloadData.expenses) ? payloadData.expenses : [],
          workers: Array.isArray(payloadData.workers) ? payloadData.workers : [],
          employees: Array.isArray(payloadData.employees) ? payloadData.employees : [],
          suppliers: Array.isArray(payloadData.suppliers) ? payloadData.suppliers : [],
          budget: Array.isArray(payloadData.budget) ? payloadData.budget : [],
          externalDebts: Array.isArray(payloadData.externalDebts) ? payloadData.externalDebts : []
        });
      } catch (err) {
        console.error('Error parsing JSON backup file:', err);
        triggerToast('⚠️ الملف المحدد غير صالح أو تالف! يرجى اختيار ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. EXECUTE RESTORE JSON
  const handleConfirmJSONRestore = () => {
    if (!importModalData) return;

    try {
      setIsProcessing(true);

      if (importMode === 'overwrite') {
        // OVERWRITE FULLY
        setExpenses(importModalData.expenses);
        setWorkers(importModalData.workers);
        setEmployees(importModalData.employees);
        setSuppliers(importModalData.suppliers);
        setBudget(importModalData.budget);

        // External debts localStorage
        localStorage.setItem('site_external_debts', JSON.stringify(importModalData.externalDebts));
        localStorage.setItem('site_expenses', JSON.stringify(importModalData.expenses));
        localStorage.setItem('site_workers', JSON.stringify(importModalData.workers));
        localStorage.setItem('site_workers_backup', JSON.stringify(importModalData.workers));
        localStorage.setItem('site_employees', JSON.stringify(importModalData.employees));
        localStorage.setItem('site_employees_backup', JSON.stringify(importModalData.employees));
        localStorage.setItem('site_suppliers', JSON.stringify(importModalData.suppliers));
        localStorage.setItem('site_budget', JSON.stringify(importModalData.budget));

        if (importModalData.settings) {
          if (importModalData.settings.projectName) {
            setProjectName(importModalData.settings.projectName);
            localStorage.setItem('site_project_name', importModalData.settings.projectName);
          }
          if (importModalData.settings.companyName) {
            setCompanyName(importModalData.settings.companyName);
            localStorage.setItem('site_company_name', importModalData.settings.companyName);
          }
          if (importModalData.settings.companyAddress) {
            setCompanyAddress(importModalData.settings.companyAddress);
            localStorage.setItem('site_company_address', importModalData.settings.companyAddress);
          }
          if (importModalData.settings.companyPhone) {
            setCompanyPhone(importModalData.settings.companyPhone);
            localStorage.setItem('site_company_phone', importModalData.settings.companyPhone);
          }
          if (importModalData.settings.currency) {
            setCurrency(importModalData.settings.currency);
            localStorage.setItem('site_currency', importModalData.settings.currency);
          }
        }

        triggerToast('✅ تم استعادة واستبدال كافة بيانات النظام بنجاح بدون فقدان أي تفاصيل!');
      } else {
        // MERGE DATA
        const mergeArrays = (current: any[], incoming: any[]) => {
          const map = new Map();
          current.forEach(item => map.set(item.id, item));
          incoming.forEach(item => {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        };

        const mergedExpenses = mergeArrays(expenses, importModalData.expenses);
        const mergedWorkers = mergeArrays(workers, importModalData.workers);
        const mergedEmployees = mergeArrays(employees, importModalData.employees);
        const mergedSuppliers = mergeArrays(suppliers, importModalData.suppliers);
        const mergedBudget = mergeArrays(budget, importModalData.budget);
        const mergedExternal = mergeArrays(externalDebts, importModalData.externalDebts);

        setExpenses(mergedExpenses);
        setWorkers(mergedWorkers);
        setEmployees(mergedEmployees);
        setSuppliers(mergedSuppliers);
        setBudget(mergedBudget);

        localStorage.setItem('site_expenses', JSON.stringify(mergedExpenses));
        localStorage.setItem('site_workers', JSON.stringify(mergedWorkers));
        localStorage.setItem('site_employees', JSON.stringify(mergedEmployees));
        localStorage.setItem('site_suppliers', JSON.stringify(mergedSuppliers));
        localStorage.setItem('site_budget', JSON.stringify(mergedBudget));
        localStorage.setItem('site_external_debts', JSON.stringify(mergedExternal));

        triggerToast('✅ تم دمج البيانات الجديدة مع البيانات الحالية بنجاح!');
      }

      setImportModalData(null);
    } catch (err) {
      console.error('Error executing JSON restore:', err);
      triggerToast('⚠️ حدث خطأ أثناء تنفيذ استعادة البيانات!');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. EXPORT ALL PROJECT WINDOWS TO MULTI-SHEET EXCEL
  const handleExportMultiSheetExcel = () => {
    try {
      setIsProcessing(true);
      const wb = XLSX.utils.book_new();

      // --- SHEET 1: GENERAL SUMMARY ---
      const summaryRows = [
        ['معلومات مشروع المقاولات - التقرير والنسخة الشاملة'],
        ['اسم المشروع:', projectName || 'المشروع الرئيسي'],
        ['اسم الشركة / المؤسسة:', companyName],
        ['العنوان والهاتف:', `${companyAddress} - ${companyPhone}`],
        ['تاريخ التصدير:', new Date().toLocaleDateString('ar-YE')],
        ['العملة الرئيسية:', currency],
        [''],
        ['الملخص المالي والعددي للنوافذ:'],
        ['النافذة / القسم', 'عدد السجلات', 'إجمالي العمليات'],
        ['المصروفات اليومية', expenses.length, expenses.reduce((a, b) => a + (b.amount || 0), 0)],
        ['العمال والمقاولين', workers.length, totalWorkerLedgerCount],
        ['الموظفين والمهندسين', employees.length, totalEmployeeLedgerCount],
        ['الموردين والشركات', suppliers.length, totalSupplierLedgerCount],
        ['تمويل الميزانية العامة', budget.length, budget.reduce((a, b) => a + (b.amount || 0), 0)],
        ['الديون والالتزامات الخارجية', externalDebts.length, totalExternalLedgerCount]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'المعلومات والملخص');

      // --- SHEET 2: DAILY EXPENSES ---
      const expenseHeaders = ['الرقم التعريف', 'التاريخ', 'المبلغ', 'العملة', 'المستفيد / الجهة', 'نوع المستفيد', 'البيان / السبب', 'ملاحظات'];
      const expenseRows = expenses.map(e => [
        e.id,
        e.date || '',
        e.amount || 0,
        e.currency || currency,
        e.recipientName || 'غير محدد',
        e.recipientType === 'worker' ? 'عامل' : e.recipientType === 'employee' ? 'موظف' : e.recipientType === 'supplier' ? 'مورد' : 'عام',
        e.description || '',
        e.notes || ''
      ]);
      const wsExpenses = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseRows]);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات اليومية');

      // --- SHEET 3: WORKERS LIST ---
      const workerHeaders = ['الرقم التعريف', 'اسم العامل / المقاول', 'المهنة / التخصص', 'تاريخ البدء', 'تاريخ الانتهاء', 'إجمالي له', 'إجمالي عليه', 'الصافي'];
      const workerRows = workers.map(w => {
        const totalForHim = (w.ledger || []).reduce((a, b) => a + (b.amountForHim || 0), 0);
        const totalOnHim = (w.ledger || []).reduce((a, b) => a + (b.amountOnHim || 0), 0);
        return [
          w.id,
          w.name,
          w.profession || '',
          w.startDate || '',
          w.endDate || 'مستمر',
          totalForHim,
          totalOnHim,
          totalForHim - totalOnHim
        ];
      });
      const wsWorkers = XLSX.utils.aoa_to_sheet([workerHeaders, ...workerRows]);
      XLSX.utils.book_append_sheet(wb, wsWorkers, 'سجل العمال');

      // --- SHEET 4: WORKER LEDGER DETAILS ---
      const workerLedgerHeaders = ['اسم العامل', 'تاريخ الحركة', 'له (مستحقات)', 'عليه (سلفة/دفعة)', 'البيان', 'ملاحظات'];
      const workerLedgerRows: any[] = [];
      workers.forEach(w => {
        (w.ledger || []).forEach(l => {
          workerLedgerRows.push([
            w.name,
            l.date || '',
            l.amountForHim || 0,
            l.amountOnHim || 0,
            l.description || '',
            l.notes || ''
          ]);
        });
      });
      const wsWorkerLedger = XLSX.utils.aoa_to_sheet([workerLedgerHeaders, ...workerLedgerRows]);
      XLSX.utils.book_append_sheet(wb, wsWorkerLedger, 'حركات كشف العمال');

      // --- SHEET 5: EMPLOYEES LIST ---
      const empHeaders = ['الرقم التعريف', 'اسم الموظف / المهندس', 'المسمى الوظيفي', 'الأجر اليومي', 'تاريخ البدء', 'تاريخ الانتهاء', 'إجمالي له', 'إجمالي عليه', 'الصافي'];
      const empRows = employees.map(e => {
        const totalForHim = (e.ledger || []).reduce((a, b) => a + (b.amountForHim || 0), 0);
        const totalOnHim = (e.ledger || []).reduce((a, b) => a + (b.amountOnHim || 0), 0);
        return [
          e.id,
          e.name,
          e.profession || '',
          e.dailyWage || 0,
          e.startDate || '',
          e.endDate || 'مستمر',
          totalForHim,
          totalOnHim,
          totalForHim - totalOnHim
        ];
      });
      const wsEmployees = XLSX.utils.aoa_to_sheet([empHeaders, ...empRows]);
      XLSX.utils.book_append_sheet(wb, wsEmployees, 'سجل الموظفين');

      // --- SHEET 6: EMPLOYEE LEDGER DETAILS ---
      const empLedgerHeaders = ['اسم الموظف', 'تاريخ الحركة', 'له (مستحقات/راتب)', 'عليه (سلفة/خصم)', 'البيان', 'ملاحظات'];
      const empLedgerRows: any[] = [];
      employees.forEach(e => {
        (e.ledger || []).forEach(l => {
          empLedgerRows.push([
            e.name,
            l.date || '',
            l.amountForHim || 0,
            l.amountOnHim || 0,
            l.description || '',
            l.notes || ''
          ]);
        });
      });
      const wsEmpLedger = XLSX.utils.aoa_to_sheet([empLedgerHeaders, ...empLedgerRows]);
      XLSX.utils.book_append_sheet(wb, wsEmpLedger, 'حركات كشف الموظفين');

      // --- SHEET 7: SUPPLIERS LIST ---
      const supplierHeaders = ['الرقم التعريف', 'اسم المورد / الشركة', 'نوع التوريد / المواد', 'إجمالي له', 'إجمالي عليه', 'الصافي'];
      const supplierRows = suppliers.map(s => {
        const totalForHim = (s.ledger || []).reduce((a, b) => a + (b.amountForHim || 0), 0);
        const totalOnHim = (s.ledger || []).reduce((a, b) => a + (b.amountOnHim || 0), 0);
        return [
          s.id,
          s.name,
          s.materialType || '',
          totalForHim,
          totalOnHim,
          totalForHim - totalOnHim
        ];
      });
      const wsSuppliers = XLSX.utils.aoa_to_sheet([supplierHeaders, ...supplierRows]);
      XLSX.utils.book_append_sheet(wb, wsSuppliers, 'سجل الموردين');

      // --- SHEET 8: SUPPLIER LEDGER DETAILS ---
      const supplierLedgerHeaders = ['اسم المورد', 'تاريخ الحركة', 'له (توريدات بالآجل)', 'عليه (سداد نقد)', 'البيان', 'ملاحظات'];
      const supplierLedgerRows: any[] = [];
      suppliers.forEach(s => {
        (s.ledger || []).forEach(l => {
          supplierLedgerRows.push([
            s.name,
            l.date || '',
            l.amountForHim || 0,
            l.amountOnHim || 0,
            l.description || '',
            l.notes || ''
          ]);
        });
      });
      const wsSupplierLedger = XLSX.utils.aoa_to_sheet([supplierLedgerHeaders, ...supplierLedgerRows]);
      XLSX.utils.book_append_sheet(wb, wsSupplierLedger, 'حركات كشف الموردين');

      // --- SHEET 9: BUDGET & FUNDING ---
      const budgetHeaders = ['الرقم التعريف', 'بند التمويل / البيان', 'المبلغ المعتمد', 'العملة', 'تاريخ الاعتماد', 'الملاحظات'];
      const budgetRows = budget.map(b => [
        b.id,
        b.description || '',
        b.amount || 0,
        b.currency || currency,
        b.date || '',
        b.notes || ''
      ]);
      const wsBudget = XLSX.utils.aoa_to_sheet([budgetHeaders, ...budgetRows]);
      XLSX.utils.book_append_sheet(wb, wsBudget, 'الميزانية والتمويل');

      // --- SHEET 10: EXTERNAL DEBTS & COMMITMENTS ---
      const debtHeaders = ['اسم الجهة / الدائن الخارجي', 'الصفة / التخصص', 'تاريخ الحركة', 'له (التزام دائن)', 'عليه (سداد/سلفة)', 'البيان', 'العملة', 'ملاحظات'];
      const debtRows: any[] = [];
      externalDebts.forEach(ext => {
        (ext.ledger || []).forEach(l => {
          debtRows.push([
            ext.name,
            ext.profession || '',
            l.date || '',
            l.amountForHim || 0,
            l.amountOnHim || 0,
            l.description || '',
            l.currency || currency,
            l.notes || ''
          ]);
        });
      });
      const wsDebts = XLSX.utils.aoa_to_sheet([debtHeaders, ...debtRows]);
      XLSX.utils.book_append_sheet(wb, wsDebts, 'الديون والالتزامات الخارجية');

      // DOWNLOAD FILE
      const cleanProjName = (projectName || 'المشروع').replace(/[/\\?%*:|"<>]/g, '_');
      const filename = ensureDateInFilename(`بيانات_المشروع_الشاملة_${cleanProjName}_${getFormattedReportDate()}.xlsx`);
      XLSX.writeFile(wb, filename);

      triggerToast('✅ تم تصدير كافة بيانات ونوافذ المشروع في ملف Excel واحد متعدد الصفحات بنجاح!');
    } catch (err) {
      console.error('Error exporting multi-sheet Excel:', err);
      triggerToast('⚠️ حدث خطأ أثناء تصدير ملف Excel الشامل!');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. READ EXCEL FILE FOR IMPORT RECOVERY
  const handleExcelFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let newExpenses: Expense[] = [];
        let newWorkers: Worker[] = [];
        let newEmployees: Employee[] = [];
        let newSuppliers: Supplier[] = [];
        let newBudget: BudgetItem[] = [];

        // Parse Expenses Sheet if present
        const expenseSheetName = workbook.SheetNames.find(s => s.includes('مصروفات') || s.includes('نفقات') || s.includes('Expenses'));
        if (expenseSheetName) {
          const sheet = workbook.Sheets[expenseSheetName];
          const rows = XLSX.utils.sheet_to_json<any>(sheet);
          rows.forEach((r, idx) => {
            const amount = parseFloat(r['المبلغ'] || r['amount'] || 0);
            if (amount > 0) {
              newExpenses.push({
                id: r['الرقم التعريف'] || `exp_imp_${Date.now()}_${idx}`,
                date: r['التاريخ'] || new Date().toISOString().split('T')[0],
                amount: amount,
                currency: r['العملة'] || currency,
                recipientId: '',
                recipientName: r['المستفيد / الجهة'] || r['المستفيد'] || '',
                recipientType: 'none',
                description: r['البيان / السبب'] || r['البيان'] || 'مصروف مستورد',
                notes: r['ملاحظات'] || ''
              });
            }
          });
        }

        // Parse Budget Sheet
        const budgetSheetName = workbook.SheetNames.find(s => s.includes('ميزانية') || s.includes('تمويل') || s.includes('Budget'));
        if (budgetSheetName) {
          const sheet = workbook.Sheets[budgetSheetName];
          const rows = XLSX.utils.sheet_to_json<any>(sheet);
          rows.forEach((r, idx) => {
            const amount = parseFloat(r['المبلغ المعتمد'] || r['المبلغ'] || 0);
            if (amount > 0) {
              newBudget.push({
                id: r['الرقم التعريف'] || `bud_imp_${Date.now()}_${idx}`,
                description: r['مصدر التمويل / البند'] || r['بند التمويل'] || r['البيان'] || 'بند مستورد',
                amount: amount,
                currency: r['العملة'] || currency,
                date: r['تاريخ الاعتماد'] || new Date().toISOString().split('T')[0],
                notes: r['الملاحظات'] || ''
              });
            }
          });
        }

        if (newExpenses.length > 0 || newBudget.length > 0) {
          if (newExpenses.length > 0) setExpenses(prev => [...prev, ...newExpenses]);
          if (newBudget.length > 0) setBudget(prev => [...prev, ...newBudget]);

          triggerToast(`✅ تم استيراد البيانات من ملف Excel بنجاح! (${newExpenses.length} مصروف، ${newBudget.length} بند ميزانية)`);
        } else {
          triggerToast('⚠️ لم يتم العثور على أسطر بيانات متطابقة في ملف Excel. تأكد من مطابقة أسماء الأعمدة.');
        }

      } catch (err) {
        console.error('Error importing Excel:', err);
        triggerToast('⚠️ حدث خطأ أثناء قراءة واستيراد ملف Excel!');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 dir-rtl text-right animate-fade-in pb-16">
      
      {/* Top Banner Header */}
      <PageHeaderCard
        title="إدارة النسخ الاحتياطي واستعادة البيانات"
        description="حفظ وحماية كافة بيانات وسجلات المشروع واستعادتها بضغطة زر وتصدير ملفات Excel."
        icon={<Database size={20} />}
        onBack={setActiveTab ? () => setActiveTab('dashboard') : undefined}
      />

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={jsonInputRef} 
        onChange={handleJSONFileSelected} 
        accept=".json" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={excelInputRef} 
        onChange={handleExcelFileSelected} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      {/* Current System Data Summary Metrics */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-amber-600" />
            <h3 className="text-sm font-black text-slate-900">سجلات وبيانات المشروع المسجلة في النظام حالياً</h3>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
            إجمالي السجلات: {grandTotalOperationsCount} سجل
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">المصروفات</span>
              <TrendingUp size={15} className="text-rose-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalExpensesCount}</div>
            <div className="text-[10px] text-slate-400">عملية مصروفة</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">العمال والمقاولين</span>
              <Users size={15} className="text-sky-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalWorkersCount}</div>
            <div className="text-[10px] text-slate-400">{totalWorkerLedgerCount} حركة كشف</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">الموظفين والمهندسين</span>
              <Briefcase size={15} className="text-indigo-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalEmployeesCount}</div>
            <div className="text-[10px] text-slate-400">{totalEmployeeLedgerCount} حركة كشف</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">الموردين والشركات</span>
              <Truck size={15} className="text-amber-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalSuppliersCount}</div>
            <div className="text-[10px] text-slate-400">{totalSupplierLedgerCount} حركة كشف</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">الميزانية والتمويل</span>
              <Wallet size={15} className="text-emerald-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalBudgetCount}</div>
            <div className="text-[10px] text-slate-400">بنود معتمدة</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold">الديون الخارجية</span>
              <Coins size={15} className="text-purple-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{totalExternalDebtsCount}</div>
            <div className="text-[10px] text-slate-400">{totalExternalLedgerCount} حركة التزام</div>
          </div>

        </div>
      </div>

      {/* Main Actions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Full System JSON Backup & Restore */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/15 text-amber-700 rounded-2xl">
                <FileJson size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">النسخ الاحتياطي والاستعادة الشاملة (JSON)</h3>
                <p className="text-[11px] text-slate-400">حفظ كافة بيانات المشروع بنفس الترتيب والتفاصيل لضمان عدم فقدان أي شيء</p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/60 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <ShieldCheck size={16} className="text-amber-600" />
                <span>مميزات ملف النسخة الاحتياطية (JSON):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pr-1">
                <li>يحفظ المصروفات اليومية وكشوف حسابات العمال، الموظفين، والموردين.</li>
                <li>يحفظ كشوف الديون والالتزامات المالية الخارجية والميزانية المعتمدة.</li>
                <li>يضمن استعادة البيانات بالكامل بدون خلط أو تغيير في الهيكلية.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={handleExportJSON}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={17} />
              <span>إنشاء وتحميل نسخة احتياطية لكافة بيانات النظام (.json)</span>
            </button>

            <button
              onClick={() => jsonInputRef.current?.click()}
              disabled={isProcessing || sharedRole === 'read'}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload size={17} className="text-amber-400" />
              <span>استعادة كافة البيانات من ملف نسخة احتياطية (.json)</span>
            </button>
          </div>
        </div>

        {/* Card 2: Full Multi-Sheet Excel Export & Import */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-500/15 text-emerald-700 rounded-2xl">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تصدير واستيراد Excel الشامل (Multi-Sheet)</h3>
                <p className="text-[11px] text-slate-400">تصدير كافة النوافذ والعمليات إلى ملف اكسل يحتوي على صفحة منفصلة لكل نافذة</p>
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/60 p-3.5 rounded-2xl text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                <Layers size={16} className="text-emerald-600" />
                <span>صفحات ملف Excel الناتجة:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-800 pr-1">
                <li>صفحة للمصروفات، صفحة لكل من العمال والموظفين والموردين والديون والميزانية.</li>
                <li>تطابق كامل بين أعمدة وصفوح التطبيق وخلايا ملف الاكسل.</li>
                <li>يمكن مراجعة البيانات في إكسل أو استيرادها لاحقاً وتجميعها بسهولة.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={handleExportMultiSheetExcel}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={17} />
              <span>تصدير كافة بيانات النوافذ إلى ملف Excel متعدد الصفحات (.xlsx)</span>
            </button>

            <button
              onClick={() => excelInputRef.current?.click()}
              disabled={isProcessing || sharedRole === 'read'}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-2xl border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload size={17} className="text-emerald-600" />
              <span>استيراد وتغذية البيانات من ملف Excel (.xlsx)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Safety & Local Security Notice */}
      <div className="bg-slate-900 text-slate-200 p-6 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <Info size={18} />
          <span>ملاحظات هامة حول حماية واستعادة البيانات:</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          جميع بيانات المشروع (المصروفات، أجور العمال، رواتب الموظفين والمهندسين، فواتير الموردين، والميزانية العامة) مخزنة بأمان على جهازك أو هاتفك. يُنصح دائماً بإنشاء نسخة احتياطية بصفة دورية (أسبوعياً أو شهرياً) وحفظ الملف في مكان آمن كالبريد الإلكتروني أو ذاكرة الهاتف الخارجية لضمان حماية بياناتك كاملة من الفقدان.
        </p>
      </div>

      {/* MODAL: INSPECT & CONFIRM JSON RESTORE */}
      {importModalData && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-5 my-auto dir-rtl text-right overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-700 rounded-xl">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تأكيد استعادة بيانات النسخة الاحتياطية</h3>
                  <p className="text-[11px] text-slate-400">مراجعة المحتويات قبل تطبيق الاستعادة في التطبيق</p>
                </div>
              </div>
              <button
                onClick={() => setImportModalData(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-800">تفاصيل ملف النسخة الاحتياطية:</div>
                <div className="text-slate-600 text-[11px]">اسم المشروع: <strong className="text-slate-900">{importModalData.settings?.projectName || 'غير محدد'}</strong></div>
                <div className="text-slate-600 text-[11px]">تاريخ الإنشاء: <strong className="text-slate-900">{importModalData.fileDate}</strong></div>
              </div>

              <div className="font-bold text-slate-800 pt-1">محتويات النسخة الاحتياطية الجاهزة للاستعادة:</div>
              
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-rose-50 border border-rose-200/60 rounded-xl flex items-center justify-between">
                  <span>المصروفات اليومية:</span>
                  <strong className="text-rose-700 font-black">{importModalData.expenses.length} سجل</strong>
                </div>
                <div className="p-2.5 bg-sky-50 border border-sky-200/60 rounded-xl flex items-center justify-between">
                  <span>سجل العمال والمقاولين:</span>
                  <strong className="text-sky-700 font-black">{importModalData.workers.length} عامل</strong>
                </div>
                <div className="p-2.5 bg-indigo-50 border border-indigo-200/60 rounded-xl flex items-center justify-between">
                  <span>سجل الموظفين والمهندسين:</span>
                  <strong className="text-indigo-700 font-black">{importModalData.employees.length} موظف</strong>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center justify-between">
                  <span>سجل الموردين والشركات:</span>
                  <strong className="text-amber-700 font-black">{importModalData.suppliers.length} مورد</strong>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center justify-between">
                  <span>بنود الميزانية والتمويل:</span>
                  <strong className="text-emerald-700 font-black">{importModalData.budget.length} بند</strong>
                </div>
                <div className="p-2.5 bg-purple-50 border border-purple-200/60 rounded-xl flex items-center justify-between">
                  <span>الديون والالتزامات الخارجية:</span>
                  <strong className="text-purple-700 font-black">{importModalData.externalDebts.length} حساب</strong>
                </div>
              </div>

              {/* Mode Options */}
              <div className="pt-2">
                <label className="block text-slate-800 font-bold mb-1.5">اختر طريقة الاستعادة المطلوب تنفيذها:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('overwrite')}
                    className={`p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                      importMode === 'overwrite'
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-extrabold text-amber-900">🔴 استبدال شامل لكل البيانات</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">مسح البيانات الحالية وتطبيق بيانات النسخة الاحتياطية تماماً</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                      importMode === 'merge'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-extrabold text-sky-900">🔵 دمج مع البيانات الحالية</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">إضافة العناصر الجديدة بدون مسح السجلات القائمة في النظام</div>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmJSONRestore}
                disabled={isProcessing}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                <span>تأفيذ استعادة البيانات الآن</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
