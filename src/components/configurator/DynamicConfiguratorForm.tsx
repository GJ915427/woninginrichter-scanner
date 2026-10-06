'use client';

import React, { useState, useEffect } from 'react';
import { SearchResultItem } from '@/types/product';
import {
  ConfiguratorSchema,
  ConfiguratorField,
  ProductConfigValues,
  ProductCategory
} from '@/types/configurator';
import { resolveConfiguratorSchema } from '@/domain/configurator/field-resolver';

export interface DynamicConfiguratorFormProps {
  product: SearchResultItem;
  onChange?: (values: ProductConfigValues) => void;
  className?: string;
}

export function DynamicConfiguratorForm({
  product,
  onChange,
  className = ''
}: DynamicConfiguratorFormProps) {
  const schema: ConfiguratorSchema = resolveConfiguratorSchema(product);

  // Initialiseer state met default waarden
  const [formValues, setFormValues] = useState<ProductConfigValues>(() => {
    const initial: ProductConfigValues = {};
    for (const field of schema.fields) {
      if (field.defaultValue !== undefined) {
        initial[field.key] = field.defaultValue;
      } else if (field.type === 'number') {
        initial[field.key] = '';
      } else if (field.type === 'select' && field.options && field.options.length > 0) {
        initial[field.key] = field.options[0].value;
      } else {
        initial[field.key] = '';
      }
    }
    return initial;
  });

  // Reset formulier als een ander product wordt geselecteerd
  useEffect(() => {
    const initial: ProductConfigValues = {};
    for (const field of schema.fields) {
      if (field.defaultValue !== undefined) {
        initial[field.key] = field.defaultValue;
      } else if (field.type === 'number') {
        initial[field.key] = '';
      } else if (field.type === 'select' && field.options && field.options.length > 0) {
        initial[field.key] = field.options[0].value;
      } else {
        initial[field.key] = '';
      }
    }
    setFormValues(initial);
    if (onChange) onChange(initial);
  }, [product.id]);

  const handleInputChange = (key: string, value: string | number | boolean) => {
    const nextValues = { ...formValues, [key]: value };
    setFormValues(nextValues);
    if (onChange) {
      onChange(nextValues);
    }
  };

  const getCategoryTheme = (category: ProductCategory) => {
    switch (category) {
      case 'raamdecoratie':
        return {
          badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          border: 'border-blue-900/50',
          accent: 'text-blue-400'
        };
      case 'gordijnen':
        return {
          badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          border: 'border-purple-900/50',
          accent: 'text-purple-400'
        };
      case 'vloeren':
        return {
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          border: 'border-amber-900/50',
          accent: 'text-amber-400'
        };
      case 'algemeen':
      default:
        return {
          badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
          border: 'border-slate-800',
          accent: 'text-slate-300'
        };
    }
  };

  const theme = getCategoryTheme(schema.category);

  return (
    <div className={`w-full bg-slate-950/80 border ${theme.border} rounded-2xl p-6 shadow-2xl ${className}`}>
      {/* Formulier Kop & Categorie Herkenning */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${theme.badge}`}>
              {schema.categoryLabel}
            </span>
            <span className="text-xs text-slate-400">
              Artikel: <strong className="text-white">{product.name}</strong> ({product.code})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{schema.description}</p>
        </div>

        <div className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 self-start sm:self-center">
          ERP Groep: <span className="text-slate-200 font-medium">{product.salesGroup}</span>
        </div>
      </div>

      {/* Dynamisch Invoervelden Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {schema.fields.map((field: ConfiguratorField) => {
          const val = formValues[field.key] ?? '';

          if (field.type === 'select') {
            return (
              <div key={field.key} className="flex flex-col">
                <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>{field.label} {field.required && <span className="text-rose-400">*</span>}</span>
                </label>
                <select
                  value={String(val)}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {field.helpText && <span className="text-[11px] text-slate-500 mt-1">{field.helpText}</span>}
              </div>
            );
          }

          if (field.type === 'number') {
            return (
              <div key={field.key} className="flex flex-col">
                <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>{field.label} {field.required && <span className="text-rose-400">*</span>}</span>
                  {field.unit && <span className="text-slate-400 font-mono text-[11px]">in {field.unit}</span>}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={val === '' ? '' : Number(val)}
                    onChange={(e) => {
                      const num = e.target.value === '' ? '' : Number(e.target.value);
                      handleInputChange(field.key, num);
                    }}
                    min={field.min}
                    max={field.max}
                    step={field.step || 1}
                    placeholder={field.placeholder}
                    className="w-full pl-3.5 pr-12 py-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition font-mono"
                  />
                  {field.unit && (
                    <span className="absolute right-3.5 text-xs text-slate-400 pointer-events-none font-semibold">
                      {field.unit}
                    </span>
                  )}
                </div>
                {field.helpText && <span className="text-[11px] text-slate-500 mt-1">{field.helpText}</span>}
              </div>
            );
          }

          return (
            <div key={field.key} className="flex flex-col sm:col-span-2">
              <label className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>{field.label} {field.required && <span className="text-rose-400">*</span>}</span>
              </label>
              <input
                type="text"
                value={String(val)}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-3.5 py-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
              />
              {field.helpText && <span className="text-[11px] text-slate-500 mt-1">{field.helpText}</span>}
            </div>
          );
        })}
      </div>

      {/* Live Formulier Specificatie Kaart (Vorm Validatie) */}
      <div className="mt-6 pt-5 border-t border-slate-800">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Actieve Maatwerk Specificatie
        </h4>
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex flex-wrap gap-3 text-xs">
          {schema.fields.map((field) => {
            const rawVal = formValues[field.key];
            let displayVal = rawVal;

            if (field.type === 'select' && field.options) {
              const opt = field.options.find(o => o.value === rawVal);
              displayVal = opt ? opt.label : rawVal;
            }

            const isFilled = rawVal !== '' && rawVal !== undefined;

            return (
              <div
                key={field.key}
                className={`px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 ${
                  isFilled
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                    : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                }`}
              >
                <span className="text-slate-400">{field.label}:</span>
                <strong className={isFilled ? 'text-white' : 'text-rose-400 font-normal italic'}>
                  {isFilled ? `${displayVal}${field.unit ? ` ${field.unit}` : ''}` : 'Nog in te vullen'}
                </strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
