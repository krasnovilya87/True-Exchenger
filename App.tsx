
import React from 'react';
import { CalculatorMode } from './components/CalculatorMode';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#F2F4F7] font-sf">
      {/* Header */}
      <header className="w-full max-w-lg px-6 pt-8 pb-6 flex flex-col items-center gap-4">
        <h1 className="text-sm font-medium tracking-[0.2em] text-[#1a1c1e] uppercase opacity-80">
          True Exchenger
        </h1>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-lg px-4 flex-grow pb-8 overflow-hidden">
        <CalculatorMode />
      </main>
    </div>
  );
};

export default App;
