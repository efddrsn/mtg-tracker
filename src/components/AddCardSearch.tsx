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
  const moveCard = useDeckStore((s) => s.moveCard);

  const search = useCallback(
    (term: string, signal?: AbortSignal) => searchCards(term, config, commanderIdentity, signal),
    [config, commanderIdentity],
  );

  const choose = (card: DeckCard) => {
    moveCard(card, 'recommendations', destination);
    onClose();
  };

  return (
    <CardSearchModal
      ariaLabel={`Adicionar carta em ${destination}`}
      placeholder="Search for a card…"
      dismissLabel="Close"
      hint={`Pesquise uma carta para adicionar à pilha: ${destination}.`}
      searchFn={search}
      onPick={choose}
      onClose={onClose}
    />
  );
}
