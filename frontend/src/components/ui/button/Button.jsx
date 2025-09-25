import React from 'react';

export const Button = ({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false,
  style = {} 
}) => {
  const baseStyle = {
    padding: variant === 'large' ? '12px 25px' : '10px 20px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '5px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease',
    margin: '4px'
  };

  const variants = {
    primary: { background: '#2d8cff', color: 'white' },
    warning: { background: '#ff9800', color: 'white' },
    success: { background: '#4caf50', color: 'white' },
    large: { background: '#2d8cff', color: 'white', padding: '12px 25px' }
  };

  return (
    <button 
      style={{ ...baseStyle, ...variants[variant], ...style }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};