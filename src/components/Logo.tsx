export const Logo = () => (
  <div className="flex items-center gap-2">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B"/>
          <stop offset="1" stopColor="#EF4444"/>
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#logoGradient)"/>
      <circle 
        cx="14" 
        cy="14" 
        r="8" 
        fill="none" 
        stroke="white" 
        strokeWidth="4" 
        strokeDasharray="40 20" 
        transform="rotate(-135 14 14)"
        strokeLinecap="round"
      />
    </svg>
    <span className="text-2xl font-bold text-gray-800">CRMS</span>
  </div>
);