import { getMoodItems, attachCardContext } from "@/lib/tmdb";
import { passesMaturityFilter } from "@/lib/maturity";
import MediaRow from "./MediaRow";
import type { MaturityLevel } from "@/lib/db";

const SELECTED_MOODS = [
  "feel-good",
  "action-packed",
  "critically-acclaimed",
] as const;

export default async function MoodRows({
  maturityLevel,
  portrait = false,
}: {
  maturityLevel: MaturityLevel;
  portrait?: boolean;
}) {
  const results = await Promise.all(SELECTED_MOODS.map((mood) => getMoodItems(mood)));

  const withContext = await Promise.all(
    results.map(async ({ label, items }) => ({
      label,
      items: await attachCardContext(items),
    }))
  );

  return (
    <>
      {withContext.map(({ label, items }) => {
        const filtered = items.filter((item) =>
          passesMaturityFilter(item.maturityRating, maturityLevel)
        );
        if (!filtered.length) return null;
        return <MediaRow key={label} title={label} items={filtered} portrait={portrait} />;
      })}
    </>
  );
}
