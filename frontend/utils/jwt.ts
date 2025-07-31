import { api } from "@/services/api";

export interface UserInfo {
  username: string;
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
    const response = await api.get("/api/authentication/authentic");

    if (response.status === 201) {
      const user = {
        username:
          (response.message as { username: string; email: string }).username ||
          "",
        email:
          (response.message as { username: string; email: string }).email || "",
      };
      return { isValid: true, user };
    } else {
      return { isValid: false, user: null };
    }
  } catch (error) {
    console.log("Token validation error:", error);
    return { isValid: false, user: null };
  }
}
