"use client";

import Link from "next/link";

interface StylePassportViewProps {
  isLoading: boolean;
  passportData: any;
  activeTab: string;
  currentUserId?: string;
}

export default function StylePassportView({
  isLoading,
  passportData,
  activeTab,
  currentUserId,
}: StylePassportViewProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-green-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8">
      <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold text-[#618264]">Style Passport</h2>
        {activeTab === currentUserId && (
          <Link href="/profile" className="text-xs font-bold text-[#618264] hover:underline bg-[#D0E7D2] px-3 py-1.5 rounded-lg">
            Edit My Passport
          </Link>
        )}
      </div>
      <div className="space-y-10">
        <Section title={`The Blueprint (${passportData?.preferred_unit || 'Inches'})`}>
          <DetailItem label="Height" value={passportData?.height} />
          <DetailItem label="Weight" value={passportData?.weight} />
          <DetailItem label="Chest / Bust" value={passportData?.chest} />
          <DetailItem label="Waist" value={passportData?.waist} />
          <DetailItem label="Inseam" value={passportData?.inseam} />
        </Section>
        <Section title="The Details">
          <DetailItem label="Shoe Size" value={passportData?.shoe_size} />
          <DetailItem label="Ring Size" value={passportData?.ring_size} />
          <DetailItem label="Preferred Fit" value={passportData?.preferred_fit} />
        </Section>
        <Section title="The Vibe">
          <DetailItem label="Metal Preference" value={passportData?.metal_preference} />
          <DetailItem label="Style in 3 Words" value={passportData?.style_words} />
          <DetailItem label="Favorite Brands" value={passportData?.favorite_brands} />
          <DetailItem label="Dealbreakers" value={passportData?.dealbreakers} />
        </Section>
        <Section title="General Notes">
          <div className="col-span-full">
            <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
              {passportData?.notes || <span className="text-gray-300 italic">No additional notes provided.</span>}
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-black text-[#618264] uppercase tracking-widest mb-4 border-b border-gray-100 pb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
        {children}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold text-[#618264] uppercase tracking-wider mb-1">{label}</h4>
      <p className="text-sm font-medium text-gray-900">
        {value ? value : <span className="text-gray-300 italic">Not set</span>}
      </p>
    </div>
  );
}