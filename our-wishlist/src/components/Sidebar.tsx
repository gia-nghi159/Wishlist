"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

interface GroupWorkspace {
  groupId: string;
  groupName: string;
  createdBy?: string | null; // Added to match the new database creator rules
}

interface GroupMember {
  id: string;
  firstName: string;
  imageUrl: string;
  isMe: boolean;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  activeGroupName: string | null;
  activeGroupId: string | null;
  copied: boolean;
  onCopyJoinCode: () => void;
  groups: GroupWorkspace[];
  onWorkspaceSwitch: (groupId: string, groupName: string) => void;
  onOpenNewGroupModal: () => void;
  onEditGroup: (groupId: string, groupName: string) => void;
  members: GroupMember[];
  activeTab: string;
  onUpdateUrl: (tab: string, view: string) => void;
  user: any;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeGroupName,
  activeGroupId,
  copied,
  onCopyJoinCode,
  groups,
  onWorkspaceSwitch,
  onOpenNewGroupModal,
  onEditGroup,
  members,
  activeTab,
  onUpdateUrl,
  user,
  dropdownRef,
}: SidebarProps) {
  return (
    <>
      <aside 
        ref={dropdownRef as any}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/60 backdrop-blur-md transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col border-r border-white/50 shadow-lg ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 pb-2">
          <h1 className="text-xl font-black text-[#618264] tracking-tight mb-10 mt-5 drop-shadow-sm">{activeGroupName} 🎁</h1>          
          <button 
            onClick={onCopyJoinCode}
            className="w-full flex items-center justify-between bg-white/50 hover:bg-white/80 transition-colors px-3 py-2 rounded-lg text-sm border border-white/50 group shadow-sm"
          >
            <span className="font-mono font-medium text-[#618264] group-hover:text-[#4A6A4C]">Code: {activeGroupId?.slice(0, 6)}</span>
            {copied ? (
              <span className="text-white font-bold text-xs bg-[#618264] px-2 py-0.5 rounded shadow-sm">Copied! ✓</span>
            ) : (
              <span className="text-[#618264] group-hover:text-[#4A6A4C] font-bold text-xs uppercase">Copy</span>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
          <div>
            <div className="px-3 flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-bold text-[#618264] uppercase tracking-wider">Groups ({groups.length})</h2>
              <button 
                onClick={onOpenNewGroupModal}
                className="text-[10px] text-[#618264] hover:text-[#4A6A4C] font-bold uppercase tracking-wider transition-colors bg-white/40 hover:bg-white/80 px-2 py-1 rounded-md border border-white/40"
              >
                + Create/ Join
              </button>
            </div>
            <div className="space-y-1 max-h-35 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.groupId} className="relative group flex items-center">
                  <button
                    onClick={() => onWorkspaceSwitch(g.groupId, g.groupName)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate pr-8 ${
                      activeGroupId === g.groupId ? "bg-[#618264] text-white font-bold shadow-sm" : "hover:bg-white/60 text-[#4A6A4C] hover:text-[#618264] font-medium"
                    }`}
                  >
                    <span className="text-xs">🎉</span>
                    <span className="truncate">{g.groupName}</span>
                  </button>
                  <button 
                    onClick={() => onEditGroup(g.groupId, g.groupName)}
                    className={`absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/50 ${activeGroupId === g.groupId ? "text-white" : "text-[#618264]"}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M2.695 14.763l-1.262 3.152a.5.5 0 00.65.65l3.152-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="px-3 text-[10px] font-bold text-[#618264] uppercase tracking-wider mb-2">Feeds</h2>
            <button
              onClick={() => { onUpdateUrl("all", "wishlist"); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === "all" ? "bg-[#618264] text-white font-bold shadow-sm" : "hover:bg-white/60 text-[#4A6A4C] hover:text-[#618264] font-medium"
              }`}
            >
              🔥 All Wishes
            </button>
          </div>

          <div>
            <h2 className="px-3 text-[10px] font-bold text-[#618264] uppercase tracking-wider mb-2">Members ({members.length})</h2>
            <div className="space-y-1">
              {members.map((m) => (
                <button 
                  key={m.id}
                  onClick={() => { onUpdateUrl(m.id, "wishlist"); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left truncate ${
                    activeTab === m.id ? "bg-[#618264] text-white font-bold shadow-sm" : "hover:bg-white/60 text-[#4A6A4C] hover:text-[#618264] font-medium"
                  }`}
                >
                  <img src={m.imageUrl} alt={m.firstName} className="w-5 h-5 rounded-full border border-white/50 shrink-0 shadow-sm" />
                  <span className="truncate">
                    {m.firstName} {m.isMe && <span className={`text-[10px] font-normal ${activeTab === m.id ? "text-green-100" : "text-[#618264]/70"}`}>(You)</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-4 bg-white/40 backdrop-blur-md border-t border-white/50 flex items-center gap-3">
          <UserButton appearance={{ elements: { userButtonPopoverActionButton__manageAccount: { display: "none" } } }}>
            <UserButton.MenuItems>
              <UserButton.Link label="My Style Passport" href="/profile" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-2"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>} />
            </UserButton.MenuItems>
          </UserButton>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#618264]">{user?.firstName}</span>
            <Link href="/profile" className="text-[10px] text-[#4A6A4C] hover:text-[#618264] font-medium transition-colors">Edit Profile</Link>
          </div>
        </div>
      </aside>
    </>
  );
}