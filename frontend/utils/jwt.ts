import { api } from "@/services/api";

export interface UserInfo {
  fullname: string;
  email: string;
}

/**
 * Validate session by calling backend (for HttpOnly auth)
 */
export async function validateToken(): Promise<{
  isValid: boolean;
  user: UserInfo | null;
}> {
  try {
    const response = await api.get("/authentication/authentic");
    const user = {
      fullname:
        (response.message as { fullname: string; email: string }).fullname ||
        "",
      email:
        (response.message as { fullname: string; email: string }).email || "",
    };
    return { isValid: true, user };
  } catch (error) {
    console.log("Token validation error:", error);
    return { isValid: false, user: null };
  }
}
