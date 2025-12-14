// USER details
export interface USER {
  fullname: string;
  email?: string;
}

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


export interface AuthState {
  user: USER | null;
  accessToken: string | null;
  isVerified: boolean;
  setUser: (user: USER) => void;
  setAccessToken: (token: string) => void;
  setVerification: (verified: boolean) => void;
  clearAuth: () => void;
  logout: () => void;
}
