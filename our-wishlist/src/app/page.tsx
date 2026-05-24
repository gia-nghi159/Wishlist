"use client";

import { useState } from "react";
import AddGiftForm from "../components/AddGiftForm";
import WishlistCard from "../components/WishlistCard";

export default function Home() {
  const [items, setItems] = useState([
    { id: 1, name: "Matcha Latte Kit", isInspo: true, description: "I love the Chamberlain Coffee brand vibes.", url: "" },
    { id: 2, name: "Logitech MX Master 3S", isInspo: false, description: "Pale gray color please!", url: "https://logitech.com" },
  ]);

  // NEW: The state to control our popup window
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddItem = (name: string, isInspo: boolean, description: string, url: string) => {
    const newItem = { id: items.length + 1, name, isInspo, description, url };
    setItems([newItem, ...items]); 
  };

  const handleDelete = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      
      {/* 1. THE HEADER */}
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold text-gray-900">Our Wishlist 🎁</h1>
        
        {/* The beautiful Add Wish button */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-gray-800 transition-colors shadow-sm"
        >
          + Add Wish
        </button>
      </div>

      {/* 2. THE UNIFIED LIST (Apple / Notion Vibe) */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-12">Your wishlist is empty! Add something above.</p>
        ) : (
          items.map((item) => (
            <WishlistCard 
              key={item.id} 
              item={item} 
              onDelete={handleDelete} 
            />
          ))
        )}
      </div>

      {/* 3. THE MODAL POPUP (Only renders if isModalOpen is true) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
          {/* The actual white box */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <AddGiftForm 
              onAddItem={handleAddItem} 
              onClose={() => setIsModalOpen(false)} // Pass the close function!
            />
          </div>
        </div>
      )}

    </main>
  );
}