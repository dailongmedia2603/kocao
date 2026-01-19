import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { showError } from "@/utils/toast";
import { api, setAuthToken, getAuthToken, User, Profile, SubscriptionInfo } from "@/lib/apiClient";

export type { Profile, SubscriptionInfo as UserSubscriptionInfo };

type SessionContextType = {
  user: User | null;
  profile: Profile | null;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionContextProvider = ({ children, queryClient }: { children: ReactNode, queryClient: QueryClient }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // Ignore errors on logout
    }
    setAuthToken(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
    queryClient.clear();
    navigate("/login");
  }, [navigate, queryClient]);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      setUser(data.user);
      setProfile(data.user.profile || null);
      setSubscription(data.subscription || null);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      // Token invalid, clear it
      if (error.message?.includes('401') || error.message?.includes('hết hạn')) {
        setAuthToken(null);
        setUser(null);
        setProfile(null);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load - check for existing token
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Polling for subscription updates (replaces realtime)
  useEffect(() => {
    if (!user) return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await api.subscription.current();
        if (data.subscription) {
          setSubscription(data.subscription);
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [user]);

  const value = useMemo<SessionContextType>(
    () => ({
      user,
      profile,
      subscription,
      loading,
      isAuthenticated: !!user,
      signOut,
      refreshUser,
    }),
    [user, profile, subscription, loading, signOut, refreshUser]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return ctx;
};

// Compatibility layer for existing code that uses session.user
export const useAuth = useSession;