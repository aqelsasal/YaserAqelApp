/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  primaryAction?: React.ReactNode;
  onBack?: () => void;
  optionsMenu?: React.ReactNode;
  extraActions?: React.ReactNode;
  badgeText?: string;
  className?: string;
}

export default function PageHeaderCard({
  title,
  description,
  icon,
  primaryAction,
  onBack,
  optionsMenu,
  extraActions,
  badgeText,
  className = ''
}: PageHeaderCardProps) {
  return (
    <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 text-white p-2.5 sm:p-3 px-3 sm:px-4 rounded-xl shadow-md border border-slate-800/80 relative z-20 dir-rtl text-right ${className}`}>
      {/* Ambient decorative background glows */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-10 -left-10 w-36 h-36 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
        
        {/* Title, Icon, Badge & Description (Compact header: title next to icon in single line, 1-2 lines description) */}
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/30 shadow-xs shrink-0 flex items-center justify-center">
              {icon}
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate">
              {title}
            </h1>
            {badgeText && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-md border border-amber-500/20 shrink-0 whitespace-nowrap">
                {badgeText}
              </span>
            )}
          </div>
          {description && (
            <p className="text-slate-300 text-[11px] sm:text-xs leading-snug font-normal line-clamp-2 max-w-2xl pr-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Header Action Buttons in ONE single horizontal row */}
        <div className="flex flex-row items-center justify-end gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
          {primaryAction}
          
          {onBack && (
            <button
              onClick={onBack}
              className="bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-slate-200 border border-slate-700/80 font-bold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-xs shrink-0 whitespace-nowrap"
              title="الرجوع للرئيسية"
            >
              <ArrowLeft size={14} />
              <span>الرجوع للرئيسية</span>
            </button>
          )}

          {optionsMenu}

          {extraActions}
        </div>

      </div>
    </div>
  );
}
