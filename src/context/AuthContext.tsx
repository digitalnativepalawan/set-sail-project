import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  checkPasskey,
  clearAuthLockout,
  getRemainingLockoutMs,
  isAdminAuthed,
  registerFailedAttempt,
  setAdminSession,
  setStoredPasskey,
} from "@/lib/storage";

// ---------------------------------------------------------------------------
// Temporary passkey-based auth. Designed to be swapped for Supabase Auth:
// replace the internals of `login`/`logout`/`isAuthed` with
// supabase.auth.signInWithPassword / signOut / getSession, and everything
// consuming `useAuth()` keeps working unchanged.
// ---------------------------------------------------------------------------

interface AuthContextValue {
  isAuthed: boolean;
  error: string | null;
  login: (passkey: string) => boolean;
  logout: () => void;
  changePasskey: (newPasskey: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(isAdminAuthed());
  const [error, setError] = useState<string | null>(null);

  const login = useCallback((passkey: string) => {
    const remaining = getRemainingLockoutMs();
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      setError(`Too many failed attempts. Try again in about ${mins} minute${mins !== 1 ? "s" : ""}.`);
      return false;
    }

    if (checkPasskey(passkey)) {
      clearAuthLockout();
      setAdminSession(true);
      setIsAuthed(true);
      setError(null);
      return true;
    }

    const lockout = registerFailedAttempt();
    if (lockout > 0) {
      setError("Too many failed attempts. Access is temporarily locked for 5 minutes.");
    } else {
      setError("Incorrect passkey. Please try again.");
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAdminSession(false);
    setIsAuthed(false);
  }, []);

  const changePasskey = useCallback((newPasskey: string) => {
    setStoredPasskey(newPasskey);
  }, []);

  const value = useMemo(
    () => ({ isAuthed, error, login, logout, changePasskey }),
    [isAuthed, error, login, logout, changePasskey]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
