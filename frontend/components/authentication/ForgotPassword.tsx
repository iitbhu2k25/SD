"use client";

import React from "react";

interface ForgotPasswordProps {
  onBack: () => void;
}

export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");

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
    // Add your API call here
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-white p-6 sm:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-neutral-800">
          Forgot Password
        </h1>
        <p className="text-sm text-neutral-600 mb-6">
          Enter your email address and we'll send you a verification code.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="email"
              className="text-xs text-gray-500 font-medium mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          {error && (
            <span className="text-red-600 text-sm -mt-2">{error}</span>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 mt-2"
          >
            Send Verification Code
          </button>
          
          <button
            type="button"
            onClick={onBack}
            className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm text-center"
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}