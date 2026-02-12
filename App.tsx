import React from 'react';
import { CalculatorMode } from './components/CalculatorMode';

const App: React.FC = () => {
  return (
    <div className="h-screen flex flex-col bg-[#F2F4F7] font-sf overflow-hidden">
      {/* Header */}
      <header className="px-6 pt-6 pb-2 flex flex-col items-center gap-2 flex-shrink-0">
        <h1 className="text-[12px] font-normal tracking-[0.4em] text-slate-400 uppercase">
          True Currency
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col px-4 pb-4 overflow-hidden max-w-lg mx-auto w-full">
        <CalculatorMode />
      </main>
    </div>
  );
};

export default App;