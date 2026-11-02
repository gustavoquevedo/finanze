"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository, type Repository } from "@/lib/data";

/** Loads data from the repository on the client. `reload` re-runs the loader. */
export function useData<T>(loader: (repo: Repository) => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loader(getRepository())
      .then((result) => active && (setData(result), setError(null)))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
