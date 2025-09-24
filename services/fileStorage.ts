// File storage utilities for Electron app
import { Script } from '../types/Script';

// Electron에서 Node.js의 fs와 path를 사용
let fs: any = null;
let path: any = null;
let app: any = null;
let Buffer: any = null;

// Electron 환경 체크 및 모듈 로드
if (typeof window !== 'undefined') {
  const electronWindow = window as any;

  console.log('🔍 Checking Electron environment...', {
    hasRequire: !!electronWindow.require,
    hasElectron: !!electronWindow.electron,
    userAgent: navigator.userAgent
  });

  if (electronWindow.require) {
    try {
      fs = electronWindow.require('fs');
      path = electronWindow.require('path');
      Buffer = electronWindow.require('buffer').Buffer;
      const remote = electronWindow.require('@electron/remote');
      app = remote ? remote.app : null;

      // 프로젝트 경로 설정
      // Electron에서 실행 중이면 앱 경로를 기준으로 data 폴더 찾기
      if (app) {
        // 개발 모드: 프로젝트 루트 사용
        // 프로덕션: exe 파일 위치 기준
        const isDev = !app.isPackaged;
        if (isDev) {
          // 개발 모드에서는 프로젝트 루트 직접 사용
          console.log('📁 Development mode - using project root');
        } else {
          // 프로덕션 모드에서는 exe 파일 위치 사용
          console.log('📦 Production mode - using app path');
        }
      }

      // 실제 파일 시스템 테스트 - 프로젝트 data 폴더에서
      if (fs && path) {
        const projectDataPath = path.join(process.cwd(), 'data', 'test.txt');
        try {
          // data 폴더 생성
          const dataDir = path.join(process.cwd(), 'data');
          if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
          }

          fs.writeFileSync(projectDataPath, 'test');
          fs.unlinkSync(projectDataPath);
          console.log('✅ File system write test successful in project data folder!');
        } catch (e) {
          console.error('❌ File system write test failed:', e);
        }
      }

      console.log('✓ Electron modules loaded:', {
        fs: !!fs,
        path: !!path,
        Buffer: !!Buffer,
        app: !!app,
        cwd: process.cwd()
      });
    } catch (error) {
      console.error('✗ Failed to load Electron modules:', error);
    }
  } else {
    console.warn('⚠ window.require not available. Running in browser mode.');
    console.log('💡 To enable file system access, ensure:');
    console.log('   1. Running via "npm run electron" (not just "npm run dev")');
    console.log('   2. nodeIntegration: true in electron.js');
    console.log('   3. contextIsolation: false in electron.js');
  }
}

// Get base data directory
const getDataPath = () => {
  if (path && fs) {
    // 항상 프로젝트 루트의 data 폴더 사용
    // Electron과 Node.js 모두 동일한 경로

    // Windows에서 명확한 경로 설정
    // D:\ai-shorts-studio\AI-Shorts-Studio\data
    const projectRoot = 'D:\\ai-shorts-studio\\AI-Shorts-Studio';
    const dataPath = path.join(projectRoot, 'data');

    console.log('📂 Using project data path:', dataPath);

    // data 폴더가 없으면 생성
    if (!fs.existsSync(dataPath)) {
      try {
        fs.mkdirSync(dataPath, { recursive: true });
        console.log('✅ Created data directory:', dataPath);
      } catch (error) {
        console.error('❌ Failed to create data directory:', error);
      }
    }

    return dataPath;
  } else {
    // 브라우저 환경 - 파일 저장 불가
    console.error('❌ File system not available - cannot save files locally');
    console.log('💡 Run with Electron to enable local file storage');
    return null;
  }
};

// Ensure directory exists
const ensureDir = (dirPath: string) => {
  if (fs) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Created directory:', dirPath);
      }
    } catch (error) {
      console.error('Failed to create directory:', dirPath, error);
    }
  }
};

