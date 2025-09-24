
import React, { useState, useCallback, useEffect } from 'react';
import { ScriptingTab } from './views/ScriptingTab';
import { ChannelsTab } from './views/ChannelsTab';
import { EditingTab } from './views/EditingTab';
import { EditTab } from './views/EditTab';
import { UploadTab } from './views/UploadTab';
import { SettingsTab } from './views/SettingsTab';
import { LogViewer } from './components/LogViewer';
import type { Tab, LogEntry, Script, Settings } from './types';
import { TABS } from './constants';
import { Header } from './components/Header';
import { getSettings, saveSettings } from './services/api';
import { loadScripts } from './services/fileStorage';

const SCRIPTS_STORAGE_KEY = 'ai_shorts_studio_scripts';

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

  // --- 데이터 지속성 (Data Persistence) ---
  // [현재 구현]
  // 이 애플리케이션은 현재 웹 브라우저의 'localStorage'를 사용하여 작업 중인 스크립트 데이터를 저장합니다.
  // 이 방식은 웹 환경에서 사용자가 페이지를 새로고침해도 작업 내용이 사라지지 않도록 해주는 가장 간단하고 표준적인 방법입니다.
  // 아래의 useEffect 훅들이 이 기능을 담당합니다.
  //
  // [향후 데스크톱 앱으로 전환 시]
  // 만약 이 프로젝트를 Electron이나 Tauri 같은 프레임워크를 사용하여 PC용 데스크톱 애플리케이션으로 패키징하게 될 경우,
  // 브라우저 저장소인 localStorage 대신 Node.js의 파일 시스템(fs) 모듈을 사용하여 데이터를 실제 파일(.json)로 PC에 저장하는 것이 더 안정적이고 영구적인 방법입니다.
  //
  // 다른 AI나 개발자에게 이 전환을 요청할 때, 아래와 같이 명확하게 지시해주세요:
  //
  // --- 요청 예시 ---
  // "현재 localStorage를 사용하고 있는 데이터 저장 방식을, Node.js의 'fs' 모듈을 사용하여 로컬 파일 시스템에 '.json' 파일로 직접 읽고 쓰는 방식으로 변경해주세요."
  //
  // --- 전환 후 예상 코드 (예시) ---
  /*
  import fs from 'fs'; // Node.js 파일 시스템 모듈 (Electron 환경에서 사용 가능)
  const SCRIPTS_FILE_PATH = './ai-shorts-scripts.json'; // 저장할 파일 경로

  // 데이터를 파일에서 불러오는 함수
  const loadScriptsFromFile = () => {
    try {
      if (fs.existsSync(SCRIPTS_FILE_PATH)) {
        const fileContent = fs.readFileSync(SCRIPTS_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error("스크립트 파일 불러오기 실패:", error);
    }
    return []; // 파일이 없거나 오류 발생 시 빈 배열 반환
  };

  // 데이터를 파일에 저장하는 함수
  const saveScriptsToFile = (scriptsToSave) => {
    try {
      fs.writeFileSync(SCRIPTS_FILE_PATH, JSON.stringify(scriptsToSave, null, 2));
    } catch (error) {
      console.error("스크립트 파일 저장 실패:", error);
    }
  };

  // React 컴포넌트 내에서...
  useEffect(() => {
    const loadedScripts = loadScriptsFromFile();
    setScripts(loadedScripts);
  }, []);

  useEffect(() => {
    if (scripts.length > 0) { // 초기 로딩 시 빈 배열 저장을 방지하는 조건 추가 가능
        saveScriptsToFile(scripts);
    }
  }, [scripts]);
  */

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

    // 앱 시작 시 파일 시스템과 localStorage에서 스크립트 불러오기
    try {
      // 먼저 파일 시스템에서 로드 시도
      const fileScripts = loadScripts();
      console.log('File system scripts:', fileScripts);

      if (fileScripts && fileScripts.length > 0) {
        setScripts(fileScripts);
        addLog(`파일 시스템에서 ${fileScripts.length}개의 스크립트를 불러왔습니다.`, 'SUCCESS');

        // 파일 시스템 데이터로 localStorage 업데이트 (브라우저와 동기화)
        localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(fileScripts));
      } else {
        // 파일 시스템에 접근할 수 없거나 비어있으면 localStorage에서 로드
        addLog('파일 시스템에 접근할 수 없습니다. localStorage를 확인합니다.', 'INFO');
        const savedScriptsRaw = localStorage.getItem(SCRIPTS_STORAGE_KEY);
        if (savedScriptsRaw) {
            const savedScripts = JSON.parse(savedScriptsRaw);
            if (Array.isArray(savedScripts) && savedScripts.length > 0) {
              setScripts(savedScripts);
              addLog(`localStorage에서 ${savedScripts.length}개의 스크립트를 불러왔습니다.`, 'SUCCESS');
            }
        }
      }
    } catch (error) {
        addLog('저장된 스크립트를 불러오는 데 실패했습니다.', 'ERROR');
        console.error('Script loading error:', error);
    }

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
        return <ChannelsTab addLog={addLog} settings={settings} updateSettings={handleSettingsUpdate} />;
      case '영상편집':
        return <EditingTab addLog={addLog} scripts={scripts} setScripts={setScripts} settings={settings} updateSettings={handleSettingsUpdate} />;
      case '프로젝트관리':
        return <EditTab addLog={addLog} settings={settings} updateSettings={handleSettingsUpdate} />;
      case '유튜브 업로드':
        // FIX: Pass settings and updateSettings props to UploadTab to fix missing properties error.
        return <UploadTab addLog={addLog} settings={settings} updateSettings={handleSettingsUpdate} />;
      case '내정보':
        return <SettingsTab addLog={addLog} settings={settings} updateSettings={handleSettingsUpdate} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-gray-300 font-sans">
      <div className={`container mx-auto p-4 transition-all duration-300 ${showLogs ? 'pb-[35vh]' : ''}`}>
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
