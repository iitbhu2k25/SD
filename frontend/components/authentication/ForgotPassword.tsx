"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
export default function ForgotPassword() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const router = useRouter();

  const validateEmail = (value: string) => {
    if (!value) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Enter a valid email address.";
    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }

    console.log("Send reset link to:", email);
    setEmail("");
    setError("");
    // Simulate success, then navigate
    setTimeout(() => {
      router.push("verify-otp"); // ✅ Navigate only after success
    }, 500);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-blue-700 to-blue-200 px-4 py-10 sm:px-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-800 mb-2">
          Forgot Password
        </h1>
        <p className="text-sm text-neutral-600 mb-6">
          Enter your email address and we'll send you a verification code.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-neutral-900 transition"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {error && (
              <span className="text-red-600 text-sm mt-1">{error}</span>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition duration-200"
          >
            Send Verification Code
          </button>
          <Link href="/">
            <h1 className="text-xl font-semibold text-red-600 hover:underline transition duration-200">
              Click here to login
            </h1>
          </Link>
        </form>
      </div>
    </div>
  );
}
