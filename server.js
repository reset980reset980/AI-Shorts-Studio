import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directories exist
const ensureDirectories = () => {
  const dirs = [
    'data/scenario',
    'data/scenarios', // New scenarios folder structure
    'data/image',
    'data/voice',
    'data/mp4',
    'header',
    'bgm',
    'font',
    'src'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

ensureDirectories();

const app = express();
const PORT = 5900; // Using 5900 (already port forwarded)

// Store for data URL assets
const assetStore = new Map();

// Enable CORS for all origins (Shotstack needs access)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: true
}));

// Add OPTIONS handler for preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' })); // Large limit for base64 data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Endpoint to store asset data
app.post('/api/assets/store', (req, res) => {
  const { filename, data, type } = req.body;

  if (!filename || !data) {
    return res.status(400).json({ error: 'Missing filename or data' });
  }

  // Store the asset
  assetStore.set(filename, { data, type: type || 'application/octet-stream' });

  console.log(`Stored asset: ${filename} (${type})`);

  // Get the request host to build proper URL
  const protocol = req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;

  res.json({
    success: true,
    url: `${protocol}://${host}/api/assets/${encodeURIComponent(filename)}`
  });
});

// Endpoint to serve assets
app.get('/api/assets/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const asset = assetStore.get(filename);

  if (!asset) {
    console.log(`Asset not found: ${filename}`);
    return res.status(404).json({ error: 'Asset not found' });
  }

  // Parse data URL
  const { data, type } = asset;

  if (data.startsWith('data:')) {
    const matches = data.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      res.set('Content-Type', mimeType);
      res.set('Content-Length', buffer.length.toString());
      res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      console.log(`Serving asset: ${filename} (${mimeType}, ${buffer.length} bytes)`);
      res.send(buffer);
    } else {
      res.status(400).json({ error: 'Invalid data URL format' });
    }
  } else {
    // Assume it's raw base64
    const buffer = Buffer.from(data, 'base64');
    res.set('Content-Type', type);
    res.set('Content-Length', buffer.length.toString());
    res.set('Cache-Control', 'public, max-age=3600');

    console.log(`Serving raw asset: ${filename} (${type}, ${buffer.length} bytes)`);
    res.send(buffer);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    assets: assetStore.size,
    port: PORT
  });
});

// List all stored assets
app.get('/api/assets', (req, res) => {
  const assets = Array.from(assetStore.keys());
  res.json({ assets });
});

// Clear all stored assets
app.delete('/api/assets', (req, res) => {
  assetStore.clear();
  console.log('Cleared all stored assets');
  res.json({ success: true });
});

