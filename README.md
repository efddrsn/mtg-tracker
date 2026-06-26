# MTG Tracker

A mobile-first Magic: The Gathering toolkit: a game tracker for floating mana,
storm count, turn phases, and custom counters — plus a swipe-based deck-building
recommendation app.

## Swipe Deck Builder (`/swipe`)

A Tinder-style card-discovery feed for building decks. The card image fills
almost the entire screen; everything else stays out of the way.

- **Swipe right** — add the card to your deck (yes pile)
- **Swipe left** — reject it (won't be shown again)
- **Swipe down** — open filters (format, colors, card types, theme keyword)
- **Swipe up** — open your deck (with prices, copy-to-clipboard, remove)
- **EDHREC-ranked recommendations** — most-played cards surface first, fetched
  live from the [Scryfall API](https://scryfall.com/docs/api) (`order:edhrec`,
  no API key required)
- **Commander-first flow** — in Commander, you swipe through legal commanders
  first; picking one **locks the deck to its color identity** and seeds the rest
  of the feed toward its strategy
- **Commander name search** — already know your commander? An optional,
  dismissible overlay lets you search by name and jump straight to it
- **Decklist import** — paste a list you already own (Moxfield/Archidekt style);
  it seeds your deck, sets the color filter, and teaches the recommender
- **Distinctive openers** — non-Commander formats start with famous *colored*
  cards (rare/mythic), skipping generic colorless staples like Sol Ring
- **Adaptive recommendations** — a lightweight, on-device preference model
  learns from every yes/no and re-ranks the upcoming cards in real time

### How the recommender works

The base order of the feed is **EDHREC popularity** (`order:edhrec`) — the
playability/power signal. On top of that, a transparent on-device preference
model (`src/deck/recommender.ts`) re-ranks the upcoming cards from your swipes.
Each yes/no nudges feature weights describing a card's **synergy** (oracle-text
themes like tokens/sacrifice/ramp, and keywords), **efficiency** (mana-value
buckets), and **role** (broad card type, color). Among equally on-theme cards,
EDHREC rank breaks the tie, so power still wins.

Deliberately *not* considered: set, rarity, flavor, or art. Creature **type** is
ignored too — unless the deck proves it's tribal (a subtype only starts
mattering once several liked cards share it), so a lone creature you liked won't
flood the feed with its kindred.
- **Undo**, tap-to-flip double-faced cards, and on-screen buttons as fallbacks
- **Persistent** — your commander, deck, rejections, learned tastes, and filters
  all survive reloads

Reach it from the **♥ Deck Builder** button in Settings, or navigate to `/swipe`.

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
