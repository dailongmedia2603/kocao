import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { showError } from "@/utils/toast";

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
  voices_used: number;
  voice_limit: number;
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

export const SessionContextProvider = ({ children, queryClient }: { children: ReactNode, queryClient: QueryClient }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionInfo>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Xóa cache để đảm bảo không còn dữ liệu cũ
    navigate("/login");
  }, [navigate, queryClient]);

  // Effect chính để lắng nghe các thay đổi trạng thái xác thực
  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          queryClient.clear();
        }
        setSession(session);
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, [queryClient]);

  // Effect phụ để lấy profile và subscription khi session thay đổi và lắng nghe realtime
  useEffect(() => {
    if (session?.user) {
      setLoading(true);

      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (error && error.code !== 'PGRST116') {
          console.error("Error fetching profile:", error);
          showError("Không thể tải thông tin người dùng.");
        }
        setProfile(data as Profile | null);
      };

      const fetchSubscription = async () => {
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("current_period_videos_used, current_period_voices_used, subscription_plans(name, monthly_video_limit, monthly_voice_limit, price)")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error && error.code !== "PGRST116") {
          console.error("Error fetching subscription:", error);
        }
        if (data && (data as any).subscription_plans) {
          const plan = (data as any).subscription_plans;
          setSubscription({
            plan_name: plan.name,
            videos_used: data.current_period_videos_used ?? 0,
            video_limit: plan.monthly_video_limit ?? 0,
            voices_used: data.current_period_voices_used ?? 0,
            voice_limit: plan.monthly_voice_limit ?? 0,
            price: plan.price ?? 0,
          });
        } else {
          setSubscription(null);
        }
      };

      const fetchData = async () => {
        await Promise.all([fetchProfile(), fetchSubscription()]);
        setLoading(false);
      };

      fetchData();

      const profileChannel = supabase
        .channel(`profile-changes-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
          () => fetchProfile()
        )
        .subscribe();

      const subscriptionChannel = supabase
        .channel(`subscription-changes-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${session.user.id}` },
          () => fetchSubscription()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(subscriptionChannel);
      };
    } else {
      setProfile(null);
      setSubscription(null);
      setLoading(false);
    }
  }, [session]);

  const value = useMemo<SessionContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      subscription,
      loading,
      signOut,
    }),
    [session, profile, subscription, loading, signOut]
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