import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth as authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ail_token');
    if (!token) return setBooting(false);
    authApi
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem('ail_token'))
      .finally(() => setBooting(false));
  }, []);

  const store = (data) => {
    localStorage.setItem('ail_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(
    () => ({
      user,
      booting,
      isAdmin: user?.role === 'admin',
      course: user?.selectedCourse || 'java',
      login: (payload) => authApi.login(payload).then(store),
      register: (payload) => authApi.register(payload).then(store),
      logout: () => {
        localStorage.removeItem('ail_token');
        setUser(null);
      },
      updateUser: setUser,
      switchCourse: (course) => authApi.updateProfile({ selectedCourse: course }).then(setUser)
    }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
