import React, { useState, useCallback, useEffect } from 'react';
import { ScriptingTab } from './views/ScriptingTab';
import { ChannelsTab } from './views/ChannelsTab';
import { EditingTab } from './views/EditingTab';
import { UploadTab } from './views/UploadTab';
import { SettingsTab } from './views/SettingsTab';
import { LogViewer } from './components/LogViewer';
import type { Tab, LogEntry, Script, Settings } from './types';
import { TABS } from './constants';
import { Header } from './components/Header';
import { getSettings, saveSettings } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('대본입력');
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const addLog = useCallback((message: string, type: 'INFO' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  }, []);

  useEffect(() => {
    addLog('AI Shorts Studio가 시작되었습니다.');
    const loadInitialSettings = async () => {
        try {
            const fetchedSettings = await getSettings();
            setSettings(fetchedSettings);
            addLog('설정을 성공적으로 불러왔습니다.', 'SUCCESS');
        } catch (error) {
            addLog('설정 로딩 실패.', 'ERROR');
        }
    };
    loadInitialSettings();
  }, [addLog]);

  const handleSettingsUpdate = async (newSettings: Partial<Settings>) => {
      if (!settings) return;
      
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings); // Optimistic update

      try {
          await saveSettings(newSettings);
          addLog('설정이 원격으로 저장되었습니다.', 'SUCCESS');
      } catch (error) {
          addLog('설정 저장 실패.', 'ERROR');
          // Optional: Revert to previous state if save fails
          // setSettings(settings); 
      }
  };

  const renderTabContent = () => {
    if (!settings) {
       return (
        <div className="flex justify-center items-center h-64">
          <p className="text-xl">설정을 불러오는 중입니다...</p>
        </div>
      );
    }

    switch (activeTab) {
      case '대본입력':
        return <ScriptingTab addLog={addLog} setScripts={setScripts} setActiveTab={setActiveTab} settings={settings} updateSettings={handleSettingsUpdate} />;
      case '유튜브채널':
        return <ChannelsTab addLog={addLog} />;
      case '영상편집':
        return <EditingTab addLog={addLog} scripts={scripts} setScripts={setScripts} settings={settings} />;
      case '유튜브 업로드':
        return <UploadTab addLog={addLog} />;
      case '내정보':
        return <SettingsTab addLog={addLog} settings={settings} updateSettings={handleSettingsUpdate} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-gray-300 font-sans">
      <div className="container mx-auto p-4">
        <Header 
          tabs={TABS} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          showLogs={showLogs}
          setShowLogs={setShowLogs} 
        />
        <main className="mt-4">
          {renderTabContent()}
        </main>
      </div>
      <LogViewer logs={logs} show={showLogs} />
    </div>
  );
};

export default App;