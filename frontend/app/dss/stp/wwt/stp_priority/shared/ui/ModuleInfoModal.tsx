"use client";

// This modal shows basic information about the module.
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-2xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                <InfoIcon />
              </div>
              <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="p-4">
            <div className="mb-4 overflow-hidden rounded-xl border bg-white shadow">
              <img src={imageSrc} alt={imageAlt} className="h-40 w-full object-contain" />
            </div>

            <div className="space-y-3">
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
            </div>

            {learnMoreHref && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => window.open(learnMoreHref, "_blank", "noopener,noreferrer")}
                  className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  {learnMoreLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
