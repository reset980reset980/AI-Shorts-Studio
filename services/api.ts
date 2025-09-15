import { GoogleGenAI, Type } from "@google/genai";
import type { Script, Settings, Scene } from '../types';
import { GEMINI_API_KEY, MINIMAX_JWT_TOKEN, SHOTSTACK_API_KEY } from '../env';

// Helper to simulate network delay
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- Settings Management ---
let mockSettings: Settings = {
  scriptPrompt: `당신은 1인칭 사연 각색을 전문으로 하는 '유튜브 쇼츠 작가'입니다. 시청자가 완전히 몰입할 수 있도록, 사용자가 제공한 원문({{story_content}})을 정확히 근거로 하여 1~3분 길이의 한국어 쇼츠 대본을 작성하세요. 반드시 1인칭(주인공=나) 시점으로 쓰고, 원문 외의 새로운 사건/인물/설정을 추가하지 마세요. 원문에 없는 상상 요소 금지. 다만 원문의 디테일을 더 선명하게 만들기 위한 표현(묘사 보강)은 허용됩니다.

[입력 정보]
- 사연 제목: {{title}}
- 사연 전체 내용: {{story_content}}
- 원하는 길이: {{desired_length}} (예: "2분", "짧게" 등)
- 콘텐츠 톤/무드: 몰입감 있고 흥미진진한
- 핵심 강조: 갈등, 반전, 감정적 클라이맥스

[작성 지침]
1) 철저한 원문 준수: {{story_content}}에 명시된 사건/감정/디테일만 사용. 외부 예시/상상 금지.
2) 1인칭 시점 고정: 주인공 '나'의 관점으로 감정/사건을 생생하게 묘사.
3) 분량/구간: 사연 복잡도에 따라 'shorts_script' 항목 수를 유동적으로 생성하되, 
   - 복잡한 사연: 최소 10개,
   - 단순한 사연: 최소 8개 권장.
4) 각 스크립트 문장 길이: 20~60자 내 (자연스러운 한글 문장).
5) 전체 길이: 최종 'total_duration'은 1~3분 범위에서 합리적으로 산정.
6) 타임코드: 00:00부터 시작, 구간당 10~20초 범위로 자연스럽게 분할.
7) 이미지 프롬프트('imagePrompt') 생성: 이 항목은 **유일한 예외**로서, 지침 1)의 '원문 준수' 규칙을 넘어서 **상상력을 발휘**해야 합니다. 각 'script' 문장에 대응하는 시각적 장면을 구체적으로 묘사하세요. 인물의 표정, 행동, 배경, 구도, 분위기 등을 상세하게 기술하여, AI 이미지 생성기가 풍부한 그림을 그릴 수 있도록 해야 합니다. 각 프롬프트는 반드시 "{{image_style}} | 그림설명 : "으로 시작해야 합니다.

[출력 형식]
- 반드시 아래 JSON 구조만 출력하세요. JSON 외의 텍스트/코드펜스 금지.
{
  "shorts_title": "[{{title}}을 바탕으로 한 호기심 자극형 한국어 제목, 50자 이내]",
  "shorts_summary": "[{{story_content}}의 핵심 갈등/감정을 한 문장으로 요약]",
  "total_duration": "[예상 영상 길이, 예: '02:30']",
  "shorts_script": [
    {
      "start_time": "00:00",
      "end_time": "00:15",
      "section_type": "기_도입_1",
      "script": "[원문 기반, 1인칭 한글 문장 20~60자]",
      "imagePrompt": "{{image_style}} | 그림설명 : [스크립트 내용에 맞는 상세한 장면 묘사]"
    }
    // 이후 동일 구조로 7~20개 내외
  ]
}

[검증]
- JSON 유효성 검증에 통과하도록 작성하세요.
- 'shorts_script' 배열은 최소 8개 이상 권장.
- 각 구간 'script'는 서로 연결되어 전체 흐름이 일관되게 전개되도록 하세요.`,
  imageStyle: "anime style digital painting, soft realistic illustration, 텍스트는 제외해.",
  imagePrompt: `당신은 유튜브 쇼츠용 장면 일러스트 프롬프트 엔지니어입니다. 아래 입력(원문과 이미 확정된 대본 구간)을 근거로, 각 스크립트에 대응하는 이미지 프롬프트를 생성하세요. 출력은 반드시 JSON만 포함하며, 각 항목은 대본의 순서와 개수를 정확히 일치시켜야 합니다.

[입력]
- 제목: {{title}}
- 원문: {{story_content}}
- 스크립트 목록(JSON): {{shorts_script_json}}

[엄수 규칙]
1) 원문 준수: {{story_content}}의 사건/감정/디테일 범위를 벗어나지 마세요. 새로운 설정/인물/장소 추가 금지.
2) 텍스트 금지: 그림 안에 글자/자막/타이포그래피를 넣지 마세요.
3) 접두사 강제: 모든 프롬프트는 아래 접두사로 시작해야 합니다.
   "{{image_style}} | 그림설명 : "
4) 1인칭 맥락 반영: 대본의 주어가 '나'인 점을 감안해, '나'의 감정과 시점이 드러나도록 장면을 구성.
5) 인물 성별/수(원문 범위 내): 원문에 성별/역할이 드러나면 반영(예: 여성 1인, 남성 2인 등). 불명확 시 중립적 표현 또는 실루엣.
6) 프레이밍: 쇼츠(세로 9:16)에 적합한 근/중/원경 구도, 클로즈업/오버숄더/실루엣 등 시네마틱 프레이밍 제안 가능.
7) 스타일 일관성: 시리즈 전체가 한 세트로 보이도록 조도/색감/브러시 질감이 크게 튀지 않게.
8) 금지 요소: 폭력/선정/혐오/식별 가능한 실제 로고/브랜드.

[출력 형식]
- 아래 JSON 구조만 출력하세요. 'image_prompts' 항목 수는 'shorts_script' 개수와 동일해야 합니다.
{
  "image_prompts": [
    { "scriptNumber": 1, "image_prompt": "{{image_style}} | 그림설명 : [대본 1 장면 설명]" }
    // 이후 동일 구조로 N개
  ]
}

[작성 팁]
- 각 장면은 해당 구간의 감정 변화(불안→의심→확신→클라이맥스→여운)를 색/광원/구도로 전달.
- 인물의 표정/제스처/실내외 분위기/시간대 등을 명시적으로 기술(단, 원문 범위 내).
- 과도한 소품/지명/브랜드 명시는 피하고, 상징/메타포는 원문 범위에서만 사용.`,
  shellPrompt: "당신은 바이럴 유튜브 쇼츠 제목 전문가 카피라이터입니다. 주어진 텍스트를 기반으로, 시선을 사로잡는 간결한 한국어 제목을 하나 만들어주세요. 제목은 50자 이하여야 합니다. 추가적인 설명, 따옴표 없이 제목만 출력하세요.",
  youtubeTags: "#사주 #관성 #작명 #역술 #궁합 #택일 #개명 #철학관 #취원",
  minimaxJwt: MINIMAX_JWT_TOKEN,
  voiceModel: "Korean_SweetGirl",
  googleApiKey: GEMINI_API_KEY,
  shotstackApiKey: SHOTSTACK_API_KEY,
  shotstackUrl: "https://api.shotstack.io/stage",
  imageGenerationMode: 'sequential', // Default to safe mode
  youtube_channels: [
    {
      name: "성이",
      clientId: "671266928842-st30c7v0fre9cgs08j92707nnefj77fh.apps.googleusercontent.com",
      clientSecret: "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",
      redirectUri: "http://127.0.0.1:5900/oauth2callback",
      videoId: "UCZJ2PsN98SUAR3PrReyF43Q",
      uploadtype: "private",
      email: "test",
      refreshToken: "1//0eUyq0XNIblTpCgYIARAAGA4SNwF-L9IrkakX4lYAxHVp2WPjflgC7lbPP04zCMCV_8-eqtgX7lmNaK_XhNGL0oheptmhjKxSFkA"
    }
  ]
};

