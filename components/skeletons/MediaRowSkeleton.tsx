export default function MediaRowSkeleton() {
  return (
    <section>
      <div className="skeleton mb-3 mx-4 h-6 w-40 rounded-md md:mx-8" />
      <div className="flex gap-2.5 overflow-hidden px-4 py-6 md:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton flex-shrink-0 w-[280px] rounded-lg"
            style={{ aspectRatio: "16/9" }}
          />
        ))}
      </div>
    </section>
  );
}
