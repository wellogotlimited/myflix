export default function SearchSkeleton() {
  return (
    <main className="min-h-screen pt-20 px-6 md:px-12">
      <div className="skeleton mb-6 h-8 w-56 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
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
