"use client";

interface GroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupNameInput: string;
  setGroupNameInput: (val: string) => void;
  joinCodeInput: string;
  setJoinCodeInput: (val: string) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
}

export default function GroupsModal({
  isOpen,
  onClose,
  groupNameInput,
  setGroupNameInput,
  joinCodeInput,
  setJoinCodeInput,
  onCreateGroup,
  onJoinGroup,
}: GroupsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100 p-6 space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-black text-[#618264] text-base">Manage Spaces</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[#618264] text-sm font-bold">X</button>
        </div>
        
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#618264]">Create a New Wishlist Group</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g., Family, Friends" 
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              className="flex-1 border text-sm rounded-xl p-2.5 bg-gray-50 text-[#618264] focus:outline-none focus:border-green-300"
            />
            <button 
              onClick={onCreateGroup}
              className="bg-[#618264] text-white font-bold text-xs px-4 rounded-xl hover:bg-[#4A6A4C] transition-colors"
            >
              Create
            </button>
          </div>
        </div>
        
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#618264]">Join an Existing Shared Space</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Paste group code here" 
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              className="flex-1 border text-sm rounded-xl p-2.5 bg-gray-50 text-[#618264] focus:outline-none focus:border-[#618264]"
            />
            <button 
              onClick={onJoinGroup}
              className="bg-[#618264] text-white font-bold text-xs px-4 rounded-xl hover:bg-[#4A6A4C] transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}