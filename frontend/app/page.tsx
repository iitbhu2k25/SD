'use client';

import { useState } from 'react';
import Login from '@/components/authentication/login';
import Signup from '@/components/authentication/signup';

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
      <div className={`w-full lg:w-1/2 xl:w-2/3 min-h-[600px] order-1 lg:order-2 `}>
      <div 
        className="h-full  bg-cover bg-center rounded-lg lg:rounded-none"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    </div>
    </div>
  );
}