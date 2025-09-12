import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/Card';
import type { Settings } from '../types';

interface SettingsTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ addLog, settings, updateSettings }) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (localSettings.subtitleFont && localSettings.subtitleFontName) {
        const styleId = 'custom-font-style-sheet';
        let styleElement = document.getElementById(styleId) as HTMLStyleElement;
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }
        const fontFace = `
            @font-face {
                font-family: '${localSettings.subtitleFontName}';
                src: url('${localSettings.subtitleFont}');
            }
        `;
        // Avoid appending duplicate rules
        if (styleElement.sheet && !Array.from(styleElement.sheet.cssRules).some(rule => rule.cssText.includes(localSettings.subtitleFontName))) {
           styleElement.sheet.insertRule(fontFace, styleElement.sheet.cssRules.length);
        } else if (!styleElement.sheet) {
           styleElement.innerHTML = fontFace;
        }
    }
  }, [localSettings.subtitleFont, localSettings.subtitleFontName]);


  const handleLocalChange = (updates: Partial<Settings>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
  };
  
  const handleSave = (fields: (keyof Settings)[], message: string) => {
    const settingsToUpdate: Partial<Settings> = {};
    fields.forEach(field => {
        settingsToUpdate[field] = localSettings[field] as any;
    });
    updateSettings(settingsToUpdate);
    addLog(message, 'SUCCESS');
  };

  const openApiPage = (apiName: string, url: string) => {
    addLog(`${apiName} API 발급 페이지로 이동합니다.`, 'INFO');
    window.open(url, '_blank');
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'audio' | 'font') => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (fileType === 'image') {
              handleLocalChange({ backgroundImage: dataUrl });
              addLog('배경 이미지가 로드되었습니다. 저장 버튼을 눌러주세요.', 'INFO');
          } else if (fileType === 'audio') {
              handleLocalChange({ backgroundMusic: dataUrl });
              addLog('배경 음악이 로드되었습니다. 저장 버튼을 눌러주세요.', 'INFO');
          } else if (fileType === 'font') {
              handleLocalChange({ subtitleFont: dataUrl, subtitleFontName: 'CustomUserFont' });
              addLog('자막 폰트가 로드되었습니다. 저장 버튼을 눌러주세요.', 'INFO');
          }
      };
      
      if (fileType === 'font' && !file.name.toLowerCase().endsWith('.ttf')) {
          addLog('TTF 형식의 폰트 파일만 업로드할 수 있습니다.', 'ERROR');
          return;
      }
      
      reader.readAsDataURL(file);
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="쇼츠 대본 프롬프트 (short_script_prompt.json)">
          <textarea 
            rows={6}
            className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md"
            value={localSettings.scriptPrompt}
            onChange={(e) => handleLocalChange({ scriptPrompt: e.target.value })}
          />
          <button onClick={() => handleSave(['scriptPrompt'], '쇼츠 대본 프롬프트가 저장되었습니다.')} className="w-full mt-2 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">대본 프롬프트 저장</button>
        </Card>
         <Card title="쇼츠 이미지 프롬프트 (short_image.prompt.json)">
          <textarea 
            rows={6}
            className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md"
            value={localSettings.imagePrompt}
            onChange={(e) => handleLocalChange({ imagePrompt: e.target.value })}
          />
          <button onClick={() => handleSave(['imagePrompt'], '쇼츠 이미지 프롬프트가 저장되었습니다.')} className="w-full mt-2 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">이미지 프롬프트 저장</button>
        </Card>
      </div>
      
      <Card title="기본 설정">
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">대본생성 프롬프트 (ssul.prompt.json)</label>
                    <textarea 
                        rows={2} 
                        className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md" 
                        placeholder="자주, 관상, 천문 예측가처럼 작성해줘."
                        value={localSettings.shellPrompt}
                        onChange={(e) => handleLocalChange({ shellPrompt: e.target.value })}
                    />
                    <button onClick={() => handleSave(['shellPrompt'], '쉘 프롬프트가 저장되었습니다.')} className="w-full mt-2 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">쉘 프롬프트 저장</button>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">유튜브 태그 (youtube_tag.json)</label>
                    <textarea 
                        rows={2} 
                        className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md" 
                        placeholder="#코멘 #뉴스 #가상화폐 #블록체인 #shorts #BlocksSquare"
                        value={localSettings.youtubeTags}
                        onChange={(e) => handleLocalChange({ youtubeTags: e.target.value })}
                    />
                    <button onClick={() => handleSave(['youtubeTags'], '유튜브 태그가 저장되었습니다.')} className="w-full mt-2 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">유튜브 태그 저장</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">MiniMax T2A v2 JWT Token</label>
                    <div className="flex space-x-2">
                        <input 
                            type="password" 
                            placeholder="MiniMax JWT Token" 
                            className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md"
                            value={localSettings.minimaxJwt}
                            onChange={(e) => handleLocalChange({ minimaxJwt: e.target.value })}
                        />
                        <button onClick={() => openApiPage('MiniMax', 'https://www.minimax.io/platform/user-center/basic-information/interface-key')} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">API 발급</button>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">음성 모델 (Voice Model)</label>
                     <div className="flex space-x-2">
                        <select 
                            className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md"
                            value={localSettings.voiceModel}
                            onChange={(e) => handleLocalChange({ voiceModel: e.target.value })}
                        >
                            <option>Korean_ElegantPrincess</option>
                            <option>Korean_SassyGirl</option>
                            <option>Korean_SweetGirl</option>
                        </select>
                        <button onClick={() => handleSave(['minimaxJwt', 'voiceModel'], `음성 API 설정 저장됨: 모델=${localSettings.voiceModel}`)} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">음성 API 설정 저장</button>
                    </div>
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium mb-1">Google API Keys</label>
                <div className="flex space-x-2">
                  <input 
                    type="password" 
                    value={localSettings.googleApiKey}
                    onChange={(e) => handleLocalChange({ googleApiKey: e.target.value })}
                    className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md" 
                  />
                  <button onClick={() => openApiPage('Google', 'https://console.cloud.google.com/')} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">API 발급</button>
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium mb-1">Shotstack API Key</label>
                 <div className="flex space-x-2">
                  <input 
                    type="password" 
                    value={localSettings.shotstackApiKey}
                    onChange={(e) => handleLocalChange({ shotstackApiKey: e.target.value })}
                    className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md" 
                  />
                  <button onClick={() => openApiPage('Shotstack', 'https://shotstack.io/')} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">API 발급</button>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">Shotstack URL</label>
                 <div className="flex space-x-2">
                  <input 
                    type="text" 
                    value={localSettings.shotstackUrl}
                    onChange={(e) => handleLocalChange({ shotstackUrl: e.target.value })}
                    className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md" 
                  />
                </div>
            </div>
            <button onClick={() => handleSave(['googleApiKey', 'shotstackApiKey', 'shotstackUrl'], 'Google/Shotstack/URL 설정이 저장되었습니다.')} className="w-full mt-4 py-3 font-bold bg-green-600 hover:bg-green-700 rounded-md">Google/Shotstack/IP 설정 저장</button>
        </div>
      </Card>

      <Card title="영상 제작 설정">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Background Image */}
            <div>
                <h3 className="font-semibold text-lg mb-2">배경 이미지 (권장: 1080*1920)</h3>
                <p className="text-xs text-gray-400 mb-2">PNG 형식 (숏츠 2:1 비율 권장), 파일 선택 시 자동 교체됩니다.</p>
                <input type="file" id="bg-image-upload" className="hidden" accept="image/png" onChange={(e) => handleFileChange(e, 'image')} />
                <label htmlFor="bg-image-upload" className="cursor-pointer px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md">파일 선택</label>
                <span className="ml-3 text-sm text-gray-400">{localSettings.backgroundImage ? '선택된 파일 있음' : '선택된 파일 없음'}</span>
                <div className="mt-4 w-full h-64 bg-black rounded-md flex items-center justify-center overflow-hidden">
                    {localSettings.backgroundImage ? <img src={localSettings.backgroundImage} alt="배경 이미지 미리보기" className="max-w-full max-h-full object-contain" /> : <p className="text-gray-500">현재 헤더 이미지</p>}
                </div>
            </div>
            
            {/* Background Music & Font */}
            <div className="space-y-8">
                <div>
                    <h3 className="font-semibold text-lg mb-2">배경 음악</h3>
                    <p className="text-xs text-gray-400 mb-2">MP3 형식, 파일 선택 시 자동 교체됩니다.</p>
                    <input type="file" id="bg-music-upload" className="hidden" accept="audio/mpeg" onChange={(e) => handleFileChange(e, 'audio')} />
                    <label htmlFor="bg-music-upload" className="cursor-pointer px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md">파일 선택</label>
                    <span className="ml-3 text-sm text-gray-400">{localSettings.backgroundMusic ? '선택된 파일 있음' : '선택된 파일 없음'}</span>
                    <div className="mt-4">
                        {localSettings.backgroundMusic ? <audio controls src={localSettings.backgroundMusic} className="w-full">Your browser does not support the audio element.</audio> : <p className="text-gray-500">현재 배경 음악</p>}
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold text-lg mb-2">자막 폰트</h3>
                    <p className="text-xs text-gray-400 mb-2">TTF 형식, 파일 선택 시 자동 교체됩니다.</p>
                    <input type="file" id="font-upload" className="hidden" accept=".ttf" onChange={(e) => handleFileChange(e, 'font')} />
                    <label htmlFor="font-upload" className="cursor-pointer px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md">파일 선택</label>
                    <span className="ml-3 text-sm text-gray-400">{localSettings.subtitleFont ? '선택된 파일 있음' : '선택된 파일 없음'}</span>
                    <div className="mt-4 p-4 h-32 bg-black rounded-md flex items-center justify-center">
                        <p className="text-2xl text-white" style={{ fontFamily: localSettings.subtitleFontName || 'sans-serif' }}>
                            체리 폰트 예시 (Title)
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <button onClick={() => handleSave(['backgroundImage', 'backgroundMusic', 'subtitleFont', 'subtitleFontName'], '영상 제작 설정이 저장되었습니다.')} className="w-full mt-6 py-3 font-bold bg-green-600 hover:bg-green-700 rounded-md">영상 제작 설정 저장</button>
      </Card>
    </div>
  );
};