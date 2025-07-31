"use client";

import { Eye, EyeOff } from "lucide-react";
import React from "react";

export default function ResetPassword() {
  const [isVisible, setIsVisible] = React.useState(false);

  const [formValues, setFormValues] = React.useState({
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = React.useState({
    password: "",
    confirmPassword: "",
  });

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  const validatePassword = (value: string): string => {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(value)) return "Include at least one uppercase letter.";
    if (!/[a-z]/.test(value)) return "Include at least one lowercase letter.";
    if (!/[0-9]/.test(value)) return "Include at least one number.";
    return "";
  };

  const validateConfirmPassword = (value: string): string => {
    if (!value) return "Please confirm your password.";
    if (value !== formValues.password) return "Passwords do not match.";
    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setErrors({
      password: "",
      confirmPassword: "",
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const passwordError = validatePassword(formValues.password);
    const confirmPasswordError = validateConfirmPassword(
      formValues.confirmPassword
    );

    if (passwordError || confirmPasswordError) {
      setErrors({
        password: passwordError,
        confirmPassword: confirmPasswordError,
      });
      return;
    }

    console.log("Resetting password to:", formValues.password);
    setFormValues({ password: "", confirmPassword: "" });
    setErrors({ password: "", confirmPassword: "" });
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-lg">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-neutral-800">
          Reset Password
        </h1>
        <p className="text-sm text-neutral-900 mb-8">
          Enter your new password and confirm it below.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* New Password */}
          <div className="flex flex-col border-neutral-300 border-2 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200 relative
          ">
            <label
              htmlFor="password"
              className="text-sm text-gray-400 font-medium mb-1"
            >
              New Password
            </label>
            <input
              type={isVisible ? "text" : "password"}
              id="password"
              name="password"
              value={formValues.password}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900"
              required
            />
            <button
              type="button"
              onClick={toggleVisibility}
              className="absolute right-4 bottom-3 text-neutral-900 cursor-pointer"
            >
              {isVisible ? (
                <EyeOff className="w-5 h-5 text-black" />
              ) : (
                <Eye className="w-5 h-5 text-black" />
              )}
            </button>
          </div>
          {errors.password && (
            <span className="text-red-600 text-sm -mt-3">
              {errors.password}
            </span>
          )}

          {/* Confirm Password */}
          <div className="flex flex-col border-neutral-300 border-2 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="confirmPassword"
              className="text-sm text-gray-400 font-medium mb-1"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formValues.confirmPassword}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900"
              required
            />
          </div>
          {errors.confirmPassword && (
            <span className="text-red-600 text-sm -mt-3">
              {errors.confirmPassword}
            </span>
          )}

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 cursor-pointer"
          >
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}
