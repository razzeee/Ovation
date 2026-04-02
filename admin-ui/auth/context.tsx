import {
  type LoginResponse,
  login as apiLogin,
  setTokenGetter,
} from "@admin/services/client";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface ModeratorInfo {
  moderator_id: number;
  username: string;
  display_name: string;
  is_admin: boolean;
  locales: string;
}

interface AuthState {
  token: string | null;
  moderator: ModeratorInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "ovation_token";
const MOD_KEY = "ovation_moderator";

function loadStored(): {
  token: string | null;
  moderator: ModeratorInfo | null;
} {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(MOD_KEY);
    const moderator = raw ? (JSON.parse(raw) as ModeratorInfo) : null;
    if (token && moderator) return { token, moderator };
  } catch {
    // corrupted storage
  }
  return { token: null, moderator: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => loadStored().token);
  const [moderator, setModerator] = useState<ModeratorInfo | null>(
    () => loadStored().moderator,
  );

  // Keep a ref so the API client always has the latest token
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    setTokenGetter(() => tokenRef.current);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res: LoginResponse = await apiLogin(username, password);
    setToken(res.token);
    setModerator(res.moderator);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(MOD_KEY, JSON.stringify(res.moderator));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setModerator(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MOD_KEY);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      moderator,
      isAuthenticated: !!token,
      isAdmin: !!moderator?.is_admin,
      login,
      logout,
    }),
    [token, moderator, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
