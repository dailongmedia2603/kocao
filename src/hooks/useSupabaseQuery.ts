import { useQuery, type UseQueryResult, type UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

// Define a query function type that receives the Supabase client
type SupabaseQueryFunction<T> = (supabase: SupabaseClient) => Promise<T>;

// Extend the options to accept our custom query function
type UseSupabaseQueryOptions<T> = Omit<UseQueryOptions<T, PostgrestError | Error, T>, 'queryFn'> & {
  queryFn: SupabaseQueryFunction<T>;
};

export const useSupabaseQuery = <T>({
  queryKey,
  queryFn,
  ...options
}: UseSupabaseQueryOptions<T>): UseQueryResult<T, PostgrestError | Error> => {
  
  const stableQueryFn = async (): Promise<T> => {
    // This is the core of the solution:
    // Always get a fresh session before making a request.
    // The Supabase client handles token refreshing automatically within getSession().
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }

    if (!session) {
      // This will likely never be hit if ProtectedRoute is working, but it's a good safeguard.
      throw new Error('Not authenticated');
    }

    // Now, execute the actual query function with a guaranteed valid client instance.
    return queryFn(supabase);
  };

  return useQuery<T, PostgrestError | Error, T>({
    queryKey,
    queryFn: stableQueryFn,
    ...options,
  });
};