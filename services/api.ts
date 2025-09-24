import { GoogleGenAI, Type } from "@google/genai";
import type { Script, Settings, Scene } from '../types';
import { GEMINI_API_KEY, MINIMAX_JWT_TOKEN, SHOTSTACK_API_KEY } from '../env';

// Helper to simulate network delay
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- Retry Helper for API calls ---
const withRetry = async <T>(apiCall: () => Promise<T>, maxRetries: number = 3): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error: any) {
            attempt++;
            const errorMessage = error.message || String(error);

            // Add '499' to the list of retryable status codes.
            // 429: Too Many Requests (Rate Limiting)
            // 499: Client Closed Request (Often a gateway timeout or transient issue)
            const isRetryable = errorMessage.includes('429') ||
                                errorMessage.includes('499') ||
                                errorMessage.toUpperCase().includes('RESOURCE_EXHAUSTED');

            if (isRetryable) {
                if (attempt >= maxRetries) {
                    console.error(`API call failed after ${maxRetries} attempts due to a retryable error.`, error);
                    throw error; // Re-throw the original error after final attempt
                }

                // Try to parse retryDelay from the error message
                let delayMs = 2000 * Math.pow(2, attempt); // Exponential backoff

                try {
                    // The error message often contains a stringified JSON with details
                    const errorJsonString = errorMessage.substring(errorMessage.indexOf('{'), errorMessage.lastIndexOf('}') + 1);
                    const errorDetails = JSON.parse(errorJsonString);
                    const retryInfo = errorDetails?.error?.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                    
                    if (retryInfo?.retryDelay) {
                        const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
                        // Use suggested delay + random jitter to avoid thundering herd
                        delayMs = seconds * 1000 + Math.floor(Math.random() * 1000);
                        console.log(`Retryable error hit. Retrying after suggested delay: ${Math.round(delayMs / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
                    } else {
                         console.log(`Retryable error hit. Retrying with exponential backoff in ${Math.round(delayMs / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
                    }
                } catch(e) {
                     console.log(`Retryable error hit (could not parse details). Retrying with exponential backoff in ${Math.round(delayMs / 1000)}s... (Attempt ${attempt}/${maxRetries})`);
                }
                
                await delay(delayMs);
            } else {
                // Not a retryable error, throw immediately
                throw error;
            }
        }
    }
    // This should not be reached due to the throw in the catch block, but it satisfies TypeScript's control flow analysis.
    throw new Error('API call failed after max retries.');
};


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
  ],
  youtubeScrapingChannels: [],
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
            total_duration: { type: Type.STRING, description: "Total estimated duration, e.g., '01:45'." },
            shorts_script: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        start_time: { type: Type.STRING },
                        end_time: { type: Type.STRING },
                        section_type: { type: Type.STRING },
                        script: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING }
                    },
                    required: ["start_time", "end_time", "script", "imagePrompt"]
                }
            }
        },
        required: ["shorts_title", "shorts_summary", "total_duration", "shorts_script"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: filledPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    const resultJson = JSON.parse(response.text);

    const scenes: Scene[] = resultJson.shorts_script.map((item: any, index: number) => ({
        id: index + 1,
        time: `${item.start_time} - ${item.end_time}`,
        script: item.script,
        imagePrompt: item.imagePrompt,
        imageState: 'pending',
        audioState: 'pending',
    }));

    return {
      channel: 'UNKNOWN', // Or derive from context if available
      title: rawText.substring(0, 50),
      shorts_title: resultJson.shorts_title,
      shorts_summary: resultJson.shorts_summary,
      scenes: scenes,
    };
};

export const generateImageForScene = async (prompt: string, apiKey: string): Promise<string> => {
  return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
      });
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
  });
};

export const generateImageSuggestions = async (prompt: string, apiKey: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 4, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        });
        return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
    });
};

