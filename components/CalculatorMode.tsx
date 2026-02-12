
import React, { useState, useEffect, useMemo } from 'react';
import { SUPPORTED_CURRENCIES, MOCK_CB_RATES } from '../constants';

const formatNumber = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString();
  const [integer, fraction] = str.split('.');
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction !== undefined ? `${formattedInteger}.${fraction}` : formattedInteger;
};

const parseNumber = (val: string) => {
  return val.replace(/\s/g, '').replace(',', '.');
};

export const CalculatorMode: React.FC = () => {
  const [currA, setCurrA] = useState('IDR');
  const [currB, setCurrB] = useState('RUB');
  const [valA, setValA] = useState<string>('2000000');
  const [valB, setValB] = useState<string>('');
  const [valUSD, setValUSD] = useState<string>('');
  const [spread, setSpread] = useState<number>(2.5);

  const cbRate = useMemo(() => {
    const pair = `${currA}/${currB}`;
    const reversePair = `${currB}/${currA}`;
    if (MOCK_CB_RATES[pair]) return MOCK_CB_RATES[pair];
    if (MOCK_CB_RATES[reversePair]) return 1 / MOCK_CB_RATES[reversePair];
    return 1;
  }, [currA, currB]);

  const effectiveRate = useMemo(() => {
    return cbRate * (1 + spread / 100);
  }, [cbRate, spread]);

  const usdRateA = useMemo(() => {
    if (currA === 'USD') return 1;
    return MOCK_CB_RATES[`USD/${currA}`] || 1;
  }, [currA]);

  const updateAllFromA = (v: string) => {
    const clean = parseNumber(v);
    setValA(clean);
    const num = parseFloat(clean) || 0;
    setValB((num * effectiveRate).toFixed(2));
    setValUSD((num / usdRateA).toFixed(2));
  };

  const updateAllFromB = (v: string) => {
    const clean = parseNumber(v);
    setValB(clean);
    const num = parseFloat(clean) || 0;
    const aVal = num / effectiveRate;
    setValA(aVal.toFixed(0));
    setValUSD((aVal / usdRateA).toFixed(2));
  };

  const updateAllFromUSD = (v: string) => {
    const clean = parseNumber(v);
    setValUSD(clean);
    const num = parseFloat(clean) || 0;
    const aVal = num * usdRateA;
    setValA(aVal.toFixed(0));
    setValB((aVal * effectiveRate).toFixed(2));
  };

  useEffect(() => {
    updateAllFromA(valA);
  }, [effectiveRate, currA, currB]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Main Input Cards */}
      <div className="bg-white rounded-[28px] p-4 shadow-sm border border-slate-100 space-y-3">
        <InputBlock 
          value={valA} 
          onChange={updateAllFromA} 
          currency={currA} 
          onCurrencyChange={setCurrA}
        />
        <InputBlock 
          value={valB} 
          onChange={updateAllFromB} 
          currency={currB} 
          onCurrencyChange={setCurrB}
        />
        <InputBlock 
          value={valUSD} 
          onChange={updateAllFromUSD} 
          currency="USD" 
          isSpecial
          readOnlyCurrency
        />
      </div>

      {/* Editable Rate Markup Display */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-1 text-center">Card Rate Markup %</span>
          <div className="flex items-center justify-center gap-2">
            <input 
              type="text" 
              inputMode="decimal"
              value={formatNumber(spread)}
              onChange={(e) => {
                const clean = parseNumber(e.target.value);
                if (/^\d*\.?\d*$/.test(clean)) {
                  setSpread(parseFloat(clean) || 0);
                }
              }}
              className="bg-[#F2F4F7] text-lg font-medium text-slate-900 focus:outline-none w-20 px-3 py-1.5 rounded-xl text-center"
            />
            <span className="text-lg font-medium text-slate-300">%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputBlock = ({ value, onChange, currency, onCurrencyChange, isSpecial, readOnlyCurrency }: any) => {
  const currObj = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  
  return (
    <div className={`rounded-xl px-4 py-3 ${isSpecial ? 'bg-[#F2F4F7]' : 'bg-[#F8F9FB]'} flex items-center justify-between min-h-[72px]`}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <input 
          type="text" 
          inputMode="decimal"
          value={formatNumber(value)}
          onChange={(e) => {
            const clean = parseNumber(e.target.value);
            if (/^\d*\.?\d*$/.test(clean) || clean === '') {
              onChange(clean);
            }
          }}
          className="bg-transparent text-2xl font-medium text-slate-900 focus:outline-none w-full truncate"
          placeholder="0"
        />
      </div>
      
      <div className="relative ml-4 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl shadow-sm border border-slate-100">
          <span className="text-lg">{currObj?.flag || '🏳️'}</span>
          <span className="font-medium text-slate-800 text-sm">{currency}</span>
          {!readOnlyCurrency && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        {!readOnlyCurrency && (
          <select 
            value={currency} 
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            {SUPPORTED_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};
