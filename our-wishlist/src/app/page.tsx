"use client";

import { useState, useEffect } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs"; 
import AddGiftForm from "../components/AddGiftForm";
import WishlistCard from "../components/WishlistCard";
import GroupOnboarding from "../components/GroupOnboarding";
import { addWishToDatabase, deleteWishFromDatabase, getWishesFromDatabase, checkUserGroup } from "./actions";

type WishItem = {
  id: number;
  name: string;
  isInspo: boolean;
  description: string;
  url: string;
};

export default function Home() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null); // Save Join Code in state
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    async function initializeApp() {
      if (isLoaded && isSignedIn) {
        setIsLoading(true);
        const activeGroup = await checkUserGroup();
        
        if (activeGroup) {
          setActiveGroupName(activeGroup.groupName);
          setActiveGroupId(activeGroup.groupId);
          const dbWishes = await getWishesFromDatabase();
          
          const formattedWishes = dbWishes.map((wish: any) => ({
            id: wish.id,
            name: wish.name,
            description: wish.description || "",
            url: wish.url || "",
            isInspo: wish.is_inspo,
          }));
          setItems(formattedWishes);
        }
        setIsLoading(false);
      } else if (isLoaded && !isSignedIn) {
        setIsLoading(false);
      }
    }
    initializeApp();
  }, [isLoaded, isSignedIn]);

  const handleGroupLinked = async (id: string, name: string) => {
    setIsLoading(true);
    setActiveGroupId(id);
    setActiveGroupName(name);
    const dbWishes = await getWishesFromDatabase();
    setItems(dbWishes.map((wish: any) => ({
      id: wish.id,
      name: wish.name,
      description: wish.description || "",
      url: wish.url || "",
      isInspo: wish.is_inspo,
    })));
    setIsLoading(false);
  };

  const copyJoinCode = () => {
    if (!activeGroupId) return;
    navigator.clipboard.writeText(activeGroupId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset message after 2 seconds
  };

  const handleAddItem = async (name: string, isInspo: boolean, description: string, url: string) => {
    try {
      const savedWish = await addWishToDatabase(name, isInspo, description, url);
      const newDisplayItem: WishItem = {
        id: savedWish.id,
        name: savedWish.name,
        description: savedWish.description || "",
        url: savedWish.url || "",
        isInspo: savedWish.is_inspo,
      };
      setItems([newDisplayItem, ...items]); 
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

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Securing channel...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-md mx-auto text-center my-32 p-8">
        <h1 className="text-4xl font-black text-gray-900 mb-4">Our Wishlist 🎁</h1>
        <p className="text-gray-500 mb-8 text-sm">A private, shared space to sync gift ideas perfectly.</p>
        <SignInButton mode="modal">
          <button className="bg-gray-950 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all">
            Get Started
          </button>
        </SignInButton>
      </div>
    );
  }

  if (!activeGroupName) {
    return <GroupOnboarding onGroupLinked={handleGroupLinked} />;
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      
      {/* HEADER SECTION WITH REVEAL/COPY CAPABILITIES */}
      <div className="flex justify-between items-start mb-8 border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Our Wishlist 🎁</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs text-gray-400 font-medium">
            <p>Space: <span className="text-gray-600 font-semibold">{activeGroupName}</span></p>
            <span className="hidden sm:inline text-gray-300">|</span>
            
            {/* Click-to-copy utility engine */}
            <button 
              onClick={copyJoinCode}
              className="text-left font-mono hover:text-gray-700 bg-gray-100 hover:bg-gray-200/70 transition-colors px-2 py-0.5 rounded text-gray-500 flex items-center gap-1.5 w-fit"
              title="Click to copy your invite code"
            >
              <span>Code: {activeGroupId?.slice(0, 8)}...</span>
              <span className="text-[10px] font-sans font-bold uppercase text-blue-600 bg-blue-50 px-1 rounded border border-blue-200">
                {copied ? "Copied! ✓" : "Copy"}
              </span>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-gray-950 text-white px-5 py-2 rounded-full font-semibold hover:bg-gray-800 transition-colors text-sm"
          >
            + Add Wish
          </button>
          <UserButton /> 
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No items inside this shared list yet.</p>
        ) : (
          items.map((item) => (
            <WishlistCard key={item.id} item={item} onDelete={handleDelete} />
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <AddGiftForm onAddItem={handleAddItem} onClose={() => setIsModalOpen(false)} />
          </div>
        </div>
      )}
    </main>
  );
}