"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Login from "@/components/authentication/login";
import Signup from "@/components/authentication/signup";
import ForgotPassword from "./ForgotPassword";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: "login" | "signup" | "forgot-password";
}

export default function AuthDialog({ 
  isOpen, 
  onClose, 
  initialView = "login" 
}: AuthDialogProps) {
  const [currentView, setCurrentView] = useState<"login" | "signup" | "forgot-password">(initialView);

  if (!isOpen) return null;

  const handleSwitchToSignup = () => setCurrentView("signup");
  const handleSwitchToLogin = () => setCurrentView("login");
  const handleSwitchToForgotPassword = () => setCurrentView("forgot-password");

  return (
    <div className="fixed inset-0 z-250 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="relative w-full max-w-4xl h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
        >
          <X className="w-5 h-5 text-neutral-700" />
        </button>

        {/* Background Image Section */}
        <div className="hidden md:block md:w-1/2 relative bg-gradient-to-br from-blue-600 to-blue-400">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ 
              backgroundImage: "url('https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800')"
            }}
          />
          <div className="relative h-full flex flex-col items-center justify-center p-8 text-white">
            <h2 className="text-4xl font-bold mb-4">Welcome Back!</h2>
            <p className="text-center text-lg opacity-90">
              Sign in to access 
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="w-full md:w-1/2 overflow-y-auto">
          {currentView === "login" && (
            <Login 
              onSwitch={handleSwitchToSignup}
              onForgotPassword={handleSwitchToForgotPassword}
              onSuccess={onClose}
            />
          )}
          {currentView === "signup" && (
            <Signup 
              onSwitch={handleSwitchToLogin}
              onSuccess={onClose}
            />
          )}
          {currentView === "forgot-password" && (
            <ForgotPassword 
              onBack={handleSwitchToLogin}
            />
          )}
        </div>
      </div>
    </div>
  );
}