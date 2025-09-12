import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileName?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, fileName, children }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
        onClick={onClose}
    >
      <div 
        className="bg-[#2a3142] rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-gray-600 p-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {fileName && <span className="text-sm bg-gray-700 text-gray-300 px-2 py-1 rounded">{fileName}</span>}
          </div>
          <button onClick={onClose} className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">닫기</button>
        </div>
        <div className="p-4 flex-grow">
          {children}
        </div>
      </div>
    </div>
  );
};
