import React, { useState, useEffect } from 'react';
import type { Script, Scene, Settings } from '../types';
import { Card } from '../components/Card';
import { SceneEditor } from './editing/SceneEditor';
import { generateImageForScene, generateAudioForScene, delay, renderVideo, regenerateImagePrompts } from '../services/api';

const SCRIPTS_STORAGE_KEY = 'ai_shorts_studio_scripts';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ isOpen, onClose, imageUrl, onNext, onPrev, hasNext, hasPrev }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full h-full p-4" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt="Lightbox" className="w-full h-full object-contain" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity text-2xl"
          aria-label="Close"
        >
          &times;
        </button>
        
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center hover:bg-opacity-75 transition-opacity text-3xl"
            aria-label="Previous image"
          >
            &#8249;
          </button>
        )}

        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full w-12 h-12 flex items-center justify-center hover:bg-opacity-75 transition-opacity text-3xl"
            aria-label="Next image"
          >
            &#8250;
          </button>
        )}
      </div>
    </div>
  );
};


interface EditingTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  scripts: Script[];
  setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
  settings: Settings | null;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const StatusBadge: React.FC<{ status: Script['status'] }> = ({ status }) => {
    const statusMap = {
      pending: { text: '대기중', color: 'text-yellow-400' },
      rendering: { text: '합성중...', color: 'text-blue-400' },
      ready: { text: '완료', color: 'text-green-400' },
      error: { text: '실패', color: 'text-red-400' },
    };
    const { text, color } = statusMap[status] || statusMap.pending;
    return <span className={color}>{text}</span>;
};

