/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';

export interface LedgerEntry {
  id: string;
  date: string;
  amountOnHim: number; // المبلغ عليه
  amountForHim: number; // المبلغ له
  description: string;  // البيان
  notes: string;        // ملاحظات
  isPosted?: boolean;   // هل تم ترحيله من المصروفات اليومية
  isAutoDailyWage?: boolean; // هل هو احتساب تلقائي للأجر اليومي
  isNutrition?: boolean; // هل هو احتساب تلقائي لبيانات التغذية
  nutritionPeriodId?: string; // معرف فترة التغذية الملتصق بها
  currency?: string;    // العملة (مثال: YER, SAR, USD)
  createdBy?: string;   // الشخص الذي أضاف الحركة
  updatedBy?: string;   // الشخص الذي عدل الحركة
}

export interface WorkPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

export interface NutritionPeriod {
  id: string;
  workerName: string;   // اسم العمال / العامل المساعد
  dailyAmount: number;  // مبلغ التغذية اليومية للعامل
  startDate: string;    // تاريخ البدء (إلزامي)
  endDate?: string;     // تاريخ الانتهاء (اختياري - إن ترك فارغاً فالفترة مستمرة)
  notes?: string;       // ملاحظات
  createdBy?: string;   // الشخص الذي أضاف السجل
  updatedBy?: string;   // الشخص الذي عدل السجل
}

export interface Worker {
  id: string;
  name: string;         // الاسم
  profession: string;   // المهنة
  startDate: string;    // تاريخ البدء
  endDate: string;      // تاريخ الانتهاء
  phoneNumbers?: string[]; // أرقام الهواتف
  notes?: string;       // ملاحظات
  ledger: LedgerEntry[];
  extraPeriods?: WorkPeriod[]; // فترات عمل إضافية
  nutritionPeriods?: NutritionPeriod[]; // فترات التغذية
  createdBy?: string;   // الشخص الذي أضاف العامل
  updatedBy?: string;   // الشخص الذي عدل العامل
}

export interface Employee {
  id: string;
  name: string;         // الاسم
  profession: string;   // المهنة / المسمى الوظيفي
  startDate: string;    // تاريخ البدء
  endDate: string;      // تاريخ الانتهاء (اختياري)
  dailyWage: number;    // الأجر اليومي
  phoneNumbers?: string[]; // أرقام الهواتف
  notes?: string;       // ملاحظات
  ledger: LedgerEntry[];
  extraPeriods?: WorkPeriod[]; // فترات عمل إضافية
  createdBy?: string;   // الشخص الذي أضاف الموظف
  updatedBy?: string;   // الشخص الذي عدل الموظف
}

export interface Supplier {
  id: string;
  name: string;         // اسم المورد
  materialType: string; // نوع المواد
  phoneNumbers?: string[]; // أرقام الهواتف
  notes?: string;       // ملاحظات
  ledger: LedgerEntry[];
  createdBy?: string;   // الشخص الذي أضاف المورد
  updatedBy?: string;   // الشخص الذي عدل المورد
}

export interface Expense {
  id: string;
  date: string;         // التاريخ
  amount: number;       // المبلغ
  description: string;  // البيان
  notes: string;        // ملاحظات
  recipientId: string;  // معرف العامل، الموظف، أو المورد (للترحيل)
  recipientType: 'worker' | 'employee' | 'supplier' | 'none';
  recipientName: string; // اسم المرحل إليه للعرض السريع
  category?: string;    // فئة / بند المصروف (موارد، أجور، إلخ)
  categories?: string[]; // الفئات بخيارات متعددة (مواد استهلاكية - مواد غذائية - مواد بناء وكهرباء - اصول مضافة)
  expenseType?: 'direct' | 'indirect'; // نوع النفقة: نفقات مباشرة / غير مباشرة
  currency?: string;    // العملة
  createdBy?: string;   // الشخص الذي أضاف المصروف
  updatedBy?: string;   // الشخص الذي عدل المصروف
}

export interface BudgetItem {
  id: string;
  date: string;         // التاريخ
  amount: number;       // المبلغ
  description: string;  // البيان
  notes: string;        // ملاحظات
  currency?: string;    // العملة
  createdBy?: string;   // الشخص الذي أضاف البند
  updatedBy?: string;   // الشخص الذي عدل البند
}

