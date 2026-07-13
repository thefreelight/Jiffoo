/**
 * Product Illustrations
 *
 * Self-contained SVG artwork used by the built-in themes for demo
 * category cards and "New Arrivals" product cards. Keeping these as
 * inline SVG avoids shipping binary image assets with the open-source core.
 */

import React from 'react';

export interface IllustrationProps {
  className?: string;
}

/** Round glass vase with a leafy branch — "Home & Living" */
export function PlantVaseIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="pv-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="55%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="pv-stem" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4d7c0f" />
          <stop offset="100%" stopColor="#65a30d" />
        </linearGradient>
      </defs>
      {/* pedestal */}
      <ellipse cx="120" cy="206" rx="72" ry="12" fill="#0f172a" opacity="0.08" />
      <rect x="66" y="176" width="108" height="28" rx="6" fill="#f1f5f9" />
      <ellipse cx="120" cy="176" rx="54" ry="10" fill="#ffffff" />
      {/* branch */}
      <path d="M120 150 C118 110 122 84 130 52" stroke="url(#pv-stem)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M126 92 C112 84 104 70 106 56 C120 62 128 76 126 92 Z" fill="#84cc16" opacity="0.9" />
      <path d="M128 74 C140 64 154 62 164 66 C158 80 144 86 128 74 Z" fill="#65a30d" opacity="0.9" />
      <path d="M129 56 C124 42 126 30 134 20 C144 30 142 46 129 56 Z" fill="#a3e635" opacity="0.9" />
      {/* vase body */}
      <path
        d="M104 118 C88 126 78 142 78 156 C78 178 97 190 120 190 C143 190 162 178 162 156 C162 142 152 126 136 118 C132 114 132 108 134 104 L106 104 C108 108 108 114 104 118 Z"
        fill="url(#pv-glass)"
        opacity="0.92"
      />
      <rect x="103" y="96" width="34" height="10" rx="4" fill="#3b82f6" opacity="0.85" />
      {/* glass highlight */}
      <path d="M96 132 C90 140 87 148 88 158 C88 166 92 173 98 177 C94 164 94 144 96 132 Z" fill="#ffffff" opacity="0.55" />
      <ellipse cx="130" cy="128" rx="10" ry="5" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

/** Structured leather handbag — "Bags & Accessories" */
export function HandbagIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="hb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="hb-flap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="206" rx="76" ry="12" fill="#0f172a" opacity="0.08" />
      <ellipse cx="120" cy="192" rx="60" ry="9" fill="#e2e8f0" />
      {/* handle */}
      <path
        d="M92 106 C92 74 100 58 120 58 C140 58 148 74 148 106"
        stroke="url(#hb-body)"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      {/* body */}
      <path
        d="M70 112 C70 104 76 100 84 100 L156 100 C164 100 170 104 170 112 L166 174 C165 184 156 190 146 190 L94 190 C84 190 75 184 74 174 Z"
        fill="url(#hb-body)"
      />
      {/* flap */}
      <path d="M74 100 L166 100 L164 132 C134 140 106 140 76 132 Z" fill="url(#hb-flap)" />
      {/* clasp */}
      <rect x="112" y="124" width="16" height="12" rx="3" fill="#dbeafe" />
      <rect x="116" y="130" width="8" height="10" rx="3" fill="#93c5fd" />
      {/* stitching highlight */}
      <path d="M80 150 C108 158 132 158 160 150" stroke="#93c5fd" strokeWidth="2" fill="none" opacity="0.5" strokeDasharray="4 5" />
    </svg>
  );
}

