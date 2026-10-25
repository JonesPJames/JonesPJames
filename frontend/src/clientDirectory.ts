export type Client = { id: string; first_name: string; last_name: string; city?: string };
export type DirectoryJob = {
  id: string; client_name?: string; created_at?: string; job_number?: string; title?: string;
  effective_status?: string; status?: string; days_left?: number; totals?: { celkem?: number };
};
export type ClientEntry = {
  id: string; name: string; city: string; sortName: string; jobs: DirectoryJob[];
  legacy: boolean; ambiguous: boolean;
};
const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });
const nameKey = (name: string) => name.normalize("NFC").toLocaleLowerCase("cs").replace(/,/g, " ").trim().replace(/\s+/g, " ");
export const searchKey = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs").trim();
const timestamp = (job: DirectoryJob) => Date.parse(job.created_at || "") || 0;
export function newestJobs(jobs: DirectoryJob[]): DirectoryJob[] {
  return [...jobs].sort((a, b) => timestamp(b) - timestamp(a) || collator.compare(b.job_number || b.id, a.job_number || a.id));
}
export function recentJobs(jobs: DirectoryJob[], query = "", status = "vse"): DirectoryJob[] {
  const q = searchKey(query);
  // Limit the global timeline first: filtering must not reintroduce archived jobs.
  return newestJobs(jobs).slice(0, 10).filter(job =>
    (!q || searchKey(`${job.client_name || ""} ${job.job_number || ""} ${job.title || ""}`).includes(q)) &&
    (status === "vse" || !status || (job.effective_status || job.status) === status));
}
export function buildClientDirectory(clients: Client[], jobs: DirectoryJob[]): ClientEntry[] {
  const entries: ClientEntry[] = clients.map(client => ({
    id: client.id, name: `${client.first_name} ${client.last_name}`.trim(), city: client.city || "",
    sortName: `${client.last_name} ${client.first_name}`.trim(), jobs: [], legacy: false, ambiguous: false,
  }));
  const aliases = new Map<string, Set<ClientEntry>>();
  clients.forEach((client, index) => {
    for (const alias of [`${client.first_name} ${client.last_name}`, `${client.last_name} ${client.first_name}`]) {
      const key = nameKey(alias);
      if (!key) continue;
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key)!.add(entries[index]);
    }
  });
  const legacy = new Map<string, ClientEntry>();
  for (const job of newestJobs(jobs)) {
    const key = nameKey(job.client_name || "");
    const candidates = aliases.get(key);
    if (candidates?.size === 1) {
      [...candidates][0].jobs.push(job);
    } else {
      // Old jobs only store a name. Never silently assign a namesake's jobs.
      if (!legacy.has(key)) {
        const name = job.client_name?.trim() || "Bez klienta";
        const entry: ClientEntry = { id: `legacy:${Array.from(key, character => character.codePointAt(0)!.toString(16)).join("-")}`, name, sortName: name,
          city: "", jobs: [], legacy: true, ambiguous: (candidates?.size || 0) > 1 };
        legacy.set(key, entry);
        entries.push(entry);
      }
      legacy.get(key)!.jobs.push(job);
    }
  }
  return entries.sort((a, b) => Number(a.id === "legacy:") - Number(b.id === "legacy:") ||
    collator.compare(a.sortName, b.sortName) || collator.compare(a.city, b.city) || collator.compare(a.id, b.id));
}
export function filterClients(entries: ClientEntry[], query: string): ClientEntry[] {
  const q = searchKey(query);
  return entries.filter(entry => searchKey(`${entry.name} ${entry.city}`).includes(q));
}
export function readClients(data: Client[] | { clients: Client[] }): Client[] {
  const clients = Array.isArray(data) ? data : data?.clients;
  if (!Array.isArray(clients)) throw new Error("Nepodařilo se načíst seznam klientů.");
  return clients;
}
export function readJobs(data: DirectoryJob[] | { jobs: DirectoryJob[] }): DirectoryJob[] {
  const jobs = Array.isArray(data) ? data : data?.jobs;
  if (!Array.isArray(jobs)) throw new Error("Nepodařilo se načíst seznam zakázek.");
  return jobs;
}