export interface Project {
  id: string;             // معرف فريد للمشروع
  name: string;           // اسم المشروع / موقع العمل
  location?: string;       // موقع العمل / المدينة
  client?: string;         // المالك / العميل
  status: 'active' | 'completed' | 'planning' | 'paused'; // حالة المشروع
  startDate?: string;     // تاريخ بدئ المشروع
  endDate?: string;       // تاريخ الانتهاء أو التسليم
  notes?: string;         // ملاحظات وتفاصيل إضافية
  syncProjectId?: string | null; // معرف المزامنة السحابية لمشروع المشترك إن وجد
  createdAt: string;      // تاريخ الإنشاء
  updatedAt: string;      // تاريخ التحديث
  budget: BudgetItem[];   // الميزانية المعتمدة للمشروع
  workers: Worker[];      // العمال المقيدين بالمشروع
  employees: Employee[];  // الموظفين المعتمدين بالمشروع
  suppliers: Supplier[];  // الموردين المعتمدين بالمشروع
  expenses: Expense[];    // مصروفات هذا المشروع
}

// Utility to calculate days of work
export function calculateDaysOfWork(startDate: string, endDate: string, isOwner: boolean = true): number {
  if (!startDate) return 0;
  if (!endDate && !isOwner) {
    return 0;
  }
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  
  // Set times to midnight to calculate full days
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  if (isNaN(start.getTime()) || !start.getTime() || isNaN(end.getTime()) || !end.getTime()) {
    return 0;
  }
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Return positive diff + 1 (to count the start day), or 0 if start is after end
  return diffDays >= 0 ? diffDays + 1 : 0;
}

// Utility to calculate actual working days dynamically based on the current system/phone date
export function calculateActualDaysOfWork(startDate: string, endDate: string | undefined | null, isOwner: boolean = true): number {
  if (!startDate || !isOwner) return 0;
  
  const start = new Date(startDate);
  const today = new Date();
  
  // Set times to midnight to calculate pure day differences
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  let end = today;
  if (endDate) {
    const parsedEnd = new Date(endDate);
    parsedEnd.setHours(0, 0, 0, 0);
    // If today is equal or past the entered endDate, stop updating and stick to the entered endDate
    if (today >= parsedEnd) {
      end = parsedEnd;
    } else {
      // If today is before endDate, we update dynamically up to today
      end = today;
    }
  }
  
  if (isNaN(start.getTime()) || !start.getTime() || isNaN(end.getTime()) || !end.getTime()) {
    return 0;
  }
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 ? diffDays + 1 : 0;
}

// Utility to calculate nutrition days automatically (inclusive: start to end or start to device today)
export function calculateNutritionDays(startDate: string, endDate?: string | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  let end: Date;
  if (endDate && endDate.trim() !== '') {
    end = new Date(endDate);
  } else {
    end = new Date(); // Current system/device date
  }
  end.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays + 1 : 0;
}

// Helper to clean posted tag strings from description text
export function cleanLedgerDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\s*\((مرحّل|مرحلة|مرحل)\s*(تلقائياً|تلقائيا)?\s*(من النفقات اليومية|من النفقات)?\)/gi, '')
    .trim();
}

// Synchronize nutrition periods with worker ledger entries
export function syncWorkerNutritionLedger(worker: Worker): Worker {
  const nutritionPeriods = worker.nutritionPeriods || [];
  if (nutritionPeriods.length === 0) {
    const updatedLedger = worker.ledger.filter(e => !e.isNutrition && !e.nutritionPeriodId && !e.id.startsWith('nutr_entry_'));
    if (updatedLedger.length === worker.ledger.length) return worker;
    return { ...worker, ledger: updatedLedger };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const validNutrIds = new Set(nutritionPeriods.map(np => np.id));

  let currentLedger = [...worker.ledger];

  // Remove stale nutrition entries
  currentLedger = currentLedger.filter(e => {
    if (e.isNutrition || e.nutritionPeriodId || e.id.startsWith('nutr_entry_')) {
      const nutrId = e.nutritionPeriodId || e.id.replace('nutr_entry_', '');
      return validNutrIds.has(nutrId);
    }
    return true;
  });

  // Sync or add nutrition entries
  nutritionPeriods.forEach(np => {
    const entryId = `nutr_entry_${np.id}`;
    const days = calculateNutritionDays(np.startDate, np.endDate);
    const totalAmount = days * np.dailyAmount;
    const effectiveEndDate = (np.endDate && np.endDate.trim() !== '') ? np.endDate : todayStr;
    const startDateFormatted = formatDateArabic(np.startDate);
    const endDateFormatted = formatDateArabic(effectiveEndDate);

    const desc = `إجمالي مبلغ التغذية لـ (${np.workerName}) لعدد أيام (${days}) من تاريخ (${startDateFormatted}) إلى تاريخ (${endDateFormatted})`;

    const existingIdx = currentLedger.findIndex(e => e.id === entryId || e.nutritionPeriodId === np.id);

    if (existingIdx !== -1) {
      currentLedger[existingIdx] = {
        ...currentLedger[existingIdx],
        date: effectiveEndDate,
        amountOnHim: totalAmount,
        amountForHim: 0,
        description: desc,
        notes: np.notes || '',
        isNutrition: true,
        nutritionPeriodId: np.id,
      };
    } else {
      const newEntry: LedgerEntry = {
        id: entryId,
        date: effectiveEndDate,
        amountOnHim: totalAmount,
        amountForHim: 0,
        description: desc,
        notes: np.notes || '',
        isNutrition: true,
        nutritionPeriodId: np.id,
        currency: 'YER',
        createdBy: np.createdBy || worker.createdBy || 'مالك المشروع'
      };
      currentLedger = [newEntry, ...currentLedger];
    }
  });

  return {
    ...worker,
    ledger: currentLedger
  };
}

// Convert any Eastern Arabic numerals (٠-٩, ۰-۹) to standard English/Latin digits (0-9)
export function toEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

// Format currency beautifully in Arabic (YER, SAR, or USD) using English digits (123)
export function formatCurrency(amount: number, currencyCode: string = 'YER'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  
  const cleanNum = toEnglishDigits(formatted);

  switch (currencyCode) {
    case 'SAR':
      return `${cleanNum} ر.س`;
    case 'USD':
      return `$${cleanNum}`;
    case 'YER':
    default:
      return `${cleanNum} ر.ي`;
  }
}

// Format date to local Arabic format using English digits (123)
export function formatDateArabic(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return toEnglishDigits(dateString);
  
  const formatted = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);

  return toEnglishDigits(formatted);
}

