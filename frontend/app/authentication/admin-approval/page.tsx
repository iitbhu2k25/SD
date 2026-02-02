'use client';

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { MailCheck, AlertCircle } from "lucide-react";

const EmailVerificationPending: React.FC = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background Image */}
      <Image
        src="/Images/main_page_gif.gif"
        alt="Background"
        fill
        priority
        className="object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative max-w-2xl w-full bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-10 text-center border border-white/20">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 flex items-center justify-center rounded-full bg-yellow-400/20">
            <MailCheck className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
          Email Verification
          <br />
          In Progress
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-gray-200 mb-8 leading-relaxed">
          Your email verification is currently being reviewed by the admin.
          Once approved, you’ll get full access to the platform.
        </p>

        {/* Warning box */}
        <div className="flex items-start gap-3 bg-yellow-400/20 border border-yellow-400/30 rounded-2xl p-5 text-left">
          <AlertCircle className="h-6 w-6 text-yellow-400 mt-0.5" />
          <p className="text-base md:text-lg text-yellow-100">
            If this is taking longer than expected, please contact the admin for
            assistance.
          </p>
        </div>

        {/* Back to Login Button */}
        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white text-gray-900 px-8 py-4 text-lg font-semibold shadow-xl transition-all duration-300 hover:scale-105 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-white/40"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPending;
