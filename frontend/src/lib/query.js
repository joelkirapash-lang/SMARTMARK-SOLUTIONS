import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { api, queryCache, getEpoch, subscribeEpoch } from "./api";

const inflight = new Map();
function fetchQuery(path) {
  if (inflight.has(path)) return inflight.get(path);
  const p = api.get(path).then((data) => { queryCache.set(path, { data, at: Date.now() }); return data; }).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export const useEpoch = () => useSyncExternalStore(subscribeEpoch, getEpoch);

/** Stale-while-revalidate: shows what it already knows instantly, then quietly updates.
 *  Pass null to switch a query off. */
export function useQuery(path) {
  const epoch = useEpoch();
  const [, force] = useReducer((x) => x + 1, 0);
  const [error, setError] = useState(null);
  useEffect(() => { setError(null); }, [path]);
  useEffect(() => {
    if (!path) return;
    let dead = false;
    fetchQuery(path).then(() => { if (!dead) { setError(null); force(); } }).catch((e) => { if (!dead) setError(e); });
    return () => { dead = true; };
  }, [path, epoch]);
  const hit = path ? queryCache.get(path) : undefined;
  return { data: hit?.data, loading: !!path && !hit && !error, error, refetch: () => (path ? fetchQuery(path).then(force) : null) };
}