/** Classic analog watch with leather strap — "Watches" */
export function WatchIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="wt-strap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id="wt-face" cx="0.35" cy="0.3" r="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="210" rx="64" ry="10" fill="#0f172a" opacity="0.08" />
      {/* straps */}
      <path d="M104 20 L136 20 L132 74 L108 74 Z" fill="url(#wt-strap)" />
      <path d="M108 166 L132 166 L136 220 L104 220 Z" fill="url(#wt-strap)" />
      <rect x="106" y="30" width="28" height="5" rx="2.5" fill="#1e3a8a" opacity="0.55" />
      <rect x="106" y="42" width="28" height="5" rx="2.5" fill="#1e3a8a" opacity="0.55" />
      <rect x="106" y="192" width="28" height="5" rx="2.5" fill="#1e3a8a" opacity="0.55" />
      <rect x="106" y="204" width="28" height="5" rx="2.5" fill="#1e3a8a" opacity="0.55" />
      {/* case */}
      <circle cx="120" cy="120" r="52" fill="#e2e8f0" />
      <circle cx="120" cy="120" r="47" fill="url(#wt-face)" />
      <circle cx="120" cy="120" r="47" fill="none" stroke="#bfdbfe" strokeWidth="2" opacity="0.6" />
      {/* crown */}
      <rect x="172" y="114" width="10" height="12" rx="3" fill="#cbd5e1" />
      {/* indices */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI) / 6;
        const x1 = 120 + Math.sin(angle) * 38;
        const y1 = 120 - Math.cos(angle) * 38;
        const x2 = 120 + Math.sin(angle) * 42;
        const y2 = 120 - Math.cos(angle) * 42;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e0f2fe" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />;
      })}
      {/* hands */}
      <line x1="120" y1="120" x2="120" y2="92" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
      <line x1="120" y1="120" x2="142" y2="132" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="120" r="4" fill="#f8fafc" />
      {/* glass highlight */}
      <path d="M92 96 C100 84 116 78 130 82 C112 84 98 92 92 96 Z" fill="#ffffff" opacity="0.4" />
    </svg>
  );
}