// Download video from URL and save to disk
app.post('/api/download-video', async (req, res) => {
  const { url, filename } = req.body;

  if (!url || !filename) {
    return res.status(400).json({ error: 'URL and filename are required' });
  }

  try {
    // Ensure data/mp4 directory exists
    const mp4Dir = path.join(__dirname, 'data', 'mp4');
    await fs.mkdir(mp4Dir, { recursive: true });

    const filePath = path.join(mp4Dir, filename);

    // Download video from URL
    console.log(`Downloading video from ${url} to ${filePath}`);

    const https = require('https');
    const fileStream = createWriteStream(filePath);

    await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Video downloaded successfully: ${filename}`);
          resolve();
        });
      }).on('error', (err) => {
        unlinkSync(filePath); // Delete the file on error
        reject(err);
      });
    });

    // Also save video metadata
    const metadataPath = filePath.replace('.mp4', '.json');
    await fs.writeFile(metadataPath, JSON.stringify({
      url: url,
      filename: filename,
      downloadedAt: new Date().toISOString(),
      status: 'ready'
    }, null, 2));

    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save file to disk
app.post('/api/save-file', async (req, res) => {
  const { type, filename, data, url } = req.body;

  try {
    let dirPath;
    switch (type) {
      case 'image':
        dirPath = path.join(__dirname, 'data', 'image');
        break;
      case 'voice':
        dirPath = path.join(__dirname, 'data', 'voice');
        break;
      case 'scenario':
        dirPath = path.join(__dirname, 'data', 'scenario');
        break;
      case 'mp4':
        dirPath = path.join(__dirname, 'data', 'mp4');
        break;
      default:
        return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join(dirPath, filename);

    // Save file based on type
    if (type === 'mp4' && url) {
      // For videos, just save the URL reference
      await fs.writeFile(filePath + '.url', url);
    } else if (data) {
      // For other files, save the actual data
      if (data.startsWith('data:')) {
        // Extract base64 data
        const base64Data = data.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
      } else if (type === 'scenario') {
        // For JSON data, save as is
        await fs.writeFile(filePath, data);
      } else {
        // Save raw data
        await fs.writeFile(filePath, data);
      }
    }

    console.log(`Saved ${type} file: ${filename}`);
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save settings to JSON files
app.post('/api/save-settings', async (req, res) => {
  const { prompts, apiKeys, videoSettings } = req.body;

  try {
    // Save each prompt to separate files
    if (prompts) {
      // Save script prompt to short_script_prompt.json
      if (prompts.scriptPrompt !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'short_script_prompt.json'),
          JSON.stringify({ scriptPrompt: prompts.scriptPrompt }, null, 2)
        );
      }

      // Save image prompt and style to short_image_prompt.json
      if (prompts.imagePrompt !== undefined || prompts.imageStyle !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'short_image_prompt.json'),
          JSON.stringify({
            imageStyle: prompts.imageStyle,
            imagePrompt: prompts.imagePrompt
          }, null, 2)
        );
      }

      // Save shell prompt to ssul_prompt.json
      if (prompts.shellPrompt !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'ssul_prompt.json'),
          JSON.stringify({ shellPrompt: prompts.shellPrompt }, null, 2)
        );
      }

      // Save YouTube tags to youtube_tag.json
      if (prompts.youtubeTags !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'youtube_tag.json'),
          JSON.stringify({ youtubeTags: prompts.youtubeTags }, null, 2)
        );
      }

      // Save voice model to voice_model.json
      if (prompts.voiceModel !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'voice_model.json'),
          JSON.stringify({ voiceModel: prompts.voiceModel }, null, 2)
        );
      }

      // Save image generation mode to image_generation_mode.json
      if (prompts.imageGenerationMode !== undefined) {
        await fs.writeFile(
          path.join(__dirname, 'src', 'image_generation_mode.json'),
          JSON.stringify({ imageGenerationMode: prompts.imageGenerationMode }, null, 2)
        );
      }
    }

    // Save API keys to src/apikeys.json
    if (apiKeys) {
      await fs.writeFile(
        path.join(__dirname, 'src', 'apikeys.json'),
        JSON.stringify(apiKeys, null, 2)
      );
    }

    // Save video settings to src/videoSettings.json
    if (videoSettings) {
      await fs.writeFile(
        path.join(__dirname, 'src', 'videoSettings.json'),
        JSON.stringify(videoSettings, null, 2)
      );
    }

    console.log('Settings saved successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get IP configuration
app.get('/api/ip-config', async (req, res) => {
  try {
    const ipConfigPath = path.join(__dirname, 'src', 'ip_config.json');
    const ipConfigData = await fs.readFile(ipConfigPath, 'utf-8');
    const ipConfig = JSON.parse(ipConfigData);
    res.json(ipConfig);
  } catch (error) {
    console.error('Error reading IP config:', error);
    res.status(500).json({ error: 'Failed to read IP config' });
  }
});

// Save IP configuration
app.post('/api/save-ip-config', async (req, res) => {
  try {
    const { externalIp, serverPort } = req.body;
    const ipConfigPath = path.join(__dirname, 'src', 'ip_config.json');

    await fs.writeFile(ipConfigPath, JSON.stringify({
      externalIp,
      serverPort
    }, null, 2));

    console.log('[Settings] IP config saved:', externalIp, serverPort);
    res.json({ success: true, message: 'IP config saved successfully' });
  } catch (error) {
    console.error('Error saving IP config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load settings from JSON files
app.get('/api/load-settings', async (req, res) => {
  try {
    let prompts = {};
    let apiKeys = {};
    let videoSettings = {};

    // Load IP configuration for dynamic localServerUrl
    let localServerUrl = '';
    let externalIp = '';
    let serverPort = '';
    try {
      const ipConfigPath = path.join(__dirname, 'src', 'ip_config.json');
      if (existsSync(ipConfigPath)) {
        const ipConfigData = await fs.readFile(ipConfigPath, 'utf-8');
        const ipConfig = JSON.parse(ipConfigData);
        externalIp = ipConfig.externalIp;
        serverPort = ipConfig.serverPort;
        localServerUrl = `http://${ipConfig.externalIp}:${ipConfig.serverPort}`;
        console.log('[Settings] Dynamic localServerUrl:', localServerUrl);
      }
    } catch (error) {
      console.log('[Settings] Using default localServerUrl');
    }

    // Load each prompt file separately
    const promptFiles = [
      { file: 'short_script_prompt.json', key: 'scriptPrompt' },
      { file: 'short_image_prompt.json', keys: ['imageStyle', 'imagePrompt'] },
      { file: 'ssul_prompt.json', key: 'shellPrompt' },
      { file: 'youtube_tag.json', key: 'youtubeTags' },
      { file: 'voice_model.json', key: 'voiceModel' },
      { file: 'image_generation_mode.json', key: 'imageGenerationMode' }
    ];

    // Load each prompt file
    for (const promptFile of promptFiles) {
      const filePath = path.join(__dirname, 'src', promptFile.file);
      if (existsSync(filePath)) {
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);

          if (promptFile.keys) {
            // Handle multiple keys (like imageStyle and imagePrompt)
            promptFile.keys.forEach(key => {
              if (parsed[key] !== undefined) {
                prompts[key] = parsed[key];
              }
            });
          } else if (promptFile.key) {
            // Handle single key
            if (parsed[promptFile.key] !== undefined) {
              prompts[promptFile.key] = parsed[promptFile.key];
            }
          }
        } catch (err) {
          console.log(`Could not load ${promptFile.file}:`, err.message);
        }
      }
    }

    // Try to load API keys
    const apiKeysPath = path.join(__dirname, 'src', 'apikeys.json');
    if (existsSync(apiKeysPath)) {
      const data = await fs.readFile(apiKeysPath, 'utf-8');
      apiKeys = JSON.parse(data);
    }

    // Try to load video settings
    const videoSettingsPath = path.join(__dirname, 'src', 'videoSettings.json');
    if (existsSync(videoSettingsPath)) {
      const data = await fs.readFile(videoSettingsPath, 'utf-8');
      videoSettings = JSON.parse(data);
    }

    // Include dynamic localServerUrl and IP settings in apiKeys
    if (localServerUrl) {
      apiKeys.localServerUrl = localServerUrl;
    }
    if (externalIp) {
      apiKeys.externalIp = externalIp;
    }
    if (serverPort) {
      apiKeys.serverPort = serverPort;
    }

    res.json({ prompts, apiKeys, videoSettings });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load asset from folder
