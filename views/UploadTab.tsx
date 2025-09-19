import React, { useState, useRef, ChangeEvent } from 'react';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import type { Settings, YouTubeChannelDetails } from '../types';

// --- 아키텍처 설명: 데스크톱 앱의 YouTube API 연동 워크플로우 ---
// '유튜브 업로드' 기능은 Google의 OAuth 2.0 인증을 필요로 하며, 이는 민감한 사용자 정보(API 키, 토큰)를 다룹니다.
// 웹 브라우저 환경에서는 이러한 민감 정보를 안전하게 저장하기 어렵기 때문에, 이 기능은 Electron이나 Tauri 같은
// 데스크톱 애플리케이션 환경에서 구현되는 것을 전제로 합니다.
//
// [현재 구현 상태]
// - 이 파일은 데스크톱 앱의 UI/UX를 시뮬레이션합니다.
// - OAuth 2.0 인증 과정(인증 URL 생성 -> 코드 수동 복사/붙여넣기)과 파일 업로드 과정을 흉내 냅니다.
// - 실제 API 호출 대신, 상태 업데이트와 `setTimeout`을 사용하여 과정을 보여줍니다.
//
// [향후 실제 구현 방향 (데스크톱 앱 기준)]
// 1. **인증 (OAuth 2.0):**
//    - '인증' 버튼 클릭 시, 앱은 Google 인증 URL로 새 브라우저 창을 엽니다.
//    - 사용자가 로그인을 완료하면, Google은 지정된 'redirectUri'(예: http://127.0.0.1:port/callback)로 리디렉션하며 URL에 '인증 코드(authCode)'를 포함시킵니다.
//    - 데스크톱 앱은 이 로컬 주소로의 리디렉션을 감지하여 URL에서 코드를 자동으로 추출합니다. (사용자가 직접 복사/붙여넣기 할 필요 없음)
//    - 앱의 백엔드(메인 프로세스)는 이 코드를 사용하여 Google 서버에 'Access Token'과 'Refresh Token'을 요청하고, 안전하게 저장합니다.
//
// 2. **업로드:**
//    - '업로드' 버튼 클릭 시, 프론트엔드(Renderer 프로세스)는 비디오 파일과 메타데이터를 백엔드(메인 프로세스)로 전송합니다.
//    - 백엔드는 저장된 'Refresh Token'을 사용해 새로운 'Access Token'을 발급받습니다.
//    - Google의 YouTube Data API v3를 사용하여, 이 Access Token으로 비디오를 업로드합니다.
//    - 업로드 진행 상황을 프론트엔드로 다시 전달하여 프로그레스 바를 업데이트합니다.
//
// 아래 코드에는 이러한 실제 구현을 위한 가이드 주석과 예시 코드가 포함되어 있습니다.

interface UploadTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  settings: Settings | null;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

interface UploadQueueItem {
  id: string;
  videoFile: File;
  metadata: {
    title: string;
    description: string;
    tags: string[];
  };
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
}

