import React, { useState, useRef, ChangeEvent } from 'react';
import type { Scene, Settings } from '../../types';
import { generateImageForScene, generateAudioForScene } from '../../services/api';

interface SceneEditorProps {
  scene: Scene;
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  onUpdate: (scene: Scene) => void;
  settings: Settings | null;
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, addLog, onUpdate, settings }) => {
  const [editedScript, setEditedScript] = useState(scene.script);
  const [editedPrompt, setEditedPrompt] = useState(scene.imagePrompt);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const handleSave = () => {
    onUpdate({ ...scene, script: editedScript, imagePrompt: editedPrompt });
    addLog(`[씬 ${scene.id}] 변경 사항이 저장되었습니다.`, 'SUCCESS');
  };

  const handleGenerateImage = async () => {
    if (!settings?.googleApiKey) {
        addLog('Google API 키가 설정되지 않았습니다. 내정보 탭에서 설정해주세요.', 'ERROR');
        onUpdate({ ...scene, imageState: 'error' });
        return;
    }
    addLog(`[씬 ${scene.id}] 이미지 생성 시작...`);
    onUpdate({ ...scene, imageState: 'generating' });
    try {
      const imageUrl = await generateImageForScene(editedPrompt, settings.googleApiKey);
      addLog(`[씬 ${scene.id}] 이미지 생성 완료.`, 'SUCCESS');
      onUpdate({ ...scene, script: editedScript, imagePrompt: editedPrompt, imageUrl, imageState: 'done' });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`[씬 ${scene.id}] 이미지 생성 실패: ${errorMessage}`, 'ERROR');
      onUpdate({ ...scene, imageState: 'error' });
    }
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            onUpdate({ ...scene, imageUrl, imageState: 'done' });
            addLog(`[씬 ${scene.id}] 이미지가 업로드되었습니다.`, 'SUCCESS');
        };
        reader.readAsDataURL(file);
    }
  };

  const handleGenerateAudio = async () => {
    if (!settings?.minimaxJwt) {
        addLog('MiniMax JWT Token이 설정되지 않았습니다. 내정보 탭에서 설정해주세요.', 'ERROR');
        onUpdate({ ...scene, audioState: 'error' });
        return;
    }
    addLog(`[씬 ${scene.id}] 음성 생성 시작 (MiniMax)...`);
    onUpdate({ ...scene, audioState: 'generating' });
    try {
      const audioUrl = await generateAudioForScene(editedScript, settings.minimaxJwt, settings.voiceModel);
      addLog(`[씬 ${scene.id}] 음성 생성 완료.`, 'SUCCESS');
      onUpdate({ ...scene, script: editedScript, imagePrompt: editedPrompt, audioUrl, audioState: 'done' });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`[씬 ${scene.id}] 음성 생성 실패: ${errorMessage}`, 'ERROR');
      onUpdate({ ...scene, audioState: 'error' });
    }
  };
  
  const handleListenAudio = () => {
      if (audioPlayerRef.current && scene.audioUrl) {
          audioPlayerRef.current.src = scene.audioUrl;
          audioPlayerRef.current.play();
          addLog(`[씬 ${scene.id}] 음원 재생 중...`, 'INFO');
      } else {
          addLog(`[씬 ${scene.id}] 재생할 음원이 없습니다.`, 'ERROR');
      }
  };

  const isImageLoading = scene.imageState === 'generating';
  const isAudioLoading = scene.audioState === 'generating';

  return (
    <div className="bg-[#1a1f2e] p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold"># {scene.id} ({scene.time})</h4>
        <button onClick={handleSave} className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700 rounded-md">저장</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col space-y-2">
           <div className="w-full h-40 bg-gray-900 rounded-md flex items-center justify-center overflow-hidden">
                {isImageLoading && <LoadingSpinner />}
                {scene.imageState === 'done' && scene.imageUrl && (
                    <img src={scene.imageUrl} alt={`Scene ${scene.id}`} className="w-full h-full object-cover" />
                )}
                {scene.imageState === 'pending' && <span className="text-gray-500">이미지 없음</span>}
                {scene.imageState === 'error' && <span className="text-red-500">생성 실패</span>}
           </div>
           <div className="flex space-x-2">
              <button 
                onClick={handleGenerateImage} 
                disabled={isImageLoading}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-500 flex items-center justify-center"
              >
                {isImageLoading ? <LoadingSpinner /> : '이미지 생성'}
              </button>
              <button onClick={handleImageUploadClick} className="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-md">이미지 업로드</button>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
           </div>
           <div className="flex space-x-2">
              <button 
                onClick={handleGenerateAudio}
                disabled={isAudioLoading}
                className="flex-1 px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 rounded-md disabled:bg-gray-500 flex items-center justify-center"
              >
                {isAudioLoading ? <LoadingSpinner /> : '음원 생성'}
              </button>
              <button onClick={handleListenAudio} disabled={!scene.audioUrl || isAudioLoading} className="flex-1 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md disabled:bg-gray-500">음원 듣기</button>
              <audio ref={audioPlayerRef} style={{ display: 'none' }} />
           </div>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-sm font-semibold">Script</label>
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              rows={4}
              className="w-full p-2 mt-1 text-sm bg-[#2f3b52] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
           <div>
            <label className="text-sm font-semibold">Image Prompt</label>
            <textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={6}
              className="w-full p-2 mt-1 text-sm bg-[#2f3b52] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};