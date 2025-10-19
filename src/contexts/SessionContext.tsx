import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  updated_at?: string;
};

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    // The onAuthStateChange listener will handle state cleanup
  };

  const fetchProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') { // Ignore 'No rows found' error
        console.error("Lỗi khi lấy thông tin profile:", profileError.message);
        setProfile(null);
      } else {
        setProfile(profileData);
      }
    } catch (e) {
      console.error("Exception when fetching profile:", e);
      setProfile(null);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    setLoading(true);
    
    // Fetch the initial session to quickly determine auth state.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await fetchProfile(currentUser);
      setLoading(false); // Set loading to false after the initial fetch is complete.
    });

    // Listen for auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Fetch profile on sign-in or when user data is updated.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await fetchProfile(currentUser);
      }
      
      // Clear profile on sign-out.
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    refetchProfile,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};