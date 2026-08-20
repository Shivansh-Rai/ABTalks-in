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
    <Button
      type="button"
      size="icon-lg"
      onClick={onToggle}
      aria-label={open ? "Close chat" : "Open chat"}
      aria-expanded={open}
      className="size-14 rounded-full shadow-xl bg-blue-500 hover:bg-blue-600 text-white transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
    >
      {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
    </Button>
  );
}

export default ChatLauncher;