// Helper to format date for report filenames (e.g. 04-08-2026)
export function getFormattedReportDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Ensures that any report title/filename contains the date formatted as DD-MM-YYYY (e.g. 04-08-2026)
export function ensureDateInFilename(filename: string): string {
  if (!filename) return `تقرير_${getFormattedReportDate()}`;

  // If filename already contains YYYY-MM-DD or DD-MM-YYYY date format
  const ymdPattern = /(\d{4})-(\d{2})-(\d{2})/;
  const dmyPattern = /(\d{2})-(\d{2})-(\d{4})/;

  if (ymdPattern.test(filename)) {
    // Convert YYYY-MM-DD to DD-MM-YYYY (e.g., 2026-08-04 -> 04-08-2026)
    return filename.replace(ymdPattern, '$3-$2-$1');
  }

  if (dmyPattern.test(filename)) {
    return filename;
  }

  const dateStr = getFormattedReportDate();

  // Strip extension if present
  let baseName = filename;
  let ext = '';
  if (baseName.toLowerCase().endsWith('.xlsx')) {
    baseName = baseName.slice(0, -5);
    ext = '.xlsx';
  } else if (baseName.toLowerCase().endsWith('.csv')) {
    baseName = baseName.slice(0, -4);
    ext = '.csv';
  } else if (baseName.toLowerCase().endsWith('.html')) {
    baseName = baseName.slice(0, -5);
    ext = '.html';
  } else if (baseName.toLowerCase().endsWith('.pdf')) {
    baseName = baseName.slice(0, -4);
    ext = '.pdf';
  } else if (baseName.toLowerCase().endsWith('.json')) {
    baseName = baseName.slice(0, -5);
    ext = '.json';
  }

  baseName = baseName.trim().replace(/[-_]+$/, '');

  const separator = baseName.includes('_') ? '_' : ' ';
  return `${baseName}${separator}${dateStr}${ext}`;
}

