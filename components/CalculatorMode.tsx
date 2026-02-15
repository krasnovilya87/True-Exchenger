
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  return val.replace(/\*/g, '×').replace(/\/ /g, '÷');
};

interface HistoryItem {
  id: string;
  fromCurr: string;
  fromVal: string;
  toCurr: string;
  toVal: string;
  spread: string;
  timestamp: number;
}

type ActiveField = 'A' | 'B' | 'USD' | 'Spread';

export const CalculatorMode: React.FC = () => {
  const savedCurrA = localStorage.getItem('currA') || 'IDR';
  const savedCurrB = localStorage.getItem('currB') || 'RUB';
  const savedSpread = localStorage.getItem('spreadInput') || '0';
  const savedHistory = JSON.parse(localStorage.getItem('exchangeHistory') || '[]');
  const savedRates = JSON.parse(localStorage.getItem('cachedRates') || 'null');

  const [currA, setCurrA] = useState(savedCurrA);
  const [currB, setCurrB] = useState(savedCurrB);
  
  const [valA, setValA] = useState<string>('2000000');
  const [valB, setValB] = useState<string>('');
  const [valUSD, setValUSD] = useState<string>('');
  const [spreadInput, setSpreadInput] = useState<string>(savedSpread);
  
  const [history, setHistory] = useState<HistoryItem[]>(savedHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [isCalcMode, setIsCalcMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [rates, setRates] = useState<Record<string, number>>(savedRates || MOCK_CB_RATES);
  const [activeField, setActiveField] = useState<ActiveField>('A');
  const [isNewEntry, setIsNewEntry] = useState<boolean>(true);

  // Refs for auto-save on close
  const stateRef = useRef({ valA, valB, currA, currB, spreadInput });
  useEffect(() => {
    stateRef.current = { valA, valB, currA, currB, spreadInput };
  }, [valA, valB, currA, currB, spreadInput]);

  useEffect(() => {
    localStorage.setItem('currA', currA);
    localStorage.setItem('currB', currB);
  }, [currA, currB]);

  useEffect(() => {
    localStorage.setItem('spreadInput', spreadInput);
  }, [spreadInput]);

  useEffect(() => {
    localStorage.setItem('exchangeHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('cachedRates', JSON.stringify(rates));
  }, [rates]);

  const handleSelectField = (field: ActiveField) => {
    setActiveField(field);
    setIsNewEntry(true);
  };

  const fetchLiveRates = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const prompt = `Find live exchange rates for: USD/${currA}, USD/${currB}, ${currA}/${currB}.
      Output strictly in this format "PAIR: RATE" using decimals. 
      Example: "USD/EUR: 0.95". Use google search to get current prices.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }],
          temperature: 0.1
        },
      });

      const text = response.text || '';
      const newRates: Record<string, number> = {};
      const matches = text.matchAll(/([A-Z]{3})\s*[\/\-]\s*([A-Z]{3})\s*[:=]\s*([\d\s,]+\.?\d*)/gi);
      
      let foundCount = 0;
      for (const m of matches) {
        let rawVal = m[3].trim().replace(/\s/g, '').replace(/,/g, '.');
        const parsedValue = parseFloat(rawVal);
        if (!isNaN(parsedValue) && parsedValue > 0) {
          newRates[`${m[1].toUpperCase()}/${m[2].toUpperCase()}`] = parsedValue;
          foundCount++;
        }
      }

      if (foundCount > 0) {
        setRates(prev => ({ ...prev, ...newRates }));
      }
    } catch (e) {
      console.warn("Failed to update rates via Search. Using cached/mock rates.", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [currA, currB, isRefreshing]);

  // Initial fetch and on currency change
  useEffect(() => {
    fetchLiveRates();
  }, [currA, currB]);

  // Regular periodic updates (every 5 mins)
  useEffect(() => {
    const interval = setInterval(fetchLiveRates, 300000);
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

  const usdRateA = useMemo(() => {
    if (currA === 'USD') return 1;
    const direct = rates[`USD/${currA}`];
    if (direct) return direct;
    const inverted = rates[`${currA}/USD`];
    if (inverted) return 1 / inverted;
    return MOCK_CB_RATES[`USD/${currA}`] || 1;
  }, [currA, rates]);

  const usdRateB = useMemo(() => {
    if (currB === 'USD') return 1;
    const direct = rates[`USD/${currB}`];
    if (direct) return direct;
    const inverted = rates[`${currB}/USD`];
    if (inverted) return 1 / inverted;
    return MOCK_CB_RATES[`USD/${currB}`] || 1;
  }, [currB, rates]);

  const spreadValue = parseFloat(spreadInput) || 0;
  const spreadMultiplier = 1 + spreadValue / 100;
  const effectiveRate = cbRate * spreadMultiplier;

  const evaluate = (expr: string): string => {
    try {
      const cleaned = expr.replace(/[^-0-9+*/.]/g, '');
      if (!cleaned) return '0';
      const result = new Function(`return ${cleaned}`)();
      return isFinite(result) ? result.toString() : '0';
    } catch (e) { return '0'; }
  };

  const calculateInstantSpread = useCallback((valAStr: string, valBStr: string, valUSDStr: string, field: ActiveField) => {
    const nA = parseFloat(evaluate(valAStr)) || 0;
    const nB = parseFloat(evaluate(valBStr)) || 0;
    const nUSD = parseFloat(evaluate(valUSDStr)) || 0;

    let computedSpread = 0;

    if (nA > 0 && nB > 0) {
      computedSpread = ((nB / nA) / cbRate - 1) * 100;
    } else if (nUSD > 0 && nB > 0) {
      computedSpread = ((nB / nUSD) / usdRateB - 1) * 100;
    } else if (nUSD > 0 && nA > 0) {
      computedSpread = ((nA / nUSD) / usdRateA - 1) * 100;
    }

    if (computedSpread !== 0) {
      setSpreadInput(computedSpread.toFixed(2));
    }
  }, [cbRate, usdRateA, usdRateB]);

  const syncAll = useCallback((val: string, field: ActiveField) => {
    if (isCalcMode) {
      let nextA = valA, nextB = valB, nextUSD = valUSD;
      if (field === 'A') { setValA(val); nextA = val; }
      else if (field === 'B') { setValB(val); nextB = val; }
      else if (field === 'USD') { setValUSD(val); nextUSD = val; }
      else if (field === 'Spread') { setSpreadInput(val); }
      
      calculateInstantSpread(nextA, nextB, nextUSD, field);
      return;
    }

    const isExpression = /[+\-*/]/.test(val);
    const numericValue = isExpression ? parseFloat(evaluate(val)) : (parseFloat(val) || 0);

    if (field === 'A') {
      setValA(val);
      setValB((numericValue * effectiveRate).toFixed(2));
      setValUSD(((numericValue / usdRateA) * spreadMultiplier).toFixed(2));
    } else if (field === 'B') {
      setValB(val);
      const a = numericValue / effectiveRate;
      setValA(a.toFixed(0));
      setValUSD(((numericValue / usdRateB) * spreadMultiplier).toFixed(2));
    } else if (field === 'USD') {
      setValUSD(val);
      const baseUSD = numericValue / spreadMultiplier;
      const a = baseUSD * usdRateA;
      setValA(a.toFixed(0));
      setValB((baseUSD * usdRateB).toFixed(2));
    } else if (field === 'Spread') {
      setSpreadInput(val);
      const currentNumericA = parseFloat(evaluate(valA)) || 0;
      const currentSpread = parseFloat(val) || 0;
      const currentMultiplier = 1 + currentSpread / 100;
      setValB((currentNumericA * cbRate * currentMultiplier).toFixed(2));
      setValUSD(((currentNumericA / usdRateA) * currentMultiplier).toFixed(2));
    }
  }, [cbRate, effectiveRate, spreadMultiplier, usdRateA, usdRateB, valA, valB, valUSD, isCalcMode, calculateInstantSpread]);

  useEffect(() => { 
    if (isCalcMode) return;
    const currentVal = activeField === 'A' ? valA : activeField === 'B' ? valB : activeField === 'USD' ? valUSD : spreadInput;
    syncAll(currentVal, activeField);
  }, [effectiveRate, currA, currB, usdRateA, usdRateB, syncAll, activeField, isCalcMode]);

  const handleCalcToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCalcMode(!isCalcMode);
  };

  const saveToHistory = useCallback(() => {
    const fromVal = evaluate(valA);
    const toVal = evaluate(valB);
    
    if (parseFloat(fromVal) === 0 || parseFloat(toVal) === 0 || !fromVal || !toVal) return;

    if (history.length > 0) {
      const last = history[0];
      if (last.fromVal === fromVal && last.toVal === toVal && last.fromCurr === currA && last.toCurr === currB) return;
    }

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      fromCurr: currA,
      fromVal: fromVal,
      toCurr: currB,
      toVal: toVal,
      spread: spreadInput || '0',
      timestamp: Date.now(),
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50));
  }, [valA, valB, currA, currB, spreadInput, history]);

  useEffect(() => {
    const handleUnload = () => {
      const { valA, valB, currA, currB, spreadInput } = stateRef.current;
      const fromVal = evaluate(valA);
      const toVal = evaluate(valB);
      if (parseFloat(fromVal) > 0 && parseFloat(toVal) > 0) {
        const h = JSON.parse(localStorage.getItem('exchangeHistory') || '[]');
        const newItem = {
          id: Date.now().toString(),
          fromCurr: currA, fromVal, toCurr: currB, toVal,
          spread: spreadInput || '0', timestamp: Date.now()
        };
        localStorage.setItem('exchangeHistory', JSON.stringify([newItem, ...h].slice(0, 50)));
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const clearHistory = () => {
    if (window.confirm('Очистить всю историю?')) {
      setHistory([]);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleKeyPress = (key: string) => {
    let current = activeField === 'A' ? valA : activeField === 'B' ? valB : activeField === 'USD' ? valUSD : spreadInput;

    if (isNewEntry) {
      if (!['BACK', 'C', '=', '+', '-', '*', '/', '%'].includes(key)) {
        current = '';
        setIsNewEntry(false);
      } else if (['+', '-', '*', '/', '%'].includes(key)) {
        setIsNewEntry(false);
      }
    }

    if (key === 'BACK') {
        current = current.slice(0, -1);
    } else if (key === 'C') {
        saveToHistory();
        current = '';
    } else if (key === '=') {
        current = evaluate(current);
        setTimeout(saveToHistory, 0); 
    } else if (key === '%') {
      const segments = current.split(/[+\-*/]/);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment !== '') {
        const val = parseFloat(lastSegment) / 100;
        current = current.slice(0, -lastSegment.length) + val.toString();
      }
    } else if (['+', '-', '*', '/'].includes(key)) {
      if (current === '' && key !== '-') return;
      if (['+', '-', '*', '/'].includes(current.slice(-1))) current = current.slice(0, -1) + key;
      else current += key;
    } else if (key === '.') {
      const segments = current.split(/[+\-*/]/);
      if (!segments[segments.length - 1].includes('.')) current += '.';
    } else if (key === '000') {
      const segments = current.split(/[+\-*/]/);
      const last = segments[segments.length - 1];
      if (last !== '' && last !== '0') current += '000';
    } else {
      const segments = current.split(/[+\-*/]/);
      if (segments[segments.length - 1] === '0' && key !== '.') current = current.slice(0, -1) + key;
      else current += key;
    }
    syncAll(current, activeField);
  };

  const invEffectiveRate = useMemo(() => effectiveRate !== 0 ? 1 / effectiveRate : 0, [effectiveRate]);
  const displaySpread = spreadInput || '0';

  return (
    <div className="flex flex-col h-full space-y-3 overflow-hidden relative font-normal">
      {/* Spread/Bank Fee Header */}
      <div 
        onClick={() => handleSelectField('Spread')}
        className={`bg-white rounded-2xl p-4 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all cursor-pointer flex-shrink-0 ${activeField === 'Spread' ? 'bg-slate-50 ring-2 ring-slate-900/20' : ''}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[20px] font-normal text-slate-900">{spreadInput || '0'}</span>
          <span className="text-slate-400 font-normal text-md">%</span>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            {isRefreshing && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />}
            <span className="text-[12px] font-normal text-slate-400 uppercase tracking-widest text-right">bank fee</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={handleCalcToggle}
              className={`text-[10px] font-normal uppercase tracking-[0.1em] px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1.5 ${isCalcMode ? 'text-blue-600 bg-blue-50 ring-1 ring-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isCalcMode ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
              Calc
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-shrink-0">
        <InputRow 
          label={currA} value={valA} active={activeField === 'A'} size="large"
          onClick={() => handleSelectField('A')} sub={`1 ${currA} = ${effectiveRate.toFixed(4)} ${currB} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrA} currentCurrency={currA}
        />
        <InputRow 
          label={currB} value={valB} active={activeField === 'B'} size="large"
          onClick={() => handleSelectField('B')} sub={`1 ${currB} = ${invEffectiveRate.toFixed(4)} ${currA} (incl ${displaySpread}%)`}
          onCurrencyChange={setCurrB} currentCurrency={currB}
        />
        <InputRow 
          label="USD" value={valUSD} active={activeField === 'USD'} size="small"
          onClick={() => handleSelectField('USD')} sub={`1 USD = ${(usdRateA / (1 + (parseFloat(spreadInput)||0)/100)).toFixed(2)} ${currA} (incl ${displaySpread}%)`}
          readOnly 
        />
      </div>

      <div className="flex items-center justify-between px-2">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="text-slate-400 text-xs uppercase tracking-widest flex items-center gap-1 font-normal"
        >
          History ({history.length})
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {history.length > 0 && showHistory && (
          <button onClick={clearHistory} className="text-red-400 text-[10px] uppercase tracking-widest font-normal">Clear</button>
        )}
      </div>

      {showHistory ? (
        <div className="flex-grow bg-white/50 rounded-2xl overflow-y-auto px-2 py-1 space-y-2 mb-2 custom-scrollbar font-normal">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-300 text-sm font-normal">No history yet</div>
          ) : (
            history.map(item => (
              <div 
                key={item.id} 
                className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group"
              >
                <div className="flex flex-col">
                  <div className="text-slate-800 text-sm font-normal">
                    {formatDisplay(item.fromVal)} <span className="text-slate-400 text-xs">{item.fromCurr}</span>
                    <span className="mx-2 text-slate-300">→</span>
                    {formatDisplay(item.toVal)} <span className="text-slate-400 text-xs">{item.toCurr}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(item.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-[10px] text-blue-500 font-medium bg-blue-50 px-1.5 py-0.5 rounded-full ring-1 ring-blue-100">
                      {item.spread}% bank fee
                    </span>
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteHistoryItem(item.id, e)}
                  className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-grow grid grid-cols-4 gap-2 pb-2 max-h-[40%] font-normal">
          <Key val="C" onClick={handleKeyPress} variant="clear" />
          <Key val="BACK" onClick={handleKeyPress} variant="utility" icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 002-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          } />
          <Key val="%" onClick={handleKeyPress} variant="utility" />
          <Key val="/" label="÷" onClick={handleKeyPress} variant="operator" />
          <Key val="7" onClick={handleKeyPress} /><Key val="8" onClick={handleKeyPress} /><Key val="9" onClick={handleKeyPress} /><Key val="*" label="×" onClick={handleKeyPress} variant="operator" />
          <Key val="4" onClick={handleKeyPress} /><Key val="5" onClick={handleKeyPress} /><Key val="6" onClick={handleKeyPress} /><Key val="-" label="-" onClick={handleKeyPress} variant="operator" />
          <Key val="1" onClick={handleKeyPress} /><Key val="2" onClick={handleKeyPress} /><Key val="3" onClick={handleKeyPress} /><Key val="+" label="+" onClick={handleKeyPress} variant="operator" />
          <Key val="." onClick={handleKeyPress} /><Key val="0" onClick={handleKeyPress} /><Key val="000" onClick={handleKeyPress} /><Key val="=" onClick={handleKeyPress} variant="operator" />
        </div>
      )}
    </div>
  );
};

const Key = ({ val, label, onClick, variant = 'number', icon }: { val: string; label?: string; onClick: (v: string) => void; variant?: string; icon?: React.ReactNode }) => {
  const styles: Record<string, string> = {
    number: "bg-white text-slate-900 shadow-[0_2px_0_0_#e2e8f0]",
    operator: "bg-slate-100 text-slate-600 shadow-[0_2px_0_0_#cbd5e1]",
    utility: "bg-slate-50 text-slate-500 shadow-[0_2px_0_0_#cbd5e1]",
    clear: "bg-slate-200 text-slate-600 shadow-[0_2px_0_0_#cbd5e1]",
  };
  return (
    <button onClick={() => onClick(val)} className={`flex items-center justify-center text-[17px] font-normal rounded-2xl transition-all active:scale-[0.98] active:translate-y-[1px] ${styles[variant || 'number']} py-2`}>
      {icon || label || val}
    </button>
  );
};

const InputRow = ({ label, value, active, onClick, sub, onCurrencyChange, currentCurrency, readOnly, size = 'small' }: any) => {
  const flag = SUPPORTED_CURRENCIES.find(c => c.code === currentCurrency)?.flag || '🇺🇸';
  const isLarge = size === 'large';
  return (
    <div onClick={onClick} className={`relative px-5 transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-between ${isLarge ? 'py-5' : 'py-3'} ${active ? 'bg-slate-50 ring-2 ring-slate-900/20' : 'bg-white'}`}>
      <div className="flex flex-col overflow-hidden max-w-[65%]">
        <span className={`font-normal truncate leading-tight ${isLarge ? 'text-[34px]' : 'text-[24px]'} text-slate-900`}>{formatDisplay(value)}</span>
        <span className="text-[10px] text-slate-400 uppercase font-normal tracking-tight mt-1 opacity-80">{sub}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`rounded-xl flex items-center gap-1.5 justify-center shadow-sm ${active ? 'bg-slate-200/50' : 'bg-slate-50'} ${isLarge ? 'px-3 py-2.5 min-w-[85px]' : 'px-2 py-2 min-w-[75px]'}`}>
          <span className={isLarge ? 'text-xl' : 'text-lg'}>{readOnly ? '🇺🇸' : flag}</span>
          <span className={`font-normal text-slate-800 ${isLarge ? 'text-[20px]' : 'text-[16px]'}`}>{label}</span>
        </div>
        {!readOnly && (
          <select className="absolute right-0 opacity-0 w-24 h-full cursor-pointer" value={currentCurrency} onChange={(e) => onCurrencyChange?.(e.target.value)}>
            {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
      </div>
    </div>
  );
};
