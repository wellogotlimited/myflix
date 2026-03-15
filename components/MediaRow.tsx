import { TMDBItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function MediaRow({
  id,
  title,
  items,
}: {
  id?: string;
  title: string;
  items: TMDBItem[];
}) {
  if (!items.length) return null;

  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="mb-3 px-4 text-lg font-semibold text-white md:px-8 md:text-xl">
        {title}
      </h2>
      <div className="-my-6 flex gap-2.5 overflow-x-auto overflow-y-visible px-4 py-6 scrollbar-hide md:px-8">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