export const getSettings = async (): Promise<Settings> => {
  console.log("Fetching settings from external source...");
  await delay(200);
  return { ...mockSettings };
};

export const saveSettings = async (settingsToSave: Partial<Settings>): Promise<void> => {
  console.log("Saving settings to external source...", settingsToSave);
  mockSettings = { ...mockSettings, ...settingsToSave };
  await delay(200);
};


// --- AI Services ---

export const correctTextWithPrompt = async (text: string, systemInstruction: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
      throw new Error("Google API Key가 설정되지 않았습니다.");
    }
    console.log('Correcting text with real AI call...');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: text,
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return response.text;
};

// Gemini API for script correction and generation
export const generateScriptFromText = async (rawText: string, shortsTitle: string, settings: Settings): Promise<Omit<Script, 'id' | 'status'>> => {
    if (!settings.googleApiKey) {
      throw new Error("Google API Key가 설정되지 않았습니다.");
    }
    console.log('Generating script with real AI call...');
    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

    // Replace placeholders in the prompt
    const filledPrompt = settings.scriptPrompt
      .replace(/{{story_content}}/g, rawText)
      .replace(/{{title}}/g, rawText.substring(0, 20)) // Use a snippet as a placeholder title
      .replace(/{{desired_length}}/g, "1-3분")
      .replace(/{{image_style}}/g, settings.imageStyle);


    const schema = {
        type: Type.OBJECT,
        properties: {
            shorts_title: { type: Type.STRING, description: "A shorter, punchier title suitable for YouTube Shorts." },
            shorts_summary: { type: Type.STRING, description: "A brief, one or two sentence summary of the story." },
            total_duration: { type: Type.STRING, description: "The total estimated duration of the video, e.g., '02:30'." },
            shorts_script: {
                type: Type.ARRAY,
                description: "An array of scenes for the script.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        start_time: { type: Type.STRING },
                        end_time: { type: Type.STRING },
                        section_type: { type: Type.STRING },
                        script: { type: Type.STRING, description: "The dialogue or narration for this scene." },
                        imagePrompt: { type: Type.STRING, description: "A detailed prompt for an AI image generator to create a visual for this scene. It should start with the required style prefix followed by a description." },
                    },
                     required: ["start_time", "end_time", "section_type", "script", "imagePrompt"]
                },
            },
        },
        required: ["shorts_title", "shorts_summary", "total_duration", "shorts_script"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: filledPrompt,
        config: {
            responseMimeType: "application/json",
            // The schema definition is complex, so we will parse manually.
            // responseSchema: schema,
        },
    });
    
    let jsonResponse;
    try {
        // Attempt to parse the JSON, cleaning up potential markdown fences
        const cleanedText = response.text.replace(/^```json\s*|```\s*$/g, '').trim();
        jsonResponse = JSON.parse(cleanedText);
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", response.text);
        throw new Error("AI 응답을 JSON 형식으로 파싱하는 데 실패했습니다. AI가 지정된 형식을 따르지 않았을 수 있습니다.");
    }
    
    // Manual validation
    if (!jsonResponse.shorts_script || !Array.isArray(jsonResponse.shorts_script)) {
         throw new Error("AI 응답에 'shorts_script' 배열이 포함되어 있지 않습니다.");
    }

    const scriptWithState: Omit<Script, 'id' | 'status'> = {
        channel: 'UNKNOWN',
        title: shortsTitle, // Use the user-provided title for the main title
        shorts_title: jsonResponse.shorts_title || shortsTitle, // Use generated shorts title, fallback to main
        shorts_summary: jsonResponse.shorts_summary || 'No summary generated.',
        scenes: jsonResponse.shorts_script.map((scene: any, index: number): Scene => ({
            id: index + 1,
            time: `${scene.start_time} - ${scene.end_time}`,
            script: scene.script,
            imagePrompt: scene.imagePrompt,
            imageUrl: undefined,
            audioUrl: undefined,
            imageState: 'pending',
            audioState: 'pending',
        })),
    };

    return scriptWithState;
};

