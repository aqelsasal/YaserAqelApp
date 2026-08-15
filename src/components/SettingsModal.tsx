import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Building2, 
  DollarSign, 
  Sliders, 
  Palette, 
  Database, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  User, 
  Phone, 
  MapPin, 
  Calculator, 
  Calendar,
  Eye,
  ShieldAlert,
  ArrowRight,
  FileText,
  Sun,
  Moon,
  Globe,
  PenTool,
  CheckSquare
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  onCurrencyChange: (newCurrency: string) => void;
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  companyAddress: string;
  onCompanyAddressChange: (address: string) => void;
  companyPhone: string;
  onCompanyPhoneChange: (phone: string) => void;
  userName: string;
  onUserNameChange: (name: string) => void;
  onOpenBackupModal?: () => void;
  onResetAllData?: () => void;
  sharedRole?: string;
  onRestoreOwnerRole?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currency,
  onCurrencyChange,
  companyName,
  onCompanyNameChange,
  companyAddress,
  onCompanyAddressChange,
  companyPhone,
  onCompanyPhoneChange,
  userName,
  onUserNameChange,
  onOpenBackupModal,
  onResetAllData,
  sharedRole = 'owner',
  onRestoreOwnerRole
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'financial' | 'reports' | 'display' | 'data'>('general');

  // Local state for settings form
  const [tempCompanyName, setTempCompanyName] = useState(companyName);
  const [tempCompanyAddress, setTempCompanyAddress] = useState(companyAddress);
  const [tempCompanyPhone, setTempCompanyPhone] = useState(companyPhone);
  const [tempUserName, setTempUserName] = useState(userName);
  const [tempCurrency, setTempCurrency] = useState(currency);

  // Additional customizable preference settings
  const [dateFormat, setDateFormat] = useState<string>(() => localStorage.getItem('site_date_format') || 'YYYY-MM-DD');
  const [decimals, setDecimals] = useState<string>(() => localStorage.getItem('site_currency_decimals') || '0');
  const [defaultWorkerWage, setDefaultWorkerWage] = useState<string>(() => localStorage.getItem('site_default_worker_wage') || '10000');
  const [defaultEmployeeSalary, setDefaultEmployeeSalary] = useState<string>(() => localStorage.getItem('site_default_employee_salary') || '150000');
  const [defaultTaxRate, setDefaultTaxRate] = useState<string>(() => localStorage.getItem('site_default_tax_rate') || '0');
  const [compactMode, setCompactMode] = useState<boolean>(() => localStorage.getItem('site_compact_mode') === 'true');

  // Reports & Header/Footer preferences
  const [showReportHeader, setShowReportHeader] = useState<boolean>(() => localStorage.getItem('site_show_report_header') !== 'false');
  const [reportFooterNotes, setReportFooterNotes] = useState<string>(() => localStorage.getItem('site_report_footer_notes') || '');
  const [showSignatureBlocks, setShowSignatureBlocks] = useState<boolean>(() => localStorage.getItem('site_show_signature_blocks') !== 'false');
  const [showDesignerAttribution, setShowDesignerAttribution] = useState<boolean>(() => localStorage.getItem('site_show_designer_attribution') !== 'false');

  // Appearance & Theme preferences
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('site_theme') as 'light' | 'dark') || 'light');
  const [language, setLanguage] = useState<'ar' | 'en'>(() => (localStorage.getItem('site_language') as 'ar' | 'en') || 'ar');

  // Confirm Reset modal state
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Toast feedback state
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Lock background scroll when settings modal is open
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setTempCompanyName(companyName);
      setTempCompanyAddress(companyAddress);
      setTempCompanyPhone(companyPhone);
      setTempUserName(userName);
      setTempCurrency(currency);
      setDateFormat(localStorage.getItem('site_date_format') || 'YYYY-MM-DD');
      setDecimals(localStorage.getItem('site_currency_decimals') || '0');
      setDefaultWorkerWage(localStorage.getItem('site_default_worker_wage') || '10000');
      setDefaultEmployeeSalary(localStorage.getItem('site_default_employee_salary') || '150000');
      setDefaultTaxRate(localStorage.getItem('site_default_tax_rate') || '0');
      setCompactMode(localStorage.getItem('site_compact_mode') === 'true');
      setShowReportHeader(localStorage.getItem('site_show_report_header') !== 'false');
      setReportFooterNotes(localStorage.getItem('site_report_footer_notes') || '');
      setShowSignatureBlocks(localStorage.getItem('site_show_signature_blocks') !== 'false');
      setShowDesignerAttribution(localStorage.getItem('site_show_designer_attribution') !== 'false');
      setTheme((localStorage.getItem('site_theme') as 'light' | 'dark') || 'light');
      setLanguage((localStorage.getItem('site_language') as 'ar' | 'en') || 'ar');
    }
  }, [isOpen, companyName, companyAddress, companyPhone, userName, currency]);

  if (!isOpen) return null;

  const handleSaveAllSettings = () => {
    // 1. Update Parent State & localStorage
    onCompanyNameChange(tempCompanyName);
    localStorage.setItem('site_company_name', tempCompanyName);

    onCompanyAddressChange(tempCompanyAddress);
    localStorage.setItem('site_company_address', tempCompanyAddress);

    onCompanyPhoneChange(tempCompanyPhone);
    localStorage.setItem('site_company_phone', tempCompanyPhone);

    onUserNameChange(tempUserName);
    localStorage.setItem('site_user_name', tempUserName);

    onCurrencyChange(tempCurrency);
    localStorage.setItem('site_currency', tempCurrency);

    // 2. Additional preferences
    localStorage.setItem('site_date_format', dateFormat);
    localStorage.setItem('site_currency_decimals', decimals);
    localStorage.setItem('site_default_worker_wage', defaultWorkerWage);
    localStorage.setItem('site_default_employee_salary', defaultEmployeeSalary);
    localStorage.setItem('site_default_tax_rate', defaultTaxRate);
    localStorage.setItem('site_compact_mode', compactMode ? 'true' : 'false');

    // 3. Reports & Header/Footer preferences
    localStorage.setItem('site_show_report_header', showReportHeader ? 'true' : 'false');
    localStorage.setItem('site_report_footer_notes', reportFooterNotes);
    localStorage.setItem('site_show_signature_blocks', showSignatureBlocks ? 'true' : 'false');
    localStorage.setItem('site_show_designer_attribution', showDesignerAttribution ? 'true' : 'false');

    // 4. Appearance & Language
    localStorage.setItem('site_theme', theme);
    localStorage.setItem('site_language', language);

    // Apply Theme directly
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply Language & Direction directly
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
      if ((window as any).showToast) {
        (window as any).showToast('⚙️ تم حفظ إعدادات وتفضيلات التطبيق والتقارير بنجاح!');
      }
    }, 600);
  };

  const handleExecuteDataReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'مسح' && resetConfirmText.trim().toUpperCase() !== 'RESET') {
      alert('يرجى كتابة كلمة "مسح" أو "RESET" لتأكيد المسح النهائي');
      return;
    }
    if (onResetAllData) {
      onResetAllData();
      setShowConfirmReset(false);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in dir-rtl text-right overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Modal Bar */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
              <Settings size={20} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white">إعدادات وضبط التطبيق العامة</h2>
              <p className="text-[11px] text-slate-400 font-medium">تخصيص البيانات المباشرة، افتراضيات النظام، وخيارات العرض</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs Bar inside Modal */}
        <div className="bg-slate-100/90 p-1.5 sm:p-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveSection('general')}
            className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSection === 'general'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Building2 size={15} className={activeSection === 'general' ? 'text-sky-600' : 'text-slate-400'} />
            <span>البيانات والشركة</span>
          </button>

          <button
            onClick={() => setActiveSection('financial')}
            className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSection === 'financial'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <DollarSign size={15} className={activeSection === 'financial' ? 'text-emerald-600' : 'text-slate-400'} />
            <span>الافتراضيات المالية</span>
          </button>

          <button
            onClick={() => setActiveSection('reports')}
            className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSection === 'reports'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <FileText size={15} className={activeSection === 'reports' ? 'text-amber-600' : 'text-slate-400'} />
            <span>الترويسة والتقارير</span>
          </button>

          <button
            onClick={() => setActiveSection('display')}
            className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSection === 'display'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Palette size={15} className={activeSection === 'display' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>المظهر واللغة</span>
          </button>

          <button
            onClick={() => setActiveSection('data')}
            className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSection === 'data'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Database size={15} className={activeSection === 'data' ? 'text-rose-600' : 'text-slate-400'} />
            <span>إدارة البيانات والنسخ</span>
          </button>
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* 🏢 SECTION 1: GENERAL & COMPANY INFO */}
          {activeSection === 'general' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-200/60 flex items-center gap-2.5 text-xs text-sky-900">
                <Building2 size={16} className="text-sky-600 shrink-0" />
                <p className="font-semibold">تُطبَّق هذه البيانات تلقائياً على كافة السندات، التقارير المطبوعة، والعقود الرسمية المنشأة في التطبيق.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 size={14} className="text-sky-600" />
                    <span>اسم المؤسسة / المكتب / الشركة</span>
                  </label>
                  <input
                    type="text"
                    value={tempCompanyName}
                    onChange={(e) => setTempCompanyName(e.target.value)}
                    placeholder="مثال: شركة ورلد أوف إيليتس للمقاولات"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* User Financial Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User size={14} className="text-amber-600" />
                    <span>اسم المستخدم المالي المسؤول</span>
                  </label>
                  <input
                    type="text"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    placeholder="مثال: المهندس/ أحمد علي"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* Company Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin size={14} className="text-rose-600" />
                    <span>العنوان والفرع الرئيسي</span>
                  </label>
                  <input
                    type="text"
                    value={tempCompanyAddress}
                    onChange={(e) => setTempCompanyAddress(e.target.value)}
                    placeholder="مثال: صنعاء - شارع الستين"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* Company Phone */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-600" />
                    <span>هاتف التواصل والواتساب</span>
                  </label>
                  <input
                    type="text"
                    value={tempCompanyPhone}
                    onChange={(e) => setTempCompanyPhone(e.target.value)}
                    placeholder="مثال: +967 770 000 000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-left dir-ltr"
                  />
                </div>
              </div>

              {/* Account Role Status & Quick Restore to Owner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">نوع الحساب والصلاحية:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                      sharedRole === 'owner' || !sharedRole 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}>
                      {sharedRole === 'owner' || !sharedRole ? 'المالك الرئيسي للنظام 👑' : `مستخدم مشارك (${sharedRole}) 👤`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {sharedRole === 'owner' || !sharedRole 
                      ? 'أنت مسجل كمالك رئيسي للنظام وتملك كامل الصلاحيات لإدارة المشاريع ومشاركتها سحابياً.' 
                      : 'أنت مسجل حالياً كضيف/مشارك في هذا المشروع.'}
                  </p>
                </div>

                {sharedRole && sharedRole !== 'owner' && onRestoreOwnerRole && (
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreOwnerRole();
                      onClose();
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
                  >
                    <span>👑</span>
                    <span>استعادة صلاحية المالك (المهندس/ياسر عقيل)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 💵 SECTION 2: FINANCIAL DEFAULTS */}
          {activeSection === 'financial' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60 flex items-center gap-2.5 text-xs text-emerald-900">
                <DollarSign size={16} className="text-emerald-600 shrink-0" />
                <p className="font-semibold">تحديد افتراضيات المبالغ المعتمدة والعملات لسرعة إدخال بيانات العمال والمصروفات المستقبليّة.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* Default Currency Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-600" />
                    <span>العملة المعتمدة الافتراضية</span>
                  </label>
                  <select
                    value={tempCurrency}
                    onChange={(e) => setTempCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="YER">YER - ريال يمني ($)</option>
                    <option value="SAR">SAR - ريال سعودي (ر.س)</option>
                    <option value="USD">USD - دولار أمريكي ($)</option>
                    <option value="AED">AED - درهم إماراتي (د.إ)</option>
                    <option value="EGP">EGP - جنيه مصري (ج.م)</option>
                    <option value="IQD">IQD - دينار عراقي (د.ع)</option>
                    <option value="KWD">KWD - دينار كويتي (د.ك)</option>
                    <option value="OMR">OMR - ريال عماني (ر.ع)</option>
                  </select>
                </div>

                {/* Default Worker Wage */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calculator size={14} className="text-sky-600" />
                    <span>الأجر اليومي الافتراضي للعمال الجدد</span>
                  </label>
                  <input
                    type="number"
                    value={defaultWorkerWage}
                    onChange={(e) => setDefaultWorkerWage(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* Default Employee Salary */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calculator size={14} className="text-indigo-600" />
                    <span>راتب الموظف اليومي/الشهر الافتراضي</span>
                  </label>
                  <input
                    type="number"
                    value={defaultEmployeeSalary}
                    onChange={(e) => setDefaultEmployeeSalary(e.target.value)}
                    placeholder="150000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Currency Decimals */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sliders size={14} className="text-amber-600" />
                    <span>تنسيق الخانات العشرية للمبالغ</span>
                  </label>
                  <select
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
                  >
                    <option value="0">بدون خانات عشرية (أرقام صحيحة - 1,000)</option>
                    <option value="2">خانة عشرية واحدة/اثنتين (1,000.00)</option>
                  </select>
                </div>

              </div>
            </div>
          )}

          {/* 📄 SECTION 3: REPORTS & HEADER/FOOTER PREFERENCES */}
          {activeSection === 'reports' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 flex items-center gap-2.5 text-xs text-amber-950">
                <FileText size={18} className="text-amber-600 shrink-0" />
                <p className="font-semibold">تخصيص ترويسة وتذييل التقارير الرسمية، التوقيعات، وملاحظات سندات الصرف بالشكل المطلوب.</p>
              </div>

              <div className="space-y-3.5">
                
                {/* 1. Report Header Toggle */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                      <FileText size={15} className="text-sky-600" />
                      <span>إظهار الترويسة الرسمية وشعار الشركة في التقارير (Header)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      عرض اسم المؤسسة وشعارها وبيانات الماليّة في أعلى التقارير المطبوعة وسندات الصرف. عند الإيقاف تُطبّع البيانات بدون ترويسة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReportHeader(!showReportHeader)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      showReportHeader ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showReportHeader ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Signature Blocks Toggle */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                      <PenTool size={15} className="text-emerald-600" />
                      <span>إظهار خانات التوقيع الرسمية في أسفل التقارير (Signature Blocks)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      إضافة خانات ثابتة لتوقيع (المستلم، المحاسب، ومدير المشروع) لتوثيق وتصديق كافة الكشوفات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSignatureBlocks(!showSignatureBlocks)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      showSignatureBlocks ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showSignatureBlocks ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Designer/Engineer Signature Toggle */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                      <CheckSquare size={15} className="text-indigo-600" />
                      <span>إظهار توقيع المهندس/المصمم وبيانات النظام (Designer Attribution)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      عرض أو إخفاء توقيع مسؤول تصميم وإعداد النظام وبيانات الاعتماد في تذييل التقرير والشاشات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDesignerAttribution(!showDesignerAttribution)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      showDesignerAttribution ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showDesignerAttribution ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 4. Footer Custom Notes / Terms & Conditions Textarea */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <label className="block font-black text-xs text-slate-900 flex items-center gap-1.5">
                    <FileText size={15} className="text-amber-600" />
                    <span>تذييل التقارير والنصوص الثابتة (Report Footer Notes & Terms)</span>
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium">
                    أدخل أي ملاحظات ختامية أو شروط وأحكام أو تعليمات صرف ترغب بظهورها تلقائياً في تذييل كل تقرير وسند.
                  </p>
                  <textarea
                    value={reportFooterNotes}
                    onChange={(e) => setReportFooterNotes(e.target.value)}
                    placeholder="مثال: يرجى الاحتفاظ بهذا السند، المستند معتمد رسمياً من الإدارة المالية، الشروط والأحكام..."
                    rows={3}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
                  />
                </div>

              </div>
            </div>
          )}

          {/* 🎨 SECTION 4: DISPLAY, THEME & LANGUAGE */}
          {activeSection === 'display' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/60 flex items-center gap-2.5 text-xs text-indigo-900">
                <Palette size={16} className="text-indigo-600 shrink-0" />
                <p className="font-semibold">تعديل مظهر التطبيق (الوضع الفاتح / الوضع الداكن)، لغة الواجهة، وتنسيق العرض.</p>
              </div>

              <div className="space-y-3.5">
                
                {/* 1. Theme Selection (Light / Dark) */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div>
                    <span className="block font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      <Palette size={15} className="text-indigo-600" />
                      <span>مظهر الواجهة (Theme)</span>
                    </span>
                    <span className="text-[11px] text-slate-500">اختر النمط البصري المناسب للاستخدام في النهار أو الليل</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Sun size={16} />
                      <span>☀️ الوضع الفاتح (Light Mode)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-slate-900 text-amber-400 border-slate-800 shadow-sm font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Moon size={16} />
                      <span>🌙 الوضع الداكن (Dark Mode)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Interface Language Selection (Arabic / English) */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div>
                    <span className="block font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                      <Globe size={15} className="text-sky-600" />
                      <span>لغة الواجهة (Interface Language)</span>
                    </span>
                    <span className="text-[11px] text-slate-500">دعم التبديل المباشر للغة واتجاه النصوص</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        language === 'ar'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🇸🇦 العربية (Arabic - RTL)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                        language === 'en'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🇬🇧 English (الإنجليزية - LTR)</span>
                    </button>
                  </div>
                </div>

                {/* Date Format Option */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="block font-extrabold text-xs text-slate-800">تنسيق عرض التواريخ</span>
                    <span className="text-[11px] text-slate-500">اختر طريقة عرض تاريخ السندات والكشوفات</span>
                  </div>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="YYYY-MM-DD">السنة - الشهر - اليوم (2026-08-10)</option>
                    <option value="DD/MM/YYYY">اليوم / الشهر / السنة (10/08/2026)</option>
                  </select>
                </div>

                {/* Compact Density Mode Toggle */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-extrabold text-xs text-slate-800">وضع العرض المدمج (Compact View)</span>
                    <span className="text-[11px] text-slate-500 font-medium">تقليل الهوامش والمسافات لعرض أقصى قدر من البيانات للشاشات الصغيرة</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompactMode(!compactMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      compactMode ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        compactMode ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 💾 SECTION 4: DATA & SECURITY MANAGEMENT */}
          {activeSection === 'data' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/60 flex items-center gap-2.5 text-xs text-rose-900">
                <Database size={16} className="text-rose-600 shrink-0" />
                <p className="font-semibold">خيارات التصدير الشامل والاستعادة وإعادة التهيئة بأمان.</p>
              </div>

              <div className="space-y-3">
                {/* Backup & Restore shortcut */}
                {onOpenBackupModal && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                    <div>
                      <span className="block font-black text-xs text-slate-900">مركز النسخ الاحتياطي والاستعادة</span>
                      <span className="text-[11px] text-slate-500 font-medium">تصدير قاعدة البيانات كاملة بصيغة JSON أو استعادتها بضغطة زر</span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBackupModal();
                      }}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Database size={14} />
                      <span>فتح نافذة النسخ</span>
                    </button>
                  </div>
                )}

                {/* Reset Data Danger Zone */}
                {onResetAllData && (
                  <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200/90 space-y-2">
                    <div className="flex items-center gap-2 text-rose-700">
                      <ShieldAlert size={18} className="shrink-0" />
                      <span className="font-black text-xs">منطقة المسح الشامل وإعادة التهيئة (Danger Zone)</span>
                    </div>
                    <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
                      تؤدي هذه العملية إلى مسح كافة البيانات المخزنة محلياً (المشاريع، المصاريف، العمال، الموردين) وإعادة التطبيق للحالة الأولية.
                    </p>
                    <button
                      onClick={() => setShowConfirmReset(true)}
                      className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <AlertTriangle size={14} />
                      <span>إعادة ضبط وإعادة تهيئة كافة البيانات</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-3.5 sm:p-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            onClick={handleSaveAllSettings}
            className="py-2 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>تم الحفظ!</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>حفظ وتطبيق الإعدادات</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Double Confirmation Modal for Resetting All Data */}
      {showConfirmReset && (
        <div 
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-rose-200 shadow-2xl p-5 max-w-md w-full space-y-4 text-right dir-rtl animate-scale-up overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <AlertTriangle size={26} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-slate-900">هل أنت متأكد من مسح كافة البيانات؟</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                سيتم حذف كافة المصاريف والعمال والموردين والمشاريع نهائياً من الذاكرة المحلية. لا يمكن التراجع عن هذا الإجراء إلا بوجود نسخة احتياطية.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                اكتب كلمة <span className="text-rose-600 font-black">مسح</span> لتأكيد العملية:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="اكتب مسح هنا"
                className="w-full px-3 py-2 bg-rose-50/50 border border-rose-200 rounded-xl text-center font-black text-xs text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleExecuteDataReset}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                مسح نهائي الآن
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
