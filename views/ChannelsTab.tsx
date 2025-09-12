
import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import type { YouTubeChannel, YouTubeVideo } from '../types';

interface ChannelsTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
}

const mockChannels: YouTubeChannel[] = [
  { id: '1', url: 'https://www.youtube.com/@ChannelName' },
];

const mockVideos: YouTubeVideo[] = [
  { id: '1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', uploadDate: '2024-07-28', channelName: 'ChannelName', title: 'Sample Video Title 1' },
  { id: '2', url: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ', uploadDate: '2024-07-27', channelName: 'ChannelName', title: 'Another Interesting Video' },
];


export const ChannelsTab: React.FC<ChannelsTabProps> = ({ addLog }) => {
  const [channels, setChannels] = useState<YouTubeChannel[]>(mockChannels);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  useEffect(() => {
    addLog('채널 데이터 자동 업데이트 시작...');
    const interval = setInterval(() => {
      addLog('채널 및 비디오 목록을 새로고침합니다.');
      // Simulate fetching data
      setVideos(mockVideos);
    }, 300000); // 5 minutes

    // initial fetch
    setVideos(mockVideos);

    return () => clearInterval(interval);
  }, [addLog]);

  const handleAddChannel = () => {
    if (!newChannelUrl.trim() || !newChannelUrl.includes('youtube.com')) {
      addLog('유효한 YouTube 채널 URL을 입력하세요.', 'ERROR');
      return;
    }
    const newChannel: YouTubeChannel = { id: Date.now().toString(), url: newChannelUrl };
    setChannels([...channels, newChannel]);
    setNewChannelUrl('');
    addLog(`채널 추가됨: ${newChannelUrl}`, 'SUCCESS');
  };

  const handleAddVideo = () => {
     if (!newVideoUrl.trim() || !newVideoUrl.includes('youtube.com/watch?v=')) {
      addLog('유효한 YouTube 동영상 URL을 입력하세요.', 'ERROR');
      return;
    }
    const newVideo: YouTubeVideo = { id: Date.now().toString(), url: newVideoUrl, uploadDate: new Date().toISOString().split('T')[0], channelName: 'Manual Add', title: '수동 추가된 비디오' };
    setVideos([newVideo, ...videos]);
    setNewVideoUrl('');
    addLog(`개별 동영상 추가됨: ${newVideoUrl}`, 'SUCCESS');
  };

  return (
    <div className="space-y-6">
      <Card title="채널 관리" titleAction={<button className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">정기</button>}>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newChannelUrl}
            onChange={(e) => setNewChannelUrl(e.target.value)}
            placeholder="https://www.youtube.com/@ChannelName"
            className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button onClick={handleAddChannel} className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">채널 추가</button>
        </div>
        <div className="mt-4 space-y-2">
          {channels.length > 0 ? (
            channels.map(channel => <div key={channel.id} className="p-2 bg-[#1a1f2e] rounded-md">{channel.url}</div>)
          ) : (
            <p className="text-gray-400">등록된 채널이 없습니다.</p>
          )}
        </div>
      </Card>
      
      <Card title="동영상 목록" titleAction={<button className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">수동 업데이트</button>}>
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            placeholder="YouTube 동영상 URL 입력 (예: https://www.youtube.com/watch?v=...)"
            className="flex-grow p-2 bg-[#1a1f2e] border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button onClick={handleAddVideo} className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 rounded-md">개별 추가</button>
        </div>
        <div className="flex space-x-2 mb-4">
            <button className="px-4 py-2 text-sm font-semibold bg-gray-600 hover:bg-gray-700 rounded-md">전체</button>
            <button className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 rounded-md">전체 화면 삭제</button>
        </div>
        <table className="w-full text-left">
          <thead className="border-b border-gray-600">
            <tr>
              <th className="p-2">업로드 날짜</th>
              <th className="p-2">채널명</th>
              <th className="p-2">제목</th>
            </tr>
          </thead>
          <tbody>
            {videos.length > 0 ? (
              videos.map(video => (
                <tr key={video.id} className="border-b border-gray-700">
                  <td className="p-2 text-gray-400">{video.uploadDate}</td>
                  <td className="p-2">{video.channelName}</td>
                  <td className="p-2">{video.title}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-400">표시할 동영상이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
