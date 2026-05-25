"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

type OnboardingProps = {
  // Pass both pieces of data back to the main layout
  onGroupLinked: (groupId: string, groupName: string) => void;
};

export default function GroupOnboarding({ onGroupLinked }: OnboardingProps) {
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { signOut } = useClerk();

  const handleCreate = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setIsCreating(true);
    try {
      const { createGroup } = await import("../app/actions");
      const res = await createGroup(groupName);
      onGroupLinked(res.groupId, res.groupName);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsJoining(true);
    try {
      const { joinGroup } = await import("../app/actions");
      const res = await joinGroup(joinCode);
      onGroupLinked(res.groupId, res.groupName);
    } catch (err: any) {
      alert("Invalid Join Code. Make sure it matches perfectly.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-16 p-8 bg-white border border-gray-200 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Our Wishlist! 🎁</h2>
      <p className="text-gray-500 text-sm mb-8">To get started, you need to connect into a shared private space with your partner.</p>

      {/* OPTION A: CREATE A NEW GROUP */}
      <form onSubmit={handleCreate} className="mb-8 pb-8 border-b border-gray-100">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Option 1: Start a New List</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="e.g., Our Dream List" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            disabled={isJoining}
          />
          <button 
            type="submit" 
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
            disabled={isCreating || isJoining}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      {/* OPTION B: JOIN AN EXISTING GROUP */}
      <form onSubmit={handleJoin} className="mb-6">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Option 2: Join Your Partner's List</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Paste Join Code here" 
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-xs"
            disabled={isCreating}
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            disabled={isCreating || isJoining}
          >
            {isJoining ? "Joining..." : "Join"}
          </button>
        </div>
      </form>

      <button 
        onClick={() => signOut()} 
        className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 underline"
      >
        Log out
      </button>
    </div>
  );
}