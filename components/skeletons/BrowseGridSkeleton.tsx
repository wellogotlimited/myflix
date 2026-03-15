export default function BrowseGridSkeleton() {
  return (
    <main className="min-h-screen px-6 pb-16 pt-28 md:px-12">
      <div className="mb-8">
        <div className="skeleton h-3 w-16 rounded-md" />
        <div className="skeleton mt-3 h-10 w-48 rounded-md md:h-14 md:w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="skeleton w-full rounded-lg"
            style={{ aspectRatio: "16/9" }}
          />
        ))}
      </div>
    </main>
  );
}
