"use client";

import { useState, useEffect } from "react";
import { UserProfile, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { getUserProfile, updateUserProfile } from "../actions";

export default function ProfilePage() {
  // Pull the active user's avatar and name directly from Clerk
  const { user } = useUser();

  // UI States
  const [activeTab, setActiveTab] = useState<"passport" | "account">("passport");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Data States
  const [unit, setUnit] = useState("Inches");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [inseam, setInseam] = useState("");
  const [shoe, setShoe] = useState("");
  const [ring, setRing] = useState("");
  const [fit, setFit] = useState("");
  const [metal, setMetal] = useState("");
  const [brands, setBrands] = useState("");
  const [dealbreakers, setDealbreakers] = useState("");
  const [words, setWords] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const data = await getUserProfile();
      if (data) {
        setUnit(data.preferred_unit || "Inches");
        setHeight(data.height || "");
        setWeight(data.weight || "");
        setChest(data.chest || "");
        setWaist(data.waist || "");
        setInseam(data.inseam || "");
        setShoe(data.shoe_size || "");
        setRing(data.ring_size || "");
        setFit(data.preferred_fit || "");
        setMetal(data.metal_preference || "");
        setBrands(data.favorite_brands || "");
        setDealbreakers(data.dealbreakers || "");
        setWords(data.style_words || "");
        setNotes(data.notes || "");
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUserProfile({
        preferred_unit: unit, height, weight, chest, waist, inseam,
        shoe_size: shoe, ring_size: ring, preferred_fit: fit,
        metal_preference: metal, favorite_brands: brands, dealbreakers,
        style_words: words, notes
      });
      setIsEditing(false);
    } catch (err) {
      alert("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-8 min-h-screen bg-gray-50">
      
      {/* HEADER & NAVIGATION (Now with User Avatar!) */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Clerk Profile Picture Display */}
          {user?.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt="Profile" 
              className="w-16 h-16 rounded-full border-2 border-white shadow-md object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-white shadow-md animate-pulse" />
          )}
          
          <div>
            <h1 className="text-3xl font-black text-gray-900">
              My Space 🪐
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage your account and personal style metrics.</p>
          </div>
        </div>
        
        <Link href="/" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-white px-5 py-2 border border-gray-200 rounded-full shadow-sm">
          ← Back to Wishlist
        </Link>
      </div>

      {/* TAB BUTTONS */}
      <div className="flex gap-2 mb-6 bg-gray-200/50 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab("passport")}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "passport" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Style Passport
        </button>
        <button 
          onClick={() => setActiveTab("account")}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "account" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Account Settings
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden min-h-125">
        
        {/* TAB 1: CLERK ACCOUNT */}
        {activeTab === "account" && (
          <div className="flex justify-center p-8">
            <UserProfile 
              routing="hash" 
              appearance={{ elements: { card: "shadow-none w-full max-w-none", navbar: "hidden" } }}
            />
          </div>
        )}

        {/* TAB 2: STYLE PASSPORT */}
        {activeTab === "passport" && (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">The Style Passport</h2>
                <p className="text-sm text-gray-500 mt-1">Leave blank anything you don't care about. It's your vibe.</p>
              </div>
              {!isEditing && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-gray-100 text-gray-900 px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Edit Passport
                </button>
              )}
            </div>

            {/* VIEW MODE */}
            {!isEditing ? (
              <div className="space-y-10">
                <Section title="The Blueprint (Measurements)">
                  <DetailItem label="Height" value={height} />
                  <DetailItem label="Weight" value={weight} />
                  <DetailItem label="Chest / Bust" value={chest} />
                  <DetailItem label="Waist" value={waist} />
                  <DetailItem label="Inseam" value={inseam} />
                </Section>
                <Section title="The Details">
                  <DetailItem label="Shoe Size" value={shoe} />
                  <DetailItem label="Ring Size" value={ring} />
                  <DetailItem label="Preferred Fit" value={fit} />
                </Section>
                <Section title="The Vibe">
                  <DetailItem label="Metal Preference" value={metal} />
                  <DetailItem label="My Style in 3 Words" value={words} />
                  <DetailItem label="Favorite Brands" value={brands} />
                  <DetailItem label="Dealbreakers (Never buy me...)" value={dealbreakers} />
                </Section>
                <Section title="General Notes">
                  <div className="col-span-full">
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{notes || <span className="text-gray-300 italic">No notes provided.</span>}</p>
                  </div>
                </Section>
              </div>
            ) : (
              
            /* EDIT MODE (MASSIVE FORM) */
              <form onSubmit={handleSave} className="space-y-12 max-w-2xl">
                
                {/* Unit Toggle */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="text-sm font-bold text-gray-700">Measurement Unit:</label>
                  <div className="flex bg-gray-200 p-1 rounded-lg">
                    <button type="button" onClick={() => setUnit("Inches")} className={`px-4 py-1 text-xs font-bold rounded-md transition-colors ${unit === "Inches" ? "bg-white shadow-sm" : "text-gray-500"}`}>Inches</button>
                    <button type="button" onClick={() => setUnit("CM")} className={`px-4 py-1 text-xs font-bold rounded-md transition-colors ${unit === "CM" ? "bg-white shadow-sm" : "text-gray-500"}`}>CM</button>
                  </div>
                </div>

                {/* Section 1: Measurements */}
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-2">The Blueprint</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormInput label="Height" placeholder="e.g. 5'7 or 170cm" value={height} onChange={setHeight} />
                    <FormInput label="Weight (Optional)" placeholder="e.g. 140 lbs" value={weight} onChange={setWeight} />
                    <FormInput label="Chest / Bust" placeholder={`in ${unit}`} value={chest} onChange={setChest} />
                    <FormInput label="Waist" placeholder={`in ${unit}`} value={waist} onChange={setWaist} />
                    <FormInput label="Inseam / Leg Length" placeholder={`in ${unit}`} value={inseam} onChange={setInseam} />
                  </div>
                </div>

                {/* Section 2: Details */}
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-2">The Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormInput label="Shoe Size" placeholder="e.g. W 7.5 / EU 38" value={shoe} onChange={setShoe} />
                    <FormInput label="Ring Size" placeholder="e.g. 6.5" value={ring} onChange={setRing} />
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Preferred Fit</label>
                      <select value={fit} onChange={(e) => setFit(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                        <option value="">Select a fit...</option>
                        <option value="Oversized / Baggy">Oversized / Baggy</option>
                        <option value="Tailored / Fitted">Tailored / Fitted</option>
                        <option value="Relaxed / Standard">Relaxed / Standard</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Vibes */}
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-2">The Vibe</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Jewelry Metals</label>
                      <select value={metal} onChange={(e) => setMetal(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                        <option value="">Select preference...</option>
                        <option value="Strictly Gold">Strictly Gold</option>
                        <option value="Strictly Silver / White Gold">Strictly Silver / White Gold</option>
                        <option value="Rose Gold">Rose Gold</option>
                        <option value="I mix metals">I mix metals</option>
                      </select>
                    </div>
                    <FormInput label="My Style in 3 Words" placeholder="e.g. Minimalist, cozy, vintage" value={words} onChange={setWords} />
                    <FormInput label="Favorite Brands / Stores" placeholder="e.g. Aritzia, Zara, SSENSE" value={brands} onChange={setBrands} />
                    <FormInput label="Dealbreakers (Never buy me...)" placeholder="e.g. Neon colors, synthetic fabrics, skinny jeans" value={dealbreakers} onChange={setDealbreakers} />
                  </div>
                </div>
                
                {/* Section 4: Notes */}
                <div>
                  <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-2">Final Thoughts</h3>
                  <textarea 
                    placeholder="Drop any other hints here... 'I really need a new winter coat', 'I collect ceramic mugs', etc." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-30"
                  />
                </div>

                {/* Submit Action */}
                <div className="pt-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-gray-950 text-white px-8 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg"
                  >
                    {isSaving ? "Saving..." : "Lock in my vibe 🔒"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Helper Components for clean code
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
      <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-300 italic">Not set</span>}</p>
    </div>
  );
}

function FormInput({ label, placeholder, value, onChange }: { label: string, placeholder: string, value: string, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">{label}</label>
      <input 
        type="text" 
        placeholder={placeholder} 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
      />
    </div>
  );
}