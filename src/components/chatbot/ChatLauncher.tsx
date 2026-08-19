"use client";

import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatLauncherProps = {
  open: boolean;
  onToggle: () => void;
};

/** The floating corner button that opens/closes the chat panel — distinct from ChatBubble.tsx, which renders a single message. */
export function ChatLauncher({ open, onToggle }: ChatLauncherProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {!open && (
        <div className="mb-3 mr-1 animate-in fade-in zoom-in duration-300">
          <div className="relative rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            Hi! How can I help you?
            <div className="absolute -bottom-2 right-4 h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-orange-500" />
          </div>
        </div>
      )}
      <Button
        type="button"
        size="icon-lg"
        onClick={onToggle}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        className="size-14 rounded-full shadow-xl bg-blue-500 hover:bg-blue-600 text-white transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </Button>
    </div>
  );
}

export default ChatLauncher;
