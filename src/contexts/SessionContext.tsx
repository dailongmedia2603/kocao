import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
};

export type UserSubscriptionInfo = {
  plan_name: string;
  videos_used: number;
  video_limit: number;
  price: number;
} | null;

type SessionContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  subscription: UserSubscriptionInfo;
  loading: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | null>(null);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const SessionContextProvider = ({ children, queryClient }: { children: React.ReactNode, queryClient: QueryClient }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionInfo>(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  const publicPaths = useMemo(
    () => new Set<string>(["/login", "/register", "/forgot-password"]),
    []
  );

  const fetchSubscription = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("current_period_videos_used, subscription_plans(name, monthly_video_limit, price)")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching subscription:", error);
      setSubscription(null);
      return;
    }

    if (data && (data as any).subscription_plans) {
      const plan = (data as any).subscription_plans as { name: string; monthly_video_limit: number; price: number };
      setSubscription({
        plan_name: plan.name,
        videos_used: (data as any).current_period_videos_used ?? 0,
        video_limit: plan.monthly_video_limit ?? 0,
        price: plan.price ?? 0,
      });
    } else {
      setSubscription(null);
    }
  }, []);

  const fetchProfileWithRetry = useCallback(
    async (uid: string, tries = 3): Promise<Profile | null> => {
      for (let i = 0; i < tries; i++) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();
        if (!error && data) return data as Profile;
        if (error && error.code !== "PGRST116") console.warn("Profile fetch error (non-116):", error);
        await delay(400 * (i + 1));
      }
      return null;
    },
    []
  );

  const loadFromSession = useCallback(
    async (sess: Session | null) => {
      if (!sess?.user) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubscription(null);
        if (!publicPaths.has(location.pathname)) navigate("/login", { replace: true });
        return;
      }

      const prof = await fetchProfileWithRetry(sess.user.id, 3);
      if (!prof) {
        console.error("Session exists but profile missing/invalid. Force sign out.");
        await supabase.auth.signOut({ scope: "global" });
        return;
      }

      setSession(sess);
      setUser(sess.user);
      setProfile(prof);
      await fetchSubscription(sess.user.id);
    },
    [fetchProfileWithRetry, fetchSubscription, navigate, location.pathname, publicPaths]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "global" });
  }, []);

  useEffect(() => {
    let unsubscribed = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn("getSession error:", error);
      if (!unsubscribed) {
        await loadFromSession(data?.session ?? null);
        setLoading(false);
      }

      const { data: listener } = supabase.auth.onAuthStateChange(async (event, sess) => {
        // The new useSupabaseQuery hook handles data refetching more gracefully.
        // We only need to handle the session state here.
        await loadFromSession(sess);
        setLoading(false);
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    })();

    return () => {
      unsubscribed = true;
    };
  }, [loadFromSession, queryClient]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-updates-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => setProfile(payload.new as Profile))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${user.id}` }, () => fetchSubscription(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSubscription]);

  const value = useMemo<SessionContextType>(
    () => ({ session, user, profile, subscription, loading, signOut }),
    [session, user, profile, subscription, loading, signOut]
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