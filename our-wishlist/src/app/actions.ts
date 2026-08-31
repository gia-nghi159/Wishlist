// @ts-nocheck
"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { getTextEmbedding } from "../lib/embeddings";
import { getAuthContext } from "../lib/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { AppError } from "../lib/errors";

const EMBED_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Embedding timeout")), ms)
    ),
  ]);
}

// Verify user membership in specified group
async function verifyMembership(supabaseClient: any, userId: string, groupId: string) {
  const { data, error } = await supabaseClient
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error || !data) throw new AppError("FORBIDDEN", "Security Access Denied: You do not belong to this group.", 403);
  return true;
}

export async function getInitialDashboardData(groupId?: string) {
  const { userId, supabase } = await getAuthContext();

  const { data: groupRows } = await supabase
    .from("group_members")
    .select("group_id, groups(name, created_by)")
    .eq("user_id", userId);

  const groups = (groupRows ?? []).map((item: any) => ({
    groupId: item.group_id,
    groupName: (item.groups as any)?.name || "Shared List",
    createdBy: (item.groups as any)?.created_by || null,
  }));
  
  const targetGroupId = groupId ?? groups[0]?.groupId;

  if (!targetGroupId) return { groups, activeGroupId: null, wishes: [], members: [] };

  await verifyMembership(supabase, userId, targetGroupId);

  const [wishesResult, membersResult] = await Promise.all([
    supabase
      .from("wishes")
      .select("*, contributions(*)")
      .eq("group_id", targetGroupId)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", targetGroupId)
  ]);

  const userIds = (membersResult.data ?? []).map((m: any) => m.user_id);
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({ userId: userIds });

  const members = clerkUsers.data.map(u => ({
    id: u.id,
    firstName: u.firstName || "User",
    imageUrl: u.imageUrl,
    isMe: u.id === userId,
  }));

  return {
    groups,
    activeGroupId: targetGroupId,
    wishes: wishesResult.data ?? [],
    members,
  };
}

export async function getUserGroups() {
  try {
    const { userId, supabase } = await getAuthContext();
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, groups(name, created_by)") 
      .eq("user_id", userId);

    if (error || !data) return [];
    
    return data.map((item: any) => ({
      groupId: item.group_id,
      groupName: (item.groups as any)?.name || "Shared List",
      createdBy: (item.groups as any)?.created_by || null 
    }));
  } catch (err) {
    console.error("Fetch Groups Error:", err);
    return [];
  }
}

export async function getWishesFromDatabase(groupId: string) {
  try {
    const { userId, supabase } = await getAuthContext();
    if (!groupId) return [];
    await verifyMembership(supabase, userId, groupId);

    const { data, error } = await supabase
      .from("wishes")
      .select("*, contributions(*)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Fetch Security Error:", err);
    return [];
  }
}

