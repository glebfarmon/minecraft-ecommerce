export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      {online && (
        <span className="absolute inset-0 animate-ping rounded-full bg-online opacity-60 motion-reduce:hidden" />
      )}
      <span
        className={`relative inline-flex size-2 rounded-full ${online ? 'bg-online' : 'bg-muted'}`}
      />
    </span>
  );
}
