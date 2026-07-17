// lucide-react no longer ships brand/logo icons, so we provide a minimal,
// elegant set of inline SVG brand marks used only for footer social links.
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path d="M14 9h2.5V6H14c-1.933 0-3.5 1.567-3.5 3.5V12H8v3h2.5v6h3v-6H16l.5-3h-3V9.8c0-.44.36-.8.8-.8Z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46" />
      <path d="M14 4c0 2.5 2 4.5 4.5 4.5" />
    </svg>
  );
}
