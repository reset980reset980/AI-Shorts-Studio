import React, { useState } from 'react';
import type { Script, Scene, Settings } from '../types';
import { Card } from '../components/Card';
import { SceneEditor } from './editing/SceneEditor';
import { generateImageForScene, generateAudioForScene, delay } from '../services/api';


interface EditingTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  scripts: Script[];
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  settings: Settings | null;
}

export const EditingTab: React.FC<EditingTabProps> = ({ addLog, scripts, setScripts, settings }) => {
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  const handleScriptUpdate = (updatedScript: Script) => {
    setScripts(prevScripts => prevScripts.map(s => s.id === updatedScript.id ? updatedScript : s));
  };
  
  const handleDeleteScript = (scriptId: string) => {
    setScripts(prevScripts => prevScripts.filter(s => s.id !== scriptId));
    addLog('스크립트가 삭제되었습니다.', 'SUCCESS');
  };

  const selectedScript = scripts.find(s => s.id === selectedScriptId);

  if (!selectedScript) {
    return (
      <Card title="영상 편집 목록">
        {scripts.length === 0 ? (
          <p className="text-center text-gray-400">먼저 '대본입력' 탭에서 대본을 생성해주세요.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => setScripts([])} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md">전체 삭제</button>
            </div>
            <table className="w-full text-left">
              <thead className="border-b-2 border-gray-600">
                <tr>
                  <th className="p-3">채널명</th>
                  <th className="p-3">타이틀</th>
                  <th className="p-3">상태</th>
                  <th className="p-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map(script => (
                  <tr key={script.id} className="border-b border-gray-700 hover:bg-[#2f3b52]">
                    <td className="p-3">{script.channel}</td>
                    <td className="p-3">{script.title}</td>
                    <td className="p-3 text-yellow-400">pending</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end space-x-2">
                         <button onClick={() => handleDeleteScript(script.id)} className="px-3 py-1 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md">삭제</button>
                         <button onClick={() => setSelectedScriptId(script.id)} className="px-3 py-1 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">유튜브 생성</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // Editor View
  const handleSceneUpdate = (updatedScene: Scene) => {
    const newScenes = selectedScript.scenes.map(scene => 
      scene.id === updatedScene.id ? updatedScene : scene
    );
    handleScriptUpdate({ ...selectedScript, scenes: newScenes });
  };
  
  const handleBulkGenerate = async (type: 'image' | 'audio') => {
    addLog(`일괄 ${type === 'image' ? '이미지' : '음원'} 생성을 시작합니다...`, 'INFO');

    for (const [index, scene] of selectedScript.scenes.entries()) {
        try {
            if (type === 'image') {
                if (!settings?.googleApiKey) throw new Error("Google API Key가 설정되지 않았습니다.");
                handleSceneUpdate({ ...scene, imageState: 'generating' });
                const imageUrl = await generateImageForScene(scene.imagePrompt, settings.googleApiKey);
                handleSceneUpdate({ ...scene, imageUrl, imageState: 'done' });
                addLog(`[씬 ${scene.id}] 이미지 생성 완료.`, 'SUCCESS');
            } else { // audio
                if (!settings?.minimaxJwt) throw new Error("MiniMax JWT Token이 설정되지 않았습니다.");
                handleSceneUpdate({ ...scene, audioState: 'generating' });
                const audioUrl = await generateAudioForScene(scene.script, settings.minimaxJwt, settings.voiceModel);
                handleSceneUpdate({ ...scene, audioUrl, audioState: 'done' });
                addLog(`[씬 ${scene.id}] 음원 생성 완료.`, 'SUCCESS');
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[씬 ${scene.id}] ${type === 'image' ? '이미지' : '음원'} 생성 실패: ${errorMessage}`, 'ERROR');
            if (type === 'image') {
                handleSceneUpdate({ ...scene, imageState: 'error' });
            } else {
                handleSceneUpdate({ ...scene, audioState: 'error' });
            }
        } finally {
            // Add delay for image generation to respect rate limits, but not after the last item.
            if (type === 'image' && index < selectedScript.scenes.length - 1) {
                addLog(`API 속도 제한 준수를 위해 13초 대기합니다...`, 'INFO');
                await delay(13000);
            }
        }
    }
    addLog(`일괄 ${type === 'image' ? '이미지' : '음원'} 생성이 완료되었습니다.`, 'SUCCESS');
  };


  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <button onClick={() => setSelectedScriptId(null)} className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">← 목록으로</button>
        <div className="flex space-x-2">
            <button onClick={() => handleBulkGenerate('audio')} className="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded-md">일괄 음원 생성</button>
            <button onClick={() => handleBulkGenerate('image')} className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 rounded-md">일괄 이미지 생성</button>
            <button className="px-4 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-700 rounded-md">AI 새로고침</button>
        </div>
      </div>

      <Card title={`쇼츠 제목 (shorts_title): ${selectedScript.shorts_title}`}>
        <p className="text-sm text-gray-400"><strong className="text-white">쇼츠 요약 (shorts_summary):</strong> {selectedScript.shorts_summary}</p>
      </Card>

      <Card title="쇼츠 스크립트 (shorts_script)">
        <div className="space-y-4">
          {selectedScript.scenes.map(scene => (
            <SceneEditor 
              key={scene.id} 
              scene={scene} 
              addLog={addLog}
              onUpdate={handleSceneUpdate}
              settings={settings}
            />
          ))}
        </div>
      </Card>

      <div className="flex justify-center mt-6">
        <button className="px-8 py-3 text-lg font-bold bg-green-600 hover:bg-green-700 rounded-lg">
          영상 제작
        </button>
      </div>
    </div>
  );
};