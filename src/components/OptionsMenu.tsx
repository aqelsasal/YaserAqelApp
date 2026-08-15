/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  SlidersHorizontal, 
  FileSpreadsheet, 
  FileText, 
  Share2, 
  Upload, 
  ChevronDown 
} from 'lucide-react';
import ShareMenu from './ShareMenu';

interface OptionsMenuProps {
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onImportExcel?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  shareTitle?: string;
  shareText?: string;
  className?: string;
  buttonLabel?: string;
}

export default function OptionsMenu({
  onExportExcel,
  onExportPDF,
  onImportExcel,
  shareTitle = 'تقرير مالية ومستحقات الموقع',
  shareText = '',
  className = '',
  buttonLabel = 'خيارات'
}: OptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-right dir-rtl ${className}`} ref={menuRef}>
      {/* Options Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="py-2 px-3.5 bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-slate-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-700/80 whitespace-nowrap"
        title="قائمة الخيارات والتصدير"
      >
        <SlidersHorizontal size={14} className="text-sky-400 shrink-0" />
        <span>{buttonLabel}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Hidden File Input for Import */}
      {onImportExcel && (
        <input
          type="file"
          accept=".xlsx, .xls"
          ref={fileInputRef}
          onChange={(e) => {
            onImportExcel(e);
            setIsOpen(false);
          }}
          className="hidden"
        />
      )}

      {/* Dropdown Options List */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[9999] p-1.5 space-y-1 animate-scale-up text-right dir-rtl ring-1 ring-black/5"
        >
          
          {/* Import Excel */}
          {onImportExcel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-right"
            >
              <Upload size={15} className="text-sky-600 shrink-0" />
              <span>استيراد من Excel</span>
            </button>
          )}

          {/* Export Excel */}
          {onExportExcel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExportExcel();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-right"
            >
              <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
              <span>تصدير إلى Excel</span>
            </button>
          )}

          {/* Export PDF */}
          {onExportPDF && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExportPDF();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-right"
            >
              <FileText size={15} className="text-rose-600 shrink-0" />
              <span>تصدير PDF / طباعة</span>
            </button>
          )}

          {/* Share Option */}
          {(shareText !== undefined || shareTitle) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsShareOpen(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-right"
            >
              <Share2 size={15} className="text-violet-600 shrink-0" />
              <span>مشاركة التقرير</span>
            </button>
          )}
        </div>
      )}

      {/* Share Modal Controlled State */}
      {isShareOpen && (
        <ShareMenu
          title={shareTitle}
          textToShare={shareText}
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
}
