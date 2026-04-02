/**
 * Shared UI helpers used across admin pages.
 */

/** Convert 0-100 rating to star display elements. */
export function formatStars(rating: number): { filled: number; empty: number } {
  const stars = Math.round(rating / 20);
  return { filled: stars, empty: 5 - stars };
}

/** Render star characters as JSX. */
export function Stars({ rating }: { rating: number }) {
  const { filled, empty } = formatStars(rating);
  return (
    <span className="stars">
      {Array.from({ length: filled }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static star icons never reorder
        <span key={`f${i}`} className="star-filled">
          &#9733;
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static star icons never reorder
        <span key={`e${i}`} className="star-empty">
          &#9733;
        </span>
      ))}
    </span>
  );
}

/** Truncate text to maxLen chars with ellipsis. */
export function truncate(
  text: string | null | undefined,
  maxLen: number,
): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

/** Format ISO date string to a short readable form. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format a number with locale separators. */
export function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

/** Strip .desktop suffix from app IDs for display. */
export function stripDesktop(appId: string): string {
  return appId.replace(/\.desktop$/, "");
}

/** Build pagination page numbers with ellipsis gaps. */
export function paginationRange(
  current: number,
  total: number,
): (number | "...")[] {
  const pages: (number | "...")[] = [];
  const left = Math.max(1, current - 2);
  const right = Math.min(total, current + 2);

  if (left > 1) {
    pages.push(1);
    if (left > 2) pages.push("...");
  }

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < total) {
    if (right < total - 1) pages.push("...");
    pages.push(total);
  }

  return pages;
}

/** Loading spinner component. */
export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="loading-center">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

/** Empty state placeholder. */
export function EmptyState({
  title = "No data",
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="empty-state">
      <span>{title}</span>
      {subtitle && <span className="text-muted">{subtitle}</span>}
    </div>
  );
}
