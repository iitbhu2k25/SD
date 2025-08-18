export const GISCompass = () => {
  return (
    <div className="absolute left-20 top-4 z-20   p-3 rounded-lg  transition-all duration-300 ease-in-out animate-fade-in">
      <div className="flex flex-col items-center">
        <svg width="80" height="80" viewBox="0 0 100 100">
          {/* Outer circle */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="white"
            stroke="#ddd"
            strokeWidth="1"
          />

          {/* Compass rose */}
          <g>
            {/* North pointer (blue) */}
            <path d="M50 10 L55 50 L50 45 L45 50 Z" fill="#3b82f6" />

            {/* South pointer */}
            <path d="M50 90 L45 50 L50 55 L55 50 Z" fill="#606060" />

            {/* East pointer */}
            <path d="M90 50 L50 45 L55 50 L50 55 Z" fill="#606060" />

            {/* West pointer */}
            <path d="M10 50 L50 55 L45 50 L50 45 Z" fill="#606060" />

            {/* Direction markers - cardinal */}
            <text
              x="50"
              y="20"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#3b82f6"
            >
              N
            </text>
            <text
              x="50"
              y="85"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              S
            </text>
            <text
              x="85"
              y="52"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              E
            </text>
            <text
              x="15"
              y="52"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#606060"
            >
              W
            </text>

            {/* Direction markers - ordinal */}
            <text x="32" y="32" textAnchor="middle" fontSize="10" fill="#888">
              NW
            </text>
            <text x="68" y="32" textAnchor="middle" fontSize="10" fill="#888">
              NE
            </text>
            <text x="68" y="72" textAnchor="middle" fontSize="10" fill="#888">
              SE
            </text>
            <text x="32" y="72" textAnchor="middle" fontSize="10" fill="#888">
              SW
            </text>

            {/* Crosshairs */}
            <line
              x1="50"
              y1="10"
              x2="50"
              y2="90"
              stroke="#ddd"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <line
              x1="10"
              y1="50"
              x2="90"
              y2="50"
              stroke="#ddd"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Inner circle */}
            <circle
              cx="50"
              cy="50"
              r="5"
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth="1"
            />

            {/* Outer ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeOpacity="0.3"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};