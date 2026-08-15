/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Share2, 
  MessageSquare, 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone,
  X,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface ShareMenuProps {
  title: string;
  textToShare: string;
  buttonLabel?: string;
  className?: string;
  variant?: 'button' | 'icon' | 'outline' | 'mini';
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ShareMenu({
  title,
  textToShare,
  buttonLabel = 'مشاركة',
  className = '',
  variant = 'button',
  onExportExcel,
  onExportPDF,
  isOpen: externalIsOpen,
  onClose
}: ShareMenuProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Lock body scroll when share menu is open
  useBodyScrollLock(isModalOpen);

  const closeMenu = () => {
    if (onClose) onClose();
    setInternalIsOpen(false);
  };

  const toggleMenu = () => {
    if (isModalOpen) {
      closeMenu();
    } else {
      setInternalIsOpen(true);
    }
  };

  // Clean formatted text for sharing
  const getShareText = () => textToShare.trim();

  // Native share (Bluetooth, WhatsApp, AirDrop, etc. via OS)
  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: getShareText(),
        });
        closeMenu();
      } catch (err) {
        console.warn('System share error or cancelled:', err);
      }
    } else {
      handleCopyToClipboard();
    }
  };

  // WhatsApp direct text share
  const handleWhatsAppTextShare = () => {
    const encodedText = encodeURIComponent(getShareText());
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    closeMenu();
  };

  // WhatsApp Excel (.xlsx) file share
  const handleWhatsAppExcelShare = () => {
    if (onExportExcel) {
      onExportExcel();
    }
    const introText = `📊 مرفق لكم ملف التقرير والحساب بصيغة إكسل (Excel .xlsx):\n\n${getShareText()}\n\n📎 (تم تحميل ملف الإكسل .xlsx تلقائياً على جهازك، يرجى إرفاقه في المحادثة)`;
    const encodedText = encodeURIComponent(introText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    closeMenu();
  };

  // WhatsApp PDF file share
  const handleWhatsAppPDFShare = () => {
    if (onExportPDF) {
      onExportPDF();
    }
    const introText = `📄 مرفق لكم تقرير الحساب الرسمي بصيغة PDF:\n\n${getShareText()}\n\n📎 (يرجى إرفاق ملف الـ PDF المحفوظ في المحادثة)`;
    const encodedText = encodeURIComponent(introText);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    closeMenu();
  };

  // Copy to Clipboard
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(getShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Determine button styles based on variant
  const getButtonStyles = () => {
    if (variant === 'icon') {
      return 'p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200/60 bg-white';
    }
    if (variant === 'mini') {
      return 'p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer';
    }
    if (variant === 'outline') {
      return 'h-10 px-3.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200/90 rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0';
    }
    return 'h-10 px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0';
  };

  const isWebShareSupported = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="relative inline-block text-right dir-rtl">
      {/* Trigger Button (if not controlled externally or if explicitly rendered) */}
      {externalIsOpen === undefined && (
        <button
          onClick={toggleMenu}
          className={`${getButtonStyles()} ${className}`}
          title="مشاركة البيانات"
          id={`share-btn-${title.replace(/\s+/g, '-')}`}
        >
          <Share2 size={variant === 'mini' ? 14 : 16} className={variant === 'outline' ? 'text-indigo-600 shrink-0' : 'shrink-0'} />
          {variant !== 'icon' && variant !== 'mini' && <span>{buttonLabel}</span>}
        </button>
      )}

      {/* Share Modal/Dropdown */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto dir-rtl text-right overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onClick={closeMenu}
        >
          {/* Dialog popup */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-88 max-w-[95vw] bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-4 space-y-3 animate-scale-up text-right my-auto overscroll-contain"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                <Share2 size={14} className="text-violet-600" />
                خيارات مشاركة البيانات عبر الواتساب والجوال
              </span>
              <button 
                onClick={closeMenu}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              اختر طريقة مشاركة الكشف المالي: إما إرسال ملف Excel مفصل أو تقرير PDF أو ملخص نصي مباشر:
            </p>

            <div className="space-y-2">
              {/* WhatsApp Excel (.xlsx) Share */}
              <button
                onClick={handleWhatsAppExcelShare}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 rounded-xl text-xs font-bold transition-colors text-right cursor-pointer border border-emerald-200/60"
              >
                <div className="p-2 bg-emerald-500 text-white rounded-lg">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="flex-1">
                  <span className="block text-emerald-950 font-extrabold">مشاركة إكسل (.xlsx) عبر الواتساب</span>
                  <span className="text-[10px] text-emerald-700 block font-normal">تحميل كشف إكسل جاهز + إرساله عبر WhatsApp</span>
                </div>
                <ExternalLink size={12} className="text-emerald-600 opacity-60" />
              </button>

              {/* WhatsApp PDF Share */}
              <button
                onClick={handleWhatsAppPDFShare}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100/80 text-rose-900 rounded-xl text-xs font-bold transition-colors text-right cursor-pointer border border-rose-200/60"
              >
                <div className="p-2 bg-rose-500 text-white rounded-lg">
                  <FileText size={16} />
                </div>
                <div className="flex-1">
                  <span className="block text-rose-950 font-extrabold">مشاركة تقرير PDF عبر الواتساب</span>
                  <span className="text-[10px] text-rose-700 block font-normal">توليد تقرير PDF رسمي طباعة + فتح الواتساب</span>
                </div>
                <ExternalLink size={12} className="text-rose-600 opacity-60" />
              </button>

              {/* WhatsApp Direct Text Share */}
              <button
                onClick={handleWhatsAppTextShare}
                className="w-full flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition-colors text-right cursor-pointer border border-slate-200/70"
              >
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                  <MessageSquare size={14} />
                </div>
                <div className="flex-1">
                  <span>مشاركة نصية مباشرة عبر الواتساب</span>
                  <span className="text-[10px] text-slate-500 block font-normal">إرسال نص التقرير والمجاميع في المحادثة</span>
                </div>
                <ExternalLink size={12} className="text-slate-400 opacity-50" />
              </button>

              {/* OS Native Share */}
              {isWebShareSupported && (
                <button
                  onClick={handleSystemShare}
                  className="w-full flex items-center gap-2.5 px-3 py-2 bg-violet-50 hover:bg-violet-100/70 text-violet-800 rounded-xl text-xs font-bold transition-colors text-right cursor-pointer border border-violet-100"
                >
                  <Smartphone size={15} className="text-violet-600" />
                  <div className="flex-1">
                    <span>مشاركة عبر الجوال (بلوتوث / تطبيقات أخرى)</span>
                  </div>
                </button>
              )}

              {/* Copy Option */}
              <button
                onClick={handleCopyToClipboard}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors text-right cursor-pointer border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Copy size={15} className="text-slate-500" />
                  <span>نسخ النص كاملاً للحافظة</span>
                </div>
                {copied ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-[10px] font-bold">
                    <Check size={12} /> تم النسخ!
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">نسخ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
