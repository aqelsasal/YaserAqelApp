/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useBodyScrollLock } from '../utils/modalScrollLock';
import { 
  Phone, 
  Plus, 
  Trash2, 
  BookUser, 
  Upload, 
  Clipboard, 
  Search, 
  X, 
  Check, 
  Info, 
  ExternalLink,
  User,
  FileText
} from 'lucide-react';

interface PhoneNumbersInputProps {
  phoneNumbers: string[];
  onChange: (phones: string[]) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

export function cleanPhoneNumber(raw: string): string {
  if (!raw) return '';
  // Remove all non-digits
  let digits = raw.replace(/\D/g, '');
  
  // Strip Yemen country code variants if present
  if (digits.startsWith('00967') && digits.length >= 14) {
    digits = digits.slice(5);
  } else if (digits.startsWith('967') && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    digits = digits.slice(1);
  }
  
  // Return the last 9 digits
  return digits.slice(-9);
}

interface ParsedContact {
  name: string;
  phones: string[];
}

function parseVCF(vcfText: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const cards = vcfText.split(/BEGIN:VCARD/i);

  for (const card of cards) {
    if (!card.trim()) continue;
    let name = '';
    const phones: string[] = [];

    const lines = card.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // Handle folded lines (RFC 2425)
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        line += lines[i + 1].substring(1);
        i++;
      }

      if (line.match(/^FN[:;]/i)) {
        name = line.replace(/^FN[^:]*:/i, '').trim();
      } else if (!name && line.match(/^N[:;]/i)) {
        const parts = line.replace(/^N[^:]*:/i, '').split(';').filter(Boolean);
        name = parts.reverse().join(' ').trim();
      } else if (line.match(/^TEL/i)) {
        const telVal = line.replace(/^TEL[^:]*:/i, '').trim();
        const cleaned = cleanPhoneNumber(telVal);
        if (cleaned && cleaned.length >= 7 && !phones.includes(cleaned)) {
          phones.push(cleaned);
        }
      }
    }

    if (phones.length > 0) {
      contacts.push({
        name: name || 'جهة اتصال بدون اسم',
        phones
      });
    }
  }
  return contacts;
}

