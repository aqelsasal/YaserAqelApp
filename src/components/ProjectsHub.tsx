/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  User, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Truck, 
  CheckCircle2, 
  Clock, 
  PauseCircle, 
  Edit3, 
  Trash2, 
  Copy, 
  ArrowRight, 
  FileSpreadsheet, 
  Printer, 
  Briefcase, 
  Star,
  FileText,
  AlertCircle,
  Cloud,
  Share2,
  Lock,
  Unlock,
  RefreshCw,
  Phone,
  Layers,
  Home,
  Landmark,
  Wrench,
  Warehouse,
  HardHat,
  ArrowLeftRight,
  Check,
  Globe,
  Database,
  Download,
  Upload,
  FileJson,
  ShieldCheck,
  HardDrive,
  Info,
  Save,
  AlertTriangle
} from 'lucide-react';
import { Project, formatCurrency, exportToXLSX, printPDF, COMPANY_LOGO_BASE64, getFormattedReportDate, ensureDateInFilename } from '../types';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface ProjectsHubProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (newProj: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject: (proj: Project) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  currency?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  designerName?: string;
  designerPhone?: string;
  projectId?: string;
  sharedRole?: string;
  syncStatus?: 'idle' | 'loading' | 'success' | 'error';
  onCreateShareLink?: (role?: 'read' | 'add' | 'full') => Promise<string>;
  onSetProjectId?: (id: string) => void;
  onCancelCloudSync?: () => Promise<void> | void;
  onMigrateEntity?: (params: {
    sourceProjectId: string;
    targetProjectId: string;
    entityType: 'worker' | 'employee' | 'supplier';
    entityId: string;
    includeLedger: boolean;
  }) => void;
  onRestoreAllProjects?: (
    data: { projects: Project[]; settings?: any; externalDebts?: any[] },
    mode: 'overwrite' | 'merge'
  ) => void;
  onRestoreOwnerRole?: () => void;
  setActiveTab?: (tab: string) => void;
}

