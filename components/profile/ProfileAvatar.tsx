import { getAvatar } from "@/lib/avatars";

interface ProfileAvatarProps {
  avatarId: string;
  name: string;
  size?: number;
  className?: string;
}

export default function ProfileAvatar({
  avatarId,
  name,
  size = 64,
  className = "",
}: ProfileAvatarProps) {
  const avatar = getAvatar(avatarId);
  const initial = name.charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.4);

  return (
    <div
      className={`flex items-center justify-center rounded-md select-none font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: avatar.color,
        fontSize,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
