"use client";

interface CloseIconProps {
  className?: string;
  strokeWidth?: number;
}

export default function CloseIcon({
  className = "h-4 w-4",
  strokeWidth = 2,
}: CloseIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
