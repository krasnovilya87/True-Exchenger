
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  const fetchLiveRates = useCallback(async () => {
    try {
      const prompt = `Act as a currency expert. Search Google Finance (google.com/finance) for the LATEST REAL-TIME exchange rates today.
      Provide the current official value for these specific pairs:
      - USD/${currA}
      - USD/${currB}
      - ${currA}/${currB}
      - USD/RUB, USD/IDR, USD/THB, USD/TRY, USD/GEL, EUR/USD, GBP/USD.
      
      CRITICAL: You MUST provide the full numeric value from Google Finance. If USD/IDR is 16,834.98, write "USD/IDR: 16834.98".
      DO NOT truncate thousands. DO NOT use commas as thousands separators.
      Format exactly: "PAIR: VALUE" (e.g. "USD/IDR: 16834.98").`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const text = response.text || '';
      const newRates: Record<string, number> = {};
      
      // Robust regex: Find PAIR: VALUE. Handle digits, dots, and potential separators.
      const matches = text.matchAll(/([A-Z]{3})[\/\-s]*([A-Z]{3})[:\s\=]+([\d\s,]+\.?\d*)/gi);
      
      let foundCount = 0;
      for (const m of matches) {
        let rawVal = m[3].replace(/\s/g, ''); // Remove spaces
        
        // Remove commas only if they are thousands separators (European vs US formats)
        if (rawVal.includes(',') && rawVal.includes('.')) {
          rawVal = rawVal.replace(/,/g, '');
        } else if (rawVal.includes(',')) {
          const parts = rawVal.split(',');
          // If followed by 3 digits, likely a thousands separator (e.g., 16,834)
          if (parts[parts.length-1].length === 3) {
            rawVal = rawVal.replace(/,/g, '');
          } else {
            rawVal = rawVal.replace(/,/g, '.');
          }
        }
        
        const parsedValue = parseFloat(rawVal);
        if (!isNaN(parsedValue) && parsedValue > 0) {
          const key = `${m[1].toUpperCase()}/${m[2].toUpperCase()}`;
          newRates[key] = parsedValue;
          foundCount++;
        }
      }
      
      if (foundCount > 0) {
        setRates(prev => ({ ...prev, ...newRates }));
      }
    } catch (e) {
      console.error("Error fetching live rates:", e);
    }
  }, [currA, currB]);

  useEffect(() => {
    fetchLiveRates();
    const interval = setInterval(fetchLiveRates, 600000); // Refetch every 10 mins
    return () => clearInterval(interval);
  }, [fetchLiveRates]);

  const cbRate = useMemo(() => {
    const pair = `${currA}/${currB}`;
    const inv = `${currB}/${currA}`;
    if (rates[pair]) return rates[pair];
    if (rates[inv]) return 1 / rates[inv];
    
    const getUsd = (t: string) => {
      if (t === 'USD') return 1;
      const direct = rates[`USD/${t}`];
      if (direct) return direct;
      const inverted = rates[`${t}/USD`];
      if (inverted) return 1 / inverted;
      return MOCK_CB_RATES[`USD/${t}`] || null;
    };
    
    const rA = getUsd(currA);
    const rB = getUsd(currB);
    
    if (rA && rB) return rB / rA;
    return MOCK_CB_RATES[pair] || 1;
  }, [currA, currB, rates]);

  const spreadVal = parseFloat(spreadInput) || 0;
  const effectiveRate = cbRate * (1 + spreadVal / 100);
  
  const usdRateA = useMemo(() => {
    if (currA === 'USD') return 1;
    const direct = rates[`USD/${currA}`];
    if (direct) return direct;
    const inverted = rates[`${currA}/USD`];
    if (inverted) return 1 / inverted;
    return MOCK_CB_RATES[`USD/${currA}`] || 1;
  }, [currA, rates]);

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

  const syncAll = useCallback((val: string, field: ActiveField) => {
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
  }, [effectiveRate, usdRateA, valA]);

  useEffect(() => { 
    const currentVal = activeField === 'A' ? valA : activeField === 'B' ? valB : activeField === 'USD' ? valUSD : spreadInput;
    syncAll(currentVal, activeField);
  }, [effectiveRate, currA, currB, usdRateA, syncAll, activeField]);

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
      {/* bank card rate Control */}
      <div 
        onClick={() => setActiveField('Spread')}
        className={`bg-white rounded-2xl p-4 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all cursor-pointer flex-shrink-0 ${activeField === 'Spread' ? 'bg-slate-50 ring-2 ring-slate-900/20' : ''}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[20px] font-normal transition-colors ${activeField === 'Spread' ? 'text-slate-900' : 'text-slate-900'}`}>{spreadInput || '0'}</span>
          <span className="text-slate-400 font-normal text-md">%</span>
        </div>
        <span className="text-[12px] font-normal text-slate-400 uppercase tracking-widest text-right">bank card rate</span>
      </div>

      {/* Inputs Section */}
      <div className="space-y-3 flex-shrink-0">
        <InputRow 
          label={currA} value={valA} active={activeField === 'A'} size="large"
          onClick={() => setActiveField('A')} sub={`1 ${currA} = ${effectiveRate.toFixed(4)} ${currB} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrA} currentCurrency={currA}
        />
        <InputRow 
          label={currB} value={valB} active={activeField === 'B'} size="large"
          onClick={() => setActiveField('B')} sub={`1 ${currB} = ${invEffectiveRate.toFixed(4)} ${currA} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrB} currentCurrency={currB}
        />
        <InputRow 
          label="USD" value={valUSD} active={activeField === 'USD'} size="small"
          onClick={() => setActiveField('USD')} sub={`1 USD = ${usdRateA.toFixed(2)} ${currA}`}
          readOnly 
        />
      </div>

      {/* Calculator Keypad */}
      <div className="flex-grow grid grid-cols-4 gap-2 pb-2 max-h-[40%]">
        <Key val="C" onClick={handleKeyPress} variant="clear" />
        <Key val="BACK" onClick={handleKeyPress} variant="utility" icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 002-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        } />
        <Key val="%" onClick={handleKeyPress} variant="utility" />
        <Key val="/" label="÷" onClick={handleKeyPress} variant="operator" />
        
        <Key val="7" onClick={handleKeyPress} />
        <Key val="8" onClick={handleKeyPress} />
        <Key val="9" onClick={handleKeyPress} />
        <Key val="*" label="×" onClick={handleKeyPress} variant="operator" />
        
        <Key val="4" onClick={handleKeyPress} />
        <Key val="5" onClick={handleKeyPress} />
        <Key val="6" onClick={handleKeyPress} />
        <Key val="-" label="-" onClick={handleKeyPress} variant="operator" />
        
        <Key val="1" onClick={handleKeyPress} />
        <Key val="2" onClick={handleKeyPress} />
        <Key val="3" onClick={handleKeyPress} />
        <Key val="+" label="+" onClick={handleKeyPress} variant="operator" />
        
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
      className={`${span || 'col-span-1'} flex items-center justify-center text-[17px] font-normal rounded-2xl transition-all active:scale-[0.98] ${styles[variant]} py-2`}
    >
      {icon || label || val}
    </button>
  );
};