export const EditingTab: React.FC<EditingTabProps> = ({ addLog, scripts, setScripts, settings, updateSettings }) => {
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [isRecorrecting, setIsRecorrecting] = useState<boolean>(false);
  const [lightboxState, setLightboxState] = useState<{isOpen: boolean; currentIndex: number}>({ isOpen: false, currentIndex: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [playingSceneId, setPlayingSceneId] = useState<number | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ''; // Required for browsers like Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const selectedScript = scripts.find(s => s.id === selectedScriptId);
  
  useEffect(() => {
    if (lightboxState.isOpen && selectedScript) {
        const scene = selectedScript.scenes[lightboxState.currentIndex];
        if (scene?.audioUrl) {
            setPlayingSceneId(scene.id);
        } else {
            setPlayingSceneId(null); // Stop if no audio for the current scene
        }
    }
  }, [lightboxState.isOpen, lightboxState.currentIndex, selectedScript]);

  const handleSaveChanges = () => {
    try {
      localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
      setHasUnsavedChanges(false);
      addLog('모든 변경사항이 성공적으로 저장되었습니다.', 'SUCCESS');
    } catch (error) {
      addLog('변경사항을 로컬 저장소에 저장하는 데 실패했습니다.', 'ERROR');
    }
  };

  const handleScriptUpdate = (updatedScript: Script) => {
    setScripts(prevScripts => prevScripts.map(s => s.id === updatedScript.id ? updatedScript : s));
    setHasUnsavedChanges(true);
  };

  const handleSceneUpdate = (updatedScene: Scene) => {
    if (!selectedScriptId) return;
    const scriptToUpdate = scripts.find(s => s.id === selectedScriptId);
    if (!scriptToUpdate) return;
    
    const updatedScript = {
      ...scriptToUpdate,
      scenes: scriptToUpdate.scenes.map(s => s.id === updatedScene.id ? updatedScene : s)
    };
    handleScriptUpdate(updatedScript);
  };

  const handleDeleteScript = (scriptId: string) => {
    setScripts(prevScripts => prevScripts.filter(s => s.id !== scriptId));
    addLog('스크립트가 삭제되었습니다.', 'SUCCESS');
    setHasUnsavedChanges(true);
    if (selectedScriptId === scriptId) {
        setSelectedScriptId(null);
    }
  };

  const handleStartRender = async (scriptId: string) => {
    const scriptToRender = scripts.find(s => s.id === scriptId);
    if (!scriptToRender) {
      addLog(`렌더링할 스크립트를 찾을 수 없습니다: ${scriptId}`, 'ERROR');
      return;
    }

    const isReady = scriptToRender.scenes.every(s => s.imageState === 'done' && s.audioState === 'done');
    if (!isReady) {
      addLog(`[${scriptToRender.title}] 모든 씬의 이미지와 음원이 생성되어야 영상 합성이 가능합니다.`, 'ERROR');
      addLog('먼저 편집 화면으로 들어가서 모든 리소스를 생성해주세요.', 'INFO');
      return;
    }

    addLog(`[${scriptToRender.title}] 영상 합성을 시작합니다...`, 'INFO');
    setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, status: 'rendering' } : s));
    
    try {
      const result = await renderVideo(scriptToRender);
      if (result.success) {
        addLog(`[${scriptToRender.title}] 영상 합성이 완료되었습니다. URL: ${result.videoUrl}`, 'SUCCESS');
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, status: 'ready' } : s));
      } else {
        addLog(`[${scriptToRender.title}] 영상 합성에 실패했습니다.`, 'ERROR');
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, status: 'error' } : s));
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`영상 합성 중 오류 발생: ${errorMessage}`, 'ERROR');
      setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, status: 'error' } : s));
    }
  };
  
  const handleBulkGenerateImages = async () => {
    if (!selectedScriptId || !settings?.googleApiKey) {
      addLog('스크립트가 선택되지 않았거나 Google API 키가 설정되지 않았습니다.', 'ERROR');
      return;
    }

    const script = scripts.find(s => s.id === selectedScriptId);
    if (!script) return;

    addLog(`[${script.shorts_title}] 일괄 이미지 생성 시작 (${settings.imageGenerationMode} 모드)...`, 'INFO');

    const scenesToProcess = script.scenes.filter(s => s.imageState === 'pending');
    if (scenesToProcess.length === 0) {
        addLog('모든 씬의 이미지가 이미 생성되었습니다.', 'INFO');
        return;
    }
    
    const scriptWithGeneratingState = {
        ...script,
        scenes: script.scenes.map((s): Scene => scenesToProcess.find(p => p.id === s.id) ? { ...s, imageState: 'generating' } : s)
    };
    handleScriptUpdate(scriptWithGeneratingState);

    const processScene = async (scene: Scene) => {
        try {
            const imageUrl = await generateImageForScene(scene.imagePrompt, settings.googleApiKey);
            addLog(`[씬 ${scene.id}] 이미지 생성 성공.`, 'SUCCESS');
            return { sceneId: scene.id, imageUrl, success: true };
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[씬 ${scene.id}] 이미지 생성 실패: ${errorMessage}`, 'ERROR');
            return { sceneId: scene.id, success: false };
        }
    };
    
    if (settings.imageGenerationMode === 'parallel') {
        const results = await Promise.all(scenesToProcess.map(processScene));
        
        const finalScript = scripts.find(s => s.id === selectedScriptId);
        if (!finalScript) return;
        
        const updatedFinalScript = {
            ...finalScript,
            scenes: finalScript.scenes.map((scene): Scene => {
                const result = results.find(r => r.sceneId === scene.id);
                if (result) {
                    return {
                        ...scene,
                        imageUrl: result.success ? result.imageUrl : undefined,
                        imageState: result.success ? 'done' : 'error',
                    };
                }
                return scene;
            })
        };
        handleScriptUpdate(updatedFinalScript);

    } else { // sequential
        for (const scene of scenesToProcess) {
            const result = await processScene(scene);
            const currentScript = scripts.find(s => s.id === selectedScriptId);
            if (!currentScript) return;
            const updatedScript = {
                ...currentScript,
                scenes: currentScript.scenes.map((s): Scene => {
                    if (s.id === result.sceneId) {
                        return {
                            ...s,
                            imageUrl: result.success ? result.imageUrl : undefined,
                            imageState: result.success ? 'done' : 'error',
                        };
                    }
                    return s;
                })
            };
            handleScriptUpdate(updatedScript);
            
            if (scenesToProcess.indexOf(scene) < scenesToProcess.length - 1) {
              await delay(5000); // 5-second delay
            }
        }
    }
    addLog(`[${script.shorts_title}] 일괄 이미지 생성이 완료되었습니다.`, 'SUCCESS');
  };

  const handleBulkGenerateAudio = async () => {
    if (!selectedScriptId || !settings?.minimaxJwt) {
        addLog('스크립트가 선택되지 않았거나 MiniMax JWT 토큰이 설정되지 않았습니다.', 'ERROR');
        return;
    }
    const script = scripts.find(s => s.id === selectedScriptId);
    if (!script) return;

    addLog(`[${script.shorts_title}] 일괄 음원 생성 시작...`, 'INFO');

    const scenesToProcess = script.scenes.filter(s => s.audioState === 'pending');
    if (scenesToProcess.length === 0) {
        addLog('모든 씬의 음원이 이미 생성되었습니다.', 'INFO');
        return;
    }

    const scriptWithGeneratingState = {
        ...script,
        scenes: script.scenes.map((s): Scene => scenesToProcess.find(p => p.id === s.id) ? { ...s, audioState: 'generating' } : s)
    };
    handleScriptUpdate(scriptWithGeneratingState);

    for (const scene of scenesToProcess) {
        try {
            const audioUrl = await generateAudioForScene(scene.script, settings.minimaxJwt, settings.voiceModel);
            addLog(`[씬 ${scene.id}] 음원 생성 성공.`, 'SUCCESS');
            
            const currentScript = scripts.find(s => s.id === selectedScriptId);
            if (!currentScript) return;
             const updatedScript = {
                ...currentScript,
                scenes: currentScript.scenes.map((s): Scene => s.id === scene.id ? { ...s, audioUrl, audioState: 'done' } : s)
            };
            handleScriptUpdate(updatedScript);
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[씬 ${scene.id}] 음원 생성 실패: ${errorMessage}`, 'ERROR');

            const currentScript = scripts.find(s => s.id === selectedScriptId);
            if (!currentScript) return;
             const updatedScript = {
                ...currentScript,
                scenes: currentScript.scenes.map((s): Scene => s.id === scene.id ? { ...s, audioState: 'error' } : s)
            };
            handleScriptUpdate(updatedScript);
        }
    }
    addLog(`[${script.shorts_title}] 일괄 음원 생성이 완료되었습니다.`, 'SUCCESS');
  };

  const handleAiRecorrection = async () => {
    if (!selectedScriptId || !settings) {
      addLog('스크립트가 선택되지 않았거나 설정이 로드되지 않았습니다.', 'ERROR');
      return;
    }
    const script = scripts.find(s => s.id === selectedScriptId);
    if (!script) return;

    setIsRecorrecting(true);
    addLog(`[${script.shorts_title}] AI 이미지 프롬프트 재보정을 시작합니다...`, 'INFO');

    try {
        const newPrompts = await regenerateImagePrompts(script, settings);
        if (newPrompts.length !== script.scenes.length) {
            throw new Error(`AI가 반환한 프롬프트 개수(${newPrompts.length})가 씬 개수(${script.scenes.length})와 일치하지 않습니다.`);
        }

        const updatedScript = {
            ...script,
            scenes: script.scenes.map((scene, index): Scene => ({
                ...scene,
                imagePrompt: newPrompts[index],
                imageState: 'pending', // Reset state to re-generate
                imageUrl: undefined, // Clear old image
            })),
        };
        handleScriptUpdate(updatedScript);
        addLog(`[${script.shorts_title}] 이미지 프롬프트가 성공적으로 재보정되었습니다. '일괄 이미지 생성'을 다시 실행해주세요.`, 'SUCCESS');

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`AI 재보정 중 오류 발생: ${errorMessage}`, 'ERROR');
    } finally {
        setIsRecorrecting(false);
    }
  };

  const toggleImageGenerationMode = () => {
    if (!settings) return;
    const newMode = settings.imageGenerationMode === 'sequential' ? 'parallel' : 'sequential';
    updateSettings({ imageGenerationMode: newMode });
    const modeText = newMode === 'sequential' ? '테스트(순차)' : '실사용(병렬)';
    addLog(`이미지 생성 모드가 ${modeText}로 변경되었습니다.`, 'SUCCESS');
  };
  
  const openLightbox = (sceneIndex: number) => {
    setLightboxState({ isOpen: true, currentIndex: sceneIndex });
  };
  const closeLightbox = () => {
    setLightboxState({ isOpen: false, currentIndex: 0 });
    setPlayingSceneId(null);
  };
  const goToNextImage = () => {
    setLightboxState(prev => ({ ...prev, currentIndex: Math.min(prev.currentIndex + 1, (selectedScript?.scenes.length ?? 0) - 1) }));
  };
  const goToPrevImage = () => {
    setLightboxState(prev => ({ ...prev, currentIndex: Math.max(prev.currentIndex - 1, 0) }));
  };

  if (!selectedScript) {
    return (
      <Card title="영상 편집 목록">
        {scripts.length === 0 ? (
          <p className="text-center text-gray-400">먼저 '대본입력' 탭에서 대본을 생성해주세요.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
                <button onClick={() => { setScripts([]); setHasUnsavedChanges(true); }} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md">전체 삭제</button>
            </div>
            {scripts.map(script => (
              <div key={script.id} className="bg-[#1a1f2e] p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{script.shorts_title}</h3>
                  <p className="text-sm text-gray-400">{script.shorts_summary}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <StatusBadge status={script.status} />
                  <button onClick={() => setSelectedScriptId(script.id)} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">편집</button>
                  <button onClick={() => handleStartRender(script.id)} className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 rounded-md" disabled={script.status === 'rendering' || script.status === 'ready'}>영상 합성</button>
                  <button onClick={() => handleDeleteScript(script.id)} className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
        <div className="bg-[#2a3142] p-4 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-start">
                <div>
                    <button onClick={() => setSelectedScriptId(null)} className="mb-2 px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">&larr; 목록으로</button>
                    <h2 className="text-xl font-bold text-white">쇼츠 제목 (shorts_title): {selectedScript.shorts_title}</h2>
                    <p className="text-sm text-gray-400 mt-1">쇼츠 요약 (shorts_summary): {selectedScript.shorts_summary}</p>
                </div>
                <div className="flex items-center space-x-4">
                    {/* --- 이미지 생성 모드 토글 (향후 수정 권장) --- */}
                    {/* [현재 구현] */}
                    {/* 이 토글은 이미지 생성 방식을 '순차(Sequential)'와 '병렬(Parallel)' 중에서 선택할 수 있도록 합니다. */}
                    {/* '순차' 모드는 API 요청 사이에 5초의 딜레이를 주어, 여러 사용자가 동시에 사용하는 웹 데모 환경에서 */}
                    {/* Google Gemini API의 분당 요청 횟수(RPM) 제한을 초과하여 발생하는 오류(429 Error)를 방지하기 위한 안전 장치입니다. */}
                    {/* */}
                    {/* [향후 데스크톱 앱으로 전환 시] */}
                    {/* 이 애플리케이션을 개인 PC의 데스크톱 앱으로 전환하여 사용할 경우, API 사용량 제한에 대한 걱정이 훨씬 적어집니다. */}
                    {/* 따라서 더 빠른 성능을 위해 항상 '병렬' 모드로 이미지를 생성하는 것이 좋습니다. */}
                    {/* */}
                    {/* 다른 AI나 개발자에게 이 전환을 요청할 때, 아래와 같이 명확하게 지시해주세요: */}
                    {/* */}
                    {/* --- 요청 예시 --- */}
                    {/* "영상편집 탭에 있는 '이미지 생성 모드' 토글 스위치를 제거하고, imageGenerationMode 설정을 항상 'parallel'로 고정해주세요. 데스크톱 환경에서는 순차 모드가 더 이상 필요하지 않습니다." */}
                     <button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                        className="px-4 py-2 font-semibold bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
                     >
                         {hasUnsavedChanges ? '모든 변경사항 저장' : '저장 완료'}
                     </button>
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${settings?.imageGenerationMode === 'sequential' ? 'text-blue-400' : 'text-gray-400'}`}>
                            테스트 (순차)
                        </span>
                        <button
                            onClick={toggleImageGenerationMode}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${settings?.imageGenerationMode === 'parallel' ? 'bg-purple-600' : 'bg-gray-500'}`}
                            role="switch"
                            aria-checked={settings?.imageGenerationMode === 'parallel'}
                        >
                            <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.imageGenerationMode === 'parallel' ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                        <span className={`text-sm font-medium ${settings?.imageGenerationMode === 'parallel' ? 'text-purple-400' : 'text-gray-400'}`}>
                            실사용 (병렬)
                        </span>
                    </div>

                    <button onClick={handleBulkGenerateImages} className="px-4 py-2 font-semibold bg-purple-600 hover:bg-purple-700 rounded-md">일괄 이미지 생성</button>
                    <button onClick={handleBulkGenerateAudio} className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">일괄 음원 생성</button>
                    <button onClick={handleAiRecorrection} disabled={isRecorrecting} className="px-4 py-2 font-semibold bg-teal-500 hover:bg-teal-600 rounded-md disabled:bg-gray-500">
                      {isRecorrecting ? '보정중...' : 'AI 재보정'}
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            {selectedScript.scenes.map((scene, index) => (
                <SceneEditor 
                    key={scene.id} 
                    scene={scene} 
                    addLog={addLog} 
                    onUpdate={handleSceneUpdate}
                    settings={settings}
                    onImageClick={() => openLightbox(index)}
                    playingSceneId={playingSceneId}
                    setPlayingSceneId={setPlayingSceneId}
                />
            ))}
        </div>

        <ImageLightbox
            isOpen={lightboxState.isOpen}
            onClose={closeLightbox}
            imageUrl={selectedScript.scenes[lightboxState.currentIndex]?.imageUrl || ''}
            onNext={goToNextImage}
            onPrev={goToPrevImage}
            hasNext={lightboxState.currentIndex < selectedScript.scenes.length - 1}
            hasPrev={lightboxState.currentIndex > 0}
        />
    </div>
  );
};