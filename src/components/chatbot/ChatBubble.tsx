type ChatBubbleProps = {
  message: string;
  isUser?: boolean;
  timestamp?: number;
};

export function ChatBubble({ message, isUser = false, timestamp }: ChatBubbleProps) {
  const timeString = timestamp 
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {message || (
          <div className="flex items-center gap-1 h-5">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
        )}
      </div>
      {timeString && (
        <span className="text-[10px] text-muted-foreground px-1 mt-0.5">
          {timeString}
        </span>
      )}
    </div>
  );
}

export default ChatBubble;
