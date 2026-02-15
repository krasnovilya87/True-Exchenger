
import React from 'react';
import { CalculatorMode } from './components/CalculatorMode';

const App: React.FC = () => {
  return (
    <div className="h-screen flex flex-col bg-[#F2F4F7] font-sf overflow-hidden">
      {/* Main Content */}
      <main className="flex-grow flex flex-col px-4 pb-4 overflow-hidden max-w-lg mx-auto w-full">
        <CalculatorMode />
      </main>
    </div>
  );
};

export default App;
