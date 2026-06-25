'use client';

import { useId } from 'react';

const BARS: Array<[number, number, number]> = [
  [10, 34, 7], [30, 48, 7], [50, 24, 7], [70, 56, 10], [90, 36, 7],
  [110, 28, 7], [130, 60, 10], [150, 40, 7], [170, 32, 7], [190, 52, 7],
  [260, 44, 7], [280, 64, 10], [300, 28, 7], [320, 48, 7], [340, 36, 7],
  [360, 56, 10], [380, 24, 7], [400, 44, 7], [420, 32, 7], [440, 52, 7],
  [510, 36, 7], [530, 68, 10], [550, 28, 7], [570, 48, 7], [590, 40, 7],
  [610, 56, 10], [630, 32, 7], [650, 44, 7], [670, 24, 7], [690, 52, 7],
  [760, 44, 7], [780, 60, 10], [800, 32, 7], [820, 48, 7], [840, 36, 7],
  [860, 52, 7], [880, 28, 7], [900, 44, 7], [920, 36, 7], [940, 56, 10],
  [1010, 40, 7], [1030, 52, 7], [1050, 28, 7], [1070, 64, 10], [1090, 36, 7],
  [1110, 48, 7], [1130, 32, 7], [1150, 44, 7], [1170, 36, 7], [1186, 52, 7],
];

export function DashboardBanner() {
  const uid = useId();
  const bgId   = `${uid}bg`;
  const areaId = `${uid}area`;
  const fadeId = `${uid}fade`;

  return (
    <div className="-mx-6 -mt-6 mb-6 relative h-36 overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 144"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0D0D0D" />
            <stop offset="100%" stopColor="#141414" />
          </linearGradient>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#C8A96E" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#C8A96E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0A0A0A" stopOpacity="0" />
            <stop offset="100%" stopColor="#0A0A0A" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="1200" height="144" fill={`url(#${bgId})`} />

        {/* Horizontal grid lines */}
        <line x1="0" y1="36"  x2="1200" y2="36"  stroke="#1A1A1A" strokeWidth="1" />
        <line x1="0" y1="72"  x2="1200" y2="72"  stroke="#1A1A1A" strokeWidth="1" />
        <line x1="0" y1="108" x2="1200" y2="108" stroke="#1A1A1A" strokeWidth="1" />

        {/* Vertical grid lines */}
        {[150, 300, 450, 600, 750, 900, 1050].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="144" stroke="#1A1A1A" strokeWidth="1" />
        ))}

        {/* Bid volume bars */}
        {BARS.map(([x, h, op], i) => (
          <rect
            key={i}
            x={x}
            y={144 - h}
            width="10"
            height={h}
            fill="#C8A96E"
            fillOpacity={op / 100}
          />
        ))}

        {/* Area fill under price line */}
        <path
          d="M 0,52 C 120,44 240,40 380,54 C 500,66 580,50 700,60 C 820,70 940,76 1080,86 C 1120,90 1160,93 1200,97 L 1200,144 L 0,144 Z"
          fill={`url(#${areaId})`}
        />

        {/* Price trend line */}
        <path
          d="M 0,52 C 120,44 240,40 380,54 C 500,66 580,50 700,60 C 820,70 940,76 1080,86 C 1120,90 1160,93 1200,97"
          fill="none"
          stroke="#C8A96E"
          strokeWidth="1.5"
          strokeOpacity="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price dot */}
        <circle cx="580" cy="50" r="2.5"  fill="#C8A96E" fillOpacity="0.8" />
        <circle cx="580" cy="50" r="5.5"  fill="none" stroke="#C8A96E" strokeWidth="1" strokeOpacity="0.25" />

        {/* Bottom fade into page background */}
        <rect width="1200" height="144" fill={`url(#${fadeId})`} />
      </svg>
    </div>
  );
}