export default function PhoneNumbersInput({
  phoneNumbers,
  onChange,
  disabled = false,
  label = 'رقم الهاتف (9 أرقام)',
  helperText = 'إدخال رقم مكون من 9 أرقام مع إمكانية إضافة أرقام أخرى'
}: PhoneNumbersInputProps) {
  // Ensure at least one element exists for rendering
  const phonesList = phoneNumbers && phoneNumbers.length > 0 ? phoneNumbers : [''];

  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [showContactModal, setShowContactModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'vcf' | 'paste' | 'help'>('vcf');
  
  // VCF state
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [vcfSearchQuery, setVcfSearchQuery] = useState<string>('');
  const [vcfFileName, setVcfFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste state
  const [pasteText, setPasteText] = useState<string>('');
  const [extractedFromPaste, setExtractedFromPaste] = useState<{ raw: string; cleaned: string }[]>([]);

  const handlePhoneChange = (index: number, rawVal: string) => {
    // Only allow digits and max 9 characters
    const digitsOnly = cleanPhoneNumber(rawVal);
    const updated = [...phonesList];
    updated[index] = digitsOnly;
    onChange(updated);
  };

  const handleSelectContact = async (index: number) => {
    setActiveSlotIndex(index);

    // Try Web Contact Picker API if supported by the browser
    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator as any).contacts) {
      try {
        let props = ['tel'];
        if ('getProperties' in (navigator as any).contacts) {
          try {
            const supported = await (navigator as any).contacts.getProperties();
            props = ['tel', 'name'].filter(p => supported.includes(p));
            if (!props.includes('tel')) props.push('tel');
          } catch {
            props = ['tel'];
          }
        }

        const opts = { multiple: true };
        const contacts = await (navigator as any).contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
          const extracted: string[] = [];
          contacts.forEach((c: any) => {
            if (c.tel && Array.isArray(c.tel)) {
              c.tel.forEach((t: string) => {
                const cleaned = cleanPhoneNumber(t);
                if (cleaned && !extracted.includes(cleaned)) {
                  extracted.push(cleaned);
                }
              });
            }
          });

          if (extracted.length > 0) {
            const updated = [...phonesList];
            updated[index] = extracted[0];
            // Add any additional picked numbers
            for (let k = 1; k < extracted.length; k++) {
              if (!updated.includes(extracted[k])) {
                updated.push(extracted[k]);
              }
            }
            onChange(updated);
            return;
          }
        }
        // If contacts were empty, user might have cancelled
        return;
      } catch (err: any) {
        // User cancelled via system back button/dismiss
        if (err?.name === 'AbortError') {
          return;
        }
        console.warn('Native contact picker unavailable or denied, opening in-app assistant:', err);
        // If security error (e.g. running in iframe) or unsupported, open modal
        setShowContactModal(true);
      }
    } else {
      // Browser does not support Contact Picker API natively (e.g., iOS Safari, Firefox, Desktop, or iframe)
      setShowContactModal(true);
    }
  };

  const handleApplyPhoneNumber = (phoneToAdd: string) => {
    const cleaned = cleanPhoneNumber(phoneToAdd);
    if (!cleaned) return;

    const updated = [...phonesList];
    if (activeSlotIndex < updated.length) {
      updated[activeSlotIndex] = cleaned;
    } else {
      updated.push(cleaned);
    }
    onChange(updated);
    setShowContactModal(false);
  };

  const handleApplyMultipleNumbers = (phonesToAdd: string[]) => {
    const validCleaned = phonesToAdd.map(p => cleanPhoneNumber(p)).filter(p => p && p.length > 0);
    if (validCleaned.length === 0) return;

    const updated = [...phonesList];
    updated[activeSlotIndex] = validCleaned[0];
    for (let i = 1; i < validCleaned.length; i++) {
      if (!updated.includes(validCleaned[i])) {
        updated.push(validCleaned[i]);
      }
    }
    onChange(updated);
    setShowContactModal(false);
  };

  const handleVcfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVcfFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseVCF(text);
        setParsedContacts(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    // Find all digit groups of length 7 to 15
    const matches = text.match(/(?:\+?967\s*|0)?7[0-9]{8}|[0-9]{7,15}/g) || [];
    const extracted: { raw: string; cleaned: string }[] = [];
    const seen = new Set<string>();

    matches.forEach(m => {
      const clean = cleanPhoneNumber(m);
      if (clean && clean.length >= 7 && !seen.has(clean)) {
        seen.add(clean);
        extracted.push({ raw: m.trim(), cleaned: clean });
      }
    });

    setExtractedFromPaste(extracted);
  };

  const handleAddPhone = () => {
    onChange([...phonesList, '']);
  };

  const handleRemovePhone = (index: number) => {
    if (phonesList.length === 1) {
      onChange(['']);
    } else {
      const updated = phonesList.filter((_, i) => i !== index);
      onChange(updated);
    }
  };

  // Filter contacts by query
  const filteredVcfContacts = parsedContacts.filter(c => {
    if (!vcfSearchQuery.trim()) return true;
    const q = vcfSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phones.some(p => p.includes(q));
  });

  const isRunningInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Lock background scroll when contact modal is open
  useBodyScrollLock(showContactModal);

  return (
    <div className="space-y-2 dir-rtl text-right">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Phone size={14} className="text-emerald-600" />
          <span>{label}</span>
        </label>
        {helperText && (
          <span className="text-[10px] text-slate-400 font-normal">{helperText}</span>
        )}
      </div>

      <div className="space-y-2">
        {phonesList.map((phone, idx) => {
          const isInvalid = phone.length > 0 && phone.length < 9;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    value={phone}
                    onChange={(e) => handlePhoneChange(idx, e.target.value)}
                    disabled={disabled}
                    placeholder={idx === 0 ? "مثال: 771234567" : "رقم آخر: 731234567"}
                    className={`w-full pl-12 pr-3 py-2 bg-slate-50 border ${
                      isInvalid ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-emerald-500'
                    } rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden transition-all dir-ltr text-right`}
                  />
                  <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    phone.length === 9 
                      ? 'bg-emerald-100 text-emerald-700 font-bold' 
                      : isInvalid 
                      ? 'bg-rose-100 text-rose-700 font-bold' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {phone.length}/9
                  </span>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleSelectContact(idx)}
                    className="p-2 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                    title="اختيار رقم من دليل جهات الاتصال في الهاتف أو استيراد ملف"
                  >
                    <BookUser size={16} className="text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">جهات الاتصال</span>
                  </button>
                )}

                {phonesList.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhone(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="حذف هذا الرقم"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {isInvalid && (
                <p className="text-[10px] text-rose-600 font-medium pr-1">
                  * رقم الهاتف يجب أن يتكون من 9 أرقام
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={handleAddPhone}
          className="mt-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>إضافة رقم آخر</span>
        </button>
      )}

      {/* Contact Picker & Import Assistant Modal */}
      {showContactModal && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overscroll-contain"
          onTouchMove={(e) => {
            // If touching the overlay backdrop, prevent scrolling background
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <BookUser size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">إضافة رقم من جهات الاتصال</h3>
                  <p className="text-[11px] text-slate-400">استيراد أو لصق أرقام الهواتف بسهولة</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowContactModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('vcf')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'vcf' 
                    ? 'border-emerald-600 text-emerald-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload size={14} />
                <span>استيراد ملف جهات الاتصال (VCF)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'paste' 
                    ? 'border-emerald-600 text-emerald-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Clipboard size={14} />
                <span>لصق نص / أرقام سريعة</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('help')}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'help' 
                    ? 'border-emerald-600 text-emerald-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Info size={14} />
                <span>إرشادات الهاتف</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Tab 1: VCF Import */}
              {activeTab === 'vcf' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <FileText size={14} className="text-emerald-600" />
                      استيراد مباشر من دفتر الهاتف
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      يمكنك مشاركة أو تصدير جهات الاتصال من تطبيق جهات الاتصال في هاتفك كملف <strong>(.vcf)</strong> ثم اختياره هنا لإدراج أي رقم بضغطة واحدة.
                    </p>
                  </div>

                  {/* File Upload Trigger */}
                  <div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept=".vcf,text/vcard,text/x-vcard" 
                      onChange={handleVcfFileUpload} 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Upload size={18} className="text-emerald-600" />
                      <span>{vcfFileName ? `تغيير الملف: ${vcfFileName}` : 'اختر ملف جهات الاتصال (.vcf) من الهاتف'}</span>
                    </button>
                  </div>

                  {/* Contacts List from VCF */}
                  {parsedContacts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          جهات الاتصال المستخرجة ({parsedContacts.length})
                        </span>
                        <div className="relative w-44">
                          <input 
                            type="text"
                            placeholder="بحث بالاسم أو الرقم..."
                            value={vcfSearchQuery}
                            onChange={(e) => setVcfSearchQuery(e.target.value)}
                            className="w-full pl-2 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-emerald-500"
                          />
                          <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                        {filteredVcfContacts.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-4">لم يتم العثور على جهات اتصال مطابقة</p>
                        ) : (
                          filteredVcfContacts.map((contact, i) => (
                            <div 
                              key={i} 
                              className="p-2 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-2 hover:border-emerald-300 transition-all"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                                  <User size={14} />
                                </div>
                                <div className="truncate">
                                  <p className="text-xs font-bold text-slate-800 truncate">{contact.name}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    {contact.phones.map((p, pIdx) => (
                                      <span key={pIdx} className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {contact.phones.map((p, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => handleApplyPhoneNumber(p)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                  >
                                    <Check size={12} />
                                    <span>إدراج</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Smart Paste */}
              {activeTab === 'paste' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      الصق نص الرسالة أو بطاقة جهة الاتصال أو قائمة الأرقام:
                    </label>
                    <textarea 
                      rows={3}
                      value={pasteText}
                      onChange={(e) => handlePasteChange(e.target.value)}
                      placeholder="مثال: رقم المهندس أحمد هو 771234567 أو +967731234567..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  {extractedFromPaste.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          الأرقام المكتشفة ({extractedFromPaste.length})
                        </span>
                        {extractedFromPaste.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleApplyMultipleNumbers(extractedFromPaste.map(e => e.cleaned))}
                            className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
                          >
                            إدراج جميع الأرقام
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {extractedFromPaste.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleApplyPhoneNumber(item.cleaned)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check size={14} className="text-emerald-600" />
                            <span>{item.cleaned}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : pasteText.trim().length > 0 ? (
                    <p className="text-xs text-rose-600 font-medium">لم يتم العثور على أرقام هواتف صالحة في النص الملصق.</p>
                  ) : null}
                </div>
              )}

              {/* Tab 3: Mobile Guide */}
              {activeTab === 'help' && (
                <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Phone size={14} className="text-emerald-600" />
                      دعم فتح دليل الهاتف المباشر (Native Contact Picker)
                    </h4>
                    <p>
                      يدعم متصفح <strong>Google Chrome</strong> على أجهزة <strong>Android</strong> نافذة اختيار جهات الاتصال الأصلية عند فتح التطبيق في نافذة مستقلة كاملة.
                    </p>
                    {isRunningInIframe && (
                      <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-bold">
                        أنت تعرض التطبيق حالياً داخل إطار معاينة (iFrame). لفتح دليل الهاتف الأصلي، يمكنك فتح التطبيق في علامة تبويب جديدة أو استخدام خيار استيراد ملف VCF.
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-800">كيفية تصدير جهات الاتصال كملف VCF:</h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-600">
                      <li><strong>على أجهزة Android:</strong> افتح تطبيق جهات الاتصال &larr; الإعدادات/إدارة جهات الاتصال &larr; تصدير إلى ملف vCard (.vcf).</li>
                      <li><strong>على أجهزة iPhone:</strong> افتح تطبيق جهات الاتصال &larr; اختر جهة الاتصال &larr; مشاركة جهة الاتصال &larr; حفظ كملف.</li>
                      <li><strong>من WhatsApp:</strong> افتح محادثة &larr; مشاركة جهة اتصال &larr; ثم نسخ الرقم أو مشاركة بطاقة جهة الاتصال.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PhoneNumbersDisplay({ phoneNumbers, className = '' }: { phoneNumbers?: string[]; className?: string }) {
  if (!phoneNumbers || phoneNumbers.length === 0) {
    return null;
  }
  const validPhones = phoneNumbers.filter(p => p && p.trim().length > 0);
  if (validPhones.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {validPhones.map((phone, i) => (
        <a
          key={i}
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200/80 hover:border-emerald-300 rounded-lg text-xs font-mono font-bold transition-colors dir-ltr shadow-2xs"
          title="انقر للاتصال"
        >
          <Phone size={12} className="text-emerald-600 shrink-0" />
          <span>{phone}</span>
        </a>
      ))}
    </div>
  );
}

