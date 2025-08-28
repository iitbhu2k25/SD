'use client';

import { useState } from 'react';
import Login from '@/components/authentication/login';
import Signup from '@/components/authentication/signup';
import Image from 'next/image';
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const imageUrl = "public/Images/main_page.jpg";
  const switchToSignup = () => setIsLogin(false);
  const switchToLogin = () => setIsLogin(true);

  return (
    <div className="flex flex-col lg:flex-row px-4 ">
      {/* Form Container */}
      <div className="w-full lg:w-1/2 xl:w-1/3 order-2 lg:order-1">
        {isLogin ? (
          <Login onSwitch={switchToSignup} />
        ) : (
          <Signup onSwitch={switchToLogin} />
        )}
      </div>

      {/* Image Container */}
      <div className="relative w-full lg:w-1/2 xl:w-2/3 min-h-[700px] order-1 lg:order-2 overflow-hidden rounded-lg lg:rounded-none">
        <Image
          src="/Images/main_page.jpeg"    // Use the correct path starting with "/"
          alt="My Image"
          placeholder="blur"
          blurDataURL="/Images/main_page.jpeg" // Only works if you have a base64 or same-path blur
          fill
          className="object-cover w-full h-full"
        />
      </div>

    </div>
  );
}