export const regenerateImagePrompts = async (script: Script, settings: Settings): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
    
    const scriptJson = JSON.stringify(script.scenes.map(s => ({ scriptNumber: s.id, script: s.script })), null, 2);

    const filledPrompt = settings.imagePrompt
        .replace(/{{title}}/g, script.title)
        .replace(/{{story_content}}/g, script.scenes.map(s => s.script).join('\n'))
        .replace(/{{shorts_script_json}}/g, scriptJson)
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
                    required: ["scriptNumber", "image_prompt"]
                },
            },
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

    const resultJson = JSON.parse(response.text);
    return resultJson.image_prompts.map((p: { image_prompt: string }) => p.image_prompt);
};


export const generateAudioForScene = async (text: string, jwt: string, voiceModel: string): Promise<{ audioUrl: string; duration: number }> => {
    return withRetry(async () => {
        // JWT에서 GroupID 추출
        let groupId = "1966460595511239408"; // fallback
        try {
            const tokenPayload = JSON.parse(atob(jwt.split('.')[1]));
            groupId = tokenPayload.GroupID || groupId;
        } catch (e) {
            console.warn('JWT GroupID 추출 실패, 기본값 사용:', groupId);
        }
        
        const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${groupId}`;

        const headers = {
            "Authorization": `Bearer ${jwt}`,
            "Content-Type": "application/json",
        };

        // MiniMax TTS 페이로드
        const payload = {
            "model": "speech-01-turbo",
            "text": text,
            "stream": false,
            "voice_setting": {
                "voice_id": voiceModel,
                "speed": 1.0,
                "vol": 1.0,
                "pitch": 0
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1
            }
            // output_format 제거 - 기본값으로 hex 받기
        };

        console.log('MiniMax TTS Request:', {
            url,
            groupId,
            voiceModel,
            textLength: text.length
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MiniMax API HTTP 에러 ${response.status}: ${errorText}`);
        }

        // JSON 응답 처리
        const responseData = await response.json();
        console.log('MiniMax API Response:', {
            status_code: responseData.base_resp?.status_code,
            status_msg: responseData.base_resp?.status_msg,
            has_data: !!responseData.data,
            has_audio: !!responseData.data?.audio,
            audio_length: responseData.data?.audio?.length?.toString()?.substring(0, 50) + '...'
        });

        // V2 응답 구조 처리
        if (responseData.base_resp && responseData.base_resp.status_code !== 0) {
            const errorMsg = responseData.base_resp.status_msg || 'Unknown error';
            throw new Error(`MiniMax API error: ${errorMsg}`);
        }

        // 오디오 데이터 추출
        const data = responseData.data || responseData;
        if (!data) {
            throw new Error('응답에서 오디오 데이터를 찾을 수 없습니다.');
        }

        let audioUrl: string;
        let duration: number;

        // URL 응답
        if (data.audio_url || data.url) {
            audioUrl = data.audio_url || data.url;
            duration = data.duration || (text.length * 0.15); // 예상 시간
        }
        // HEX 응답을 Base64로 변환
        else if (data.audio) {
            try {
                const hexString = data.audio;
                console.log('Processing hex audio, length:', hexString.length);

                // Hex를 바이트 배열로 변환
                const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));

                // 큰 배열에 대해 안전한 Base64 변환
                let binary = '';
                const chunkSize = 0x8000; // 32KB chunks
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                }

                const base64Audio = btoa(binary);
                audioUrl = `data:audio/mp3;base64,${base64Audio}`;
                duration = text.length * 0.15;

                console.log('Audio converted to base64, size:', base64Audio.length);
            } catch (hexError) {
                console.error('Failed to process hex audio:', hexError);
                throw new Error('오디오 데이터 변환 실패');
            }
        }
        else {
            throw new Error('오디오 데이터가 없습니다.');
        }

        console.log(`Audio generated: ${audioUrl.substring(0, 50)}...`, duration + 's');
        return { audioUrl, duration };
    }, 3); // 최대 3회 재시도
};

