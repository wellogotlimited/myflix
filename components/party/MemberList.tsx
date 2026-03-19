import ProfileAvatar from "@/components/profile/ProfileAvatar";

interface Member {
  profileId: string;
  name: string;
  avatarId: string;
  joinedAt: string;
}

export default function MemberList({
  members,
  currentProfileId,
}: {
  members: Member[];
  currentProfileId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <div key={m.profileId} className="flex items-center gap-1.5" title={m.name}>
          <div className={`rounded ${m.profileId === currentProfileId ? "ring-2 ring-white" : ""}`}>
            <ProfileAvatar avatarId={m.avatarId} name={m.name} size={24} className="rounded" />
          </div>
          <span className="max-w-[80px] truncate text-xs text-gray-400">{m.name}</span>
        </div>
      ))}
    </div>
  );
}
