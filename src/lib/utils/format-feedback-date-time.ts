export function formatFeedbackDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
