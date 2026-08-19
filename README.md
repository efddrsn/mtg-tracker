# MTG Tracker

A mobile-first Magic: The Gathering toolkit: a game tracker for floating mana,
storm count, turn phases, and custom counters — plus a swipe-based deck-building
recommendation app.

## Swipe Deck Builder (`/swipe`)

A Tinder-style card-discovery feed for building decks. The card image fills
almost the entire screen; everything else stays out of the way.

- **Swipe right** — add the card to your deck (yes pile)
- **Swipe left** — reject it (won't be shown again)
- **Swipe down** — open filters (format, colors, card types, rarity, theme)
- **Swipe up** — open your deck (with prices, copy-to-clipboard, remove)
- **EDHREC-ranked recommendations** — most-played cards surface first, fetched
  live from the [Scryfall API](https://scryfall.com/docs/api) (`order:edhrec`,
  no API key required)
- **Commander-first flow** — in Commander, you swipe through legal commanders
  first; picking one **locks the deck to its color identity** and seeds the rest
  of the feed toward its strategy
- **Commander name search** — already know your commander? An optional,
  dismissible overlay lets you search by name and jump straight to it
- **Add a card by name** — the same search-and-pick overlay, available from the
  deck sheet, to drop any specific card straight into your deck
- **Decklist import** — paste a list you already own (Moxfield/Archidekt style);
  it seeds your deck, sets the color filter, and teaches the recommender
- **Distinctive openers** — non-Commander formats start with famous *colored*
  cards (rare/mythic), skipping generic colorless staples like Sol Ring
- **Arena filter** — restrict to cards available on MTG Arena (`game:arena`),
  plus Arena-native formats (Alchemy, Historic, Explorer, Timeless, Brawl,
  Gladiator) alongside the paper formats
- **Rarity filter** — narrow to common/uncommon/rare/mythic
- **Adaptive recommendations** — a lightweight, on-device preference model
  learns from every yes/no and re-ranks the upcoming cards in real time
- **Tuning panel** — a small tab peeking in from the right edge (drag it in,
  or tap it) opens a live, fully editable view of the recommender: every
  learned weight as a draggable diverging bar, grouped by category, plus the
  algorithm's own dials (like/dislike strength, tag trigger, …). Drag any bar
  to correct the model on the spot, clear a single signal, or reset everything
  back to defaults — see [How the recommender works](#how-the-recommender-works)
  below
- **Undo**, tap-to-flip double-faced cards, and on-screen buttons as fallbacks
- **Persistent** — your commander, deck, rejections, learned tastes, and filters
  all survive reloads

Reach it from the **♥ Deck Builder** button in Settings, or navigate to `/swipe`.

### How the recommender works

The base order of the feed is **EDHREC popularity** (`order:edhrec`) — the
playability/power signal. On top of that, a transparent on-device preference
model (`src/deck/recommender.ts`) re-ranks the upcoming cards from your swipes.
Among equally on-theme cards, EDHREC rank breaks the tie, so power still wins.

The model deliberately tracks **only four signals it can be confident about**,
in priority order — each swipe moves a higher-priority signal's weight harder
than a lower one:

1. **🏷️ Oracle tags** (`otag:`) — Scryfall's curated, community-verified
   functional index (see [scryfall.com/docs/api/tags](https://scryfall.com/docs/api/tags)).
   Since Scryfall doesn't expose a card's own tags on the card object, tags are
   used as a **supplemental fetch**: once your swipes show real interest in a
   theme (roughly two clear likes), the feed spends one extra request pulling
   in that theme's precise `otag:` matches — cards functionally on-theme that
   the regex below would've missed (a bounce spell reads nothing like "destroy
   target", but the community correctly tags it `removal`) — scoped to your
   current format/color/Arena/rarity filters.
2. **🧵 Themes** — regex-detected oracle-text patterns (tokens, sacrifice, ramp,
   draw, …), cheap and immediate, computed from every card the moment it's
   fetched.
3. **⚡ Keywords** — ability words like flying or trample.
4. **💧 Mana value** — the weakest signal on its own (plenty of great cards
   share any given cost), so it nudges rather than steers.

Deliberately left out entirely: card type and color (already hard filters in
the config sheet, so re-learning them as soft preferences would just be
redundant noise) and creature subtype/tribal synergy (too easily confused with
"I happened to like one Merfolk" — cut rather than tuned, in favor of keeping
only signals that are informative on their own). Set, rarity, flavor, and art
were never considered.

Every constant above (like/dislike strength, the weight clamp, the tag-trigger
threshold, the commander bias, the opener length) — plus the learned weight of
every individual trait — is inspectable and editable live in the **tuning
panel**. Nothing about the algorithm is a black box.

## Game Tracker Features

- **Mana Floating** — Track each color of mana in your pool with fast +/− buttons
- **Storm Counter** — Quick increment for storm-count decks
- **Turn Phases** — Visual phase tracker with tap-to-jump and Next/New Turn buttons
- **Custom Counters** — Add any number of named counters for tokens, life, poison, etc.
- **Grid Layout** — Configurable 2/3/4 column grid, iPhone-widget style
- **Hold-to-Repeat** — Hold +/− to rapidly increment with acceleration
- **Haptic Feedback** — Vibration on every tap for tactile confirmation
- **Per-Counter Reset** — ✕ button on each widget, plus a global reset
- **Persistent State** — All settings and counters survive page reloads (localStorage)
- **Settings Page** — Configure grid columns, mana colors, widget order/size/visibility, new-turn behavior

## Getting Started

```bash
npm install
npm run dev
```

Open on your phone or use browser dev tools in mobile mode.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Zustand (state management with persistence)
- React Router
