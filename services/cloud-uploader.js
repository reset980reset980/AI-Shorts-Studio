// 클라우드 스토리지 업로더 (여러 서비스 지원)
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

class CloudUploader {

  // 1. Imgur (이미지 전용, 무료, 익명 가능)
  static async uploadToImgur(imagePath) {
    const image = fs.readFileSync(imagePath, { encoding: 'base64' });

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID YOUR_IMGUR_CLIENT_ID', // 무료로 발급
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: image,
        type: 'base64'
      })
    });

    const data = await response.json();
    return data.data.link; // 직접 접근 가능한 URL
  }

  // 2. File.io (임시 파일 호스팅, 무료)
  static async uploadToFileIO(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await fetch('https://file.io', {
      method: 'POST',
      body: form
    });

    const data = await response.json();
    return data.link; // 1회 다운로드 후 자동 삭제
  }

  // 3. Cloudinary (무료 티어 있음)
  static async uploadToCloudinary(filePath, resourceType = 'auto') {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('upload_preset', 'YOUR_PRESET'); // Cloudinary 대시보드에서 생성

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/${resourceType}/upload`,
      {
        method: 'POST',
        body: form
      }
    );

    const data = await response.json();
    return data.secure_url;
  }

  // 4. GitHub Pages (정적 파일, 영구 보관)
  static async uploadToGitHub(filePath, repo, token) {
    const content = fs.readFileSync(filePath, { encoding: 'base64' });
    const fileName = path.basename(filePath);

    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/assets/${fileName}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message: `Upload ${fileName}`,
          content: content
        })
      }
    );

    const data = await response.json();
    return data.content.download_url;
  }

  // 5. 0x0.st (임시 파일, 익명, 무료)
  static async uploadTo0x0(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    const response = await fetch('https://0x0.st', {
      method: 'POST',
      body: form
    });

    return await response.text(); // 직접 URL 반환
  }
}

// 스마트 업로더 - 파일 타입에 따라 최적 서비스 선택
class SmartUploader {
  static async upload(filePath, fileType) {
    try {
      if (fileType === 'image') {
        // 이미지는 Imgur 우선
        return await CloudUploader.uploadToImgur(filePath);
      } else if (fileType === 'audio') {
        // 오디오는 Cloudinary 또는 File.io
        return await CloudUploader.uploadToCloudinary(filePath, 'video');
      } else {
        // 기타 파일은 0x0.st
        return await CloudUploader.uploadTo0x0(filePath);
      }
    } catch (error) {
      console.error('Upload failed, trying fallback:', error);
      // 실패 시 File.io로 폴백
      return await CloudUploader.uploadToFileIO(filePath);
    }
  }
}

module.exports = { CloudUploader, SmartUploader };