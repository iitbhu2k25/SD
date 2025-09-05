// components/TimerComponent.tsx
import { useEffect, useState, useImperativeHandle, forwardRef, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { toast } from 'react-toastify';

interface TimerComponentProps {
  duration?: number;
  label?: string;
  className?: string;
  buttonClassName?: string;
  onTimeout?: () => void;
  onTick?: (seconds: number) => void;
  onStart?: () => void;
  onStop?: () => void;
  triggerAction?: (startTimer: () => void, stopTimer: () => void) => void;
}

export const TimerComponent = forwardRef<{ stopTimer: () => void }, TimerComponentProps>(
  (
    {
      duration = 40,
      label = 'Processing...',
      className = '',
      buttonClassName = 'px-8 py-3 rounded-full font-medium shadow-md flex items-center gap-2 transition duration-200 bg-green-500 hover:bg-green-600 text-white hover:scale-105',
      onTimeout,
      onTick,
      onStart,
      onStop,
      triggerAction,
    },
    ref
  ) => {
    const [timer, setTimer] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const startTimer = () => {
      setTimer(duration);
      setIsActive(true);
      onStart?.();
    };

    const stopTimer = () => {
      // Clear the interval immediately
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setTimer(null);
      setIsActive(false);
      onStop?.();
    };

    // Expose stopTimer to parent via ref
    useImperativeHandle(ref, () => ({
      stopTimer,
    }));

    useEffect(() => {
      if (timer !== null && timer > 0) {
        intervalRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev === null) return null;
            const newTime = prev - 1;
            onTick?.(newTime);
            return newTime;
          });
        }, 1000);
      } else if (timer === 0) {
        // Timer reached zero
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimer(null);
        setIsActive(false);
        toast.warn('Report generation timed out');
        onTimeout?.();
      } else {
        // Timer is null, make sure interval is cleared
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [timer, onTimeout, onTick]);

    const handleClick = () => {
      if (triggerAction) {
        triggerAction(startTimer, stopTimer);
      } else {
        startTimer();
      }
    };

    return (
      <div className={`timer-container ${className} flex flex-col items-center justify-center`}>
        {isActive && timer !== null ? (
          <div className="relative w-32 h-32">
            <CircularProgressbar
              value={(timer / duration) * 100}
              text={`${timer}s`}
              styles={buildStyles({
                pathColor: '#22c55e',
                textColor: '#1f2937',
                trailColor: '#e5e7eb',
                pathTransitionDuration: 1,
              })}
              aria-label={`Countdown timer: ${timer} seconds remaining`}
            />
            <div className="mt-4 text-center text-lg font-semibold text-gray-700">
              {label}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={isActive}
            className={buttonClassName}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16h8M8 12h8m-8-4h8M4 6h16M4 6v12M20 6v12"
              />
            </svg>
            {label}
          </button>
        )}
      </div>
    );
  }
);

TimerComponent.displayName = 'TimerComponent';