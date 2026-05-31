"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

async function getAuthedSupabaseClient() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// Relational Security Check: Verifies a user actually belongs to a group before query execution
async function verifyMembership(supabaseClient: any, userId: string, groupId: string) {
  const { data, error } = await supabaseClient
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error || !data) throw new Error("Security Access Denied: You do not belong to this group.");
  return true;
}

// Gets a complete array of all groups a user belongs to
export async function getUserGroups() {
  const { userId } = await auth();
  if (!userId) return [];

  try {
    const supabase = await getAuthedSupabaseClient();
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, groups(name, created_by)") 
      .eq("user_id", userId);

    if (error || !data) return [];
    
    return data.map((item) => ({
      groupId: item.group_id,
      groupName: (item.groups as any)?.name || "Shared List",
      createdBy: (item.groups as any)?.created_by || null 
    }));
  } catch (err) {
    console.error("Fetch Groups Error:", err);
    return [];
  }
}

// UPDATED: Now fetches wishes explicitly for whichever group workspace is active
export async function getWishesFromDatabase(groupId: string) {
  const { userId } = await auth();
  if (!userId || !groupId) return [];

  try {
    const supabase = await getAuthedSupabaseClient();
    await verifyMembership(supabase, userId, groupId);

    const { data, error } = await supabase
      .from("wishes")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Fetch Security Error:", err);
    return [];
  }
}

// UPDATED: Saves the new wish explicitly tagged to the active group context parameters
export async function addWishToDatabase(name: string, isInspo: boolean, description: string, url: string, groupId: string) {
  const { userId } = await auth();
  if (!userId || !groupId) throw new Error("Unauthorized");

  try {
    const supabase = await getAuthedSupabaseClient();
    await verifyMembership(supabase, userId, groupId);

    const { data, error } = await supabase
      .from("wishes")
      .insert([
        {
          name,
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
    return data;
  } catch (err) {
    console.error("Add Wish Security Error:", err);
    throw new Error("Failed to save to database");
  }
}

export async function deleteWishFromDatabase(id: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const supabase = await getAuthedSupabaseClient();
    const { error } = await supabase
      .from("wishes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  } catch (err) {
    console.error("Delete Security Error:", err);
    throw new Error("Failed to delete from database");
  }
}

export async function checkUserGroup() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const supabase = await getAuthedSupabaseClient();
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, groups(name)")
      .eq("user_id", userId)
      .maybeSingle(); 

    if (error || !data) return null;
    
    return { 
      groupId: data.group_id, 
      groupName: (data.groups as any)?.name || "Our Shared List" 
    };
  } catch {
    return null;
  }
}

export async function createGroup(groupName: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert([{ name: groupName, created_by: userId }]) // Tags the creator
    .select()
    .single();

  if (groupError) throw new Error(`Database rejected: ${groupError.message}`);

  const { error: memberError } = await supabase
    .from("group_members")
    .insert([{ group_id: group.id, user_id: userId }]);

  if (memberError) throw new Error("Failed to link user to the new group.");

  return { groupId: group.id, groupName: group.name, createdBy: userId };
}

export async function joinGroup(groupId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();

  const { error } = await supabase
    .from("group_members")
    .insert([{ group_id: groupId, user_id: userId }]);

  if (error) {
    throw new Error("Invalid Join Code or you are already a member.");
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  return { groupId, groupName: group?.name || "Shared List" };
}

export async function getUserProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const supabase = await getAuthedSupabaseClient();
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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const supabase = await getAuthedSupabaseClient();
    
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        ...profileData,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Failed to update profile:", err);
    throw new Error("Could not save sizing info.");
  }
}

export async function getGroupMembers(groupId: string) {
  const { userId } = await auth();
  if (!userId) return [];

  try {
    const supabase = await getAuthedSupabaseClient();
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
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const supabase = await getAuthedSupabaseClient();
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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
  const { data, error } = await supabase
    .from("wishes")
    .update({ reserved_by: userId })
    .eq("id", wishId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unreserveWishInDatabase(wishId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
  const { data, error } = await supabase
    .from("wishes")
    .update({ reserved_by: null })
    .eq("id", wishId)
    .eq("reserved_by", userId) 
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function handleToggleReserveAction(wishId: number, isCurrentlyReserved: boolean) {
  if (isCurrentlyReserved) {
    return await unreserveWishInDatabase(wishId);
  } else {
    return await reserveWishInDatabase(wishId);
  }
}

export async function deleteAccountFromApplication() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
  await supabase.from("wishes").delete().eq("user_id", userId);
  await supabase.from("group_members").delete().eq("user_id", userId);
  await supabase.from("profiles").delete().eq("user_id", userId);

  const client = await clerkClient();
  await client.users.deleteUser(userId);
  return { success: true };
}

export async function updateGroupInDatabase(groupId: string, newName: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
  // Ensure user is actually in the group before allowing them to edit the name
  await verifyMembership(supabase, userId, groupId);

  const { error } = await supabase
    .from("groups")
    .update({ name: newName })
    .eq("id", groupId);

  if (error) throw error;
  return true;
}

export async function updateWishInDatabase(id: number, name: string, isInspo: boolean, description: string, url: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
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

  if (error) throw error;
  return true;
}

export async function deleteGroupFromDatabase(groupId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await getAuthedSupabaseClient();
  
  // Verify the person deleting is the actual creator
  const { data: groupData } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();
    
  if (groupData?.created_by !== userId) {
    throw new Error("Security Access Denied: Only the group creator can delete this space.");
  }

  // Delete the group
  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) throw new Error(`Failed to delete group: ${error.message}`);
  return true;
}