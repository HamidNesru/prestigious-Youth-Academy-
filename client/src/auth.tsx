import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler, type School, type User } from "./api";

interface AuthCtx {
  user: User | null;
  school: School | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => { setToken(null); setUser(null); setSchool(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) { setReady(true); return; }
    api<{ user: User; school: School }>("/me")
      .then((r) => { setUser(r.user); setSchool(r.school); })
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", { body: { email, password } });
    setToken(r.token);
    setUser(r.user);
    const me = await api<{ school: School }>("/me");
    setSchool(me.school);
  };

  return <Ctx.Provider value={{ user, school, ready, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
