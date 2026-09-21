import { useCallback } from 'react';
import { useDeckStore } from '../deck/deckStore';
import { searchCards, type DeckCard } from '../deck/scryfall';
import { CardSearchModal } from './CardSearchModal';
import type { CardList } from '../deck/deckStore';

interface AddCardSearchProps {
  destination?: CardList;
  onClose: () => void;
}

// General "add a card by name" field — the same search-and-pick overlay as
// the commander finder, but scoped to the deck's current format/color/
// Arena/rarity filters and wired to add straight into the deck (which also
// seeds the recommender, same as any other add).
export function AddCardSearch({ destination = 'wishlist', onClose }: AddCardSearchProps) {
  const config = useDeckStore((s) => s.config);
  const commanderIdentity = useDeckStore((s) => s.commander?.colorIdentity ?? null);
  const addToWishlist = useDeckStore((s) => s.addToWishlist);
  const addToOwned = useDeckStore((s) => s.addToOwned);

  const search = useCallback(
    (term: string, signal?: AbortSignal) => searchCards(term, config, commanderIdentity, signal),
    [config, commanderIdentity],
  );

  const choose = (card: DeckCard) => {
    if (destination === 'owned') addToOwned(card);
    else addToWishlist(card);
    onClose();
  };

  return (
    <CardSearchModal
      ariaLabel={destination === 'owned' ? 'Add owned card' : 'Add wishlist card'}
      placeholder="Search for a card…"
      dismissLabel="Close"
      hint={`Type a card name to add it to ${destination === 'owned' ? 'Já tenho' : 'Wishlist'}.`}
      searchFn={search}
      onPick={choose}
      onClose={onClose}
    />
  );
}
