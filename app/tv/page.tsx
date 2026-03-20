import { requireAuth } from "@/lib/session";
import TvStandbyScreen from "@/components/tv/TvStandbyScreen";

export const metadata = { title: "TV Remote - Popflix" };

export default async function TvPage() {
  await requireAuth();
  return <TvStandbyScreen />;
}
