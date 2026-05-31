"use client";

import { useState } from "react";

type AddGiftFormProps = {
  onSubmit: (name: string, isInspo: boolean, description: string, url: string) => void;
  onClose: () => void; 
  initialData?: { name: string; isInspo: boolean; description: string; url: string } | null;
};

export default function AddGiftForm({ onSubmit, onClose, initialData }: AddGiftFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [url, setUrl] = useState(initialData?.url || "");
  const [isInspo, setIsInspo] = useState(initialData?.isInspo || false);
  const [description, setDescription] = useState(initialData?.description || "");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name) return;

    onSubmit(name, isInspo, description, url);

    if (!initialData) {
      setName("");
      setUrl("");
      setIsInspo(false);
      setDescription("");
    }
    
    onClose(); 
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#618264]">
          {initialData ? "Edit Wish" : "Add a new wish"}
        </h2>
        <button 
          type="button" 
          onClick={onClose}
          className="text-[#618264] text-3xl leading-none transition-colors hover:text-[#4A6A4C]"
        >
          &times;
        </button>
      </div>
      
      <div className="space-y-4">
        <input 
          type="text" 
          placeholder="What do you want?" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 border border-[#D0E7D2] rounded-lg bg-gray-50 focus:bg-white text-[#618264] focus:outline-none focus:ring-2 focus:ring-[#D0E7D2] transition-colors"
          required
        />
        
        <textarea 
          placeholder="Add some details or notes... (Optional)" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-3 border border-[#D0E7D2] rounded-lg bg-gray-50 focus:bg-white text-[#618264] focus:outline-none focus:ring-2 focus:ring-[#D0E7D2] resize-none transition-colors"
          rows={3}
        />

        <input 
          type="url" 
          placeholder="Link (optional)" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3 border border-[#D0E7D2] rounded-lg bg-gray-50 focus:bg-white text-[#618264] focus:outline-none focus:ring-2 focus:ring-[#D0E7D2] transition-colors"
        />

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-[#D0E7D2]">
          <span className="font-medium text-[#618264] flex items-center gap-2">
            💫 Inspiration Only <span className="text-[10px] font-bold uppercase text-[#4A6A4C] opacity-70">(Vibe matters most)</span>
          </span>
          <button
            type="button"
            onClick={() => setIsInspo(!isInspo)}
            className={`${
              isInspo ? "bg-[#618264]" : "bg-[#D0E7D2]"
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
          >
            <span
              className={`${
                isInspo ? "translate-x-6" : "translate-x-1"
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>

        <button 
          type="submit" 
          className="w-full bg-[#618264] text-white font-semibold py-3 rounded-lg hover:bg-[#4A6A4C] transition-colors mt-4 shadow-md"
        >
          {initialData ? "Save Changes" : "Add to Wishlist"}
        </button>
      </div>
    </form>
  );
}