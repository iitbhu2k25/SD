"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { validateField } from "@/app/authentication/components/validation";
import { toast } from "react-toastify";

interface SignupProps {
  onSwitch: () => void;
  onSuccess?: () => void;
}

export default function Signup({ onSwitch, onSuccess }: SignupProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [formValues, setFormValues] = React.useState({
    fullname: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = React.useState({
    fullname: "",
    email: "",
    password: "",
  });

  const [submitted, setSubmitted] = React.useState(false);

  const toggleVisibility = () => setIsVisible((prev) => !prev);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));

    if (submitted) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);

    const newErrors = {
      fullname: validateField("fullname", formValues.fullname),
      email: validateField("email", formValues.email),
      password: validateField("password", formValues.password),
    };
    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => err !== "");

    if (!hasErrors) {
      try {
        const response = await api.post("/authentication/signup", {
          body: {
            fullname: formValues.fullname,
            email: formValues.email,
            password: formValues.password,
          },
        });
        toast.success("Account created successfully!");
          setFormValues({ fullname: "", email: "", password: "" });
          setSubmitted(false);
          onSwitch();
          onSuccess?.();
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error("Failed to create account");
        }
        
      }
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-white p-6 sm:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-neutral-800">
          Sign Up
        </h1>
        <p className="text-sm text-neutral-600 mb-6">
          Create your account to begin analyzing the rivers
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Fullname */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="fullname"
              className="text-xs text-gray-500 font-medium mb-1"
            >
              Full Name
            </label>
            <input
              required
              type="text"
              id="fullname"
              name="fullname"
              value={formValues.fullname}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900"
            />
          </div>
          {submitted && errors.fullname && (
            <span className="text-red-600 text-sm -mt-2">
              {errors.fullname}
            </span>
          )}

          {/* Email */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="email"
              className="text-xs text-gray-500 font-medium mb-1"
            >
              Email Address
            </label>
            <input
              required
              type="email"
              id="email"
              name="email"
              value={formValues.email}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900"
            />
          </div>
          {submitted && errors.email && (
            <span className="text-red-600 text-sm -mt-2">
              {errors.email}
            </span>
          )}

          {/* Password */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200 relative">
            <label
              htmlFor="password"
              className="text-xs text-gray-500 font-medium mb-1"
            >
              Password
            </label>
            <input
              required
              type={isVisible ? "text" : "password"}
              id="password"
              name="password"
              value={formValues.password}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-base text-neutral-900 pr-8"
            />
            <button
              type="button"
              onClick={toggleVisibility}
              className="absolute right-4 bottom-3 text-neutral-600"
            >
              {isVisible ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {submitted && errors.password && (
            <span className="text-red-600 text-sm -mt-2">
              {errors.password}
            </span>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 mt-2"
          >
            Create Account
          </button>
          
          <div className="text-sm text-neutral-700 text-center mt-2">
            Already have an account?{" "}
            <span 
              className="text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer" 
              onClick={onSwitch}
            >
              Login Here
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}