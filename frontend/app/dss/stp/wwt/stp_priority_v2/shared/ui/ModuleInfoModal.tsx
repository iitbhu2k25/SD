"use client";

// This modal shows basic information about the module.
import CloseIcon from "./icons/CloseIcon";

interface ModuleInfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  imageSrc: string;
  imageAlt: string;
  points: string[];
  learnMoreHref?: string;
  learnMoreLabel?: string;
}

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

const BORDER_CLASSES = [
  "border-blue-500",
  "border-green-500",
  "border-purple-500",
];

export default function ModuleInfoModal({
  open,
  onClose,
  title,
  imageSrc,
  imageAlt,
  points,
  learnMoreHref,
  learnMoreLabel = "Learn more",
}: ModuleInfoModalProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-3 py-4 sm:px-4">
        <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-2xl">
          <div className="flex items-start justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white sm:px-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm cursor-pointer ">
                <InfoIcon />
              </div>
              <h3 className="text-base font-bold tracking-tight sm:text-lg">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] lg:items-start">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="flex min-h-[320px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(191,219,254,0.35),_rgba(255,255,255,1)_62%)] p-4 sm:min-h-[420px] sm:p-6 lg:min-h-[560px]">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="max-h-[280px] w-full object-contain sm:max-h-[380px] lg:max-h-[520px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {points.map((point, index) => (
                <div
                  key={index}
                  className={`rounded-lg border-l-4 bg-white p-3 shadow-sm ${
                    BORDER_CLASSES[index] ?? "border-slate-500"
                  }`}
                >
                  <p className="text-sm text-gray-600">{point}</p>
                </div>
              ))}

              {learnMoreHref && (
                <div className="pt-1">
                  <button
                    onClick={() => window.open(learnMoreHref, "_blank", "noopener,noreferrer")}
                    className="w-full rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    {learnMoreLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
