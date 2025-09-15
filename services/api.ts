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
7) 출력에는 이미지 관련 필드를 포함하지 마세요. (이미지 프롬프트는 별도 단계에서 생성)
8) 이미지 프롬프트 생성 시: 각 프롬프트는 반드시 "{{image_style}} | 그림설명 : "으로 시작해야 합니다.

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
      "script": "[원문 기반, 1인칭 한글 문장 20~60자]"
    }
    // 이후 동일 구조로 7~20개 내외
  ]
}

[검증]
- JSON 유효성 검증에 통과하도록 작성하세요.
- 'shorts_script' 배열은 최소 8개 이상 권장.
- 각 구간 'script'는 서로 연결되어 전체 흐름이 일관되게 전개되도록 하세요.
- 이미지 프롬프트나 시각 지시어는 절대 포함하지 마세요.`,
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
            channel: { type: Type.STRING, description: "The name of the YouTube channel. Can be UNKNOWN." },
            title: { type: Type.STRING, description: "A compelling title for the full video." },
            shorts_title: { type: Type.STRING, description: "A shorter, punchier title suitable for YouTube Shorts." },
            shorts_summary: { type: Type.STRING, description: "A brief, one or two sentence summary of the story." },
            scenes: {
                type: Type.ARRAY,
                description: "An array of scenes for the script.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.INTEGER, description: "A unique sequential number for the scene, starting from 1." },
                        time: { type: Type.STRING, description: "The time range for this scene, e.g., '00:00 - 00:15'." },
                        script: { type: Type.STRING, description: "The dialogue or narration for this scene." },
                        imagePrompt: { type: Type.STRING, description: "A detailed prompt for an AI image generator to create a visual for this scene. It should start with the required style prefix followed by a description." },
                    },
                     required: ["id", "time", "script", "imagePrompt"]
                },
            },
        },
        required: ["channel", "title", "shorts_title", "shorts_summary", "scenes"]
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
    
    // Overwrite the title with the one generated in the previous step
    jsonResponse.shorts_title = shortsTitle;

    const scriptWithState: Omit<Script, 'id' | 'status'> = {
        ...jsonResponse,
        scenes: jsonResponse.scenes.map((scene: any) => ({
            ...scene,
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
        aspectRatio: '1:1',
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
        aspectRatio: '1:1',
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

export const generateAudioForScene = async (text: string, jwtToken: string, voiceModel: string): Promise<string> => {
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

    // FIX: Updated to the new t2a_v2 endpoint
    const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${groupId}`;
    
    // FIX: Updated request body to match the new API specification
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

    // FIX: Handle JSON response with hex data instead of direct blob
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
    
    return audioUrl;
};


// Mock Shotstack video rendering API
export const renderVideo = async (script: Script): Promise<{ success: boolean; videoUrl?: string }> => {
    console.log('Rendering video for script:', script.title);
    await delay(10000); // Video rendering takes time
    const success = Math.random() > 0.1; // 90% success rate
    if (success) {
        return { success: true, videoUrl: '/mock-video.mp4' };
    }
    return { success: false };
};