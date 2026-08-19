import { useDeckStore } from '../deck/deckStore';
import { searchCommanders, type DeckCard } from '../deck/scryfall';
import { CardSearchModal } from './CardSearchModal';

interface CommanderSearchProps {
  onClose: () => void;
}

// Optional shortcut for players who already know their commander: type a name,
// pick from matches, and skip the swiping entirely.
export function CommanderSearch({ onClose }: CommanderSearchProps) {
  const setCommander = useDeckStore((s) => s.setCommander);

  const choose = (card: DeckCard) => {
    setCommander(card);
    onClose();
  };

  return (
    <CardSearchModal
      ariaLabel="Find your commander"
      placeholder="Search for a commander…"
      dismissLabel="Skip"
      hint="Type a name to jump straight to your commander, or skip to swipe."
      searchFn={searchCommanders}
      onPick={choose}
      onClose={onClose}
    />
  );
}
