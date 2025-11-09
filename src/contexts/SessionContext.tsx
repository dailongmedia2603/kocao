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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const fetchProfileAndSubscription = useCallback(async (currentUser: User) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('current_period_videos_used, subscription_plans(name, monthly_video_limit)')
        .eq('user_id', currentUser.id)
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
      return true;
    } catch (error) {
      console.error("Failed to fetch user data, session may be invalid.", error);
      return false;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const success = await fetchProfileAndSubscription(session.user);
          if (success) {
            setSession(session);
            setUser(session.user);
          } else {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setSubscription(null);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfileAndSubscription]);

  useEffect(() => {
    if (user) {
      const profileChannel = supabase
        .channel(`public:profiles:id=eq.${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            setProfile(payload.new as Profile);
          }
        )
        .subscribe();

      const subChannel = supabase
        .channel(`public:user_subscriptions:user_id=eq.${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
          () => {
            fetchProfileAndSubscription(user);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(subChannel);
      };
    }
  }, [user, fetchProfileAndSubscription]);

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