"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { api } from "@/services/api";
import { useRouter } from "next/navigation";
import { isErrorWithMessage } from "@/components/authentication/error";
import { useState } from "react";
import { validateField } from "@/components/authentication/validation";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuthStore } from "@/store/authStore";


interface respData {
  is_verified: boolean;
  user_id: string;
  fullname: string;
  email:string
  access_token: string;
}

export default function Login({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [formValues, setFormValues] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
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
      email: validateField("email", formValues.email),
      password: validateField("password", formValues.password),
    };
    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => err !== "");
    if (hasErrors) return;
   
    try {
      const response = await api.post("/authentication/login", {
        body: {
          email: formValues.email,
          password: formValues.password,
        },
      });
      const data: respData = response.message as respData;
      if (response.status === 201) {
        toast.success("login success")
        const User={
          'fullname':data.fullname,
          'email':data.email,
        }
        setUser(User);
        setAccessToken(data.access_token);
        if (data.is_verified) {
          console.log("verified");  
          router.replace("/dss"); // or whatever your home route is
        } else {
          console.log("not verified");
          router.replace("/authentication/send-otp");
        }
        setFormValues({ email: "", password: "" });
        setSubmitted(false);
      } else {
        toast.error("Unexpected response structure")
      }
    } catch (err: unknown) {
      if (isErrorWithMessage(err)) {
        toast.error(err.message.detail || "Login failed. Please try again.");
      } else {
        toast.error("Something went wrong. Try again later.");
      }
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-white p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <h1 className="text-2xl min-[450px]:text-3xl sm:text-4xl font-bold mb-4 text-neutral-800">
          Login
        </h1>
        <p className="text-xs sm:text-sm text-neutral-900 mb-6 lg:mb-8">
          Welcome back! Please login to continue
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 lg:gap-5">
          {/* Email */}
          <div className="flex flex-col border-2 border-neutral-300 focus-within:border-blue-600 rounded-lg px-4 py-2 transition-all duration-200">
            <label
              htmlFor="email"
              className="text-xs sm:text-sm text-gray-400 font-medium mb-1"
            >
              Email
            </label>
            <input
              required
              type="text"
              id="email"
              name="email"
              value={formValues.email}
              onChange={handleChange}
              className="bg-transparent outline-none border-none text-sm sm:text-base text-neutral-900"
            />
          </div>
          {submitted && errors.email && (
            <span className="text-red-600 text-xs sm:text-sm -mt-2">
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
            <span className="text-red-600 text-xs sm:text-sm -mt-2">
              {errors.password}
            </span>
          )}
          
          <Link href="../authentication/forgot-password">
            <span className="text-gray-500 hover:text-gray-900 hover:underline hover:underline-offset-2 font-semibold text-sm mt-2 cursor-pointer">
              Forgot Password?
            </span>
          </Link>
          
          {/* Submit */}
          <div className="text-xs sm:text-sm text-neutral-900 mt-4 lg:mt-6">
            Don&apos;t have an account?{" "}
            <span
              className="text-blue-600 hover:text-blue-700 hover:underline hover:underline-offset-2 cursor-pointer"
              onClick={onSwitch}
            >
              Create Account
            </span>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 cursor-pointer mt-3"
            >
              Log In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}