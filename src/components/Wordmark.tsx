export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-light tracking-wide ${className}`} aria-label="Hairline">
      <span className="text-taupe">HAIR</span>
      <span className="text-ink font-extralight">|</span>
      <span className="text-ink">line</span>
    </span>
  );
}
