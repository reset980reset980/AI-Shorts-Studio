import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import type { Scene, Settings } from '../../types';
import { generateImageSuggestions, generateAudioForScene } from '../../services/api';
import { Modal } from '../../components/Modal';

interface SceneEditorProps {
  scene: Scene;
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  onUpdate: (scene: Scene) => void;
  settings: Settings | null;
  onImageClick?: () => void;
  playingSceneId: number | null;
  setPlayingSceneId: (id: number | null) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

export const SceneEditor: React.FC<SceneEditorProps> = ({ scene, addLog, onUpdate, settings, onImageClick, playingSceneId, setPlayingSceneId }) => {
  const [editedScript, setEditedScript] = useState(scene.script);
  const [editedPrompt, setEditedPrompt] = useState(scene.imagePrompt);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // State for the image suggestion modal
  const [isImageSelectionModalOpen, setIsImageSelectionModalOpen] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    if (playingSceneId === scene.id && scene.audioUrl) {
      if(audio.src !== scene.audioUrl) {
        audio.src = scene.audioUrl;
      }
      audio.play().catch(e => addLog(`[씬 ${scene.id}] 오디오 재생 실패: ${e}`, 'ERROR'));
    } else {
      audio.pause();
      if (playingSceneId !== scene.id) {
           audio.currentTime = 0;
      }
    }
  }, [playingSceneId, scene.id, scene.audioUrl, addLog]);


  const handleSave = () => {
    onUpdate({ ...scene, script: editedScript, imagePrompt: editedPrompt });
    addLog(`[씬 ${scene.id}] 변경 사항이 저장되었습니다.`, 'SUCCESS');
  };

  const handleShowImageSuggestions = async () => {
    if (!settings?.googleApiKey) {
        addLog('Google API 키가 설정되지 않았습니다. 내정보 탭에서 설정해주세요.', 'ERROR');
        onUpdate({ ...scene, imageState: 'error' });
        return;
    }
    addLog(`[씬 ${scene.id}] 추천 이미지 생성 시작...`);
    setIsImageSelectionModalOpen(true);
    setIsGeneratingSuggestions(true);
    setImageSuggestions([]);
    setSuggestionError(null);
    
    try {
      const suggestions = await generateImageSuggestions(editedPrompt, settings.googleApiKey);
      setImageSuggestions(suggestions);
      addLog(`[씬 ${scene.id}] 4개의 추천 이미지가 생성되었습니다. 마음에 드는 이미지를 선택하세요.`, 'SUCCESS');
    } catch (error: any) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`[씬 ${scene.id}] 추천 이미지 생성 실패: ${errorMessage}`, 'ERROR');
      
      // User-friendly error for quota issues
      if (errorMessage.includes('429') || errorMessage.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'API 사용 한도를 초과했습니다. Google Cloud Platform의 API 할당량 및 결제 정보를 확인해주세요. 잠시 후 다시 시도하거나 플랜을 업그레이드해야 할 수 있습니다.';
      }

      setSuggestionError(errorMessage);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleSelectSuggestedImage = (imageUrl: string) => {
    onUpdate({ ...scene, imageUrl, imageState: 'done' });
    setIsImageSelectionModalOpen(false);
    addLog(`[씬 ${scene.id}] 새 이미지를 선택했습니다.`, 'SUCCESS');
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
    if (!scene.audioUrl) {
      addLog(`[씬 ${scene.id}] 재생할 음원이 없습니다.`, 'ERROR');
      return;
    }
    // Toggle play/pause
    if (playingSceneId === scene.id) {
      setPlayingSceneId(null);
    } else {
      setPlayingSceneId(scene.id);
    }
  };

  const isImageLoading = scene.imageState === 'generating';
  const isAudioLoading = scene.audioState === 'generating';

  return (
    <>
      <div className="bg-[#1a1f2e] p-4 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold"># {scene.id} ({scene.time})</h4>
          <button onClick={handleSave} className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700 rounded-md">저장</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col space-y-2">
            <div className="w-full h-40 bg-gray-900 rounded-md flex items-center justify-center overflow-hidden">
                  {isImageLoading && <LoadingSpinner />}
                  {scene.imageState === 'done' && scene.imageUrl ? (
                      <button onClick={onImageClick} className="w-full h-full block" aria-label={`View larger image for scene ${scene.id}`}>
                        <img src={scene.imageUrl} alt={`Scene ${scene.id}`} className="w-full h-full object-cover" />
                      </button>
                  ) : scene.imageState === 'pending' ? (
                     <span className="text-gray-500">이미지 없음</span>
                  ) : scene.imageState === 'error' ? (
                     <span className="text-red-500">생성 실패</span>
                  ) : null}
            </div>
            <div className="flex space-x-2">
                <button 
                  onClick={handleShowImageSuggestions} 
                  disabled={isImageLoading || isGeneratingSuggestions}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-500 flex items-center justify-center"
                >
                  {isGeneratingSuggestions ? <><LoadingSpinner /><span className="ml-2">생성중</span></> : (isImageLoading ? '일괄 생성중...' : '이미지 생성')}
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
                <button onClick={handleListenAudio} disabled={!scene.audioUrl || isAudioLoading} className="flex-1 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md disabled:bg-gray-500">
                  {playingSceneId === scene.id ? '재생 중지' : '음원 듣기'}
                </button>
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
      <Modal 
          isOpen={isImageSelectionModalOpen} 
          onClose={() => setIsImageSelectionModalOpen(false)} 
          title={`추천 이미지 선택 (씬 ${scene.id})`}
      >
          {isGeneratingSuggestions && (
              <div className="flex flex-col justify-center items-center h-64 text-white">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"></div>
                  <p>4개의 추천 이미지를 생성중입니다...</p>
                  <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요.</p>
              </div>
          )}
          {!isGeneratingSuggestions && suggestionError && (
              <div className="flex flex-col justify-center items-center h-64 text-white">
                <svg className="w-12 h-12 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p className="text-lg font-semibold">이미지 생성 실패</p>
                <p className="text-sm text-gray-400 mt-2 text-center max-w-md">{suggestionError}</p>
                <button onClick={() => setIsImageSelectionModalOpen(false)} className="mt-6 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md">닫기</button>
              </div>
          )}
          {!isGeneratingSuggestions && !suggestionError && imageSuggestions.length > 0 && (
              <div>
                  <p className="text-center text-gray-300 mb-4">마음에 드는 이미지를 클릭하여 선택하세요.</p>
                  <div className="grid grid-cols-2 gap-4">
                      {imageSuggestions.map((imgSrc, index) => (
                          <div key={index} className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                              <img
                                  src={imgSrc}
                                  alt={`Suggestion ${index + 1}`}
                                  className="w-full h-full object-cover cursor-pointer rounded-lg hover:ring-4 hover:ring-blue-500 transition-all duration-200"
                                  onClick={() => handleSelectSuggestedImage(imgSrc)}
                              />
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </Modal>
    </>
  );
};