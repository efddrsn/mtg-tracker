import { useCallback } from 'react';
import { useDeckStore } from '../deck/deckStore';
import { searchCards, type DeckCard } from '../deck/scryfall';
import { CardSearchModal } from './CardSearchModal';

interface AddCardSearchProps {
  onClose: () => void;
}

// General "add a card by name" field — the same search-and-pick overlay as
// the commander finder, but scoped to the deck's current format/color/
// Arena/rarity filters and wired to add straight into the deck (which also
// seeds the recommender, same as any other add).
export function AddCardSearch({ onClose }: AddCardSearchProps) {
  const config = useDeckStore((s) => s.config);
  const commanderIdentity = useDeckStore((s) => s.commander?.colorIdentity ?? null);
  const addToDeck = useDeckStore((s) => s.addToDeck);

  const search = useCallback(
    (term: string, signal?: AbortSignal) => searchCards(term, config, commanderIdentity, signal),
    [config, commanderIdentity],
  );

  const choose = (card: DeckCard) => {
    addToDeck(card);
    onClose();
  };

  return (
    <CardSearchModal
      ariaLabel="Add a card"
      placeholder="Search for a card to add…"
      dismissLabel="Close"
      hint="Type a card name to add it straight to your deck."
      searchFn={search}
      onPick={choose}
      onClose={onClose}
    />
  );
}
