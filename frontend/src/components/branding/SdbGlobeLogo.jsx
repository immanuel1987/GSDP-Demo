export function SdbGlobeLogo({ size = 36, className = '' }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="17" fill="#0057A8" stroke="#003A75" strokeWidth="1" />
      <ellipse
        cx="18"
        cy="18"
        rx="7"
        ry="17"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.8"
        fill="none"
      />
      <line x1="1" y1="18" x2="35" y2="18" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      <line x1="3" y1="10" x2="33" y2="10" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
      <line x1="3" y1="26" x2="33" y2="26" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
      <path
        d="M14 5 Q22 10 14 18 Q6 26 14 31"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        fill="none"
      />
      <circle cx="15" cy="15" r="1.5" fill="#E8600A" />
      <circle cx="18" cy="13" r="1.8" fill="white" />
      <circle cx="21" cy="15" r="1.5" fill="#E8600A" />
      <line x1="15" y1="16.5" x2="15" y2="21" stroke="#E8600A" strokeWidth="1.5" />
      <line x1="18" y1="14.8" x2="18" y2="21" stroke="white" strokeWidth="1.8" />
      <line x1="21" y1="16.5" x2="21" y2="21" stroke="#E8600A" strokeWidth="1.5" />
      <polyline points="18,8 15,13 18,11 21,13 18,8" fill="white" stroke="none" />
    </svg>
  )
}
