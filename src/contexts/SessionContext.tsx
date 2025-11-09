import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";

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

// util: sleep for retry
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
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
      .select("current_period_videos_used, subscription_plans(name, monthly_video_limit)")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching subscription:", error);
      setSubscription(null);
      return;
    }

    if (data && (data as any).subscription_plans) {
      const plan = (data as any).subscription_plans as { name: string; monthly_video_limit: number };
      setSubscription({
        plan_name: plan.name,
        videos_used: (data as any).current_period_videos_used ?? 0,
        video_limit: plan.monthly_video_limit ?? 0,
      });
    } else {
      setSubscription(null);
    }
  }, []);

  // Hardening: fetch profile with small retry (e.g., after sign-up trigger that creates profile)
  const fetchProfileWithRetry = useCallback(
    async (uid: string, tries = 3): Promise<Profile | null> => {
      for (let i = 0; i < tries; i++) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();

        if (!error && data) return data as Profile;

        // PGRST116: no row → có thể do profile chưa được tạo → retry nhẹ
        if (error && error.code !== "PGRST116") {
          console.warn("Profile fetch error (non-116):", error);
        }
        await delay(400 * (i + 1));
      }
      return null;
    },
    []
  );

  // Single source of truth to load everything from a Session
  const loadFromSession = useCallback(
    async (sess: Session | null) => {
      if (!sess?.user) {
        // no session → clear & maybe redirect
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubscription(null);
        if (!publicPaths.has(location.pathname)) navigate("/login", { replace: true });
        return;
      }

      // Có session → xác thực profile
      const prof = await fetchProfileWithRetry(sess.user.id, 3);
      if (!prof) {
        console.error("Session exists but profile missing/invalid. Force sign out.");
        // Dọn dẹp triệt để để tránh “session treo” từ cookie
        await supabase.auth.signOut({ scope: "global" });
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubscription(null);
        if (!publicPaths.has(location.pathname)) navigate("/login", { replace: true });
        return;
      }

      // Valid
      setSession(sess);
      setUser(sess.user);
      setProfile(prof);
      await fetchSubscription(sess.user.id);
    },
    [fetchProfileWithRetry, fetchSubscription, navigate, location.pathname, publicPaths]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "global" });
    // state sẽ được dọn bởi loadFromSession khi onAuthStateChange bắn,
    // nhưng ta chủ động dọn ngay để UI mượt.
    setSession(null);
    setUser(null);
    setProfile(null);
    setSubscription(null);
    if (!publicPaths.has(location.pathname)) navigate("/login", { replace: true });
  }, [navigate, location.pathname, publicPaths]);

  // Boot: lấy session hiện tại + subscribe auth changes
  useEffect(() => {
    let unsubscribed = false;
    (async () => {
      setLoading(true);

      // 1) Khởi tạo từ getSession (đảm bảo không trắng màn hình khi reload)
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn("getSession error:", error);
      if (!unsubscribed) {
        await loadFromSession(data?.session ?? null);
      }

      // 2) Lắng nghe thay đổi auth và đồng bộ theo “nguồn sự thật”
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, sess) => {
        const signOutEvents: string[] = ['SIGNED_OUT', 'USER_DELETED'];
        if (signOutEvents.includes(event)) {
          await loadFromSession(null);
        } else {
          await loadFromSession(sess);
        }
      });

      setLoading(false);

      return () => {
        listener.subscription.unsubscribe();
      };
    })();

    return () => {
      unsubscribed = true;
    };
  }, [loadFromSession]);

  // Realtime updates scoped theo user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-updates-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchSubscription(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSubscription]);

  const value = useMemo<SessionContextType>(
    () => ({ session, user, profile, subscription, loading, signOut }),
    [session, user, profile, subscription, loading, signOut]
  );

  // GATE: tránh render children khi chưa xác thực xong để không “trang trắng do crash”
  // Có thể thay bằng một Splash/Spinner nhỏ của bạn.
  if (loading) {
    return <div style={{ padding: 24 }}>Đang tải phiên đăng nhập…</div>;
  }

  // Nếu không đăng nhập và đang ở route private → đã navigate trong loadFromSession; giữ render nhỏ
  if (!user && !publicPaths.has(location.pathname)) {
    return <div style={{ padding: 24 }}>Đang chuyển hướng đến trang đăng nhập…</div>;
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return ctx;
};