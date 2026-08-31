// @ts-nocheck
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useUser } from "@clerk/nextjs"; 
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import AddGiftForm from "../components/AddGiftForm";
import WishlistCard from "../components/WishlistCard";
import GroupOnboarding from "../components/GroupOnboarding";
import Sidebar from "../components/Sidebar";
import StylePassportView from "../components/StylePassportView";
import GroupsModal from "../components/GroupsModal";
import GiftAssistantChat from "../components/GiftAssistantChat";
import { supabase } from "../lib/supabase";
import { 
  addWishToDatabase, 
  updateWishInDatabase,
  deleteWishFromDatabase, 
  getWishesFromDatabase, 
  getUserGroups, 
  updateGroupInDatabase,
  deleteGroupFromDatabase, 
  getGroupMembers, 
  getMemberDetails, 
  reserveWishInDatabase, 
  unreserveWishInDatabase,
  createGroup,
  joinGroup,
  getInitialDashboardData
} from "./actions";

type WishItem = { id: number; name: string; isInspo: boolean; description: string; url: string; user_id: string; reserved_by?: string | null; price?: number | null; contributions?: any[]; };
type GroupMember = { id: string; firstName: string; imageUrl: string; isMe: boolean; };
type GroupWorkspace = { groupId: string; groupName: string; createdBy?: string | null; };

const normalizeWish = (wish: any): WishItem => ({
  id: wish.id, name: wish.name, description: wish.description || "",
  url: wish.url || "", isInspo: wish.is_inspo, user_id: wish.user_id || "",
  reserved_by: wish.reserved_by || null,
  price: wish.price || null,
  contributions: wish.contributions || []
});

