
import React from 'react';
import { CalculatorMode } from './components/CalculatorMode';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#F2F4F7]">
      {/* Header */}
      <header className="w-full max-w-lg px-6 pt-8 pb-4 flex justify-between items-center relative">
        <div className="flex-1 text-center">
          <h1 className="text-xl font-medium tracking-widest text-[#1a1c1e] uppercase">
            True Exchenger
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-lg px-4 flex-grow pb-8">
        <CalculatorMode />
      </main>
    </div>
  );
};

export default App;
