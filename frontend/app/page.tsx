'use client';

import { useState } from 'react';
import Login from '@/components/authentication/login';
import Signup from '@/components/authentication/signup';
import Image from 'next/image';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  
  const switchToSignup = () => setIsLogin(false);
  const switchToLogin = () => setIsLogin(true);

  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      {/* Form Container */}
      <div className="w-full lg:w-1/2 xl:w-2/5 2xl:w-1/3 order-2 lg:order-1 
                      flex flex-col justify-center 
                      px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 
                      py-8 sm:py-12 lg:py-16">
        <div className="w-full max-w-md mx-auto lg:max-w-lg xl:max-w-xl">
          {isLogin ? (
            <Login onSwitch={switchToSignup} />
          ) : (
            <Signup onSwitch={switchToLogin} />
          )}
        </div>
      </div>

      {/* Image Container */}
      <div className="relative w-full lg:w-1/2 xl:w-3/5 2xl:w-2/3 
                      h-64 sm:h-80 md:h-96 lg:h-auto lg:min-h-screen 
                      order-1 lg:order-2 
                      overflow-hidden">
        <Image
          src="/Images/main_page_gif.gif"   
          alt="Water management visualization"
          placeholder="blur"
          blurDataURL="/Images/main_page.jpeg" 
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          unoptimized
          priority
        />
        
        {/* Optional: Overlay with gradient for better text readability on mobile */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:hidden"></div>
        
      
        
      </div>
    </div>
  );
}