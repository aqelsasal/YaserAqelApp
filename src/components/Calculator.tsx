import React, { useState, useRef, useEffect } from 'react';
import { Calculator as CalcIcon, X, Check, Trash2, ArrowLeft } from 'lucide-react';
import { tafqeet } from '../utils/tafqeet';
import { useBodyScrollLock } from '../utils/modalScrollLock';

interface CalculatorProps {
  onApply: (value: number) => void;
  className?: string;
  buttonTitle?: string;
}

export default function Calculator({ onApply, className = '', buttonTitle = 'الآلة الحاسبة' }: CalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState('');
  const [equation, setEquation] = useState('');
  const [error, setError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when calculator popup is open
  useBodyScrollLock(isOpen);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard events when open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      const key = e.key;
      if (/[0-9]/.test(key)) {
        handleDigit(key);
      } else if (['+', '-', '*', '/'].includes(key)) {
        handleOperator(key);
      } else if (key === '.' || key === ',') {
        handleDigit('.');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (key === 'Backspace') {
        handleDelete();
      } else if (key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, display, equation]);

  const handleDigit = (digit: string) => {
    setError(false);
    // If we just had an error, reset display
    if (display === 'Error') {
      setDisplay(digit);
      return;
    }
    setDisplay(prev => prev + digit);
  };

  const handleOperator = (op: string) => {
    setError(false);
    if (display === 'Error') return;

    let currentVal = display.trim();
    if (currentVal === '' && equation !== '') {
      // If we just want to change the last operator
      const lastChar = equation.trim().slice(-1);
      if (['+', '-', '*', '/'].includes(lastChar)) {
        setEquation(prev => prev.trim().slice(0, -1) + ' ' + op + ' ');
        return;
      }
    }

    if (currentVal === '') {
      currentVal = '0';
    }

    setEquation(prev => prev + currentVal + ' ' + op + ' ');
    setDisplay('');
  };

  const handleClear = () => {
    setDisplay('');
    setEquation('');
    setError(false);
  };

  const handleDelete = () => {
    setError(false);
    if (display === 'Error') {
      setDisplay('');
      return;
    }
    setDisplay(prev => prev.slice(0, -1));
  };

  const evaluateSafely = (expr: string): number => {
    // Sanitize the expression to allow only numbers, basic math operators and dots
    const sanitized = expr.replace(/[^0-9+\-*/(). ]/g, '');
    try {
      // Using Function constructor on sanitized expression for safe simple math evaluation
      const result = new Function(`return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Number(result.toFixed(4)); // limit decimal places
      }
      throw new Error('Invalid math');
    } catch (err) {
      throw new Error('Calc error');
    }
  };

  const handleCalculate = () => {
    if (display === 'Error') return;
    
    const fullExpr = equation + (display || '0');
    if (!fullExpr.trim()) return;

    try {
      const result = evaluateSafely(fullExpr);
      setDisplay(String(result));
      setEquation('');
      setError(false);
    } catch (err) {
      setDisplay('Error');
      setError(true);
    }
  };

  const handleApplyResult = () => {
    let finalExpr = equation + (display || '0');
    if (display === 'Error') return;
    
    try {
      const result = evaluateSafely(finalExpr);
      onApply(result);
      setIsOpen(false);
    } catch (err) {
      setError(true);
      setDisplay('Error');
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            handleClear();
          }
        }}
        title={buttonTitle}
        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-all flex items-center justify-center cursor-pointer"
        id="calculator-toggle-btn"
      >
        <CalcIcon size={16} />
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto dir-rtl overscroll-contain"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white border border-slate-200/90 shadow-2xl rounded-2xl p-4 w-72 max-w-[95vw] animate-scale-up text-right select-none my-auto overscroll-contain"
            dir="rtl"
          >
            {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalcIcon size={14} className="text-sky-500" />
              الحسابة الذكية
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Screen Display */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 text-left font-mono relative overflow-hidden">
            <div className="text-[10px] text-slate-400 min-h-[14px] truncate text-right">
              {equation}
            </div>
            <div className="text-lg font-bold text-slate-800 break-all truncate text-right mt-1">
              {display || '0'}
            </div>
            {tafqeet(display) && (
              <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md mt-1 text-right truncate">
                {tafqeet(display)}
              </div>
            )}
          </div>

          {/* Pad Buttons Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
            {/* Row 1 */}
            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              C
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleOperator('/')}
              className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors cursor-pointer text-center font-bold font-mono"
            >
              ÷
            </button>
            <button
              type="button"
              onClick={() => handleOperator('*')}
              className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors cursor-pointer text-center font-bold font-mono"
            >
              ×
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => handleDigit('7')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleDigit('8')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleDigit('9')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleOperator('-')}
              className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors cursor-pointer text-center font-bold font-mono"
            >
              -
            </button>

            {/* Row 3 */}
            <button
              type="button"
              onClick={() => handleDigit('4')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleDigit('5')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleDigit('6')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors cursor-pointer text-center font-bold font-mono"
            >
              +
            </button>

            {/* Row 4 */}
            <button
              type="button"
              onClick={() => handleDigit('1')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleDigit('2')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleDigit('3')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              3
            </button>
            <button
              type="button"
              onClick={handleCalculate}
              className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors cursor-pointer text-center font-bold font-mono row-span-2 flex items-center justify-center"
              style={{ gridRow: 'span 2' }}
            >
              =
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold col-span-2"
              style={{ gridColumn: 'span 2' }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleDigit('.')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors cursor-pointer text-center font-bold"
            >
              .
            </button>
          </div>

          {/* Apply Value Action */}
          <button
            type="button"
            onClick={handleApplyResult}
            disabled={error || (!display && !equation)}
            className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check size={14} />
            <span>تطبيق المبلغ</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
