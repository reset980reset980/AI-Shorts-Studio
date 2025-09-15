import React, { useState, useRef, ChangeEvent } from 'react';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import type { Settings, YouTubeChannelDetails } from '../types';

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
    // In a real app, you would exchange the code for a refresh token here.
    // We will simulate this by creating a fake token and updating the settings.
    const fakeRefreshToken = `fake_token_${Date.now()}`;
    const updatedChannels = settings?.youtube_channels.map(c => 
        c.name === authChannel.name ? { ...c, refreshToken: fakeRefreshToken } : c
    );
    
    if (updatedChannels) {
        updateSettings({ youtube_channels: updatedChannels });
        addLog(`[${authChannel.name}] Refresh Token이 성공적으로 저장되었습니다.`, 'SUCCESS');
    }
    
    setAuthModalOpen(false);
    setAuthCode('');
    setAuthChannel(null);
  };
  
  const handleUpload = (item: UploadQueueItem) => {
     if (!selectedChannel) {
        addLog('업로드할 채널을 먼저 선택해주세요.', 'ERROR');
        return;
     }
     addLog(`[${item.metadata.title}] 영상을 [${selectedChannel}] 채널에 업로드를 시작합니다 (스트리밍).`, 'INFO');
     
     // Simulate upload progress
     setUploadQueue(q => q.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i));
     const interval = setInterval(() => {
        setUploadQueue(q => q.map(i => {
            if (i.id === item.id) {
                const newProgress = i.progress + 10;
                if (newProgress >= 100) {
                    clearInterval(interval);
                    addLog(`[${item.metadata.title}] 영상 업로드 완료!`, 'SUCCESS');
                    return { ...i, status: 'done', progress: 100 };
                }
                return { ...i, progress: newProgress };
            }
            return i;
        }));
     }, 500);
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
    <>
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
                                    <div className="w-full bg-gray-600 rounded-full h-2.5">
                                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${item.progress}%` }}></div>
                                    </div>
                                )}
                            </td>
                            <td className="p-2 text-center">
                                <button 
                                    onClick={() => handleUpload(item)}
                                    disabled={!selectedChannel || item.status === 'uploading' || item.status === 'done'}
                                    className="px-3 py-1 text-sm font-semibold bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed"
                                >
                                    업로드
                                </button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Card>
      </div>

      {authChannel && (
          <Modal 
            isOpen={isAuthModalOpen} 
            onClose={() => setAuthModalOpen(false)} 
            title={`[${authChannel.name}] 채널 인증`}
            fileName="OAuth 2.0 인증"
          >
              <div className="text-gray-300 space-y-4">
                  <p className="font-semibold">데스크톱 앱 인증 절차 (수동)</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm bg-[#1a1f2e] p-3 rounded-md">
                      <li>아래 '인증 URL 열기' 버튼을 클릭하여 구글 로그인 및 권한 허용 페이지로 이동하세요.</li>
                      <li>인증을 완료하면 브라우저에 표시되는 <strong className="text-yellow-400">인증 코드</strong>를 복사하세요.</li>
                      <li>복사한 코드를 아래 입력창에 붙여넣고 '인증 코드 제출' 버튼을 누르세요.</li>
                  </ol>
                  <div className="text-center">
                    <button 
                        onClick={() => window.open(getAuthUrl(authChannel), '_blank')}
                        className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                        인증 URL 열기
                    </button>
                  </div>
                  <div>
                      <label htmlFor="auth-code-input" className="block text-sm font-medium mb-1">인증 코드 붙여넣기:</label>
                      <input 
                        id="auth-code-input"
                        type="text"
                        value={authCode}
                        onChange={(e) => setAuthCode(e.target.value)}
                        placeholder="이곳에 구글에서 받은 인증 코드를 붙여넣으세요"
                        className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md"
                      />
                  </div>
                   <div className="mt-4 flex justify-end">
                      <button onClick={handleAuthCodeSubmit} className="px-6 py-2 font-bold bg-green-600 hover:bg-green-700 text-white rounded-md">인증 코드 제출</button>
                  </div>
              </div>
          </Modal>
      )}
    </>
  );
};