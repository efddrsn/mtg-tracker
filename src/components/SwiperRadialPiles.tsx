import { useState } from "react";
import type { SwiperPileDefinition } from "../deck/hubStore";
import { isRightSide } from "../deck/swiperPiles";

interface Props {
  piles: SwiperPileDefinition[];
  activeSource: string;
  activeTarget: string | null;
  dragging: boolean;
  count: (pileId: string) => number;
  onCenter: (pileId: string) => void;
  onUpdate: (pileId: string, change: Partial<SwiperPileDefinition>) => void;
  onAdd: (name: string, tag: string, angle: number, linkedGroup: string) => void;
  onAggregate: (tag: string) => void;
}
export function SwiperRadialPiles({
  piles, activeSource, activeTarget, dragging, count, onCenter, onUpdate,
  onAdd, onAggregate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [group, setGroup] = useState("");
  const [angle, setAngle] = useState(165);
  const [eraseConfirm, setEraseConfirm] = useState(false);
  const available = piles.filter(p => !p.deleted);
  const selected = available.find(p => p.id === focused) || available[0];
  const shown = available.filter(p => p.visible);
  const change = (key: keyof SwiperPileDefinition, value: string | number | boolean) => {
    if (selected) onUpdate(selected.id, { [key]: value });
  };
  return (
    <>
      <div className="swipe-radial-layer" aria-label="Pilhas ao redor da carta">
        <div className={`swipe-discard-destination ${dragging && activeTarget === "reject" ? "swipe-target-active" : ""}`}
          title="Descarte: esquerda ou diagonal inferior esquerda" aria-label="Descarte fixo">
          <span>Descartar</span><strong>×</strong>
        </div>
        {shown.map(p => {
          const rad = p.angle * Math.PI / 180;
          const x = 50 + Math.sin(rad) * 42;
          const y = 50 - Math.cos(rad) * 43;
          const positive = isRightSide(p.angle);
          return <button type="button" key={p.id}
            className={`swipe-radial-pile ${dragging && activeTarget === p.id ? "swipe-target-active" : ""} ${activeSource === p.id ? "swipe-target-center" : ""}`}
            style={{ left: x + "%", top: y + "%" }}
            onPointerDown={e=>e.stopPropagation()}
            onPointerUp={e=>e.stopPropagation()}
            onClick={() => onCenter(p.id)}
            aria-label={`Centralizar ${p.name}. ${count(p.id)} cartas. ${positive ? "Reforça recomendações." : ""}`}>
            <span className="swipe-radial-name">{p.name}</span>
            <span className="swipe-radial-count">{count(p.id)}{positive && <span className="swipe-radial-positive" title="Este destino reforça as recomendações"> ✧</span>}</span>
          </button>;
        })}
      </div>
      <button type="button" className="swipe-pile-arrange" aria-expanded={editing}
        onPointerDown={e=>e.stopPropagation()} onClick={()=>{setEditing(!editing);setCreating(false);setEraseConfirm(false);}}>
        {editing ? "Fechar" : "Organizar pilhas"}
      </button>
      {editing && <section className="swipe-radial-editor" role="dialog"
        aria-label="Organizar pilhas" onPointerDown={e=>e.stopPropagation()}
        onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
        <header><strong>Pilhas</strong>
          <button type="button" onClick={()=>setCreating(!creating)}>+ Nova</button>
          <button type="button" aria-label="Fechar organização" onClick={()=>setEditing(false)}>×</button>
        </header>
        <p className="swipe-radial-intro">Distribua as pilhas pelo relógio. O lado direito <b>✧ reforça recomendações</b>. Pilhas vinculadas não podem conter a mesma carta.</p>
        {creating ? <form className="swipe-radial-new" onSubmit={e=>{
          e.preventDefault();onAdd(name || "Nova pilha",tag,angle,group);setCreating(false);setName("");setTag("");setGroup("");
        }}>
          <input aria-label="Nome da nova pilha" placeholder="Nome da pilha" value={name}
            required maxLength={48} onChange={e=>setName(e.target.value)} />
          <input aria-label="Tag da nova pilha" placeholder="Tag (ex: trade)" value={tag}
            maxLength={48} onChange={e=>setTag(e.target.value)} />
          <input aria-label="Grupo exclusivo da nova pilha" placeholder="Grupo exclusivo (opcional)" value={group}
            maxLength={48} onChange={e=>setGroup(e.target.value)} />
          <label>Direção: {angle}°
            <input type="range" min="0" max="355" step="5" value={angle}
              onChange={e=>setAngle(Number(e.target.value))}/>
          </label>
          <button type="submit">Criar pilha</button>
        </form> : <>
          <div className="swipe-radial-editor-tabs">
            {available.map(p=><button key={p.id} type="button"
              className={selected?.id===p.id ? "active" : ""}
              onClick={()=>{setFocused(p.id);setEraseConfirm(false);}}>
              {p.name}{p.visible ? "" : " ◌"}
            </button>)}
          </div>
          {selected && <>
            <label>Nome
              <input aria-label="Nome da pilha" value={selected.name} maxLength={48}
                onChange={e=>change("name",e.target.value)}/>
            </label>
            <label>Tag
              <input aria-label="Tag da pilha" value={selected.tag} maxLength={48}
                onChange={e=>change("tag",e.target.value.toLowerCase().trim())}/>
            </label>
            <label>Grupo vinculado (exclusivo)
              <input aria-label="Grupo vinculado" value={selected.linkedGroup || ""} maxLength={48}
                onChange={e=>change("linkedGroup",e.target.value.trim())}/>
            </label>
            <label>Posição: {selected.angle}°
              <input type="range" min="0" max="355" step="5" value={selected.angle}
                aria-label="Posição angular da pilha"
                onChange={e=>change("angle",Number(e.target.value))}/>
            </label>
            <div className="swipe-radial-editor-actions">
              <button type="button" onClick={()=>change("visible",!selected.visible)}>
                {selected.visible ? "Ocultar" : "Mostrar"}
              </button>
              <button type="button" disabled={!selected.tag}
                onClick={()=>{onAggregate(selected.tag);setEditing(false);}}>
                Todas #{selected.tag}
              </button>
              {eraseConfirm
                ? <button type="button" className="swipe-radial-danger"
                  onClick={()=>{onUpdate(selected.id,{deleted:true,visible:false});setEraseConfirm(false);setFocused(null);}}>
                  Confirmar exclusão
                </button>
                : <button type="button" className="swipe-radial-danger"
                  onClick={()=>setEraseConfirm(true)}>Excluir</button>}
            </div>
            {selected.visible && isRightSide(selected.angle) && <p className="swipe-radial-signal">✧ Esta pilha reforça as recomendações quando recebe cartas.</p>}
            {!selected.visible && <p className="swipe-radial-signal">Oculta: pode ter sido posicionada sobre outra pilha. Mova-a para um setor livre antes de mostrar.</p>}
          </>}
        </>}
      </section>}
    </>
  );
}
