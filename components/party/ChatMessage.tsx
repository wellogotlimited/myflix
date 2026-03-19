interface Message {
  profileId: string;
  name: string;
  text: string;
  sentAt: string;
}

export default function ChatMessage({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      {!isOwn && (
        <span className="mb-0.5 text-xs text-gray-500">{message.name}</span>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
          isOwn
            ? "bg-[#e50914] text-white"
            : "bg-white/10 text-gray-200"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
