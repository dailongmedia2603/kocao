import React from 'react';

const Logo = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 16.5v-9l7 4.5-7 4.5z" fill="currentColor" />
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 2a10 10 0 0 1 3.53 19.47" />
      <path d="M22 12a10 10 0 0 0-19.47-3.53" />
      <path d="M2 12a10 10 0 0 1 19.47 3.53" />
      <path d="M12 22a10 10 0 0 1-3.53-19.47" />
    </svg>
  );
};

export default Logo;