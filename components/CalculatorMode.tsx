
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SUPPORTED_CURRENCIES, MOCK_CB_RATES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const [valA, setValA] = useState<string>('2 000 000');
  const [valB, setValB] = useState<string>('');
  const [valUSD, setValUSD] = useState<string>('');
  const [spreadInput, setSpreadInput] = useState<string>('0.00');
  const [rates, setRates] = useState<Record<string, number>>(MOCK_CB_RATES);

  const fetchLiveRates = async () => {
    try {
      const prompt = `Get the absolute current exchange rates from Google Finance for: 
      USD/RUB, RUB/IDR, IDR/RUB, USD/IDR, USD/THB, USD/TRY, USD/GEL, EUR/USD. 
      Return the data as a simple list: PAIR: VALUE. Focus on precision.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || '';
      const newRates = { ...rates };
      
      // Flexible regex to match any currency pair pattern like XXX/YYY: 1.234 or XXX-YYY = 1.234
      const matches = text.matchAll(/([A-Z]{3})[\/\-s]([A-Z]{3})[:\s\=]+(\d+\.?\d*)/gi);
      let foundAny = false;
      
      for (const match of matches) {
        const pair = `${match[1].toUpperCase()}/${match[2].toUpperCase()}`;
        const rateValue = parseFloat(match[3]);
        if (!isNaN(rateValue)) {
          newRates[pair] = rateValue;
          foundAny = true;
        }
      }

      if (foundAny) {
        setRates(newRates);
      }
    } catch (error) {
      console.error('Error fetching live rates:', error);
    }
  };

  useEffect(() => {
    fetchLiveRates();
  }, []);

  const spreadValue = useMemo(() => {
    return parseFloat(spreadInput) || 0;
  }, [spreadInput]);

  const cbRate = useMemo(() => {
    const pair = `${currA}/${currB}`;
    const reversePair = `${currB}/${currA}`;
    
    // 1. Try direct match
    if (rates[pair]) return rates[pair];
    
    // 2. Try inverse match
    if (rates[reversePair]) return 1 / rates[reversePair];
    
    // 3. Try crossing via USD if both are not USD
    if (currA !== 'USD' && currB !== 'USD') {
      const rateA = rates[`USD/${currA}`] || (rates[`${currA}/USD`] ? 1 / rates[`${currA}/USD`] : null);
      const rateB = rates[`USD/${currB}`] || (rates[`${currB}/USD`] ? 1 / rates[`${currB}/USD`] : null);
      if (rateA && rateB) return rateB / rateA;
    }
    
    return 1;
  }, [currA, currB, rates]);

  const effectiveRate = useMemo(() => {
    return cbRate * (1 + spreadValue / 100);
  }, [cbRate, spreadValue]);

  const usdRateA = useMemo(() => {
    if (currA === 'USD') return 1;
    return rates[`USD/${currA}`] || (rates[`${currA}/USD`] ? 1 / rates[`${currA}/USD`] : 1);
  }, [currA, rates]);

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

  const handleSpreadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(',', '.');
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      setSpreadInput(val);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500 font-sf">
      {/* Main Input Cards */}
      <div className="bg-white rounded-[32px] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100/50 space-y-3 mt-4">
        <InputBlock 
          value={valA} 
          onChange={updateAllFromA} 
          currency={currA} 
          onCurrencyChange={setCurrA}
          subText={`1 ${currA} = ${effectiveRate.toFixed(4)} ${currB}`}
        />
        <InputBlock 
          value={valB} 
          onChange={updateAllFromB} 
          currency={currB} 
          onCurrencyChange={setCurrB}
          subText={`1 ${currB} = ${(1 / effectiveRate).toFixed(4)} ${currA}`}
        />
        <InputBlock 
          value={valUSD} 
          onChange={updateAllFromUSD} 
          currency="USD" 
          isSpecial
          readOnlyCurrency
          subText={`1 USD = ${usdRateA.toFixed(2)} ${currA}`}
        />
      </div>

      {/* Editable Rate Markup Display */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100/50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col items-center">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em] mb-2">Card Rate Markup</span>
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <input 
              type="text" 
              inputMode="decimal"
              value={spreadInput}
              onChange={handleSpreadChange}
              className="bg-[#F2F2F7] text-xl font-medium text-slate-900 focus:outline-none w-24 px-4 py-2.5 rounded-2xl text-center border-2 border-transparent focus:border-[#007AFF]/20 transition-all"
              placeholder="0.00"
            />
          </div>
          <span className="text-xl font-medium text-slate-300">%</span>
        </div>
      </div>
    </div>
  );
};

const InputBlock = ({ value, onChange, currency, onCurrencyChange, isSpecial, readOnlyCurrency, subText }: any) => {
  const currObj = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  
  return (
    <div className={`rounded-2xl px-4 py-3.5 ${isSpecial ? 'bg-[#F2F2F7]' : 'bg-[#F9F9FB]'} flex items-center justify-between min-h-[80px] transition-colors border border-transparent`}>
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
          className="bg-transparent text-2xl font-medium text-slate-900 focus:outline-none w-full truncate tracking-tight"
          placeholder="0"
        />
        {subText && (
          <span className="text-[10px] text-slate-400 mt-1 font-medium uppercase tracking-tight opacity-90">
            {subText}
          </span>
        )}
      </div>
      
      <div className="relative ml-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-1.5 bg-white px-3 py-2 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 w-[96px] h-[44px]">
          <span className="text-xl flex-shrink-0 leading-none">{currObj?.flag || '🏳️'}</span>
          <span className="font-medium text-slate-800 text-[14px] flex-1 text-center">{currency}</span>
          {!readOnlyCurrency && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
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
