
import React from 'react';
import type { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
  show: boolean;
}

const LogTypeBadge: React.FC<{ type: LogEntry['type'] }> = ({ type }) => {
  const baseClasses = "px-2 py-1 text-xs font-bold rounded";
  switch (type) {
    case 'INFO':
      return <span className={`${baseClasses} bg-blue-500 text-white`}>INFO</span>;
    case 'SUCCESS':
      return <span className={`${baseClasses} bg-green-500 text-white`}>SUCCESS</span>;
    case 'ERROR':
      return <span className={`${baseClasses} bg-red-500 text-white`}>ERROR</span>;
    default:
      return <span className={`${baseClasses} bg-gray-500 text-white`}>LOG</span>;
  }
};

export const LogViewer: React.FC<LogViewerProps> = ({ logs, show }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-[#1e2434] border-t-2 border-gray-700 shadow-2xl z-50 flex flex-col">
      <div className="flex-shrink-0 p-3 bg-[#2a3142] border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-bold">Log Viewer</h3>
        {/* Add controls here if needed */}
      </div>
      <div className="overflow-y-auto p-3 font-mono text-sm flex-grow">
        {logs.map((log, index) => (
          <div key={index} className="flex items-start mb-2">
            <span className="text-gray-500 mr-3">{log.timestamp}</span>
            <LogTypeBadge type={log.type} />
            <p className="ml-3 break-all">{log.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