export async function addWishToDatabase(name: string, isInspo: boolean, description: string, url: string, groupId: string) {
  try {
    const { userId, supabase } = await getAuthContext();
    await verifyMembership(supabase, userId, groupId);

    const { data, error } = await supabase
      .from("wishes")
      .insert([
        {
          name: name || "Unknown Item",
          description: description || null,
          url: url || null,
          is_inspo: isInspo,
          user_id: userId,
          group_id: groupId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Asynchronous embedding execution
    const wishId = data.id;
    const promptText = `Wish Item: ${name}. Description: ${description || "None"}. Inspiration only: ${isInspo}.`;
    
    withTimeout(getTextEmbedding(promptText), EMBED_TIMEOUT_MS)
      .then(embedding => {
        if (embedding.length > 0) {
          return supabaseAdmin.from("wishes").update({ item_embedding: embedding }).eq("id", wishId);
        }
      })
      .catch(err => console.error("[background-embed] Failed for wish", wishId, err));

    return data;
  } catch (err) {
    console.error("Add Wish Security Error:", err);
    if (err instanceof AppError) throw err;
    throw new AppError("DB_ERROR", "Failed to save to database", 500);
  }
}

export async function deleteWishFromDatabase(id: number) {
  try {
    const { userId, supabase } = await getAuthContext();
    const { error } = await supabase
      .from("wishes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  } catch (err) {
    console.error("Delete Security Error:", err);
    if (err instanceof AppError) throw err;
    throw new AppError("DB_ERROR", "Failed to delete from database", 500);
  }
}


export async function createGroup(groupName: string) {
  const { userId, supabase } = await getAuthContext();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert([{ name: groupName, created_by: userId }])
    .select()
    .single();

  if (groupError) throw new AppError("DB_ERROR", `Database rejected: ${groupError.message}`, 500);

  const { error: memberError } = await supabase
    .from("group_members")
    .insert([{ group_id: group.id, user_id: userId }]);

  if (memberError) throw new AppError("DB_ERROR", "Failed to link user to the new group.", 500);

  return { groupId: group.id, groupName: group.name, createdBy: userId };
}

export async function joinGroup(groupId: string) {
  const { userId, supabase } = await getAuthContext();

  // Validate limits
  const { count } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (count && count >= 50) {
    throw new AppError("LIMIT_EXCEEDED", "This group has reached the maximum number of members.", 400);
  }

  const { error } = await supabase
    .from("group_members")
    .insert([{ group_id: groupId, user_id: userId }]);

  if (error) {
    throw new AppError("DB_ERROR", "Invalid Join Code or you are already a member.", 400);
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  return { groupId, groupName: group?.name || "Shared List" };
}

export async function getUserProfile() {
  try {
    const { userId, supabase } = await getAuthContext();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return null;
  }
}

export async function updateUserProfile(profileData: any) {
  try {
    const { userId, supabase } = await getAuthContext();
    
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        ...profileData,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Asynchronous embedding execution
    const profileText = `Style Profile. Height: ${profileData.height || 'Unknown'}, Weight: ${profileData.weight || 'Unknown'}, Fit: ${profileData.preferred_fit || 'Unknown'}, Metal preference: ${profileData.metal_preference || 'Unknown'}. Style in 3 words: ${profileData.style_words || 'Unknown'}. Favorite Brands: ${profileData.favorite_brands || 'None'}. Dealbreakers: ${profileData.dealbreakers || 'None'}. Notes: ${profileData.notes || 'None'}`;
    withTimeout(getTextEmbedding(profileText), EMBED_TIMEOUT_MS)
      .then(embedding => {
        if (embedding.length > 0) {
          return supabaseAdmin.from("profiles").update({ item_embedding: embedding }).eq("user_id", userId);
        }
      })
      .catch(err => console.error("[background-embed] Failed for profile", err));

    return { success: true };
  } catch (err) {
    console.error("Failed to update profile:", err);
    throw new AppError("DB_ERROR", "Could not save sizing info.", 500);
  }
}

export async function getGroupMembers(groupId: string) {
  try {
    const { userId, supabase } = await getAuthContext();
    const { data: members, error } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (error || !members) return [];
    const userIds = members.map((m) => m.user_id);
    if (userIds.length === 0) return [];

    const client = await clerkClient();
    const clerkUsers = await client.users.getUserList({ userId: userIds });

    return clerkUsers.data.map((u) => ({
      id: u.id,
      firstName: u.firstName || "User",
      imageUrl: u.imageUrl,
      isMe: u.id === userId, 
    }));
  } catch (err) {
    console.error("Failed to fetch group members:", err);
    return [];
  }
}

export async function getMemberDetails(memberId: string) {
  try {
    const { userId, supabase } = await getAuthContext();
    if (!userId) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", memberId)
      .maybeSingle();

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(memberId);

    return {
      profile: profile || {},
      user: {
        firstName: clerkUser.firstName || "Member",
        imageUrl: clerkUser.imageUrl,
      }
    };
  } catch (err) {
    console.error("Failed to fetch member details:", err);
    return null;
  }
}

export async function reserveWishInDatabase(wishId: number) {
  const { userId, supabase } = await getAuthContext();

  try {
    const { data, error } = await supabase.rpc("reserve_wish_atomic", {
      p_wish_id: wishId,
      p_user_id: userId,
    });

    if (error) {
      if (error.message.includes("ALREADY_RESERVED")) {
        throw new AppError("CONFLICT", "Someone else just reserved this item.", 409);
      }
      throw error;
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("DB_ERROR", "Failed to reserve item.", 500);
  }
}

export async function unreserveWishInDatabase(wishId: number) {
  const { userId, supabase } = await getAuthContext();
  const { data, error } = await supabase
    .from("wishes")
    .update({ reserved_by: null })
    .eq("id", wishId)
    .eq("reserved_by", userId) 
    .select()
    .single();

  if (error) throw new AppError("DB_ERROR", "Failed to unreserve item.", 500);
  return data;
}


export async function updateGroupInDatabase(groupId: string, newName: string) {
  const { userId, supabase } = await getAuthContext();
  await verifyMembership(supabase, userId, groupId);

  const { error } = await supabase
    .from("groups")
    .update({ name: newName })
    .eq("id", groupId);

  if (error) throw new AppError("DB_ERROR", "Failed to update group name", 500);
  return true;
}

export async function updateWishInDatabase(id: number, name: string, isInspo: boolean, description: string, url: string) {
  const { userId, supabase } = await getAuthContext();
  
  const { error } = await supabase
    .from("wishes")
    .update({
      name,
      description: description || null,
      url: url || null,
      is_inspo: isInspo,
    })
    .eq("id", id)
    .eq("user_id", userId); // Ensure they own the wish

  if (error) throw new AppError("DB_ERROR", "Failed to update wish", 500);

  // Asynchronous embedding execution
  const promptText = `Wish Item: ${name}. Description: ${description || "None"}. Inspiration only: ${isInspo}.`;
  withTimeout(getTextEmbedding(promptText), EMBED_TIMEOUT_MS)
    .then(embedding => {
      if (embedding.length > 0) {
        return supabaseAdmin.from("wishes").update({ item_embedding: embedding }).eq("id", id);
      }
    })
    .catch(err => console.error("[background-embed] Failed for wish", id, err));

  return true;
}

export async function deleteGroupFromDatabase(groupId: string) {
  const { userId, supabase } = await getAuthContext();
  
  const { data: groupData } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();
    
  if (groupData?.created_by !== userId) {
    throw new AppError("FORBIDDEN", "Only the group creator can delete this space.", 403);
  }

  const { error } = await supabase.rpc("delete_group_data", { p_group_id: groupId });
  if (error) throw new AppError("DB_ERROR", `Failed to delete group: ${error.message}`, 500);
  return true;
}