app.get('/api/load-asset/:type/:filename?', async (req, res) => {
  const { type, filename } = req.params;

  try {
    let dirPath;
    let defaultFile;

    switch (type) {
      case 'header':
        dirPath = path.join(__dirname, 'header');
        defaultFile = 'default.png';
        break;
      case 'bgm':
        dirPath = path.join(__dirname, 'bgm');
        defaultFile = 'default.mp3';
        break;
      case 'font':
        dirPath = path.join(__dirname, 'font');
        defaultFile = 'default.ttf';
        break;
      default:
        return res.status(400).json({ error: 'Invalid asset type' });
    }

    // Try to load the requested file or default
    const fileName = filename && filename !== 'default' ? filename : defaultFile;
    const filePath = path.join(dirPath, fileName);

    if (!existsSync(filePath)) {
      // Try to find any file in the directory
      const files = await fs.readdir(dirPath);
      if (files.length > 0) {
        const firstFile = files[0];
        const firstFilePath = path.join(dirPath, firstFile);
        const data = await fs.readFile(firstFilePath);
        res.set('Content-Type', getMimeType(firstFile));
        res.send(data);
        return;
      }
      return res.status(404).json({ error: 'No asset found' });
    }

    const data = await fs.readFile(filePath);
    res.set('Content-Type', getMimeType(fileName));
    res.send(data);
  } catch (error) {
    console.error('Error loading asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get MIME type
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.mp3':
      return 'audio/mpeg';
    case '.ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

// List images endpoint
app.get('/api/list-images', async (req, res) => {
    const imageDir = path.join(__dirname, 'data', 'image');

    if (!existsSync(imageDir)) {
        return res.json({ images: [] });
    }

    try {
        const files = await fs.readdir(imageDir);
        const imageFiles = files.filter(file =>
            file.endsWith('.jpg') ||
            file.endsWith('.jpeg') ||
            file.endsWith('.png')
        );
        res.json({ images: imageFiles });
    } catch (error) {
        console.error('Error listing images:', error);
        res.status(500).json({ error: 'Failed to list images' });
    }
});

// Get single image endpoint
app.get('/api/get-image/:filename', async (req, res) => {
    const { filename } = req.params;
    const imagePath = path.join(__dirname, 'data', 'image', filename);

    if (!existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image not found' });
    }

    try {
        const imageBuffer = await fs.readFile(imagePath);
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';

        res.setHeader('Content-Type', contentType);
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error reading image:', error);
        res.status(500).json({ error: 'Failed to read image' });
    }
});

// Save voice file endpoint
app.post('/api/save-voice', async (req, res) => {
  const { dataUrl, filename } = req.body;

  if (!dataUrl || !filename) {
    return res.status(400).json({ error: 'Missing dataUrl or filename' });
  }

  try {
    const base64Data = dataUrl.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(__dirname, 'data', 'voice', filename);

    await fs.writeFile(filePath, buffer);
    console.log('Saved voice file:', filename);

    res.json({ success: true, message: 'Voice file saved' });
  } catch (error) {
    console.error('Error saving voice file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save image file endpoint (legacy)
app.post('/api/save-image', async (req, res) => {
  const { dataUrl, filename } = req.body;

  if (!dataUrl || !filename) {
    return res.status(400).json({ error: 'Missing dataUrl or filename' });
  }

  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(__dirname, 'data', 'image', filename);

    await fs.writeFile(filePath, buffer);
    console.log('Saved image file:', filename);

    res.json({ success: true, message: 'Image file saved' });
  } catch (error) {
    console.error('Error saving image file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save scenario image file endpoint
app.post('/api/save-scenario-image', async (req, res) => {
  const { dataUrl, scenarioId, sceneIndex } = req.body;

  if (!dataUrl || !scenarioId || sceneIndex === undefined) {
    return res.status(400).json({ error: 'Missing dataUrl, scenarioId, or sceneIndex' });
  }

  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create scenario folder structure if it doesn't exist
    const scenarioDir = path.join(__dirname, 'data', 'scenarios', scenarioId);
    const imageDir = path.join(scenarioDir, 'Image');

    if (!existsSync(imageDir)) {
      await fs.mkdir(imageDir, { recursive: true });
    }

    const filename = `${scenarioId}_Image${sceneIndex + 1}.jpg`;
    const filePath = path.join(imageDir, filename);

    await fs.writeFile(filePath, buffer);
    console.log(`Saved scenario image file: ${filePath}`);

    res.json({
      success: true,
      message: 'Scenario image file saved',
      filename,
      filePath: `./data/scenarios/${scenarioId}/Image/${filename}`
    });
  } catch (error) {
    console.error('Error saving scenario image file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save scenario scripts endpoint
app.post('/api/save-scenario-scripts', async (req, res) => {
  const { title, timestamp, scripts } = req.body;

  if (!title || !timestamp || !scripts) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const filename = `scenario_scripts_${timestamp}.json`;
    const filePath = path.join(__dirname, 'data', 'scenario', filename);

    await fs.writeFile(filePath, JSON.stringify({
      title,
      timestamp,
      scripts
    }, null, 2));

    console.log('Saved scenario scripts:', filename);
    res.json({ success: true, message: 'Scenario scripts saved' });
  } catch (error) {
    console.error('Error saving scenario scripts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save scenario prompts endpoint
app.post('/api/save-scenario-prompts', async (req, res) => {
  const { title, timestamp, prompts } = req.body;

  if (!title || !timestamp || !prompts) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    const filename = `scenario_prompts_${timestamp}.json`;
    const filePath = path.join(__dirname, 'data', 'scenario', filename);

    await fs.writeFile(filePath, JSON.stringify({
      title,
      timestamp,
      prompts
    }, null, 2));

    console.log('Saved scenario prompts:', filename);
    res.json({ success: true, message: 'Scenario prompts saved' });
  } catch (error) {
    console.error('Error saving scenario prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Script storage endpoints to replace localStorage
app.post('/api/save-scripts', async (req, res) => {
  const { scripts } = req.body;

  if (!scripts || !Array.isArray(scripts)) {
    return res.status(400).json({ error: 'Invalid scripts data' });
  }

  try {
    const filePath = path.join(__dirname, 'src', 'scripts.json');
    await fs.writeFile(filePath, JSON.stringify(scripts, null, 2));
    console.log(`Saved ${scripts.length} scripts to backend`);
    res.json({ success: true, count: scripts.length });
  } catch (error) {
    console.error('Error saving scripts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/load-scripts', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'src', 'scripts.json');

    if (!existsSync(filePath)) {
      return res.json({ scripts: [] });
    }

    const data = await fs.readFile(filePath, 'utf-8');
    const scripts = JSON.parse(data);

    if (!Array.isArray(scripts)) {
      console.warn('Scripts file contains invalid data, returning empty array');
      return res.json({ scripts: [] });
    }

    console.log(`Loaded ${scripts.length} scripts from backend`);
    res.json({ scripts });
  } catch (error) {
    console.error('Error loading scripts:', error);
    // Return empty array instead of error to allow app to continue
    res.json({ scripts: [] });
  }
});

// Clear scripts endpoint for cleanup
app.delete('/api/clear-scripts', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'src', 'scripts.json');
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    console.log('Cleared all scripts from backend');
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing scripts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of saved scenarios
app.get('/api/list-scenarios', async (req, res) => {
  try {
    const scenariosDir = path.join(__dirname, 'data', 'scenario');

    // Ensure directory exists
    try {
      await fs.access(scenariosDir);
    } catch {
      await fs.mkdir(scenariosDir, { recursive: true });
    }

    const files = await fs.readdir(scenariosDir);
    const scriptFiles = files.filter(f => f.startsWith('scenario_scripts_') && f.endsWith('.json'));

    const scenarios = await Promise.all(scriptFiles.map(async (file) => {
      try {
        const filePath = path.join(scenariosDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const scriptData = JSON.parse(content);

        // Extract timestamp from filename to match prompts file
        const timestamp = file.match(/scenario_scripts_(\d+)\.json/)?.[1];
        if (!timestamp) {
          console.warn(`Could not extract timestamp from file: ${file}`);
          return null;
        }

        // Try to load matching prompts file
        const promptsFile = `scenario_prompts_${timestamp}.json`;
        const promptsPath = path.join(scenariosDir, promptsFile);
        let prompts = {};

        try {
          if (existsSync(promptsPath)) {
            const promptsContent = await fs.readFile(promptsPath, 'utf8');
            prompts = JSON.parse(promptsContent);
          }
        } catch (promptError) {
          console.warn(`Could not load prompts for ${file}:`, promptError.message);
        }

        // Transform data to match frontend expectations
        const transformedScript = transformScenarioData(scriptData, prompts);

        return {
          scripts: [transformedScript] // Wrap in array to match expected format
        };
      } catch (error) {
        console.error(`Error processing scenario file ${file}:`, error);
        return null;
      }
    }));

    // Filter out null results and flatten
    const validScenarios = scenarios.filter(s => s !== null);

    res.json({ success: true, scenarios: validScenarios });
  } catch (error) {
    console.error('Error listing scenarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to transform scenario data to Script format
function transformScenarioData(scriptData, prompts) {
  if (!scriptData || !scriptData.scripts || !Array.isArray(scriptData.scripts)) {
    throw new Error('Invalid script data format');
  }

  // Generate a unique ID for the script
  const scriptId = `script_${scriptData.timestamp || Date.now()}`;

  // Transform scenes to match expected format
  const scenes = scriptData.scripts.map((scene, index) => {
    // Try to find matching prompt
    const matchingPrompt = prompts.prompts?.find(p => p.sceneId === scene.sceneId || p.order === scene.order);

    return {
      id: scene.sceneId || (index + 1),
      time: scene.time || `00:${(index * 15).toString().padStart(2, '0')} - 00:${((index + 1) * 15).toString().padStart(2, '0')}`,
      script: scene.script || '',
      imagePrompt: matchingPrompt?.imagePrompt || `anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 : Scene ${index + 1}`,
      imageUrl: undefined,
      audioUrl: undefined,
      audioData: undefined,
      duration: undefined,
      imageState: 'pending',
      audioState: 'pending'
    };
  });

  return {
    id: scriptId,
    channel: 'UNKNOWN',
    title: scriptData.title || '제목 없음',
    shorts_title: scriptData.title || '제목 없음',
    shorts_summary: '시나리오에서 불러온 스크립트',
    scenes: scenes,
    status: 'pending'
  };
}

// Endpoint to get voice files for scenarios
app.get('/api/list-voice-files', async (req, res) => {
  try {
    const voiceDir = path.join(__dirname, 'data', 'voice');

    if (!existsSync(voiceDir)) {
      return res.json({ voices: [] });
    }

    const files = await fs.readdir(voiceDir);
    const voiceFiles = files.filter(file =>
      file.endsWith('.mp3') ||
      file.endsWith('.wav') ||
      file.endsWith('.m4a')
    );

    const voiceDetails = await Promise.all(voiceFiles.map(async (file) => {
      const filePath = path.join(voiceDir, file);
      const stats = await fs.stat(filePath);
      return {
        filename: file,
        size: stats.size,
        created: stats.mtime
      };
    }));

    // Sort by creation time (newest first)
    voiceDetails.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    res.json({ voices: voiceDetails });
  } catch (error) {
    console.error('Error listing voice files:', error);
    res.status(500).json({ error: 'Failed to list voice files' });
  }
});

// Endpoint to get a voice file
app.get('/api/get-voice/:filename', async (req, res) => {
  const { filename } = req.params;
  const voicePath = path.join(__dirname, 'data', 'voice', filename);

  if (!existsSync(voicePath)) {
    return res.status(404).json({ error: 'Voice file not found' });
  }

  try {
    const audioBuffer = await fs.readFile(voicePath);
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.m4a') contentType = 'audio/mp4';

    res.setHeader('Content-Type', contentType);
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error reading voice file:', error);
    res.status(500).json({ error: 'Failed to read voice file' });
  }
});

// New endpoints for scenario management with YouTube-style IDs

// Create scenario folders
app.post('/api/create-scenario-folders', async (req, res) => {
  const { scenarioId, paths } = req.body;

  if (!scenarioId || !paths) {
    return res.status(400).json({ error: 'Missing scenarioId or paths' });
  }

  try {
    // Create all required folders
    for (const [key, folderPath] of Object.entries(paths)) {
      if (key !== 'metadata') {
        const fullPath = path.join(__dirname, folderPath);
        if (!existsSync(fullPath)) {
          await fs.mkdir(fullPath, { recursive: true });
          console.log(`Created folder: ${folderPath}`);
        }
      }
    }

    res.json({ success: true, message: 'Scenario folders created' });
  } catch (error) {
    console.error('Error creating scenario folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save scenario file (generic endpoint for any scenario file)
app.post('/api/save-scenario-file', async (req, res) => {
  const { path: filePath, data, type } = req.body;

  if (!filePath || !data) {
    return res.status(400).json({ error: 'Missing path or data' });
  }

  try {
    const fullPath = path.join(__dirname, filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Save file based on type
    if (type === 'json') {
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
    } else if (type === 'text' || type === 'srt') {
      await fs.writeFile(fullPath, data);
    } else if (type === 'image' || type === 'audio') {
      // Handle base64 data
      let buffer;
      if (data.startsWith('data:')) {
        const base64Data = data.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(data, 'base64');
      }
      await fs.writeFile(fullPath, buffer);
    } else {
      await fs.writeFile(fullPath, data);
    }

    console.log(`Saved scenario file: ${filePath}`);
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error saving scenario file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scenario file
app.get('/api/get-scenario-file', async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  try {
    const fullPath = path.join(__dirname, filePath);

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(fullPath).toLowerCase();

    // Determine how to read the file based on extension
    if (ext === '.json') {
      const content = await fs.readFile(fullPath, 'utf8');
      res.json(JSON.parse(content));
    } else if (ext === '.srt' || ext === '.txt') {
      const content = await fs.readFile(fullPath, 'utf8');
      res.send(content);
    } else {
      // Binary files (images, audio)
      const buffer = await fs.readFile(fullPath);
      const mimeType = getMimeType(path.basename(fullPath)); // Use filename instead of ext
      res.setHeader('Content-Type', mimeType);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Error reading scenario file:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all scenarios with new structure
app.get('/api/list-scenarios-new', async (req, res) => {
  try {
    const scenariosDir = path.join(__dirname, 'data', 'scenarios');

    if (!existsSync(scenariosDir)) {
      return res.json({ scenarios: [] });
    }

    const folders = await fs.readdir(scenariosDir);
    const scenarios = [];

    for (const folder of folders) {
      const folderPath = path.join(scenariosDir, folder);
      const stats = await fs.stat(folderPath);

      if (stats.isDirectory()) {
        // Check for metadata file - try both naming conventions
        let metadataPath = path.join(folderPath, 'metadata.json');
        if (!existsSync(metadataPath)) {
          metadataPath = path.join(folderPath, `${folder}_metadata.json`);
        }

        if (existsSync(metadataPath)) {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

          // Load the actual script files
          const scriptFolder = path.join(folderPath, 'Script');
          if (existsSync(scriptFolder)) {
            const scriptFiles = await fs.readdir(scriptFolder);
            const scripts = [];

            for (const scriptFile of scriptFiles) {
              if (scriptFile.endsWith('.json')) {
                const scriptPath = path.join(scriptFolder, scriptFile);
                const scriptData = JSON.parse(await fs.readFile(scriptPath, 'utf8'));
                scripts.push(scriptData);
              }
            }

            scenarios.push({
              ...metadata,
              scripts
            });
          } else {
            scenarios.push(metadata);
          }
        }
      }
    }

    // Sort by creation date (newest first)
    scenarios.sort((a, b) => b.createdAt - a.createdAt);

    res.json({ scenarios });
  } catch (error) {
    console.error('Error listing new scenarios:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audio duration endpoint
app.get('/api/audio-duration', async (req, res) => {
  try {
    const { filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    const fullPath = path.join(__dirname, filePath);

    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    // Use music-metadata for more reliable duration extraction
    const mm = await import('music-metadata');
    const metadata = await mm.parseFile(fullPath);
    const duration = metadata.format.duration;

    if (!duration || duration <= 0) {
      throw new Error('Invalid audio duration');
    }

    res.json({
      duration: duration,
      path: filePath
    });
  } catch (error) {
    console.error('Error getting audio duration:', error);
    // Fallback to estimation if library fails
    try {
      const stats = await fs.stat(path.join(__dirname, filePath));
      const fileSize = stats.size;
      const bitrate = 128000; // 128 kbps fallback
      const estimatedDuration = (fileSize * 8) / bitrate;

      res.json({
        duration: estimatedDuration,
        path: filePath,
        fallback: true
      });
    } catch (fallbackError) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Save scenario script endpoint
app.post('/api/save-scenario-script', async (req, res) => {
  try {
    const { scenarioId, scriptData } = req.body;

    if (!scenarioId || !scriptData) {
      return res.status(400).json({ error: 'Missing scenarioId or scriptData' });
    }

    // Create scenario folder structure if it doesn't exist
    const scenarioDir = path.join(__dirname, 'data', 'scenarios', scenarioId);
    const scriptDir = path.join(scenarioDir, 'Script');

    if (!existsSync(scriptDir)) {
      await fs.mkdir(scriptDir, { recursive: true });
    }

    const scriptFileName = `${scenarioId}_Script.json`;
    const scriptPath = path.join(scriptDir, scriptFileName);

    // Save the script data
    await fs.writeFile(scriptPath, JSON.stringify(scriptData, null, 2));

    console.log('Saved scenario script:', scriptFileName);

    res.json({
      success: true,
      message: 'Scenario script saved successfully',
      path: scriptPath
    });
  } catch (error) {
    console.error('Error saving scenario script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve scenario media files (images, audio)
app.get('/api/scenarios/:scenarioId/:type/:filename', (req, res) => {
  try {
    const { scenarioId, type, filename } = req.params;

    // Validate type
    const validTypes = ['Image', 'Voice', 'Script', 'Srt'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Build file path
    const filePath = path.join(__dirname, 'data', 'scenarios', scenarioId, type, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    let contentType = 'application/octet-stream';
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.mp3': 'audio/mpeg',
      '.json': 'application/json',
      '.srt': 'text/plain'
    };
    contentType = mimeTypes[ext] || contentType;

    // Send file
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving scenario file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load scenario with proper media URLs
app.get('/api/load-scenario/:scenarioId', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const scenarioDir = path.join(__dirname, 'data', 'scenarios', scenarioId);
    const scriptPath = path.join(scenarioDir, 'Script', `${scenarioId}_Script.json`);

    if (!existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scriptData = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

    // Get the external IP from ip_config.json or use request host as fallback
    let baseUrl;
    try {
      const ipConfigPath = path.join(__dirname, 'src', 'ip_config.json');
      if (existsSync(ipConfigPath)) {
        const ipConfigData = await fs.readFile(ipConfigPath, 'utf-8');
        const ipConfig = JSON.parse(ipConfigData);
        if (ipConfig.externalIp && ipConfig.serverPort) {
          baseUrl = `http://${ipConfig.externalIp}:${ipConfig.serverPort}`;
          console.log('Using external IP for URLs:', baseUrl);
        }
      }
    } catch (error) {
      console.warn('Could not read ip_config.json, using request host:', error.message);
    }

    // Fallback to request host if ip_config not available
    if (!baseUrl) {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      baseUrl = `${protocol}://${host}`;
    }

    // Update media URLs to use server endpoints
    if (scriptData.scenes) {
      scriptData.scenes = scriptData.scenes.map((scene, index) => {
        const sceneNum = index + 1;

        // Always use server URLs for saved scenarios
        // Build server URLs for the files
        let imageUrl = `${baseUrl}/api/scenarios/${scenarioId}/Image/${scenarioId}_Image${sceneNum}.jpg`;
        let audioUrl = `${baseUrl}/api/scenarios/${scenarioId}/Voice/${scenarioId}_Voice${sceneNum}.mp3`;

        // Check if the files actually exist
        const imagePath = path.join(scenarioDir, 'Image', `${scenarioId}_Image${sceneNum}.jpg`);
        const audioPath = path.join(scenarioDir, 'Voice', `${scenarioId}_Voice${sceneNum}.mp3`);

        // If image file doesn't exist and scene has data URL, keep the data URL
        // Otherwise use server URL
        if (!existsSync(imagePath) && scene.imageUrl && scene.imageUrl.startsWith('data:')) {
          imageUrl = scene.imageUrl;
        }

        // If audio file doesn't exist and scene has data URL, keep the data URL
        // Otherwise use server URL
        if (!existsSync(audioPath) && scene.audioUrl && scene.audioUrl.startsWith('data:')) {
          audioUrl = scene.audioUrl;
        }

        console.log(`Scene ${sceneNum} - Image URL type: ${imageUrl.substring(0, 20)}...`);
        console.log(`Scene ${sceneNum} - Audio URL type: ${audioUrl.substring(0, 20)}...`);

        return {
          ...scene,
          imageUrl,
          audioUrl
        };
      });
    }

    res.json(scriptData);
  } catch (error) {
    console.error('Error loading scenario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Note: getMimeType function already defined above at line 391

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Asset server running on http://0.0.0.0:${PORT}`);
  console.log(`Local network access: http://localhost:${PORT}`);
  console.log('Ready to serve assets to Shotstack');
});