export const regenerateImagePrompts = async (script: Script, settings: Settings): Promise<string[]> => {
    if (!settings.googleApiKey) {
        throw new Error("Google API Key가 설정되지 않았습니다.");
    }
    console.log('Regenerating image prompts with real AI call...');
    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

    const shortsScriptJson = JSON.stringify(
        script.scenes.map(s => ({ scriptNumber: s.id, script: s.script }))
    );
    
    // Use summary and joined script text as a proxy for the original story content
    const storyContent = `${script.shorts_summary}\n\n${script.scenes.map(s => s.script).join('\n')}`;

    const filledPrompt = settings.imagePrompt
      .replace(/{{title}}/g, script.title)
      .replace(/{{story_content}}/g, storyContent)
      .replace(/{{shorts_script_json}}/g, shortsScriptJson)
      .replace(/{{image_style}}/g, settings.imageStyle);

    const schema = {
        type: Type.OBJECT,
        properties: {
            image_prompts: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        scriptNumber: { type: Type.INTEGER },
                        image_prompt: { type: Type.STRING },
                    },
                    required: ["scriptNumber", "image_prompt"],
                }
            }
        },
        required: ["image_prompts"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: filledPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    const jsonResponse = JSON.parse(response.text);
    
    if (!jsonResponse.image_prompts || !Array.isArray(jsonResponse.image_prompts)) {
        throw new Error("AI did not return image prompts in the expected format.");
    }
    
    // Sort by scriptNumber to ensure order is correct, then extract the prompt string.
    const sortedPrompts = jsonResponse.image_prompts.sort((a: any, b: any) => a.scriptNumber - b.scriptNumber);
    return sortedPrompts.map((p: any) => p.image_prompt);
};


