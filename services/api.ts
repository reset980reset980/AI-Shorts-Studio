import { GoogleGenAI, Type } from "@google/genai";
import type { Script, Settings, Scene } from '../types';
import { GEMINI_API_KEY, GEMINI_MODEL, MINIMAX_JWT_TOKEN, SHOTSTACK_API_KEY, API_BASE_URL } from '../env';
import { saveImage, saveAudio, saveScenario, saveVideo } from './fileSystem';
import { generateUniqueScenarioId, createFileName, getScenarioPaths } from './idGenerator';
import { createScenario, saveScenarioImage, saveScenarioAudio, updateScenarioMetadata } from './scenarioManager';
import { generateAndSaveSrt } from './srtGenerator';

// Helper to simulate network delay
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper function for API retry logic
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoff: number = 2
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.log(`Attempt ${i + 1} failed:`, error.message);

      // Check if error is retryable
      const isRetryable =
        error.message?.includes('500') ||
        error.message?.includes('503') ||
        error.message?.includes('INTERNAL') ||
        error.message?.includes('timeout') ||
        error.message?.includes('network');

      if (!isRetryable) {
        throw error;
      }

      if (i < maxRetries - 1) {
        const waitTime = delayMs * Math.pow(backoff, i);
        console.log(`Retrying after ${waitTime}ms...`);
        await delay(waitTime);
      }
    }
  }

  throw lastError;
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
  localServerUrl: "", // Dynamically set from ip_config.json
  externalIp: "116.41.203.98", // Default external IP
  serverPort: "5901", // Default server port
  imageGenerationMode: 'sequential', // Default to safe mode
  youtube_channels: [
    {
      name: "성이",
      clientId: "671266928842-st30c7v0fre9cgs08j92707nnefj77fh.apps.googleusercontent.com",
      clientSecret: "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",
      redirectUri: "http://127.0.0.1:5901/oauth2callback",
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

    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: GEMINI_MODEL, // Model from env.ts
            contents: text,
            config: {
                systemInstruction: systemInstruction,
            },
        });
    }, 3, 2000);

    return response.text;
};

// Generate script with new scenario ID system
export const generateScriptWithScenarioId = async (
  rawText: string,
  shortsTitle: string,
  settings: Settings
): Promise<Script> => {
  // First generate the base script
  const baseScript = await generateScriptFromText(rawText, shortsTitle, settings);

  // Generate unique scenario ID
  const scenarioId = generateUniqueScenarioId();

  // Create the full script with ID
  const script: Script = {
    ...baseScript,
    id: `script_${Date.now()}`,
    scenarioId,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Create scenario folders and save metadata
  await createScenario(script);

  return script;
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

    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: GEMINI_MODEL, // Model from env.ts
            contents: filledPrompt,
            config: {
                responseMimeType: "application/json",
                // The schema definition is complex, so we will parse manually.
                // responseSchema: schema,
            },
        });
    }, 3, 2000);
    
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

// Save audio file to local server
const saveAudio = async (dataUrl: string, filename: string): Promise<void> => {
    try {
        const response = await fetch(`/api/save-voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, filename })
        });

        if (!response.ok) {
            throw new Error(`Failed to save audio: ${response.statusText}`);
        }
        console.log(`Audio saved: ${filename}`);
    } catch (error) {
        console.error('Error saving audio:', error);
        // Don't throw - continue even if save fails
    }
};

// Save image file to local server
const saveImage = async (dataUrl: string, filename: string): Promise<void> => {
    try {
        const response = await fetch(`/api/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, filename })
        });

        if (!response.ok) {
            throw new Error(`Failed to save image: ${response.statusText}`);
        }
        console.log(`Image saved: ${filename}`);
    } catch (error) {
        console.error('Error saving image:', error);
        // Don't throw - continue even if save fails
    }
};

// Save scenario (script and image prompts) to local server
export const saveScenario = async (script: Script): Promise<void> => {
    try {
        const timestamp = Date.now();

        // Save script texts
        const scriptTexts = script.scenes.map((scene, index) => ({
            sceneId: scene.id,
            order: index + 1,
            time: scene.time,
            script: scene.script
        }));

        const scriptResponse = await fetch(`/api/save-scenario-scripts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: script.title,
                timestamp,
                scripts: scriptTexts
            })
        });

        if (!scriptResponse.ok) {
            throw new Error(`Failed to save scripts: ${scriptResponse.statusText}`);
        }

        // Save image prompts
        const imagePrompts = script.scenes.map((scene, index) => ({
            sceneId: scene.id,
            order: index + 1,
            imagePrompt: scene.imagePrompt
        }));

        const promptResponse = await fetch(`/api/save-scenario-prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: script.title,
                timestamp,
                prompts: imagePrompts
            })
        });

        if (!promptResponse.ok) {
            throw new Error(`Failed to save prompts: ${promptResponse.statusText}`);
        }

        console.log(`Scenario saved: ${script.title}`);
    } catch (error) {
        console.error('Error saving scenario:', error);
        // Don't throw - continue even if save fails
    }
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


