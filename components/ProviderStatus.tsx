"use client";

export interface SourceStatus {
  id: string;
  status: "pending" | "running" | "success" | "failure" | "notfound";
}

export default function ProviderStatus({
  sources,
}: {
  sources: SourceStatus[];
}) {
  const tried = sources.filter((s) => s.status !== "pending").length;
  const progress = sources.length > 0 ? Math.max(10, (tried / sources.length) * 100) : 14;

  return (  
    <div className="absolute inset-0 z-20 bg-black">
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
            <p className="mt-4 text-sm font-semibold text-white/72">
              Just a second.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
