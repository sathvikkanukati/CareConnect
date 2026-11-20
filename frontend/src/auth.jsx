
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api, initializeCsrf } from "./api.js";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Start in loading state while Django checks authentication.
  const [loading, setLoading] = useState(true);

  // ==========================================
  // CHECK AUTHENTICATED USER ON APP START
  // ==========================================

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      try {
        // Initialize CSRF cookie.
        await initializeCsrf();

        // Django checks the HttpOnly access cookie.
        const data = await api("/auth/me/");

        if (mounted) {
          setUser(data);
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkUser();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================
  // HANDLE EXPIRED AUTHENTICATION
  // ==========================================

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
    };

    window.addEventListener("auth-expired", onExpired);

    return () => {
      window.removeEventListener("auth-expired", onExpired);
    };
  }, []);

  // ==========================================
  // LOGIN
  // ==========================================

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login/", {
      method: "POST",
      body: {
        email,
        password,
      },
      auth: false,
    });

    // Django sets HttpOnly cookies.
    // JavaScript does not store or read JWT tokens.

    if (!data.user) {
      throw new Error(
        "Login succeeded, but the server did not return user details."
      );
    }

    setUser(data.user);

    return data.user;
  }, []);

  // ==========================================
  // REGISTER
  // ==========================================

  const register = useCallback(
    async (form) => {
      await api("/auth/register/", {
        method: "POST",
        body: form,
        auth: false,
      });

      // Automatically log in after successful registration.
      return login(form.email, form.password);
    },
    [login]
  );

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout/", {
        method: "POST",
        auth: false,
      });
    } finally {
      // Clear user information from React state.
      setUser(null);
    }
  }, []);

  // ==========================================
  // AUTH CONTEXT
  // ==========================================

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