export const generateImageForScene = async (
  prompt: string,
  apiKey: string,
  scenarioId?: string,
  sceneIndex?: number
): Promise<string> => {
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
        aspectRatio: '1:1', // Square format for better composition
      },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("AI가 이미지를 생성하지 못했습니다.");
  }

  const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
  const dataUrl = `data:image/jpeg;base64,${base64ImageBytes}`;

  // Save image to disk with proper naming convention
  let filename: string;
  if (scenarioId && sceneIndex !== undefined) {
    filename = createFileName(scenarioId, 'image', sceneIndex + 1);
    await saveScenarioImage(scenarioId, sceneIndex, dataUrl);
  } else {
    // Fallback to old naming convention
    filename = `image-${Date.now()}.jpg`;
    await saveImage(dataUrl, filename);
  }

  return dataUrl;
};

export const generateImageSuggestions = async (prompt: string, apiKey: string, sceneId?: number): Promise<string[]> => {
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
        aspectRatio: '1:1', // Square format for center placement in header
      },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("AI가 이미지를 생성하지 못했습니다.");
  }

  // Save images to disk and return data URLs
  const imageUrls = await Promise.all(
    response.generatedImages.map(async (img, index) => {
      const dataUrl = `data:image/jpeg;base64,${img.image.imageBytes}`;
      if (sceneId !== undefined) {
        // Save image to disk with timestamp
        const filename = `scene-${sceneId}-option-${index}-${Date.now()}.jpg`;
        await saveImage(dataUrl, filename);
      }
      return dataUrl;
    })
  );

  return imageUrls;
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

// Helper function to reconstruct audio URL from hex data
export const reconstructAudioFromHexData = async (hexAudioData: string): Promise<string> => {
    try {
        const audioBytes = hexToUint8Array(hexAudioData);
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });

        // Create data URL for persistence
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(audioBlob);
        });
    } catch (error: any) {
        throw new Error(`Failed to reconstruct audio: ${error.message}`);
    }
};

// Helper function to repair scripts with missing/invalid image URLs
export const repairScriptsImages = async (scripts: any[]): Promise<any[]> => {
    try {
        // Get list of available images from data folder
        const response = await fetch(`/api/list-images`);
        if (!response.ok) {
            console.error('Failed to get image list');
            return scripts;
        }

        const { images } = await response.json();
        if (!images || images.length === 0) {
            console.log('No images available in data folder');
            return scripts;
        }

        // Sort images by date (newest first)
        const sortedImages = images.sort((a: string, b: string) => {
            const aMatch = a.match(/(\d+)/);
            const bMatch = b.match(/(\d+)/);
            if (aMatch && bMatch) {
                return parseInt(bMatch[1]) - parseInt(aMatch[1]);
            }
            return 0;
        });

        // Process scripts sequentially to maintain proper index tracking
        const repairedScripts = [];
        let totalScenesProcessed = 0;

        for (let scriptIndex = 0; scriptIndex < scripts.length; scriptIndex++) {
            const script = scripts[scriptIndex];
            const scriptStartIndex = totalScenesProcessed;

            const repairedScenes = await Promise.all(script.scenes.map(async (scene: any, sceneIndex: number) => {
                // Check if image URL is missing or invalid
                if (!scene.imageUrl || scene.imageUrl.startsWith('blob:') || scene.imageState === 'error') {
                    try {
                        // Use a unique image for each scene across all scripts
                        const globalSceneIndex = scriptStartIndex + sceneIndex;
                        const imageFile = sortedImages[globalSceneIndex % sortedImages.length];
                        console.log(`Repairing image URL for script ${scriptIndex + 1}, scene ${scene.id} with ${imageFile}...`);

                        // Convert to data URL
                        const imageResponse = await fetch(`/api/get-image/${imageFile}`);
                        if (!imageResponse.ok) {
                            throw new Error('Failed to fetch image');
                        }

                        const blob = await imageResponse.blob();
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });

                        return { ...scene, imageUrl: dataUrl, imageState: 'done' };
                    } catch (error) {
                        console.error(`Failed to repair image for scene ${scene.id}:`, error);
                        return scene;
                    }
                }
                return scene;
            }));

            // Update the total scenes processed for next script
            totalScenesProcessed += script.scenes.length;

            repairedScripts.push({ ...script, scenes: repairedScenes });
        }

        return repairedScripts;
    } catch (error) {
        console.error('Failed to repair scripts images:', error);
        return scripts;
    }
};

