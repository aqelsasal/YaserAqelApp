import React from 'react';

interface AttributionBadgeProps {
  createdBy?: string;
  updatedBy?: string;
}

export const isOwnerUser = (name?: string | null): boolean => {
  if (!name) return true;
  const n = name.trim();
  return (
    n === 'مالك المشروع' ||
    n === 'المهندس/ ياسر عقيل' ||
    n === 'المهندس/ياسر عقيل' ||
    n === 'المهندس ياسر عقيل' ||
    n === 'ياسر عقيل' ||
    n === 'ياسر' ||
    n === 'إدارة المشروع' ||
    n === 'النظام' ||
    n === '-'
  );
};

export default function AttributionBadge({ createdBy, updatedBy }: AttributionBadgeProps) {
  const showAttributionSetting = localStorage.getItem('site_show_designer_attribution') !== 'false';
  if (!showAttributionSetting) return null;

  const showCreatedBy = Boolean(createdBy && !isOwnerUser(createdBy));
  const showUpdatedBy = Boolean(updatedBy && !isOwnerUser(updatedBy));

  if (!showCreatedBy && !showUpdatedBy) return null;
  
  return (
    <div className="flex flex-wrap gap-1 text-[10px] text-slate-400 font-medium mt-1 select-none">
      {showCreatedBy && (
        <span className="inline-flex items-center gap-1 bg-slate-100/80 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          أُضيف بواسطة: <strong className="text-slate-700">{createdBy}</strong>
        </span>
      )}
      {showUpdatedBy && (
        <span className="inline-flex items-center gap-1 bg-amber-50/80 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-200/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          عُدّل بواسطة: <strong className="text-amber-800">{updatedBy}</strong>
        </span>
      )}
    </div>
  );
}

