"use client";

import { useEffect, useState } from "react";
import MediaRow from "@/components/MediaRow";
import { useProfileSession } from "@/lib/profile-session";
import type { TMDBItem } from "@/lib/tmdb";

interface RecommendationRow {
  title: string;
  items: TMDBItem[];
}

export default function RecommendedRow() {
  const { profileId } = useProfileSession();
  const [rows, setRows] = useState<RecommendationRow[]>([]);

  useEffect(() => {
    if (!profileId) return;
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
      })
      .catch(() => {});
  }, [profileId]);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <MediaRow key={row.title} title={row.title} items={row.items} />
      ))}
    </>
  );
}
