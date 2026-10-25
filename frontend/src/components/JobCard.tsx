import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { StatusBadge } from "./StatusBadge";
import { theme, fmtCZK, fmtDateCZ } from "../theme";
import type { DirectoryJob } from "../clientDirectory";

export function JobCard({ job }: { job: DirectoryJob }) {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/zakazka/${job.id}`)}
      testID={`job-${job.id}`} accessibilityRole="button" accessibilityLabel={`Otevřít zakázku ${job.title || job.job_number || ""}`} activeOpacity={0.85}>
      <View style={styles.row}>
        <Text style={styles.jobNo}>{job.job_number}</Text>
        <StatusBadge status={job.effective_status || job.status || "rozpracovano"} daysLeft={job.days_left} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{job.title || "(bez názvu)"}</Text>
      <Text style={styles.client} numberOfLines={1}>{job.client_name || "Bez klienta"}</Text>
      <View style={styles.footer}>
        <Text style={styles.date}>{fmtDateCZ(job.created_at || "")}</Text>
        <Text style={styles.total}>{fmtCZK(job.totals?.celkem)}</Text>
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  jobNo: { color: theme.colors.primary, fontWeight: "800", fontSize: 13, flexShrink: 1 },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginTop: 8 },
  client: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 8 },
  date: { fontSize: 12, color: theme.colors.textMuted },
  total: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
});
