const RECOMMANDER_ORIGIN = "https://recommander.cards";
const decode = (value) =>
  value.replace(
    /&(?:amp|quot|apos|#39|#x27|lt|gt);/g,
    (entity) =>
      ({
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
        "&#x27;": "'",
        "&lt;": "<",
        "&gt;": ">",
      })[entity],
  );

// Read the dedicated global Top Picks section, never a concatenation of the
// site's land/artifact/color categories. The current Astro markup no longer
// has data-score/data-rep. Preserve its published rank as an ordinal score,
// explicitly labeled so it cannot be mistaken for model confidence.
export function parseCommanderTopPicks(html, limit = 100) {
  const section =
    /<section\b[^>]*data-stats-view="top"[^>]*>([\s\S]*?)<\/section>/i.exec(
      html,
    )?.[1];
  if (section) {
    const recommendations = [];
    const seen = new Set();
    const links = /<a\b([^>]*href="\/card\/([a-f0-9-]{36})"[^>]*)>/gi;
    let match;
    while ((match = links.exec(section))) {
      const name = /aria-label="([^"]+)"/.exec(match[1])?.[1];
      if (!name || seen.has(match[2])) continue;
      seen.add(match[2]);
      const rank = recommendations.length;
      recommendations.push({
        oracle_id: match[2],
        name: decode(name),
        score: 1 / (1 + rank * 0.01),
        rank,
        score_kind: "ordinal",
        source: "commander-top-picks",
      });
    }
    return recommendations.slice(0, limit);
  }
  // Backward compatibility: parse the complete legacy pool before sorting or
  // limiting. Truncating in source order used to bias towards early categories.
  const rows =
    /<li\s+data-rep="[^"]+"\s+data-sf="[^"]+"[^>]*data-score="([^"]+)"\s+data-count="([^"]+)"\s+data-pop="([^"]+)"[^>]*><a[^>]*href="\/card\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const byId = new Map();
  let match;
  while ((match = rows.exec(html))) {
    const item = {
      oracle_id: match[4],
      name: decode(match[5]),
      score: Number(match[1]),
      commander_count: Number(match[2]),
      source: "commander-top-picks",
    };
    if (!Number.isFinite(item.score) || !Number.isFinite(item.commander_count))
      continue;
    if (
      !byId.has(item.oracle_id) ||
      byId.get(item.oracle_id).score < item.score
    )
      byId.set(item.oracle_id, item);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
export async function fetchCommanderTopPicks(oracleId, signal) {
  if (!/^[0-9a-f-]{36}$/i.test(oracleId)) return [];
  const response = await fetch(`${RECOMMANDER_ORIGIN}/individual/${oracleId}`, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal,
  });
  if (!response.ok) throw new Error(`Recommander page HTTP ${response.status}`);
  return parseCommanderTopPicks(await response.text());
}
