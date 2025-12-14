"use client";

import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { performLogout } from "@/utils/logout";

export const useLogout = () => {
  const router = useRouter();

  const handleLogout = async () => {
    await performLogout(router);
    toast.success("Logout successful");
  };

  return { handleLogout };
};
