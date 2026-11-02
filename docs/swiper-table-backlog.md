# Swiper as a card table — product backlog

Eric's direction (2026-11-02): treat Swiper as a top-down table, with piles the player assigns to the four corners. Each corner displays the destination pile and count; recommendation supply displays ∞ or a distinct recommendation-source symbol rather than a fake count.

## Planned journey

1. Choose the central source: recommendations, a selected deck, wishlist, owned cards, or maybe.
2. Assign four corner destinations, including a Maybe pile; never move cards into an ambiguous destination.
3. Swipe to move/copy according to pile semantics; explicitly distinguish collection ownership from deck membership.
4. Review an existing pile in the center using keep/remove, with undo and counts updating immediately.
5. Use a restrained camera transition to shift focus between piles; keep motion optional and accessible keyboard/buttons available.
6. Persist pile placement per player/device and in account workspace; preserve existing Wishlist/Owned data through migration.

## Why backlog this interaction redesign

The corner assignment, central source and copy-vs-move behavior form one interaction model. Adding an isolated diagonal today would conflict with existing sheet-opening gestures and could silently move cards. First complete deck lifecycle and recommendation quality, then prototype this model with the existing libraries as sources/destinations.

## Acceptance criteria

- Four user-configurable corner piles, with accessible names/counts and recommendation ∞.
- Maybe is a real saved collection, usable as source or destination.
- Center source change never loses a selection or changes recommendation training implicitly.
- Keep/remove works on a selected existing list; actions preserve quantities and selected printing.
- Undo restores card, source/destination counts and current source order.
- Thumb-friendly portrait layout; keyboard alternatives; reduced-motion transition.
- Local/account persistence and a clear rule for duplicate cards and collection vs deck membership.