export const UploadTab: React.FC<UploadTabProps> = ({ addLog, settings, updateSettings }) => {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authChannel, setAuthChannel] = useState<YouTubeChannelDetails | null>(null);
  const [authCode, setAuthCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    addLog(`${files.length}개의 파일이 선택되었습니다. 메타데이터를 처리합니다...`, 'INFO');

    const videoFiles = Array.from(files).filter(f => f.name.endsWith('.mp4'));
    const jsonFiles = Array.from(files).filter(f => f.name.endsWith('.json'));
    const newQueueItems: UploadQueueItem[] = [];

    for (const videoFile of videoFiles) {
      const baseName = videoFile.name.replace('.mp4', '');
      const jsonFile = jsonFiles.find(f => f.name.replace('.json', '') === baseName);

      if (jsonFile) {
        try {
          const metadataText = await jsonFile.text();
          const metadata = JSON.parse(metadataText);
          
          if (metadata.title && metadata.description && Array.isArray(metadata.tags)) {
            newQueueItems.push({
              id: `${baseName}-${Date.now()}`,
              videoFile,
              metadata,
              status: 'pending',
              progress: 0,
            });
            addLog(`[${videoFile.name}] 영상과 메타데이터가 성공적으로 매칭되었습니다.`, 'SUCCESS');
          } else {
            addLog(`[${jsonFile.name}] 파일의 형식이 올바르지 않습니다 (title, description, tags 필요).`, 'ERROR');
          }
        } catch (e) {
          addLog(`[${jsonFile.name}] 메타데이터 파일을 읽는 중 오류 발생: ${e}`, 'ERROR');
        }
      } else {
        addLog(`[${videoFile.name}]에 해당하는 .json 메타데이터 파일을 찾을 수 없습니다.`, 'ERROR');
      }
    }
    
    setUploadQueue(prev => [...prev, ...newQueueItems]);
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };
  
  const startAuthentication = (channel: YouTubeChannelDetails) => {
    setAuthChannel(channel);
    setAuthModalOpen(true);
    addLog(`[${channel.name}] 채널의 인증을 시작합니다. 팝업의 안내를 따라주세요.`, 'INFO');
  };

  const handleAuthCodeSubmit = () => {
    if (!authCode.trim() || !authChannel) {
        addLog('인증 코드를 입력해주세요.', 'ERROR');
        return;
    }
    addLog(`[${authChannel.name}] 인증 코드 수신. Refresh Token 교환을 시도합니다... (시뮬레이션)`, 'INFO');

    // --- [실제 구현 영역] ---
    // 아래 시뮬레이션 대신, 실제로는 백엔드(메인 프로세스)에 API 요청을 보내
    // 인증 코드를 Refresh Token으로 교환해야 합니다.
    /*
    const exchangeCodeForToken = async () => {
      try {
        // 백엔드 API에 인증 코드 전달
        const response = await fetch('/api/youtube/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelName: authChannel.name,
            authCode: authCode.trim(),
          }),
        });

        if (!response.ok) throw new Error('토큰 교환에 실패했습니다.');

        const { success, refreshToken } = await response.json();

        if (success && refreshToken) {
          const updatedChannels = settings?.youtube_channels.map(c => 
              c.name === authChannel.name ? { ...c, refreshToken } : c
          );
          if (updatedChannels) {
            updateSettings({ youtube_channels: updatedChannels });
            addLog(`[${authChannel.name}] Refresh Token이 성공적으로 저장되었습니다.`, 'SUCCESS');
          }
        } else {
          throw new Error('백엔드에서 토큰을 받아오지 못했습니다.');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`토큰 교환 오류: ${errorMessage}`, 'ERROR');
      } finally {
        setAuthModalOpen(false);
        setAuthCode('');
        setAuthChannel(null);
      }
    };
    exchangeCodeForToken();
    */

    // --- [시뮬레이션 코드] ---
    // 현재는 실제 백엔드 연동 대신 가짜 토큰을 생성하여 설정을 업데이트합니다.
    const fakeRefreshToken = `fake_token_${Date.now()}`;
    const updatedChannels = settings?.youtube_channels.map(c => 
        c.name === authChannel.name ? { ...c, refreshToken: fakeRefreshToken } : c
    );
    if (updatedChannels) {
        updateSettings({ youtube_channels: updatedChannels });
        addLog(`[${authChannel.name}] Refresh Token이 성공적으로 저장되었습니다. (시뮬레이션)`, 'SUCCESS');
    }
    setAuthModalOpen(false);
    setAuthCode('');
    setAuthChannel(null);
    // --- [시뮬레이션 코드 끝] ---
  };
  
  const handleUpload = (item: UploadQueueItem) => {
     if (!selectedChannel) {
        addLog('업로드할 채널을 먼저 선택해주세요.', 'ERROR');
        return;
     }
     addLog(`[${item.metadata.title}] 영상을 [${selectedChannel}] 채널에 업로드를 시작합니다 (스트리밍).`, 'INFO');
     
     // --- [실제 구현 영역] ---
     // 아래 시뮬레이션 대신, 실제로는 FormData를 구성하여 백엔드로 파일을 전송해야 합니다.
     /*
     const uploadVideo = async () => {
        setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));

        try {
            const formData = new FormData();
            formData.append('videoFile', item.videoFile);
            formData.append('metadata', JSON.stringify(item.metadata));
            formData.append('channelName', selectedChannel);

            // 백엔드에 업로드 요청 (백엔드가 YouTube API와 통신)
            // 이 API는 진행 상황을 폴링할 수 있도록 jobId를 반환할 수 있습니다.
            const response = await fetch('/api/youtube/upload', {
                method: 'POST',
                body: formData,
                // 진행률을 추적하려면 XHR을 사용하거나, 백엔드에서 폴링 방식을 구현해야 합니다.
            });

            if (!response.ok) throw new Error('업로드 시작에 실패했습니다.');

            // (폴링 방식 구현 시) jobId를 받아 진행 상황을 주기적으로 확인하는 로직 추가
            // ...

            // 임시로 성공 처리
            addLog(`[${item.metadata.title}] 영상 업로드 완료!`, 'SUCCESS');
            setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'done', progress: 100 } : i));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`업로드 오류: ${errorMessage}`, 'ERROR');
            setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
        }
     }
     uploadVideo();
     */
     
     // --- [시뮬레이션 코드] ---
     // `setInterval`을 사용하여 업로드 진행 상황을 흉내 냅니다.
     setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));
     const interval = setInterval(() => {
        setUploadQueue(q => {
            const currentItem = q.find(i => i.id === item.id);
            if (!currentItem || currentItem.status !== 'uploading') {
                clearInterval(interval);
                return q;
            }

            const newProgress = currentItem.progress + 10;
            if (newProgress >= 100) {
                clearInterval(interval);
                addLog(`[${item.metadata.title}] 영상 업로드 완료! (시뮬레이션)`, 'SUCCESS');
                return q.map(i => i.id === item.id ? { ...i, status: 'done', progress: 100 } : i);
            }
            return q.map(i => i.id === item.id ? { ...i, progress: newProgress } : i);
        });
     }, 500);
     // --- [시뮬레이션 코드 끝] ---
  };
  
  const getAuthUrl = (channel: YouTubeChannelDetails): string => {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
        redirect_uri: channel.redirectUri,
        client_id: channel.clientId,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: 'https://www.googleapis.com/auth/youtube.upload',
    };
    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
  };

  return (
    <div className="space-y-6">
        <Card title="채널 관리 및 인증">
          <div className="space-y-3">
              {settings?.youtube_channels.map(channel => (
                  <div key={channel.name} className="bg-[#1a1f2e] p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold">{channel.name} <span className="text-sm font-normal text-gray-400">({channel.email})</span></h3>
                          <p className={`text-sm ${channel.refreshToken ? 'text-green-400' : 'text-yellow-400'}`}>
                              {channel.refreshToken ? '인증 토큰 유효' : '인증 필요'}
                          </p>
                      </div>
                      <button 
                        onClick={() => startAuthentication(channel)}
                        className="px-4 py-2 text-sm font-semibold bg-yellow-500 hover:bg-yellow-600 text-black rounded-md"
                      >
                        인증 및 토큰 갱신
                      </button>
                  </div>
              ))}
          </div>
        </Card>
        
        <Card title="업로드 대기 영상 목록">
            <div className="flex justify-between items-center mb-4">
              <div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".mp4,.json" className="hidden" />
                <button onClick={handleFileSelectClick} className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">
                    영상 파일 선택 (.mp4 + .json)
                </button>
                <span className="ml-4 text-sm text-gray-400">업로드할 영상과 정보 파일을 함께 선택해주세요.</span>
              </div>
              <div className="flex items-center space-x-2">
                 <label htmlFor="channel-select" className="text-sm font-medium">업로드 채널:</label>
                 <select 
                    id="channel-select"
                    value={selectedChannel ?? ''}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="p-2 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={!settings?.youtube_channels.some(c => c.refreshToken)}
                  >
                     <option value="" disabled>채널 선택</option>
                     {settings?.youtube_channels.filter(c => c.refreshToken).map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                     ))}
                 </select>
              </div>
            </div>

            {uploadQueue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">업로드 대기 중인 영상이 없습니다.</div>
            ) : (
                <table className="w-full text-left">
                    <thead className="border-b border-gray-600">
                        <tr>
                        <th className="p-2 w-2/5">제목</th>
                        <th className="p-2 w-2/5">상태</th>
                        <th className="p-2 w-1/5 text-center">작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        {uploadQueue.map(item => (
                        <tr key={item.id} className="border-b border-gray-700">
                            <td className="p-2 text-gray-300">{item.metadata.title}</td>
                            <td className="p-2">
                                {item.status === 'pending' && <span className="text-gray-400">대기중</span>}
                                {item.status === 'done' && <span className="text-green-400">완료</span>}
                                {item.status === 'error' && <span className="text-red-400">실패</span>}
                                {item.status === 'uploading' && (
                                    <div className="text-blue-400">업로드 중...</div>
                                )}
                            </td>
                            <td className="p-2 text-center">
                                <button
                                    onClick={() => removeFromQueue(item.id)}
                                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                    disabled={item.status === 'uploading'}
                                >
                                    제거
                                </button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Card>
    </div>
  );
};