import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This gives us a reusable 'supabase' object to talk to our cloud database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Call the stored procedure `match_wishes` that performs a hybrid vector + filter search.
 * @param queryEmbedding Vector128 array (length 768) generated from the user query.
 * @param groupId UUID of the active group workspace.
 * @param maxPrice Optional numeric price ceiling.
 * @param limit Number of results to return (default 10).
 * @returns Array of wish rows with similarity score.
 */
export async function rpcMatchWishes(
  queryEmbedding: number[],
  groupId: string,
  maxPrice?: number,
  limit: number = 10
) {
  const { data, error } = await supabase.rpc('match_wishes', {
    p_query_embedding: queryEmbedding,
    p_group_id: groupId,
    p_max_price: maxPrice ?? null,
    p_limit: limit,
  });
  if (error) {
    console.error('RPC match_wishes error:', error);
    return [];
  }
  return data;
}

/**
 * Atomically reserve a wish to avoid race conditions.
 * Returns the updated row if successful, throws otherwise.
 */
export async function reserveWishAtomic(wishId: number, userId: string) {
  const { data, error } = await supabase.rpc('reserve_wish_atomic', {
    p_wish_id: wishId,
    p_user_id: userId,
  });
  if (error) {
    console.error('Reserve atomic error:', error);
    throw error;
  }
  return data;
}