// Helper function to repair scripts with missing/invalid audio URLs
export const repairScriptsAudio = async (scripts: any[]): Promise<any[]> => {
    try {
        // Get list of available voice files from data folder
        const response = await fetch(`/api/list-voice-files`);
        let voiceFiles: any[] = [];

        if (response.ok) {
            const { voices } = await response.json();
            voiceFiles = voices || [];
        }

        // Process scripts sequentially for audio repair
        const repairedScripts = [];
        let totalAudioScenesProcessed = 0;

        for (let scriptIndex = 0; scriptIndex < scripts.length; scriptIndex++) {
            const script = scripts[scriptIndex];
            const scriptStartIndex = totalAudioScenesProcessed;

            const repairedScenes = await Promise.all(script.scenes.map(async (scene: any, sceneIndex: number) => {
                // Check if audio URL is missing or is a blob URL (likely expired)
                if (!scene.audioUrl || scene.audioUrl.startsWith('blob:') || scene.audioState === 'error') {
                    try {
                        // First try to reconstruct from hex data if available
                        if (scene.audioData) {
                            console.log(`Repairing audio URL for scene ${scene.id} from hex data...`);
                            const reconstructedUrl = await reconstructAudioFromHexData(scene.audioData);
                            return { ...scene, audioUrl: reconstructedUrl, audioState: 'done' };
                        }

                        // If no hex data, try to assign from available voice files
                        if (voiceFiles.length > 0) {
                            // Use a unique voice for each scene across all scripts
                            const globalSceneIndex = scriptStartIndex + sceneIndex;
                            const voiceFile = voiceFiles[globalSceneIndex % voiceFiles.length];
                            console.log(`Repairing audio URL for scene ${scene.id} with ${voiceFile.filename}...`);

                            // Convert to data URL
                            const audioResponse = await fetch(`/api/get-voice/${voiceFile.filename}`);
                            if (!audioResponse.ok) {
                                throw new Error('Failed to fetch voice file');
                            }

                            const blob = await audioResponse.blob();
                            const dataUrl = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });

                            // Get approximate duration (1 second per 10-15 characters of script)
                            const estimatedDuration = Math.max(3, Math.min(15, scene.script.length / 10));

                            return {
                                ...scene,
                                audioUrl: dataUrl,
                                audioState: 'done',
                                duration: estimatedDuration
                            };
                        }
                    } catch (error) {
                        console.error(`Failed to repair audio for scene ${scene.id}:`, error);
                        // Reset audio state to pending if reconstruction fails
                        return { ...scene, audioState: 'pending', audioUrl: undefined };
                    }
                }
                return scene;
            }));

            // Update the total audio scenes processed for next script
            totalAudioScenesProcessed += script.scenes.length;

            repairedScripts.push({ ...script, scenes: repairedScenes });
        }

        return repairedScripts;
    } catch (error) {
        console.error('Failed to repair scripts audio:', error);
        return scripts;
    }
};


