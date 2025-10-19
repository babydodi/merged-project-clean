import Link from 'next/link';
import React from 'react';

export default function Button({ children, to, onClick, variant = "primary", type = "button", disabled = false }) {
  const baseClasses = "inline-block text-lg px-8 py-6 rounded-full font-semibold text-center transition-colors duration-300 focus:outline-none focus:ring-2";

  const variants = {
    primary: "bg-white text-black hover:bg-gray-200 focus:ring-white",
    secondary: "bg-gray-800 text-white border border-white hover:bg-gray-700 focus:ring-white",
  };

  const buttonClass = `${baseClasses} ${variants[variant]} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  if (to) {
    return (
      <Link href={to} className={buttonClass}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={buttonClass}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
