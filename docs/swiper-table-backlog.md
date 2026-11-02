# Swiper as a card table — implementation

Updated 2026-11-02: The Swiper is now scoped to a named, saved deck/list. A player can reopen any deck from **Meus decks** or switch the active workspace in the Swiper header.

## Interaction

- Center source: infinite recommendations (∞), deck, wishlist, maybe, or owned. List sources show their actual card count and review progress.
- Four configurable swipe corner destinations: top-left Maybe, top-right Wishlist, bottom-left Deck, bottom-right Owned by default. Each corner has a visible destination and count.
- Diagonal swipes send the current card to the shown destination. Straight left passes/removes and straight right keeps during review or uses the right-hand destination during discovery.
- Ownership and deck inclusion are independent; Owned is never silently removed when a card joins Deck.
- Review of an existing list supports keep, remove, or moving to another pile; selected printing and quantity are retained. Undo reverses list state and restores the previous review position.
- Filter sheet still opens on downward vertical gesture, list sheet on upward gesture. No action buttons other than Undo beneath the card.
- Keyboard: 1–4 select mapped corners, Left passes, Right accepts/keeps, Backspace or Cmd/Ctrl+Z undoes.
- Brief focus animation when switching the central source; animation disabled by reduced-motion preference.

## Persistence and migration

- User choices, four pile contents, source selection, rejected IDs, config, revisions, corner layout and review index are saved in the active `HubDeck.swiper` and synchronized through the existing authenticated deck workspace.
- Deck and sideboard quantities and selected printing IDs are preserved; no ownership is inferred from deck membership.
- Existing `mtg-swipe-deck` wishlist, owned cards and revisions are migrated into the active deck on first visit or into a new named `Minhas descobertas` list when no active deck exists. The legacy key is not deleted.
- Each saved deck/list has independent data; switching workspaces persists the previous state before loading the next.

## Remaining enhancements (not part of this release)

- Arbitrary pile names/positions beyond the four saved built-in destinations.
- More elaborate tabletop camera translation between separate spatial piles; current source switching uses a minimal focus transition.
- Durable undo history across browser restarts (undo within the current open session works).
- Cross-device simultaneous-edit conflict resolution for the same deck.
- Browser E2E gesture screenshots and physical iOS/Android device validation.

## Validation

GitHub Actions runs the TypeScript build and Vitest suite. Workspace tests cover migration, per-deck isolation, list-versus-ownership semantics, quantity preservation, and corner/source resume. Runtime layout still requires device testing; automated unit tests do not prove precise iOS Safari gesture ergonomics.
