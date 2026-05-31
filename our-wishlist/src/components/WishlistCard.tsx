"use client";

type WishItem = {
  id: number;
  name: string;
  isInspo: boolean;
  description: string;
  url: string;
  user_id: string;
  reserved_by?: string | null;
};

interface WishlistCardProps {
  item: WishItem;
  onDelete: (id: number) => Promise<void> | void;
  onEdit?: (item: WishItem) => void;
  showDelete?: boolean; 
  currentUserId?: string | null;
  onToggleReserve?: (id: number, isReserved: boolean) => void;
}

export default function WishlistCard({ item, onDelete, onEdit, showDelete = true, currentUserId, onToggleReserve }: WishlistCardProps) {
  const isOwnWish = item.user_id === currentUserId;

  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#618264] truncate">{item.name}</span>
          {item.isInspo && (
            <span className="text-[10px] bg-[#D0E7D2] text-[#618264] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase shrink-0">
              💫 INSPO
            </span>
          )}
        </div>
        
        {item.url && (
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-[#618264] hover:text-[#4A6A4C] hover:underline flex items-center gap-1 w-fit mt-0.5 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
              <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
            </svg>
            {item.isInspo ? "See inspiration vibe" : "Buy exactly this"}
          </a>
        )}
        
        {item.description && (
          <p className="text-xs bg-white text-[#618264] italic mt-1 chunk wrap-break-word">"{item.description}"</p>
        )}
      </div>

      {/* ACTION BLOCK CONTAINER */}
      <div className="flex items-center shrink-0 ml-4 gap-2">
        {isOwnWish ? (
          showDelete && (
            <>
              {onEdit && (
                <button
                  onClick={() => onEdit(item)}
                  className="text-xs font-semibold text-[#618264] hover:text-[#4A6A4C] transition-colors bg-[#D0E7D2]/50 hover:bg-[#D0E7D2] px-3 py-1.5 rounded-xl"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => onDelete(item.id)}
                className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100/60 px-3 py-1.5 rounded-xl"
              >
                Remove
              </button>
            </>
          )
        ) : (
          onToggleReserve && (
            item.reserved_by === currentUserId ? (
              <button
                onClick={() => onToggleReserve(item.id, true)}
                className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100/80 border border-green-200 px-3 py-1.5 rounded-xl transition-all"
              >
                You Reserved ✓
              </button>
            ) : item.reserved_by ? (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200/50 px-3 py-1.5 rounded-xl select-none flex items-center gap-1">
                🔒 Taken
              </span>
            ) : (
              <button
                onClick={() => onToggleReserve(item.id, false)}
                className="text-xs font-bold text-white bg-[#79AC78] hover:bg-[#618264] border border-green-100 px-3 py-1.5 rounded-xl transition-all shadow-sm"
              >
                Claim Gift 🎁
              </button>
            )
          )
        )}
      </div>
    </div>
  );
}