// Test ngrok integration with Shotstack API
const fs = require('fs');
const path = require('path');

// Simulate what the app does
const testNgrokIntegration = async () => {
  const ngrokUrl = 'https://jolly-obliging-llama.ngrok-free.app'; // Your ngrok URL
  const shotstackApiKey = 'YOUR_SHOTSTACK_API_KEY'; // You need to set this

  // Test file path
  const testImagePath = 'D:\\ai-shorts-studio\\AI-Shorts-Studio\\data\\images\\test\\scene_1.jpg';
  const testAudioPath = 'D:\\ai-shorts-studio\\AI-Shorts-Studio\\data\\audio\\test\\scene_1.mp3';

  // Convert to HTTP URL
  const toHttpUrl = (filePath) => {
    const dataIndex = filePath.indexOf('data');
    if (dataIndex === -1) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    const relativePath = filePath.substring(dataIndex).replace(/\\/g, '/');
    return `${ngrokUrl}/${relativePath}`;
  };

  // Create test payload
  const imageUrl = toHttpUrl(testImagePath);
  const audioUrl = toHttpUrl(testAudioPath);

  console.log('Image URL:', imageUrl);
  console.log('Audio URL:', audioUrl);

  // Test if ngrok URLs are accessible
  console.log('\nTesting ngrok URL accessibility...');

  try {
    // Test if ngrok tunnel is working
    const response = await fetch(ngrokUrl);
    console.log('ngrok response status:', response.status);

    if (response.ok) {
      console.log('✅ ngrok tunnel is working');
    } else {
      console.log('❌ ngrok tunnel returned error:', response.status);
    }
  } catch (error) {
    console.error('❌ Failed to connect to ngrok:', error.message);
    console.log('\nMake sure ngrok is running with: ngrok http 5900');
  }

  // Create Shotstack payload
  const payload = {
    "timeline": {
      "background": "#000000",
      "tracks": [
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": imageUrl
              },
              "start": 0,
              "length": 5
            },
            {
              "asset": {
                "type": "audio",
                "src": audioUrl,
                "volume": 1
              },
              "start": 0,
              "length": 5
            }
          ]
        }
      ]
    },
    "output": {
      "format": "mp4",
      "resolution": "hd",
      "aspectRatio": "9:16",
      "fps": 25
    }
  };

  console.log('\nShotstack payload:');
  console.log(JSON.stringify(payload, null, 2));

  // Note: To actually test with Shotstack, you'd need to:
  // 1. Set the correct API key above
  // 2. Uncomment the code below

  /*
  const SHOTSTACK_API_URL = 'https://api.shotstack.io/stage';

  try {
    const response = await fetch(`${SHOTSTACK_API_URL}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': shotstackApiKey
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Shotstack response:', responseText);

    const data = JSON.parse(responseText);
    console.log('Render ID:', data.response?.id);
  } catch (error) {
    console.error('Shotstack error:', error);
  }
  */
};

// Run the test
testNgrokIntegration().catch(console.error);