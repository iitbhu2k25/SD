"use client";

import { toast } from "react-toastify";
import { performLogout } from "@/utils/logout";

export const useLogout = () => {

  const handleLogout = async () => {
    await performLogout();
    toast.success("Logout successful");
  };

  return { handleLogout };
};
