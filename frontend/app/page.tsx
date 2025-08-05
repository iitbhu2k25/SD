'use client';

import { useState } from 'react';
import Login from '@/components/authentication/login';
import Signup from '@/components/authentication/signup';
import Image from 'next/image';
export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const imageUrl = "https://images.pexels.com/photos/16542959/pexels-photo-16542959.jpeg?_gl=1*3sw3m8*_ga*NzM2MzE3NzM0LjE3NTEwMjk4NTI.*_ga_8JE65Q40S6*czE3NTEwMjk4NTIkbzEkZzEkdDE3NTEwMjk5NTIkajIyJGwwJGgw"
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
      <div className={`relative w-full lg:w-1/2 xl:w-2/3 min-h-[700px] order-1 lg:order-2 `}>
        <Image
          src={imageUrl}
          alt="My Image"
          placeholder="blur"
          blurDataURL={imageUrl}
          fill
          className="object-cover rounded-lg lg:rounded-none"
        />
      </div>
    </div>
  );
}