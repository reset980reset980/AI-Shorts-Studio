export type Tab = '대본입력' | '유튜브채널' | '영상편집' | '프로젝트관리' | '유튜브 업로드' | '내정보';

export interface LogEntry {
  timestamp: string;
  type: 'INFO' | 'ERROR' | 'SUCCESS';
  message: string;
}

export interface Scene {
  id: number;
  time: string;
  script: string;
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number; // 음원 길이를 초 단위로 저장
  imageState: 'pending' | 'generating' | 'done' | 'error';
  audioState: 'pending' | 'generating' | 'done' | 'error';
}

export type ScriptStatus = 'pending' | 'rendering' | 'ready' | 'error';

export interface Script {
  id: string; // Added for list management
  channel: string;
  title: string;
  shorts_title: string;
  shorts_summary:string;
  scenes: Scene[];
  status: ScriptStatus;
  renderId?: string; // Shotstack 렌더링 ID
  videoUrl?: string; // 완성된 비디오 URL
}

export interface YouTubeChannel {
  id: string;
  name: string;
  url: string;
}

export interface YouTubeVideo {
  id: string;
  url: string;
  uploadDate: string;
  channelName: string;
  title: string;
}

export interface YouTubeChannelDetails {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  videoId: string; // Channel ID
  uploadtype: 'private' | 'public' | 'unlisted';
  email: string;
  refreshToken?: string;
}

export interface Settings {
  scriptPrompt: string;
  imageStyle: string;
  imagePrompt: string;
  shellPrompt: string;
  youtubeTags: string;
  minimaxJwt: string;
  voiceModel: string;
  googleApiKey: string;
  shotstackApiKey: string;
  shotstackUrl: string;
  backgroundImage?: string; // Data URL for the image
  backgroundMusic?: string; // Data URL for the audio
  subtitleFont?: string; // Data URL for the font
  subtitleFontName?: string; // Font family name
  imageGenerationMode: 'sequential' | 'parallel';
  youtube_channels: YouTubeChannelDetails[];
  youtubeScrapingChannels: YouTubeChannel[];
}
