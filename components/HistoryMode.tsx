
import React, { useState, useMemo } from 'react';
import { SUPPORTED_CURRENCIES, MOCK_CB_RATES } from '../constants';
import { ExchangeRecord } from '../types';

export const HistoryMode: React.FC = () => {
  const [currency, setCurrency] = useState('RUB');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [records, setRecords] = useState<ExchangeRecord[]>([]);

  const cbRate = MOCK_CB_RATES[`USD/${currency}`] || 1;

  const stats = useMemo(() => {
    const buyRecords = records.filter(r => r.id.includes('buy'));
    const sellRecords = records.filter(r => r.id.includes('sell'));
    
    const avgBuy = buyRecords.length > 0 
      ? buyRecords.reduce((acc, r) => acc + r.rate, 0) / buyRecords.length 
      : 0;
    const avgSell = sellRecords.length > 0 
      ? sellRecords.reduce((acc, r) => acc + r.rate, 0) / sellRecords.length 
      : 0;
    
    const spread = avgBuy && avgSell ? ((avgSell - avgBuy) / avgBuy) * 100 : 0;
    
    return { avgBuy, avgSell, spread };
  }, [records]);

  const handleSave = () => {
    if (!amount || !rate) return;
    const newRecord: ExchangeRecord = {
      id: `${type}-${Date.now()}`,
      date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      currencyPair: `USD/${currency}`,
      amountFrom: parseFloat(amount),
      amountTo: parseFloat(amount) * parseFloat(rate),
      rate: parseFloat(rate),
      cbRateAtTime: cbRate
    };
    setRecords([newRecord, ...records]);
    setAmount('');
    setRate('');
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Stats Dashboard */}
      <div className="bg-white rounded-[24px] p-3 shadow-sm border border-slate-100 grid grid-cols-2 gap-2">
        <div className="bg-[#F8F9FB] rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-50">
          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">Avg Buy</span>
          <span className="text-sm font-medium text-slate-900">{stats.avgBuy.toFixed(2)}</span>
        </div>
        <div className="bg-[#F8F9FB] rounded-xl p-2.5 flex flex-col items-center justify-center border border-slate-50">
          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">Avg Sell</span>
          <span className="text-sm font-medium text-slate-900">{stats.avgSell.toFixed(2)}</span>
        </div>
        <div className="bg-[#F2F4F7] rounded-xl p-2.5 flex flex-col items-center justify-center">
          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">CB Rate</span>
          <span className="text-sm font-medium text-slate-900">{cbRate.toFixed(2)}</span>
        </div>
        <div className="bg-[#F2F4F7] rounded-xl p-2.5 flex flex-col items-center justify-center">
          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">Spread %</span>
          <span className={`text-sm font-medium ${stats.spread >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {stats.spread.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
           <div className="relative">
             <div className="bg-[#F8F9FB] px-3 py-1.5 rounded-xl border border-slate-100 font-medium text-[11px] flex items-center gap-2">
                {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.flag} {currency}
             </div>
             <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
             >
               {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
             </select>
           </div>
           
           <div className="flex bg-[#F2F4F7] p-1 rounded-xl">
             <button 
              onClick={() => setType('buy')}
              className={`px-3 py-1 text-[9px] uppercase font-medium rounded-lg transition-all ${type === 'buy' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
             >Buy</button>
             <button 
              onClick={() => setType('sell')}
              className={`px-3 py-1 text-[9px] uppercase font-medium rounded-lg transition-all ${type === 'sell' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
             >Sell</button>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[8px] uppercase font-medium text-slate-400 ml-1">Amount USD</label>
            <input 
              type="text" inputMode="decimal"
              value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              placeholder="0.00"
              className="w-full bg-[#F8F9FB] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none border border-transparent focus:border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] uppercase font-medium text-slate-400 ml-1">Rate ({currency})</label>
            <input 
              type="text" inputMode="decimal"
              value={rate} onChange={(e) => setRate(e.target.value.replace(',', '.'))}
              placeholder="0.00"
              className="w-full bg-[#F8F9FB] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none border border-transparent focus:border-slate-200"
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-medium text-[10px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all"
        >
          Save
        </button>
      </div>

      {/* History List */}
      <div className="bg-white rounded-[24px] p-1.5 shadow-sm border border-slate-100 overflow-hidden">
        <div className="max-h-[180px] overflow-y-auto px-1.5 pb-1.5 custom-scrollbar">
          {records.length === 0 ? (
            <div className="py-6 text-center text-slate-300 text-[10px] font-medium uppercase tracking-widest">No Records</div>
          ) : (
            <table className="w-full text-left text-[10px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-50">
                  <th className="py-2 px-1 font-medium text-[8px] text-slate-400 uppercase">Date</th>
                  <th className="py-2 px-1 font-medium text-[8px] text-slate-400 uppercase">Type</th>
                  <th className="py-2 px-1 font-medium text-[8px] text-slate-400 uppercase">Rate</th>
                  <th className="py-2 px-1 font-medium text-[8px] text-slate-400 uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-1 text-slate-500 font-medium">{r.date}</td>
                    <td className={`py-2.5 px-1 font-medium uppercase text-[8px] ${r.id.includes('buy') ? 'text-blue-500' : 'text-rose-500'}`}>
                      {r.id.includes('buy') ? 'Buy' : 'Sell'}
                    </td>
                    <td className="py-2.5 px-1 font-medium text-slate-800">{r.rate.toFixed(2)}</td>
                    <td className="py-2.5 px-1 font-medium text-slate-900 text-right">{r.amountTo.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