// Helper to export Multi-Sheet Excel (.xlsx) files with SheetJS
export interface ExcelSheetConfig {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportMultiSheetXLSX(filename: string, sheets: ExcelSheetConfig[]) {
  try {
    const datedFilename = ensureDateInFilename(filename);
    const workbook = XLSX.utils.book_new();

    sheets.forEach(({ sheetName, headers, rows }) => {
      const data = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Auto-calculate column widths
      const colWidths = headers.map((header, colIndex) => {
        let maxLen = (header || '').toString().length;
        rows.forEach(row => {
          const val = row[colIndex];
          if (val !== undefined && val !== null) {
            const len = val.toString().length;
            if (len > maxLen) maxLen = len;
          }
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
      });
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const cleanFilename = datedFilename.toLowerCase().endsWith('.xlsx') ? datedFilename : `${datedFilename}.xlsx`;
    XLSX.writeFile(workbook, cleanFilename);

    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast(`تم تصدير ملف Excel الشامل التفصيلي (${cleanFilename}) بنجاح!`);
    }
  } catch (err) {
    console.error("Multi-sheet XLSX export failed:", err);
  }
}

// Helper to export Excel (.xlsx) files with SheetJS
export function exportToXLSX(filename: string, headers: string[], rows: (string | number)[][], sheetName: string = 'التقرير') {
  try {
    const datedFilename = ensureDateInFilename(filename);
    const data = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Auto-calculate column widths
    const colWidths = headers.map((header, colIndex) => {
      let maxLen = (header || '').toString().length;
      rows.forEach(row => {
        const val = row[colIndex];
        if (val !== undefined && val !== null) {
          const len = val.toString().length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Ensure extension is .xlsx
    const cleanFilename = datedFilename.toLowerCase().endsWith('.xlsx') ? datedFilename : `${datedFilename}.xlsx`;
    XLSX.writeFile(workbook, cleanFilename);

    // Copy TSV to clipboard for quick paste
    try {
      const tsvContent = [
        headers.join('\t'),
        ...rows.map(row => row.map(val => (val !== undefined && val !== null ? val : '').toString().replace(/[\t\r\n]/g, ' ')).join('\t'))
      ].join('\n');
      
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(tsvContent).catch(() => {});
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast(`تم تحميل ملف Excel بفرز وتنسيق كامل (${cleanFilename}) بنجاح!`);
    }
  } catch (err) {
    console.error("XLSX export failed:", err);
  }
}

// Backward compatible export function alias that always exports .xlsx files
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const cleanName = filename.replace(/\.csv$/i, '');
  exportToXLSX(cleanName, headers, rows);
}

import { COMPANY_LOGO_BASE64 } from './companyLogo';
export { COMPANY_LOGO_BASE64 };

// Helper to open a stylized, print-ready window for PDF exporting/printing
export function printPDF(title: string, htmlContent: string) {
  if (typeof window !== 'undefined' && (window as any).showPrintPreview) {
    (window as any).showPrintPreview(title, htmlContent);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('الرجاء السماح بالنوافذ المنبثقة لتتمكن من طباعة التقرير.');
    return;
  }

  const compName = localStorage.getItem('site_company_name') || 'شركة ورلد أوف إيليتس للمقاولات والخدمات';
  const projName = localStorage.getItem('site_project_name') || 'مشروع المقاولات والإنشاءات الرئيسي';

  const showHeader = localStorage.getItem('site_show_report_header') !== 'false';
  const showSignatures = localStorage.getItem('site_show_signature_blocks') !== 'false';
  const showAttribution = localStorage.getItem('site_show_designer_attribution') !== 'false';
  const footerNotes = (localStorage.getItem('site_report_footer_notes') || '').trim();

  const hasExistingHeader = htmlContent.includes('report-header') || htmlContent.includes('official-report-header') || htmlContent.includes('pdf-report-root');

  const headerHtml = (showHeader && !hasExistingHeader) ? `
    <div class="official-report-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
      <div style="text-align: right; flex: 1;">
        <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: bold;">${compName}</h2>
        <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">قسم الحسابات والرقابة المالية</p>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold;">المشروع: ${projName}</p>
      </div>
      <div style="text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1.5px solid #d97706; margin-bottom: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.12); background-color: #ffffff;">
          <img src="${COMPANY_LOGO_BASE64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="شعار الشركة" />
        </div>
        <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">${title}</h1>
      </div>
      <div style="text-align: left; flex: 1;">
        <h3 style="margin: 0; font-size: 13px; color: #1e293b; font-weight: bold;">تقرير رسمي معتمد</h3>
        <p style="margin: 3px 0 0 0; font-size: 11px; color: #64748b;">التاريخ: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}</p>
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
        تم توليد هذا التقرير تلقائياً بواسطة تطبيق الحسابات وادارة المشاريع - ${compName} | توقيع المهندس/المصمم ومطور النظام المعتمد | تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
      </div>
    `;
  } else {
    footerCustomHtml += `
      <div class="footer-note" style="margin-top: 25px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px; page-break-inside: avoid;">
        ${compName} - تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}
      </div>
    `;
  }

  printWindow.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 10mm 12mm 10mm;
            }
            body { margin: 0 !important; padding: 0 !important; }
            button { display: none !important; }
          }
          body {
            font-family: 'Cairo', sans-serif;
            padding: 24px;
            color: #334155;
            direction: rtl;
            background-color: #fff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
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
          .footer-note {
            text-align: center;
            margin-top: 40px;
            font-size: 11px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div style="text-align: left; margin-bottom: 10px;">
          <button onclick="window.print()" style="background-color: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cairo', sans-serif; font-weight: bold;">طباعة التقرير / حفظ كـ PDF 🖨️</button>
        </div>
        ${headerHtml}
        ${htmlContent}
        ${footerCustomHtml}
      </body>
    </html>
  `);
  printWindow.document.close();
}