function DashboardContent() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]); 
  const [groups, setGroups] = useState<GroupWorkspace[]>([]);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Edit States
  const [editingWish, setEditingWish] = useState<WishItem | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: string, name: string, createdBy?: string | null } | null>(null);
  const [editGroupInput, setEditGroupInput] = useState("");

  // New Group States
  const [groupNameInput, setGroupNameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  
  // URL state navigation
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") || "all";
  const activeView = searchParams.get("view") || "wishlist";
  const allWishesLayout = searchParams.get("layout") || "list";

  const updateUrl = (tab: string, view: string, layout: string = allWishesLayout) => {
    router.push(`${pathname}?tab=${tab}&view=${view}&layout=${layout}`, { scroll: false });
  };
  
  // Passport data fetching state
  const [activePassportData, setActivePassportData] = useState<any>(null);
  const [isPassportLoading, setIsPassportLoading] = useState(false);

  // Mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialization effect
  useEffect(() => {
    async function initializeApp() {
      if (isLoaded && isSignedIn) {
        setIsLoading(true);
        const { groups: initialGroups, activeGroupId: initGroupId, wishes, members: initMembers } = await getInitialDashboardData();
        setGroups(initialGroups);
        
        if (initGroupId) {
          setActiveGroupId(initGroupId);
          setActiveGroupName(initialGroups.find((g: any) => g.groupId === initGroupId)?.groupName || null);
          setItems(wishes.map(normalizeWish));
          setMembers(initMembers);
        }
        setIsLoading(false);
      } else if (isLoaded && !isSignedIn) {
        setIsLoading(false);
      }
    }
    initializeApp();
  }, [isLoaded, isSignedIn]);

  // Realtime sync effect
  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`wishes:group:${activeGroupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wishes",
          filter: `group_id=eq.${activeGroupId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setItems(prev => prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item));
          } else if (payload.eventType === "INSERT") {
            setItems(prev => [normalizeWish(payload.new), ...prev]);
          } else if (payload.eventType === "DELETE") {
            setItems(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const contributionsChannel = supabase
      .channel(`contributions:group:${activeGroupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contributions",
        },
        async () => {
          // Refresh wishes to get updated contributions
          const freshWishes = await getWishesFromDatabase(activeGroupId!);
          setItems(freshWishes.map(normalizeWish));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(contributionsChannel);
    };
  }, [activeGroupId]);

  useEffect(() => {
    async function fetchPassport() {
      if (activeTab !== "all" && activeView === "passport") {
        setIsPassportLoading(true);
        const data = await getMemberDetails(activeTab);
        setActivePassportData(data?.profile || {});
        setIsPassportLoading(false);
      }
    }
    fetchPassport();
  }, [activeTab, activeView]);

  const handleGroupLinked = async (id: string, name: string) => {
    setIsLoading(true);
    setActiveGroupId(id);
    setActiveGroupName(name);
    
    const [dbWishes, groupMembers, userGroups] = await Promise.all([
      getWishesFromDatabase(id),
      getGroupMembers(id),
      getUserGroups()
    ]);

    setGroups(userGroups);
    setItems(dbWishes.map(normalizeWish));
    setMembers(groupMembers);
    setIsLoading(false);
  };

  const copyJoinCode = () => {
    if (!activeGroupId) return;
    navigator.clipboard.writeText(activeGroupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); 
  };

  const handleAddOrEditWish = async (name: string, isInspo: boolean, description: string, url: string, price?: string) => {
    if (!activeGroupId) return;
    try {
      if (editingWish) {
        await updateWishInDatabase(editingWish.id, name, isInspo, description, url);
        setItems(items.map(item => item.id === editingWish.id ? {
          ...item, name, isInspo, description, url
        } : item));
        setEditingWish(null);
      } else {
        const savedWish = await addWishToDatabase(name, isInspo, description, url, activeGroupId, price);
        setItems([normalizeWish(savedWish), ...items.filter(i => i.id !== savedWish.id)]); 
        if (user?.id) updateUrl(user.id, "wishlist");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Oops! Failed to save your wish: " + (err.message || ""));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWishFromDatabase(id);
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      alert("Could not delete item: " + (err.message || ""));
    }
  };

  const handleToggleReserve = async (wishId: number, isCurrentlyReserved: boolean) => {
    try {
      if (isCurrentlyReserved) {
        await unreserveWishInDatabase(wishId);
        setItems(items.map(item => item.id === wishId ? { ...item, reserved_by: null } : item));
      } else {
        const updated = await reserveWishInDatabase(wishId);
        setItems(items.map(item => item.id === wishId ? { ...item, reserved_by: updated.reserved_by } : item));
      }
    } catch (err: any) {
      if (err?.message?.includes("Someone else")) {
        // Refresh list or rely on Realtime sync.
        const freshWishes = await getWishesFromDatabase(activeGroupId!);
        setItems(freshWishes.map(normalizeWish));
        alert("Sorry, someone else just reserved this item.");
      } else {
        alert("Failed to update reservation status.");
      }
    }
  };

  const handleCreateGroupAction = async () => {
    if (!groupNameInput.trim()) return;
    try {
      const newGroup = await createGroup(groupNameInput.trim());
      setGroups(prev => [...prev, { groupId: newGroup.groupId, groupName: newGroup.groupName }]);
      setItems([]);
      setMembers([]);
      setActiveGroupId(newGroup.groupId);
      setActiveGroupName(newGroup.groupName);
      setGroupNameInput("");
      setIsNewGroupModalOpen(false);
    } catch (err: any) {
      alert("Failed to create group workspace: " + (err.message || ""));
    }
  };

  const handleJoinGroupAction = async () => {
    if (!joinCodeInput.trim()) return;
    try {
      const joined = await joinGroup(joinCodeInput.trim());
      setGroups(prev => [...prev, { groupId: joined.groupId, groupName: joined.groupName }]);
      setItems([]);
      setMembers([]);
      setActiveGroupId(joined.groupId);
      setActiveGroupName(joined.groupName);
      setJoinCodeInput("");
      setIsNewGroupModalOpen(false);
    } catch (err: any) {
      alert("Invalid code or you are already a member of this group. " + (err.message || ""));
    }
  };

  const handleUpdateGroup = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGroup || !editGroupInput.trim()) return;
    try {
      await updateGroupInDatabase(editingGroup.id, editGroupInput.trim());
      setGroups(groups.map(g => g.groupId === editingGroup.id ? { ...g, groupName: editGroupInput.trim() } : g));
      if (activeGroupId === editingGroup.id) {
        setActiveGroupName(editGroupInput.trim());
      }
      setEditingGroup(null);
    } catch (err: any) {
      alert("DATABASE ERROR: " + err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    
    const isConfirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete this space.\n\nThis cannot be undone.\n\nAre you sure you want to delete this group?"
    );

    if (!isConfirmed) return;

    try {
      await deleteGroupFromDatabase(editingGroup.id);
      
      const remainingGroups = groups.filter(g => g.groupId !== editingGroup.id);
      setGroups(remainingGroups);
      
      if (activeGroupId === editingGroup.id) {
        if (remainingGroups.length > 0) {
          setActiveGroupId(remainingGroups[0].groupId);
          setActiveGroupName(remainingGroups[0].groupName);
          updateUrl("all", "wishlist");
        } else {
          setActiveGroupId(null);
          setActiveGroupName(null);
          setItems([]);
          setMembers([]);
        }
      }
      setEditingGroup(null);
      setIsNewGroupModalOpen(false);
    } catch (err: any) {
      alert("ERROR: " + err.message);
    }
  };

  const getItemsForUser = (userId: string) => items.filter(item => item.user_id === userId);
  const currentMember = members.find(m => m.id === activeTab);

  if (!isLoading && groups.length === 0 && !activeGroupId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center p-4">
        <GroupOnboarding onGroupLinked={handleGroupLinked} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[url('/bg.jpg')] bg-cover bg-center overflow-hidden relative">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* MODULAR SIDEBAR COMPONENT */}
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeGroupName={activeGroupName}
        activeGroupId={activeGroupId}
        copied={copied}
        onCopyJoinCode={copyJoinCode}
        groups={groups}
        onWorkspaceSwitch={async (id, name) => {
          if (id === activeGroupId) return;
          setIsLoading(true);
          setItems([]);
          setMembers([]);
          setActiveGroupId(id);
          setActiveGroupName(name);
          updateUrl("all", "wishlist");
          const [dbWishes, groupMembers] = await Promise.all([
            getWishesFromDatabase(id),
            getGroupMembers(id)
          ]);
          setItems(dbWishes.map(normalizeWish));
          setMembers(groupMembers);
          setIsLoading(false);
        }}
        onOpenNewGroupModal={() => setIsNewGroupModalOpen(true)}
        onEditGroup={(id, name) => {
          const targetGroup = groups.find(g => g.groupId === id);
          setEditingGroup({ id, name, createdBy: targetGroup?.createdBy });
          setEditGroupInput(name);
        }}
        members={members}
        activeTab={activeTab}
        onUpdateUrl={updateUrl}
        user={user}
        dropdownRef={dropdownRef}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent relative">
        
        <header className="bg-white/75 backdrop-blur-lg border-b border-white/50 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>

            {activeTab === "all" ? (
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Everyone's Wishes</h2>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                <img src={currentMember?.imageUrl} alt={currentMember?.firstName} className="w-6 h-6 rounded-full border hidden sm:block shadow-sm" />
                <h2 className="text-base sm:text-lg font-black text-gray-900 truncate max-w-[100px] sm:max-w-none">{currentMember?.firstName}</h2>
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/60 ml-2 text-[11px] font-bold shrink-0 shadow-inner">
                  <button onClick={() => updateUrl(activeTab, "wishlist")} className={`px-3 py-1 rounded-lg transition-all ${activeView === "wishlist" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>🎁 Wishlist</button>
                  <button onClick={() => updateUrl(activeTab, "passport")} className={`px-3 py-1 rounded-lg transition-all ${activeView === "passport" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>📏 Style Passport</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {activeTab === "all" && (
              <div className="hidden sm:flex bg-white/80 p-1 rounded-lg border border-gray-200/50 shadow-inner">
                <button onClick={() => updateUrl("all", activeView, "list")} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${allWishesLayout === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>📜 List</button>
                <button onClick={() => updateUrl("all", activeView, "gallery")} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${allWishesLayout === "gallery" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>🗂️ Gallery</button>
              </div>
            )}
            {activeView === "wishlist" && (
              <button 
                onClick={() => { setEditingWish(null); setIsModalOpen(true); }} 
                className="bg-[#79AC78] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#618264] transition-colors text-sm shadow-md whitespace-nowrap"
              >
                + Add Wish
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          
          {/* Wishlist View */}
          {activeTab !== "all" && activeView === "wishlist" && (
            <div className="max-w-3xl mx-auto bg-white/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/50 shadow-sm">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                {getItemsForUser(activeTab).length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No items in this list yet.</p>
                ) : (
                  getItemsForUser(activeTab).map(item => (
                    <WishlistCard 
                      key={item.id} 
                      item={item} 
                      onDelete={handleDelete} 
                      onEdit={(item) => { setEditingWish(item); setIsModalOpen(true); }}
                      showDelete={item.user_id === user?.id} 
                      currentUserId={user?.id} 
                      onToggleReserve={handleToggleReserve} 
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* MODULAR PASSPORT COMPONENT */}
          {activeTab !== "all" && activeView === "passport" && (
            <div className="max-w-3xl mx-auto">
              <StylePassportView isLoading={isPassportLoading} passportData={activePassportData} activeTab={activeTab} currentUserId={user?.id} />
            </div>
          )}

          {activeTab === "all" && allWishesLayout === "list" && (
            <div className="space-y-10 max-w-3xl mx-auto bg-white/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/50 shadow-sm">
              {members.map(member => {
                const memberItems = getItemsForUser(member.id);
                if (memberItems.length === 0) return null;
                return (
                  <section key={member.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={member.imageUrl} alt={member.firstName} className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" />
                      <h3 className="text-lg font-black text-[#618264] drop-shadow-sm">{member.firstName}'s List</h3>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                      {memberItems.map(item => (
                        <WishlistCard 
                          key={item.id} 
                          item={item} 
                          onDelete={handleDelete} 
                          onEdit={(item) => { setEditingWish(item); setIsModalOpen(true); }}
                          showDelete={item.user_id === user?.id} 
                          currentUserId={user?.id} 
                          onToggleReserve={handleToggleReserve} 
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
              {items.length === 0 && <p className="text-center text-[#618264] font-medium py-12 text-sm">The group feed is completely empty.</p>}
            </div>
          )}

          {/* Pinterest Gallery Mode */}
          {activeTab === "all" && allWishesLayout === "gallery" && (
            <div className="max-w-7xl mx-auto bg-white/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/50 shadow-sm">
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
                {members.map(member => {
                  const memberItems = getItemsForUser(member.id);
                  if (memberItems.length === 0) return null; 
                  return (
                    <div key={member.id} className="break-inside-avoid bg-white border border-gray-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                          <img src={member.imageUrl} alt={member.firstName} className="w-10 h-10 rounded-full border border-gray-200 shadow-sm" />
                          <div>
                            <h3 className="text-md font-black text-[#618264] leading-tight">{member.firstName}</h3>
                            <p className="text-[10px] font-bold text-[#4A6A4C] uppercase tracking-wide">{memberItems.length} items</p>
                          </div>
                        </div>
                        <button onClick={() => updateUrl(member.id, "passport")} className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 bg-[#D0E7D2] text-[#618264] hover:bg-[#B0D9B1] rounded-xl transition-colors border border-green-100 shadow-sm">View Passport</button>
                      </div>
                      
                      <div className="divide-y divide-gray-100 flex flex-col">
                        {memberItems.map(item => {
                          const isOwnWish = item.user_id === user?.id;
                          return (
                            <div key={item.id} className="py-4 flex flex-col gap-1.5 group relative">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-sm font-bold text-[#618264] leading-tight">{item.name}</span>
                                {item.isInspo && <span className="text-[9px] bg-[#D0E7D2] text-[#618264] font-bold px-2 py-0.5 rounded-full shrink-0 tracking-wider">💫 INSPO</span>}
                              </div>
                              {item.url && (
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#618264] hover:text-[#4A6A4C] hover:underline flex items-center gap-1 w-fit mt-0.5 shrink-0">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" /><path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" /></svg>
                                  {item.isInspo ? "See inspiration vibe" : "Buy exactly this"}
                                </a>
                              )}
                              {item.description && <p className="text-xs bg-white text-[#618264] italic mt-1 chunk wrap-break-word">"{item.description}"</p>}


                              
                              <div className="mt-2 flex items-center justify-between w-full h-6">
                                {!isOwnWish && (
                                  item.reserved_by === user?.id ? (
                                    <button onClick={() => handleToggleReserve(item.id, true)} className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">Reserved by You ✓</button>
                                  ) : item.reserved_by ? (
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">🔒 Claimed</span>
                                  ) : (
                                    <button onClick={() => handleToggleReserve(item.id, false)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md border border-blue-100 transition-colors">Reserve Gift 🎁</button>
                                  )
                                )}
                                {isOwnWish && (
                                  <div className="flex gap-2 ml-auto">
                                    <button onClick={() => { setEditingWish(item); setIsModalOpen(true); }} className="text-[10px] font-bold text-[#618264] hover:text-[#4A6A4C] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-white border-r border-gray-100 pr-2">Edit</button>
                                    <button onClick={() => handleDelete(item.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">Remove</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODULAR WISH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100">
            <AddGiftForm initialData={editingWish} onSubmit={handleAddOrEditWish} onClose={() => { setIsModalOpen(false); setEditingWish(null); }} />
          </div>
        </div>
      )}

      {/* EDIT GROUP NAME MODAL */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100 p-6 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-[#618264] text-base">Edit Group</h3>
              <button onClick={() => setEditingGroup(null)} className="text-gray-400 hover:text-[#618264] text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleUpdateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#618264] mb-2">Group Name</label>
                <input 
                  type="text" 
                  value={editGroupInput}
                  onChange={(e) => setEditGroupInput(e.target.value)}
                  className="w-full border text-sm rounded-xl p-2.5 bg-gray-50 text-[#618264] focus:outline-none focus:border-green-300"
                  required
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="submit"
                  className="w-full bg-[#618264] text-white font-bold text-sm py-2.5 rounded-xl hover:bg-[#4A6A4C] transition-colors"
                >
                  Save Changes
                </button>
                
                {/* SECURITY CHECK: Only show the delete button to the creator */}
                {editingGroup.createdBy === user?.id && (
                  <button 
                    type="button"
                    onClick={handleDeleteGroup}
                    className="w-full bg-red-50 text-red-600 font-bold text-sm py-2.5 rounded-xl hover:bg-red-100 transition-colors border border-red-100 mt-2"
                  >
                    Delete Entire Group
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODULAR MANAGE SPACES MODAL */}
      <GroupsModal 
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        groupNameInput={groupNameInput}
        setGroupNameInput={setGroupNameInput}
        joinCodeInput={joinCodeInput}
        setJoinCodeInput={setJoinCodeInput}
        onCreateGroup={handleCreateGroupAction}
        onJoinGroup={handleJoinGroupAction}
      />

      {/* FLOATING GIFT ASSISTANT CHATBOT */}
      {activeGroupId && (
        <GiftAssistantChat friendId={activeTab} groupId={activeGroupId} />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
        <div className="w-8 h-8 border-2 border-[#618264] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}