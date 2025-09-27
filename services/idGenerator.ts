// YouTube-style unique ID generator for scenarios
// Generates 11-character alphanumeric IDs like "2B6GHA4d0Jc"

/**
 * Generates a YouTube-style 11-character unique ID
 * Uses base64url-safe characters (A-Z, a-z, 0-9, -, _)
 * But we'll use only alphanumeric for simplicity
 */
export function generateScenarioId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';

  for (let i = 0; i < 11; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    id += chars[randomIndex];
  }

  return id;
}

/**
 * Validates if a string is a valid scenario ID
 */
export function isValidScenarioId(id: string): boolean {
  // Must be exactly 11 characters and alphanumeric
  const pattern = /^[A-Za-z0-9]{11}$/;
  return pattern.test(id);
}

/**
 * Generates a unique scenario ID and checks against existing IDs
 * @param existingIds Array of already used IDs
 * @param maxAttempts Maximum number of attempts to generate unique ID
 */
export function generateUniqueScenarioId(
  existingIds: string[] = [],
  maxAttempts: number = 100
): string {
  for (let i = 0; i < maxAttempts; i++) {
    const id = generateScenarioId();
    if (!existingIds.includes(id)) {
      return id;
    }
  }

  // Fallback: append timestamp if we can't generate unique ID
  throw new Error('Could not generate unique scenario ID after maximum attempts');
}

/**
 * Creates file names based on scenario ID and type
 */
export function createFileName(
  scenarioId: string,
  type: 'image' | 'voice' | 'script' | 'prompts' | 'srt' | 'metadata' | 'video',
  index?: number
): string {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  switch (type) {
    case 'image':
      return `${scenarioId}_Image${index}.jpg`;
    case 'voice':
      return `${scenarioId}_Voice${index}.mp3`;
    case 'script':
      return `${scenarioId}_Script.json`;
    case 'prompts':
      return `${scenarioId}_Prompts.json`;
    case 'srt':
      return `${scenarioId}_Subtitle.srt`;
    case 'metadata':
      return `${scenarioId}_metadata.json`;
    case 'video':
      return `${scenarioId}_video.mp4`;
    default:
      throw new Error(`Unknown file type: ${type}`);
  }
}

/**
 * Creates folder paths for scenario
 */
export function getScenarioPaths(scenarioId: string) {
  if (!isValidScenarioId(scenarioId)) {
    throw new Error(`Invalid scenario ID: ${scenarioId}`);
  }

  const basePath = `./data/scenarios/${scenarioId}`;

  return {
    root: basePath,
    image: `${basePath}/Image`,
    voice: `${basePath}/Voice`,
    script: `${basePath}/Script`,
    srt: `${basePath}/Srt`,
    metadata: `${basePath}/${scenarioId}_metadata.json`
  };
}

/**
 * Extracts scenario ID from file name
 */
export function extractScenarioIdFromFileName(fileName: string): string | null {
  const match = fileName.match(/^([A-Za-z0-9]{11})_/);
  return match ? match[1] : null;
}