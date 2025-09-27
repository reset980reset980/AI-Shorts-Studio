// Scenario management system with YouTube-style ID
import { Script, Settings } from '../types';
import {
  generateUniqueScenarioId,
  getScenarioPaths,
  createFileName,
  isValidScenarioId
} from './idGenerator';

interface ScenarioMetadata {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  scenes: number;
  status: 'draft' | 'generating' | 'complete' | 'rendered';
  videoPath?: string;
  youtubeTags?: string[];
}

/**
 * Creates a new scenario with unique ID
 */
export async function createScenario(script: Script): Promise<string> {
  // Use existing scenario ID if available, otherwise generate new one
  const scenarioId = script.scenarioId || generateUniqueScenarioId();

  // Add scenario ID to script
  const enhancedScript = {
    ...script,
    scenarioId,
    createdAt: script.createdAt || Date.now(),
    updatedAt: script.updatedAt || Date.now()
  };

  // Create folder structure
  await createScenarioFolders(scenarioId);

  // Save script data
  await saveScenarioScript(scenarioId, enhancedScript);

  // Create metadata
  const metadata: ScenarioMetadata = {
    id: scenarioId,
    title: script.shorts_title || script.title || 'Untitled',
    description: script.shorts_summary || script.description,
    createdAt: enhancedScript.createdAt,
    updatedAt: enhancedScript.updatedAt,
    scenes: script.scenes.length,
    status: 'draft'
  };

  await saveScenarioMetadata(scenarioId, metadata);

  return scenarioId;
}

/**
 * Creates folder structure for scenario
 */
async function createScenarioFolders(scenarioId: string): Promise<void> {
  const paths = getScenarioPaths(scenarioId);

  try {
    const response = await fetch('/api/create-scenario-folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenarioId, paths })
    });

    if (!response.ok) {
      throw new Error(`Failed to create folders: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error creating scenario folders:', error);
    throw error;
  }
}

/**
 * Saves scenario script
 */
async function saveScenarioScript(scenarioId: string, script: any): Promise<void> {
  const paths = getScenarioPaths(scenarioId);
  const scriptPath = `${paths.script}/${createFileName(scenarioId, 'script')}`;

  try {
    const response = await fetch('/api/save-scenario-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: scriptPath,
        data: script,
        type: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save script: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving scenario script:', error);
    throw error;
  }
}

/**
 * Saves scenario metadata
 */
async function saveScenarioMetadata(scenarioId: string, metadata: ScenarioMetadata): Promise<void> {
  const paths = getScenarioPaths(scenarioId);

  try {
    const response = await fetch('/api/save-scenario-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: paths.metadata,
        data: metadata,
        type: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save metadata: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving scenario metadata:', error);
    throw error;
  }
}

/**
 * Saves image for a specific scene
 */
export async function saveScenarioImage(
  scenarioId: string,
  sceneIndex: number,
  imageDataUrl: string
): Promise<string> {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  try {
    const response = await fetch('/api/save-scenario-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataUrl: imageDataUrl,
        scenarioId,
        sceneIndex
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save image: ${response.statusText}`);
    }

    const result = await response.json();
    return result.filePath;
  } catch (error) {
    console.error('Error saving scenario image:', error);
    // Return data URL as fallback
    return imageDataUrl;
  }
}

/**
 * Saves audio for a specific scene
 */
export async function saveScenarioAudio(
  scenarioId: string,
  sceneIndex: number,
  audioDataUrl: string
): Promise<string> {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  const paths = getScenarioPaths(scenarioId);
  const fileName = createFileName(scenarioId, 'voice', sceneIndex + 1);
  const filePath = `${paths.voice}/${fileName}`;

  try {
    const response = await fetch('/api/save-scenario-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath,
        data: audioDataUrl,
        type: 'audio'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save audio: ${response.statusText}`);
    }

    const result = await response.json();
    return result.path;
  } catch (error) {
    console.error('Error saving scenario audio:', error);
    // Return data URL as fallback
    return audioDataUrl;
  }
}

/**
 * Updates scenario metadata
 */
export async function updateScenarioMetadata(
  scenarioId: string,
  updates: Partial<ScenarioMetadata>
): Promise<void> {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  const paths = getScenarioPaths(scenarioId);

  try {
    // First, get existing metadata
    const getResponse = await fetch(`/api/get-scenario-file?path=${encodeURIComponent(paths.metadata)}`);

    let existingMetadata: ScenarioMetadata;
    if (getResponse.ok) {
      existingMetadata = await getResponse.json();
    } else {
      // Create new metadata if doesn't exist
      existingMetadata = {
        id: scenarioId,
        title: 'Untitled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scenes: 0,
        status: 'draft'
      };
    }

    // Merge updates
    const updatedMetadata: ScenarioMetadata = {
      ...existingMetadata,
      ...updates,
      updatedAt: Date.now()
    };

    // Save updated metadata
    await saveScenarioMetadata(scenarioId, updatedMetadata);
  } catch (error) {
    console.error('Error updating scenario metadata:', error);
    throw error;
  }
}

/**
 * Gets all scenarios
 */
export async function getAllScenarios(): Promise<ScenarioMetadata[]> {
  try {
    const response = await fetch('/api/list-scenarios');

    if (!response.ok) {
      throw new Error(`Failed to list scenarios: ${response.statusText}`);
    }

    const scenarios = await response.json();
    return scenarios;
  } catch (error) {
    console.error('Error listing scenarios:', error);
    return [];
  }
}

/**
 * Loads a specific scenario
 */
export async function loadScenario(scenarioId: string): Promise<Script | null> {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  try {
    // Use the new endpoint that returns proper media URLs
    const response = await fetch(`/api/load-scenario/${scenarioId}`);

    if (!response.ok) {
      // Fallback to old method if new endpoint doesn't exist
      if (response.status === 404) {
        const paths = getScenarioPaths(scenarioId);
        const scriptPath = `${paths.script}/${createFileName(scenarioId, 'script')}`;
        const fallbackResponse = await fetch(`/api/get-scenario-file?path=${encodeURIComponent(scriptPath)}`);

        if (!fallbackResponse.ok) {
          throw new Error(`Failed to load scenario: ${fallbackResponse.statusText}`);
        }

        const script = await fallbackResponse.json();
        return script;
      }
      throw new Error(`Failed to load scenario: ${response.statusText}`);
    }

    const script = await response.json();

    // Force convert data URLs to server URLs
    if (script && script.scenes) {
      const baseUrl = window.location.origin;

      script.scenes = script.scenes.map((scene: any, index: number) => {
        const sceneNum = index + 1;

        // If imageUrl is a data URL, convert to server URL
        if (scene.imageUrl && scene.imageUrl.startsWith('data:')) {
          scene.imageUrl = `${baseUrl}/api/scenarios/${scenarioId}/Image/${scenarioId}_Image${sceneNum}.jpg`;
        }

        // If audioUrl is a data URL, convert to server URL
        if (scene.audioUrl && scene.audioUrl.startsWith('data:')) {
          scene.audioUrl = `${baseUrl}/api/scenarios/${scenarioId}/Voice/${scenarioId}_Voice${sceneNum}.mp3`;
        }

        return scene;
      });
    }

    return script;
  } catch (error) {
    console.error('Error loading scenario:', error);
    return null;
  }
}