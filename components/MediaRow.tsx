import { TMDBItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function MediaRow({
  id,
  title,
  subtitle,
  items,
  portrait = false,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  items: TMDBItem[];
  portrait?: boolean;
}) {
  if (!items.length) return null;

  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-2.5 px-4 md:px-8">
        <h2 className="text-lg font-semibold text-white md:text-xl">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-white/45">{subtitle}</p>
        ) : null}
      </div>
      <div className="-my-5 flex gap-2 overflow-x-auto overflow-y-visible px-4 py-5 scrollbar-hide md:px-8">
        {items.map((item) => (
          <MediaCard key={item.id} item={item} portrait={portrait} />
        ))}
      </div>
    </section>
  );
}
