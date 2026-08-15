import React from 'react';
import { tafqeet, getCurrencyLabel } from '../utils/tafqeet';

interface AmountInWordsProps {
  amount: number | string | undefined | null;
  currency?: string;
  className?: string;
}

export const AmountInWords: React.FC<AmountInWordsProps> = ({ amount, currency, className = '' }) => {
  const words = tafqeet(amount);
  if (!words || words === 'صفر') return null;

  const currencyLabel = currency ? getCurrencyLabel(currency) : '';

  return (
    <div className={`mt-1 text-[11px] font-bold text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition-all ${className}`}>
      <span className="text-amber-600 shrink-0 select-none">✍️</span>
      <span className="leading-snug">
        {words}
      </span>
    </div>
  );
};
