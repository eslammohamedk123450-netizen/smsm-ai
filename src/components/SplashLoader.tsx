import React, { useEffect, useState } from 'react';

interface SplashLoaderProps {
  onFinish: () => void;
}

export const SplashLoader: React.FC<SplashLoaderProps> = ({ onFinish }) => {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 1200);
    const doneTimer = setTimeout(() => onFinish(), 1550);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      className={`fixed inset-0 z-[100] bg-[#000000] flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="جاري تحميل Suly"
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle orbital ring */}
        <div
          className="absolute -inset-4 rounded-full border border-[#0EA5E9]/25 border-t-[#0EA5E9] suly-spin"
          aria-hidden="true"
        />
        <div
          className="w-[104px] h-[104px] rounded-[28px] overflow-hidden border border-[#262626] suly-spin-slow"
          style={{
            boxShadow: '0 0 36px rgba(14, 165, 233, 0.35)',
          }}
        >
          <img
            src="/suly-app-icon.jpg"
            alt="Suly"
            className="w-full h-full object-cover select-none"
          />
        </div>
      </div>
      <div className="mt-7 text-[15px] font-bold tracking-tight text-[#F5F5F5]">
        Suly
      </div>
      <div className="mt-1 text-[12px] text-[#A1A1AA]">
        جاري تهيئة الوكيل والاتصالات...
      </div>
    </div>
  );
};