/** Blue round vase + white ribbed vase — "Lifestyle" */
export function VaseDuoIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id="vd-blue" cx="0.35" cy="0.3" r="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
        <linearGradient id="vd-white" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="206" rx="80" ry="12" fill="#0f172a" opacity="0.08" />
      {/* white ribbed vase */}
      <path
        d="M140 74 L164 74 C162 90 168 100 174 112 C182 128 184 150 176 168 C170 184 160 192 152 192 C144 192 134 184 128 168 C120 150 122 128 130 112 C136 100 142 90 140 74 Z"
        fill="url(#vd-white)"
      />
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M${132 + i * 6} 96 C${128 + i * 6} 128 ${128 + i * 6} 160 ${134 + i * 6} 188`}
          stroke="#94a3b8"
          strokeWidth="1.6"
          fill="none"
          opacity="0.45"
        />
      ))}
      <rect x="138" y="66" width="28" height="9" rx="3" fill="#e2e8f0" />
      {/* blue round vase (front) */}
      <path
        d="M84 110 C64 116 52 134 52 152 C52 176 72 192 96 192 C120 192 140 176 140 152 C140 134 128 116 108 110 C104 106 104 100 106 96 L86 96 C88 100 88 106 84 110 Z"
        fill="url(#vd-blue)"
      />
      <rect x="84" y="88" width="24" height="9" rx="3.5" fill="#3b82f6" />
      <path d="M70 128 C62 138 59 148 61 160 C62 170 68 178 76 182 C68 164 68 142 70 128 Z" fill="#ffffff" opacity="0.5" />
      <ellipse cx="108" cy="122" rx="9" ry="4.5" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

/** Scented candle jar */
export function CandleIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="cd-jar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="200" rx="66" ry="11" fill="#0f172a" opacity="0.08" />
      {/* wick + flame glow */}
      <line x1="120" y1="64" x2="120" y2="78" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      {/* jar */}
      <rect x="72" y="76" width="96" height="118" rx="18" fill="url(#cd-jar)" />
      {/* wax surface */}
      <ellipse cx="120" cy="80" rx="44" ry="9" fill="#bfdbfe" />
      <ellipse cx="120" cy="80" rx="44" ry="9" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      {/* label */}
      <rect x="86" y="112" width="68" height="46" rx="6" fill="#dbeafe" opacity="0.25" />
      <text x="120" y="134" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontSize="17" fill="#eff6ff">
        jiffoo
      </text>
      <rect x="100" y="142" width="40" height="3" rx="1.5" fill="#bfdbfe" opacity="0.7" />
      <rect x="106" y="149" width="28" height="2.5" rx="1.25" fill="#bfdbfe" opacity="0.5" />
      {/* glass highlight */}
      <rect x="80" y="92" width="10" height="92" rx="5" fill="#ffffff" opacity="0.28" />
    </svg>
  );
}

/** Long-necked minimalist vase */
export function MinimalVaseIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id="mv-body" cx="0.35" cy="0.32" r="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="202" rx="62" ry="10" fill="#0f172a" opacity="0.08" />
      <path
        d="M112 44 L128 44 C126 66 128 84 136 100 C152 114 162 132 162 152 C162 178 143 196 120 196 C97 196 78 178 78 152 C78 132 88 114 104 100 C112 84 114 66 112 44 Z"
        fill="url(#mv-body)"
      />
      <rect x="108" y="38" width="24" height="8" rx="3" fill="#1d4ed8" />
      <path d="M94 124 C86 134 82 144 84 158 C85 168 90 176 98 182 C90 162 90 138 94 124 Z" fill="#ffffff" opacity="0.4" />
      <ellipse cx="138" cy="120" rx="8" ry="4" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

/** Leather cardholder with cards */
export function CardholderIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="ch-leather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="196" rx="70" ry="11" fill="#0f172a" opacity="0.08" />
      {/* card peeking out */}
      <rect x="76" y="52" width="88" height="56" rx="8" fill="#93c5fd" />
      <rect x="84" y="62" width="30" height="6" rx="3" fill="#eff6ff" opacity="0.8" />
      {/* body */}
      <rect x="64" y="82" width="112" height="106" rx="14" fill="url(#ch-leather)" />
      {/* slot stitching */}
      <path d="M64 118 L176 118" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 5" opacity="0.65" />
      <path d="M64 148 L176 148" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 5" opacity="0.65" />
      {/* slot openings */}
      <path d="M64 118 C100 128 140 128 176 118 L176 124 C140 133 100 133 64 124 Z" fill="#1e40af" />
      <path d="M64 148 C100 158 140 158 176 148 L176 154 C140 163 100 163 64 154 Z" fill="#1e40af" />
      {/* logo mark */}
      <circle cx="120" cy="172" r="7" fill="none" stroke="#93c5fd" strokeWidth="2" />
      <text x="120" y="176" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="9" fill="#93c5fd">
        j
      </text>
      <rect x="70" y="90" width="8" height="90" rx="4" fill="#ffffff" opacity="0.12" />
    </svg>
  );
}

/** Large hero vase with tall branch, on a pedestal (Serene hero) */
export function HeroVaseIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 360 420" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id="hv-glass" cx="0.35" cy="0.28" r="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="60%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </radialGradient>
        <linearGradient id="hv-stem" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3f6212" />
          <stop offset="100%" stopColor="#65a30d" />
        </linearGradient>
        <linearGradient id="hv-pedestal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      {/* pedestal */}
      <ellipse cx="180" cy="398" rx="130" ry="16" fill="#1e3a8a" opacity="0.10" />
      <path d="M96 330 L264 330 L254 396 L106 396 Z" fill="url(#hv-pedestal)" />
      <ellipse cx="180" cy="330" rx="84" ry="14" fill="#ffffff" />
      {/* branch */}
      <path d="M180 250 C176 190 182 130 200 60" stroke="url(#hv-stem)" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M196 120 C178 112 166 94 168 74 C188 82 198 100 196 120 Z" fill="#84cc16" />
      <path d="M198 96 C214 82 232 78 246 84 C238 102 218 110 198 96 Z" fill="#65a30d" />
      <path d="M200 64 C194 46 198 28 210 14 C222 30 218 52 200 64 Z" fill="#a3e635" />
      <path d="M192 160 C176 154 166 140 166 124 C182 130 192 144 192 160 Z" fill="#4d7c0f" opacity="0.9" />
      <path d="M194 146 C208 136 224 134 236 140 C228 154 210 158 194 146 Z" fill="#84cc16" opacity="0.85" />
      {/* vase */}
      <path
        d="M152 232 C124 244 106 270 106 296 C106 330 138 350 180 350 C222 350 254 330 254 296 C254 270 236 244 208 232 C202 226 202 216 205 210 L155 210 C158 216 158 226 152 232 Z"
        fill="url(#hv-glass)"
        opacity="0.94"
      />
      <rect x="150" y="198" width="60" height="14" rx="6" fill="#2563eb" opacity="0.9" />
      {/* highlights */}
      <path d="M136 258 C126 272 121 286 123 302 C124 316 132 328 142 334 C132 308 132 278 136 258 Z" fill="#ffffff" opacity="0.5" />
      <ellipse cx="212" cy="252" rx="16" ry="8" fill="#ffffff" opacity="0.3" />
      <ellipse cx="180" cy="214" rx="26" ry="5" fill="#1e3a8a" opacity="0.35" />
    </svg>
  );
}
