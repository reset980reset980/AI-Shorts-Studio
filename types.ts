export type Tab = '대본입력' | '유튜브채널' | '영상편집' | '유튜브 업로드' | '내정보';

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
  imageState: 'pending' | 'generating' | 'done' | 'error';
  audioState: 'pending' | 'generating' | 'done' | 'error';
}

export interface Script {
  id: string; // Added for list management
  channel: string;
  title: string;
  shorts_title: string;
  shorts_summary: string;
  scenes: Scene[];
}

export interface YouTubeChannel {
  id: string;
  url: string;
}

export interface YouTubeVideo {
  id: string;
  url: string;
  uploadDate: string;
  channelName: string;
  title: string;
}

export interface Settings {
  scriptPrompt: string;
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
}