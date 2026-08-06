import React from 'react';
import { Building2, Ruler } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 text-white shadow-lg border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0">
          <div className="bg-orange-600 p-1.5 sm:p-2 rounded-lg shrink-0">
            <Building2 className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">ARCH-VISION</h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide truncate">
              (주)한돌건축사사무소 최인영건축사
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-2 text-slate-400 shrink-0">
           <Ruler className="w-4 h-4" />
           <span className="text-sm font-light">AI Architectural Assistant</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
