"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Prints one thing from a screen full of other things.
 *
 * On mount the chain of ancestors up to <body> is marked `print-keep`, and the
 * print stylesheet gives every *other* child along that chain `display: none`.
 * Hiding rather than merely making things invisible matters: invisible content
 * still takes up space and still generates sheets of paper, which is how an
 * invoice ends up on page four behind three near-blank ones.
 */
export function PrintArea({
  children,
  /** Wide output — reports, the tri-fold menu — asks for landscape. */
  landscape = false,
  className = "",
}: {
  children: ReactNode;
  landscape?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const marked: HTMLElement[] = [];
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      p.classList.add("print-keep");
      marked.push(p);
    }
    document.body.classList.add("print-isolate");

    return () => {
      document.body.classList.remove("print-isolate");
      marked.forEach((p) => p.classList.remove("print-keep"));
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`print-target ${landscape ? "print-landscape" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