export const generateImageForScene = async (prompt: string, apiKey: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("Google API Key가 설정되지 않았습니다.");
  }
  console.log('Generating image with real AI call (imagen-4.0-generate-001)...');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16', // Changed to vertical for shorts
      },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("AI가 이미지를 생성하지 못했습니다.");
  }

  const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
  return `data:image/jpeg;base64,${base64ImageBytes}`;
};

export const generateImageSuggestions = async (prompt: string, apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("Google API Key가 설정되지 않았습니다.");
  }
  console.log('Generating 4 image suggestions with real AI call (imagen-4.0-generate-001)...');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 4,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16', // Changed to vertical for shorts
      },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("AI가 이미지를 생성하지 못했습니다.");
  }
  
  return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
};


/**
 * Converts a hex string to a Uint8Array.
 * @param hex The hex string to convert.
 * @returns A Uint8Array containing the binary data.
 */
const hexToUint8Array = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
};

const getAudioDuration = (audioUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
            resolve(audio.duration);
        };
        audio.onerror = (e) => {
            reject(`Error loading audio to get duration: ${e}`);
        };
        audio.preload = 'metadata';
        audio.src = audioUrl;
    });
};


export const generateAudioForScene = async (text: string, jwtToken: string, voiceModel: string): Promise<{ audioUrl: string; duration: number; }> => {
    if (!jwtToken) {
        throw new Error("MiniMax JWT Token이 설정되지 않았습니다. '내정보' 탭에서 설정해주세요.");
    }
    
    console.log(`Generating audio with MiniMax T2A v2 API (Model: ${voiceModel})...`);

    const getGroupIdFromJwt = (token: string): string | null => {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.GroupID || null;
        } catch (e) {
            console.error("Failed to decode JWT to find GroupID", e);
            return null;
        }
    };

    const groupId = getGroupIdFromJwt(jwtToken);
    if (!groupId) {
        throw new Error("JWT 토큰에서 GroupID를 추출할 수 없습니다. 유효한 토큰인지 확인해주세요.");
    }

    const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${groupId}`;
    
    const requestBody = {
        model: "speech-2.5-hd-preview",
        text: text,
        stream: false,
        voice_setting: {
            voice_id: voiceModel,
            speed: 1.0,
            vol: 1.0,
            pitch: 0
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1
        },
        language_boost: "Korean",
        output_format: "hex"
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`MiniMax API HTTP Error (${response.status}): ${errorBody}`);
    }

    const jsonResponse = await response.json();

    if (jsonResponse.base_resp?.status_code !== 0) {
        throw new Error(`MiniMax API Logic Error: ${jsonResponse.base_resp?.status_msg || 'Unknown error'}`);
    }

    if (!jsonResponse.data?.audio) {
        throw new Error("MiniMax API did not return audio data in the expected format.");
    }

    const hexAudioData = jsonResponse.data.audio;
    const audioBytes = hexToUint8Array(hexAudioData);
    const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    try {
        const duration = await getAudioDuration(audioUrl);
        return { audioUrl, duration };
    } catch (error) {
        console.error("Could not get audio duration", error);
        URL.revokeObjectURL(audioUrl); // Clean up if duration measurement fails
        throw new Error("음원 파일의 길이를 측정하는 데 실패했습니다.");
    }
};

// --- Shotstack Video Rendering ---

interface ShotstackRenderResponse {
    success: boolean;
    message: string;
    response: {
        id: string;
        message: string;
    };
}

interface ShotstackStatusResponse {
    success: boolean;
    message: string;
    response: {
        id: string;
        status: 'submitted' | 'queued' | 'rendering' | 'done' | 'failed';
        url?: string;
        error?: string;
    };
}

// Helper to convert dataURL/blobURL to a File object for uploading
const urlToBlob = (url: string) => fetch(url).then(res => res.blob());

const uploadAsset = async (url: string, filename: string, settings: Settings): Promise<string> => {
    const blob = await urlToBlob(url);
    const formData = new FormData();
    formData.append('data', blob, filename);
    
    const response = await fetch(`${settings.shotstackUrl}/assets`, {
        method: 'POST',
        headers: {
            'x-api-key': settings.shotstackApiKey,
        },
        body: formData,
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shotstack 에셋 업로드 실패 (${response.status}): ${errorBody}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.response.url) {
        throw new Error(`Shotstack 에셋 업로드 응답 오류: ${result.message}`);
    }
    
    return result.response.url;
};

// Helper to format time for SRT files
const formatSrtTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000).toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

// Generates SRT content from scenes
const generateSrtContent = (scenes: Scene[]): string => {
    let srt = '';
    let currentTime = 0;
    
    scenes.forEach((scene, index) => {
        if (!scene.duration) return;

        const start = currentTime;
        const end = currentTime + scene.duration;
        
        srt += `${index + 1}\n`;
        srt += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
        srt += `${scene.script}\n\n`;
        
        currentTime = end;
    });
    
    return srt;
};


/**
 * Creates the JSON body for the Shotstack API request.
 */
const createShotstackEditJson = (
    script: Script, 
    settings: Settings, 
    assetUrls: { imageUrls: string[], audioUrls: string[], srtUrl: string }
) => {
    const tracks: any[] = [];
    let currentTime = 0;

    const imageClips = script.scenes.map((scene, index) => {
        if (!scene.duration) throw new Error(`Scene ${scene.id} is missing duration.`);
        const clip = {
            asset: { type: 'image', src: assetUrls.imageUrls[index] },
            start: currentTime,
            length: scene.duration,
        };
        currentTime += scene.duration;
        return clip;
    });
    tracks.push({ clips: imageClips });

    currentTime = 0; // Reset for audio track
    const audioClips = script.scenes.map((scene, index) => {
        if (!scene.duration) throw new Error(`Scene ${scene.id} is missing duration.`);
        const clip = {
            asset: { type: 'audio', src: assetUrls.audioUrls[index] },
            start: currentTime,
            length: scene.duration,
        };
        currentTime += scene.duration;
        return clip;
    });
    tracks.push({ clips: audioClips });

    // --- Subtitle Track ---
    tracks.push({
        clips: [{
            asset: {
                type: 'caption',
                src: assetUrls.srtUrl,
                style: {
                    font: settings.subtitleFontName || 'Arial',
                    size: 'xx-small',
                    color: '#FFFF00', // Yellow
                    background: '#000000',
                    opacity: 0.6
                },
                position: 'bottom',
                offset: { y: -0.15 }
            },
            start: 0,
            length: currentTime
        }]
    });

    // --- Background Music Track (optional) ---
    if (settings.backgroundMusic) {
        tracks.push({
            clips: [{
                asset: {
                    type: 'audio',
                    src: settings.backgroundMusic,
                    volume: 0.2,
                },
                start: 0,
                length: currentTime,
            }]
        });
    }

    return {
        timeline: { 
            background: "#000000",
            tracks 
        },
        output: {
            format: 'mp4',
            resolution: 'hd',
            aspectRatio: "9:16"
        }
    };
};

/**
 * Initiates video rendering with Shotstack.
 * @returns The render ID from Shotstack.
 */
export const startVideoRender = async (script: Script, settings: Settings): Promise<string> => {
    if (!settings.shotstackApiKey || !settings.shotstackUrl) {
        throw new Error("Shotstack API Key 또는 URL이 설정되지 않았습니다.");
    }
    
    console.log(`[${script.title}] 1/3: 에셋 업로드를 시작합니다...`);

    // 1. Upload all assets to Shotstack's hosting in parallel
    const imageUploadPromises = script.scenes.map((s, i) => {
        if (!s.imageUrl) throw new Error(`[씬 ${s.id}] 이미지가 없습니다.`);
        return uploadAsset(s.imageUrl, `scene-${s.id}.jpg`, settings);
    });
    const audioUploadPromises = script.scenes.map((s, i) => {
        if (!s.audioUrl) throw new Error(`[씬 ${s.id}] 음원이 없습니다.`);
        return uploadAsset(s.audioUrl, `scene-${s.id}.mp3`, settings);
    });
    const [imageUrls, audioUrls] = await Promise.all([
        Promise.all(imageUploadPromises),
        Promise.all(audioUploadPromises)
    ]);
    console.log("모든 이미지와 음원 업로드 완료.");

    // 2. Generate and upload SRT subtitles
    const srtContent = generateSrtContent(script.scenes);
    const srtBlob = new Blob([srtContent], { type: 'application/x-subrip' });
    const srtFileUrl = URL.createObjectURL(srtBlob);
    const srtUrl = await uploadAsset(srtFileUrl, 'subtitles.srt', settings);
    URL.revokeObjectURL(srtFileUrl);
    console.log("SRT 자막 파일 생성 및 업로드 완료.");

    console.log(`[${script.title}] 2/3: 영상 합성을 요청합니다...`);
    const editJson = createShotstackEditJson(script, settings, { imageUrls, audioUrls, srtUrl });
    
    const response = await fetch(`${settings.shotstackUrl}/render`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.shotstackApiKey,
        },
        body: JSON.stringify(editJson),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shotstack API 오류 (${response.status}): ${errorBody}`);
    }

    const result: ShotstackRenderResponse = await response.json();

    if (!result.success) {
        throw new Error(`Shotstack 전송 실패: ${result.message}`);
    }

    console.log(`[${script.title}] 3/3: 영상 합성 요청 성공. Render ID: ${result.response.id}`);
    return result.response.id;
};

/**
 * Checks the status of a Shotstack render.
 * @returns The full status response from Shotstack.
 */
export const getRenderStatus = async (renderId: string, settings: Settings): Promise<ShotstackStatusResponse['response']> => {
     if (!settings.shotstackApiKey || !settings.shotstackUrl) {
        throw new Error("Shotstack API Key 또는 URL이 설정되지 않았습니다.");
    }
    
    const response = await fetch(`${settings.shotstackUrl}/render/${renderId}`, {
        method: 'GET',
        headers: {
            'x-api-key': settings.shotstackApiKey,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Shotstack 상태 확인 오류 (${response.status}): ${errorBody}`);
    }
    
    const result: ShotstackStatusResponse = await response.json();
    return result.response;
};