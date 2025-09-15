
import React, { useState } from 'react';
import { Card } from '../components/Card';
import type { Settings, YouTubeChannel, YouTubeVideo } from '../types';
import { delay } from '../services/api';

interface ChannelsTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

export const ChannelsTab: React.FC<ChannelsTabProps> = ({ addLog, settings, updateSettings }) => {
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  
  const [scrapedVideos, setScrapedVideos] = useState<YouTubeVideo[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingLogs, setScrapingLogs] = useState<string[]>([]);
  
  const addScrapingLog = (message: string) => {
    setScrapingLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

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

  const handleStartScraping = async () => {
    setIsScraping(true);
    setScrapingLogs([]);
    setScrapedVideos([]);
    addScrapingLog('데이터 수집 프로세스를 시작합니다.');

    try {
        addScrapingLog('Puppeteer 브라우저를 실행합니다... (시뮬레이션)');
        await delay(1000);
        
        let allVideos: Omit<YouTubeVideo, 'id' | 'uploadDate'>[] = [];

        for (const channel of settings.youtubeScrapingChannels) {
            addScrapingLog(`[${channel.name}] 채널 페이지로 이동 중: ${channel.url}`);
            await delay(1500);

            addScrapingLog('동영상 탭을 클릭합니다.');
            await delay(500);

            for (let i = 1; i <= 5; i++) {
                addScrapingLog(`페이지 끝까지 스크롤하는 중... (${i}/5)`);
                await delay(300);
            }

            addScrapingLog('페이지 끝에 도달. page.evaluate()를 사용하여 데이터 추출을 시작합니다.');
            await delay(1000);
            
            const MOCK_VIDEO_COUNT = Math.floor(Math.random() * 15) + 5; // 5-20 videos
            addScrapingLog(`'a#video-title-link' 선택자로 동영상 ${MOCK_VIDEO_COUNT}개를 찾았습니다.`);
            
            for (let i=0; i < MOCK_VIDEO_COUNT; i++) {
                 allVideos.push({
                    title: `[${channel.name}]의 재미있는 영상 #${i + 1}`,
                    channelName: channel.name,
                    url: `${channel.url}/videos/mock_${i}`
                });
            }
            await delay(500);
        }

        addScrapingLog('모든 채널 탐색 완료. browser.close()를 호출하여 브라우저를 종료합니다.');
        await delay(500);

        addScrapingLog(`총 ${allVideos.length}개의 동영상 수집 완료. 중복 데이터 제거를 시작합니다.`);
        await delay(500);

        const uniqueVideosMap = new Map<string, Omit<YouTubeVideo, 'id' | 'uploadDate'>>();
        allVideos.forEach(video => {
            uniqueVideosMap.set(video.title, video); // Simple dedupe by title for simulation
        });

        const finalVideos = Array.from(uniqueVideosMap.values()).map((v, i) => ({
            ...v,
            id: Date.now().toString() + i,
            uploadDate: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        }));
        
        addScrapingLog(`중복 제거 후 ${finalVideos.length}개의 고유 동영상을 확보했습니다.`);
        setScrapedVideos(finalVideos);
        addScrapingLog('프로세스가 성공적으로 완료되었습니다.');
        addLog('유튜브 채널 스크레이핑이 완료되었습니다.', 'SUCCESS');

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        addScrapingLog(`오류 발생: ${msg}`);
        addLog('스크레이핑 중 오류가 발생했습니다.', 'ERROR');
    } finally {
        setIsScraping(false);
        addScrapingLog('finally 블록 실행: 모든 리소스가 정리되었습니다.');
    }
  };

  const handleClearVideos = () => {
    setScrapedVideos([]);
    addLog('수집된 동영상 목록이 초기화되었습니다.', 'INFO');
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                {settings.youtubeScrapingChannels.length > 0 ? (
                    settings.youtubeScrapingChannels.map(channel => (
                    <div key={channel.id} className="flex justify-between items-center p-2 bg-[#1a1f2e] rounded-md">
                        <div>
                            <p className="font-semibold">{channel.name}</p>
                            <p className="text-xs text-gray-400">{channel.url}</p>
                        </div>
                        <button onClick={() => handleDeleteChannel(channel.id)} className="px-2 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 rounded-md">삭제</button>
                    </div>
                    ))
                ) : (
                    <p className="text-center text-gray-400 py-4">등록된 채널이 없습니다.</p>
                )}
            </div>
        </Card>
        
        <Card title="데이터 수집 (Puppeteer 시뮬레이션)">
            <button 
                onClick={handleStartScraping}
                disabled={isScraping || settings.youtubeScrapingChannels.length === 0}
                className="w-full px-4 py-2 mb-4 font-bold bg-emerald-500 hover:bg-emerald-600 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
                {isScraping && <LoadingSpinner />}
                <span>{isScraping ? '수집 중...' : '모든 채널에서 동영상 수집 시작'}</span>
            </button>
            <div className="bg-[#1a1f2e] p-2 rounded-md h-64 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                    {scrapingLogs.join('\n')}
                </pre>
            </div>
        </Card>
       </div>
      
      <Card title="수집된 동영상 목록">
        <div className="flex justify-end mb-4">
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
                    <tr key={video.id} className="border-b border-gray-700 hover:bg-[#374151]">
                    <td className="p-2 text-gray-400">{video.channelName}</td>
                    <td className="p-2">{video.title}</td>
                    </tr>
                ))
                ) : (
                <tr>
                    <td colSpan={2} className="p-8 text-center text-gray-500">
                        {isScraping ? "데이터 수집 중..." : "수집된 동영상이 없습니다. '데이터 수집'을 시작해주세요."}
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </Card>
    </div>
  );
};
