
import React from 'react';
import type { Tab } from '../types';

interface HeaderProps {
    tabs: Tab[];
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    showLogs: boolean;
    setShowLogs: (show: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ tabs, activeTab, setActiveTab, showLogs, setShowLogs }) => {
    return (
        <header className="flex justify-between items-center bg-[#2a3142] p-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-6">
                <h1 className="text-2xl font-black text-yellow-400 pl-2" style={{ fontFamily: "'Gugi', cursive" }}>
                    빛나는 썰
                </h1>
                <nav className="flex items-center space-x-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                activeTab === tab 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-transparent text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md transition-colors duration-200"
                >
                    {showLogs ? 'Close Log Viewer' : 'Log Viewer'}
                </button>
            </div>
        </header>
    );
};