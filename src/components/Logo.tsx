export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="30" cy="12" r="8" fill="#36F294" />
      <path d="M8 34 L24 50 L56 14" fill="none" stroke="#36F294" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <LogoMark size={size * 1.3} />
      <span>
        Forma<span className="verde">Certa</span>
      </span>
    </span>
  )
}
