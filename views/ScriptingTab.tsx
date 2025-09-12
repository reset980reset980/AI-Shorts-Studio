import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import type { Script, Tab, Settings } from '../types';

interface ScriptingTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  setActiveTab: (tab: Tab) => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

export const ScriptingTab: React.FC<ScriptingTabProps> = ({ addLog, setScripts, setActiveTab, settings, updateSettings }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('AI 보정 결과가 여기에 표시됩니다.');
  const [isLoading, setIsLoading] = useState(false);

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  
  const [modalPrompt, setModalPrompt] = useState('');
  const [modalApiKey, setModalApiKey] = useState('');

  const handleCorrection = async () => {
    if (!inputText.trim()) {
      addLog('원문 텍스트를 입력해주세요.', 'ERROR');
      return;
    }
    setIsLoading(true);
    addLog(`AI 보정 시작 (프롬프트: ${settings.shellPrompt})...`);
    try {
      const { correctTextWithPrompt } = await import('../services/api');
      const correctedText = await correctTextWithPrompt(inputText, settings.shellPrompt, settings.googleApiKey);
      setOutputText(correctedText);
      addLog('AI 보정 완료.', 'SUCCESS');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`AI 보정 중 오류가 발생했습니다: ${errorMessage}`, 'ERROR');
      setOutputText('오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenPromptModal = () => {
    setModalPrompt(settings.shellPrompt);
    setIsPromptModalOpen(true);
  };
  
  const handleSavePrompt = () => {
    updateSettings({ shellPrompt: modalPrompt });
    addLog('AI 보정 프롬프트가 업데이트되었습니다.', 'SUCCESS');
    setIsPromptModalOpen(false);
  };

  const handleOpenApiModal = () => {
    setModalApiKey(settings.googleApiKey);
    setIsApiModalOpen(true);
  };

  const handleSaveApiKey = () => {
    updateSettings({ googleApiKey: modalApiKey });
    addLog('Google API 키가 업데이트되었습니다.', 'SUCCESS');
    setIsApiModalOpen(false);
  };

  const handleSendScript = async () => {
    if (!inputText.trim()) {
      addLog('원문 텍스트를 입력해주세요.', 'ERROR');
      return;
    }
    setIsLoading(true);
    addLog('YouTube Shorts 대본 생성 시작...');
    try {
      const { generateScriptFromText } = await import('../services/api');
      // Use the main script prompt for this action
      const generatedScript = await generateScriptFromText(inputText, settings.scriptPrompt, settings.googleApiKey);
      const newScript = { ...generatedScript, id: Date.now().toString() };
      setScripts(prevScripts => [...prevScripts, newScript]);
      addLog('대본 생성 완료. 영상편집 탭으로 이동합니다.', 'SUCCESS');
      setActiveTab('영상편집');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`대본 생성 중 오류가 발생했습니다: ${errorMessage}`, 'ERROR');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      <Card title="AI 보정">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2 text-gray-400">원문 입력</h3>
            <textarea
              className="w-full h-64 p-3 bg-white text-gray-800 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-500"
              placeholder="여기에 원문을 입력하세요."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            ></textarea>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-gray-400">AI 보정 결과</h3>
            <textarea
              className="w-full h-64 p-3 bg-white text-gray-800 border border-gray-300 rounded-md placeholder:text-gray-500"
              placeholder="AI 보정 결과가 여기에 표시됩니다."
              value={outputText}
              readOnly
            ></textarea>
          </div>
        </div>
        <div className="mt-6 flex justify-between items-center">
          <div className="flex space-x-2">
              <button onClick={handleCorrection} className="px-4 py-2 text-sm font-semibold bg-[#374151] hover:bg-[#4B5563] text-white rounded-md" disabled={isLoading}>AI보정</button>
              <button onClick={handleOpenPromptModal} className="px-4 py-2 text-sm font-semibold bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-md" disabled={isLoading}>AI보정 프롬프트</button>
              <button onClick={handleOpenApiModal} className="px-4 py-2 text-sm font-semibold bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-md" disabled={isLoading}>API KEY</button>
          </div>
          <button 
            onClick={handleSendScript}
            className="px-6 py-2 font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? '생성중...' : '대본전송'}
          </button>
        </div>
      </Card>

      <Modal isOpen={isPromptModalOpen} onClose={() => setIsPromptModalOpen(false)} title="프롬프트 편집" fileName="ssul.prompt.json">
        <div className="flex flex-col h-full">
            <textarea
              value={modalPrompt}
              onChange={(e) => setModalPrompt(e.target.value)}
              className="w-full flex-grow h-72 p-3 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-2">로드 완료</p>
            <div className="mt-4 flex justify-end">
                <button onClick={handleSavePrompt} className="px-6 py-2 font-bold bg-gray-800 hover:bg-black text-white rounded-md">저장</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} title="API KEY 편집" fileName="google_api_key.json">
         <div className="flex flex-col h-full">
            <textarea
              value={modalApiKey}
              onChange={(e) => setModalApiKey(e.target.value)}
              className="w-full flex-grow h-72 p-3 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-2">로드 완료</p>
            <div className="mt-4 flex justify-end">
                <button onClick={handleSaveApiKey} className="px-6 py-2 font-bold bg-gray-800 hover:bg-black text-white rounded-md">저장</button>
            </div>
        </div>
      </Modal>
    </>
  );
};