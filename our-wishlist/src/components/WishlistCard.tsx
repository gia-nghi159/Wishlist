"use client";

type WishlistCardProps = {
  item: {
    id: number;
    name: string;
    isInspo: boolean;
    description?: string;
    url?: string;
  };
  onDelete: (id: number) => void;
};

export default function WishlistCard({ item, onDelete }: WishlistCardProps) {
  return (
    // NEW: We removed the border, shadow, and rounded corners! It's just a flat row now.
    <div className="px-6 py-5 flex justify-between items-start bg-white transition-colors hover:bg-gray-50">
      <div className="flex-1 pr-4">
        
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
          {item.isInspo && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              ✨ Inspo
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 mb-2 italic">"{item.description}"</p>
        )}

        {item.url && (
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-1 mt-1"
          >
            {item.isInspo ? "🔗 See inspiration vibe" : "🔗 Buy exactly this"}
          </a>
        )}
      </div>

      <button 
        onClick={() => onDelete(item.id)}
        className="text-sm text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
      >
        Remove
      </button>
    </div>
  );
}