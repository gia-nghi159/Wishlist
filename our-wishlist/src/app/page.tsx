"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"; 
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import AddGiftForm from "../components/AddGiftForm";
import WishlistCard from "../components/WishlistCard";
import GroupOnboarding from "../components/GroupOnboarding";
import { addWishToDatabase, deleteWishFromDatabase, getWishesFromDatabase, checkUserGroup, getGroupMembers, getMemberDetails, reserveWishInDatabase, unreserveWishInDatabase } from "./actions";

type WishItem = { id: number; name: string; isInspo: boolean; description: string; url: string; user_id: string; reserved_by?: string | null; };
type GroupMember = { id: string; firstName: string; imageUrl: string; isMe: boolean; };

function DashboardContent() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]); 
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // URL STATE NAVIGATION
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get("tab") || "all";
  const activeView = searchParams.get("view") || "wishlist";
  const allWishesLayout = searchParams.get("layout") || "list";

  const updateUrl = (tab: string, view: string, layout: string = allWishesLayout) => {
    router.push(`${pathname}?tab=${tab}&view=${view}&layout=${layout}`, { scroll: false });
  };
  
  // Passport Data Fetching State
  const [activePassportData, setActivePassportData] = useState<any>(null);
  const [isPassportLoading, setIsPassportLoading] = useState(false);

  // Mobile Sidebar Toggle
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

  useEffect(() => {
    async function initializeApp() {
      if (isLoaded && isSignedIn) {
        setIsLoading(true);
        const activeGroup = await checkUserGroup();
        
        if (activeGroup) {
          setActiveGroupName(activeGroup.groupName);
          setActiveGroupId(activeGroup.groupId);
          
          const [dbWishes, groupMembers] = await Promise.all([
            getWishesFromDatabase(),
            getGroupMembers(activeGroup.groupId)
          ]);
          
          setItems(dbWishes.map((wish: any) => ({
            id: wish.id, name: wish.name, description: wish.description || "",
            url: wish.url || "", isInspo: wish.is_inspo, user_id: wish.user_id || "",
            reserved_by: wish.reserved_by || null
          })));
          
          setMembers(groupMembers);
        }
        setIsLoading(false);
      } else if (isLoaded && !isSignedIn) {
        setIsLoading(false);
      }
    }
    initializeApp();
  }, [isLoaded, isSignedIn]);

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
    
    const [dbWishes, groupMembers] = await Promise.all([
      getWishesFromDatabase(),
      getGroupMembers(id)
    ]);

    setItems(dbWishes.map((wish: any) => ({
      id: wish.id, name: wish.name, description: wish.description || "",
      url: wish.url || "", isInspo: wish.is_inspo, user_id: wish.user_id || "",
      reserved_by: wish.reserved_by || null
    })));
    setMembers(groupMembers);
    setIsLoading(false);
  };

  const copyJoinCode = () => {
    if (!activeGroupId) return;
    navigator.clipboard.writeText(activeGroupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); 
  };

  const handleAddItem = async (name: string, isInspo: boolean, description: string, url: string) => {
    try {
      const savedWish = await addWishToDatabase(name, isInspo, description, url);
      setItems([{
        id: savedWish.id, name: savedWish.name, description: savedWish.description || "",
        url: savedWish.url || "", isInspo: savedWish.is_inspo, user_id: user?.id || "",
        reserved_by: null
      }, ...items]); 
      setIsModalOpen(false);

      if (user?.id) {
        updateUrl(user.id, "wishlist");
      }
    } catch (err) {
      alert("Oops! Failed to save your wish.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWishFromDatabase(id);
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert("Could not delete item.");
    }
  };

  // NEW REACTIVE TOGGLER ENGINE
  const handleToggleReserve = async (wishId: number, isCurrentlyReserved: boolean) => {
    try {
      if (isCurrentlyReserved) {
        await unreserveWishInDatabase(wishId);
        setItems(items.map(item => item.id === wishId ? { ...item, reserved_by: null } : item));
      } else {
        await reserveWishInDatabase(wishId);
        setItems(items.map(item => item.id === wishId ? { ...item, reserved_by: user?.id || null } : item));
      }
    } catch (err) {
      alert("Failed to update reservation status.");
    }
  };

  const getItemsForUser = (userId: string) => items.filter(item => item.user_id === userId);
  const currentMember = members.find(m => m.id === activeTab);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-gray-300 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col border-r border-gray-800 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 pb-2">
          <h1 className="text-xl font-black text-white tracking-tight mb-1">Our Wishlist 🎁</h1>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">{activeGroupName}</p>
          
          <button 
            onClick={copyJoinCode}
            className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors px-3 py-2 rounded-lg text-sm border border-gray-700/50 group"
          >
            <span className="font-mono text-gray-400 group-hover:text-gray-200">Code: {activeGroupId?.slice(0, 6)}</span>
            {copied ? (
              <span className="text-green-400 font-bold text-xs bg-green-400/10 px-2 py-0.5 rounded">Copied! ✓</span>
            ) : (
              <span className="text-gray-500 group-hover:text-gray-300 font-bold text-xs uppercase">Copy</span>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
          <div>
            <h2 className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Feeds</h2>
            <button
              onClick={() => { updateUrl("all", "wishlist"); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "all" ? "bg-gray-800 text-white" : "hover:bg-gray-800/50 hover:text-gray-100"
              }`}
            >
              🔥 All Wishes
            </button>
          </div>

          <div>
            <h2 className="px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Members ({members.length})</h2>
            <div className="space-y-1">
              {members.map((m) => (
                <button 
                  key={m.id}
                  onClick={() => { updateUrl(m.id, "wishlist"); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate ${
                    activeTab === m.id ? "bg-gray-800 text-white font-bold" : "hover:bg-gray-800/30 text-gray-300 hover:text-gray-100 font-medium"
                  }`}
                >
                  <img src={m.imageUrl} alt={m.firstName} className="w-5 h-5 rounded-full border border-gray-700 shrink-0" />
                  <span className="truncate">{m.firstName} {m.isMe && <span className="text-[10px] text-gray-500 font-normal">(You)</span>}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 bg-gray-950 border-t border-gray-800 flex items-center gap-3">
          <UserButton appearance={{ elements: { userButtonPopoverActionButton__manageAccount: { display: "none" } } }}>
            <UserButton.MenuItems>
              <UserButton.Link label="My Style Passport" href="/profile" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-2"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>} />
            </UserButton.MenuItems>
          </UserButton>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">{user?.firstName}</span>
            <Link href="/profile" className="text-[10px] text-gray-400 hover:text-white">Edit Profile</Link>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 relative">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>

            {activeTab === "all" ? (
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Everyone's Wishes</h2>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                <img src={currentMember?.imageUrl} alt={currentMember?.firstName} className="w-6 h-6 rounded-full border hidden sm:block shadow-sm" />
                <h2 className="text-base sm:text-lg font-black text-gray-900 truncate max-w-[100px] sm:max-w-none">{currentMember?.firstName}</h2>
                
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/60 ml-2 text-[11px] font-bold shrink-0 shadow-inner">
                  <button 
                    onClick={() => updateUrl(activeTab, "wishlist")}
                    className={`px-3 py-1 rounded-lg transition-all ${activeView === "wishlist" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    🎁 Wishlist
                  </button>
                  <button 
                    onClick={() => updateUrl(activeTab, "passport")}
                    className={`px-3 py-1 rounded-lg transition-all ${activeView === "passport" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
                  >
                    📏 Style Passport
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {activeTab === "all" && (
              <div className="hidden sm:flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button 
                  onClick={() => updateUrl("all", activeView, "list")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${allWishesLayout === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  📜 List
                </button>
                <button 
                  onClick={() => updateUrl("all", activeView, "gallery")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${allWishesLayout === "gallery" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  🗂️ Gallery
                </button>
              </div>
            )}
            
            {activeView === "wishlist" && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-gray-950 text-white px-5 py-2 rounded-full font-semibold hover:bg-gray-800 transition-colors text-sm shadow-md whitespace-nowrap"
              >
                + Add Wish
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          
          {/* Wishlist View */}
          {activeTab !== "all" && activeView === "wishlist" && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 max-w-3xl mx-auto">
              {getItemsForUser(activeTab).length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">No items in this list yet.</p>
              ) : (
                getItemsForUser(activeTab).map(item => (
                  <WishlistCard 
                    key={item.id} 
                    item={item} 
                    onDelete={handleDelete} 
                    showDelete={item.user_id === user?.id} 
                    currentUserId={user?.id}
                    onToggleReserve={handleToggleReserve}
                  />
                ))
              )}
            </div>
          )}

          {/* Passport View */}
          {activeTab !== "all" && activeView === "passport" && (
            <div className="max-w-3xl mx-auto">
              {isPassportLoading ? (
                <div className="flex justify-center py-20">
                   <div className="w-8 h-8 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8">
                  <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                     <h2 className="text-xl font-bold text-gray-900">Style Passport</h2>
                     {activeTab === user?.id && (
                       <Link href="/profile" className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg">Edit My Passport</Link>
                     )}
                  </div>
                  <div className="space-y-10">
                    <Section title={`The Blueprint (${activePassportData?.preferred_unit || 'Inches'})`}>
                      <DetailItem label="Height" value={activePassportData?.height} />
                      <DetailItem label="Weight" value={activePassportData?.weight} />
                      <DetailItem label="Chest / Bust" value={activePassportData?.chest} />
                      <DetailItem label="Waist" value={activePassportData?.waist} />
                      <DetailItem label="Inseam" value={activePassportData?.inseam} />
                    </Section>
                    <Section title="The Details">
                      <DetailItem label="Shoe Size" value={activePassportData?.shoe_size} />
                      <DetailItem label="Ring Size" value={activePassportData?.ring_size} />
                      <DetailItem label="Preferred Fit" value={activePassportData?.preferred_fit} />
                    </Section>
                    <Section title="The Vibe">
                      <DetailItem label="Metal Preference" value={activePassportData?.metal_preference} />
                      <DetailItem label="Style in 3 Words" value={activePassportData?.style_words} />
                      <DetailItem label="Favorite Brands" value={activePassportData?.favorite_brands} />
                      <DetailItem label="Dealbreakers" value={activePassportData?.dealbreakers} />
                    </Section>
                    <Section title="General Notes">
                      <div className="col-span-full">
                        <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                          {activePassportData?.notes || <span className="text-gray-300 italic">No additional notes provided.</span>}
                        </p>
                      </div>
                    </Section>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feed List Mode */}
          {activeTab === "all" && allWishesLayout === "list" && (
            <div className="space-y-10 max-w-3xl mx-auto">
              {members.map(member => {
                const memberItems = getItemsForUser(member.id);
                if (memberItems.length === 0) return null;
                
                return (
                  <section key={member.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={member.imageUrl} alt={member.firstName} className="w-8 h-8 rounded-full border border-gray-200 shadow-sm" />
                      <h3 className="text-lg font-black text-gray-900">{member.firstName}'s List</h3>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                      {memberItems.map(item => (
                        <WishlistCard 
                          key={item.id} 
                          item={item} 
                          onDelete={handleDelete} 
                          showDelete={item.user_id === user?.id} 
                          currentUserId={user?.id}
                          onToggleReserve={handleToggleReserve}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
              {items.length === 0 && <p className="text-center text-gray-400 py-12 text-sm">The group feed is completely empty.</p>}
            </div>
          )}

          {/* Pinterest Gallery Mode */}
          {activeTab === "all" && allWishesLayout === "gallery" && (
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
                          <h3 className="text-md font-black text-gray-900 leading-tight">{member.firstName}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{memberItems.length} items</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => updateUrl(member.id, "passport")}
                        className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors border border-gray-100 shadow-sm"
                      >
                        View Passport
                      </button>
                    </div>
                    
                    <div className="divide-y divide-gray-100 flex flex-col">
                      {memberItems.map(item => {
                        const isOwnWish = item.user_id === user?.id;
                        return (
                          <div key={item.id} className="py-4 flex flex-col gap-1.5 group relative">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-sm font-bold text-gray-900 leading-tight">{item.name}</span>
                              {item.isInspo && <span className="text-[9px] bg-purple-100 text-purple-700 font-black uppercase px-2 py-0.5 rounded-full shrink-0 tracking-wider">Inspo</span>}
                            </div>
                            
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 w-fit">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" /><path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" /></svg>
                                {item.isInspo ? "See inspiration vibe" : "Buy exactly this"}
                              </a>
                            )}
                            {item.description && <p className="text-xs text-gray-500 mt-1 italic leading-snug">"{item.description}"</p>}
                            
                            {/* TARGET GALLERY INLINE CONTROLS */}
                            <div className="mt-2 flex items-center justify-between w-full h-6">
                              {!isOwnWish && (
                                item.reserved_by === user?.id ? (
                                  <button 
                                    onClick={() => handleToggleReserve(item.id, true)}
                                    className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200"
                                  >
                                    Reserved by You ✓
                                  </button>
                                ) : item.reserved_by ? (
                                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
                                    🔒 Claimed
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => handleToggleReserve(item.id, false)}
                                    className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md border border-blue-100 transition-colors"
                                  >
                                    Reserve Gift 🎁
                                  </button>
                                )
                              )}

                              {isOwnWish && (
                                <button 
                                  onClick={() => handleDelete(item.id)}
                                  className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2"
                                >
                                  Remove
                                </button>
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
          )}

        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100">
            <AddGiftForm onAddItem={handleAddItem} onClose={() => setIsModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
        {children}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</h4>
      <p className="text-sm font-medium text-gray-900">
        {value ? value : <span className="text-gray-300 italic">Not set</span>}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}