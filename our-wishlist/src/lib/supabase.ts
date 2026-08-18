import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Performs a hybrid vector search using the match_wishes RPC procedure.
 * @param queryEmbedding Vector embedding array of length 768.
 * @param groupId UUID of the target group workspace.
 * @param maxPrice Optional numeric price filter.
 * @param limit Maximum results to return (default: 10).
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