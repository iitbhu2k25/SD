"use client";

import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { api } from "@/services/api";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
export default function VerifyOtp() {
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [error, setError] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();
  const imageUrl =
    "https://images.pexels.com/photos/16542959/pexels-photo-16542959.jpeg";
  const handleChange = (index: number, value: string) => {
    if (/[^0-9]/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    setError("");
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();

      const newOtp = [...otp];

      if (otp[index]) {
        // Clear current input
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        // Move back and clear previous
        inputsRef.current[index - 1]?.focus();
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
  };

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otp.join("");

    if (fullCode.length < 6 || otp.includes("")) {
      setError("Please enter all 6 digits.");
      return;
    }

    try {
      // Call your API to verify the OTP
      const response = await api.post("/authentication/email_verify", {
        body: { otp: fullCode }
      });
      console.log(response);
      if (response.status === 201) {
        toast.success("Email verified successfully!");
        setOtp(Array(6).fill(""));
        setError("");
        router.push("/dss");
      } else {
        setError("Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.log("OTP verification error:", error);
      setError("Verification failed. Please try again.");
    }
  };

  const handleResend = async () => {
    console.log("Resending OTP...");
    const response = await api.post("/authentication/email_otp");
    if (response.status === 201) {
      toast.success("OTP sent successfully!");
    }
  };

  return (
    <div
      className="relative flex items-center justify-center flex-1 w-full p-4 sm:p-6 lg:p-8"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 min-[500px]:p-10 max-w-md w-full text-neutral-800 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold mb-4">
          Verify Account
        </h2>
        <p className="text-xs min-[500px]:text-sm text-neutral-500 mb-6">
          Enter the 6-digit code sent to your email. This code is valid for the
          next 10 minutes.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex justify-between gap-2 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                className="w-8 h-10 min-[400px]:w-12 min-[400px]:h-14 text-lg min-[500px]:w-14 min-[500px]:h-16 min-[500px]:text-2xl text-center rounded-lg border border-blue-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-none"
              />
            ))}
          </div>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-700 text-white max-[500px]:text-sm py-3 rounded-lg font-medium transition cursor-pointer"
          >
            Verify
          </button>
        </form>

        <p className="text-xs min-[500px]:text-sm mt-6 text-neutral-500">
          Didn’t get the code?{" "}
          <button
            onClick={handleResend}
            className="text-blue-500 hover:underline cursor-pointer"
          >
            Resend code
          </button>
        </p>

        <div className="flex justify-center gap-4 mt-6 text-xs text-neutral-500">
          <button className="hover:underline">Need help?</button>
          <span>|</span>
          <button className="hover:underline">Send feedback</button>
        </div>
      </div>
    </div>
  );
}
