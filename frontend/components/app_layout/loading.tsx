 <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes bounce {
          0%,
          20%,
          50%,
          80%,
          100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
        .loading-backdrop {
          backdrop-filter: blur(8px);
          background: rgba(0, 0, 0, 0.3);
        }
        .loading-container {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .progress-ring {
          transition: stroke-dasharray 0.35s;
          transform-origin: 50% 50%;
        }
      `}</style>
export const WholeLoading=(stpOperation:boolean)=>{
    return (
        <div className="fixed inset-0 loading-backdrop z-50 flex items-center justify-center transition-all duration-300">
          <div className="loading-container bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-slideIn">
            {/* Animated Loading Spinner */}
            <div className="flex flex-col items-center space-y-6">
              <div className="relative w-20 h-20">
                {/* Outer ring */}
                <svg
                  className="w-20 h-20 transform -rotate-90"
                  viewBox="0 0 80 80"
                >
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="35"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="220"
                    strokeDashoffset="60"
                    className="text-blue-500 progress-ring animate-spin"
                    style={{ animationDuration: "2s" }}
                  />
                </svg>

                {/* Inner pulsing circle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Loading Text */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {stpOperation ? "Processing Analysis" : "Loading Resources"}
                </h3>
                <p className="text-gray-600 text-sm">
                  {stpOperation
                    ? "Analyzing site priorities and generating results..."
                    : "Fetching map data and initializing components..."}
                </p>
              </div>

              {/* Progress Dots */}
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
    )
}
        