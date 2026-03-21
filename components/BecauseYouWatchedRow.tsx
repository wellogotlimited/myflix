"use client";

import { useEffect, useState } from "react";
import MediaRow from "./MediaRow";
import type { TMDBItem } from "@/lib/tmdb";

interface BecauseYouWatchedData {
  title: string;
  items: TMDBItem[];
}

export default function BecauseYouWatchedRow() {
  const [rows, setRows] = useState<BecauseYouWatchedData[]>([]);

  useEffect(() => {
    fetch("/api/because-you-watched")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
      })
      .catch(() => {});
  }, []);

  if (!rows.length) return null;

  return (
    <>
      {rows.map((row) => (
        <MediaRow key={row.title} title={row.title} items={row.items} />
      ))}
    </>
  );
}
