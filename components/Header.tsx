import React from 'react';
import { Building2, Ruler } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 text-white shadow-lg border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-orange-600 p-2 rounded-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ARCH-VISION</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              (주)한돌건축사사무소 최인영건축사
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400">
           <Ruler className="w-4 h-4" />
           <span className="text-sm font-light">AI Architectural Assistant</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
