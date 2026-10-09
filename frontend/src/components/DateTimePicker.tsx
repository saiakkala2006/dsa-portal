'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { format, isValid } from 'date-fns';

interface DateTimePickerProps {
  label: string;
  value: string; // ISO string
  onChange: (isoString: string) => void;
  required?: boolean;
  minDate?: Date;
  placeholder?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateTimePicker({
  label,
  value,
  onChange,
  required = false,
  minDate,
  placeholder = 'Select date & time',
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial or current value
  const initialDate = value && isValid(new Date(value)) ? new Date(value) : new Date();

  // Internal picker state
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Time state (12-hour format)
  const rawHours = initialDate.getHours();
  const [selectedHour, setSelectedHour] = useState(rawHours % 12 === 0 ? 12 : rawHours % 12);
  const [selectedMinute, setSelectedMinute] = useState(Math.floor(initialDate.getMinutes() / 5) * 5);
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(rawHours >= 12 ? 'PM' : 'AM');

  // Sync internal state when value prop changes
  useEffect(() => {
    if (value && isValid(new Date(value))) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelectedDay(d.getDate());
      const h = d.getHours();
      setSelectedHour(h % 12 === 0 ? 12 : h % 12);
      setSelectedMinute(d.getMinutes());
      setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Calendar matrix calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Compute selected Date object
  const getComputedDate = () => {
    let hour24 = selectedHour % 12;
    if (selectedAmPm === 'PM') {
      hour24 += 12;
    }
    const d = new Date(viewYear, viewMonth, selectedDay, hour24, selectedMinute, 0);
    return d;
  };

  // Preset helpers
  const applyPreset = (offsetMinutes: number) => {
    const target = new Date(Date.now() + offsetMinutes * 60 * 1000);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setSelectedDay(target.getDate());
    const h = target.getHours();
    setSelectedHour(h % 12 === 0 ? 12 : h % 12);
    setSelectedMinute(Math.floor(target.getMinutes() / 5) * 5);
    setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
  };

  // Apply & Confirm
  const handleDone = () => {
    const computed = getComputedDate();
    onChange(computed.toISOString());
    setIsOpen(false);
  };

  // Display text in input
  const displayText = value && isValid(new Date(value))
    ? format(new Date(value), 'dd MMM yyyy, hh:mm a')
    : '';

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-dark-300 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-xl bg-dark-900 border text-sm flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'border-primary-500 ring-1 ring-primary-500' : 'border-dark-600 hover:border-dark-500'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <CalendarIcon className="w-4 h-4 text-primary-400 shrink-0" />
          <span className={displayText ? 'text-white font-medium' : 'text-dark-500'}>
            {displayText || placeholder}
          </span>
        </div>
        <Clock className="w-4 h-4 text-dark-400 shrink-0" />
      </div>

      {/* Hidden input for HTML5 form validation */}
      {required && (
        <input
          type="text"
          value={value}
          readOnly
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Date & Time Picker Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[350px] sm:w-[370px] bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl p-4 backdrop-blur-md animate-fade-in text-white">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-dark-700">
            <span className="text-sm font-semibold text-white">
              {label || 'Select Date & Time'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto text-xs border-b border-dark-700">
            <button
              type="button"
              onClick={() => applyPreset(0)}
              className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/30 text-dark-300 hover:text-white transition-colors shrink-0"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => applyPreset(30)}
              className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/30 text-dark-300 hover:text-white transition-colors shrink-0"
            >
              +30m
            </button>
            <button
              type="button"
              onClick={() => applyPreset(60)}
              className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/30 text-dark-300 hover:text-white transition-colors shrink-0"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => applyPreset(120)}
              className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/30 text-dark-300 hover:text-white transition-colors shrink-0"
            >
              +2h
            </button>
            <button
              type="button"
              onClick={() => applyPreset(1440)}
              className="px-2.5 py-1 rounded-lg bg-dark-700 hover:bg-primary-600/30 text-dark-300 hover:text-white transition-colors shrink-0"
            >
              Tomorrow
            </button>
          </div>

          {/* Month / Year Header */}
          <div className="flex items-center justify-between py-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-sm text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-3">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-dark-400 font-medium py-1">
                {d}
              </div>
            ))}
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="py-1" />
            ))}
            {/* Days of month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === viewMonth &&
                new Date().getFullYear() === viewYear;

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-primary-500 text-white font-bold shadow-md shadow-primary-500/30'
                      : isToday
                      ? 'border border-primary-500/50 text-primary-300 hover:bg-dark-700'
                      : 'text-dark-200 hover:bg-dark-700'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time Picker Controls */}
          <div className="p-3 bg-dark-900/80 rounded-xl border border-dark-700/80 mb-4">
            <div className="text-xs text-dark-400 font-medium mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary-400" />
              <span>Select Time</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              {/* Hour Select */}
              <div className="flex-1">
                <label className="text-[11px] text-dark-400 block mb-0.5">Hour</label>
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-dark-500 text-lg font-bold self-end pb-1.5">:</span>

              {/* Minute Select */}
              <div className="flex-1">
                <label className="text-[11px] text-dark-400 block mb-0.5">Minute</label>
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM / PM Toggle */}
              <div className="flex-1">
                <label className="text-[11px] text-dark-400 block mb-0.5">Period</label>
                <div className="flex rounded-lg overflow-hidden border border-dark-600">
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('AM')}
                    className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                      selectedAmPm === 'AM'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-800 text-dark-400 hover:text-white'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAmPm('PM')}
                    className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                      selectedAmPm === 'PM'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-800 text-dark-400 hover:text-white'
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Selection Summary and OK / Done Button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 rounded-xl text-xs text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDone}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-xs font-bold shadow-lg shadow-green-500/25 transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              Done / OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
