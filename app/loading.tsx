import HeroSkeleton from "@/components/skeletons/HeroSkeleton";
import MediaRowSkeleton from "@/components/skeletons/MediaRowSkeleton";

export default function HomeLoading() {
  return (
    <main className="min-h-screen">
      <HeroSkeleton />
      <div className="relative z-10 mt-8 space-y-2 pb-16 md:mt-10">
        <MediaRowSkeleton />
        <MediaRowSkeleton />
        <MediaRowSkeleton />
        <MediaRowSkeleton />
        <MediaRowSkeleton />
      </div>
    </main>
  );
}