// Generate unique ID
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Save script to file
export const saveScript = (script: Script): string => {
  const dataPath = getDataPath();
  if (!fs || !path || !dataPath) {
    console.error('Cannot save script - file system not available');
    return script.id;
  }

  const scriptPath = path.join(dataPath, 'scripts');
  ensureDir(scriptPath);

  const scriptId = script.id || generateId();
  const fileName = `${scriptId}.json`;
  const filePath = path.join(scriptPath, fileName);

  fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf8');
  console.log('Script saved to:', filePath);

  return scriptId;
};

// Load all scripts
export const loadScripts = (): Script[] => {
  const dataPath = getDataPath();
  if (!fs || !path || !dataPath) {
    console.error('Cannot load scripts - file system not available');
    return [];
  }
  const scriptPath = path.join(dataPath, 'scripts');
  ensureDir(scriptPath);

  const scripts: Script[] = [];
  const files = fs.readdirSync(scriptPath);

  files.forEach((file: string) => {
    if (file.endsWith('.json')) {
      const filePath = path.join(scriptPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const script = JSON.parse(content);
        scripts.push(script);
      } catch (error) {
        console.error('Error parsing script file:', file, error);
      }
    }
  });

  return scripts.sort((a, b) => {
    // Sort by creation date (newest first)
    const dateA = a.id ? parseInt(a.id.split('_')[0]) : 0;
    const dateB = b.id ? parseInt(b.id.split('_')[0]) : 0;
    return dateB - dateA;
  });
};

// Load single script
export const loadScript = (scriptId: string): Script | null => {
  if (!fs || !path) {
    const scriptData = localStorage.getItem(`script_${scriptId}`);
    return scriptData ? JSON.parse(scriptData) : null;
  }

  const dataPath = getDataPath();
  const filePath = path.join(dataPath, 'scripts', `${scriptId}.json`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  return null;
};

// Save image from base64
export const saveImage = (base64Data: string, scriptId: string, sceneId: number): string => {
  const dataPath = getDataPath();
  if (!fs || !path || !dataPath) {
    console.error('Cannot save image - file system not available');
    return base64Data; // 원본 데이터 반환
  }
  const imagePath = path.join(dataPath, 'images', scriptId);
  ensureDir(imagePath);

  // Remove data URL prefix if exists
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const fileName = `scene_${sceneId}.jpg`;
  const filePath = path.join(imagePath, fileName);

  // Convert base64 to buffer and save
  if (!Buffer) {
    console.error('Buffer not available, cannot save image');
    return base64Data;
  }
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buffer);
  console.log('Image saved to:', filePath);

  return filePath;
};

// Save audio from URL or base64
export const saveAudio = async (audioUrl: string, scriptId: string, sceneId: number): Promise<string> => {
  const dataPath = getDataPath();
  if (!fs || !path || !dataPath) {
    console.error('Cannot save audio - file system not available');
    return audioUrl; // 원본 URL 반환
  }
  const audioPath = path.join(dataPath, 'audio', scriptId);
  ensureDir(audioPath);

  const fileName = `scene_${sceneId}.mp3`;
  const filePath = path.join(audioPath, fileName);

  if (audioUrl.startsWith('data:')) {
    // Base64 data URL
    if (!Buffer) {
      console.error('Buffer not available, cannot save audio');
      return audioUrl;
    }
    const base64 = audioUrl.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
  } else {
    // External URL - download and save
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      console.error('Error downloading audio:', error);
      throw error;
    }
  }

  console.log('Audio saved to:', filePath);
  return filePath;
};

// Save video URL reference
export const saveVideo = (videoUrl: string, scriptId: string): string => {
  if (!fs || !path) {
    console.warn('File system not available, using localStorage');
    localStorage.setItem(`video_${scriptId}`, videoUrl);
    return scriptId;
  }

  const dataPath = getDataPath();
  const videoPath = path.join(dataPath, 'videos');
  ensureDir(videoPath);

  const fileName = `${scriptId}.json`;
  const filePath = path.join(videoPath, fileName);

  const videoData = {
    id: scriptId,
    url: videoUrl,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(videoData, null, 2), 'utf8');
  console.log('Video reference saved to:', filePath);

  return scriptId;
};