export const generateAudioForScene = async (
    text: string,
    jwtToken: string,
    voiceModel: string,
    scenarioId?: string,
    sceneIndex?: number
): Promise<{ audioUrl: string; audioData: string; duration: number; }> => {
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

    // Create data URL instead of blob URL for persistence
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(audioBlob);
    });

    // Create temporary blob URL for duration measurement
    const tempBlobUrl = URL.createObjectURL(audioBlob);

    try {
        const duration = await getAudioDuration(tempBlobUrl);

        // Save audio to disk with proper naming convention
        let filename: string;
        if (scenarioId && sceneIndex !== undefined) {
            filename = createFileName(scenarioId, 'voice', sceneIndex + 1);
            await saveScenarioAudio(scenarioId, sceneIndex, dataUrl);
        } else {
            // Fallback to old naming convention
            filename = `audio-${Date.now()}.mp3`;
            await saveAudio(dataUrl, filename);
        }

        return {
            audioUrl: dataUrl, // Return data URL for persistence
            audioData: hexAudioData, // Store raw hex data for future reconstruction
            duration
        };
    } catch (error) {
        console.error("Could not get audio duration", error);
        throw new Error("음원 파일의 길이를 측정하는 데 실패했습니다.");
    } finally {
        // Always clean up temporary blob URL
        URL.revokeObjectURL(tempBlobUrl);
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

// Helper to convert dataURL/blobURL to a Blob object
const urlToBlob = async (url: string): Promise<Blob> => {
    try {
        // Check if it's a data URL
        if (url.startsWith('data:')) {
            const base64Data = url.split(',')[1];
            const mimeType = url.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';

            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        }

        // For blob URLs or regular URLs
        const response = await fetch(url, {
            mode: 'cors',
            cache: 'no-cache'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch blob from URL: ${response.status} ${response.statusText}`);
        }
        return await response.blob();
    } catch (error: any) {
        console.error('Error converting URL to blob:', error);

        // Special handling for blob URL failures
        if (url.startsWith('blob:')) {
            throw new Error(`Blob URL expired or invalid. Please regenerate the audio: ${error.message}`);
        }

        throw new Error(`Failed to convert URL to blob: ${error.message}`);
    }
};

const storeAssetOnServer = async (dataUrl: string, filename: string, serverUrl: string): Promise<string> => {
    try {
        // Use relative path if serverUrl is empty (to use proxy)
        const endpoint = serverUrl ? `${serverUrl}/api/assets/store` : '/api/assets/store';

        // Post the asset to the local server
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: dataUrl,
                filename: filename
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to store asset on server: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Return the public URL for the asset
        return result.url;
    } catch (error) {
        console.error('Error storing asset on server:', error);
        throw error;
    }
};

const uploadAsset = async (url: string, filename: string, settings: Settings, fallbackAudioData?: string): Promise<string> => {
    try {
        console.log(`Processing asset for ${filename}...`);
        console.log(`Input URL type: ${url.startsWith('blob:') ? 'blob URL' : url.startsWith('data:') ? 'data URL' : url.startsWith('http://') || url.startsWith('https://') ? 'HTTP/HTTPS URL' : 'other'}`);
        console.log(`LocalServerUrl configured: ${settings.localServerUrl ? 'YES - ' + settings.localServerUrl : 'NO'}`);

        // Validate input URL
        if (!url || url.trim() === '') {
            throw new Error(`Invalid asset URL for ${filename}`);
        }

        // If URL is already a HTTP/HTTPS URL, return it directly
        if (url.startsWith('http://') || url.startsWith('https://')) {
            console.log(`Asset already on server, using existing URL: ${url}`);
            return url;
        }

        // Determine server URL - use relative path for proxy or configured URL
        let serverUrl = '';
        if (settings.localServerUrl && settings.localServerUrl.trim() !== '') {
            // Use configured URL if available
            serverUrl = settings.localServerUrl;
        } else {
            // Use relative path to leverage Vite proxy
            serverUrl = '';
        }

        console.log(`Using server URL for assets: ${serverUrl || 'relative path (proxy)'}`);

        // Always try to use local server for asset storage (required for Shotstack)
        try {
            const localUrl = await storeAssetOnServer(url, filename, serverUrl);
            console.log(`Asset stored on local server: ${localUrl}`);
            return localUrl;
        } catch (error) {
            console.error(`Failed to store asset on local server:`, error);
            // Local server is required for Shotstack to access media files
            throw new Error(`Asset upload failed for ${filename}: ${error}`);
        }
    } catch (error: any) {
        console.error('Upload asset error:', error);
        throw new Error(`Asset upload failed for ${filename}: ${error.message}`);
    }
};

// Helper to format time for SRT files with validation
const formatSrtTime = (totalSeconds: number): string => {
    try {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            throw new Error(`Invalid time value: ${totalSeconds}`);
        }

        // Ensure we don't exceed reasonable time limits (24 hours)
        if (totalSeconds > 86400) {
            console.warn(`Unusually large time value: ${totalSeconds} seconds`);
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

        // Format with proper padding
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;

    } catch (error: any) {
        console.error('Time formatting error:', error);
        return '00:00:00,000'; // Safe fallback
    }
};

// Generates SRT content from scenes with validation
const generateSrtContent = (scenes: Scene[]): string => {
    try {
        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            throw new Error('Scenes data is invalid or empty');
        }

        let srt = '';
        let currentTime = 0;
        let validSceneCount = 0;

        scenes.forEach((scene, index) => {
            if (!scene) {
                console.warn(`Scene at index ${index} is null or undefined`);
                return;
            }

            const sceneDuration = scene.audioDuration || scene.duration;
            if (!sceneDuration || sceneDuration <= 0) {
                console.warn(`Scene ${scene.id} has invalid duration: ${sceneDuration}`);
                return;
            }

            if (!scene.script || typeof scene.script !== 'string' || scene.script.trim() === '') {
                console.warn(`Scene ${scene.id} has invalid script text`);
                return;
            }

            const start = currentTime;
            const end = currentTime + sceneDuration;

            validSceneCount++;
            srt += `${validSceneCount}\n`;
            srt += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
            srt += `${scene.script.trim()}\n\n`;

            currentTime = end;
        });

        if (validSceneCount === 0) {
            throw new Error('No valid scenes found for SRT generation');
        }

        return srt.trim() + '\n'; // Ensure file ends with newline

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`SRT 생성 실패: ${errorMessage}`);
    }
};


/**
 * Validates scene data before creating Shotstack edit JSON.
 */
const validateScenes = (scenes: Scene[]): void => {
    for (const scene of scenes) {
        const sceneDuration = scene.audioDuration || scene.duration;
        if (!sceneDuration || sceneDuration <= 0) {
            throw new Error(`Scene ${scene.id} has invalid duration: ${sceneDuration}`);
        }
        if (!scene.imageUrl || scene.imageUrl.trim() === '') {
            throw new Error(`Scene ${scene.id} is missing image URL`);
        }
        if (!scene.audioUrl || scene.audioUrl.trim() === '') {
            throw new Error(`Scene ${scene.id} is missing audio URL`);
        }
        if (typeof scene.script !== 'string' || scene.script.trim() === '') {
            throw new Error(`Scene ${scene.id} has invalid script text`);
        }
    }
};

/**
 * Creates the JSON body for the Shotstack API request with proper validation.
 */
const createShotstackEditJson = (
    script: Script,
    settings: Settings,
    assetUrls: { imageUrls: string[], audioUrls: string[], srtUrl: string }
) => {
    try {
        // Validate input data
        if (!script || !script.scenes || script.scenes.length === 0) {
            throw new Error('Script or scenes data is invalid');
        }
        if (!settings) {
            throw new Error('Settings data is required');
        }
        if (!assetUrls || !assetUrls.imageUrls || !assetUrls.audioUrls || !assetUrls.srtUrl) {
            throw new Error('Asset URLs are missing');
        }
        if (assetUrls.imageUrls.length !== script.scenes.length) {
            throw new Error(`Image URL count (${assetUrls.imageUrls.length}) doesn't match scene count (${script.scenes.length})`);
        }
        if (assetUrls.audioUrls.length !== script.scenes.length) {
            throw new Error(`Audio URL count (${assetUrls.audioUrls.length}) doesn't match scene count (${script.scenes.length})`);
        }

        // Validate all scenes have required data
        validateScenes(script.scenes);

        const tracks: any[] = [];
        let currentTime = 0;

        // Image track
        const imageClips = script.scenes.map((scene, index) => {
            const clip = {
                asset: {
                    type: 'image',
                    src: assetUrls.imageUrls[index]
                },
                start: currentTime,
                length: scene.audioDuration || scene.duration!,
            };
            currentTime += scene.audioDuration || scene.duration!;
            return clip;
        });
        tracks.push({ clips: imageClips });

        // Audio track
        currentTime = 0; // Reset for audio track
        const audioClips = script.scenes.map((scene, index) => {
            const clip = {
                asset: {
                    type: 'audio',
                    src: assetUrls.audioUrls[index]
                },
                start: currentTime,
                length: scene.audioDuration || scene.duration!,
            };
            currentTime += scene.audioDuration || scene.duration!;
            return clip;
        });
        tracks.push({ clips: audioClips });

        // Subtitle track with proper Shotstack caption asset format
        // Only include font properties that are supported by Shotstack API
        if (assetUrls.srtUrl && assetUrls.srtUrl.trim() !== '') {
            tracks.push({
                clips: [{
                    asset: {
                        type: 'caption',
                        src: assetUrls.srtUrl,
                        font: {
                            family: settings.subtitleFontName || 'Open Sans',
                            size: 16,
                            color: '#FFFF00'
                        }
                    },
                    start: 0,
                    length: currentTime
                }]
            });
        }

        // Background music track (optional)
        if (settings.backgroundMusic &&
            settings.backgroundMusic.trim() !== '' &&
            !settings.backgroundMusic.startsWith('blob:')) {
            tracks.push({
                clips: [{
                    asset: {
                        type: 'audio',
                        src: settings.backgroundMusic,
                        volume: 0.2
                    },
                    start: 0,
                    length: currentTime
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
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to create Shotstack edit JSON: ${errorMessage}`);
    }
};

/**
 * Check Shotstack render status
 */
export const checkRenderStatus = async (renderId: string, settings: Settings): Promise<{status: string, url?: string}> => {
    if (!settings.shotstackApiKey) {
        throw new Error("Shotstack API Key가 설정되지 않았습니다.");
    }

    const response = await withRetry(async () => {
        const res = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
            method: 'GET',
            headers: {
                'x-api-key': settings.shotstackApiKey
            }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res;
    });

    const data = await response.json();
    return {
        status: data.response.status,
        url: data.response.url
    };
};

/**
 * Download video from URL and save to server
 */
export const downloadAndSaveVideo = async (videoUrl: string, scenarioId: string): Promise<string> => {
    const filename = `${scenarioId}_video.mp4`;

    const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: videoUrl,
            filename
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const result = await response.json();
    return result.path;
};

/**
 * Initiates video rendering with Shotstack with comprehensive error handling.
 * @returns The render ID from Shotstack.
 */
export const startVideoRender = async (script: Script, settings: Settings): Promise<string> => {
    try {
        // Validate input parameters
        if (!script) {
            throw new Error("스크립트 데이터가 유효하지 않습니다.");
        }

        // Scenario ID is required for video rendering
        if (!script.scenarioId) {
            throw new Error('시나리오 ID가 없습니다. 먼저 시나리오를 저장해주세요.');
        }
        if (!settings) {
            throw new Error("설정 데이터가 유효하지 않습니다.");
        }
        if (!settings.shotstackApiKey || settings.shotstackApiKey.trim() === '') {
            throw new Error("Shotstack API Key가 설정되지 않았습니다.");
        }
        if (!settings.shotstackUrl || settings.shotstackUrl.trim() === '') {
            throw new Error("Shotstack URL이 설정되지 않았습니다.");
        }
        if (!script.scenes || script.scenes.length === 0) {
            throw new Error("스크립트에 씬이 없습니다.");
        }

        const scriptTitle = script.shorts_title || script.title || 'Unknown Script';
        console.log(`[${scriptTitle}] 1/4: 사전 검증을 수행합니다...`);

        // Validate scenes have all required data (check both duration and audioDuration)
        const invalidScenes = script.scenes.filter(s =>
            !s.imageUrl || !s.audioUrl || (!s.audioDuration && !s.duration) || ((s.audioDuration || s.duration) <= 0)
        );
        if (invalidScenes.length > 0) {
            const sceneIds = invalidScenes.map(s => s.id).join(', ');
            console.log('Invalid scenes details:', invalidScenes.map(s => ({
                id: s.id,
                hasImage: !!s.imageUrl,
                hasAudio: !!s.audioUrl,
                duration: s.duration,
                audioDuration: s.audioDuration
            })));
            throw new Error(`다음 씬들에 필수 데이터가 누락되었습니다: ${sceneIds}. 이미지, 음원, 길이 정보가 모두 필요합니다.`);
        }

        console.log(`[${scriptTitle}] 2/4: 에셋 업로드를 시작합니다...`);

        // Upload all assets to Shotstack's hosting with error handling
        const imageUploadPromises = script.scenes.map(async (scene, index) => {
            try {
                if (!scene.imageUrl) {
                    throw new Error(`이미지가 없습니다`);
                }

                console.log(`Scene ${scene.id} imageUrl:`, scene.imageUrl);
                console.log(`URL starts with http:// ? ${scene.imageUrl.startsWith('http://')}`);
                console.log(`URL starts with https:// ? ${scene.imageUrl.startsWith('https://')}`);
                console.log(`URL starts with data: ? ${scene.imageUrl.startsWith('data:')}`);

                // If URL is already a server URL, use it directly
                if (scene.imageUrl.startsWith('http://') || scene.imageUrl.startsWith('https://')) {
                    console.log(`Using existing server URL for scene ${scene.id} image`);
                    return scene.imageUrl;
                }

                // Use scenario-based filename (scenario ID is required)
                const filename = `${script.scenarioId}_Image${index + 1}.jpg`;
                console.log(`Uploading image with filename: ${filename}`);

                return await uploadAsset(scene.imageUrl, filename, settings);
            } catch (error: any) {
                throw new Error(`[씬 ${scene.id}] 이미지 업로드 실패: ${error.message}`);
            }
        });

        const audioUploadPromises = script.scenes.map(async (scene, index) => {
            try {
                if (!scene.audioUrl) {
                    throw new Error(`음원이 없습니다`);
                }

                console.log(`Scene ${scene.id} audioUrl:`, scene.audioUrl.substring(0, 50));

                // If URL is already a server URL, use it directly
                if (scene.audioUrl.startsWith('http://') || scene.audioUrl.startsWith('https://')) {
                    console.log(`Using existing server URL for scene ${scene.id} audio`);
                    return scene.audioUrl;
                }

                // If it's a blob URL, convert to data URL first
                if (scene.audioUrl.startsWith('blob:')) {
                    console.log(`Converting blob URL to data URL for scene ${scene.id} audio`);
                    // blob URL needs to be converted or we need to use audioData
                    if (!scene.audioData) {
                        throw new Error(`Audio data missing for blob URL in scene ${scene.id}`);
                    }
                }

                // Use scenario-based filename (scenario ID is required)
                const filename = `${script.scenarioId}_Voice${index + 1}.mp3`;

                // Use audioData if available, otherwise use audioUrl
                const audioToUpload = scene.audioData || scene.audioUrl;
                return await uploadAsset(audioToUpload, filename, settings);
            } catch (error: any) {
                throw new Error(`[씬 ${scene.id}] 음원 업로드 실패: ${error.message}`);
            }
        });

        const [imageUrls, audioUrls] = await Promise.all([
            Promise.all(imageUploadPromises),
            Promise.all(audioUploadPromises)
        ]);
        console.log(`[${scriptTitle}] 모든 이미지와 음원 업로드 완료.`);

        // Generate and upload SRT subtitles with validation
        console.log(`[${scriptTitle}] 3/4: 자막 파일을 생성하고 업로드합니다...`);

        // Use scenario-based filename for SRT file (scenario ID is required)
        const srtFilename = `${script.scenarioId}_Subtitle.srt`;

        let srtUrl: string;

        // Check if we already have an SRT URL from server (like images)
        // Use external IP from settings if available, or construct from ip_config
        let baseUrl = settings.localServerUrl;

        if (!baseUrl) {
            // Try to get from ip_config.json through the server
            try {
                const ipConfigResponse = await fetch('/api/ip-config');
                if (ipConfigResponse.ok) {
                    const ipConfig = await ipConfigResponse.json();
                    baseUrl = `http://${ipConfig.externalIp}:${ipConfig.serverPort}`;
                }
            } catch (error) {
                console.error('Failed to fetch IP config:', error);
            }
        }

        // Fallback to origin if still not available
        if (!baseUrl) {
            baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        }

        const serverSrtUrl = `${baseUrl}/api/scenarios/${script.scenarioId}/Srt/${srtFilename}`;

        // Check if it's a saved scenario (images and audio are from server)
        const isLoadedScenario = script.scenes.length > 0 &&
                                 script.scenes[0].imageUrl &&
                                 script.scenes[0].imageUrl.startsWith('http');

        if (isLoadedScenario) {
            // If this is a loaded scenario, SRT should exist on server
            console.log(`Using existing SRT file from server: ${serverSrtUrl}`);
            srtUrl = serverSrtUrl;
        } else {
            // Generate new SRT file
            console.log(`Generating new SRT file...`);
            const srtContent = generateSrtContent(script.scenes);
            if (!srtContent || srtContent.trim() === '') {
                throw new Error("자막 내용 생성에 실패했습니다.");
            }

            const srtBlob = new Blob([srtContent], { type: 'application/x-subrip' });
            const srtFileUrl = URL.createObjectURL(srtBlob);

            try {
                srtUrl = await uploadAsset(srtFileUrl, srtFilename, settings);
            } finally {
                URL.revokeObjectURL(srtFileUrl); // Always clean up
            }
        }
        console.log(`[${scriptTitle}] SRT 자막 파일 생성 및 업로드 완료.`);

        console.log(`[${scriptTitle}] 4/4: 영상 합성을 요청합니다...`);
        const editJson = createShotstackEditJson(script, settings, { imageUrls, audioUrls, srtUrl });

        // Log the request for debugging (but limit size)
        const logData = JSON.stringify(editJson, null, 2);
        if (logData.length > 2000) {
            console.log('Sending large request to Shotstack (truncated):', logData.substring(0, 2000) + '...');
        } else {
            console.log('Sending to Shotstack:', logData);
        }

        const response = await withRetry(async () => {
            const res = await fetch(`${settings.shotstackUrl}/render`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': settings.shotstackApiKey,
                },
                body: JSON.stringify(editJson),
            });

            if (!res.ok) {
                const errorBody = await res.text();
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;

                // Try to parse error details
                try {
                    const errorData = JSON.parse(errorBody);
                    if (errorData.message) {
                        errorMessage += ` - ${errorData.message}`;
                    }
                    if (errorData.errors && Array.isArray(errorData.errors)) {
                        errorMessage += ` - Errors: ${errorData.errors.join(', ')}`;
                    }
                } catch (e) {
                    errorMessage += ` - ${errorBody}`;
                }

                throw new Error(errorMessage);
            }

            return res;
        }, 3, 2000);

        const result: ShotstackRenderResponse = await response.json();

        if (!result || typeof result !== 'object') {
            throw new Error("Shotstack API 응답 형식이 잘못되었습니다.");
        }

        if (!result.success) {
            const message = result.message || '알 수 없는 오류';
            throw new Error(`Shotstack 전송 실패: ${message}`);
        }

        if (!result.response || !result.response.id) {
            throw new Error("Shotstack API 응답에서 렌더 ID를 찾을 수 없습니다.");
        }

        console.log(`[${scriptTitle}] 영상 합성 요청 성공. Render ID: ${result.response.id}`);
        return result.response.id;

    } catch (error: any) {
        // Ensure we always throw a proper Error object with descriptive message
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Video render error:', errorMessage);
        console.error('Error details:', error);
        throw new Error(`영상 합성 요청 실패: ${errorMessage}`);
    }
};

/**
 * Checks the status of a Shotstack render with comprehensive error handling.
 * @returns The full status response from Shotstack.
 */
export const getRenderStatus = async (renderId: string, settings: Settings): Promise<ShotstackStatusResponse['response']> => {
    try {
        // Validate input parameters
        if (!renderId || typeof renderId !== 'string' || renderId.trim() === '') {
            throw new Error("유효하지 않은 렌더 ID입니다.");
        }
        if (!settings) {
            throw new Error("설정 데이터가 유효하지 않습니다.");
        }
        if (!settings.shotstackApiKey || settings.shotstackApiKey.trim() === '') {
            throw new Error("Shotstack API Key가 설정되지 않았습니다.");
        }
        if (!settings.shotstackUrl || settings.shotstackUrl.trim() === '') {
            throw new Error("Shotstack URL이 설정되지 않았습니다.");
        }

        const response = await withRetry(async () => {
            const res = await fetch(`${settings.shotstackUrl}/render/${encodeURIComponent(renderId)}`, {
                method: 'GET',
                headers: {
                    'x-api-key': settings.shotstackApiKey,
                },
            });

            if (!res.ok) {
                const errorBody = await res.text();
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;

                // Try to parse error details
                try {
                    const errorData = JSON.parse(errorBody);
                    if (errorData.message) {
                        errorMessage += ` - ${errorData.message}`;
                    }
                } catch (e) {
                    if (errorBody && errorBody.trim() !== '') {
                        errorMessage += ` - ${errorBody}`;
                    }
                }

                throw new Error(errorMessage);
            }

            return res;
        }, 3, 1000);

        const result: ShotstackStatusResponse = await response.json();

        if (!result || typeof result !== 'object') {
            throw new Error("Shotstack API 응답 형식이 잘못되었습니다.");
        }

        if (!result.response) {
            throw new Error("Shotstack API 응답에 데이터가 없습니다.");
        }

        // Validate response structure
        const statusResponse = result.response;
        if (!statusResponse.id || !statusResponse.status) {
            throw new Error("Shotstack API 응답 구조가 잘못되었습니다.");
        }

        // Ensure status is a valid value
        const validStatuses = ['submitted', 'queued', 'rendering', 'done', 'failed'];
        if (!validStatuses.includes(statusResponse.status)) {
            console.warn(`Unknown status received: ${statusResponse.status}`);
        }

        return statusResponse;

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Render status check error:', errorMessage);
        throw new Error(`렌더 상태 확인 실패: ${errorMessage}`);
    }
};

// Enhanced function to generate images for all scenes with scenario ID
export const generateImagesForScriptWithScenarioId = async (
  script: Script,
  settings: Settings,
  onProgress?: (sceneId: number, state: 'generating' | 'done' | 'error', imageUrl?: string) => void
): Promise<void> => {
  if (!script.scenarioId) {
    throw new Error("Script must have a scenarioId");
  }

  const apiKey = settings.googleApiKey;
  if (!apiKey) {
    throw new Error("Google API Key가 설정되지 않았습니다.");
  }

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    try {
      if (onProgress) {
        onProgress(scene.id, 'generating');
      }

      const imageUrl = await generateImageForScene(
        scene.imagePrompt,
        apiKey,
        script.scenarioId,
        i
      );

      scene.imageUrl = imageUrl;
      scene.imageState = 'done';

      if (onProgress) {
        onProgress(scene.id, 'done', imageUrl);
      }
    } catch (error) {
      console.error(`Failed to generate image for scene ${scene.id}:`, error);
      scene.imageState = 'error';

      if (onProgress) {
        onProgress(scene.id, 'error');
      }
    }
  }
};

// Enhanced function to generate audio for all scenes with scenario ID
export const generateAudioForScriptWithScenarioId = async (
  script: Script,
  settings: Settings,
  onProgress?: (sceneId: number, state: 'generating' | 'done' | 'error', audioUrl?: string, duration?: number) => void
): Promise<void> => {
  if (!script.scenarioId) {
    throw new Error("Script must have a scenarioId");
  }

  const jwtToken = settings.minimaxJwt;
  const voiceModel = settings.voiceModel;

  if (!jwtToken) {
    throw new Error("MiniMax JWT Token이 설정되지 않았습니다.");
  }

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    try {
      if (onProgress) {
        onProgress(scene.id, 'generating');
      }

      const audioResult = await generateAudioForScene(
        scene.script,
        jwtToken,
        voiceModel,
        script.scenarioId,
        i
      );

      scene.audioUrl = audioResult.audioUrl;
      scene.audioData = audioResult.audioData;
      scene.duration = audioResult.duration;
      scene.audioDuration = audioResult.duration; // For SRT generation
      scene.audioState = 'done';

      if (onProgress) {
        onProgress(scene.id, 'done', audioResult.audioUrl, audioResult.duration);
      }
    } catch (error) {
      console.error(`Failed to generate audio for scene ${scene.id}:`, error);
      scene.audioState = 'error';

      if (onProgress) {
        onProgress(scene.id, 'error');
      }
    }
  }

  // Generate SRT file after all audio is generated
  if (script.scenarioId) {
    try {
      await generateAndSaveSrt(script.scenarioId, script.scenes);
      console.log(`SRT file generated for scenario ${script.scenarioId}`);
    } catch (error) {
      console.error(`Failed to generate SRT file:`, error);
    }
  }

  // Update scenario metadata
  if (script.scenarioId) {
    await updateScenarioMetadata(script.scenarioId, {
      status: 'complete'
    });
  }
};