export default function ProjectsHub({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onDuplicateProject,
  currency = 'YER',
  companyName = 'ورلد أوف إيليتس للمقاولات والخدمات',
  companyAddress = '',
  companyPhone = '',
  designerName = 'م/ ياسر عقيل',
  designerPhone = '771999911',
  projectId,
  sharedRole,
  syncStatus,
  onCreateShareLink,
  onSetProjectId,
  onCancelCloudSync,
  onMigrateEntity,
  onRestoreAllProjects,
  onRestoreOwnerRole,
  setActiveTab
}: ProjectsHubProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planning' | 'paused' | 'completed'>('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sharing & Local Mode Modals
  const [showCloudShareModal, setShowCloudShareModal] = useState(false);
  const [showLocalModeModal, setShowLocalModeModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // Full App Backup & Restore States
  const fullBackupFileInputRef = useRef<HTMLInputElement>(null);
  const projectBackupFileInputRef = useRef<HTMLInputElement>(null);
  const [showFullAppRestoreModal, setShowFullAppRestoreModal] = useState(false);
  const [fullAppRestoreModalData, setFullAppRestoreModalData] = useState<any>(null);
  const [fullAppRestoreMode, setFullAppRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');

  // Lock background scroll when any ProjectsHub modal is open
  useBodyScrollLock(Boolean(showCreateModal || editingProject || deleteConfirmId || showCloudShareModal || showLocalModeModal || showMigrationModal || (showFullAppRestoreModal && fullAppRestoreModalData)));

  // Full App JSON Export
  const handleExportFullAppBackupJSON = () => {
    try {
      const externalDebtsRaw = localStorage.getItem('site_external_debts');
      const externalDebts = externalDebtsRaw ? JSON.parse(externalDebtsRaw) : [];

      // Always sync active project's latest local state/localStorage
      const activeWorkersRaw = localStorage.getItem('site_workers');
      const activeEmployeesRaw = localStorage.getItem('site_employees');
      const activeSuppliersRaw = localStorage.getItem('site_suppliers');
      const activeExpensesRaw = localStorage.getItem('site_expenses');
      const activeBudgetRaw = localStorage.getItem('site_budget');

      const syncedProjects = projects.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            budget: activeBudgetRaw ? JSON.parse(activeBudgetRaw) : (p.budget || []),
            workers: activeWorkersRaw ? JSON.parse(activeWorkersRaw) : (p.workers || []),
            employees: activeEmployeesRaw ? JSON.parse(activeEmployeesRaw) : (p.employees || []),
            suppliers: activeSuppliersRaw ? JSON.parse(activeSuppliersRaw) : (p.suppliers || []),
            expenses: activeExpensesRaw ? JSON.parse(activeExpensesRaw) : (p.expenses || []),
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      const fullBackupData = {
        app: 'نظام الحسابات وإدارة المشاريع',
        type: 'full_application_backup',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        settings: {
          companyName,
          companyAddress: companyAddress || '',
          companyPhone: companyPhone || '',
          currency,
          activeProjectId
        },
        projectsCount: syncedProjects.length,
        projects: syncedProjects,
        externalDebts: externalDebts
      };

      const jsonStr = JSON.stringify(fullBackupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const dateStr = getFormattedReportDate();
      link.href = url;
      link.download = ensureDateInFilename(`نسخة_احتياطية_شاملة_لكافة_المشاريع_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('✅ تم تصدير النسخة الاحتياطية الشاملة لكافة مشاريع التطبيق وحفظ جميع بياناتها بنجاح!');
      }
    } catch (err) {
      console.error('Error exporting full application backup:', err);
      alert('⚠️ حدث خطأ أثناء إنشاء النسخة الاحتياطية لكافة المشاريع!');
    }
  };

  // Full App JSON Import Selection
  const handleFullAppJSONSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let parsedProjects: Project[] = [];
        let parsedSettings = parsed.settings || {};
        let parsedDebts = parsed.externalDebts || [];

        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          parsedProjects = parsed.projects;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          parsedProjects = parsed;
        } else if (parsed.data || parsed.expenses || parsed.workers || parsed.employees || parsed.suppliers || parsed.budget) {
          // Single project backup
          const singleData = parsed.data || parsed;
          const singleProj: Project = {
            id: parsed.id || 'proj_imp_' + Date.now(),
            name: parsedSettings.projectName || parsed.projectName || parsed.name || 'مشروع مستورد',
            location: parsedSettings.companyAddress || parsed.location || '',
            client: parsed.client || '',
            status: parsed.status || 'active',
            startDate: parsed.startDate || new Date().toISOString().split('T')[0],
            endDate: parsed.endDate || '',
            notes: parsed.notes || 'مستورد من ملف نسخة احتياطية',
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            budget: singleData.budget || parsed.budget || [],
            workers: singleData.workers || parsed.workers || [],
            employees: singleData.employees || parsed.employees || [],
            suppliers: singleData.suppliers || parsed.suppliers || [],
            expenses: singleData.expenses || parsed.expenses || []
          };
          parsedProjects = [singleProj];
          if (singleData.externalDebts || parsed.externalDebts) {
            parsedDebts = singleData.externalDebts || parsed.externalDebts;
          }
        } else {
          alert('⚠️ الملف المحدد لا يحتوي على بيانات صالحة لمشاريع التطبيق!');
          return;
        }

        const totalExpensesCount = parsedProjects.reduce((acc, p) => acc + (p.expenses?.length || 0), 0);
        const totalWorkersCount = parsedProjects.reduce((acc, p) => acc + (p.workers?.length || 0), 0);
        const totalEmployeesCount = parsedProjects.reduce((acc, p) => acc + (p.employees?.length || 0), 0);
        const totalSuppliersCount = parsedProjects.reduce((acc, p) => acc + (p.suppliers?.length || 0), 0);

        setFullAppRestoreModalData({
          fileDate: parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('ar-YE') : 'غير محدد',
          settings: parsedSettings,
          projects: parsedProjects,
          externalDebts: parsedDebts,
          projectsCount: parsedProjects.length,
          totalExpensesCount,
          totalWorkersCount,
          totalEmployeesCount,
          totalSuppliersCount
        });
        setShowFullAppRestoreModal(true);
      } catch (err) {
        console.error('Error parsing full app JSON backup:', err);
        alert('⚠️ الملف المحدد غير صالح أو تالف! يرجى التأكد من اختيار ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Import single project backup JSON inside Create Modal
  const handleImportSingleProjectBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Case 1: Backup contains an array of projects (`projects`)
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          let importedCount = 0;
          parsed.projects.forEach((proj: Project) => {
            onCreateProject({
              name: proj.name || 'مشروع مستورد',
              location: proj.location || '',
              client: proj.client || '',
              status: proj.status || 'active',
              startDate: proj.startDate || new Date().toISOString().split('T')[0],
              endDate: proj.endDate || '',
              notes: proj.notes || 'مستورد من نسخة احتياطية',
              budget: proj.budget || [],
              workers: proj.workers || [],
              employees: proj.employees || [],
              suppliers: proj.suppliers || [],
              expenses: proj.expenses || []
            });
            importedCount++;
          });
          setShowCreateModal(false);
          if (typeof window !== 'undefined' && (window as any).showToast) {
            (window as any).showToast(`✅ تم استيراد ${importedCount} مشروع من النسخة الاحتياطية بنجاح!`);
          }
          return;
        }

        // Case 2: Single project data or backup format (parsed.data || parsed)
        const payloadData = parsed.data || parsed;
        const payloadSettings = parsed.settings || {};

        const importedName =
          payloadSettings.projectName ||
          parsed.name ||
          payloadData.projectName ||
          file.name.replace(/\.json$/i, '').replace(/^نسخة_احتياطية_شاملة_/, '').replace(/^نسخة_احتياطية_/, '') ||
          'مشروع مستورد من نسخة احتياطية';

        const newProjectObj: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
          name: importedName,
          location: payloadSettings.companyAddress || parsed.location || '',
          client: parsed.client || 'العميل الرئيسي',
          status: parsed.status || 'active',
          startDate: parsed.startDate || new Date().toISOString().split('T')[0],
          endDate: parsed.endDate || '',
          notes: parsed.notes || 'مستورد من ملف نسخة احتياطية (.json)',
          budget: Array.isArray(payloadData.budget) ? payloadData.budget : (Array.isArray(parsed.budget) ? parsed.budget : []),
          workers: Array.isArray(payloadData.workers) ? payloadData.workers : (Array.isArray(parsed.workers) ? parsed.workers : []),
          employees: Array.isArray(payloadData.employees) ? payloadData.employees : (Array.isArray(parsed.employees) ? parsed.employees : []),
          suppliers: Array.isArray(payloadData.suppliers) ? payloadData.suppliers : (Array.isArray(parsed.suppliers) ? parsed.suppliers : []),
          expenses: Array.isArray(payloadData.expenses) ? payloadData.expenses : (Array.isArray(parsed.expenses) ? parsed.expenses : [])
        };

        onCreateProject(newProjectObj);
        setShowCreateModal(false);
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast(`✅ تم استيراد مشروع "${importedName}" من النسخة الاحتياطية بنجاح!`);
        }
      } catch (err) {
        console.error('Error importing project backup JSON:', err);
        alert('⚠️ الملف المحدد غير صالح أو تالف! يرجى التأكد من اختيار ملف JSON صحيح مخصص لنسخة احتياطية للمشروع.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Full App Restore Confirmation
  const handleConfirmFullAppRestore = () => {
    if (!fullAppRestoreModalData || !onRestoreAllProjects) return;
    onRestoreAllProjects(
      {
        projects: fullAppRestoreModalData.projects,
        settings: fullAppRestoreModalData.settings,
        externalDebts: fullAppRestoreModalData.externalDebts
      },
      fullAppRestoreMode
    );
    setShowFullAppRestoreModal(false);
    setFullAppRestoreModalData(null);
  };

  // Copy/Share Link States
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [generatingRole, setGeneratingRole] = useState<string | null>(null);
  const [shareInputId, setShareInputId] = useState('');
  const [shareInputError, setShareInputError] = useState('');

  // Migration Modal Form State
  const [migrationData, setMigrationData] = useState<{
    sourceProjectId: string;
    targetProjectId: string;
    entityType: 'worker' | 'employee' | 'supplier';
    entityId: string;
    includeLedger: boolean;
  }>({
    sourceProjectId: activeProjectId || (projects[0]?.id || ''),
    targetProjectId: projects.find(p => p.id !== activeProjectId)?.id || '',
    entityType: 'worker',
    entityId: '',
    includeLedger: false
  });

  // Form State for Create/Edit
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    client: '',
    status: 'active' as 'active' | 'completed' | 'planning' | 'paused',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    initialBudgetAmount: '',
    notes: '',
    copyDataFromProjectId: ''
  });

  // Helper to render expressive project icon
  const getProjectExpressiveIcon = (projName: string, index: number) => {
    const nameLower = projName.toLowerCase();
    if (nameLower.includes('فيلا') || nameLower.includes('منزل') || nameLower.includes('بيت')) {
      return <Home size={22} className="text-amber-500 shrink-0" />;
    }
    if (nameLower.includes('برج') || nameLower.includes('طابق') || nameLower.includes('مجمع')) {
      return <Landmark size={22} className="text-purple-500 shrink-0" />;
    }
    if (nameLower.includes('طريق') || nameLower.includes('جسر') || nameLower.includes('زفلت') || nameLower.includes('بنية')) {
      return <Truck size={22} className="text-rose-500 shrink-0" />;
    }
    if (nameLower.includes('ترميم') || nameLower.includes('تشطيب') || nameLower.includes('ديكور')) {
      return <Wrench size={22} className="text-teal-500 shrink-0" />;
    }
    if (nameLower.includes('مخزن') || nameLower.includes('مستودع') || nameLower.includes('هنجر')) {
      return <Warehouse size={22} className="text-emerald-500 shrink-0" />;
    }

    // Default rotated icon set
    const icons = [
      <Building2 size={22} className="text-sky-500 shrink-0" />,
      <HardHat size={22} className="text-amber-500 shrink-0" />,
      <Landmark size={22} className="text-indigo-500 shrink-0" />,
      <Home size={22} className="text-emerald-500 shrink-0" />
    ];
    return icons[index % icons.length];
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      location: '',
      client: '',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      initialBudgetAmount: '',
      notes: '',
      copyDataFromProjectId: ''
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (proj: Project) => {
    setEditingProject(proj);
    const initialB = proj.budget.length > 0 ? proj.budget.reduce((acc, item) => acc + item.amount, 0) : '';
    setFormData({
      name: proj.name,
      location: proj.location || '',
      client: proj.client || '',
      status: proj.status,
      startDate: proj.startDate || new Date().toISOString().split('T')[0],
      endDate: proj.endDate || '',
      initialBudgetAmount: initialB ? String(initialB) : '',
      notes: proj.notes || '',
      copyDataFromProjectId: ''
    });
  };

  // Submit Form (Create or Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('يرجى كتابة اسم المشروع أو موقع العمل');
      return;
    }

    if (editingProject) {
      // Update
      const updated: Project = {
        ...editingProject,
        name: formData.name.trim(),
        location: formData.location.trim(),
        client: formData.client.trim(),
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes.trim(),
        updatedAt: new Date().toISOString()
      };

      if (formData.initialBudgetAmount && !isNaN(Number(formData.initialBudgetAmount))) {
        const amt = Number(formData.initialBudgetAmount);
        if (updated.budget.length === 0) {
          updated.budget = [{
            id: 'bgt_' + Date.now(),
            date: formData.startDate || new Date().toISOString().split('T')[0],
            amount: amt,
            description: 'الميزانية المرصودة للمشروع',
            notes: 'تم تحديدها عند تعديل بيانات المشروع'
          }];
        }
      }

      onUpdateProject(updated);
      setEditingProject(null);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(`تم تحديث بيانات مشروع "${updated.name}" بنجاح!`);
      }
    } else {
      // Create New
      let baseWorkers: any[] = [];
      let baseEmployees: any[] = [];
      let baseSuppliers: any[] = [];

      if (formData.copyDataFromProjectId) {
        const sourceProj = projects.find(p => p.id === formData.copyDataFromProjectId);
        if (sourceProj) {
          baseWorkers = sourceProj.workers.map(w => ({ ...w, ledger: [] }));
          baseEmployees = sourceProj.employees.map(e => ({ ...e, ledger: [] }));
          baseSuppliers = sourceProj.suppliers.map(s => ({ ...s, ledger: [] }));
        }
      }

      const initialBudget = [];
      if (formData.initialBudgetAmount && !isNaN(Number(formData.initialBudgetAmount)) && Number(formData.initialBudgetAmount) > 0) {
        initialBudget.push({
          id: 'bgt_' + Date.now(),
          date: formData.startDate || new Date().toISOString().split('T')[0],
          amount: Number(formData.initialBudgetAmount),
          description: 'الميزانية المعتمدة لافتتاح المشروع',
          notes: 'ميزانية أولية مرصودة'
        });
      }

      onCreateProject({
        name: formData.name.trim(),
        location: formData.location.trim(),
        client: formData.client.trim(),
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        notes: formData.notes.trim(),
        budget: initialBudget,
        workers: baseWorkers,
        employees: baseEmployees,
        suppliers: baseSuppliers,
        expenses: []
      });

      setShowCreateModal(false);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(`تم إنشاء مشروع جديد ("${formData.name}") بنجاح!`);
      }
    }
  };

  // Handle Share Link Generation
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

  // Join Cloud Project
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
      setShowCloudShareModal(false);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast("جاري الاتصال والربط مع المشروع السحابي...");
      }
    }
  };

  // Handle Submit Migration
  const handleExecuteMigration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!migrationData.sourceProjectId || !migrationData.targetProjectId) {
      alert('الرجاء اختيار المشروع المصدر والمشروع الهدف');
      return;
    }
    if (migrationData.sourceProjectId === migrationData.targetProjectId) {
      alert('اختر مشروعين مختلفين للتحويل بينهما');
      return;
    }
    if (!migrationData.entityId) {
      alert('الرجاء تحديد الكادر المراد تحويله أو نقله');
      return;
    }

    if (onMigrateEntity) {
      onMigrateEntity(migrationData);
      setShowMigrationModal(false);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast("تم تحويل الكادر إلى المشروع الهدف بنجاح!");
      }
    }
  };

  // Multi-Project Calculations
  const filteredProjects = projects.filter(proj => {
    const matchesSearch = 
      proj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proj.location && proj.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (proj.client && proj.client.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort projects so that active ('active') projects created first appear first, followed by others
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    if (aActive !== bActive) {
      return bActive - aActive; // active projects first
    }
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return aTime - bTime; // created first comes first
  });

  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(p => p.status === 'active').length;
  
  const consolidatedBudget = projects.reduce((sum, proj) => {
    return sum + (proj.budget || []).reduce((bSum, b) => bSum + (b.amount || 0), 0);
  }, 0);

  const consolidatedExpenses = projects.reduce((sum, proj) => {
    return sum + (proj.expenses || []).reduce((eSum, e) => eSum + (e.amount || 0), 0);
  }, 0);

  const consolidatedRemaining = consolidatedBudget - consolidatedExpenses;
  const totalWorkersCount = projects.reduce((sum, proj) => sum + (proj.workers || []).length, 0);
  const totalEmployeesCount = projects.reduce((sum, proj) => sum + (proj.employees || []).length, 0);

  // Status Badge Styling Helper
  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return {
          label: 'نشط وجاري العمل',
          bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
          icon: <Clock size={12} className="shrink-0" />
        };
      case 'completed':
        return {
          label: 'مكتمل ومسلم',
          bg: 'bg-sky-500/10 text-sky-600 border-sky-200',
          icon: <CheckCircle2 size={12} className="shrink-0" />
        };
      case 'planning':
        return {
          label: 'قيد التخطيط',
          bg: 'bg-amber-500/10 text-amber-600 border-amber-200',
          icon: <Clock size={12} className="shrink-0" />
        };
      case 'paused':
        return {
          label: 'متوقف مؤقتاً',
          bg: 'bg-slate-500/10 text-slate-600 border-slate-200',
          icon: <PauseCircle size={12} className="shrink-0" />
        };
      default:
        return {
          label: 'نشط',
          bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
          icon: <Clock size={12} className="shrink-0" />
        };
    }
  };

  // Export Consolidated Multi-Project Excel
  const handleExportMultiProjectExcel = () => {
    const headers = [
      'اسم المشروع / موقع العمل',
      'حالة المشروع',
      'الموقع / المدينة',
      'العميل / المالك',
      'الميزانية المعتمدة',
      'إجمالي المصروفات',
      'الرصيد المتبقي',
      'نسبة الصرف %',
      'عدد العمال',
      'عدد الموظفين',
      'عدد الموردين',
      'تاريخ البدء'
    ];

    const rows = projects.map(p => {
      const bTotal = (p.budget || []).reduce((s, b) => s + b.amount, 0);
      const eTotal = (p.expenses || []).reduce((s, e) => s + e.amount, 0);
      const rem = bTotal - eTotal;
      const pct = bTotal > 0 ? ((eTotal / bTotal) * 100).toFixed(1) + '%' : '0%';
      const statusText = getStatusBadge(p.status).label;

      return [
        p.name,
        statusText,
        p.location || '-',
        p.client || '-',
        bTotal,
        eTotal,
        rem,
        pct,
        (p.workers || []).length,
        (p.employees || []).length,
        (p.suppliers || []).length,
        p.startDate || '-'
      ];
    });

    exportToXLSX('تقرير_المشاريع_المجمع_الشامل', headers, rows, 'المشاريع');
  };

  // Print Consolidated PDF
  const handlePrintMultiProjectPDF = () => {
    const tableRows = projects.map((p, idx) => {
      const bTotal = (p.budget || []).reduce((s, b) => s + b.amount, 0);
      const eTotal = (p.expenses || []).reduce((s, e) => s + e.amount, 0);
      const rem = bTotal - eTotal;
      const pct = bTotal > 0 ? ((eTotal / bTotal) * 100).toFixed(1) + '%' : '0%';

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${p.name}</strong><br><small style="color: #64748b;">${p.location || ''}</small></td>
          <td style="text-align: center;">${getStatusBadge(p.status).label}</td>
          <td style="text-align: center;">${p.client || '-'}</td>
          <td style="text-align: left; color: #0284c7; font-weight: bold;">${formatCurrency(bTotal, currency)}</td>
          <td style="text-align: left; color: #e11d48; font-weight: bold;">${formatCurrency(eTotal, currency)}</td>
          <td style="text-align: left; color: ${rem >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">${formatCurrency(rem, currency)}</td>
          <td style="text-align: center;">${pct}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">تقرير ملخص الميزانية والمصروفات المجمعة لكافة المشاريع</h2>
        <p style="font-size: 12px; color: #475569; margin: 0;">يحتوي هذا التقرير على تفاصيل الميزانيات، المصروفات الفعلية، والأرصدة المتبقية لجميع مواقف وأعمال الشركات والمواقع.</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; text-align: center;">
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #f8fafc;">
          <small style="color: #64748b; font-weight: bold;">إجمالي المشاريع</small>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${totalProjectsCount}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #f0f9ff;">
          <small style="color: #0369a1; font-weight: bold;">الميزانية المجمعة</small>
          <div style="font-size: 15px; font-weight: bold; color: #0284c7;">${formatCurrency(consolidatedBudget, currency)}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #fff1f2;">
          <small style="color: #be123c; font-weight: bold;">إجمالي المصروفات</small>
          <div style="font-size: 15px; font-weight: bold; color: #e11d48;">${formatCurrency(consolidatedExpenses, currency)}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: ${consolidatedRemaining >= 0 ? '#ecfdf5' : '#fef2f2'};">
          <small style="color: ${consolidatedRemaining >= 0 ? '#047857' : '#b91c1c'}; font-weight: bold;">الرصيد الصافي المتبقي</small>
          <div style="font-size: 15px; font-weight: bold; color: ${consolidatedRemaining >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(consolidatedRemaining, currency)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 25%;">اسم المشروع / الموقع</th>
            <th style="width: 15%;">الحالة</th>
            <th style="width: 15%;">المالك / العميل</th>
            <th style="width: 12%;">الميزانية</th>
            <th style="width: 12%;">المصروفات</th>
            <th style="width: 12%;">المتبقي</th>
            <th style="width: 8%;">نسبة الصرف</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printPDF('تقرير_المشاريع_المجمع_والاستراتيجي', htmlContent);
  };

  // Get active source project entities for migration dropdown
  const sourceProjectObj = projects.find(p => p.id === migrationData.sourceProjectId);

  return (
    <div className="space-y-6 dir-rtl text-right pb-12 animate-fade-in">
      
      {/* ======================= BRAND HEADER BANNER ======================= */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-sky-500/30">
        <div className="absolute -left-12 -bottom-12 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -right-12 -top-12 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Logo & Company Title Box */}
          <div className="flex items-center gap-4 sm:gap-6 text-center md:text-right w-full flex-col sm:flex-row">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 shadow-xl shadow-amber-950/40 shrink-0 flex items-center justify-center group hover:scale-105 transition-transform ring-4 ring-white/10">
              <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center shadow-inner">
                <img 
                  src={COMPANY_LOGO_BASE64} 
                  alt="شعار الشركة" 
                  className="w-full h-full object-cover rounded-full" 
                />
              </div>
            </div>

            <div className="space-y-2 flex-1">
              {/* Swapped Text Formatting: Company Name as Main Big Heading */}
              <h1 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
                {companyName}
              </h1>

              {/* Swapped Text Formatting: System Name as Styled Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                <Building2 size={14} className="animate-pulse text-amber-400" />
                <span>نظام الحسابات وإدارة المشاريع الإنشائية</span>
              </div>

              {/* Designer Details */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-sky-200 font-bold pt-1">
                <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <User size={13} className="text-sky-400" />
                  تصميم: {designerName}
                </span>
                <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <Phone size={13} className="text-emerald-400" />
                  رقم الهاتف: {designerPhone}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ======================= PROJECTS ACCESS DASHBOARD (PROJECTS CARDS GRID) ======================= */}

      {/* ======================= CONSOLIDATED FINANCIAL SUMMARY ======================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        
        {/* Total Projects Card */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">إجمالي المشاريع</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-black text-slate-900">{totalProjectsCount}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              {activeProjectsCount} نشط
            </span>
          </div>
        </div>

        {/* Consolidated Budget */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">الميزانية المجمعة</span>
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-sky-700 truncate">
            {formatCurrency(consolidatedBudget, currency)}
          </div>
        </div>

        {/* Consolidated Expenses */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">المصروفات المجمعة</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 truncate">
            {formatCurrency(consolidatedExpenses, currency)}
          </div>
        </div>

        {/* Consolidated Remaining Balance */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-all col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">الرصيد الصافي المتبقي</span>
            <div className={`p-1.5 rounded-lg ${consolidatedRemaining >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className={`text-base sm:text-lg font-black truncate ${consolidatedRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(consolidatedRemaining, currency)}
          </div>
        </div>

        {/* Total Workforce */}
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-all col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">إجمالي الكوادر والعمال</span>
            <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
              <Users size={16} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black text-slate-900">{totalWorkersCount + totalEmployeesCount}</span>
            <span className="text-[10px] font-bold text-slate-500">
              ({totalWorkersCount} عمال / {totalEmployeesCount} موظف)
            </span>
          </div>
        </div>

      </div>

      {/* ======================= MAIN PROJECTS MANAGEMENT DISPLAY PANEL ======================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-5">
        
        {/* Panel Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-2xl shadow-md shadow-sky-600/20">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                إدارة المشاريع
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                لوحة عرض والتحكم بكافة المشاريع الإنشائية والتنفيذية
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>إضافة مشروع جديد</span>
          </button>
        </div>

        {/* Search Input and Status Filters Bar */}
        <div className="bg-slate-50/80 rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-2.5">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم المشروع، الموقع، المالك..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-0.5 md:pb-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-200/70 text-slate-600 border border-slate-200/60'
              }`}
            >
              الكل ({projects.length})
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60'
              }`}
            >
              النشطة ({projects.filter(p => p.status === 'active').length})
            </button>

            <button
              onClick={() => setStatusFilter('planning')}
              className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'planning'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60'
              }`}
            >
              قيد التخطيط ({projects.filter(p => p.status === 'planning').length})
            </button>

            <button
              onClick={() => setStatusFilter('paused')}
              className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'paused'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60'
              }`}
            >
              المتوقفة ({projects.filter(p => p.status === 'paused').length})
            </button>

            <button
              onClick={() => setStatusFilter('completed')}
              className={`py-1.5 px-3 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60'
              }`}
            >
              المكتملة ({projects.filter(p => p.status === 'completed').length})
            </button>
          </div>

        </div>

        {/* PROJECTS CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          
          {sortedProjects.length === 0 ? null : (
            sortedProjects.map((proj, index) => {
              const isActive = proj.id === activeProjectId;
              const bTotal = (proj.budget || []).reduce((s, b) => s + b.amount, 0);
              const eTotal = (proj.expenses || []).reduce((s, e) => s + e.amount, 0);
              const remaining = bTotal - eTotal;
              const burnRate = bTotal > 0 ? Math.min(Math.round((eTotal / bTotal) * 100), 100) : 0;
              const statusInfo = getStatusBadge(proj.status);
              const expressiveIcon = getProjectExpressiveIcon(proj.name, index);

              return (
                <div 
                  key={proj.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative group ${
                    isActive 
                      ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md' 
                      : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Card Header Top */}
                  <div className="p-3.5 sm:p-4 space-y-3">
                    
                    {/* Top Header: Construction/Project Icon + Details Stack */}
                    <div className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100">
                      
                      {/* Project Icon */}
                      <div className="p-2 bg-slate-100/90 text-sky-600 rounded-xl border border-slate-200/80 shrink-0 group-hover:bg-sky-50 transition-colors mt-0.5">
                        {expressiveIcon}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* 1. Project Name + Active Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 
                            onClick={() => {
                              onSelectProject(proj.id);
                              if (setActiveTab) setActiveTab('dashboard');
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                            className="text-base font-extrabold text-slate-900 group-hover:text-sky-600 transition-colors leading-snug cursor-pointer truncate"
                          >
                            {proj.name}
                          </h3>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] shadow-2xs shrink-0">
                              <Star size={10} className="fill-white" />
                              <span>النشط</span>
                            </span>
                          )}
                        </div>

                        {/* 2. Project Status Badge directly under Project Name */}
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${statusInfo.bg}`}>
                            {statusInfo.icon}
                            <span>{statusInfo.label}</span>
                          </span>
                        </div>

                        {/* 3. Location and Owner in a single horizontal row */}
                        {(proj.location || proj.client) && (
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold flex-wrap">
                            {proj.location && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <MapPin size={11} className="text-sky-500 shrink-0" />
                                <span>{proj.location}</span>
                              </span>
                            )}
                            {proj.client && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <User size={11} className="text-indigo-500 shrink-0" />
                                <span>المالك: {proj.client}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Financial Mini Dashboard */}
                    <div className="bg-slate-50/90 rounded-xl p-2.5 space-y-2 border border-slate-100">
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400">الميزانية</span>
                          <span className="text-[11px] sm:text-xs font-extrabold text-sky-700 truncate block">
                            {formatCurrency(bTotal, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400">المصروفات</span>
                          <span className="text-[11px] sm:text-xs font-extrabold text-rose-600 truncate block">
                            {formatCurrency(eTotal, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400">المتبقي</span>
                          <span className={`text-[11px] sm:text-xs font-extrabold truncate block ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(remaining, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Budget Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                          <span>استهلاك الميزانية</span>
                          <span className={burnRate > 90 ? 'text-rose-600' : 'text-slate-700'}>{burnRate}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              burnRate > 90 ? 'bg-rose-500' : burnRate > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${burnRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Workforce Counts */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <Users size={12} className="text-slate-400" />
                          <span>{(proj.workers || []).length} عمال</span>
                        </span>
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <Briefcase size={12} className="text-slate-400" />
                          <span>{(proj.employees || []).length} موظف</span>
                        </span>
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <Truck size={12} className="text-slate-400" />
                          <span>{(proj.suppliers || []).length} موردين</span>
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Card Footer Actions */}
                  <div className="bg-slate-50/70 p-2.5 sm:p-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(proj)}
                        className="p-1.5 bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="تعديل بيانات المشروع"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => {
                          onDuplicateProject(proj.id);
                          if (typeof window !== 'undefined' && (window as any).showToast) {
                            (window as any).showToast(`تم نسخ مشروع "${proj.name}" بنجاح!`);
                          }
                        }}
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="نسخ / تكرار المشروع"
                      >
                        <Copy size={14} />
                      </button>

                      {projects.length > 1 && (
                        <button
                          onClick={() => setDeleteConfirmId(proj.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="حذف المشروع"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        onSelectProject(proj.id);
                        if (setActiveTab) setActiveTab('dashboard');
                        window.scrollTo({ top: 0, behavior: 'instant' });
                        if (typeof window !== 'undefined' && (window as any).showToast) {
                          (window as any).showToast(`تم الدخول لمشروع "${proj.name}" بنجاح!`);
                        }
                      }}
                      className={`py-1.5 px-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                          : 'bg-sky-600 hover:bg-sky-700 text-white shadow-2xs'
                      }`}
                    >
                      <span>الدخول للمشروع</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                </div>
              );
            })
          )}

          {/* Add Project Big Interactive Card Button */}
          <button
            onClick={handleOpenCreate}
            className="bg-dashed-border bg-slate-50/80 hover:bg-sky-50/50 rounded-2xl border-2 border-dashed border-sky-300 hover:border-sky-500 p-5 flex flex-col items-center justify-center text-center space-y-2 transition-all cursor-pointer group min-h-[220px]"
          >
            <div className="w-11 h-11 bg-sky-100 text-sky-600 group-hover:scale-105 rounded-xl flex items-center justify-center transition-transform shadow-2xs">
              <Plus size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 group-hover:text-sky-600 transition-colors">
                إضافة مشروع / موقع جديد +
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs leading-relaxed font-semibold">
                إنشاء موقع عمل منفصل مع تخصيص العمال، الموردين، والميزانية المعتمدة.
              </p>
            </div>
          </button>

        </div>

      </div>

      {/* ======================= SEPARATE ACTION BUTTONS FRAME ======================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Building2 size={15} />
          </div>
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-900">
              إجراءات وخيارات إدارة المشاريع
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold">
              نقل العمالة والموردين، وتصدير التقارير المجمعة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Action 1: Migrate Workers & Suppliers */}
          <button
            onClick={() => setShowMigrationModal(true)}
            className="p-2.5 bg-sky-50/70 hover:bg-sky-100/90 active:scale-[0.98] rounded-xl border border-sky-200/80 transition-all text-right flex items-center gap-2 cursor-pointer group shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <ArrowLeftRight size={14} strokeWidth={2.5} />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="block font-black text-xs text-sky-950 truncate">
                نقل كوادر بين المشاريع
              </span>
              <span className="block text-[10px] font-bold text-sky-900/80 leading-tight truncate">
                تحويل العمال والموردين
              </span>
            </div>
          </button>

          {/* Action 2: Export Excel */}
          <button
            onClick={handleExportMultiProjectExcel}
            className="p-2.5 bg-emerald-50/70 hover:bg-emerald-100/90 active:scale-[0.98] rounded-xl border border-emerald-200/80 transition-all text-right flex items-center gap-2 cursor-pointer group shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <FileSpreadsheet size={14} strokeWidth={2.5} />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="block font-black text-xs text-emerald-950 truncate">
                تصدير تقرير Excel
              </span>
              <span className="block text-[10px] font-bold text-emerald-900/80 leading-tight truncate">
                تقرير إكسل مجمع وشامل
              </span>
            </div>
          </button>

          {/* Action 3: Print PDF */}
          <button
            onClick={handlePrintMultiProjectPDF}
            className="p-2.5 bg-indigo-50/70 hover:bg-indigo-100/90 active:scale-[0.98] rounded-xl border border-indigo-200/80 transition-all text-right flex items-center gap-2 cursor-pointer group shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <Printer size={14} strokeWidth={2.5} />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="block font-black text-xs text-indigo-950 truncate">
                طباعة التقرير PDF
              </span>
              <span className="block text-[10px] font-bold text-indigo-900/80 leading-tight truncate">
                معاينة وطباعة تقرير مفصل
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ======================= SHARING & LOCAL MODE UNIFIED FRAME ======================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                المشاركة السحابية للبيانات والعمل المحلي
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                خيارات المزامنة والربط المباشر لبيانات كافة المشاريع أو العمل المستقل أوفلاين
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold border bg-sky-50 text-sky-700 border-sky-200 hidden sm:inline-flex items-center gap-1.5">
            <Cloud size={13} />
            <span>{projectId ? 'مربوط سحابياً' : 'وضع محلي فردي'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Button 1: Cloud Sharing & Collaboration */}
          <button
            onClick={() => setShowCloudShareModal(true)}
            className="group p-5 bg-gradient-to-r from-sky-900/90 to-indigo-950 text-white rounded-2xl border border-sky-500/40 shadow-xs hover:shadow-lg hover:border-sky-400 transition-all text-right flex items-center justify-between cursor-pointer relative overflow-hidden"
          >
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-sky-500/20 text-sky-300 rounded-xl border border-sky-400/30">
                  <Share2 size={18} className="animate-pulse" />
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-sky-200 transition-colors">
                  المشاركة السحابية والتعاون (كافة المشاريع)
                </h3>
              </div>
              <p className="text-xs text-sky-200/80 font-medium leading-relaxed">
                تتيح مشاركة كافة بيانات التطبيق (كافة المشاريع) بحسب نوع الصلاحيات المحددة.
              </p>
            </div>
            <div className="p-3 bg-white/10 group-hover:bg-sky-500 text-white rounded-2xl transition-all shrink-0 mr-2 z-10">
              <Globe size={20} />
            </div>
          </button>

          {/* Button 2: Local / Offline Private Mode */}
          <button
            onClick={() => setShowLocalModeModal(true)}
            className="group p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl border border-slate-700/80 shadow-xs hover:shadow-lg hover:border-slate-500 transition-all text-right flex items-center justify-between cursor-pointer relative overflow-hidden"
          >
            <div className="space-y-1.5 z-10">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Lock size={18} />
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors">
                  وضع محلي فردي (غير مشارك)
                </h3>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                حفظ مستقل وأداء فائق السرعة أوفلاين مع حماية كاملة لكافة بياناتك ومشاريعك على جهازك.
              </p>
            </div>
            <div className="p-3 bg-white/10 group-hover:bg-emerald-600 text-white rounded-2xl transition-all shrink-0 mr-2 z-10">
              <Lock size={20} />
            </div>
          </button>
        </div>
      </div>

      {/* ======================= FULL APPLICATION BACKUP & RESTORE STANDALONE FRAME ======================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Database size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                إدارة النسخ الاحتياطي الشامل واستعادة كافة بيانات التطبيق
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                تصدير واستعادة جميع المشاريع، السجلات، النوافذ المالية، والبيانات كاملة بملف واحد
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200 hidden sm:inline-flex items-center gap-1.5">
            <HardDrive size={13} />
            <span>{projects.length} مشروع مسجل</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Export Full App JSON Backup */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl p-4 border border-amber-200/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                  تصدير ملف .JSON
                </span>
                <FileJson size={20} className="text-amber-600" />
              </div>
              <h4 className="font-black text-sm text-slate-900">
                تصدير نسخة احتياطية شاملة لكافة المشاريع
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                إنشاء وتنزيل ملف JSON يحتوي على كافة بيانات أسطول المشاريع ({projects.length} مشروع) بكل تفاصيل مصروفاتها وقوائم عمالها ومورديها والتزاماتها.
              </p>
            </div>

            <button
              onClick={handleExportFullAppBackupJSON}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={15} />
              <span>تصدير نسخة كاملة لجميع المشاريع (.json)</span>
            </button>
          </div>

          {/* Option 2: Restore Full App JSON Backup */}
          <div className="bg-gradient-to-br from-sky-50/60 to-indigo-50/40 rounded-2xl p-4 border border-sky-200/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-sky-900 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                  استعادة ملف .JSON
                </span>
                <Upload size={20} className="text-sky-600" />
              </div>
              <h4 className="font-black text-sm text-slate-900">
                استعادة كافة مشاريع وبيانات التطبيق
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                رفع وتحديث بيانات جميع المشاريع دفعة واحدة من ملف نسخة احتياطية (.json) مع خيار الاستبدال الكلي أو الدمج مع القائمة الحالية.
              </p>
            </div>

            <div>
              <input
                type="file"
                ref={fullBackupFileInputRef}
                onChange={handleFullAppJSONSelected}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fullBackupFileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload size={15} />
                <span>استعادة نسخة احتياطية كاملة (.json)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================= MODAL 1: CLOUD SHARING & COLLABORATION ======================= */}
      {showCloudShareModal && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-sky-100 animate-scale-up my-8 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                  <Share2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    المشاركة السحابية والتعاون
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    إدارة الربط، الأجهزة، وتوليد روابط المشاركة بحسب الصلاحيات
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCloudShareModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
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
              <div className="space-y-4">
                
                {/* Sync Status Badge */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block">حالة المزامن السحابية:</span>
                    <span className="text-sm font-extrabold text-slate-800">
                      {projectId ? 'متصل بالسحابة (مشاركة نشطة)' : 'وضع محلي (غير مشارك سحابياً)'}
                    </span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${projectId ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    {projectId ? 'نشط 🟢' : 'محلي 🟡'}
                  </div>
                </div>

                {/* Generate Share Links Section */}
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    إنشاء وتوليد رابط دعوة ومشاركة بحسب الصلاحية:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopyLink('read')}
                      disabled={generatingRole === 'read'}
                      className="p-3 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded-2xl text-center transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-800">قراءة فقط 👁️</div>
                      <div className="text-[10px] text-slate-500">مشاهدة بدون تعديل</div>
                      {copiedRole === 'read' && <span className="text-[10px] text-emerald-600 font-bold block">تم النسخ!</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink('add')}
                      disabled={generatingRole === 'add'}
                      className="p-3 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded-2xl text-center transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-800">إضافة حركات ➕</div>
                      <div className="text-[10px] text-slate-500">إضافة حركات وصرف</div>
                      {copiedRole === 'add' && <span className="text-[10px] text-emerald-600 font-bold block">تم النسخ!</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink('full')}
                      disabled={generatingRole === 'full'}
                      className="p-3 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 border border-slate-200 rounded-2xl text-center transition-all cursor-pointer space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-800">تعديل وصلاحية كاملة ✏️</div>
                      <div className="text-[10px] text-slate-500">إدارة ومسح كامل</div>
                      {copiedRole === 'full' && <span className="text-[10px] text-emerald-600 font-bold block">تم النسخ!</span>}
                    </button>
                  </div>
                </div>

                {/* Join Existing Cloud Project */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    الانضمام إلى مشروع سحابي باستخدام الرمز:
                  </label>
                  <form onSubmit={handleJoinProjectSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="أدخل رمز المشروع السحابي هنا..."
                      value={shareInputId}
                      onChange={(e) => setShareInputId(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                    <button
                      type="submit"
                      className="py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                    >
                      انضمام
                    </button>
                  </form>
                  {shareInputError && <p className="text-xs text-rose-500 font-bold">{shareInputError}</p>}
                </div>

                {/* Disconnect Cloud Button if active */}
                {projectId && onCancelCloudSync && (
                  <div className="pt-3 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        onCancelCloudSync();
                        setShowCloudShareModal(false);
                        if (typeof window !== 'undefined' && (window as any).showToast) {
                          (window as any).showToast("تم إلغاء الربط السحابي والعودة للوضع المحلي.");
                        }
                      }}
                      className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      إلغاء الربط السحابي والتحول إلى وضع محلي فردي
                    </button>
                  </div>
                )}

              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCloudShareModal(false)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================= MODAL 2: LOCAL PRIVATE MODE EXPLANATION ======================= */}
      {showLocalModeModal && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-emerald-100 animate-scale-up overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Lock size={26} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                الوضع المحلي الفردي (غير مشارك)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                أنت تعمل حالياً في الوضع المحلي الخاص. يتم حفظ جميع بيانات المشاريع، العمال، المصروفات، والموردين بأمان مطلق على ذاكرة متصفح جهازك.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex items-center gap-2 font-bold text-emerald-700">
                <Check size={16} />
                <span>عمل سريع ودون الحاجة لاتصال بإنترنت.</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-emerald-700">
                <Check size={16} />
                <span>بياناتك خاصة كلياً ولا تظهر لأي طرف خارجي.</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-emerald-700">
                <Check size={16} />
                <span>يمكنك أخذ نسخة احتياطية (Backup) في أي وقت واستعادتها بسهولة.</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLocalModeModal(false)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                مفهوم، الاستمرار بالوضع المحلي
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================= MODAL 3: CROSS-PROJECT ENTITY MIGRATION TOOL ======================= */}
      {showMigrationModal && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-scale-up my-8 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
                  <ArrowLeftRight size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    أداة تحويل ونقل الكوادر بين المشاريع
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    نقل أو نسخ العمال، الموظفين، أو الموردين من مشروع إلى مشروع آخر
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMigrationModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteMigration} className="space-y-4">
              
              {/* Source Project */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  من المشروع المصدر (الذي يحتوي الكادر) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={migrationData.sourceProjectId}
                  onChange={(e) => setMigrationData({ ...migrationData, sourceProjectId: e.target.value, entityId: '' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع الكادر المراد تحويله
                </label>
                <select
                  value={migrationData.entityType}
                  onChange={(e) => setMigrationData({ ...migrationData, entityType: e.target.value as any, entityId: '' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="worker">عمالة يدوية / مهنية (Workers)</option>
                  <option value="employee">موظف بأجر يومي / شهري (Employees)</option>
                  <option value="supplier">مورد مواد أو آليات (Suppliers)</option>
                </select>
              </div>

              {/* Specific Entity Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اختر الاسم / الكادر من المشروع المصدر <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={migrationData.entityId}
                  onChange={(e) => setMigrationData({ ...migrationData, entityId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">-- اختر الاسم هنا --</option>
                  {sourceProjectObj && migrationData.entityType === 'worker' && sourceProjectObj.workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.profession})</option>
                  ))}
                  {sourceProjectObj && migrationData.entityType === 'employee' && sourceProjectObj.employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.profession})</option>
                  ))}
                  {sourceProjectObj && migrationData.entityType === 'supplier' && sourceProjectObj.suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.materialType})</option>
                  ))}
                </select>
              </div>

              {/* Target Project */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  إلى المشروع الهدف (الجديد) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={migrationData.targetProjectId}
                  onChange={(e) => setMigrationData({ ...migrationData, targetProjectId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {projects.filter(p => p.id !== migrationData.sourceProjectId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Include Past Ledger Checkbox */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={migrationData.includeLedger}
                    onChange={(e) => setMigrationData({ ...migrationData, includeLedger: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>نسخ ونقل كشف الحساب والسجل المالي السلس كلياً</span>
                </label>
                <p className="text-[11px] text-slate-500 pr-6">
                  عند عدم التحديد، يتم إنشاء الكادر في المشروع الهدف بملف شخصي جديد ورصيد صفري (بداية جديدة للمشروع).
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMigrationModal(false)}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="py-2.5 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeftRight size={15} />
                  <span>تأكيد تحويل الكادر الآن</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ======================= CREATE / EDIT PROJECT MODAL ======================= */}
      {(showCreateModal || editingProject) && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 dir-rtl text-right overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 animate-scale-up max-h-[88vh] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {editingProject ? 'تعديل بيانات المشروع' : 'إضافة مشروع جديد'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">
                    {editingProject ? 'قم بتحديث بيانات وموقع الميزانية' : 'أدخل بيانات موقع وتفاصيل العمل الجديد'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProject(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 overflow-hidden">
              
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
                {/* Import Backup Option Banner (Only on Create New Project) */}
                {!editingProject && (
                  <div className="bg-gradient-to-r from-sky-50 via-indigo-50/70 to-slate-50 p-3.5 rounded-2xl border border-sky-200/80 shadow-2xs space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-sky-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-2xs">
                          <Upload size={18} />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs sm:text-sm text-sky-950">
                            استيراد مشروع من نسخة احتياطية
                          </h4>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold leading-tight">
                            هل لديك ملف نسخة احتياطية (.json) لمشروع مسبق؟
                          </p>
                        </div>
                      </div>

                      <div>
                        <input
                          type="file"
                          ref={projectBackupFileInputRef}
                          onChange={handleImportSingleProjectBackupJSON}
                          accept=".json"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => projectBackupFileInputRef.current?.click()}
                          className="w-full sm:w-auto py-2 px-3.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <FileJson size={15} />
                          <span>استيراد ملف .JSON</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المشروع / موقع العمل <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مشروع عمارة النخبة - الستين"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                {/* Location & Client */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الموقع / المدينة
                    </label>
                    <input
                      type="text"
                      placeholder="صنعاء - الستين"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      المالك / العميل
                    </label>
                    <input
                      type="text"
                      placeholder="وزارة الأشغال العامة"
                      value={formData.client}
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Budget & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الميزانية المرصودة الأولية ({currency})
                    </label>
                    <input
                      type="number"
                      placeholder="10000000"
                      value={formData.initialBudgetAmount}
                      onChange={(e) => setFormData({ ...formData, initialBudgetAmount: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      حالة المشروع
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
                    >
                      <option value="active">نشط وجاري العمل</option>
                      <option value="planning">قيد التخطيط</option>
                      <option value="paused">متوقف مؤقتاً</option>
                      <option value="completed">مكتمل ومسلم</option>
                    </select>
                  </div>
                </div>

                {/* Start and End Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ البدء
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تاريخ التسليم / الانتهاء المتوقع
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Copy data from template (Only on Create) */}
                {!editingProject && projects.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نسخ قائمة الكوادر والموردين الأساسية من مشروع آخر (اختياري)
                    </label>
                    <select
                      value={formData.copyDataFromProjectId}
                      onChange={(e) => setFormData({ ...formData, copyDataFromProjectId: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
                    >
                      <option value="">-- البدء بمشروع فارغ تماماً --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          نسخ عمال وموردين: {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات تفصيلية حول عقد المشروع أو بنود الاتفاق..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingProject(null);
                  }}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="py-2.5 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md cursor-pointer"
                >
                  {editingProject ? 'حفظ التعديلات' : 'إنشاء المشروع الآن'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ======================= DELETE CONFIRMATION MODAL ======================= */}
      {deleteConfirmId && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-rose-100 text-center animate-scale-up overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                تأكيد حذف المشروع
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-semibold">
                هل أنت تأكد من رغبتك في حذف هذا المشروع بالكامل؟ سيتم حذف كافة المصروفات، السجلات، والبيانات التابعة له محلياً.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                تراجع وإلغاء
              </button>

              <button
                onClick={() => {
                  onDeleteProject(deleteConfirmId);
                  setDeleteConfirmId(null);
                  if (typeof window !== 'undefined' && (window as any).showToast) {
                    (window as any).showToast('تم حذف المشروع بنجاح.');
                  }
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= FULL APPLICATION RESTORE MODAL ======================= */}
      {showFullAppRestoreModal && fullAppRestoreModalData && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-sky-100 animate-scale-up my-8 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-sky-100 text-sky-700 rounded-2xl">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    تأكيد استعادة كافة مشاريع وبيانات التطبيق
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    معاينة محتويات ملف النسخة الاحتياطية وتحديد وضع الاستعادة
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowFullAppRestoreModal(false);
                  setFullAppRestoreModalData(null);
                }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* File Info Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold text-slate-700">تاريخ تصدير الملف:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{fullAppRestoreModalData.fileDate}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-bold">المشاريع</p>
                  <p className="text-base font-black text-sky-700">{fullAppRestoreModalData.projectsCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-bold">إجمالي المصروفات</p>
                  <p className="text-base font-black text-emerald-700">{fullAppRestoreModalData.totalExpensesCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-bold">إجمالي العمال</p>
                  <p className="text-base font-black text-amber-700">{fullAppRestoreModalData.totalWorkersCount}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-500 font-bold">الموردين والموظفين</p>
                  <p className="text-base font-black text-indigo-700">
                    {fullAppRestoreModalData.totalSuppliersCount + fullAppRestoreModalData.totalEmployeesCount}
                  </p>
                </div>
              </div>

              {fullAppRestoreModalData.projects && fullAppRestoreModalData.projects.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-bold text-slate-700">قائمة المشاريع المشمولة بالملف:</p>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 dir-rtl">
                    {fullAppRestoreModalData.projects.map((p: Project, idx: number) => (
                      <div key={p.id || idx} className="text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60 flex items-center justify-between">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{p.expenses?.length || 0} عملية مالية</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Restore Mode Selection */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-900 block">
                اختر طريقة استعادة واستبدال البيانات:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFullAppRestoreMode('overwrite')}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                    fullAppRestoreMode === 'overwrite'
                      ? 'bg-amber-50/80 border-amber-500 text-amber-950 ring-2 ring-amber-400/40'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-amber-900">استبدال شامل (مسح وحفظ)</span>
                      {fullAppRestoreMode === 'overwrite' && <Check size={16} className="text-amber-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      استبدال كافة المشاريع والبيانات الحالية وإعادة تعيين التطبيق بالكامل وفق محتويات الملف.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFullAppRestoreMode('merge')}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                    fullAppRestoreMode === 'merge'
                      ? 'bg-sky-50/80 border-sky-500 text-sky-950 ring-2 ring-sky-400/40'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-sky-900">دمج وإضافة المشاريع</span>
                      {fullAppRestoreMode === 'merge' && <Check size={16} className="text-sky-600" />}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      إضافة المشاريع الجديدة المستوردة إلى قائمة المشاريع الحالية دون مسح المشاريع القائمة.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p>
                تنبيه: {fullAppRestoreMode === 'overwrite' ? 'عملية الاستبدال الشامل ستقوم بتعديل وإعادة ضبط كافة مشاريع وقوائم التطبيق الحالية.' : 'سيتم دمج كافة المشاريع الموجودة بالملف مع قائمتك الحالية.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowFullAppRestoreModal(false);
                  setFullAppRestoreModalData(null);
                }}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleConfirmFullAppRestore}
                className="py-2.5 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <Save size={15} />
                <span>تأكيد واستعادة البيانات الآن</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
