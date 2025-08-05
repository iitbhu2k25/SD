"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/services/api";
import { isErrorWithMessage } from "@/components/authentication/error";
import { validateField } from "@/components/authentication/validation";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Signup({ onSwitch }: { onSwitch: () => void }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [formValues, setFormValues] = React.useState({
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = React.useState({
    username: "",
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
      username: validateField("username", formValues.username),
      email: validateField("email", formValues.email),
      password: validateField("password", formValues.password),
    };
    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => err !== "");

    if (!hasErrors) {
      console.log("Form data:", formValues);
      try {
        const response = await api.post("/authentication/signup", {
          body: {
            username: formValues.username,
            email: formValues.email,
            password: formValues.password,
          },
        });
        if (response.status === 201) {
          toast.success("sign up success")
          setFormValues({ username: "", email: "", password: "" });
          setSubmitted(false);
          onSwitch();
        }
      } catch (error: unknown) {
        toast.error("sign up failed Retry again")
        if (isErrorWithMessage(error)) {
          console.log("Error while signing up:", error.message.detail);
        } else {
          console.log("Error while signing up");
          console.log(error);
        }
      }
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-white p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl min-[450px]:text-3xl sm:text-4xl font-bold mb-4 text-neutral-800">
          Sign Up
        </h1>
        <p className="text-xs sm:text-sm text-neutral-900">
          Create your account to begin analysing the rivers
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-5">
          {/* Username */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="username"
              className="text-xs sm:text-sm text-gray-400 font-medium mb-1"
            >
              Username
            </label>
            <input
              required
              type="text"
              id="username"
              name="username"
              value={formValues.username}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-sm sm:text-base text-neutral-900"
            />
          </div>
          {submitted && errors.username && (
            <span className="text-red-600 text-xs sm:text-sm -mt-3">
              {errors.username}
            </span>
          )}

          {/* Email */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="email"
              className="text-xs sm:text-sm text-gray-400 font-medium mb-1"
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
              className="bg-transparent outline-none border-none text-sm sm:text-base text-neutral-900"
            />
          </div>
          {submitted && errors.email && (
            <span className="text-red-600 text-xs sm:text-sm -mt-3">
              {errors.email}
            </span>
          )}

          {/* Password */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200 relative">
            <label
              htmlFor="password"
              className="text-xs sm:text-sm text-gray-400 font-medium mb-1"
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
              className="bg-transparent outline-none border-none text-sm sm:text-base text-neutral-900 pr-8"
            />
            <button
              type="button"
              onClick={toggleVisibility}
              className="absolute right-4 bottom-3 text-neutral-900 cursor-pointer"
            >
              {isVisible ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {submitted && errors.password && (
            <span className="text-red-600 text-xs sm:text-sm -mt-3">
              {errors.password}
            </span>
          )}

          {/* Submit */}
          <div className="text-xs sm:text-sm text-neutral-900 mt-6">
            Already have an account?{" "}
            <span 
              className="text-blue-600 hover:text-blue-700 hover:underline hover:underline-offset-2 cursor-pointer" 
              onClick={onSwitch}
            >
              Login Here
            </span>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 cursor-pointer mt-3"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}