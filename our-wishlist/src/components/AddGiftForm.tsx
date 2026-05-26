"use client";

import { useState } from "react";

type AddGiftFormProps = {
  onAddItem: (name: string, isInspo: boolean, description: string, url: string) => void;
  onClose: () => void; 
};

export default function AddGiftForm({ onAddItem, onClose }: AddGiftFormProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [isInspo, setIsInspo] = useState(false);
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name) return;

    onAddItem(name, isInspo, description, url);

    setName("");
    setUrl("");
    setIsInspo(false);
    setDescription("");
    
    onClose(); 
  };

  return (
    <form onSubmit={handleSubmit} className="p-6">
      
      {/* Gift Form */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#618264]">Add a new wish</h2>
        <button 
          type="button" 
          onClick={onClose}
          className="text-[#618264] text-3xl leading-none transition-colors"
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
          className="w-full p-3 border rounded-lg bg-[#D0E7D2] focus:bg-[#B0D9B1] transition-colors"
          required
        />
        
        <textarea 
          placeholder="Add some details or notes... (Optional)" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-3 border rounded-lg bg-[#D0E7D2] focus:bg-[#B0D9B1] resize-none transition-colors"
          rows={3}
        />

        <input 
          type="url" 
          placeholder="Link (optional)" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3 border rounded-lg bg-[#D0E7D2] focus:bg-[#B0D9B1] transition-colors"
        />

        <div className="flex items-center justify-between p-3 bg-[#D0E7D2] rounded-lg border">
          <span className="font-medium text-gray-700 flex items-center gap-2">
            💫 Inspiration Only <span className="text-sm font-normal text-gray-600">(Vibe matters most)</span>
          </span>
          <button
            type="button"
            onClick={() => setIsInspo(!isInspo)}
            className={`${
              isInspo ? "bg-[#618264]" : "bg-[#B0D9B1]"
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
          Add to Wishlist
        </button>
      </div>
    </form>
  );
}