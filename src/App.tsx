/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Truck, 
  Wallet,
  Menu,
  X,
  Calculator,
  Printer,
  FileText,
  Download,
  Briefcase,
  Coins,
  LogOut,
  Database,
  Lock,
  Building2,
  ArrowRight,
  Settings
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import DailyExpenses from './components/DailyExpenses';
import Workers from './components/Workers';
import Employees from './components/Employees';
import Suppliers from './components/Suppliers';
import Budget from './components/Budget';
import FinancialReports from './components/FinancialReports';
import Debts from './components/Debts';
import BackupRestore from './components/BackupRestore';
import ProjectsHub from './components/ProjectsHub';
import AttributionBadge from './components/AttributionBadge';
import BottomNavigation from './components/BottomNavigation';
import SettingsModal from './components/SettingsModal';
import { useBodyScrollLock } from './utils/modalScrollLock';

// Types & Helpers
import { COMPANY_LOGO_BASE64 } from './companyLogo';
import { Project, Expense, Worker, Employee, Supplier, BudgetItem, LedgerEntry, NutritionPeriod, calculateDaysOfWork, formatDateArabic, ensureDateInFilename, syncWorkerNutritionLedger } from './types';

// Seed Initial Data if empty so the user starts with a realistic sandbox
const SEED_BUDGET: BudgetItem[] = [
  {
    id: 'bud_seed_1',
    date: '2026-06-01',
    amount: 15000000,
    description: 'رأس مال المشروع المخصص من المستثمر دفعة أولى',
    notes: 'تم استلام المبلغ نقداً في الموقع'
  }
];

const SEED_WORKERS: Worker[] = [
  {
    id: 'worker_seed_1',
    name: 'أحمد جاسم كريم',
    profession: 'خلفة بناء طابوق',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    ledger: [
      {
        id: 'wled_seed_1',
        date: '2026-06-01',
        amountOnHim: 0,
        amountForHim: 1200000,
        description: 'أجور مستحقة عن النصف الأول من الشهر',
        notes: 'محتسب على أساس 15 يوم عمل'
      },
      {
        id: 'wled_seed_2',
        date: '2026-06-10',
        amountOnHim: 150000,
        amountForHim: 0,
        description: 'سلفة نقدية طارئة',
        notes: 'تم التسليم باليد'
      }
    ]
  },
  {
    id: 'worker_seed_2',
    name: 'سعدون أبو ميثم',
    profession: 'خلفة نجار مسلح',
    startDate: '2026-06-05',
    endDate: '2026-06-25',
    ledger: [
      {
        id: 'wled_seed_3',
        date: '2026-06-15',
        amountOnHim: 0,
        amountForHim: 900000,
        description: 'أجر متفق عليه عن صبة السقف الأول',
        notes: 'تم إنجاز الصب بنجاح'
      }
    ]
  }
];

const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'emp_fikri',
    name: 'فكري',
    profession: 'مهندس',
    startDate: '2026-05-01',
    endDate: '',
    dailyWage: 0,
    createdBy: 'إدارة المشروع',
    ledger: [
      {
        id: 'eled_fikri_1',
        date: '2026-05-10',
        amountOnHim: 0,
        amountForHim: 200000,
        description: 'مستحقات أجر وإشراف هندسي وتصميم خرائط خرسانية',
        notes: 'مستحقات هندسية مرحلة من نافذة العمال',
        currency: 'YER',
        createdBy: 'إدارة المشروع'
      },
      {
        id: 'eled_fikri_2',
        date: '2026-06-01',
        amountOnHim: 0,
        amountForHim: 143275,
        description: 'مستحقات أجر وإشراف هندسي وتدقيق مقاسات التنفيذ',
        notes: 'مستحقات إضافية معتمدة',
        currency: 'YER',
        createdBy: 'إدارة المشروع'
      },
      {
        id: 'eled_fikri_3',
        date: '2026-05-18',
        amountOnHim: 250000,
        amountForHim: 0,
        description: 'سلفة نقدية أولى تسليم موقع',
        notes: 'سند صرف نقدي من الصندوق',
        currency: 'YER',
        createdBy: 'المحاسب'
      },
      {
        id: 'eled_fikri_4',
        date: '2026-06-05',
        amountOnHim: 175000,
        amountForHim: 0,
        description: 'سلفة نقدية ثانية عبر حوالة مالية',
        notes: 'سند صرف رقم 108',
        currency: 'YER',
        createdBy: 'المحاسب'
      },
      {
        id: 'eled_fikri_5',
        date: '2026-06-18',
        amountOnHim: 100000,
        amountForHim: 0,
        description: 'سلفة نقدية ثالثة ومصاريف شخصية',
        notes: 'مقيدة على حسابه الشخصي',
        currency: 'YER',
        createdBy: 'المحاسب'
      }
    ]
  }
];

const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'supplier_seed_1',
    name: 'شركة الرافدين للإسمنت والحديد',
    materialType: 'إسمنت مقاوم وحديد تسليح',
    ledger: [
      {
        id: 'sled_seed_1',
        date: '2026-06-02',
        amountOnHim: 0,
        amountForHim: 4500000,
        description: 'توريد 10 طن إسمنت مقاوم عراقي',
        notes: 'سعر الطن 450 ألف'
      },
      {
        id: 'sled_seed_2',
        date: '2026-06-03',
        amountOnHim: 3000000,
        amountForHim: 0,
        description: 'دفعة نقدية أولى تسديد للمواد المستلمة',
        notes: 'تم التحويل بموجب وصل استلام رقم 4829'
      }
    ]
  }
];

