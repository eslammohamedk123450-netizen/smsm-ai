import React from 'react';

interface SulyIconProps {
  className?: string;
  size?: number;
}

export const SulyIcon: React.FC<SulyIconProps> = ({ className = 'w-6 h-6', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Suly Modern Corporate Geometric Monogram / Glyph - Clean, No Text, No White Border */}
      <path
        d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
        stroke="#262626"
        strokeWidth="1.5"
      />
      <path
        d="M20 9L29.5 14.5V25.5L20 31L10.5 25.5V14.5L20 9Z"
        fill="#111111"
        stroke="#0EA5E9"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M20 15L24.5 17.5V22.5L20 25L15.5 22.5V17.5L20 15Z"
        fill="#0EA5E9"
      />
      <circle cx="20" cy="20" r="2" fill="#FFFFFF" />
    </svg>
  );
};
