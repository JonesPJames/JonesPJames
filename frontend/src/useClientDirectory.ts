import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api, getApiErrorMessage } from "./api";
import { buildClientDirectory, ClientEntry, readClients, readJobs } from "./clientDirectory";

export function useClientDirectory() {
  const [entries, setEntries] = useState<ClientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  // Refresh replaces in-flight requests; leaving the screen invalidates stale results.
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    try {
      const [clients, jobs] = await Promise.all([api.get("/clients", { signal }), api.get("/jobs", { signal })]);
      if (!signal.aborted) { setEntries(buildClientDirectory(readClients(clients.data), readJobs(jobs.data))); setError(""); }
    } catch (err) {
      if (!signal.aborted) { setEntries([]); setError(getApiErrorMessage(err)); }
    } finally {
      if (!signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    return () => request.current?.abort();
  }, [load]));
  const refresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);
  return { entries, loading, refreshing, error, refresh };
}