const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp_seed_1',
    date: '2026-06-03',
    amount: 3000000,
    description: 'تسديد دفعة لشركة الرافدين للإسمنت والحديد',
    notes: 'تم ترحيلها لحساب المورد تلقائياً',
    recipientId: 'supplier_seed_1',
    recipientType: 'supplier',
    recipientName: 'شركة الرافدين للإسمنت والحديد'
  },
  {
    id: 'exp_seed_2',
    date: '2026-06-10',
    amount: 150000,
    description: 'سلفة نقدية طارئة - أحمد جاسم كريم',
    notes: 'تم ترحيلها لحساب العامل تلقائياً',
    recipientId: 'worker_seed_1',
    recipientType: 'worker',
    recipientName: 'أحمد جاسم كريم'
  },
  {
    id: 'exp_seed_fikri_1',
    date: '2026-06-06',
    amount: 100000,
    description: 'سلفة نقدية طارئة من الصندوق - فكري',
    notes: 'تم ترحيلها لحساب الموظف فكري تلقائياً',
    recipientId: 'emp_fikri',
    recipientType: 'employee',
    recipientName: 'فكري',
    currency: 'YER'
  },
  {
    id: 'exp_seed_fikri_2',
    date: '2026-06-15',
    amount: 150000,
    description: 'دفعة سلفة ثانية من الحساب - فكري',
    notes: 'حوالة مالية عبر الصراف - مرحلة لحساب الموظف فكري',
    recipientId: 'emp_fikri',
    recipientType: 'employee',
    recipientName: 'فكري',
    currency: 'YER'
  },
  {
    id: 'exp_seed_3',
    date: '2026-06-12',
    amount: 85000,
    description: 'شراء وقود للمولد الكهربائي والساحبات',
    notes: 'مصروفات تشغيلية عامة',
    recipientId: '',
    recipientType: 'none',
    recipientName: ''
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('projects');

  // Automatic one-time cleanup on startup to purge guest project IDs and guarantee owner status
  useEffect(() => {
    localStorage.setItem('site_user_role', 'owner');
    localStorage.setItem('site_user_name', 'المهندس/ ياسر عقيل');
    if (window.location.search) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Auto scroll focused input elements into view above mobile soft keyboard
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        // Immediate scroll to center element in viewport
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        // Secondary scroll after soft keyboard expansion on mobile browsers (280ms)
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 280);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem('site_currency') || 'YER';
  });

  // Collaborative Sharing States
  const [projectId, setProjectId] = useState<string | null>(() => {
    // Automatically purge any query string parameters from URL (e.g. ?project=...&role=...)
    if (window.location.search) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {}
    }
    return null;
  });

  const [sharedRole, setSharedRole] = useState<'owner' | 'read' | 'add' | 'full'>(() => {
    localStorage.setItem('site_user_role', 'owner');
    localStorage.setItem('site_user_name', 'المهندس/ ياسر عقيل');
    return 'owner';
  });

  const handleRestoreOwnerRole = () => {
    localStorage.setItem('site_user_role', 'owner');
    localStorage.setItem('site_user_name', 'المهندس/ ياسر عقيل');
    setUserName('المهندس/ ياسر عقيل');
    setSharedRole('owner');
    setProjectId(null);
    setPromptUserName(false);
    setIsSyncDisabled(false);
    // Remove syncProjectId from all local projects
    setProjects(prev => prev.map(p => ({ ...p, syncProjectId: null })));
    try {
      const savedProjects = localStorage.getItem('site_projects_list');
      if (savedProjects) {
        const list: Project[] = JSON.parse(savedProjects);
        const cleaned = list.map(p => ({ ...p, syncProjectId: null }));
        localStorage.setItem('site_projects_list', JSON.stringify(cleaned));
      }
    } catch (e) {}
    window.history.replaceState({}, '', window.location.pathname);
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast('👑 تم إلغاء كافة المعرفات السحابية والعودة كمالك رئيسي (المهندس/ياسر عقيل) للمشروع الأساسي!');
    }
  };

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('site_user_name') || '';
  });

  const [promptUserName, setPromptUserName] = useState<boolean>(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [isSyncDisabled, setIsSyncDisabled] = useState<boolean>(false);
  const [syncDisabledMessage, setSyncDisabledMessage] = useState<string>('');

  const handleSetProjectId = (id: string | null) => {
    hasLoadedRemoteRef.current = false;
    setProjectId(id);
    if (id) {
      if (sharedRole !== 'owner') {
        setSharedRole('full');
      }
      window.history.pushState({}, '', `?project=${id}&role=${sharedRole === 'owner' ? 'owner' : 'full'}`);
    } else {
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const handleResetAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Manage Phone Hardware Back Button & Navigation History Stack
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(prev => {
      if (prev !== newTab) {
        try {
          window.history.pushState({ tab: newTab }, '');
        } catch (e) {}
      }
      return newTab;
    });
  }, []);

  // Handle exiting the app across Android APK / WebViews / Capacitor / Cordova / Browsers
  const handleExitApp = useCallback(() => {
    // 1. Capacitor App plugin
    if ((window as any).Capacitor?.Plugins?.App?.exitApp) {
      try { (window as any).Capacitor.Plugins.App.exitApp(); return; } catch (e) {}
    }
    // 2. Cordova / PhoneGap / Ionic
    if ((window as any).navigator?.app?.exitApp) {
      try { (window as any).navigator.app.exitApp(); return; } catch (e) {}
    }
    // 3. Android WebView JS Interfaces
    if ((window as any).Android?.exitApp) {
      try { (window as any).Android.exitApp(); return; } catch (e) {}
    }
    if ((window as any).AndroidInterface?.exitApp) {
      try { (window as any).AndroidInterface.exitApp(); return; } catch (e) {}
    }
    if ((window as any).AndroidBridge?.exitApp) {
      try { (window as any).AndroidBridge.exitApp(); return; } catch (e) {}
    }
    // 4. Fallback for Web/Browser
    try {
      window.close();
    } catch (e) {}
    setShowExitConfirmModal(false);
  }, []);
  const [tempUserName, setTempUserName] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  
  // Custom print and toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<{ title: string; htmlContent: string } | null>(null);
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem('site_company_name') || 'شركة ورلد أوف إيليتس للمقاولات والخدمات';
  });
  const [projectName, setProjectName] = useState<string>(() => {
    return localStorage.getItem('site_project_name') || 'مشروع المقاولات والإنشاءات الرئيسي';
  });
  const [companyAddress, setCompanyAddress] = useState<string>(() => {
    return localStorage.getItem('site_company_address') || 'صنعاء - شارع الستين - عمارة النخبة';
  });
  const [companyPhone, setCompanyPhone] = useState<string>(() => {
    return localStorage.getItem('site_company_phone') || '+967 770 000 000 / +967 01 200000';
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  // Lock background scroll when any global modal or menu is open
  useBodyScrollLock(Boolean(promptUserName || printPreview || showExitConfirmModal || isSyncDisabled || showSettingsModal || mobileMenuOpen));

  useEffect(() => {
    (window as any).showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage(prev => prev === msg ? null : prev);
      }, 5000);
    };
    (window as any).showPrintPreview = (title: string, htmlContent: string) => {
      const datedTitle = ensureDateInFilename(title);
      setPrintPreview({ title: datedTitle, htmlContent });
    };
    return () => {
      delete (window as any).showToast;
      delete (window as any).showPrintPreview;
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('site_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedLang = localStorage.getItem('site_language');
    if (savedLang) {
      document.documentElement.lang = savedLang;
      document.documentElement.dir = savedLang === 'en' ? 'ltr' : 'rtl';
    }
  }, []);

  // Hardware Back Button Manager (for Browsers, Android APK, WebView, Cordova, Capacitor)
  useEffect(() => {
    try {
      if (!window.history.state || !window.history.state.tab) {
        window.history.replaceState({ tab: 'projects' }, '');
      }
    } catch (e) {}

    const handleBackAction = () => {
      // Priority 1: Close active modals or menus first if open
      if (printPreview) {
        setPrintPreview(null);
        return;
      }
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        return;
      }
      if (showExitConfirmModal) {
        setShowExitConfirmModal(false);
        return;
      }

      // Priority 2: Return to projects tab if in another project tab
      if (activeTab !== 'projects') {
        setActiveTab('projects');
        try {
          window.history.pushState({ tab: 'projects' }, '');
        } catch (e) {}
        return;
      }

      // Priority 3: On main projects screen -> Show exit confirmation modal
      setShowExitConfirmModal(true);
      try {
        window.history.pushState({ tab: 'projects', modal: 'exit' }, '');
      } catch (e) {}
    };

    const handlePopState = (e: PopStateEvent) => {
      if (printPreview) {
        setPrintPreview(null);
        return;
      }
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        return;
      }
      if (showExitConfirmModal) {
        setShowExitConfirmModal(false);
        return;
      }

      const stateTab = e.state?.tab;
      if (stateTab && stateTab !== activeTab) {
        setActiveTab(stateTab);
      } else if (activeTab !== 'projects') {
        setActiveTab('projects');
      } else {
        setShowExitConfirmModal(true);
        try {
          window.history.pushState({ tab: 'projects', modal: 'exit' }, '');
        } catch (err) {}
      }
    };

    const handleCordovaBackButton = (e: Event) => {
      e.preventDefault();
      handleBackAction();
    };

    // Browser & Webview PopState
    window.addEventListener('popstate', handlePopState);

    // Cordova / PhoneGap / Android Webview hardware back button
    document.addEventListener('backbutton', handleCordovaBackButton, false);

    // Capacitor App Plugin backButton
    let capacitorRemove: (() => void) | null = null;
    if ((window as any).Capacitor?.Plugins?.App?.addListener) {
      try {
        const sub = (window as any).Capacitor.Plugins.App.addListener('backButton', () => {
          handleBackAction();
        });
        if (sub && typeof sub.remove === 'function') {
          capacitorRemove = () => sub.remove();
        }
      } catch (err) {}
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleCordovaBackButton, false);
      if (capacitorRemove) {
        capacitorRemove();
      }
    };
  }, [activeTab, mobileMenuOpen, printPreview, showExitConfirmModal]);

  const isIncomingUpdateRef = useRef(false);
  const hasLoadedRemoteRef = useRef(false);

  // Synchronous State Initializations from LocalStorage (or seed data if null)
  const [budget, setBudget] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem('site_budget');
    return saved ? JSON.parse(saved) : SEED_BUDGET;
  });

  const [workers, setWorkers] = useState<Worker[]>(() => {
    const saved = localStorage.getItem('site_workers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const backup = localStorage.getItem('site_workers_backup');
    if (backup) {
      try {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) return parsedBackup;
      } catch (e) {}
    }
    return SEED_WORKERS;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('site_employees');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const backup = localStorage.getItem('site_employees_backup');
    if (backup) {
      try {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) return parsedBackup;
      } catch (e) {}
    }
    return SEED_EMPLOYEES;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('site_suppliers');
    return saved ? JSON.parse(saved) : SEED_SUPPLIERS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('site_expenses');
    return saved ? JSON.parse(saved) : SEED_EXPENSES;
  });

  // Projects Hub Multi-Project Management State
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('site_projects_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: Project) => ({ ...p, syncProjectId: null }));
        }
      } catch (e) {}
    }

    const savedBudget = localStorage.getItem('site_budget');
    const savedWorkers = localStorage.getItem('site_workers');
    const savedEmployees = localStorage.getItem('site_employees');
    const savedSuppliers = localStorage.getItem('site_suppliers');
    const savedExpenses = localStorage.getItem('site_expenses');

    const defaultProj: Project = {
      id: 'proj_default',
      name: localStorage.getItem('site_project_name') || 'مشروع المقاولات والإنشاءات الرئيسي',
      location: localStorage.getItem('site_company_address') || 'صنعاء - شارع الستين',
      client: 'العميل الرئيسي',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      notes: 'المشروع الرئيسي الافتراضي',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      budget: savedBudget ? JSON.parse(savedBudget) : SEED_BUDGET,
      workers: savedWorkers ? JSON.parse(savedWorkers) : SEED_WORKERS,
      employees: savedEmployees ? JSON.parse(savedEmployees) : SEED_EMPLOYEES,
      suppliers: savedSuppliers ? JSON.parse(savedSuppliers) : SEED_SUPPLIERS,
      expenses: savedExpenses ? JSON.parse(savedExpenses) : SEED_EXPENSES
    };

    return [defaultProj];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem('site_active_project_id') || projects[0]?.id || 'proj_default';
  });

  // Multi-Project Handlers
  const handleSelectProjectDirect = useCallback((id: string, projectList: Project[]) => {
    const target = projectList.find(p => p.id === id) || projectList[0];
    if (!target) return;

    const b = target.budget || [];
    const w = target.workers || [];
    const e = target.employees || [];
    const s = target.suppliers || [];
    const ex = target.expenses || [];

    setActiveProjectId(target.id);
    setProjectName(target.name);
    setBudget(b);
    setWorkers(w);
    setEmployees(e);
    setSuppliers(s);
    setExpenses(ex);

    localStorage.setItem('site_active_project_id', target.id);
    localStorage.setItem('site_project_name', target.name);
    localStorage.setItem('site_budget', JSON.stringify(b));
    localStorage.setItem('site_workers', JSON.stringify(w));
    localStorage.setItem('site_employees', JSON.stringify(e));
    localStorage.setItem('site_suppliers', JSON.stringify(s));
    localStorage.setItem('site_expenses', JSON.stringify(ex));
  }, []);

  const handleSelectProject = (id: string) => {
    handleSelectProjectDirect(id, projects);
  };

  const handleCreateProject = (newProjData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newId = 'proj_' + Math.random().toString(36).substring(2, 10);
    const newProj: Project = {
      ...newProjData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedList = [newProj, ...projects];
    setProjects(updatedList);
    localStorage.setItem('site_projects_list', JSON.stringify(updatedList));
    handleSelectProject(newId);
  };

  const handleUpdateProject = (updatedProj: Project) => {
    const updatedList = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(updatedList);
    localStorage.setItem('site_projects_list', JSON.stringify(updatedList));
    if (updatedProj.id === activeProjectId) {
      setProjectName(updatedProj.name);
    }
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      alert('لا يمكن حذف المشروع الوحيد المتبقي.');
      return;
    }
    const updatedList = projects.filter(p => p.id !== id);
    setProjects(updatedList);
    localStorage.setItem('site_projects_list', JSON.stringify(updatedList));

    if (activeProjectId === id) {
      handleSelectProject(updatedList[0].id);
    }
  };

  // Full App Projects Backup & Restore Handler
  const handleRestoreAllProjects = useCallback((
    data: { projects: Project[]; settings?: any; externalDebts?: any[] },
    mode: 'overwrite' | 'merge'
  ) => {
    try {
      if (data.settings) {
        if (data.settings.companyName) {
          setCompanyName(data.settings.companyName);
          localStorage.setItem('site_company_name', data.settings.companyName);
        }
        if (data.settings.companyAddress) {
          setCompanyAddress(data.settings.companyAddress);
          localStorage.setItem('site_company_address', data.settings.companyAddress);
        }
        if (data.settings.companyPhone) {
          setCompanyPhone(data.settings.companyPhone);
          localStorage.setItem('site_company_phone', data.settings.companyPhone);
        }
        if (data.settings.currency) {
          setCurrency(data.settings.currency);
          localStorage.setItem('site_currency', data.settings.currency);
        }
      }

      if (data.externalDebts && Array.isArray(data.externalDebts)) {
        if (mode === 'overwrite') {
          localStorage.setItem('site_external_debts', JSON.stringify(data.externalDebts));
        } else {
          const currentDebts = JSON.parse(localStorage.getItem('site_external_debts') || '[]');
          const debtMap = new Map();
          currentDebts.forEach((d: any) => debtMap.set(d.id, d));
          data.externalDebts.forEach((d: any) => {
            if (!debtMap.has(d.id)) debtMap.set(d.id, d);
          });
          localStorage.setItem('site_external_debts', JSON.stringify(Array.from(debtMap.values())));
        }
      }

      if (mode === 'overwrite') {
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          localStorage.setItem('site_projects_list', JSON.stringify(data.projects));

          const targetId = data.settings?.activeProjectId && data.projects.some(p => p.id === data.settings.activeProjectId)
            ? data.settings.activeProjectId
            : data.projects[0].id;
          handleSelectProjectDirect(targetId, data.projects);
        }
      } else {
        // Merge mode
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          let mergedList: Project[] = [];
          setProjects(prevProjects => {
            const projMap = new Map<string, Project>();
            prevProjects.forEach(p => projMap.set(p.id, p));
            data.projects.forEach(p => {
              if (!projMap.has(p.id)) {
                projMap.set(p.id, p);
              } else {
                const existing = projMap.get(p.id)!;
                projMap.set(p.id, {
                  ...existing,
                  ...p,
                  budget: p.budget && p.budget.length > 0 ? p.budget : existing.budget,
                  workers: p.workers && p.workers.length > 0 ? p.workers : existing.workers,
                  employees: p.employees && p.employees.length > 0 ? p.employees : existing.employees,
                  suppliers: p.suppliers && p.suppliers.length > 0 ? p.suppliers : existing.suppliers,
                  expenses: p.expenses && p.expenses.length > 0 ? p.expenses : existing.expenses,
                  updatedAt: new Date().toISOString()
                });
              }
            });
            mergedList = Array.from(projMap.values());
            localStorage.setItem('site_projects_list', JSON.stringify(mergedList));
            return mergedList;
          });

          const targetId = data.settings?.activeProjectId && mergedList.some(p => p.id === data.settings.activeProjectId)
            ? data.settings.activeProjectId
            : activeProjectId;

          handleSelectProjectDirect(targetId, mergedList.length > 0 ? mergedList : data.projects);
        }
      }

      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('✅ تم استعادة وحفظ كافة مشاريع وبيانات التطبيق بنجاح!');
      }
    } catch (err) {
      console.error('Error restoring all projects:', err);
      alert('حدث خطأ أثناء استعادة مشاريع التطبيق!');
    }
  }, [handleSelectProjectDirect, activeProjectId]);

  const handleDuplicateProject = (id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    const newId = 'proj_' + Math.random().toString(36).substring(2, 10);
    const copyProj: Project = {
      ...target,
      id: newId,
      name: `${target.name} (نسخة)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedList = [copyProj, ...projects];
    setProjects(updatedList);
    localStorage.setItem('site_projects_list', JSON.stringify(updatedList));
  };

  // Cross-project Entity Migration Handler
  const handleMigrateEntity = ({
    sourceProjectId,
    targetProjectId,
    entityType,
    entityId,
    includeLedger
  }: {
    sourceProjectId: string;
    targetProjectId: string;
    entityType: 'worker' | 'employee' | 'supplier';
    entityId: string;
    includeLedger: boolean;
  }) => {
    if (sourceProjectId === targetProjectId) return;

    const sourceProj = projects.find(p => p.id === sourceProjectId);
    const targetProj = projects.find(p => p.id === targetProjectId);
    if (!sourceProj || !targetProj) return;

    if (entityType === 'worker') {
      const workerToMove = sourceProj.workers?.find(w => w.id === entityId);
      if (!workerToMove) return;
      const newWorker = {
        ...workerToMove,
        id: 'worker_' + Date.now().toString(),
        ledger: includeLedger ? workerToMove.ledger.map(e => ({ ...e, id: 'wled_' + Math.random().toString(36).substring(2, 9) })) : []
      };
      const updatedTargetWorkers = [newWorker, ...(targetProj.workers || [])];
      const updatedProjects = projects.map(p => {
        if (p.id === targetProjectId) {
          return { ...p, workers: updatedTargetWorkers, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setProjects(updatedProjects);
      localStorage.setItem('site_projects_list', JSON.stringify(updatedProjects));
      if (activeProjectId === targetProjectId) {
        setWorkers(updatedTargetWorkers);
      }
    } else if (entityType === 'employee') {
      const empToMove = sourceProj.employees?.find(e => e.id === entityId);
      if (!empToMove) return;
      const newEmp = {
        ...empToMove,
        id: 'emp_' + Date.now().toString(),
        ledger: includeLedger ? empToMove.ledger.map(e => ({ ...e, id: 'eled_' + Math.random().toString(36).substring(2, 9) })) : []
      };
      const updatedTargetEmps = [newEmp, ...(targetProj.employees || [])];
      const updatedProjects = projects.map(p => {
        if (p.id === targetProjectId) {
          return { ...p, employees: updatedTargetEmps, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setProjects(updatedProjects);
      localStorage.setItem('site_projects_list', JSON.stringify(updatedProjects));
      if (activeProjectId === targetProjectId) {
        setEmployees(updatedTargetEmps);
      }
    } else if (entityType === 'supplier') {
      const suppToMove = sourceProj.suppliers?.find(s => s.id === entityId);
      if (!suppToMove) return;
      const newSupp = {
        ...suppToMove,
        id: 'supplier_' + Date.now().toString(),
        ledger: includeLedger ? suppToMove.ledger.map(e => ({ ...e, id: 'sled_' + Math.random().toString(36).substring(2, 9) })) : []
      };
      const updatedTargetSupps = [newSupp, ...(targetProj.suppliers || [])];
      const updatedProjects = projects.map(p => {
        if (p.id === targetProjectId) {
          return { ...p, suppliers: updatedTargetSupps, updatedAt: new Date().toISOString() };
        }
        return p;
      });
      setProjects(updatedProjects);
      localStorage.setItem('site_projects_list', JSON.stringify(updatedProjects));
      if (activeProjectId === targetProjectId) {
        setSuppliers(updatedTargetSupps);
      }
    }
  };

  // Keep projects list updated whenever active state changes
  useEffect(() => {
    setProjects(prevProjects => {
      const idx = prevProjects.findIndex(p => p.id === activeProjectId);
      if (idx === -1) return prevProjects;
      const current = prevProjects[idx];

      if (
        current.name === projectName &&
        current.budget === budget &&
        current.workers === workers &&
        current.employees === employees &&
        current.suppliers === suppliers &&
        current.expenses === expenses
      ) {
        return prevProjects;
      }

      const copy = [...prevProjects];
      copy[idx] = {
        ...current,
        name: projectName,
        budget,
        workers,
        employees,
        suppliers,
        expenses,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('site_projects_list', JSON.stringify(copy));
      return copy;
    });
  }, [budget, workers, employees, suppliers, expenses, projectName, activeProjectId]);

  // Save/Load Shared Project and Syncing Effects
  useEffect(() => {
    if (!projectId) return;

    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          if (data.disabled || data.isSyncActive === false) {
            if (sharedRole !== 'owner') {
              setSyncDisabledMessage(data.error || 'تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك. لم يعد الوصول أو الاطلاع عبر هذا الرابط متاحاً.');
              setIsSyncDisabled(true);
            }
            setProjects(prev => prev.map(p => p.syncProjectId === projectId ? { ...p, syncProjectId: null } : p));
            setProjectId(null);
            hasLoadedRemoteRef.current = false;
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          if (!hasLoadedRemoteRef.current || data.updatedAt !== lastSyncedAt) {
            isIncomingUpdateRef.current = true;
            hasLoadedRemoteRef.current = true;

            const remoteBudget = data.budget || [];
            const remoteWorkers = data.workers || [];
            const remoteEmployees = Array.isArray(data.employees) ? data.employees : [];
            const remoteSuppliers = data.suppliers || [];
            const remoteExpenses = data.expenses || [];
            const remoteName = data.name || data.projectName || '';

            setBudget(remoteBudget);
            setWorkers(remoteWorkers);
            setEmployees(remoteEmployees);
            setSuppliers(remoteSuppliers);
            setExpenses(remoteExpenses);

            if (remoteName) {
              setProjectName(remoteName);
              localStorage.setItem('site_project_name', remoteName);
            }
            if (data.currency) {
              setCurrency(data.currency);
              localStorage.setItem('site_currency', data.currency);
            }

            setLastSyncedAt(data.updatedAt);
            setSyncStatus('success');

            // Synchronize active project in projects list
            setProjects(prevProjects => {
              const existingIdx = prevProjects.findIndex(p => p.id === projectId || p.syncProjectId === projectId);
              if (existingIdx !== -1) {
                const updated = [...prevProjects];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  syncProjectId: projectId,
                  name: remoteName || updated[existingIdx].name,
                  budget: remoteBudget,
                  workers: remoteWorkers,
                  employees: remoteEmployees,
                  suppliers: remoteSuppliers,
                  expenses: remoteExpenses,
                  updatedAt: data.updatedAt || new Date().toISOString()
                };
                localStorage.setItem('site_projects_list', JSON.stringify(updated));
                return updated;
              } else {
                const newProject: Project = {
                  id: projectId,
                  syncProjectId: projectId,
                  name: remoteName || 'مشروع مشارك سحابياً',
                  location: data.location || '',
                  client: data.client || '',
                  status: data.status || 'active',
                  startDate: new Date().toISOString().split('T')[0],
                  createdAt: new Date().toISOString(),
                  updatedAt: data.updatedAt || new Date().toISOString(),
                  budget: remoteBudget,
                  workers: remoteWorkers,
                  employees: remoteEmployees,
                  suppliers: remoteSuppliers,
                  expenses: remoteExpenses
                };
                const updated = [newProject, ...prevProjects];
                localStorage.setItem('site_projects_list', JSON.stringify(updated));
                return updated;
              }
            });

            setActiveProjectId(projectId);
            localStorage.setItem('site_active_project_id', projectId);
          }
        } else {
          if (res.status === 403 || res.status === 404 || data.disabled) {
            if (sharedRole !== 'owner') {
              setSyncDisabledMessage(data.error || 'تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك. لم يعد الوصول أو الاطلاع عبر هذا الرابط متاحاً.');
              setIsSyncDisabled(true);
            }
            setProjects(prev => prev.map(p => p.syncProjectId === projectId ? { ...p, syncProjectId: null } : p));
            setProjectId(null);
            hasLoadedRemoteRef.current = false;
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setSyncStatus('error');
          }
        }
      } catch (err: any) {
        setSyncStatus('error');
      }
    };

    fetchProject();
    const interval = setInterval(fetchProject, 8000); // sync every 8 seconds
    return () => clearInterval(interval);
  }, [projectId, lastSyncedAt]);

  useEffect(() => {
    if (!projectId) return;
    if (!hasLoadedRemoteRef.current) return; // Prevent overwriting cloud data before initial load
    if (isIncomingUpdateRef.current) {
      isIncomingUpdateRef.current = false;
      return;
    }
    if (sharedRole === 'read') return;

    const saveData = async () => {
      try {
        setSyncStatus('loading');
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            budget, 
            workers, 
            employees, 
            suppliers, 
            expenses,
            projectName,
            currency 
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setLastSyncedAt(data.updatedAt);
          setSyncStatus('success');
        } else {
          if (res.status === 403 || res.status === 404 || data.disabled) {
            if (sharedRole !== 'owner') {
              setSyncDisabledMessage(data.error || 'تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك. لم يعد الوصول أو الاطلاع عبر هذا الرابط متاحاً.');
              setIsSyncDisabled(true);
            }
            setProjects(prev => prev.map(p => p.syncProjectId === projectId ? { ...p, syncProjectId: null } : p));
            setProjectId(null);
            hasLoadedRemoteRef.current = false;
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setSyncStatus('error');
          }
        }
      } catch (err: any) {
        setSyncStatus('error');
      }
    };

    const debounce = setTimeout(saveData, 1200);
    return () => clearTimeout(debounce);
  }, [budget, workers, employees, suppliers, expenses, projectName, currency, projectId, sharedRole]);

  // Automatic Recovery Effect for missing employees/workers from expenses log
  useEffect(() => {
    if (expenses.length === 0) return;

    // Recover missing employees referenced in expenses
    const missingEmpExpenses = expenses.filter(exp => 
      exp.recipientType === 'employee' && 
      exp.recipientId && 
      !employees.some(emp => emp.id === exp.recipientId)
    );

    if (missingEmpExpenses.length > 0) {
      const recoveredMap = new Map<string, Employee>();
      missingEmpExpenses.forEach(exp => {
        if (!recoveredMap.has(exp.recipientId)) {
          recoveredMap.set(exp.recipientId, {
            id: exp.recipientId,
            name: exp.recipientName || 'موظف',
            profession: 'موظف (مسترجع تلقائياً من كشف الحساب)',
            startDate: exp.date,
            endDate: '',
            dailyWage: 0,
            ledger: [],
            createdBy: exp.createdBy || 'النظام'
          });
        }
      });

      const newRecovered = Array.from(recoveredMap.values()).map(emp => {
        const empExpenses = expenses.filter(exp => exp.recipientId === emp.id && exp.recipientType === 'employee');
        const reconstructedLedger: LedgerEntry[] = empExpenses.map(exp => ({
          id: 'posted_' + exp.id,
          date: exp.date,
          amountOnHim: exp.amount,
          amountForHim: 0,
          description: exp.description,
          notes: exp.notes,
          isPosted: true,
          currency: exp.currency || 'YER',
          createdBy: exp.createdBy || 'النظام'
        }));
        return { ...emp, ledger: reconstructedLedger };
      });

      setEmployees(prev => [...prev, ...newRecovered]);
    }

    // Recover missing workers referenced in expenses
    const missingWorkerExpenses = expenses.filter(exp => 
      exp.recipientType === 'worker' && 
      exp.recipientId && 
      !workers.some(w => w.id === exp.recipientId)
    );

    if (missingWorkerExpenses.length > 0) {
      const recoveredMap = new Map<string, Worker>();
      missingWorkerExpenses.forEach(exp => {
        if (!recoveredMap.has(exp.recipientId)) {
          recoveredMap.set(exp.recipientId, {
            id: exp.recipientId,
            name: exp.recipientName || 'عامل',
            profession: 'عامل (مسترجع تلقائياً من كشف الحساب)',
            startDate: exp.date,
            endDate: '',
            ledger: [],
            createdBy: exp.createdBy || 'النظام'
          });
        }
      });

      const newRecovered = Array.from(recoveredMap.values()).map(worker => {
        const workerExpenses = expenses.filter(exp => exp.recipientId === worker.id && exp.recipientType === 'worker');
        const reconstructedLedger: LedgerEntry[] = workerExpenses.map(exp => ({
          id: 'posted_' + exp.id,
          date: exp.date,
          amountOnHim: exp.amount,
          amountForHim: 0,
          description: exp.description,
          notes: exp.notes,
          isPosted: true,
          currency: exp.currency || 'YER',
          createdBy: exp.createdBy || 'النظام'
        }));
        return { ...worker, ledger: reconstructedLedger };
      });

      setWorkers(prev => [...prev, ...newRecovered]);
    }
  }, [expenses]);

  // Ensure Fikri is not lingering in workers list
  useEffect(() => {
    const fikriWorker = workers.find(w => w.name.includes('فكري') || w.id === 'emp_fikri' || w.id === 'worker_fikri');
    if (fikriWorker) {
      setWorkers(prev => prev.filter(w => w.id !== fikriWorker.id && !w.name.includes('فكري')));
    }
  }, [workers]);

  // Watch for changes to persist to LocalStorage (as fallback with backup)
  useEffect(() => {
    localStorage.setItem('site_budget', JSON.stringify(budget));
  }, [budget]);

  useEffect(() => {
    localStorage.setItem('site_workers', JSON.stringify(workers));
    if (workers.length > 0) {
      localStorage.setItem('site_workers_backup', JSON.stringify(workers));
    }
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('site_employees', JSON.stringify(employees));
    if (employees.length > 0) {
      localStorage.setItem('site_employees_backup', JSON.stringify(employees));
    }
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('site_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('site_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('site_currency', currency);
  }, [currency]);

  // Handle name saving
  const handleSaveUserName = () => {
    if (!tempUserName.trim()) {
      alert('الرجاء إدخال اسمك للانضمام للحساب المشترك');
      return;
    }
    const cleanName = tempUserName.trim();
    localStorage.setItem('site_user_name', cleanName);
    setUserName(cleanName);
    setPromptUserName(false);
  };

  // Generate shareable link callback
  const handleCreateShareLink = async (role: 'read' | 'add' | 'full' = 'full') => {
    if (sharedRole !== 'owner') {
      alert("صلاحية المشاركة مع اخرين تتم فقط بواسطة المهندس/ياسر عقيل للتواصل 771999911");
      return null;
    }
    try {
      setSyncStatus('loading');

      let targetProjectId = projectId;

      if (!targetProjectId) {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (activeProj?.syncProjectId) {
          targetProjectId = activeProj.syncProjectId;
        }
      }

      if (targetProjectId) {
        // Update existing cloud project on server
        const res = await fetch(`/api/projects/${targetProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget, workers, employees, suppliers, expenses, projectName, currency })
        });

        if (res.ok) {
          setProjectId(targetProjectId);
          setSharedRole('owner');
          hasLoadedRemoteRef.current = true;
          setLastSyncedAt(new Date().toISOString());
          setSyncStatus('success');

          window.history.replaceState({}, '', `?project=${targetProjectId}&role=owner`);

          // Update active project's syncProjectId in projects list
          setProjects(prev => prev.map(p => (p.id === activeProjectId || p.id === targetProjectId) ? { ...p, syncProjectId: targetProjectId } : p));

          return `${window.location.origin}${window.location.pathname}?project=${targetProjectId}&role=${role}`;
        }
      }

      // Create a brand new cloud project on server
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, workers, employees, suppliers, expenses, projectName, currency })
      });

      if (res.ok) {
        const data = await res.json();
        const newId = data.projectId;
        setProjectId(newId);
        setSharedRole('owner');
        hasLoadedRemoteRef.current = true;
        setLastSyncedAt(new Date().toISOString());
        setSyncStatus('success');

        window.history.replaceState({}, '', `?project=${newId}&role=owner`);

        // Update active project's syncProjectId in projects list
        setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, syncProjectId: newId } : p));

        return `${window.location.origin}${window.location.pathname}?project=${newId}&role=${role}`;
      } else {
        setSyncStatus('error');
        return null;
      }
    } catch (err: any) {
      setSyncStatus('error');
      return null;
    }
  };

  // Cancel Cloud Sync callback
  const handleCancelCloudSync = async () => {
    if (!projectId) return;
    if (sharedRole !== 'owner') {
      alert("إلغاء المزامنة السحابية متاح فقط لمالك المشروع الرئيسي.");
      return;
    }
    try {
      setSyncStatus('loading');
      await fetch(`/api/projects/${projectId}/cancel-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      // Gracefully handle cancel request network error
    }
    // Unlink syncProjectId from projects list
    setProjects(prev => prev.map(p => p.syncProjectId === projectId ? { ...p, syncProjectId: null } : p));
    setProjectId(null);
    hasLoadedRemoteRef.current = false;
    setSharedRole('owner');
    setSyncStatus('idle');
    window.history.replaceState({}, '', window.location.pathname);
    alert('تم إلغاء المزامنة السحابية وتعطيل جميع روابط الدعوة الخاصة بهذا المشروع بنجاح. أصبحت جميع الروابط السابقة غير صالحة والوصول من خلالها محالاً.');
  };


  // =================================== ACTION HANDLERS ===================================

  const getActorName = () => (sharedRole === 'owner' ? 'مالك المشروع' : (userName || 'مشارك'));

  // Add Expense & Post to Ledger if recipient is selected
  const handleAddExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newId = 'exp_' + Date.now().toString();
    const newExpense: Expense = {
      ...expenseData,
      id: newId,
      createdBy: getActorName()
    };

    setExpenses(prev => [newExpense, ...prev]);

    // Check if we need to post copy to recipient's ledger
    if (newExpense.recipientId && newExpense.recipientType !== 'none') {
      const postedLedgerEntry: LedgerEntry = {
        id: 'posted_' + newId,
        date: newExpense.date,
        amountOnHim: newExpense.amount, // المبلغ عليه
        amountForHim: 0,
        description: newExpense.description,
        notes: newExpense.notes,
        isPosted: true,
        currency: newExpense.currency || 'YER',
        createdBy: getActorName()
      };

      if (newExpense.recipientType === 'worker') {
        setWorkers(prevWorkers => 
          prevWorkers.map(w => 
            w.id === newExpense.recipientId 
              ? { ...w, ledger: [postedLedgerEntry, ...w.ledger] }
              : w
          )
        );
      } else if (newExpense.recipientType === 'employee') {
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.id === newExpense.recipientId 
              ? { ...emp, ledger: [postedLedgerEntry, ...emp.ledger] }
              : emp
          )
        );
      } else if (newExpense.recipientType === 'supplier') {
        setSuppliers(prevSuppliers => 
          prevSuppliers.map(s => 
            s.id === newExpense.recipientId 
              ? { ...s, ledger: [postedLedgerEntry, ...s.ledger] }
              : s
          )
        );
      }
    }
  };

  // Delete Expense & Revert/Clean ledger posting if any
  const handleDeleteExpense = (id: string) => {
    const target = expenses.find(exp => exp.id === id);
    if (target && target.recipientId && target.recipientType !== 'none') {
      const postedId = 'posted_' + id;
      const altWledId = id.replace('exp_', 'wled_');
      const altEledId = id.replace('exp_', 'eled_');
      const altSledId = id.replace('exp_', 'sled_');

      const filterLedger = (ledger: LedgerEntry[]) => ledger.filter(e => {
        if (e.id === postedId || e.id === id || e.id === altWledId || e.id === altEledId || e.id === altSledId) {
          return false;
        }
        if (e.isPosted && e.date === target.date) {
          const amt = e.amountOnHim > 0 ? e.amountOnHim : e.amountForHim;
          if (amt === target.amount) return false;
        }
        return true;
      });

      if (target.recipientType === 'worker') {
        setWorkers(prevWorkers => 
          prevWorkers.map(w => 
            w.id === target.recipientId 
              ? { ...w, ledger: filterLedger(w.ledger) }
              : w
          )
        );
      } else if (target.recipientType === 'employee') {
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.id === target.recipientId 
              ? { ...emp, ledger: filterLedger(emp.ledger) }
              : emp
          )
        );
      } else if (target.recipientType === 'supplier') {
        setSuppliers(prevSuppliers => 
          prevSuppliers.map(s => 
            s.id === target.recipientId 
              ? { ...s, ledger: filterLedger(s.ledger) }
              : s
          )
        );
      }
    }
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  // Add Worker
  const handleAddWorker = (workerData: Omit<Worker, 'id' | 'ledger'>) => {
    const newWorker: Worker = {
      ...workerData,
      id: 'worker_' + Date.now().toString(),
      ledger: [],
      createdBy: getActorName()
    };
    setWorkers(prev => [newWorker, ...prev]);
  };

  // Delete Worker & Clean up expenses referencing this worker
  const handleDeleteWorker = (workerId: string) => {
    setWorkers(prev => prev.filter(w => w.id !== workerId));
    
    // Safety cleanup: set deleted worker name but detach reference
    setExpenses(prevExpenses => 
      prevExpenses.map(exp => 
        exp.recipientId === workerId && exp.recipientType === 'worker'
          ? { ...exp, recipientId: '', recipientType: 'none', recipientName: `${exp.recipientName} (محذوف)` }
          : exp
      )
    );
  };

  // Add Manual Worker Ledger Entry
  const handleAddWorkerLedgerEntry = (workerId: string, entryData: Omit<LedgerEntry, 'id'>) => {
    const entryId = 'wled_' + Date.now().toString();
    const newEntry: LedgerEntry = {
      ...entryData,
      id: entryId,
      createdBy: getActorName()
    };

    setWorkers(prev => 
      prev.map(w => 
        w.id === workerId 
          ? { ...w, ledger: [newEntry, ...w.ledger] }
          : w
      )
    );
  };

  // Delete Worker Ledger Entry
  const handleDeleteWorkerLedgerEntry = (workerId: string, entryId: string) => {
    const worker = workers.find(w => w.id === workerId);
    const targetEntry = worker?.ledger.find(e => e.id === entryId);
    const targetNutrId = targetEntry?.nutritionPeriodId || (entryId.startsWith('nutr_entry_') ? entryId.replace('nutr_entry_', '') : null);

    setWorkers(prev => 
      prev.map(w => {
        if (w.id !== workerId) return w;
        const updatedLedger = w.ledger.filter(e => e.id !== entryId);
        const updatedNutrition = targetNutrId ? (w.nutritionPeriods || []).filter(np => np.id !== targetNutrId) : w.nutritionPeriods;
        const updatedWorker = {
          ...w,
          updatedBy: getActorName(),
          ledger: updatedLedger,
          nutritionPeriods: updatedNutrition
        };
        return syncWorkerNutritionLedger(updatedWorker);
      })
    );

    // Only delete from daily expenses if this entry was originally posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_') || targetEntry?.isPosted) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
    }
  };

  // Add Nutrition Period for Worker
  const handleAddWorkerNutritionPeriod = (workerId: string, nutritionData: Omit<NutritionPeriod, 'id'>) => {
    const nutrId = 'nutr_' + Date.now().toString();
    const newPeriod: NutritionPeriod = {
      ...nutritionData,
      id: nutrId,
      createdBy: getActorName()
    };

    setWorkers(prev => 
      prev.map(w => {
        if (w.id !== workerId) return w;
        const updatedWorker = {
          ...w,
          updatedBy: getActorName(),
          nutritionPeriods: [...(w.nutritionPeriods || []), newPeriod]
        };
        return syncWorkerNutritionLedger(updatedWorker);
      })
    );
  };

  // Update Nutrition Period for Worker
  const handleUpdateWorkerNutritionPeriod = (workerId: string, nutritionId: string, updatedData: Partial<Omit<NutritionPeriod, 'id'>>) => {
    setWorkers(prev => 
      prev.map(w => {
        if (w.id !== workerId) return w;
        const updatedPeriods = (w.nutritionPeriods || []).map(np => 
          np.id === nutritionId ? { ...np, ...updatedData, updatedBy: getActorName() } : np
        );
        const updatedWorker = {
          ...w,
          updatedBy: getActorName(),
          nutritionPeriods: updatedPeriods
        };
        return syncWorkerNutritionLedger(updatedWorker);
      })
    );
  };

  // Delete Nutrition Period for Worker
  const handleDeleteWorkerNutritionPeriod = (workerId: string, nutritionId: string) => {
    setWorkers(prev => 
      prev.map(w => {
        if (w.id !== workerId) return w;
        const updatedPeriods = (w.nutritionPeriods || []).filter(np => np.id !== nutritionId);
        const updatedLedger = w.ledger.filter(e => e.nutritionPeriodId !== nutritionId && e.id !== `nutr_entry_${nutritionId}`);
        const updatedWorker = {
          ...w,
          updatedBy: getActorName(),
          nutritionPeriods: updatedPeriods,
          ledger: updatedLedger
        };
        return syncWorkerNutritionLedger(updatedWorker);
      })
    );
  };

  // Add Extra Period for Worker
  const handleAddWorkerExtraPeriod = (workerId: string, startDate: string, endDate: string) => {
    setWorkers(prev => 
      prev.map(w => 
        w.id === workerId 
          ? { 
              ...w, 
              updatedBy: getActorName(),
              extraPeriods: [
                ...(w.extraPeriods || []),
                {
                  id: 'period_' + Date.now().toString(),
                  startDate,
                  endDate
                }
              ] 
            }
          : w
      )
    );
  };

  // Delete Extra Period for Worker
  const handleDeleteWorkerExtraPeriod = (workerId: string, periodId: string) => {
    setWorkers(prev => 
      prev.map(w => 
        w.id === workerId 
          ? { 
              ...w, 
              updatedBy: getActorName(),
              extraPeriods: (w.extraPeriods || []).filter(p => p.id !== periodId) 
            }
          : w
      )
    );
  };

  // =================================== EMPLOYEE HANDLERS ===================================

  // Add Employee
  const handleAddEmployee = (employeeData: Omit<Employee, 'id' | 'ledger'>) => {
    const empId = 'emp_' + Date.now().toString();
    const initialLedger: LedgerEntry[] = [];

    if (employeeData.dailyWage > 0 && employeeData.startDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      const effectiveEndDate = employeeData.endDate ? employeeData.endDate : todayStr;
      const days = calculateDaysOfWork(employeeData.startDate, effectiveEndDate, true);
      const amount = days * employeeData.dailyWage;
      const startDateFormatted = formatDateArabic(employeeData.startDate);
      const endDateFormatted = employeeData.endDate ? formatDateArabic(employeeData.endDate) : formatDateArabic(effectiveEndDate);

      initialLedger.push({
        id: `auto_wage_${empId}`,
        date: effectiveEndDate,
        amountOnHim: 0,
        amountForHim: amount,
        description: `مجموع أجور العمل لعدد (${days}) أيام وذلك للفترة من (${startDateFormatted}) إلى (${endDateFormatted})`,
        notes: 'تم الاحتساب والتحديث تلقائياً بناءً على الأجر اليومي وعدد أيام العمل',
        isAutoDailyWage: true,
        currency: 'YER',
        createdBy: getActorName()
      });
    }

    const newEmployee: Employee = {
      ...employeeData,
      id: empId,
      ledger: initialLedger,
      createdBy: getActorName()
    };
    setEmployees(prev => [newEmployee, ...prev]);
  };

  // Delete Employee & Clean up expenses
  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
    setExpenses(prevExpenses => 
      prevExpenses.map(exp => 
        exp.recipientId === employeeId && exp.recipientType === 'employee'
          ? { ...exp, recipientId: '', recipientType: 'none', recipientName: `${exp.recipientName} (محذوف)` }
          : exp
      )
    );
  };

  // Update Employee
  const handleUpdateEmployee = (employeeId: string, updatedData: Partial<Omit<Employee, 'id' | 'ledger'>>) => {
    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { ...e, ...updatedData, updatedBy: getActorName() }
          : e
      )
    );
  };

  // Add Manual Employee Ledger Entry
  const handleAddEmployeeLedgerEntry = (employeeId: string, entryData: Omit<LedgerEntry, 'id'>) => {
    const entryId = 'eled_' + Date.now().toString();
    const newEntry: LedgerEntry = {
      ...entryData,
      id: entryId,
      createdBy: getActorName()
    };

    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { ...e, ledger: [newEntry, ...e.ledger] }
          : e
      )
    );
  };

  // Delete Employee Ledger Entry
  const handleDeleteEmployeeLedgerEntry = (employeeId: string, entryId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    const targetEntry = employee?.ledger.find(e => e.id === entryId);

    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { ...e, ledger: e.ledger.filter(entry => entry.id !== entryId) }
          : e
      )
    );

    // Only delete from daily expenses if this entry was originally posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_') || targetEntry?.isPosted) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
    }
  };

  // Update Employee Ledger Entry
  const handleUpdateEmployeeLedgerEntry = (employeeId: string, entryId: string, updatedData: Omit<LedgerEntry, 'id' | 'createdBy'>) => {
    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { 
              ...e, 
              ledger: e.ledger.map(entry => entry.id === entryId ? { ...entry, ...updatedData, updatedBy: getActorName() } : entry) 
            }
          : e
      )
    );

    // Only sync to expenses if this entry was posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_')) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      const cleanDesc = updatedData.description.replace(/\s*\(مرحّل من النفقات اليومية\)\s*/g, '').trim();
      const expenseAmt = updatedData.amountOnHim > 0 ? updatedData.amountOnHim : updatedData.amountForHim;

      setExpenses(prev => prev.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            date: updatedData.date,
            amount: expenseAmt,
            description: cleanDesc,
            notes: updatedData.notes || '',
            currency: updatedData.currency || exp.currency || 'YER',
            updatedBy: getActorName()
          };
        }
        return exp;
      }));
    }
  };

  // Add Extra Period for Employee
  const handleAddEmployeeExtraPeriod = (employeeId: string, startDate: string, endDate: string) => {
    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { 
              ...e, 
              updatedBy: getActorName(),
              extraPeriods: [
                ...(e.extraPeriods || []),
                {
                  id: 'period_' + Date.now().toString(),
                  startDate,
                  endDate
                }
              ] 
            }
          : e
      )
    );
  };

  // Delete Extra Period for Employee
  const handleDeleteEmployeeExtraPeriod = (employeeId: string, periodId: string) => {
    setEmployees(prev => 
      prev.map(e => 
        e.id === employeeId 
          ? { 
              ...e, 
              updatedBy: getActorName(),
              extraPeriods: (e.extraPeriods || []).filter(p => p.id !== periodId) 
            }
          : e
      )
    );
  };

  // Transfer Worker -> Employee
  const handleTransferWorkerToEmployee = (worker: Worker) => {
    const workerId = worker.id;
    const newEmployee: Employee = {
      id: worker.id,
      name: worker.name,
      profession: worker.profession,
      dailyWage: 0,
      startDate: worker.startDate,
      endDate: worker.endDate,
      phoneNumbers: worker.phoneNumbers || [],
      ledger: worker.ledger,
      extraPeriods: worker.extraPeriods || [],
      createdBy: worker.createdBy || getActorName()
    };

    setWorkers(prev => prev.filter(w => w.id !== workerId));
    setEmployees(prev => [newEmployee, ...prev]);

    setExpenses(prev => 
      prev.map(exp => 
        exp.recipientId === workerId && exp.recipientType === 'worker'
          ? { ...exp, recipientType: 'employee' }
          : exp
      )
    );
  };

  // Transfer Employee -> Worker
  const handleTransferEmployeeToWorker = (employee: Employee) => {
    const employeeId = employee.id;
    const newWorker: Worker = {
      id: employee.id,
      name: employee.name,
      profession: employee.profession,
      startDate: employee.startDate,
      endDate: employee.endDate,
      phoneNumbers: employee.phoneNumbers || [],
      ledger: employee.ledger,
      extraPeriods: employee.extraPeriods || [],
      createdBy: employee.createdBy || getActorName()
    };

    setEmployees(prev => prev.filter(e => e.id !== employeeId));
    setWorkers(prev => [newWorker, ...prev]);

    setExpenses(prev => 
      prev.map(exp => 
        exp.recipientId === employeeId && exp.recipientType === 'employee'
          ? { ...exp, recipientType: 'worker' }
          : exp
      )
    );
  };

  // Add Supplier
  const handleAddSupplier = (supplierData: Omit<Supplier, 'id' | 'ledger'>) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: 'supplier_' + Date.now().toString(),
      ledger: [],
      createdBy: getActorName()
    };
    setSuppliers(prev => [newSupplier, ...prev]);
  };

  // Delete Supplier & Clean up expenses referencing this supplier
  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== supplierId));

    // Safety cleanup: set deleted supplier name but detach reference
    setExpenses(prevExpenses => 
      prevExpenses.map(exp => 
        exp.recipientId === supplierId && exp.recipientType === 'supplier'
          ? { ...exp, recipientId: '', recipientType: 'none', recipientName: `${exp.recipientName} (محذوف)` }
          : exp
      )
    );
  };

  // Add Manual Supplier Ledger Entry
  const handleAddSupplierLedgerEntry = (supplierId: string, entryData: Omit<LedgerEntry, 'id'>) => {
    const entryId = 'sled_' + Date.now().toString();
    const newEntry: LedgerEntry = {
      ...entryData,
      id: entryId,
      createdBy: getActorName()
    };

    setSuppliers(prev => 
      prev.map(s => 
        s.id === supplierId 
          ? { ...s, ledger: [newEntry, ...s.ledger] }
          : s
      )
    );
  };

  // Delete Supplier Ledger Entry
  const handleDeleteSupplierLedgerEntry = (supplierId: string, entryId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    const targetEntry = supplier?.ledger.find(e => e.id === entryId);

    setSuppliers(prev => 
      prev.map(s => 
        s.id === supplierId 
          ? { ...s, ledger: s.ledger.filter(e => e.id !== entryId) }
          : s
      )
    );

    // Only delete from daily expenses if this entry was originally posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_') || targetEntry?.isPosted) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
    }
  };

  // Add Budget Capital Item
  const handleAddBudgetItem = (itemData: Omit<BudgetItem, 'id'>) => {
    const newItem: BudgetItem = {
      ...itemData,
      id: 'bud_' + Date.now().toString(),
      createdBy: getActorName()
    };
    setBudget(prev => [newItem, ...prev]);
  };

  // Delete Budget Item
  const handleDeleteBudgetItem = (id: string) => {
    setBudget(prev => prev.filter(item => item.id !== id));
  };

  // Update Worker
  const handleUpdateWorker = (id: string, updatedData: Omit<Worker, 'id' | 'ledger' | 'createdBy'>) => {
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...updatedData, updatedBy: getActorName() } : w));
    setExpenses(prev => prev.map(exp => exp.recipientId === id && exp.recipientType === 'worker' ? { ...exp, recipientName: updatedData.name } : exp));
  };

  // Update Worker Ledger Entry
  const handleUpdateWorkerLedgerEntry = (workerId: string, entryId: string, updatedEntryData: Omit<LedgerEntry, 'id' | 'createdBy'>) => {
    setWorkers(prev => prev.map(w => w.id === workerId ? {
      ...w,
      ledger: w.ledger.map(e => e.id === entryId ? { ...e, ...updatedEntryData, updatedBy: getActorName() } : e)
    } : w));

    // Only sync to expenses if this entry was posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_')) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      const cleanDesc = updatedEntryData.description.replace(/\s*\(مرحّل من النفقات اليومية\)\s*/g, '').trim();
      const expenseAmt = updatedEntryData.amountOnHim > 0 ? updatedEntryData.amountOnHim : updatedEntryData.amountForHim;

      setExpenses(prev => prev.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            date: updatedEntryData.date,
            amount: expenseAmt,
            description: cleanDesc,
            notes: updatedEntryData.notes || '',
            currency: updatedEntryData.currency || exp.currency || 'YER',
            updatedBy: getActorName()
          };
        }
        return exp;
      }));
    }
  };

  // Update Supplier
  const handleUpdateSupplier = (id: string, updatedData: Omit<Supplier, 'id' | 'ledger' | 'createdBy'>) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updatedData, updatedBy: getActorName() } : s));
    setExpenses(prev => prev.map(exp => exp.recipientId === id && exp.recipientType === 'supplier' ? { ...exp, recipientName: updatedData.name } : exp));
  };

  // Update Supplier Ledger Entry
  const handleUpdateSupplierLedgerEntry = (supplierId: string, entryId: string, updatedEntryData: Omit<LedgerEntry, 'id' | 'createdBy'>) => {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? {
      ...s,
      ledger: s.ledger.map(e => e.id === entryId ? { ...e, ...updatedEntryData, updatedBy: getActorName() } : e)
    } : s));

    // Only sync to expenses if this entry was posted from daily expenses
    if (entryId.startsWith('posted_') || entryId.startsWith('exp_')) {
      const expenseId = entryId.startsWith('posted_') ? entryId.replace('posted_', '') : entryId;
      const cleanDesc = updatedEntryData.description.replace(/\s*\(مرحّل من النفقات اليومية\)\s*/g, '').trim();
      const expenseAmt = updatedEntryData.amountOnHim > 0 ? updatedEntryData.amountOnHim : updatedEntryData.amountForHim;

      setExpenses(prev => prev.map(exp => {
        if (exp.id === expenseId) {
          return {
            ...exp,
            date: updatedEntryData.date,
            amount: expenseAmt,
            description: cleanDesc,
            notes: updatedEntryData.notes || '',
            currency: updatedEntryData.currency || exp.currency || 'YER',
            updatedBy: getActorName()
          };
        }
        return exp;
      }));
    }
  };

  // Update Expense & Handle Ledger sync
  const handleUpdateExpense = (id: string, updatedExpenseData: Omit<Expense, 'id' | 'createdBy'>) => {
    const oldExpense = expenses.find(exp => exp.id === id);
    if (!oldExpense) return;

    const updatedExpense: Expense = {
      ...oldExpense,
      ...updatedExpenseData,
      updatedBy: getActorName()
    };

    setExpenses(prev => prev.map(exp => exp.id === id ? updatedExpense : exp));

    const oldRecipientId = oldExpense.recipientId;
    const oldRecipientType = oldExpense.recipientType;
    const newRecipientId = updatedExpense.recipientId;
    const newRecipientType = updatedExpense.recipientType;

    const isSameRecipient = oldRecipientId === newRecipientId && oldRecipientType === newRecipientType;

    if (isSameRecipient && newRecipientId && newRecipientType !== 'none') {
      // Update entry in place in recipient ledger
      const updateLedgerInPlace = (ledger: LedgerEntry[]) => ledger.map(e => {
        const isMatch = e.id === 'posted_' + id || e.id === id || e.id === id.replace('exp_', 'wled_') || e.id === id.replace('exp_', 'eled_') || e.id === id.replace('exp_', 'sled_');
        if (isMatch) {
          return {
            ...e,
            date: updatedExpense.date,
            amountOnHim: updatedExpense.amount,
            amountForHim: 0,
            description: `${updatedExpense.description} (مرحّل من النفقات اليومية)`,
            notes: updatedExpense.notes || '',
            currency: updatedExpense.currency || 'YER',
            updatedBy: getActorName()
          };
        }
        return e;
      });

      if (newRecipientType === 'worker') {
        setWorkers(prev => prev.map(w => w.id === newRecipientId ? { ...w, ledger: updateLedgerInPlace(w.ledger) } : w));
      } else if (newRecipientType === 'employee') {
        setEmployees(prev => prev.map(emp => emp.id === newRecipientId ? { ...emp, ledger: updateLedgerInPlace(emp.ledger) } : emp));
      } else if (newRecipientType === 'supplier') {
        setSuppliers(prev => prev.map(s => s.id === newRecipientId ? { ...s, ledger: updateLedgerInPlace(s.ledger) } : s));
      }
    } else {
      // Recipient changed or removed:
      if (oldRecipientId && oldRecipientType !== 'none') {
        const removeMatching = (ledger: LedgerEntry[]) => ledger.filter(e => {
          return !(e.id === 'posted_' + id || e.id === id || e.id === id.replace('exp_', 'wled_') || e.id === id.replace('exp_', 'eled_') || e.id === id.replace('exp_', 'sled_'));
        });

        if (oldRecipientType === 'worker') {
          setWorkers(prev => prev.map(w => w.id === oldRecipientId ? { ...w, ledger: removeMatching(w.ledger) } : w));
        } else if (oldRecipientType === 'employee') {
          setEmployees(prev => prev.map(emp => emp.id === oldRecipientId ? { ...emp, ledger: removeMatching(emp.ledger) } : emp));
        } else if (oldRecipientType === 'supplier') {
          setSuppliers(prev => prev.map(s => s.id === oldRecipientId ? { ...s, ledger: removeMatching(s.ledger) } : s));
        }
      }

      if (newRecipientId && newRecipientType !== 'none') {
        const postedLedgerEntry: LedgerEntry = {
          id: 'posted_' + id,
          date: updatedExpense.date,
          amountOnHim: updatedExpense.amount,
          amountForHim: 0,
          description: `${updatedExpense.description} (مرحّل من النفقات اليومية)`,
          notes: updatedExpense.notes || '',
          isPosted: true,
          currency: updatedExpense.currency || 'YER',
          createdBy: oldExpense.createdBy,
          updatedBy: getActorName()
        };

        if (newRecipientType === 'worker') {
          setWorkers(prev => prev.map(w => w.id === newRecipientId ? { ...w, ledger: [postedLedgerEntry, ...w.ledger] } : w));
        } else if (newRecipientType === 'employee') {
          setEmployees(prev => prev.map(emp => emp.id === newRecipientId ? { ...emp, ledger: [postedLedgerEntry, ...emp.ledger] } : emp));
        } else if (newRecipientType === 'supplier') {
          setSuppliers(prev => prev.map(s => s.id === newRecipientId ? { ...s, ledger: [postedLedgerEntry, ...s.ledger] } : s));
        }
      }
    }
  };

  // Update Budget Capital Item
  const handleUpdateBudgetItem = (id: string, updatedData: Omit<BudgetItem, 'id' | 'createdBy'>) => {
    setBudget(prev => prev.map(item => item.id === id ? { ...item, ...updatedData, updatedBy: getActorName() } : item));
  };


  // =================================== TAB CONTENT ROUTING ===================================
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            expenses={expenses}
            workers={workers}
            suppliers={suppliers}
            employees={employees}
            budget={budget}
            currency={currency}
            projectId={projectId}
            sharedRole={sharedRole}
            syncStatus={syncStatus}
            onSetProjectId={handleSetProjectId}
            onCreateShareLink={handleCreateShareLink}
            onCancelCloudSync={handleCancelCloudSync}
            onRestoreOwnerRole={handleRestoreOwnerRole}
            setActiveTab={(tab) => {
              handleTabChange(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        );
      case 'expenses':
        return (
          <DailyExpenses 
            expenses={expenses}
            workers={workers}
            suppliers={suppliers}
            employees={employees}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateExpense={handleUpdateExpense}
            setActiveTab={handleTabChange}
            currency={currency}
            sharedRole={sharedRole}
          />
        );
      case 'workers':
        return (
          <Workers 
            workers={workers.map(w => syncWorkerNutritionLedger(w))}
            onAddWorker={handleAddWorker}
            onDeleteWorker={handleDeleteWorker}
            onUpdateWorker={handleUpdateWorker}
            onAddWorkerLedgerEntry={handleAddWorkerLedgerEntry}
            onDeleteWorkerLedgerEntry={handleDeleteWorkerLedgerEntry}
            onUpdateWorkerLedgerEntry={handleUpdateWorkerLedgerEntry}
            onAddWorkerExtraPeriod={handleAddWorkerExtraPeriod}
            onDeleteWorkerExtraPeriod={handleDeleteWorkerExtraPeriod}
            onAddWorkerNutritionPeriod={handleAddWorkerNutritionPeriod}
            onUpdateWorkerNutritionPeriod={handleUpdateWorkerNutritionPeriod}
            onDeleteWorkerNutritionPeriod={handleDeleteWorkerNutritionPeriod}
            onTransferWorkerToEmployee={handleTransferWorkerToEmployee}
            setActiveTab={handleTabChange}
            currency={currency}
            sharedRole={sharedRole}
          />
        );
      case 'employees':
        return (
          <Employees 
            employees={employees}
            onAddEmployee={handleAddEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onAddEmployeeLedgerEntry={handleAddEmployeeLedgerEntry}
            onDeleteEmployeeLedgerEntry={handleDeleteEmployeeLedgerEntry}
            onUpdateEmployeeLedgerEntry={handleUpdateEmployeeLedgerEntry}
            onAddEmployeeExtraPeriod={handleAddEmployeeExtraPeriod}
            onDeleteEmployeeExtraPeriod={handleDeleteEmployeeExtraPeriod}
            onTransferEmployeeToWorker={handleTransferEmployeeToWorker}
            setActiveTab={handleTabChange}
            currency={currency}
            sharedRole={sharedRole}
          />
        );
      case 'suppliers':
        return (
          <Suppliers 
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onAddSupplierLedgerEntry={handleAddSupplierLedgerEntry}
            onDeleteSupplierLedgerEntry={handleDeleteSupplierLedgerEntry}
            onUpdateSupplierLedgerEntry={handleUpdateSupplierLedgerEntry}
            setActiveTab={handleTabChange}
            currency={currency}
            sharedRole={sharedRole}
          />
        );
      case 'budget':
        return (
          <Budget 
            budget={budget}
            expenses={expenses}
            workers={workers}
            employees={employees}
            suppliers={suppliers}
            onAddBudgetItem={handleAddBudgetItem}
            onDeleteBudgetItem={handleDeleteBudgetItem}
            onUpdateBudgetItem={handleUpdateBudgetItem}
            setActiveTab={handleTabChange}
            currency={currency}
            sharedRole={sharedRole}
          />
        );
      case 'reports':
        return (
          <FinancialReports 
            budget={budget}
            expenses={expenses}
            workers={workers}
            suppliers={suppliers}
            employees={employees}
            currency={currency}
            setActiveTab={handleTabChange}
            sharedRole={sharedRole}
          />
        );
      case 'debts':
        return (
          <Debts 
            workers={workers}
            employees={employees}
            suppliers={suppliers}
            currency={currency}
            setActiveTab={handleTabChange}
            sharedRole={sharedRole}
            onAddWorkerLedgerEntry={handleAddWorkerLedgerEntry}
            onAddEmployeeLedgerEntry={handleAddEmployeeLedgerEntry}
            onAddSupplierLedgerEntry={handleAddSupplierLedgerEntry}
          />
        );
      case 'projects':
        return (
          <ProjectsHub 
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onDuplicateProject={handleDuplicateProject}
            currency={currency}
            companyName={companyName}
            companyAddress={companyAddress}
            companyPhone={companyPhone}
            designerName="م/ ياسر عقيل"
            designerPhone="771999911"
            projectId={projectId}
            sharedRole={sharedRole}
            syncStatus={syncStatus}
            onCreateShareLink={handleCreateShareLink}
            onSetProjectId={handleSetProjectId}
            onCancelCloudSync={handleCancelCloudSync}
            onMigrateEntity={handleMigrateEntity}
            onRestoreAllProjects={handleRestoreAllProjects}
            onRestoreOwnerRole={handleRestoreOwnerRole}
            setActiveTab={handleTabChange}
          />
        );
      case 'backup':
        return (
          <BackupRestore 
            expenses={expenses}
            setExpenses={setExpenses}
            workers={workers}
            setWorkers={setWorkers}
            employees={employees}
            setEmployees={setEmployees}
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            budget={budget}
            setBudget={setBudget}
            currency={currency}
            setCurrency={setCurrency}
            projectName={projectName}
            setProjectName={setProjectName}
            companyName={companyName}
            setCompanyName={setCompanyName}
            companyAddress={companyAddress}
            setCompanyAddress={setCompanyAddress}
            companyPhone={companyPhone}
            setCompanyPhone={setCompanyPhone}
            userName={userName}
            setUserName={setUserName}
            setActiveTab={handleTabChange}
            sharedRole={sharedRole}
          />
        );
      default:
        return <div className="text-center py-12">تحميل التبويب...</div>;
    }
  };

  const printInNewTab = () => {
    if (!printPreview) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if ((window as any).showToast) {
        (window as any).showToast("⚠️ الرجاء السماح بالنوافذ المنبثقة (Popups) في متصفحك لفتح صفحة الطباعة.");
      }
      return;
    }

    const showHeader = localStorage.getItem('site_show_report_header') !== 'false';
    const showSignatures = localStorage.getItem('site_show_signature_blocks') !== 'false';
    const showAttribution = localStorage.getItem('site_show_designer_attribution') !== 'false';
    const footerNotes = (localStorage.getItem('site_report_footer_notes') || '').trim();
    
    // Check if content ALREADY contains an official header / table header structure
    const hasExistingHeader = printPreview.htmlContent.includes('report-header') || printPreview.htmlContent.includes('official-report-header') || printPreview.htmlContent.includes('pdf-report-root');

    const headerHtml = (showHeader && !hasExistingHeader) ? `
      <div class="official-report-header">
        <div class="header-col-right">
          <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: bold;">${companyName}</h2>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">قسم الحسابات والرقابة المالية</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold;">المشروع: ${projectName || 'مشروع العمل الجاري'}</p>
        </div>
        <div class="header-col-center">
          <div style="width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d97706; margin-bottom: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.12); background-color: #ffffff;">
            <img src="${COMPANY_LOGO_BASE64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="شعار الشركة" />
          </div>
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${printPreview.title}</h1>
          <span style="font-size: 10px; color: #64748b; margin-top: 2px; font-weight: bold;">الإدارة المالية والتنفيذية للمشاريع</span>
        </div>
        <div class="header-col-left" style="text-align: left;">
          <h3 style="margin: 0; font-size: 13px; color: #1e293b; font-weight: bold;">تقرير رسمي معتمد</h3>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #16a34a; font-weight: bold;">الحالة: مستند معتمد داخلياً</p>
        </div>
      </div>
    ` : '';

    let footerCustomHtml = '';

    if (footerNotes) {
      footerCustomHtml += `
        <div style="margin-top: 20px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; color: #334155; line-height: 1.6; page-break-inside: avoid;">
          <strong style="color: #0f172a; display: block; margin-bottom: 4px; font-size: 12px;">📌 الملاحظات الختامية والشروط:</strong>
          <div style="white-space: pre-wrap;">${footerNotes}</div>
        </div>
      `;
    }

    if (showSignatures) {
      footerCustomHtml += `
        <div style="margin-top: 35px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 20px; page-break-inside: avoid;">
          <div style="flex: 1;"><p style="margin:0 0 30px 0; color: #1e293b;">توقيع المستلم</p><p style="margin:0; color: #94a3b8;">.................................</p></div>
          <div style="flex: 1;"><p style="margin:0 0 30px 0; color: #1e293b;">توقيع المحاسب المسئول</p><p style="margin:0; color: #94a3b8;">.................................</p></div>
          <div style="flex: 1;"><p style="margin:0 0 30px 0; color: #1e293b;">توقيع واعتماد المدير</p><p style="margin:0; color: #94a3b8;">.................................</p></div>
        </div>
      `;
    }

    if (showAttribution) {
      footerCustomHtml += `
        <div class="footer-note" style="margin-top: 25px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px; page-break-inside: avoid;">
          تم توليد هذا التقرير تلقائياً بواسطة تطبيق الحسابات وادارة المشاريع - ${companyName} | توقيع المهندس/المصمم ومطور النظام المعتمد | تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
        </div>
      `;
    } else {
      footerCustomHtml += `
        <div class="footer-note" style="margin-top: 25px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px; page-break-inside: avoid;">
          ${companyName} - تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
        </div>
      `;
    }

    // Generate full self-contained print-ready HTML for the new window
    const fullHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <title>${printPreview.title}</title>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print-btn { display: none !important; }
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
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
        padding: 24px;
        color: #334155;
        direction: rtl;
        background-color: #fff;
        line-height: 1.5;
        margin: 0;
      }
      .official-report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 3px double #0f172a;
        padding-bottom: 12px;
        margin-bottom: 20px;
        page-break-after: avoid;
      }
      .header-col-right {
        text-align: right;
        flex: 1;
      }
      .header-col-center {
        text-align: center;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .header-col-left {
        text-align: left;
        flex: 1;
      }
      .badge {
        font-size: 10px;
        font-weight: bold;
        color: #0369a1;
        background-color: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 9999px;
        padding: 4px 10px;
        margin-bottom: 6px;
        display: inline-block;
      }
      .header {
        display: none !important;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 13px;
      }
      th {
        background-color: #1e293b !important;
        color: #ffffff !important;
        font-weight: bold;
        text-align: right;
        padding: 8px 10px;
        border: 1px solid #0f172a;
      }
      td {
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        text-align: right;
      }
      tr:nth-child(even) td {
        background-color: #f8fafc;
      }
      .total-section {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
        gap: 20px;
        font-weight: bold;
        font-size: 15px;
        border-top: 2px solid #cbd5e1;
        padding-top: 12px;
      }
      .total-box {
        background-color: #f1f5f9;
        padding: 10px 20px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .footer-note {
        text-align: center;
        margin-top: 30px;
        padding-top: 10px;
        border-top: 1px solid #cbd5e1;
        font-size: 11px;
        color: #64748b;
      }
      .no-print-btn {
        display: block;
        text-align: center;
        margin-bottom: 20px;
        padding: 12px;
        background-color: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 12px;
      }
      .print-btn {
        background-color: #0284c7;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        font-family: 'Cairo', sans-serif;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        transition: background-color 0.2s;
      }
      .print-btn:hover {
        background-color: #0369a1;
      }
    </style>
  </head>
  <body>
    <div class="no-print-btn">
      <button class="print-btn" onclick="window.print()">اضغط هنا لبدء الطباعة أو الحفظ كـ PDF 🖨️</button>
    </div>
    
    ${headerHtml}
    ${printPreview.htmlContent}
    ${footerCustomHtml}
    
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
      }
    </script>
  </body>
</html>
    `;
    
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    
    if ((window as any).showToast) {
      (window as any).showToast("📋 جاري تحضير وفتح نافذة الطباعة الرسمية وحفظ PDF...");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800" id="main-app-container">
      
      {/* Upper Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* App Logo / Name */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-md shrink-0 flex items-center justify-center ring-2 ring-white/10">
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  <img src={COMPANY_LOGO_BASE64} alt="شعار الشركة" className="w-full h-full object-cover rounded-full" />
                </div>
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight leading-none text-white sm:text-lg">الحسابات وادارة المشاريع</h1>
                <span className="text-[10px] text-amber-300/90 font-medium">{companyName}</span>
              </div>

              {/* ⚙️ Main Settings Button in Top Header */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl border border-amber-500/30 transition-all cursor-pointer shadow-2xs mr-1.5 sm:mr-3 flex items-center gap-1.5 text-xs font-bold shrink-0"
                title="ضبط وإعدادات التطبيق العامة"
              >
                <Settings size={16} className="text-amber-400 animate-spin-slow" />
                <span className="hidden sm:inline text-white font-extrabold">الإعدادات</span>
              </button>

              {/* 🚪 Main Exit Button in Top Header */}
              <button
                onClick={() => setShowExitConfirmModal(true)}
                className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/30 hover:border-rose-500/50 transition-all cursor-pointer shadow-2xs mr-1 sm:mr-2 flex items-center gap-1.5 text-xs font-bold shrink-0"
                title="الخروج النهائي من التطبيق"
              >
                <LogOut size={16} className="text-rose-400" />
                <span className="hidden sm:inline text-white font-extrabold">خروج</span>
              </button>
            </div>

            {/* Desktop Navbar Menu */}
            <nav className="hidden md:flex space-x-reverse space-x-1">
              
              <button 
                onClick={() => handleTabChange('projects')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'projects' 
                    ? 'bg-sky-600 text-white shadow-xs ring-1 ring-sky-400/40' 
                    : 'text-sky-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Building2 size={14} />
                المشاريع ({projects.length})
              </button>

              <button 
                onClick={() => handleTabChange('dashboard')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'dashboard' 
                    ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard size={14} />
                الرئيسية
              </button>

              <button 
                onClick={() => handleTabChange('expenses')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'expenses' 
                    ? 'bg-slate-800 text-rose-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <TrendingUp size={14} />
                النفقات اليومية
              </button>

              <button 
                onClick={() => handleTabChange('workers')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'workers' 
                    ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Users size={14} />
                العمال
              </button>

              <button 
                onClick={() => handleTabChange('employees')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'employees' 
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Briefcase size={14} />
                الموظفين
              </button>

              <button 
                onClick={() => handleTabChange('suppliers')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'suppliers' 
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Truck size={14} />
                الموردين
              </button>

              <button 
                onClick={() => handleTabChange('budget')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'budget' 
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Wallet size={14} />
                الميزانية العامة
              </button>

              <button 
                onClick={() => handleTabChange('debts')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'debts' 
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Coins size={14} />
                الديون والالتزامات
              </button>

              <button 
                onClick={() => handleTabChange('reports')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'reports' 
                    ? 'bg-slate-800 text-violet-400 border border-slate-700 shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <FileText size={14} />
                التقارير الشاملة
              </button>

              <button 
                onClick={() => handleTabChange('backup')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'backup' 
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-xs ring-1 ring-amber-500/30' 
                    : 'text-amber-300/90 hover:text-amber-200 hover:bg-slate-800/50'
                }`}
              >
                <Database size={14} />
                النسخ الاحتياطي
              </button>

            </nav>

            {/* Mobile menu trigger */}
            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg focus:outline-hidden cursor-pointer"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile dropdown menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1.5 shadow-lg">
            
            <button 
              onClick={() => { setShowSettingsModal(true); setMobileMenuOpen(false); }}
              className="w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 cursor-pointer text-amber-400 bg-slate-800/90 hover:bg-slate-800 border border-amber-500/30 shadow-2xs"
            >
              <Settings size={16} className="text-amber-400" />
              ضبط وإعدادات التطبيق ⚙️
            </button>

            <button 
              onClick={() => { setShowExitConfirmModal(true); setMobileMenuOpen(false); }}
              className="w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 cursor-pointer text-rose-400 bg-slate-800/90 hover:bg-rose-950/40 border border-rose-500/30 shadow-2xs"
            >
              <LogOut size={16} className="text-rose-400" />
              الخروج النهائي من التطبيق 🚪
            </button>

            <button 
              onClick={() => { handleTabChange('projects'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'projects' ? 'bg-sky-600 text-white' : 'text-sky-300 hover:bg-slate-800/30'
              }`}
            >
              <Building2 size={16} />
              مركز إدارة المشاريع ({projects.length})
            </button>

            <button 
              onClick={() => { handleTabChange('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-slate-800 text-sky-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <LayoutDashboard size={16} />
              شاشة التحكم الرئيسية
            </button>

            <button 
              onClick={() => { handleTabChange('expenses'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'expenses' ? 'bg-slate-800 text-rose-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <TrendingUp size={16} />
              النفقات اليومية
            </button>

            <button 
              onClick={() => { handleTabChange('workers'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'workers' ? 'bg-slate-800 text-sky-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Users size={16} />
              إدارة العمال وكشف الحساب
            </button>

            <button 
              onClick={() => { handleTabChange('employees'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'employees' ? 'bg-slate-800 text-indigo-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Briefcase size={16} />
              إدارة الموظفين والأجور اليومية
            </button>

            <button 
              onClick={() => { handleTabChange('suppliers'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Truck size={16} />
              إدارة حساب الموردين
            </button>

            <button 
              onClick={() => { handleTabChange('budget'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'budget' ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Wallet size={16} />
              الميزانية والصندوق العام
            </button>

            <button 
              onClick={() => { handleTabChange('debts'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'debts' ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Coins size={16} />
              الديون والالتزامات المستحقة
            </button>

            <button 
              onClick={() => { handleTabChange('reports'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'reports' ? 'bg-slate-800 text-violet-400' : 'text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <FileText size={16} />
              التقارير المالية الشاملة
            </button>

            <button 
              onClick={() => { handleTabChange('backup'); setMobileMenuOpen(false); }}
              className={`w-full text-right px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'backup' ? 'bg-slate-800 text-amber-400' : 'text-amber-300/90 hover:bg-slate-800/30'
              }`}
            >
              <Database size={16} />
              النسخ الاحتياطي واستعادة البيانات
            </button>

          </div>
        )}
      </header>

      {/* Sub-header Active Project Context Bar */}
      {activeTab !== 'projects' && (() => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        let statusLabel = 'نشط';
        let statusCls = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';

        if (activeProj?.status === 'completed') {
          statusLabel = 'مكتمل ومسلم';
          statusCls = 'bg-sky-500/20 text-sky-300 border-sky-400/30';
        } else if (activeProj?.status === 'planning') {
          statusLabel = 'قيد التخطيط';
          statusCls = 'bg-amber-500/20 text-amber-300 border-amber-400/30';
        } else if (activeProj?.status === 'paused') {
          statusLabel = 'متوقف مؤقتاً';
          statusCls = 'bg-rose-500/20 text-rose-300 border-rose-400/30';
        } else if (activeProj?.status === 'active') {
          statusLabel = 'نشط';
          statusCls = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
        }

        return (
          <div className="bg-slate-800 border-b border-slate-700/80 text-white px-3 py-1.5 text-xs font-bold shadow-xs">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold shrink-0 ${statusCls}`}>
                  {statusLabel}
                </span>
                <span className="text-white font-extrabold truncate text-xs sm:text-sm">
                  {projectName}
                </span>
                {activeProj?.location && (
                  <span className="hidden sm:inline text-slate-400 font-medium text-xs">
                    - {activeProj.location}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleTabChange('projects')}
                className="px-2.5 py-1 bg-slate-700 hover:bg-sky-600 text-sky-200 hover:text-white rounded-lg text-[11px] font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <ArrowRight size={13} />
                <span>رجوع</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Main Container Content */}
      <main className={`flex-1 max-w-7xl mx-auto w-full px-2.5 sm:px-4 lg:px-6 py-3.5 sm:py-5 ${activeTab === 'projects' ? 'pb-8' : 'pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:pb-32'}`}>
        {renderTabContent()}
      </main>

      {/* Bottom Navigation Bar (Hidden on main projects screen) */}
      {activeTab !== 'projects' && (
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Humble professional credit footer */}
      <footer className={`bg-white border-t border-slate-100 py-6 ${activeTab === 'projects' ? 'pb-8' : 'pb-32 sm:pb-40'} mt-12 text-center text-xs text-slate-400`}>
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} الحسابات وادارة المشاريع. جميع الحقوق محفوظة.</p>
          <p className="mt-1 text-[10px]">تطبيق مالي محلي متكامل لحفظ حسابات العمل والمشاريع في المتصفح أوفلاين.</p>
        </div>
      </footer>

      {/* User Name Form Prompt */}
      {promptUserName && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full space-y-4 text-right my-auto max-h-[90vh] overflow-y-auto overscroll-contain" 
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800">الانضمام إلى كشف الحساب المشترك</h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              أنت على وشك الدخول إلى كشف حساب مشترك. الرجاء كتابة اسمك (مثال: المهندس علي، أبو أحمد) ليتم وسم الحركات والبيانات التي تضيفها أو تعدلها باسمك.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">اسم المستخدم</label>
              <input 
                type="text"
                placeholder="اكتب اسمك هنا..."
                value={tempUserName}
                onChange={(e) => setTempUserName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-hidden focus:border-sky-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveUserName();
                }}
              />
            </div>
            <div className="space-y-2 pt-1">
              <button 
                onClick={handleSaveUserName}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                دخول الحساب المشترك
              </button>

              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={handleRestoreOwnerRole}
                  className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>👑</span>
                  <span>أنا مالك المشروع (المهندس/ياسر عقيل) - دخول كمالك رئيسي</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-24 left-5 z-50 max-w-sm bg-slate-900 text-white text-xs font-bold py-3.5 px-5 rounded-xl shadow-xl border border-slate-800 animate-fade-in flex items-center gap-2" dir="rtl">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Seamless Custom Print Preview Modal */}
      {printPreview && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto overscroll-contain" 
          id="print-preview-modal-bg"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full mx-auto my-auto shadow-2xl flex flex-col border border-slate-200 max-h-[95vh] overflow-y-auto overscroll-contain" 
            id="print-preview-container-root"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header with actions */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl no-print" id="print-preview-header">
              <div className="flex items-center gap-2 text-right" dir="rtl">
                <FileText className="text-sky-500" size={18} />
                <span className="font-extrabold text-sm text-slate-700">تخصيص وتصدير التقرير الرسمي</span>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={printInNewTab}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  طباعة وحفظ كـ PDF رسمي 🖨️
                </button>
                <button
                  onClick={() => {
                    if (!printPreview) return;
                    
                    const hasExistingHeader = printPreview.htmlContent.includes('report-header') || printPreview.htmlContent.includes('official-report-header') || printPreview.htmlContent.includes('pdf-report-root');

                    const headerHtml = hasExistingHeader ? '' : `
                      <div class="official-report-header">
                        <div class="header-col-right">
                          <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: bold;">${companyName}</h2>
                          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">قسم الحسابات والرقابة المالية</p>
                          <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold;">المشروع: ${projectName || 'مشروع العمل الجاري'}</p>
                        </div>
                        <div class="header-col-center">
                          <div style="width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d97706; margin-bottom: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.12); background-color: #ffffff;">
                            <img src="${COMPANY_LOGO_BASE64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="شعار الشركة" />
                          </div>
                          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${printPreview.title}</h1>
                          <span style="font-size: 10px; color: #64748b; margin-top: 2px; font-weight: bold;">الإدارة المالية والتنفيذية للمشاريع</span>
                        </div>
                        <div class="header-col-left" style="text-align: left;">
                          <h3 style="margin: 0; font-size: 13px; color: #1e293b; font-weight: bold;">تقرير رسمي معتمد</h3>
                          <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</p>
                          <p style="margin: 2px 0 0 0; font-size: 10px; color: #16a34a; font-weight: bold;">الحالة: مستند معتمد داخلياً</p>
                        </div>
                      </div>
                    `;

                    // Generate full self-contained print-ready HTML
                    const fullHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <title>${printPreview.title}</title>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print-btn { display: none !important; }
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
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
        padding: 24px;
        color: #334155;
        direction: rtl;
        background-color: #fff;
        line-height: 1.5;
        margin: 0;
      }
      .official-report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 3px double #0f172a;
        padding-bottom: 12px;
        margin-bottom: 20px;
        page-break-after: avoid;
      }
      .header-col-right {
        text-align: right;
        flex: 1;
      }
      .header-col-center {
        text-align: center;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .header-col-left {
        text-align: left;
        flex: 1;
      }
      .badge {
        font-size: 10px;
        font-weight: bold;
        color: #0369a1;
        background-color: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 9999px;
        padding: 4px 10px;
        margin-bottom: 6px;
        display: inline-block;
      }
      .header {
        display: none !important;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 13px;
      }
      th {
        background-color: #1e293b !important;
        color: #ffffff !important;
        font-weight: bold;
        text-align: right;
        padding: 8px 10px;
        border: 1px solid #0f172a;
      }
      td {
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        text-align: right;
      }
      tr:nth-child(even) td {
        background-color: #f8fafc;
      }
      .total-section {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
        gap: 20px;
        font-weight: bold;
        font-size: 15px;
        border-top: 2px solid #cbd5e1;
        padding-top: 12px;
      }
      .total-box {
        background-color: #f1f5f9;
        padding: 10px 20px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .footer-note {
        text-align: center;
        margin-top: 30px;
        padding-top: 10px;
        border-top: 1px solid #cbd5e1;
        font-size: 11px;
        color: #64748b;
      }
      .no-print-btn {
        display: block;
        text-align: center;
        margin-bottom: 20px;
        padding: 12px;
        background-color: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 12px;
      }
      .print-btn {
        background-color: #0284c7;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        font-family: 'Cairo', sans-serif;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        transition: background-color 0.2s;
      }
      .print-btn:hover {
        background-color: #0369a1;
      }
    </style>
  </head>
  <body>
    <div class="no-print-btn">
      <button class="print-btn" onclick="window.print()">اضغط هنا لبدء الطباعة أو الحفظ كـ PDF 🖨️</button>
    </div>
    
    ${headerHtml}
    ${printPreview.htmlContent}
    <div class="footer-note">تم توليد هذا التقرير تلقائياً بواسطة تطبيق الحسابات وادارة المشاريع - ${companyName} - تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</div>
    <script>
      // Auto-trigger print modal on loading
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 300);
      }
    </script>
  </body>
</html>
                    `;
                    
                    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const safeTitle = ensureDateInFilename(printPreview.title);
                    link.download = safeTitle.toLowerCase().endsWith('.html') ? safeTitle : `${safeTitle}.html`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Show a helpful user toast instruction
                    if ((window as any).showToast) {
                      (window as any).showToast("تم تحميل ملف التقرير مجهزاً للطباعة! افتحه للطباعة أو الحفظ كـ PDF.");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  تحميل ملف HTML للطباعة 🌐
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  طباعة المتصفح التقليدية 🖨️
                </button>
                <button
                  onClick={() => setPrintPreview(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Configurable Report Metadata Control Panel */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print text-right" dir="rtl">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">اسم الشركة (الترويسة الرسمية):</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    localStorage.setItem('site_company_name', e.target.value);
                  }}
                  placeholder="شركة ورلد أوف إيليتس للمقاولات والخدمات"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">اسم المشروع (الترويسة الرسمية):</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    localStorage.setItem('site_project_name', e.target.value);
                  }}
                  placeholder="مشروع المقاولات والإنشاءات الرئيسي"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">عنوان الشركة (التذييل الرسمي):</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={(e) => {
                    setCompanyAddress(e.target.value);
                    localStorage.setItem('site_company_address', e.target.value);
                  }}
                  placeholder="صنعاء - شارع الستين - عمارة النخبة"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 block">أرقام التواصل (التذييل الرسمي):</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => {
                    setCompanyPhone(e.target.value);
                    localStorage.setItem('site_company_phone', e.target.value);
                  }}
                  placeholder="+967 770 000 000 / +967 01 200000"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>

            {/* Info notice for sandbox */}
            <div className="p-3 bg-sky-50 border-b border-sky-100 text-sky-800 text-[11px] leading-relaxed no-print text-right" dir="rtl" id="print-preview-info">
              💡 <strong>تنبيه تصدير PDF:</strong> لتفادي قيود حماية المتصفح، تم تزويد التطبيق بميزة <strong className="text-sky-700">"تصدير كـ PDF فوري"</strong> التي تقوم بتجميع التقرير وتنزيله مباشرة كملف PDF مجهز تماماً! يمكنك تعديل بيانات الشركة والمشروع أعلاه وسيتم تحديثها في التقرير فوراً!
            </div>

            {/* Sheet view */}
            <div className="p-8 overflow-x-auto bg-white" dir="rtl">
              {(() => {
                const showHeader = localStorage.getItem('site_show_report_header') !== 'false';
                const showSignatures = localStorage.getItem('site_show_signature_blocks') !== 'false';
                const showAttribution = localStorage.getItem('site_show_designer_attribution') !== 'false';
                const footerNotes = (localStorage.getItem('site_report_footer_notes') || '').trim();
                const hasExistingHeader = printPreview.htmlContent.includes('report-header') || printPreview.htmlContent.includes('official-report-header') || printPreview.htmlContent.includes('pdf-report-root');

                return (
                  <div id="print-preview-document-body" className="bg-white p-2">
                    <style dangerouslySetInnerHTML={{ __html: `
                      #print-preview-document-body {
                        font-family: 'Cairo', sans-serif !important;
                        color: #334155;
                        direction: rtl;
                      }
                      #print-preview-document-body .header {
                        display: none !important;
                      }
                    `}} />
                    
                    {showHeader && !hasExistingHeader && (
                      <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3 mb-5 text-right">
                        <div>
                          <h2 className="font-bold text-base text-slate-900">{companyName}</h2>
                          <p className="text-xs text-slate-500">قسم الحسابات والرقابة المالية</p>
                          <p className="text-xs text-slate-700 font-bold">المشروع: {projectName || 'مشروع العمل الجاري'}</p>
                        </div>
                        <div className="text-center flex flex-col items-center">
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-600 shadow-xs mb-1 bg-white flex items-center justify-center">
                            <img src={COMPANY_LOGO_BASE64} className="w-full h-full object-cover rounded-full" alt="شعار الشركة" />
                          </div>
                          <h1 className="font-black text-lg text-slate-900">{printPreview.title}</h1>
                          <span className="text-[10px] text-slate-500 font-bold">الإدارة المالية والتنفيذية للمشاريع</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-xs text-slate-800">تقرير رسمي معتمد</h3>
                          <p className="text-xs text-slate-500">التاريخ: {new Date().toLocaleDateString('ar-EG-u-nu-latn')}</p>
                          <p className="text-[10px] text-emerald-600 font-bold">الحالة: مستند معتمد داخلياً</p>
                        </div>
                      </div>
                    )}

                    <div dangerouslySetInnerHTML={{ __html: printPreview.htmlContent }} />

                    {footerNotes && (
                      <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                        <strong className="text-slate-900 block mb-1">📌 الملاحظات الختامية والشروط:</strong>
                        <div className="whitespace-pre-wrap">{footerNotes}</div>
                      </div>
                    )}

                    {showSignatures && (
                      <div className="mt-8 pt-5 border-t border-dashed border-slate-300 grid grid-cols-3 gap-4 text-center text-xs font-bold text-slate-800">
                        <div>
                          <p className="mb-6">توقيع المستلم</p>
                          <p className="text-slate-300">.................................</p>
                        </div>
                        <div>
                          <p className="mb-6">توقيع المحاسب المسئول</p>
                          <p className="text-slate-300">.................................</p>
                        </div>
                        <div>
                          <p className="mb-6">توقيع واعتماد المدير</p>
                          <p className="text-slate-300">.................................</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 pt-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
                      {showAttribution ? (
                        <span>تم توليد هذا التقرير تلقائياً بواسطة تطبيق الحسابات وادارة المشاريع - {companyName} | توقيع المهندس/المصمم ومطور النظام المعتمد</span>
                      ) : (
                        <span>{companyName} - تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG-u-nu-latn')}</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Exit Confirmation Modal for Phone Back Button */}
      {showExitConfirmModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-scale-up overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <LogOut size={32} />
            </div>

            <h3 className="text-lg font-black text-slate-900">تأكيد الخروج من التطبيق</h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت تأكد من رغبتك في الخروج من التطبيق؟ ستبقى جميع بياناتك وتحديثات الحسابات محفوظة بأمان.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleExitApp}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                تأكيد الخروج من التطبيق
              </button>

              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                إلغاء والبقاء في التطبيق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disabled Sync / Access Cancelled Modal */}
      {isSyncDisabled && (
        <div 
          className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-[300] flex items-center justify-center p-4 dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl border border-rose-100 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">
                تم إلغاء المزامنة السحابية
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-semibold">
                {syncDisabledMessage || 'تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك الرئيسي، ولم يعد الوصول أو الاطلاع عبر هذا الرابط متاحاً نهائياً.'}
              </p>
            </div>
            <button
              onClick={() => {
                setIsSyncDisabled(false);
                setProjects(prev => prev.map(p => p.syncProjectId === projectId ? { ...p, syncProjectId: null } : p));
                setProjectId(null);
                window.history.replaceState({}, '', window.location.pathname);
              }}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm py-3 px-6 rounded-xl transition-all shadow-md cursor-pointer"
            >
              متابعة بالوضع المحلي الشخصي
            </button>
          </div>
        </div>
      )}

      {/* ⚙️ Global Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currency={currency}
        onCurrencyChange={(newCurr) => {
          setCurrency(newCurr);
          localStorage.setItem('site_currency', newCurr);
        }}
        companyName={companyName}
        onCompanyNameChange={(name) => {
          setCompanyName(name);
          localStorage.setItem('site_company_name', name);
        }}
        companyAddress={companyAddress}
        onCompanyAddressChange={(addr) => {
          setCompanyAddress(addr);
          localStorage.setItem('site_company_address', addr);
        }}
        companyPhone={companyPhone}
        onCompanyPhoneChange={(ph) => {
          setCompanyPhone(ph);
          localStorage.setItem('site_company_phone', ph);
        }}
        userName={userName}
        onUserNameChange={(uName) => {
          setUserName(uName);
          localStorage.setItem('site_user_name', uName);
        }}
        onOpenBackupModal={() => handleTabChange('backup')}
        onResetAllData={handleResetAllData}
        sharedRole={sharedRole}
        onRestoreOwnerRole={handleRestoreOwnerRole}
      />

    </div>
  );
}
