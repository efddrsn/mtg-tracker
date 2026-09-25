import { describe, expect, it } from 'vitest';
import {
  cardTutorSearchUrl,
  parseCardTutorListings,
  parseCardTutorSearch,
} from './cardtutor.mjs';

describe('CardTutor adapter', () => {
  it('builds a CardTutor search fallback', () => {
    const url = new URL(cardTutorSearchUrl('Fire // Ice'));
    expect(url.searchParams.get('view')).toBe('ecom/itens');
    expect(url.searchParams.get('searchExactMatch')).toBe('1');
    expect(url.searchParams.get('busca')).toBe('Fire');
  });

  it('selects only the exact card instead of an art card', () => {
    const html = `
      <div class="title"><a href="https://www.cardtutor.com.br/?view=ecom/item&amp;refid=exact-ref">Smaug the Magnificent</a></div>
      <div class="title"><a href="https://www.cardtutor.com.br/?view=ecom/item&amp;refid=art-ref">Smaug the Magnificent (Art Card)</a></div>`;
    expect(parseCardTutorSearch(html, 'Smaug the Magnificent')).toEqual({
      name: 'Smaug the Magnificent',
      refid: 'exact-ref',
      url: 'https://www.cardtutor.com.br/?view=ecom/item&refid=exact-ref',
    });
  });

  it('extracts edition, condition, extras, stock, and BRL price', () => {
    const html = `<div class="table-cards-row ">
      <a href="./?view=ecom/itens&amp;tcg=1&amp;txt_edicao=481009"><img title="The Hobbit (Dragon Hoard Surge Foil)" class="icon icon-edicao"></a>
      <img alt='Ingl&ecirc;s' src='https://www.lmcorp.com.br/images/bandeiras/en.svg'>
      <div class="table-cards-body-cell quality tooltip-item"><div>Qualidade</div> NM <div>Nova</div></div>
      <div class="table-cards-body-cell tooltip-item card-extras"><span>Foil Especial / Foil Etched</span></div>
      <div><div class="title-mobile">Estoque</div> 1 unid.</div>
      <div class="table-cards-body-cell card-preco"><div>Preço</div> R$ 2.099,95</div>
    </div>`;
    expect(parseCardTutorListings(html)).toEqual([{
      editionId: '481009',
      edition: 'The Hobbit (Dragon Hoard Surge Foil)',
      language: 'Inglês',
      quality: 'NM',
      extras: 'Foil Especial / Foil Etched',
      stock: 1,
      price: 2099.95,
    }]);
  });
});
