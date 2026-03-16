export default function BrowseGridSkeleton({
  mobilePortrait = false,
}: {
  mobilePortrait?: boolean;
}) {
  const rootClassName = mobilePortrait
    ? "min-h-screen px-4 pb-24 pt-24 md:px-12 md:pb-16 md:pt-28"
    : "min-h-screen px-6 pb-16 pt-28 md:px-12";

  return (
    <main className={rootClassName}>
      <div className="mb-8">
        <div className="skeleton h-3 w-16 rounded-md" />
        <div className="skeleton mt-3 h-10 w-48 rounded-md md:h-14 md:w-72" />
      </div>

      <div
        className={`grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
          mobilePortrait ? "hidden md:grid" : "grid"
        }`}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="skeleton w-full rounded-lg"
            style={{ aspectRatio: "16/9" }}
          />
        ))}
      </div>

      {mobilePortrait ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[380px]:grid-cols-3 md:hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="skeleton w-full rounded-md"
              style={{ aspectRatio: "2/3" }}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
