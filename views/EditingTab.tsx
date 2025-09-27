import React, { useState, useEffect, useRef, ErrorInfo } from 'react';
import type { Script, Scene, Settings, ScriptStatus } from '../types';
import { Card } from '../components/Card';
import { SceneEditor } from './editing/SceneEditor';
import { generateImageForScene, generateAudioForScene, delay, startVideoRender, getRenderStatus, regenerateImagePrompts, repairScriptsAudio, repairScriptsImages, repairScenarioImageUrls, repairScenarioAudioUrls, saveScenario, saveRepairedScripts } from '../services/api';
import { createScenario, loadScenario, getAllScenarios, saveScenarioImage, saveScenarioAudio } from '../services/scenarioManager';
import { generateAndSaveSrt } from '../services/srtGenerator';

// Error Boundary Component for critical sections
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 m-4">
          <h3 className="text-red-400 font-bold mb-2">오류가 발생했습니다</h3>
          <p className="text-red-300 mb-3">
            예기치 않은 오류가 발생했습니다. 페이지를 새로고침해주세요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold"
            >
              페이지 새로고침
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold"
            >
              다시 시도
            </button>
          </div>
          {this.state.error && (
            <details className="mt-3">
              <summary className="text-red-400 cursor-pointer">오류 세부사항</summary>
              <pre className="text-xs text-red-300 mt-2 p-2 bg-red-900/30 rounded overflow-x-auto">
                {this.state.error.toString()}
                {this.state.error.stack && '\n\n' + this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Utility function to save scripts to backend
async function saveScriptsToBackend(scripts: Script[]) {
  try {
    const response = await fetch('/api/save-scripts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scripts }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save scripts: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving scripts to backend:', error);
    throw error;
  }
}

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
      rendering: { text: '합성중...', color: 'text-blue-400 animate-pulse' },
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
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Error boundary callback
  const handleErrorBoundary = (error: Error, errorInfo: ErrorInfo) => {
    addLog(`치명적인 오류가 발생했습니다: ${error.message}`, 'ERROR');
    console.error('Critical error in EditingTab:', error, errorInfo);
  };

  const selectedScript = scripts.find(s => s.id === selectedScriptId);
  
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Removed auto-load to prevent crashes
  // Users should use the "시나리오 폴더 동기화" button instead

  useEffect(() => {
      const audio = audioPlayerRef.current;
      if (!audio) return;

      const sceneToPlay = selectedScript?.scenes.find(s => s.id === playingSceneId);

      if (sceneToPlay?.audioUrl) {
          if (audio.src !== sceneToPlay.audioUrl) {
              audio.src = sceneToPlay.audioUrl;
          }
          audio.play().catch(e => addLog(`[씬 ${sceneToPlay.id}] 오디오 재생 실패: ${e.message}`, 'ERROR'));
      } else {
          audio.pause();
      }
  }, [playingSceneId, selectedScript, addLog]);
  
  useEffect(() => {
    if (lightboxState.isOpen && selectedScript) {
        const scene = selectedScript.scenes[lightboxState.currentIndex];
        if (scene?.audioUrl) {
            setPlayingSceneId(scene.id);
        } else {
            setPlayingSceneId(null);
        }
    }
  }, [lightboxState.isOpen, lightboxState.currentIndex, selectedScript]);
  
    const updateAndPersistScriptState = (scriptId: string, updateFn: (draft: Script) => Partial<Script>) => {
      setScripts(prevScripts => {
        const newScripts = prevScripts.map(s => {
          if (s.id === scriptId) {
            return { ...s, ...updateFn(s) };
          }
          return s;
        });

        // Save to backend instead of localStorage
        saveScriptsToBackend(newScripts).catch(error => {
          console.error('Failed to save scripts to backend:', error);
          addLog('스크립트 저장에 실패했습니다.', 'ERROR');
        });

        return newScripts;
      });
  };

  useEffect(() => {
    const scriptsToPoll = scripts.filter(s => s.status === 'rendering' && s.renderId);

    scriptsToPoll.forEach(script => {
        if (!pollingIntervals.current[script.id]) {
            addLog(`[${script.shorts_title}] 영상 상태 확인을 시작합니다. (ID: ${script.renderId})`, 'INFO');
            
            pollingIntervals.current[script.id] = setInterval(async () => {
                if (!settings) return;
                try {
                    const statusResponse = await getRenderStatus(script.renderId!, settings);
                    addLog(`[${script.shorts_title}] 상태: ${statusResponse.status}`, 'INFO');

                    if (statusResponse.status === 'done') {
                        addLog(`[${script.shorts_title}] 영상 합성이 완료되었습니다! URL: ${statusResponse.url}`, 'SUCCESS');
                        updateAndPersistScriptState(script.id, s => ({ status: 'ready', videoUrl: statusResponse.url }));
                        clearInterval(pollingIntervals.current[script.id]);
                        delete pollingIntervals.current[script.id];
                    } else if (statusResponse.status === 'failed') {
                        const errorMsg = statusResponse.error || '알 수 없는 오류';
                        addLog(`[${script.shorts_title}] 영상 합성에 실패했습니다: ${errorMsg}`, 'ERROR');
                        updateAndPersistScriptState(script.id, s => ({ status: 'error' }));
                        clearInterval(pollingIntervals.current[script.id]);
                        delete pollingIntervals.current[script.id];
                    }
                } catch (error: any) {
                    addLog(`[${script.shorts_title}] 상태 확인 중 오류 발생: ${error.message}`, 'ERROR');
                    updateAndPersistScriptState(script.id, s => ({ status: 'error' }));
                    clearInterval(pollingIntervals.current[script.id]);
                    delete pollingIntervals.current[script.id];
                }
            }, 10000);
        }
    });

    return () => {
        Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, [scripts, settings, addLog]);

  const handleSaveChanges = async () => {
    try {
      // Validate scripts data before saving
      if (!scripts || !Array.isArray(scripts)) {
        addLog('저장할 스크립트 데이터가 유효하지 않습니다.', 'ERROR');
        return;
      }

      // Save to backend instead of localStorage
      await saveScriptsToBackend(scripts);
      setHasUnsavedChanges(false);
      addLog('모든 변경사항이 성공적으로 저장되었습니다.', 'SUCCESS');

      // Try to save scenarios to files asynchronously (best effort)
      try {
        scripts.forEach(script => {
          if (script && script.scenes && Array.isArray(script.scenes) && script.scenes.length > 0) {
            saveScenario(script).catch(err => {
              console.log(`Scenario file save for ${script.title || script.shorts_title || 'unknown'} skipped:`, err?.message || err);
            });
          }
        });
      } catch (scenarioError: any) {
        console.log('Scenario saving error (non-critical):', scenarioError);
        // Don't show error to user as this is optional functionality
      }

    } catch (error: any) {
      console.error('Save error details:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Provide specific error messages
      if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceededError')) {
        addLog('로컬 저장소가 꽉 찬 상태입니다. 오래된 데이터를 삭제하고 다시 시도해주세요.', 'ERROR');
      } else if (errorMessage.includes('security') || errorMessage.includes('SecurityError')) {
        addLog('보안 설정으로 인해 저장에 실패했습니다. 브라우저 설정을 확인해주세요.', 'ERROR');
      } else {
        addLog(`저장 중 오류 발생: ${errorMessage}`, 'ERROR');
      }
    }
  };

  const updateScriptState = (scriptId: string, updateFn: (draft: Script) => Script) => {
    setScripts(prevScripts =>
      prevScripts.map(s => (s.id === scriptId ? updateFn(s) : s))
    );
    setHasUnsavedChanges(true);
  };
  
  const handleSceneUpdate = (updatedScene: Scene) => {
    if (!selectedScriptId) return;
    updateScriptState(selectedScriptId, script => ({
      ...script,
      scenes: script.scenes.map(s => (s.id === updatedScene.id ? updatedScene : s)),
    }));
  };

  const handleDeleteScript = (scriptId: string) => {
    setScripts(prevScripts => {
        const newScripts = prevScripts.filter(s => s.id !== scriptId);

        // Save to backend instead of localStorage
        saveScriptsToBackend(newScripts).catch(error => {
          console.error('Failed to save scripts after deletion:', error);
          addLog('스크립트 삭제 후 저장에 실패했습니다.', 'ERROR');
        });

        return newScripts;
    });
    addLog('스크립트가 삭제되었습니다.', 'SUCCESS');
    if (selectedScriptId === scriptId) {
        setSelectedScriptId(null);
    }
  };

  const handleStartRender = async (scriptId: string) => {
    try {
      let scriptToRender = scripts.find(s => s.id === scriptId);
      if (!scriptToRender || !settings) {
        addLog(`렌더링할 스크립트를 찾을 수 없거나 설정이 로드되지 않았습니다: ${scriptId}`, 'ERROR');
        return;
      }

      // Force reload the script data to ensure we have the latest audioDuration info
      addLog(`[${scriptToRender.title}] 최신 데이터를 확인하는 중...`, 'INFO');
      if (scriptToRender.scenarioId) {
        try {
          const reloadedScript = await loadScenario(scriptToRender.scenarioId);
          if (reloadedScript) {
            // Update the script in our scripts array with the latest data
            const updatedScripts = scripts.map(s =>
              s.id === scriptId ? { ...reloadedScript, id: scriptId, status: scriptToRender!.status } : s
            );
            setScripts(updatedScripts);
            scriptToRender = updatedScripts.find(s => s.id === scriptId) || scriptToRender;
            addLog(`[${scriptToRender.title}] 최신 데이터 로드 완료`, 'SUCCESS');
          }
        } catch (reloadError) {
          addLog(`데이터 재로드 중 오류 발생, 기존 데이터를 사용합니다: ${reloadError}`, 'WARNING');
        }
      }

      // Check if all scenes have the necessary resources (imageUrl, audioUrl, audioDuration)
      // Don't check imageState/audioState as they might not be set for loaded scripts
      const isReady = scriptToRender.scenes.every(s =>
        s.imageUrl && s.audioUrl && s.audioDuration && s.audioDuration > 0
      );

      if (!isReady) {
        // More detailed error message
        const missingResources = scriptToRender.scenes.map((s, index) => {
          const missing = [];
          if (!s.imageUrl) missing.push('이미지');
          if (!s.audioUrl) missing.push('음원');
          if (!s.audioDuration || s.audioDuration <= 0) missing.push('음원 길이');

          if (missing.length > 0) {
            return `씬 ${index + 1}: ${missing.join(', ')} 없음`;
          }
          return null;
        }).filter(Boolean);

        addLog(`[${scriptToRender.title}] 다음 리소스가 필요합니다:`, 'ERROR');
        missingResources.forEach(msg => addLog(msg, 'ERROR'));
        addLog('먼저 편집 화면으로 들어가서 필요한 리소스를 생성해주세요.', 'INFO');
        return;
      }

      addLog(`[${scriptToRender.title}] 영상 합성 프로세스를 시작합니다.`, 'INFO');

      // Wrap state update in try-catch to prevent crashes
      try {
        updateScriptState(scriptId, s => ({ ...s, status: 'rendering', renderId: undefined }));
      } catch (stateError) {
        console.error('Failed to update state before render:', stateError);
      }

      const renderId = await startVideoRender(scriptToRender, settings);

      addLog(`[${scriptToRender.title}] 영상 합성 요청이 성공적으로 전송되었습니다. 상태 확인을 시작합니다. Render ID: ${renderId}`, 'SUCCESS');

      // Wrap state update in try-catch to prevent crashes
      try {
        updateScriptState(scriptId, s => ({ ...s, status: 'rendering', renderId: renderId }));
      } catch (stateError) {
        console.error('Failed to update state after render:', stateError);
      }

      // Start polling for render status
      const checkInterval = setInterval(async () => {
        try {
          const { checkRenderStatus, downloadAndSaveVideo } = await import('../services/api');
          const renderStatus = await checkRenderStatus(renderId, settings);

          addLog(`[${scriptToRender.title}] 렌더링 상태: ${renderStatus.status}`, 'INFO');

          if (renderStatus.status === 'done' && renderStatus.url) {
            clearInterval(checkInterval);

            // Download and save the video
            addLog(`[${scriptToRender.title}] 영상 다운로드 중...`, 'INFO');
            const savedPath = await downloadAndSaveVideo(renderStatus.url, scriptToRender.scenarioId || scriptToRender.id);

            // Update script with video URL and status
            updateScriptState(scriptId, s => ({
              ...s,
              status: 'ready',
              videoUrl: renderStatus.url,
              videoPath: savedPath
            }));

            // Save to localStorage to persist the state
            const updatedScripts = scripts.map(s =>
              s.id === scriptId ? { ...s, status: 'ready', videoUrl: renderStatus.url, videoPath: savedPath } : s
            );
            localStorage.setItem('generatedScripts', JSON.stringify(updatedScripts));

            addLog(`[${scriptToRender.title}] 영상 합성 완료! 영상이 저장되었습니다.`, 'SUCCESS');
          } else if (renderStatus.status === 'failed') {
            clearInterval(checkInterval);
            updateScriptState(scriptId, s => ({ ...s, status: 'error' }));
            addLog(`[${scriptToRender.title}] 영상 합성 실패!`, 'ERROR');
          }
        } catch (error) {
          console.error('Error checking render status:', error);
        }
      }, 5000); // Check every 5 seconds
    } catch (error: any) {
      console.error('Render error details:', error);
      console.error('Error stack:', error.stack);

      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`영상 합성 요청 중 오류 발생: ${errorMessage}`, 'ERROR');

      // Make sure to reset the status even if there's an error
      try {
        updateScriptState(scriptId, s => ({ ...s, status: 'error' }));
      } catch (updateError) {
        console.error('Failed to update script state:', updateError);
      }
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
    
    updateScriptState(selectedScriptId, s => ({
        ...s,
        scenes: s.scenes.map((scene): Scene => scenesToProcess.find(p => p.id === scene.id) ? { ...scene, imageState: 'generating' } : scene)
    }));

    const processScene = async (scene: Scene, sceneIndex: number) => {
        try {
            let imageUrl: string;

            // Use scenario-based generation if scenarioId is available
            if (script.scenarioId) {
                // Generate image with scenario ID for direct saving to scenario structure
                imageUrl = await generateImageForScene(scene.imagePrompt, settings.googleApiKey, script.scenarioId, sceneIndex);
            } else {
                // Fallback to original method
                imageUrl = await generateImageForScene(scene.imagePrompt, settings.googleApiKey);
            }

            addLog(`[씬 ${scene.id}] 이미지 생성 성공.`, 'SUCCESS');
            return { sceneId: scene.id, imageUrl, success: true, error: null };
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[씬 ${scene.id}] 이미지 생성 실패: ${errorMessage}`, 'ERROR');
            return { sceneId: scene.id, imageUrl: undefined, success: false, error: errorMessage };
        }
    };
    
    if (settings.imageGenerationMode === 'parallel') {
        const results = await Promise.all(scenesToProcess.map((scene, index) => processScene(scene, index)));
        
        updateScriptState(selectedScriptId, s => ({
            ...s,
            scenes: s.scenes.map((scene): Scene => {
                const result = results.find(r => r.sceneId === scene.id);
                if (result) {
                    return { ...scene, imageUrl: result.imageUrl, imageState: result.success ? 'done' : 'error' };
                }
                return scene;
            })
        }));

        // Auto-save after parallel image generation
        try {
            const updatedScripts = scripts.map(s => {
                if (s.id === selectedScriptId) {
                    return {
                        ...s,
                        scenes: s.scenes.map((scene): Scene => {
                            const result = results.find(r => r.sceneId === scene.id);
                            if (result) {
                                return { ...scene, imageUrl: result.imageUrl, imageState: result.success ? 'done' : 'error' };
                            }
                            return scene;
                        })
                    };
                }
                return s;
            });

            // Save to backend instead of localStorage
            await saveScriptsToBackend(updatedScripts);
            setHasUnsavedChanges(false);
            console.log('Auto-saved after parallel image generation');
        } catch (saveError) {
            console.error('Auto-save failed:', saveError);
        }

    } else { // sequential
        for (let i = 0; i < scenesToProcess.length; i++) {
            const scene = scenesToProcess[i];
            const result = await processScene(scene, i);

            try {
                setScripts(prevScripts => {
                    const newScripts = prevScripts.map(s => {
                        if (s.id !== selectedScriptId) return s;
                        return {
                            ...s,
                            scenes: s.scenes.map(sc => {
                                if (sc.id === result.sceneId) {
                                    return { ...sc, imageUrl: result.imageUrl, imageState: result.success ? 'done' : 'error' };
                                }
                                return sc;
                            })
                        };
                    });

                    // Auto-save after each image in sequential mode (non-blocking)
                    saveScriptsToBackend(newScripts)
                        .then(() => {
                            console.log(`Auto-saved after image generation for scene ${result.sceneId}`);
                        })
                        .catch((saveError: any) => {
                            console.error('Auto-save failed:', saveError);
                            // Don't prevent the operation, just log the error
                        });

                    return newScripts;
                });
                setHasUnsavedChanges(false);
            } catch (stateError: any) {
                console.error('Failed to update sequential image result:', stateError);
            }

            if (scenesToProcess.indexOf(scene) < scenesToProcess.length - 1) {
              await delay(5000);
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

    updateScriptState(selectedScriptId, s => ({
        ...s,
        scenes: s.scenes.map((scene): Scene => scenesToProcess.find(p => p.id === scene.id) ? { ...scene, audioState: 'generating' } : scene)
    }));

    for (let i = 0; i < scenesToProcess.length; i++) {
        const scene = scenesToProcess[i];
        try {
            let audioUrl: string, audioData: string, duration: number;

            // Use scenario-based generation if scenarioId is available
            if (script.scenarioId) {
                // Generate audio with scenario ID for direct saving to scenario structure
                ({ audioUrl, audioData, duration } = await generateAudioForScene(scene.script, settings.minimaxJwt, settings.voiceModel, script.scenarioId, i));
            } else {
                // Fallback to original method
                ({ audioUrl, audioData, duration } = await generateAudioForScene(scene.script, settings.minimaxJwt, settings.voiceModel));
            }

            addLog(`[씬 ${scene.id}] 음원 생성 성공 (길이: ${duration.toFixed(2)}s).`, 'SUCCESS');

            setScripts(prevScripts => {
                const newScripts = prevScripts.map(s => {
                    if (s.id !== selectedScriptId) return s;
                    return {
                        ...s,
                        scenes: s.scenes.map(sc => sc.id === scene.id ? {
                            ...sc,
                            audioUrl,
                            audioData,
                            duration,
                            audioDuration: duration, // For SRT generation
                            audioState: 'done'
                        } : sc)
                    };
                });

                // Auto-save when audio is generated (non-blocking)
                saveScriptsToBackend(newScripts)
                    .then(() => {
                        console.log(`Auto-saved after audio generation for scene ${scene.id}`);
                    })
                    .catch((saveError) => {
                        console.error('Auto-save failed:', saveError);
                    });

                return newScripts;
            });
            setHasUnsavedChanges(false);

        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`[씬 ${scene.id}] 음원 생성 실패: ${errorMessage}`, 'ERROR');

            setScripts(prevScripts => prevScripts.map(s => {
                if (s.id !== selectedScriptId) return s;
                return {
                    ...s,
                    scenes: s.scenes.map(sc => sc.id === scene.id ? { ...sc, audioState: 'error' } : sc)
                };
            }));
            setHasUnsavedChanges(true);
        }
    }
    addLog(`[${script.shorts_title}] 일괄 음원 생성이 완료되었습니다.`, 'SUCCESS');

    // Automatically generate SRT file if scenario ID exists and all audio is complete
    if (script.scenarioId) {
        const allAudioComplete = script.scenes.every(scene => scene.audioState === 'success' && scene.audioDuration && scene.audioDuration > 0);
        if (allAudioComplete) {
            try {
                const srtPath = await generateAndSaveSrt(script.scenarioId, script.scenes);
                addLog(`[${script.shorts_title}] SRT 자막 파일이 자동 생성되었습니다: ${srtPath}`, 'SUCCESS');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                addLog(`SRT 자막 파일 생성 실패: ${errorMessage}`, 'ERROR');
            }
        }
    }
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

        updateScriptState(selectedScriptId, s => ({
            ...s,
            scenes: s.scenes.map((scene, index): Scene => ({
                ...scene,
                imagePrompt: newPrompts[index],
                imageState: 'pending',
                imageUrl: undefined,
            })),
        }));
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

  const handleClearAllScripts = async () => {
    if (window.confirm('정말로 모든 스크립트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setScripts([]);

      // Save empty array to backend instead of removing localStorage
      try {
        await saveScriptsToBackend([]);
        addLog('모든 스크립트가 영구적으로 삭제되었습니다.', 'SUCCESS');
      } catch (error) {
        console.error('Failed to clear scripts on backend:', error);
        addLog('스크립트 삭제 중 오류가 발생했습니다.', 'ERROR');
      }
    }
  };

  const handleRepairAudioUrls = async () => {
    try {
      addLog('음원 URL 복구를 시작합니다...', 'INFO');
      // Use new repair function for scenario system
      const repairedScripts = await repairScenarioAudioUrls(scripts);
      setScripts(repairedScripts);

      addLog('음원 URL 복구가 완료되었습니다.', 'SUCCESS');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`음원 URL 복구 중 오류 발생: ${errorMessage}`, 'ERROR');
    }
  };

  const handleRepairImageUrls = async () => {
    try {
      addLog('이미지 URL 복구를 시작합니다...', 'INFO');
      // Use new repair function for scenario system
      const repairedScripts = await repairScenarioImageUrls(scripts);
      setScripts(repairedScripts);

      addLog('이미지 URL 복구가 완료되었습니다.', 'SUCCESS');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`이미지 URL 복구 중 오류 발생: ${errorMessage}`, 'ERROR');
    }
  };

  const handleGenerateSrt = async () => {
    if (!selectedScript?.scenarioId) {
      addLog('시나리오 ID가 없어 SRT 파일을 생성할 수 없습니다.', 'ERROR');
      return;
    }

    try {
      addLog(`[${selectedScript.shorts_title}] SRT 자막 파일 생성 시작...`, 'INFO');

      // Check if all scenes have audio duration
      const scenesWithoutDuration = selectedScript.scenes.filter(scene => !scene.audioDuration || scene.audioDuration <= 0);
      if (scenesWithoutDuration.length > 0) {
        addLog(`일부 씬에 음원 길이 정보가 없습니다. 먼저 모든 씬의 음원을 생성해주세요.`, 'ERROR');
        return;
      }

      const srtPath = await generateAndSaveSrt(selectedScript.scenarioId, selectedScript.scenes);
      addLog(`[${selectedScript.shorts_title}] SRT 자막 파일이 생성되었습니다: ${srtPath}`, 'SUCCESS');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`SRT 파일 생성 중 오류 발생: ${errorMessage}`, 'ERROR');
    }
  };

  const handleSyncScenariosFolder = async () => {
    try {
      addLog('시나리오 폴더 동기화를 시작합니다...', 'INFO');

      // Use new API endpoint for new scenario system
      const response = await fetch('/api/list-scenarios-new');
      if (response.ok) {
        const data = await response.json();
        if (data.scenarios && data.scenarios.length > 0) {
          const currentScripts = scripts;
          const newScripts = [...currentScripts];
          let addedCount = 0;

          data.scenarios.forEach((scenario: any) => {
            if (scenario.scripts && Array.isArray(scenario.scripts)) {
              scenario.scripts.forEach((script: Script) => {
                const existingIndex = newScripts.findIndex(s => s.id === script.id);
                if (existingIndex === -1) {
                  // Ensure audio states are properly set
                  const fixedScript = {
                    ...script,
                    scenes: script.scenes.map(scene => ({
                      ...scene,
                      audioState: scene.audioUrl ? 'done' : 'pending',
                      imageState: scene.imageUrl ? 'done' : 'pending'
                    }))
                  };
                  newScripts.push(fixedScript);
                  addedCount++;
                  addLog(`[${script.shorts_title}] 시나리오를 불러왔습니다.`, 'SUCCESS');
                }
              });
            }
          });

          // Always repair URLs for all scripts (both new and existing)
          addLog('이미지 URL을 불러오는 중...', 'INFO');
          const scriptsWithImages = await repairScenarioImageUrls(newScripts);
          addLog('이미지 URL 복구 완료!', 'SUCCESS');

          addLog('음원 URL을 불러오는 중...', 'INFO');
          const scriptsWithAudio = await repairScenarioAudioUrls(scriptsWithImages);
          addLog('음원 URL 및 길이 정보 복구 완료!', 'SUCCESS');

          // Save the repaired scripts back to scenario files
          addLog('복구된 데이터를 시나리오 파일에 저장 중...', 'INFO');
          await saveRepairedScripts(scriptsWithAudio);
          addLog('시나리오 파일 저장 완료!', 'SUCCESS');

          setScripts(scriptsWithAudio);

          // Update selectedScript if it matches one of the repaired scripts
          if (selectedScript) {
            const updatedSelectedScript = scriptsWithAudio.find(script =>
              script.scenarioId === selectedScript.scenarioId ||
              script.title === selectedScript.title
            );
            if (updatedSelectedScript) {
              setSelectedScript(updatedSelectedScript);
              addLog('현재 선택된 스크립트도 업데이트되었습니다.', 'SUCCESS');
            }
          }

          if (addedCount > 0) {
            addLog(`총 ${addedCount}개의 시나리오를 폴더에서 불러왔습니다.`, 'SUCCESS');
          } else {
            addLog('폴더에 새로운 시나리오가 없습니다. 기존 시나리오 미디어를 복구했습니다.', 'INFO');
          }
        } else {
          addLog('시나리오 폴더가 비어있습니다.', 'INFO');
        }
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`시나리오 폴더 동기화 중 오류 발생: ${errorMessage}`, 'ERROR');
    }
  };

  if (!selectedScript) {
    return (
      <ErrorBoundary onError={handleErrorBoundary}>
        <Card title="영상 편집 목록">
          <div className="space-y-3">
            <div className="flex justify-end space-x-2 mb-4 flex-wrap gap-2">
                <button onClick={handleSyncScenariosFolder} className="px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 rounded-md">시나리오 폴더 동기화</button>
                {scripts.length > 0 && (
                  <>
                    <button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                        className="px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {hasUnsavedChanges ? '모든 변경사항 저장' : '저장 완료'}
                    </button>
                    <button onClick={handleRepairImageUrls} className="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded-md">이미지 URL 복구</button>
                    <button onClick={handleRepairAudioUrls} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">음원 URL 복구</button>
                    <button onClick={handleClearAllScripts} className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md">전체 삭제</button>
                  </>
                )}
            </div>
            {scripts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">저장된 시나리오가 없습니다.</p>
                <p className="text-gray-500 text-sm mb-2">위의 '시나리오 폴더 동기화' 버튼을 클릭하여 시나리오를 불러오거나</p>
                <p className="text-gray-500 text-sm">'대본입력' 탭에서 새로운 대본을 생성해주세요.</p>
              </div>
            ) : (
              <>
                {scripts.map(script => (
                  <div key={script.id} className="bg-[#1a1f2e] p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{script.shorts_title}</h3>
                      <p className="text-sm text-gray-400">{script.scenes.length} 씬</p>
                      {script.videoUrl && script.status === 'ready' && <a href={script.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">영상 보기</a>}
                    </div>
                    <div className="flex items-center space-x-3">
                      <StatusBadge status={script.status} />
                      <button onClick={() => setSelectedScriptId(script.id)} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">편집</button>
                      <button onClick={() => handleStartRender(script.id)} className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={script.status === 'rendering' || script.status === 'ready'}>영상 합성</button>
                      <button onClick={() => handleDeleteScript(script.id)} className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">삭제</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onError={handleErrorBoundary}>
      <div>
          <audio ref={audioPlayerRef} style={{ display: 'none' }} onEnded={() => setPlayingSceneId(null)} />
        <div className="bg-[#2a3142] p-4 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-start">
                <div>
                    <button onClick={() => setSelectedScriptId(null)} className="mb-2 px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded-md">&larr; 목록으로</button>
                    <h2 className="text-xl font-bold text-white">쇼츠 제목 (shorts_title): {selectedScript.shorts_title}</h2>
                    <p className="text-sm text-gray-400 mt-1">쇼츠 요약 (shorts_summary): {selectedScript.shorts_summary}</p>
                </div>
                <div className="flex items-center space-x-4">
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
                    {selectedScript.scenarioId && (
                        <button onClick={handleGenerateSrt} className="px-4 py-2 font-semibold bg-orange-600 hover:bg-orange-700 rounded-md">
                          SRT 자막 생성
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="space-y-4">
            {selectedScript.scenes.map((scene, index) => (
                <ErrorBoundary key={scene.id} onError={handleErrorBoundary}>
                    <SceneEditor
                        scene={scene}
                        sceneIndex={index}
                        scenarioId={selectedScript.scenarioId}
                        addLog={addLog}
                        onUpdate={handleSceneUpdate}
                        settings={settings}
                        onImageClick={() => openLightbox(index)}
                        playingSceneId={playingSceneId}
                        setPlayingSceneId={setPlayingSceneId}
                    />
                </ErrorBoundary>
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
    </ErrorBoundary>
  );
};