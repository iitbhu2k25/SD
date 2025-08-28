// USER details
export interface USER {
  fullname: string;
  email?: string;
}

// Context-like API (optional if you want React Context feel)
export interface AuthContextType {
  user: USER | null;
  loading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (token: string, userData: USER) => void;
  logout: (redirect?: boolean) => Promise<void>;
  updateVerificationStatus: (isVerified: boolean) => void;
  refreshAuthState: () => void;
}

// Zustand store state & actions
export interface AuthState {
  user: USER | null;
  accessToken: string | null;
  isVerified: boolean;
  setUser: (user: USER) => void;
  setAccessToken: (token: string) => void;
  setVerification: (verified: boolean) => void;
  clearAuth: () => void;
}
