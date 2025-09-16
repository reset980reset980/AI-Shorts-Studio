import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/Card';
import type { Settings, YouTubeChannel, YouTubeVideo } from '../types';
import { delay } from '../services/api';

// --- 아키텍처 설명: 프론트엔드와 백엔드의 역할 분리 ---
// 이 '유튜브채널' 탭은 사용자가 웹 스크레이핑 작업을 관리하고 모니터링하는 사용자 인터페이스(UI)입니다.
// 실제 스크레이핑 작업(Puppeteer를 사용한 브라우저 자동화)은 보안 및 기술적 제약으로 인해 웹 브라우저에서 직접 실행될 수 없습니다.
// 따라서 이 작업은 별도의 백엔드(또는 데스크톱 앱의 메인 프로세스)에서 실행되어야 합니다.
//
// [현재 구현 상태]
// - 이 파일은 백엔드가 존재한다고 '가정'하고, 그와 통신하는 과정을 시뮬레이션합니다.
// - `setTimeout`과 `setInterval`을 사용하여 비동기 작업, 진행률 업데이트, 로그 생성을 흉내 냅니다.
// - 이는 실제 백엔드 API가 개발되기 전, UI/UX를 검증하고 완성하기 위한 프로토타이핑 방식입니다.
//
// [향후 실제 구현 방향]
// 1. 백엔드 개발: Node.js 환경에서 Puppeteer를 사용하여 지정된 유튜브 채널의 동영상 정보를 스크레이핑하는 API를 구축합니다.
//    - `POST /api/scrape/start`: 스크레이핑 작업을 시작하고, 고유한 `jobId`를 반환합니다.
//    - `GET /api/scrape/status/{jobId}`: 해당 작업의 진행 상태(status, progress, logs, results)를 반환합니다.
// 2. 프론트엔드 연동: 아래의 시뮬레이션 로직을 실제 `fetch` API 호출로 교체합니다. (주석으로 예시 코드 제공)

interface ChannelsTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

type ScrapingStatus = 'pending' | 'scraping' | 'completed' | 'failed';

interface ScrapingJob {
  channelId: string;
  status: ScrapingStatus;
  logs: string[];
  progress: number;
}

const MOCK_TITLES = [
    "결국 부자 되는 사람들의 손금 3가지, 당신도 있나요?",
    "2025년, 이 띠는 무조건 대박납니다! (미리 준비하세요)",
    "소름돋는 궁합! 만나자마자 결혼하게 되는 커플의 특징",
    "이런 관상은 절대 피하세요! 인생 망치는 얼굴",
    "내가 직접 겪은 사주팔자 소름돋는 이야기 (실화)",
    "역술가가 뽑은 로또 1등 명당자리 TOP 5",
    "이름 하나 바꿨을 뿐인데 인생이 180도 바뀐 사연",
    "꿈에서 조상님이 나타나 알려준 비밀",
    "태어난 월(月)로 보는 당신의 숨겨진 재물운",
    "절대 놓치면 안 될 귀인의 관상 (내 주변에도 있을까?)",
];

