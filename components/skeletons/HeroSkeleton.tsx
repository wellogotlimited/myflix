export default function HeroSkeleton() {
  return (
    <div className="relative h-[56vw] max-h-[80vh] min-h-[400px] w-full overflow-hidden bg-[#1a1a1a]">
      <div className="skeleton absolute inset-0" />
      <div className="absolute bottom-[15%] left-8 md:left-16 space-y-4 z-10">
        <div className="skeleton h-10 w-64 md:w-96 rounded-md" />
        <div className="skeleton h-4 w-80 md:w-[480px] rounded-md" />
        <div className="skeleton h-4 w-56 md:w-80 rounded-md" />
        <div className="mt-6 flex gap-3">
          <div className="skeleton h-11 w-28 rounded-md" />
          <div className="skeleton h-11 w-36 rounded-md" />
        </div>
      </div>
    </div>
  );
}