// New repair functions for scenario system
export const repairScenarioImageUrls = async (scripts: Script[]): Promise<Script[]> => {
  const repairedScripts = await Promise.all(scripts.map(async (script) => {
    if (!script.scenarioId) {
      console.log('Script has no scenario ID, skipping image repair');
      return script;
    }

    const repairedScenes = await Promise.all(script.scenes.map(async (scene, index) => {
      // Check if image URL needs repair
      if (!scene.imageUrl || scene.imageUrl.startsWith('blob:') || scene.imageState === 'error') {
        try {
          // Construct the expected file path
          const imageFileName = `${script.scenarioId}_Image${index + 1}.jpg`;
          const imagePath = `./data/scenarios/${script.scenarioId}/Image/${imageFileName}`;

          console.log(`Repairing image URL for scene ${index + 1} with ${imageFileName}`);

          // Fetch the image from the server
          const response = await fetch(`/api/get-scenario-file?path=${encodeURIComponent(imagePath)}`);
          if (!response.ok) {
            console.log(`Scene ${index + 1} image not found, skipping repair: ${imageFileName}`);
            return scene; // Skip this scene if image doesn't exist
          }

          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          return {
            ...scene,
            imageUrl: dataUrl,
            imageState: 'done' as const
          };
        } catch (error) {
          console.error(`Failed to repair image for scene ${index + 1}:`, error);
          return scene;
        }
      }
      return scene;
    }));

    return {
      ...script,
      scenes: repairedScenes
    };
  }));

  return repairedScripts;
};

