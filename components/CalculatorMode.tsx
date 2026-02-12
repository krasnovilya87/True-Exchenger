
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SUPPORTED_CURRENCIES, MOCK_CB_RATES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatDisplay = (val: string) => {
  if (!val) return '0';
  if (/^\d*\.?\d*$/.test(val)) {
    const [integer, fraction] = val.split('.');
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fraction !== undefined ? `${formattedInteger}.${fraction}` : formattedInteger;
  }
  return val.replace(/\*/g, '×').replace(/\//g, '÷');
};

type ActiveField = 'A' | 'B' | 'USD' | 'Spread';

export const CalculatorMode: React.FC = () => {
  const savedCurrA = localStorage.getItem('currA') || 'IDR';
  const savedCurrB = localStorage.getItem('currB') || 'RUB';
  const savedSpread = localStorage.getItem('spreadInput') || '';

  const [currA, setCurrA] = useState(savedCurrA);
  const [currB, setCurrB] = useState(savedCurrB);
  
  const [valA, setValA] = useState<string>('2000000');
  const [valB, setValB] = useState<string>('');
  const [valUSD, setValUSD] = useState<string>('');
  const [spreadInput, setSpreadInput] = useState<string>(savedSpread);
  
  const [rates, setRates] = useState<Record<string, number>>(MOCK_CB_RATES);
  const [activeField, setActiveField] = useState<ActiveField>('A');

  useEffect(() => {
    localStorage.setItem('currA', currA);
    localStorage.setItem('currB', currB);
  }, [currA, currB]);

  useEffect(() => {
    localStorage.setItem('spreadInput', spreadInput);
  }, [spreadInput]);

  const fetchLiveRates = async () => {
    try {
      const prompt = `Find CURRENT OFFICIAL CENTRAL BANK and MARKET exchange rates:
      CBR (Russia) for USD/RUB, BI (Indonesia) for USD/IDR.
      Market rates for RUB/IDR, USD/RUB, USD/IDR, USD/THB, USD/TRY, USD/GEL.
      Format: PAIR: VALUE. Focus on IDR/RUB and RUB/IDR.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text = response.text || '';
      const newRates = { ...rates };
      const matches = text.matchAll(/([A-Z]{3})[\/\-s]+([A-Z]{3})[:\s\=]+(\d+\.?\d*)/gi);
      let found = false;
      for (const m of matches) {
        newRates[`${m[1].toUpperCase()}/${m[2].toUpperCase()}`] = parseFloat(m[3]);
        found = true;
      }
      if (found) setRates(newRates);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 600000);
    return () => clearInterval(interval);
  }, []);

  const cbRate = useMemo(() => {
    const pair = `${currA}/${currB}`;
    const inv = `${currB}/${currA}`;
    if (rates[pair]) return rates[pair];
    if (rates[inv]) return 1 / rates[inv];
    const getUsd = (t: string) => t === 'USD' ? 1 : (rates[`USD/${t}`] || (rates[`${t}/USD`] ? 1 / rates[`${t}/USD`] : null));
    const rA = getUsd(currA), rB = getUsd(currB);
    return (rA && rB) ? rB / rA : MOCK_CB_RATES[pair] || 1;
  }, [currA, currB, rates]);

  const spreadVal = parseFloat(spreadInput) || 0;
  const effectiveRate = cbRate * (1 + spreadVal / 100);
  const usdRateA = currA === 'USD' ? 1 : (rates[`USD/${currA}`] || (rates[`${currA}/USD`] ? 1 / rates[`${currA}/USD`] : 1));

  const evaluate = (expr: string): string => {
    try {
      const cleaned = expr.replace(/[^-0-9+*/.]/g, '');
      if (!cleaned) return '0';
      const result = new Function(`return ${cleaned}`)();
      return isFinite(result) ? result.toString() : '0';
    } catch (e) {
      return '0';
    }
  };

  const syncAll = (val: string, field: ActiveField) => {
    const isExpression = /[+\-*/]/.test(val);
    const numericValue = isExpression ? parseFloat(evaluate(val)) : (parseFloat(val) || 0);

    if (field === 'A') {
      setValA(val);
      setValB((numericValue * effectiveRate).toFixed(2));
      setValUSD((numericValue / usdRateA).toFixed(2));
    } else if (field === 'B') {
      setValB(val);
      const a = numericValue / effectiveRate;
      setValA(a.toFixed(0));
      setValUSD((a / usdRateA).toFixed(2));
    } else if (field === 'USD') {
      setValUSD(val);
      const a = numericValue * usdRateA;
      setValA(a.toFixed(0));
      setValB((a * effectiveRate).toFixed(2));
    } else if (field === 'Spread') {
      setSpreadInput(val);
      const currentNumericA = parseFloat(evaluate(valA)) || 0;
      setValB((currentNumericA * effectiveRate).toFixed(2));
      setValUSD((currentNumericA / usdRateA).toFixed(2));
    }
  };

  useEffect(() => { 
    const currentVal = activeField === 'A' ? valA : activeField === 'B' ? valB : activeField === 'USD' ? valUSD : spreadInput;
    syncAll(currentVal, activeField);
  }, [effectiveRate, currA, currB, usdRateA]);

  const handleKeyPress = (key: string) => {
    let current = '';
    if (activeField === 'A') current = valA;
    else if (activeField === 'B') current = valB;
    else if (activeField === 'USD') current = valUSD;
    else if (activeField === 'Spread') current = spreadInput;

    if (key === 'BACK') {
      current = current.slice(0, -1);
    } else if (key === 'C') {
      current = '';
    } else if (key === '=') {
      current = evaluate(current);
    } else if (key === '%') {
      const segments = current.split(/[+\-*/]/);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment !== '') {
        const val = parseFloat(lastSegment) / 100;
        current = current.slice(0, -lastSegment.length) + val.toString();
      }
    } else if (['+', '-', '*', '/'].includes(key)) {
      if (current === '' && key !== '-') return;
      if (['+', '-', '*', '/'].includes(current.slice(-1))) {
        current = current.slice(0, -1) + key;
      } else {
        current += key;
      }
    } else if (key === '.') {
      const segments = current.split(/[+\-*/]/);
      const lastSegment = segments[segments.length - 1];
      if (!lastSegment.includes('.')) current += '.';
    } else if (key === '000') {
      const segments = current.split(/[+\-*/]/);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment !== '' && lastSegment !== '0') current += '000';
    } else {
      const segments = current.split(/[+\-*/]/);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment === '0' && key !== '.') current = current.slice(0, -1) + key;
      else current += key;
    }
    syncAll(current, activeField);
  };

  const invEffectiveRate = useMemo(() => effectiveRate !== 0 ? 1 / effectiveRate : 0, [effectiveRate]);
  const displaySpread = spreadInput === '' ? '0' : spreadInput;

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden">
      {/* bank card rate Control - At Top */}
      <div 
        onClick={() => setActiveField('Spread')}
        className={`bg-white rounded-2xl p-3 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all cursor-pointer flex-shrink-0 ${activeField === 'Spread' ? 'bg-slate-50 ring-2 ring-slate-900/20' : ''}`}
      >
        <div className="flex items-center gap-1">
          <span className={`text-base font-normal transition-colors ${activeField === 'Spread' ? 'text-slate-900' : 'text-slate-900'}`}>{spreadInput || '0'}</span>
          <span className="text-slate-300 font-normal">%</span>
        </div>
        <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest text-right">bank card rate</span>
      </div>

      {/* Inputs Section */}
      <div className="space-y-2 flex-shrink-0">
        <InputRow 
          label={currA} value={valA} active={activeField === 'A'} 
          onClick={() => setActiveField('A')} sub={`1 ${currA} = ${effectiveRate.toFixed(4)} ${currB} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrA} currentCurrency={currA}
        />
        <InputRow 
          label={currB} value={valB} active={activeField === 'B'} 
          onClick={() => setActiveField('B')} sub={`1 ${currB} = ${invEffectiveRate.toFixed(4)} ${currA} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrB} currentCurrency={currB}
        />
        <InputRow 
          label="USD" value={valUSD} active={activeField === 'USD'} 
          onClick={() => setActiveField('USD')} sub={`1 USD = ${usdRateA.toFixed(2)} ${currA}`}
          readOnly 
        />
      </div>

      {/* Calculator Keypad */}
      <div className="flex-grow grid grid-cols-4 gap-2 pb-2">
        {/* Row 1 */}
        <Key val="C" onClick={handleKeyPress} variant="clear" />
        <Key val="BACK" onClick={handleKeyPress} variant="utility" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 002-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        } />
        <Key val="%" onClick={handleKeyPress} variant="utility" />
        <Key val="/" label="÷" onClick={handleKeyPress} variant="operator" />
        
        {/* Row 2 */}
        <Key val="7" onClick={handleKeyPress} />
        <Key val="8" onClick={handleKeyPress} />
        <Key val="9" onClick={handleKeyPress} />
        <Key val="*" label="×" onClick={handleKeyPress} variant="operator" />
        
        {/* Row 3 */}
        <Key val="4" onClick={handleKeyPress} />
        <Key val="5" onClick={handleKeyPress} />
        <Key val="6" onClick={handleKeyPress} />
        <Key val="-" label="-" onClick={handleKeyPress} variant="operator" />
        
        {/* Row 4 */}
        <Key val="1" onClick={handleKeyPress} />
        <Key val="2" onClick={handleKeyPress} />
        <Key val="3" onClick={handleKeyPress} />
        <Key val="+" label="+" onClick={handleKeyPress} variant="operator" />
        
        {/* Row 5 */}
        <Key val="." onClick={handleKeyPress} />
        <Key val="0" onClick={handleKeyPress} />
        <Key val="000" onClick={handleKeyPress} />
        <Key val="=" onClick={handleKeyPress} variant="operator" />
      </div>
    </div>
  );
};

interface KeyProps {
  val: string;
  label?: string;
  onClick: (v: string) => void;
  variant?: 'number' | 'operator' | 'utility' | 'clear' | 'primary';
  span?: string;
  icon?: React.ReactNode;
}

const Key = ({ val, label, onClick, variant = 'number', span, icon }: KeyProps) => {
  const styles = {
    number: "bg-white text-slate-900 shadow-[0_2px_0_0_#e2e8f0] active:shadow-none active:translate-y-[1px]",
    operator: "bg-slate-100 text-slate-600 shadow-[0_2px_0_0_#cbd5e1] active:shadow-none active:translate-y-[1px]",
    utility: "bg-slate-50 text-slate-500 shadow-[0_2px_0_0_#cbd5e1] active:shadow-none active:translate-y-[1px]",
    clear: "bg-slate-200 text-slate-600 shadow-[0_2px_0_0_#cbd5e1] active:shadow-none active:translate-y-[1px]",
    primary: "bg-slate-900 text-white shadow-[0_2px_0_0_#000000] active:shadow-none active:translate-y-[1px]",
  };

  return (
    <button
      onClick={() => onClick(val)}
      className={`${span || 'col-span-1'} flex items-center justify-center text-[19px] font-normal rounded-2xl transition-all active:scale-[0.98] ${styles[variant]}`}
    >
      {icon || label || val}
    </button>
  );
};

const InputRow = ({ label, value, active, onClick, sub, onCurrencyChange, currentCurrency, readOnly }: any) => {
  const flag = SUPPORTED_CURRENCIES.find(c => c.code === currentCurrency)?.flag || '🇺🇸';
  
  return (
    <div 
      onClick={onClick}
      className={`relative px-4 py-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.03)] ${active ? 'bg-slate-50 ring-2 ring-slate-900/20' : 'bg-white'}`}
    >
      <div className="flex flex-col overflow-hidden">
        <span className={`text-[26px] font-normal truncate transition-colors ${active ? 'text-slate-900' : 'text-slate-900'}`}>
          {formatDisplay(value)}
        </span>
        <span className="text-[10px] text-slate-400 uppercase font-normal tracking-tight mt-0.5 opacity-80">
          {sub}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <div className={`px-2.5 py-2 rounded-xl flex items-center gap-1.5 min-w-[70px] justify-center shadow-sm transition-colors ${active ? 'bg-slate-200/50' : 'bg-slate-50'}`}>
          <span className="text-lg leading-none">{readOnly ? '🇺🇸' : flag}</span>
          <span className="text-[13px] font-normal text-slate-800">{label}</span>
        </div>
        {!readOnly && (
          <select 
            className="absolute right-0 opacity-0 w-24 h-full cursor-pointer"
            value={currentCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
      </div>
    </div>
  );
};
