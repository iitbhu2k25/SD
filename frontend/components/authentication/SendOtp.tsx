"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { toast } from "react-toastify";
import { useLogout } from "@/components/authentication/logout";
function SendOTP() {
  const imageUrl =
    "https://images.pexels.com/photos/16542959/pexels-photo-16542959.jpeg";

  const router = useRouter();

  const { handleLogout } = useLogout();
  const generateOtp = async () => {
    try {
      const response = await api.post("/authentication/email_otp", {
      });
      if (response.status === 201) {
        toast.success("OTP sent successfully!");
      }
      router.push("verify-otp");
    } catch (error) {
      toast.error("Error while generating OTP");
      console.log(error);
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
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30 z-0" />

      {/* OTP Card */}
      <div className="relative z-10 w-full max-w-md bg-white bg-opacity-90 backdrop-blur-md rounded-2xl shadow-lg p-6 sm:p-8 md:p-10 text-center text-neutral-800">
        <h2 className="text-2xl min-[450px]:text-3xl sm:text-4xl font-bold mb-4">
          Send OTP Confirmation
        </h2>
        <p className="text-xs sm:text-sm text-neutral-900 mb-6 lg:mb-8">
          A One Time Password will be sent to your email after your confirmation.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => generateOtp()}
            className="w-full bg-blue-500 hover:bg-blue-800 text-white text-sm sm:text-base py-3 rounded-lg font-medium transition duration-200"
          >
            Send OTP. I will confirm now.
          </button>
          <button
            onClick={() => handleLogout()}
            className="w-full bg-blue-500 hover:bg-blue-800 text-white text-sm sm:text-base py-3 rounded-lg font-medium transition duration-200"
          >
            No, Log me Out. I will confirm later.
          </button>
         
           
        </div>
      </div>
    </div>
  );
}

export default SendOTP;