// Create project metadata
export const saveProject = (project: {
  id: string;
  title: string;
  scriptId: string;
  createdAt: string;
  status: string;
  thumbnail?: string;
}): void => {
  if (!fs || !path) {
    localStorage.setItem(`project_${project.id}`, JSON.stringify(project));
    return;
  }

  const dataPath = getDataPath();
  const projectPath = path.join(dataPath, 'projects');
  ensureDir(projectPath);

  const fileName = `${project.id}.json`;
  const filePath = path.join(projectPath, fileName);

  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
  console.log('Project saved to:', filePath);
};

// Load all projects for listing
export const loadProjects = (): any[] => {
  if (!fs || !path) {
    const projects: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('project_')) {
        const projectData = localStorage.getItem(key);
        if (projectData) {
          projects.push(JSON.parse(projectData));
        }
      }
    }
    return projects;
  }

  const dataPath = getDataPath();
  const projectPath = path.join(dataPath, 'projects');
  ensureDir(projectPath);

  const projects: any[] = [];
  const files = fs.readdirSync(projectPath);

  files.forEach((file: string) => {
    if (file.endsWith('.json')) {
      const filePath = path.join(projectPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      try {
        const project = JSON.parse(content);
        projects.push(project);
      } catch (error) {
        console.error('Error parsing project file:', file, error);
      }
    }
  });

  return projects.sort((a, b) => {
    // Sort by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

// Delete project and all related files
export const deleteProject = (projectId: string): void => {
  if (!fs || !path) {
    // Remove from localStorage
    localStorage.removeItem(`project_${projectId}`);
    const scriptData = localStorage.getItem(`script_${projectId}`);
    if (scriptData) {
      const script = JSON.parse(scriptData);
      script.scenes?.forEach((scene: any, index: number) => {
        localStorage.removeItem(`image_${projectId}_${index + 1}`);
        localStorage.removeItem(`audio_${projectId}_${index + 1}`);
      });
      localStorage.removeItem(`script_${projectId}`);
      localStorage.removeItem(`video_${projectId}`);
    }
    return;
  }

  const dataPath = getDataPath();

  // Delete project file
  const projectFile = path.join(dataPath, 'projects', `${projectId}.json`);
  if (fs.existsSync(projectFile)) {
    fs.unlinkSync(projectFile);
  }

  // Delete script file
  const scriptFile = path.join(dataPath, 'scripts', `${projectId}.json`);
  if (fs.existsSync(scriptFile)) {
    fs.unlinkSync(scriptFile);
  }

  // Delete image folder
  const imageFolder = path.join(dataPath, 'images', projectId);
  if (fs.existsSync(imageFolder)) {
    fs.rmSync(imageFolder, { recursive: true, force: true });
  }

  // Delete audio folder
  const audioFolder = path.join(dataPath, 'audio', projectId);
  if (fs.existsSync(audioFolder)) {
    fs.rmSync(audioFolder, { recursive: true, force: true });
  }

  // Delete video reference
  const videoFile = path.join(dataPath, 'videos', `${projectId}.json`);
  if (fs.existsSync(videoFile)) {
    fs.unlinkSync(videoFile);
  }

  console.log('Project deleted:', projectId);
};

// Get file path for saved content
export const getFilePath = (type: 'image' | 'audio' | 'video', scriptId: string, sceneId?: number): string => {
  if (!fs || !path) {
    if (type === 'video') {
      return localStorage.getItem(`video_${scriptId}`) || '';
    }
    const key = `${type}_${scriptId}_${sceneId}`;
    return localStorage.getItem(key) || '';
  }

  const dataPath = getDataPath();

  switch (type) {
    case 'image':
      return path.join(dataPath, 'images', scriptId, `scene_${sceneId}.jpg`);
    case 'audio':
      return path.join(dataPath, 'audio', scriptId, `scene_${sceneId}.mp3`);
    case 'video':
      const videoFile = path.join(dataPath, 'videos', `${scriptId}.json`);
      if (fs.existsSync(videoFile)) {
        const content = fs.readFileSync(videoFile, 'utf8');
        const videoData = JSON.parse(content);
        return videoData.url;
      }
      return '';
    default:
      return '';
  }
};