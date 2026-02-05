'use client';
import ForgotPassword from '@/components/authentication/ForgotPassword';

export default function ForgotPasswordPage() {
  const handleSwitchToLogin = () => {
    window.location.href = "/";
  };
  return <ForgotPassword  onBack={handleSwitchToLogin} />;
}