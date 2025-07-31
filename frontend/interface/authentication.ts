export interface User {
  username: string;
  email: string;
}


export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isVerified: boolean;
  login: (token: string, userData: User) => void;
  logout: (redirect?: boolean) => Promise<void>;
  updateVerificationStatus: (isVerified: boolean) => void;
  refreshAuthState: () => void;
}