const StatusBadge: React.FC<{ status: ScrapingStatus }> = ({ status }) => {
    const statusMap = {
        pending: { text: '대기중', color: 'bg-gray-500', icon: '🕒' },
        scraping: { text: '수집중...', color: 'bg-blue-500 animate-pulse', icon: '⚙️' },
        completed: { text: '완료', color: 'bg-green-500', icon: '✅' },
        failed: { text: '실패', color: 'bg-red-500', icon: '❌' },
    };
    const { text, color, icon } = statusMap[status];
    return (
        <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${color}`}>
            {icon} {text}
        </span>
    );
};


export const ChannelsTab: React.FC<ChannelsTabProps> = ({ addLog, settings, updateSettings }) => {
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [scrapedVideos, setScrapedVideos] = useState<YouTubeVideo[]>([]);
  const [scrapingJobs, setScrapingJobs] = useState<Record<string, ScrapingJob>>({});
  const [isJobRunning, setIsJobRunning] = useState(false);
  
  // Initialize jobs when channels change
  useEffect(() => {
    const newJobs: Record<string, ScrapingJob> = {};
    settings.youtubeScrapingChannels.forEach(channel => {
        if (scrapingJobs[channel.id] && scrapingJobs[channel.id].status === 'scraping') {
             newJobs[channel.id] = scrapingJobs[channel.id];
        } else {
            newJobs[channel.id] = {
                channelId: channel.id,
                status: 'pending',
                logs: [],
                progress: 0,
            };
        }
    });
    setScrapingJobs(newJobs);
  }, [settings.youtubeScrapingChannels]);

  const updateJobState = (channelId: string, updates: Partial<ScrapingJob>) => {
    setScrapingJobs(prev => ({
        ...prev,
        [channelId]: { ...prev[channelId], ...updates }
    }));
  };
  
  const addJobLog = useCallback((channelId: string, message: string) => {
    setScrapingJobs(prev => {
        if (!prev[channelId]) return prev;
        return {
            ...prev,
            [channelId]: {
                ...prev[channelId],
                logs: [...prev[channelId].logs, `${new Date().toLocaleTimeString()}: ${message}`]
            }
        };
    });
  }, []);

  const handleAddChannel = () => {
    if (!newChannelName.trim() || !newChannelUrl.trim()) {
      addLog('채널 이름과 URL을 모두 입력하세요.', 'ERROR');
      return;
    }
    if (!newChannelUrl.includes('youtube.com')) {
      addLog('유효한 YouTube 채널 URL을 입력하세요.', 'ERROR');
      return;
    }
    const newChannel: YouTubeChannel = {
      id: Date.now().toString(),
      name: newChannelName,
      url: newChannelUrl,
    };
    const updatedChannels = [...settings.youtubeScrapingChannels, newChannel];
    updateSettings({ youtubeScrapingChannels: updatedChannels });
    addLog(`채널 [${newChannelName}]이(가) 목록에 추가되었습니다.`, 'SUCCESS');
    setNewChannelName('');
    setNewChannelUrl('');
  };

  const handleDeleteChannel = (channelId: string) => {
    const updatedChannels = settings.youtubeScrapingChannels.filter(c => c.id !== channelId);
    updateSettings({ youtubeScrapingChannels: updatedChannels });
    addLog('채널이 목록에서 삭제되었습니다.', 'SUCCESS');
  };
  
  const runScrapingProcess = useCallback(async (channel: YouTubeChannel) => {
    updateJobState(channel.id, { status: 'scraping', progress: 0, logs: [] });

    // --- [실제 구현 영역] ---
    // 아래의 시뮬레이션 코드를 실제 백엔드 API 호출로 변경해야 합니다.
    // 다른 AI나 개발자에게 "이 부분을 실제 백엔드 스크레이핑 API 연동 코드로 교체해주세요." 라고 요청하세요.
    /*
    try {
      // 1. 백엔드에 스크레이핑 작업 시작 요청
      addJobLog(channel.id, '백엔드에 작업 요청...');
      const startResponse = await fetch('/api/scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: channel.url, channelId: channel.id }),
      });

      if (!startResponse.ok) throw new Error('스크레이핑 작업 시작에 실패했습니다.');
      
      const { jobId } = await startResponse.json();
      addJobLog(channel.id, `백엔드 작업 생성 완료 (Job ID: ${jobId})`);

      // 2. 작업 상태를 주기적으로 폴링(Polling)
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/scrape/status/${jobId}`);
          if (!statusResponse.ok) { // 404, 500 등 에러 처리
              clearInterval(pollInterval);
              updateJobState(channel.id, { status: 'failed' });
              addJobLog(channel.id, `상태 확인 실패: ${statusResponse.statusText}`);
              return;
          }

          const { status, progress, logs, newVideos } = await statusResponse.json();
          
          // UI 업데이트
          updateJobState(channel.id, { status, progress, logs });

          if (newVideos && newVideos.length > 0) {
            setScrapedVideos(prev => {
                const uniqueVideosMap = new Map<string, YouTubeVideo>();
                [...prev, ...newVideos].forEach(video => uniqueVideosMap.set(video.url, video));
                return Array.from(uniqueVideosMap.values());
            });
          }

          // 작업 완료 또는 실패 시 폴링 중단
          if (status === 'completed' || status === 'failed') {
            clearInterval(pollInterval);
            addJobLog(channel.id, status === 'completed' ? '작업 성공적으로 완료.' : '작업 실패.');
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
          addJobLog(channel.id, '폴링 중 에러 발생.');
          updateJobState(channel.id, { status: 'failed' });
          clearInterval(pollInterval);
        }
      }, 3000); // 3초마다 상태 확인

    } catch (error) {
      console.error("Scraping process initiation failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addJobLog(channel.id, `작업 시작 오류: ${errorMessage}`);
      updateJobState(channel.id, { status: 'failed' });
    }
    */
    
    // --- [시뮬레이션 코드] ---
    // 현재는 실제 백엔드 연동 대신 setTimeout/setInterval을 사용하여 비동기 프로세스를 시뮬레이션합니다.
    // 이 부분은 향후 실제 구현 시 위의 주석 처리된 코드로 대체되어야 합니다.
    addJobLog(channel.id, '백엔드에 작업 요청... (API 연동 시뮬레이션)');
    await delay(500);
    
    const interval = setInterval(() => {
        setScrapingJobs(prev => {
            const currentJob = prev[channel.id];
            if (!currentJob || currentJob.status !== 'scraping') {
                clearInterval(interval);
                return prev;
            }

            let newProgress = currentJob.progress + 20;
            
            if (newProgress === 20) addJobLog(channel.id, "Puppeteer 브라우저 실행...");
            if (newProgress === 40) addJobLog(channel.id, `[${channel.name}] 페이지로 이동 완료.`);
            if (newProgress === 60) addJobLog(channel.id, "무한 스크롤 실행 (5/5)");
            if (newProgress === 80) addJobLog(channel.id, "page.evaluate()로 데이터 추출 중...");
            
            if (newProgress >= 100) {
                 newProgress = 100;
                 addJobLog(channel.id, "데이터 추출 완료. 브라우저 종료.");
                 clearInterval(interval);
                 
                 const MOCK_VIDEO_COUNT = Math.floor(Math.random() * 5) + 3;
                 const newVideos: YouTubeVideo[] = [];
                 for (let i = 0; i < MOCK_VIDEO_COUNT; i++) {
                     const randomTitle = MOCK_TITLES[Math.floor(Math.random() * MOCK_TITLES.length)];
                     const randomVideoId = Math.random().toString(36).substring(2, 13);
                     newVideos.push({
                         id: `${channel.id}-${randomVideoId}`,
                         title: randomTitle,
                         channelName: channel.name,
                         url: `https://www.youtube.com/watch?v=${randomVideoId}`,
                         uploadDate: new Date().toISOString().split('T')[0],
                     });
                 }
                 setScrapedVideos(prev => {
                    const uniqueVideosMap = new Map<string, YouTubeVideo>();
                    [...prev, ...newVideos].forEach(video => uniqueVideosMap.set(video.url, video));
                    return Array.from(uniqueVideosMap.values());
                 });

                 updateJobState(channel.id, { status: 'completed', progress: 100 });
            } else {
                 updateJobState(channel.id, { progress: newProgress });
            }

            return { ...prev };
        });
    }, 1000);
    // --- [시뮬레이션 코드 끝] ---

  }, [addJobLog, updateJobState]);

  const handleStartScraping = async (targetChannelId?: string) => {
    setIsJobRunning(true);
    const channelsToScrape = targetChannelId
      ? settings.youtubeScrapingChannels.filter(c => c.id === targetChannelId)
      : settings.youtubeScrapingChannels;

    if (targetChannelId) {
        setScrapedVideos(prev => prev.filter(v => v.id.split('-')[0] !== targetChannelId));
    } else {
        setScrapedVideos([]);
    }

    addLog(`${channelsToScrape.length}개 채널의 동영상 수집을 시작합니다.`, 'INFO');

    for (const channel of channelsToScrape) {
        await runScrapingProcess(channel);
        await delay(1000); // Stagger API calls
    }
    
    // This is a simplified check. A more robust solution would track individual job completions.
    const allDoneOrFailed = Object.values(scrapingJobs).every(j => j.status === 'completed' || j.status === 'failed' || j.status === 'pending');
    if(allDoneOrFailed) {
      setIsJobRunning(false);
      addLog('모든 스크레이핑 작업이 완료되었습니다.', 'SUCCESS');
    }
  };


  const handleClearVideos = () => {
    setScrapedVideos([]);
    addLog('수집된 동영상 목록이 초기화되었습니다.', 'INFO');
  };
  
  const isAnyJobRunning = Object.values(scrapingJobs).some(j => j.status === 'scraping');

  return (
    <div className="space-y-6">
       <Card title="스크레이핑 대상 채널 관리 (channel.json)">
            <div className="space-y-3 mb-4">
                <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="채널 이름 (예: 채널이름_A)"
                    className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                 <input
                    type="text"
                    value={newChannelUrl}
                    onChange={(e) => setNewChannelUrl(e.target.value)}
                    placeholder="채널 URL (예: https://www.youtube.com/@Channel_A)"
                    className="w-full p-2 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
            <button onClick={handleAddChannel} className="w-full px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">
                채널 추가
            </button>
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-2">
                 <div className="grid grid-cols-[1fr_1fr_100px_120px] gap-4 p-2 border-b border-gray-600 font-bold">
                    <span>채널명</span>
                    <span>URL</span>
                    <span className="text-center">상태</span>
                    <span className="text-center">작업</span>
                </div>
                {settings.youtubeScrapingChannels.length > 0 ? (
                    settings.youtubeScrapingChannels.map(channel => {
                        const job = scrapingJobs[channel.id];
                        const isThisJobRunning = job?.status === 'scraping';
                        return (
                            <div key={channel.id} className="grid grid-cols-[1fr_1fr_100px_120px] gap-4 items-center p-2 bg-[#1a1f2e] rounded-md hover:bg-[#2f3b52]">
                                <p className="font-semibold truncate" title={channel.name}>{channel.name}</p>
                                <p className="text-xs text-gray-400 truncate" title={channel.url}>{channel.url}</p>
                                <div className="text-center">
                                    {job && <StatusBadge status={job.status} />}
                                </div>
                                <div className="flex items-center justify-center space-x-2">
                                    <button onClick={() => handleStartScraping(channel.id)} disabled={isAnyJobRunning} className="px-2 py-1 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed">수집</button>
                                    <button onClick={() => handleDeleteChannel(channel.id)} disabled={isAnyJobRunning} className="px-2 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 rounded-md disabled:bg-gray-600">삭제</button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-gray-400 py-4 col-span-4">등록된 채널이 없습니다.</p>
                )}
            </div>
        </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="수집된 동영상 목록">
            <div className="flex justify-between items-center mb-4">
                 <button 
                    onClick={() => handleStartScraping()}
                    disabled={isAnyJobRunning || settings.youtubeScrapingChannels.length === 0}
                    className="px-4 py-2 font-bold bg-emerald-500 hover:bg-emerald-600 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                    <span>{isAnyJobRunning ? '수집 중...' : '모든 채널에서 동영상 수집 시작'}</span>
                </button>
                <button 
                    onClick={handleClearVideos}
                    className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md"
                >
                    목록 초기화
                </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left">
                <thead className="border-b border-gray-600 sticky top-0 bg-[#2a3142]">
                    <tr>
                    <th className="p-2 w-1/4">채널명</th>
                    <th className="p-2 w-3/4">제목</th>
                    </tr>
                </thead>
                <tbody>
                    {scrapedVideos.length > 0 ? (
                        scrapedVideos.map(video => (
                            <tr key={video.id} className="border-b border-gray-700 hover:bg-[#2f3b52]">
                            <td className="p-2 text-sm text-gray-400 truncate">{video.channelName}</td>
                            <td className="p-2">
                                <a 
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:underline hover:text-cyan-300 transition-colors"
                                    title={video.title}
                                >
                                    {video.title}
                                </a>
                            </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={2} className="p-4 text-center text-gray-500">수집된 동영상이 없습니다.</td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        </Card>

        <Card title="스크레이핑 진행 로그">
          <div className="space-y-2">
            {settings.youtubeScrapingChannels.map(channel => {
                const job = scrapingJobs[channel.id];
                if (!job) return null;
                return (
                    <details key={channel.id} className="bg-[#1a1f2e] p-3 rounded-md" open={job.status === 'scraping'}>
                        <summary className="font-semibold cursor-pointer flex justify-between items-center">
                            <span>{channel.name}</span>
                            <StatusBadge status={job.status} />
                        </summary>
                        {job.status === 'scraping' && (
                            <div className="w-full bg-gray-600 rounded-full h-2.5 my-2">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${job.progress}%` }}></div>
                            </div>
                        )}
                        <div className="mt-2 pl-2 border-l-2 border-gray-600 max-h-40 overflow-y-auto">
                            {job.logs.length > 0 ? (
                                job.logs.map((log, index) => (
                                    <p key={index} className="text-xs text-gray-400 font-mono">{log}</p>
                                ))
                            ) : (
                                <p className="text-xs text-gray-500">로그 대기중...</p>
                            )}
                        </div>
                    </details>
                )
            })}
           </div>
        </Card>
      </div>
    </div>
  );
};
