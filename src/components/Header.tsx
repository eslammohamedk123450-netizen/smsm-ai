import React from 'react';
import { Menu, ArrowRight, Star } from 'lucide-react';
import { SulyIcon } from './SulyIcon';
import { ScreenType } from '../types';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onOpenMenu: () => void;
  balance: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenMenu,
  balance,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-[#000000] border-b border-[#262626] px-4 h-14 flex items-center justify-between">
      {/* Right side (RTL start): Hamburger Menu or Back Arrow */}
      <div className="flex items-center gap-3">
        {currentScreen === 'home' ? (
          <button
            onClick={onOpenMenu}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#F5F5F5] hover:bg-[#1F1F1F] active:bg-[#262626] transition-colors"
            aria-label="القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => onNavigate('home')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#F5F5F5] hover:bg-[#1F1F1F] active:bg-[#262626] transition-colors"
            aria-label="العودة للرئيسية"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {/* Corporate Brand lockup: Suly Icon + Suly text */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <SulyIcon size={22} />
          <span className="text-[20px] font-bold leading-[28px] text-[#F5F5F5] tracking-tight">
            Suly
          </span>
        </div>
      </div>

      {/* Screen Title for Balance or Chat (if not home) */}
      {currentScreen === 'balance' && (
        <div className="hidden sm:block text-[13px] text-[#A1A1AA] font-normal">
          الرصيد والاستهلاك
        </div>
      )}

      {/* Left side (RTL end): Small Capsule with Yellow Star + White Balance Number */}
      <button
        onClick={() => onNavigate('balance')}
        className="bg-[#1F1F1F] rounded-full px-3 py-1.5 border border-[#262626] hover:border-[#333333] active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        title="فتح صفحة الرصيد والاستهلاك"
        aria-label="رصيد الحساب"
      >
        <Star className="w-3.5 h-3.5 fill-[#FACC15] text-[#FACC15] shrink-0" />
        <span className="text-white text-[13px] font-bold tabular-nums">
          {balance.toLocaleString('en-US')}
        </span>
      </button>
    </header>
  );
};
