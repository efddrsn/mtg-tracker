interface Props {
  variant: string;
}

/** Painterly aurora layer driven by CSS animations on stacked blurred blobs. */
export function AuroraLayer({ variant }: Props) {
  return (
    <div className={`aurora-layer aurora-${variant}`} aria-hidden>
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-blob aurora-blob-4" />
      <div className="aurora-stars" />
    </div>
  );
}