interface InputRowProps {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  sub: string;
  onCurrencyChange?: (v: string) => void;
  currentCurrency?: string;
  readOnly?: boolean;
  size?: 'small' | 'large';
}

const InputRow = ({ label, value, active, onClick, sub, onCurrencyChange, currentCurrency, readOnly, size = 'small' }: InputRowProps) => {
  const flag = SUPPORTED_CURRENCIES.find(c => c.code === currentCurrency)?.flag || '🇺🇸';
  const isLarge = size === 'large';
  
  return (
    <div 
      onClick={onClick}
      className={`relative px-5 transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-between ${isLarge ? 'py-5' : 'py-3'} ${active ? 'bg-slate-50 ring-2 ring-slate-900/20' : 'bg-white'}`}
    >
      <div className="flex flex-col overflow-hidden max-w-[65%]">
        <span className={`font-normal truncate transition-colors leading-tight ${isLarge ? 'text-[34px]' : 'text-[24px]'} ${active ? 'text-slate-900' : 'text-slate-900'}`}>
          {formatDisplay(value)}
        </span>
        <span className="text-[10px] text-slate-400 uppercase font-normal tracking-tight mt-1 opacity-80 leading-tight">
          {sub}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`rounded-xl flex items-center gap-1.5 justify-center shadow-sm transition-colors ${active ? 'bg-slate-200/50' : 'bg-slate-50'} ${isLarge ? 'px-3 py-2.5 min-w-[85px]' : 'px-2 py-2 min-w-[75px]'}`}>
          <span className={`${isLarge ? 'text-xl' : 'text-lg'} leading-none`}>{readOnly ? '🇺🇸' : flag}</span>
          <span className={`font-normal text-slate-800 leading-none ${isLarge ? 'text-[20px]' : 'text-[16px]'}`}>{label}</span>
        </div>
        {!readOnly && (
          <select 
            className="absolute right-0 opacity-0 w-24 h-full cursor-pointer"
            value={currentCurrency}
            onChange={(e) => onCurrencyChange?.(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
      </div>
    </div>
  );
};
