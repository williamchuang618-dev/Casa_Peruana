/**
 * The Andes, drawn rather than photographed.
 *
 * Original SVG so nothing is licensed from anyone, and — more usefully — so the
 * ranges sit on separate layers that can drift at different rates while you
 * scroll. A flat photograph cannot do that.
 */

export function Chakana({ className = '', title }: { className?: string; title?: string }) {
  // The Andean stepped cross: a 3x3 stepped pyramid on every arm, hollow centre.
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? 'img' : 'presentation'} aria-label={title}>
      <path
        fillRule="evenodd"
        d="M40 0h20v20h20v20h20v20H80v20H60v20H40V80H20V60H0V40h20V20h20V0Zm10 38a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z"
      />
    </svg>
  );
}

/** Step-fret band — the greca motif from Andean weaving and stonework. */
export function Greca({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="greca" width="40" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M0 24v-6h8v-6h8V6h16v6h-8v6h-8v6H0Zm32-18V0h8v6h-8Z"
            fill="currentColor"
          />
        </pattern>
      </defs>
      <rect width="120" height="24" fill="url(#greca)" />
    </svg>
  );
}

export function AndesScene({
  far = 0, mid = 0, peak = 0, terrace = 0, mist = 0,
}: { far?: number; mid?: number; peak?: number; terrace?: number; mist?: number }) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-label="The Andes at dawn, with terraced slopes below a steep peak"
      role="img"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120b14" />
          <stop offset="26%" stopColor="#35202a" />
          <stop offset="48%" stopColor="#7a3a2c" />
          <stop offset="66%" stopColor="#bb7c2d" />
          <stop offset="80%" stopColor="#e0b45f" />
          <stop offset="100%" stopColor="#f2d79b" />
        </linearGradient>
        <radialGradient id="glow" cx="66%" cy="66%" r="46%">
          <stop offset="0%" stopColor="#f6dc9a" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#e0a63f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e0a63f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="farRock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a6060" />
          <stop offset="100%" stopColor="#5c3c44" />
        </linearGradient>
        <linearGradient id="midRock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5d443a" />
          <stop offset="100%" stopColor="#33241f" />
        </linearGradient>
        <linearGradient id="peakRock" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#6b5344" />
          <stop offset="55%" stopColor="#3d2b23" />
          <stop offset="100%" stopColor="#241812" />
        </linearGradient>
        <linearGradient id="fore" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1210" />
          <stop offset="100%" stopColor="#0d0806" />
        </linearGradient>
        <filter id="soften" x="-30%" y="-60%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>

      <rect width="1600" height="900" fill="url(#sky)" />
      <rect width="1600" height="900" fill="url(#glow)" />

      {/* Inti. The disc sits low so the ranges cut across it. */}
      <g transform={`translate(0 ${far * 0.25})`}>
        <circle cx="1056" cy="612" r="86" fill="#f7e3ad" opacity="0.92" />
        <circle cx="1056" cy="612" r="128" fill="none" stroke="#f7e3ad" strokeOpacity="0.28" strokeWidth="1.5" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI * 2) / 24;
          const x1 = 1056 + Math.cos(a) * 140;
          const y1 = 612 + Math.sin(a) * 140;
          const x2 = 1056 + Math.cos(a) * (i % 2 ? 168 : 194);
          const y2 = 612 + Math.sin(a) * (i % 2 ? 168 : 194);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f2d79b" strokeOpacity="0.3" strokeWidth="1.5" />;
        })}
      </g>

      {/* Far range */}
      <g transform={`translate(0 ${far})`}>
        <path
          fill="url(#farRock)"
          fillOpacity="0.78"
          d="M0 654 L128 566 L214 610 L326 498 L438 578 L524 520 L648 596 L764 528 L884 588 L1004 500 L1122 574 L1246 512 L1382 590 L1502 538 L1600 604 V900 H0 Z"
        />
      </g>

      <ellipse cx="700" cy="640" rx="620" ry="46" fill="#f6f1e7" opacity="0.16" filter="url(#soften)"
        transform={`translate(${mist} 0)`} />

      {/* Mid range */}
      <g transform={`translate(0 ${mid})`}>
        <path
          fill="url(#midRock)"
          d="M0 736 L96 690 L186 722 L288 646 L372 700 L470 640 L560 704 L646 660 L742 718 L820 686 L1600 742 V900 H0 Z"
        />
      </g>

      {/* Huayna Picchu — the steep leaning cone behind the citadel. */}
      <g transform={`translate(0 ${peak})`}>
        <path
          fill="url(#peakRock)"
          d="M872 792 C938 748 972 640 1004 528 C1022 466 1042 416 1064 400 C1082 388 1094 406 1102 438 C1124 520 1170 632 1226 720 C1258 770 1292 792 1326 804 L872 804 Z"
        />
        {/* ridge highlight catching the dawn */}
        <path
          fill="none"
          stroke="#d9a768"
          strokeOpacity="0.5"
          strokeWidth="2"
          d="M1064 400 C1042 416 1022 466 1004 528 C972 640 938 748 872 792"
        />
        <path
          fill="none"
          stroke="#8d6a4a"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          d="M1102 438 C1124 520 1170 632 1226 720"
        />
      </g>

      {/* Andenes — the agricultural terraces, stepping down the near slope. */}
      <g transform={`translate(0 ${terrace})`} opacity="0.96">
        {Array.from({ length: 8 }, (_, i) => {
          const y = 690 + i * 19;
          const inset = i * 46;
          return (
            <g key={i}>
              <path
                d={`M${200 + inset} ${y} C${420 + inset * 0.6} ${y - 26} ${700 + inset * 0.4} ${y - 18} ${1000 + inset * 0.2} ${y + 4} L${1000 + inset * 0.2} ${y + 21} C${700 + inset * 0.4} ${y - 1} ${420 + inset * 0.6} ${y - 9} ${200 + inset} ${y + 21} Z`}
                fill={i % 2 ? '#4c3c27' : '#5a4930'}
              />
              <path
                d={`M${200 + inset} ${y} C${420 + inset * 0.6} ${y - 26} ${700 + inset * 0.4} ${y - 18} ${1000 + inset * 0.2} ${y + 4}`}
                fill="none"
                stroke="#c39a5c"
                strokeOpacity="0.55"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </g>

      <ellipse cx="900" cy="806" rx="700" ry="30" fill="#f6f1e7" opacity="0.13" filter="url(#soften)"
        transform={`translate(${-mist * 1.4} 0)`} />

      {/* Foreground ridge */}
      <path
        fill="url(#fore)"
        d="M0 872 L150 846 L300 868 L470 834 L640 864 L820 838 L1010 868 L1200 842 L1400 866 L1600 844 V900 H0 Z"
      />

      {/* A condor, because one is usually up there. */}
      <g opacity="0.5" transform={`translate(${240 + mist * 2} ${-mist * 0.5})`}>
        <path d="M0 0 C14 -9 24 -12 34 -6 C44 -12 54 -9 68 0 C54 -3 44 -1 34 4 C24 -1 14 -3 0 0 Z" fill="#1a1210" />
      </g>
    </svg>
  );
}

/**
 * A short, wide version of the range for use inside the app — it sits behind
 * every page header so the identity carries past the login screen instead of
 * stopping at the front door. Deliberately low-contrast: this is a ground for
 * type, not a picture to look at.
 */
export function Ridge({ className = '', shift = 0 }: { className?: string; shift?: number }) {
  return (
    <svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMaxYMax slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ridgeDawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1a18" stopOpacity="0" />
          <stop offset="70%" stopColor="#8a4a22" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c8952c" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="ridgeRock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a3830" />
          <stop offset="100%" stopColor="#1d1410" />
        </linearGradient>
      </defs>

      <rect width="1200" height="200" fill="url(#ridgeDawn)" />
      <circle cx="905" cy="150" r="34" fill="#f2d79b" opacity="0.5" />

      <g transform={`translate(${shift * 0.35} 0)`}>
        <path
          fill="url(#ridgeRock)"
          fillOpacity="0.55"
          d="M0 168 L90 138 L160 158 L250 116 L330 152 L410 122 L500 156 L590 126 L680 160 L780 118 L860 150 L950 112 L1040 152 L1130 124 L1200 158 V200 H0 Z"
        />
      </g>

      {/* Huayna Picchu, small and to the right where it will not fight the type. */}
      <g transform={`translate(${shift * 0.6} 0)`}>
        <path
          fill="url(#ridgeRock)"
          d="M812 200 C848 178 866 128 882 76 C890 50 900 30 910 24 C918 19 924 27 928 42 C938 80 960 132 986 174 C1000 190 1016 198 1030 200 Z"
        />
      </g>

      {/* Andenes */}
      <g transform={`translate(${shift * 0.85} 0)`} opacity="0.75">
        {Array.from({ length: 4 }, (_, i) => {
          const y = 168 + i * 9;
          const inset = i * 34;
          return (
            <path
              key={i}
              d={`M${140 + inset} ${y} C${380 + inset * 0.6} ${y - 12} ${640 + inset * 0.4} ${y - 8} ${880 + inset * 0.2} ${y + 2}`}
              fill="none"
              stroke="#c39a5c"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
          );
        })}
      </g>
    </svg>
  );
}
