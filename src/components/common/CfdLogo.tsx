import React, { useState } from 'react';

interface CfdLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CfdLogo: React.FC<CfdLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  // Size mappings
  const sizeConfig = {
    xs: { imgSize: 'w-6 h-6', textSize: 'text-xs', subSize: 'text-[8px]', gap: 'gap-1.5' },
    sm: { imgSize: 'w-8 h-8', textSize: 'text-sm', subSize: 'text-[9px]', gap: 'gap-2' },
    md: { imgSize: 'w-10 h-10', textSize: 'text-base', subSize: 'text-[10px]', gap: 'gap-2.5' },
    lg: { imgSize: 'w-16 h-16', textSize: 'text-xl', subSize: 'text-xs', gap: 'gap-3' },
    xl: { imgSize: 'w-24 h-24', textSize: 'text-3xl', subSize: 'text-sm', gap: 'gap-4' },
  };

  const { imgSize, textSize, subSize, gap } = sizeConfig[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${gap} ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      {/* Logo Emblem */}
      <div className={`relative ${imgSize} shrink-0 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow bg-white flex items-center justify-center border border-[#BAE6FD]/80`}>
        {!imageError ? (
          <img
            src="/logo.png"
            alt="CFD Platform Official Logo"
            className="w-full h-full object-contain p-0.5"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          /* High-fidelity SVG Fallback */
          <svg viewBox="0 0 100 100" className="w-full h-full p-1 drop-shadow-xs">
            <defs>
              <linearGradient id="gearGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
              <linearGradient id="streamGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="50%" stopColor="#22C55E" />
                <stop offset="85%" stopColor="#EAB308" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
              <linearGradient id="airfoilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E40AF" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>
            </defs>
            {/* Gear Outer */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="url(#gearGrad)" strokeWidth="9" strokeDasharray="14 5" />
            {/* Airfoil in Center */}
            <path
              d="M 32 50 Q 42 42 62 48 Q 50 54 32 50 Z"
              fill="url(#airfoilGrad)"
            />
            {/* Streamlines */}
            <path d="M 10 44 Q 35 34 70 42 L 88 44" fill="none" stroke="url(#streamGrad1)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 10 50 Q 35 44 70 50 L 92 50" fill="none" stroke="url(#streamGrad1)" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 10 56 Q 35 62 70 56 L 88 58" fill="none" stroke="url(#streamGrad1)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Typography Label */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight ${textSize} text-[#0F172A] font-sans flex items-center`}>
              <span className="text-[#0f766e]">
                CFD
              </span>
              <span className="ml-1 text-[#0F172A]">PLATFORM</span>
            </span>
          </div>
          <span className={`font-semibold tracking-widest uppercase text-[#0284C7] ${subSize}`}>
            Aerodynamics & AI Engine
          </span>
        </div>
      )}
    </div>
  );
};
