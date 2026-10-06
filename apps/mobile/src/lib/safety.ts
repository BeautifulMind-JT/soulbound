export type ReportTargetKind = "post" | "comment" | "member";

export interface ReportTarget {
  readonly kind: ReportTargetKind;
  readonly id: string;
  readonly memberLabel?: string;
}

const kindLabel: Record<ReportTargetKind, string> = {
  post: "게시글",
  comment: "댓글",
  member: "멤버",
};

export function buildReportLink(baseUrl: string, target: ReportTarget): string | null {
  const destination = baseUrl.trim();
  if (!destination) {
    return null;
  }
  const subject = `[SoulBound 신고] ${kindLabel[target.kind]}`;
  const lines = [
    `대상: ${kindLabel[target.kind]}`,
    `ID: ${target.id}`,
    ...(target.memberLabel ? [`작성자: ${target.memberLabel}`] : []),
    "",
    "신고 사유:",
  ];
  const body = lines.join("\n");

  if (destination.startsWith("mailto:")) {
    const separator = destination.includes("?") ? "&" : "?";
    return `${destination}${separator}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}type=${encodeURIComponent(target.kind)}&id=${encodeURIComponent(target.id)}`;
}

export function parseBlockedMembers(raw: string | null): readonly number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [...new Set(parsed.filter((value): value is number =>
      typeof value === "number" && Number.isInteger(value) && value > 0))];
  } catch {
    return [];
  }
}

export function toggleBlocked(list: readonly number[], memberNumber: number): readonly number[] {
  return list.includes(memberNumber)
    ? list.filter((value) => value !== memberNumber)
    : [...list, memberNumber];
}

export function filterBlocked<T extends { readonly author: { readonly memberNumber: number; readonly isMe: boolean } }>(
  items: readonly T[],
  blocked: readonly number[],
): readonly T[] {
  return items.filter((item) => item.author.isMe || !blocked.includes(item.author.memberNumber));
}
