// File system service for saving and loading data
import { Script, Settings } from '../types';

// Get API base URL from settings or use relative path
const getApiUrl = (): string => {
    const settings = localStorage.getItem('aiShortsStudioSettings');
    if (settings) {
        try {
            const parsed = JSON.parse(settings);
            if (parsed.localServerUrl) {
                // Remove trailing slash if present
                return parsed.localServerUrl.replace(/\/$/, '');
            }
        } catch (e) {
            console.warn('Failed to parse settings:', e);
        }
    }
    // Use relative path if no server URL is configured
    return '';
};

// Convert data URL to Blob
const dataURLToBlob = (dataURL: string): Blob => {
    const parts = dataURL.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64 = parts[1];
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mime });
};

// Save image to server
export const saveImage = async (dataUrl: string, filename: string): Promise<string> => {
    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/save-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'image',
                filename,
                data: dataUrl
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save image: ${response.statusText}`);
        }

        const result = await response.json();
        return result.path;
    } catch (error) {
        console.error('Error saving image:', error);
        // Return the data URL directly if server save fails
        return dataUrl;
    }
};

// Save audio to server
export const saveAudio = async (dataUrl: string, filename: string): Promise<string> => {
    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/save-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'voice',
                filename,
                data: dataUrl
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save audio: ${response.statusText}`);
        }

        const result = await response.json();
        return result.path;
    } catch (error) {
        console.error('Error saving audio:', error);
        // Return the data URL directly if server save fails
        return dataUrl;
    }
};

// Save scenario to server
export const saveScenario = async (script: Script): Promise<void> => {
    try {
        const filename = `${script.id}_${Date.now()}.json`;
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/save-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'scenario',
                filename,
                data: JSON.stringify(script)
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save scenario: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error saving scenario:', error);
        // Just log the error, don't use localStorage
        throw error;
    }
};

// Save video to server
export const saveVideo = async (url: string, filename: string): Promise<string> => {
    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/save-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'mp4',
                filename,
                url // For videos, we might just save the URL
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save video: ${response.statusText}`);
        }

        const result = await response.json();
        return result.path;
    } catch (error) {
        console.error('Error saving video:', error);
        return url;
    }
};

// Save settings to JSON file
export const saveSettings = async (settings: Settings): Promise<void> => {
    try {
        // Save each setting category to separate JSON files
        const prompts = {
            scriptPrompt: settings.scriptPrompt,
            imageStyle: settings.imageStyle,
            imagePrompt: settings.imagePrompt,
            shellPrompt: settings.shellPrompt,
            youtubeTags: settings.youtubeTags,
            voiceModel: settings.voiceModel,
            imageGenerationMode: settings.imageGenerationMode
        };

        const apiKeys = {
            minimaxJwt: settings.minimaxJwt,
            googleApiKey: settings.googleApiKey,
            shotstackApiKey: settings.shotstackApiKey,
            shotstackUrl: settings.shotstackUrl,
            localServerUrl: settings.localServerUrl
        };

        const videoSettings = {
            backgroundImage: settings.backgroundImage || '',
            backgroundMusic: settings.backgroundMusic || '',
            subtitleFont: settings.subtitleFont || '',
            subtitleFontName: settings.subtitleFontName || '',
            subtitleStyle: settings.subtitleStyle || {
                fontSize: 24,
                fontColor: '#FFFFFF',
                fontBold: true,
                backgroundColor: '#000000',
                backgroundOpacity: 0.5
            }
        };

        // Remove localStorage usage completely

        // Try to save to server (port 5900)
        const response = await fetch('/api/save-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompts, apiKeys, videoSettings })
        });

        if (!response.ok) {
            throw new Error(`Server save failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }
};

// Load settings from storage
export const loadSettings = async (): Promise<Partial<Settings> | null> => {
    try {
        // First try to load from server
        const response = await fetch('/api/load-settings');
        if (response.ok) {
            const data = await response.json();
            return {
                ...data.prompts,
                ...data.apiKeys,
                ...data.videoSettings
            };
        }
    } catch (error) {
        console.error('Error loading settings from server:', error);
    }

    // No localStorage fallback anymore

    return null;
};

// Load asset from folder (header, bgm, font)
export const loadAsset = async (type: 'header' | 'bgm' | 'font', filename?: string): Promise<string | null> => {
    try {
        const response = await fetch(`/api/load-asset/${type}/${filename || 'default'}`);
        if (response.ok) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        }
    } catch (error) {
        console.error(`Error loading ${type} asset:`, error);
    }
    return null;
};