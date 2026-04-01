'use client';
import ForgotPassword from '@/app/authentication/components/ForgotPassword';

export default function ForgotPasswordPage() {
  const handleSwitchToLogin = () => {
    window.location.href = "/";
  };
  return <ForgotPassword  onBack={handleSwitchToLogin} />;
}