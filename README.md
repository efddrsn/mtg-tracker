# MTG Tracker

A mobile-first Magic: The Gathering toolkit: a game tracker for floating mana,
storm count, turn phases, and custom counters — plus a swipe-based deck-building
recommendation app.

## Swipe Deck Builder (`/swipe`)

A Tinder-style card-discovery feed for building decks. The card image fills
almost the entire screen; everything else stays out of the way.

- **Swipe right-up** — add the card to your wishlist
- **Swipe right-down** — mark the card as already owned
- **Swipe left** — reject it (won't be shown again)
- **Swipe down** — open filters (format, colors, card types, rarity, theme)
- **Swipe up** — open your collections (wishlist + owned)
- **Brazilian market prices** — live lowest LigaMagic marketplace price in BRL
- **CardTutor buying export** — resolves direct product URLs, checks live stock and prices, copies all links, and downloads the wishlist as CSV
- **Editable, versioned lists** — add/remove cards, copy exact printings, save and restore snapshots
- **Hold for a full-card preview** — long-press any list row
- **Printing picker** — choose a specific set/art from a mobile carousel adapted from the Binder Generator UI
- **Deck-aware Commander recommendations** — ranked by
  [Recommander](https://recommander.cards/) from the commander and cards already
  selected; Scryfall's EDHREC order remains the fallback and powers other formats
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
- **Adaptive recommendations** — every yes becomes new model input and refreshes
  the ranking; every no is excluded without being misrepresented as a deck card
- **Recommendation panel** — the right-edge tab explains the active model input,
  rejection behavior, and automatic fallback
- **Undo**, tap-to-flip double-faced cards, and on-screen buttons as fallbacks
- **Persistent** — your commander, deck, rejections, and filters survive reloads

### Buying and store roadmap

The first store adapter resolves exact CardTutor product pages, extracts live
offer details, and exports links or CSV from the wishlist. The next phase adds
more Brazilian stores, exact-printing matching across them, and cart
consolidation that minimizes both total price and the number of stores.

Reach it from the **♥ Deck Builder** button in Settings, or navigate to `/swipe`.

### How the recommender works

For Commander decks, `src/deck/recommanderApi.ts` sends the commander and every
accepted card to Recommander. Its score remains the primary ordering signal. A
small confidence correction based on commander sample size and lift prevents a
high-scoring card seen in only a handful of decks from dominating the cold
start.

Right swipes update the API input after the card animation. Left swipes are
stored as exact exclusions. Recommander's public request has no negative-card
field, so sending rejected cards would incorrectly tell the model that those
cards belong in the deck. Optional type, rarity, Arena, basic-land, and text
filters are applied after Scryfall hydrates the recommendation IDs.

If Recommander is unavailable or its 50-card result runs low, the feed
automatically continues with legal cards in Scryfall EDHREC order. Commander
selection and non-Commander formats continue to use Scryfall directly.

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
