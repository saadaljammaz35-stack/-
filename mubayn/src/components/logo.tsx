export function LogoMark({ className = "logo-mark" }: { className?: string }) {
  // A lens over a device edge, with the scan line: "the one who reveals".
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="3" width="15" height="26" rx="3.5" fill="none" stroke="#121a24" strokeWidth="2.2" />
      <circle cx="20" cy="17" r="7.2" fill="#f3efe6" stroke="#121a24" strokeWidth="2.2" />
      <path d="M14.2 17h11.6" stroke="#f2a93b" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M25.2 22.2l3.6 3.6" stroke="#121a24" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