export const repairScenarioAudioUrls = async (scripts: Script[]): Promise<Script[]> => {
  const repairedScripts = await Promise.all(scripts.map(async (script) => {
    if (!script.scenarioId) {
      console.log('Script has no scenario ID, skipping audio repair');
      return script;
    }

    const repairedScenes = await Promise.all(script.scenes.map(async (scene, index) => {
      // Check if audio URL needs repair or duration is missing
      if (!scene.audioUrl || scene.audioUrl.startsWith('blob:') || scene.audioState === 'error' || !scene.audioDuration) {
        try {
          // Construct the expected file path
          const audioFileName = `${script.scenarioId}_Voice${index + 1}.mp3`;
          const audioPath = `./data/scenarios/${script.scenarioId}/Voice/${audioFileName}`;

          console.log(`Repairing audio URL for scene ${index + 1} with ${audioFileName}`);

          // Fetch the audio from the server
          const response = await fetch(`/api/get-scenario-file?path=${encodeURIComponent(audioPath)}`);
          if (!response.ok) {
            console.log(`Scene ${index + 1} audio not found, skipping repair: ${audioFileName}`);
            return scene; // Skip this scene if audio doesn't exist
          }

          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // Get audio duration from server
          let duration = 5; // Default duration
          try {
            const durationResponse = await fetch(`/api/audio-duration?filePath=${encodeURIComponent(audioPath)}`);
            if (durationResponse.ok) {
              const durationData = await durationResponse.json();
              duration = durationData.duration || 5;
              console.log(`Got audio duration: ${duration}s for scene ${index + 1}`);
            } else {
              console.log('Could not get audio duration from server, using default');
            }
          } catch (error) {
            console.log('Error getting audio duration:', error);
          }

          return {
            ...scene,
            audioUrl: dataUrl,
            audioState: 'done' as const,
            audioDuration: duration
          };
        } catch (error) {
          console.error(`Failed to repair audio for scene ${index + 1}:`, error);
          return scene;
        }
      }
      return scene;
    }));

    return {
      ...script,
      scenes: repairedScenes
    };
  }));

  return repairedScripts;
};

// Save repaired scripts back to their scenario files
export const saveRepairedScripts = async (scripts: Script[]): Promise<void> => {
  for (const script of scripts) {
    if (!script.scenarioId) {
      console.log('Script has no scenario ID, skipping save');
      continue;
    }

    try {
      // Construct the script file path
      const scriptFileName = `${script.scenarioId}_Script.json`;
      const scriptPath = `data/scenarios/${script.scenarioId}/Script/${scriptFileName}`;

      // Save the script data to the server
      const response = await fetch('/api/save-scenario-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId: script.scenarioId,
          scriptData: script
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save script');
      }

      console.log(`Saved repaired script for scenario ${script.scenarioId}`);
    } catch (error) {
      console.error(`Failed to save repaired script for scenario ${script.scenarioId}:`, error);
    }
  }
};
