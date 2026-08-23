const endpoint = 'https://recommander.cards/api/decks/recommend';
const commander = 'Meren of Clan Nel Toth';
const selected = [
  'Viscera Seer',
  'Sakura-Tribe Elder',
  'Spore Frog',
  'Plaguecrafter',
  'Eternal Witness',
  'Reclamation Sage',
  'Victimize',
  'Animate Dead',
  'Grim Haruspex',
  'Zulaport Cutthroat',
];

const expectedNextPicks = new Set([
  'Ravenous Chupacabra',
  'Accursed Marauder',
  'Midnight Reaper',
  'Fleshbag Marauder',
  'Blood Artist',
  'Satyr Wayfinder',
  'Wood Elves',
  'Doomed Necromancer',
  'Carrion Feeder',
  'Phyrexian Delver',
  'Reanimate',
  'Necromancy',
  'Cankerbloom',
  'Buried Alive',
  'Gray Merchant of Asphodel',
  'Protean Hulk',
  'Caustic Caterpillar',
  'Shriekmaw',
  'Living Death',
]);

async function recommend(deck) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_format: 'name',
      commander,
      partner: null,
      deck,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Recommander returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.recommendations)) throw new Error('Missing recommendations');
  return body.recommendations;
}

function averageScore(cards) {
  return cards.reduce((sum, card) => sum + card.score, 0) / cards.length;
}

const [cold, tuned] = await Promise.all([recommend([]), recommend(selected)]);
const top = tuned.slice(0, 25);
const hits = top.filter((card) => expectedNextPicks.has(card.name));
const leakedInputs = tuned.filter((card) => selected.includes(card.name));
const coldTopAverage = averageScore(cold.slice(0, 10));
const tunedTopAverage = averageScore(tuned.slice(0, 10));

const report = {
  player: `Commander player building ${commander} sacrifice/reanimator`,
  selectedCards: selected.length,
  coldTopAverage: Number(coldTopAverage.toFixed(3)),
  tunedTopAverage: Number(tunedTopAverage.toFixed(3)),
  scoreUplift: Number((tunedTopAverage - coldTopAverage).toFixed(3)),
  expectedSynergyHitsInTop25: hits.length,
  leakedSelectedCards: leakedInputs.map((card) => card.name),
  top10: tuned.slice(0, 10).map((card) => card.name),
};

console.log(JSON.stringify(report, null, 2));

if (leakedInputs.length > 0) {
  throw new Error('The API recommended cards already selected by the player');
}
if (hits.length < 8) {
  throw new Error(`Only ${hits.length} of the top 25 were strong expected synergies`);
}
if (tunedTopAverage - coldTopAverage < 0.1) {
  throw new Error('Coherent right swipes did not improve recommendation confidence enough');
}