export const startVideoRender = async (script: Script, settings: Settings): Promise<string> => {
    if (!settings.shotstackApiKey) {
        throw new Error("Shotstack API Key가 설정되지 않았습니다.");
    }

    if (!settings.shotstackUrl) {
        throw new Error("파일 서버 URL이 설정되지 않았습니다. 설정에서 파일 서버 URL을 입력해주세요.");
    }

    // 파일 경로를 HTTP URL로 변환하는 헬퍼 함수
    const toHttpUrl = (filePath: string): string => {
        // base64 데이터는 처리하지 않음 (더 이상 사용하지 않음)
        if (filePath.startsWith('data:')) {
            throw new Error("Base64 데이터는 지원하지 않습니다. 파일을 먼저 로컬에 저장하세요.");
        }

        // 이미 HTTP URL인 경우 그대로 반환
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            return filePath;
        }

        // 로컬 경로를 HTTP URL로 변환
        // D:\ai-shorts-studio\AI-Shorts-Studio\data\images\scriptId\scene_1.jpg
        // -> http://IP:5900/data/images/scriptId/scene_1.jpg
        const dataIndex = filePath.indexOf('data');
        if (dataIndex === -1) {
            throw new Error(`유효하지 않은 파일 경로: ${filePath}`);
        }

        const relativePath = filePath.substring(dataIndex).replace(/\\/g, '/');
        const baseUrl = settings.shotstackUrl.endsWith('/')
            ? settings.shotstackUrl.slice(0, -1)
            : settings.shotstackUrl;
        return `${baseUrl}/${relativePath}`;
    };

    // 캐시 버스팅 함수
    const cacheBust = () => `?v=${Date.now()}`;

    // 단일 트랙에 모든 클립 배치 (간소화)
    const clips = [];
    let currentTime = 0;

    for (const scene of script.scenes) {
        if (!scene.imageUrl || !scene.audioUrl || !scene.duration) {
            throw new Error(`[씬 ${scene.id}]에 이미지, 오디오, 또는 길이 정보가 없습니다.`);
        }

        // 파일 경로를 HTTP URL로 변환
        const imageHttpUrl = toHttpUrl(scene.imageUrl);
        const audioHttpUrl = toHttpUrl(scene.audioUrl);

        console.log(`[씬 ${scene.id}] 이미지 URL: ${imageHttpUrl}`);
        console.log(`[씬 ${scene.id}] 오디오 URL: ${audioHttpUrl}`);

        // 각 씬마다 이미지와 오디오를 하나의 클립으로 결합
        clips.push({
            "asset": {
                "type": "image",
                "src": imageHttpUrl + cacheBust()
            },
            "start": currentTime,
            "length": scene.duration,
            "position": "center",
            "fit": "cover",
            "scale": 1
        });

        // 오디오 클립
        clips.push({
            "asset": {
                "type": "audio",
                "src": audioHttpUrl + cacheBust(),
                "volume": 1
            },
            "start": currentTime,
            "length": scene.duration
        });

        // 자막 클립 (윈도우 호환성 개선)
        clips.push({
            "asset": {
                "type": "title",
                "text": scene.script,
                "style": "minimal",
                "color": "#ffffff",
                "size": "medium",
                "background": "#000000cc",
                "position": "bottom"
            },
            "start": currentTime,
            "length": scene.duration,
            "offset": {
                "x": 0,
                "y": 0.15
            }
        });

        currentTime += scene.duration;
    }

    console.log('Shotstack payload:', JSON.stringify({ clipCount: clips.length, totalDuration: currentTime }));
    
    const payload = {
        "timeline": {
            "background": "#000000",
            "tracks": [
                { "clips": clips }
            ]
        },
        "output": {
            "format": "mp4",
            "resolution": "hd",
            "aspectRatio": "9:16",
            "fps": 25
        }
    };

    const response = await fetch(`${settings.shotstackUrl}/render`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.shotstackApiKey
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(`Shotstack API 에러 (${response.status}): ${JSON.stringify(data)}`);
    }

    return data.response.id;
};


export const getRenderStatus = async (renderId: string, settings: Settings): Promise<{ status: string, url?: string, error?: string }> => {
    if (!settings.shotstackApiKey) {
        throw new Error("Shotstack API Key가 설정되지 않았습니다.");
    }

    const response = await fetch(`${settings.shotstackUrl}/render/${renderId}`, {
        method: 'GET',
        headers: {
            'x-api-key': settings.shotstackApiKey
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Shotstack 상태 확인 API 에러 (${response.status}): ${JSON.stringify(data)}`);
    }

    return {
        status: data.response.status,
        url: data.response.url,
        error: data.response.error
    };
};