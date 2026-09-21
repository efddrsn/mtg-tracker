const RECOMMANDER_ORIGIN = 'https://recommander.cards';

// Recommander's deck endpoint can legitimately return an empty list before a
// player has picked any cards. Its commander page still exposes the globally
// ranked Top Picks list, so use that as the cold-start source instead of a
// generic EDHREC list of lands and colourless staples.
export function parseCommanderTopPicks(html, limit = 50) {
  const item = /<li\s+data-rep="[^"]+"\s+data-sf="[^"]+"[^>]*data-score="([^"]+)"\s+data-count="([^"]+)"\s+data-pop="([^"]+)"[^>]*><a[^>]*href="\/card\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const seen = new Set();
  const recommendations = [];
  let match;

  while ((match = item.exec(html)) && recommendations.length < limit) {
    const oracleId = match[4];
    if (seen.has(oracleId)) continue;
    const score = Number(match[1]);
    const commanderCount = Number(match[2]);
    if (!Number.isFinite(score) || !Number.isFinite(commanderCount)) continue;
    seen.add(oracleId);
    recommendations.push({
      oracle_id: oracleId,
      name: match[5]
        .replaceAll('&amp;', '&')
        .replaceAll('&#39;', "'")
        .replaceAll('&quot;', '"'),
      score,
      commander_count: commanderCount,
    });
  }

  return recommendations;
}

export async function fetchCommanderTopPicks(oracleId, signal) {
  if (!/^[0-9a-f-]{36}$/i.test(oracleId)) return [];
  const response = await fetch(`${RECOMMANDER_ORIGIN}/individual/${oracleId}`, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    signal,
  });
  if (!response.ok) throw new Error(`Recommander page HTTP ${response.status}`);
  return parseCommanderTopPicks(await response.text());
}
