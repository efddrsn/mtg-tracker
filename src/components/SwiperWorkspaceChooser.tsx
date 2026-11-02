import { useState } from 'react';
import { labelOf, LABEL_NAMES, type HubDeck, type ListLabel } from '../deck/hubStore';

interface Props {
  decks: HubDeck[];
  onOpen: (deck: HubDeck) => void;
  onCreate: (title: string, label: ListLabel) => void;
  onBack: () => void;
  onClose?: () => void;
}

export function SwiperWorkspaceChooser({ decks, onOpen, onCreate, onBack, onClose }: Props) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState<ListLabel>('none');
  const [search, setSearch] = useState('');
  const list = decks.filter(d => !d.deletedAt && d.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <main className="swipe-picker" aria-label="Escolher lista para o Swiper">
      <div className="swipe-picker-inner">
        <header className="swipe-picker-head">
          <button type="button" onClick={onBack} aria-label="Voltar">←</button>
          <div><p>SWIPER</p><h1>Escolha uma lista</h1></div>
          {onClose && <button type="button" onClick={onClose} aria-label="Fechar">×</button>}
        </header>
        <section className="swipe-picker-existing">
          <h2>Listas e decks existentes <span>{decks.length}</span></h2>
          {decks.length > 4 && <input aria-label="Buscar listas" placeholder="Buscar por nome"
            value={search} onChange={e => setSearch(e.target.value)} />}
          <div className="swipe-picker-list">
            {list.map(d => <button type="button" className="swipe-picker-item" key={d.id}
              onClick={() => onOpen(d)}>
              <div><strong>{d.title}</strong>
                <small>{LABEL_NAMES[labelOf(d)]} · {d.cards.reduce((sum, c) => sum + c.quantity, 0)} cartas</small>
              </div><span>Continuar ›</span>
            </button>)}
            {!list.length && <p className="swipe-picker-empty">
              {search ? 'Nenhuma lista corresponde à busca.' : 'Você ainda não tem listas salvas.'}
            </p>}
          </div>
        </section>
        <section className="swipe-picker-create">
          <h2>Criar nova lista</h2>
          <form onSubmit={e => { e.preventDefault(); onCreate(name.trim() || 'Nova lista', label); }}>
            <input aria-label="Nome da lista" placeholder="Nome (opcional)" value={name}
              maxLength={90} onChange={e => setName(e.target.value)} />
            <select aria-label="Classificação da lista" value={label}
              onChange={e => setLabel(e.target.value as ListLabel)}>
              <option value="none">Sem classificação</option>
              <option value="wishlist">Wishlist</option>
              <option value="collection">Coleção</option>
            </select>
            <button type="submit">Criar e começar</button>
          </form>
        </section>
      </div>
    </main>
  );
}
