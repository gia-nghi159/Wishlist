"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { getGroupMembers } from "../app/actions";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function GiftAssistantChat({ friendId, groupId }: { friendId: string; groupId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI Gift Assistant. Paste a link or ask what to buy for this friend!" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [members, setMembers] = useState<{ id: string, firstName: string }[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(friendId !== "all" ? friendId : null);

  useEffect(() => {
    // Reset selection if props change
    setSelectedFriendId(friendId !== "all" ? friendId : null);
    if (friendId === "all" && groupId && groupId !== "none") {
      getGroupMembers(groupId).then(setMembers);
    }
  }, [friendId, groupId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedFriendId) return;

    const userMessage = input;
    setInput("");
    const newMessage: Message = { role: "user", content: userMessage };
    const newHistory = [...messages, newMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, friendId: selectedFriendId, groupId, history: newHistory })
      });

      if (!response.ok) throw new Error('Failed to fetch');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let firstChunk = true;

      while (reader && !done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          if (firstChunk) {
            setIsLoading(false);
            setMessages(prev => [...prev, { role: "assistant", content: chunkValue }]);
            firstChunk = false;
          } else {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastIndex = newMessages.length - 1;
              newMessages[lastIndex] = {
                ...newMessages[lastIndex],
                content: newMessages[lastIndex].content + chunkValue
              };
              return newMessages;
            });
          }
        }
      }
      if (firstChunk) setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: "Oops, something went wrong while asking the AI." }]);
    }
  };

  const isGlobal = friendId === "all";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white/90 backdrop-blur-md border border-[#D0E7D2] shadow-xl rounded-2xl w-80 h-96 mb-4 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#618264] text-white p-4 font-bold flex justify-between items-center">
            <span className="flex items-center gap-2">✨ Gift Assistant</span>
            <button onClick={() => setIsOpen(false)} className="hover:opacity-80 text-lg">&times;</button>
          </div>
          
          {/* Target Selection Dropdown if Global */}
          {isGlobal && (
            <div className="p-3 bg-[#E8F3E9] border-b border-[#D0E7D2] text-sm flex flex-col gap-1">
              <label className="text-[#4A6A4C] font-semibold text-xs uppercase tracking-wide">Who are you buying for?</label>
              <select 
                value={selectedFriendId || ""} 
                onChange={(e) => setSelectedFriendId(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#D0E7D2] bg-white focus:outline-none focus:border-[#618264]"
              >
                <option value="" disabled>Select a friend...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
                  msg.role === "user" ? "bg-[#618264] text-white rounded-br-none" : "bg-white border border-[#D0E7D2] text-[#4A6A4C] rounded-bl-none shadow-sm"
                }`}>
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        a: ({node, ...props}) => <a className="text-[#618264] underline hover:text-[#4A6A4C]" target="_blank" rel="noopener noreferrer" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-gray-800" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 bg-white border border-[#D0E7D2] rounded-2xl rounded-bl-none shadow-sm text-xs text-gray-500 flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#618264] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#618264] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#618264] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-[#D0E7D2] bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isGlobal && !selectedFriendId ? "Select a friend first..." : "Ask anything..."}
              className="flex-1 border border-[#D0E7D2] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#618264] text-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={isLoading || (isGlobal && !selectedFriendId)}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || (isGlobal && !selectedFriendId)}
              className="bg-[#618264] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#4A6A4C] disabled:opacity-50 transition-colors"
            >
              ↑
            </button>
          </form>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#618264] hover:bg-[#4A6A4C] text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center font-bold text-xl"
        >
          ✨
        </button>
      )}
    </div>
  );
}
