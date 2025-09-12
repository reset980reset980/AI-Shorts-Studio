
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  titleAction?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, titleAction, className = '' }) => {
  return (
    <div className={`bg-[#2a3142] p-6 rounded-lg shadow-md ${className}`}>
      <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-3">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {titleAction && <div>{titleAction}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
};
