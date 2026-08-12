/**
 * The Hairline wordmark.
 *
 * In the salon's logo the tall centre stroke IS the single "l" — it reads
 * HAIR + l + ine. Rendering "HAIR | line" gives two l's ("Hairlline"), which is
 * why Karin flagged it. The stroke is always black, whatever the HAIR is.
 */
export function Wordmark({
  className = "",
  /** On dark grounds the stroke and tail need to be white, not black. */
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const solid = onDark ? "text-white" : "text-ink";
  return (
    <span className={`font-light tracking-wide ${className}`} aria-label="Hairline">
      <span className="text-taupe">HAIR</span>
      {/* The single centre "l", drawn taller than the lowercase that follows */}
      <span className={`${solid} font-extralight`} style={{ letterSpacing: "0.02em" }}>
        l
      </span>
      <span className={solid}>ine</span>
    </span>
  );
}
