import React from 'react';

interface SulyIconProps {
  className?: string;
  size?: number;
}

export const SulyIcon: React.FC<SulyIconProps> = ({ className = '', size = 24 }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-[22%] overflow-hidden border border-[#262626]/60 shadow-xs ${className}`}
    >
      <img
        src="/suly-app-icon.jpg"
        alt="Suly"
        className="w-full h-full object-cover select-none"
        loading="eager"
      />
    </div>
  );
};
