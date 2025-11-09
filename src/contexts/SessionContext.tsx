import { createContext, useContext, useEffect, useState } from "react";
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

  const fetchProfileAndSubscription = async (currentUser: User) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    } else {
      setProfile(profileData);
    }

    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('current_period_videos_used, subscription_plans(name, monthly_video_limit)')
      .eq('user_id', currentUser.id)
      .single();
    
    if (subError && subError.code !== 'PGRST116') {
      console.error("Error fetching subscription:", subError);
    } else if (subData && subData.subscription_plans) {
      // The type system incorrectly infers this as an array. We force it to be an object.
      const plan = subData.subscription_plans as unknown as { name: string; monthly_video_limit: number };
      setSubscription({
        plan_name: plan.name,
        videos_used: subData.current_period_videos_used,
        video_limit: plan.monthly_video_limit,
      });
    } else {
      setSubscription(null);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileAndSubscription(session.user);
      }
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfileAndSubscription(session.user);
        } else {
          setProfile(null);
          setSubscription(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

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