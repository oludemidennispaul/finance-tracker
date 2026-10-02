// The Mimo Eye mark: an eye whose iris is a coin. It blinks every few seconds
// (see .logo-eye in styles.css); reduced-motion settings keep it still.
export default function Logo({ size = 32 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" className="logo-tile" />
      <g className="logo-eye">
        <path d="M4 16c3.6-6 8-9 12-9s8.4 3 12 9c-3.6 6-8 9-12 9s-8.4-3-12-9z" className="logo-white" />
        <circle cx="16" cy="16" r="6.2" className="logo-iris" />
        <circle cx="16" cy="16" r="2.6" className="logo-pupil" />
        <circle cx="18.3" cy="13.6" r="1.3" className="logo-white" />
      </g>
    </svg>
  );
}
