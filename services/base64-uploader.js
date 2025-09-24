// Base64 인코딩을 통한 직접 전송 방식
const fs = require('fs');
const path = require('path');

class Base64Uploader {
  // 이미지를 Base64 데이터 URI로 변환
  static imageToDataUri(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }[ext] || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  }

  // 오디오를 Base64 데이터 URI로 변환
  static audioToDataUri(audioPath) {
    const audioBuffer = fs.readFileSync(audioPath);
    const base64 = audioBuffer.toString('base64');
    return `data:audio/mp3;base64,${base64}`;
  }

  // 파일 크기 체크 (Shotstack 제한 확인)
  static checkFileSize(filePath, maxSizeMB = 10) {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > maxSizeMB) {
      throw new Error(`파일 크기가 ${maxSizeMB}MB를 초과합니다: ${fileSizeMB.toFixed(2)}MB`);
    }

    return fileSizeMB;
  }
}

module.exports = Base64Uploader;