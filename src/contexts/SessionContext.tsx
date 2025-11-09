import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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

export const SessionContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscriptionInfo>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange sẽ xử lý việc cập nhật state và điều hướng
  }, []);

  const fetchSubscription = useCallback(async (userId: string) => {
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('current_period_videos_used, subscription_plans(name, monthly_video_limit)')
      .eq('user_id', userId)
      .single();
    
    if (subError && subError.code !== 'PGRST116') {
      console.error("Error fetching subscription:", subError);
      setSubscription(null);
    } else if (subData && subData.subscription_plans) {
      const plan = subData.subscription_plans as unknown as { name: string; monthly_video_limit: number };
      setSubscription({
        plan_name: plan.name,
        videos_used: subData.current_period_videos_used,
        video_limit: plan.monthly_video_limit,
      });
    } else {
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Session exists, now we MUST validate it by fetching the profile.
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profileError || !profileData) {
            // This is an invalid session (e.g., user deleted but cookie remains).
            // Force sign out to clean up.
            console.error("Session exists but profile fetch failed. Forcing sign out.", profileError);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setSubscription(null);
          } else {
            // Session is valid, profile exists.
            setSession(session);
            setUser(session.user);
            setProfile(profileData);
            await fetchSubscription(session.user.id);
          }
        } else {
          // No session, clear everything.
          setSession(null);
          setUser(null);
          setProfile(null);
          setSubscription(null);
          if (location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/forgot-password') {
            navigate('/login');
          }
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchSubscription, navigate]);

  useEffect(() => {
    if (user) {
      const channels = supabase.channel(`user-updates-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => setProfile(payload.new as Profile)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
          () => fetchSubscription(user.id)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channels);
      };
    }
  }, [user, fetchSubscription]);

  const value = {
    session,
    user,
    profile,
    subscription,
    loading,
    signOut,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionContextProvider");
  }
  return context;
};