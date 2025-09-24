// ffmpeg를 사용한 로컬 비디오 렌더링 예시
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class FFmpegRenderer {
  constructor() {
    this.ffmpegPath = 'ffmpeg'; // 또는 전체 경로
  }

  // 이미지와 오디오를 결합하여 비디오 생성
  async renderScene(imagePath, audioPath, outputPath, duration) {
    return new Promise((resolve, reject) => {
      const command = `${this.ffmpegPath} -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${duration} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "${outputPath}" -y`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg error:', stderr);
          reject(error);
        } else {
          console.log('Scene rendered:', outputPath);
          resolve(outputPath);
        }
      });
    });
  }

  // 여러 비디오 클립 연결
  async concatenateScenes(videoPaths, outputPath) {
    // concat 파일 생성
    const concatFile = path.join(path.dirname(outputPath), 'concat.txt');
    const fileContent = videoPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatFile, fileContent);

    return new Promise((resolve, reject) => {
      const command = `${this.ffmpegPath} -f concat -safe 0 -i "${concatFile}" -c copy "${outputPath}" -y`;

      exec(command, (error, stdout, stderr) => {
        fs.unlinkSync(concatFile); // 임시 파일 삭제
        if (error) {
          console.error('Concat error:', stderr);
          reject(error);
        } else {
          console.log('Final video created:', outputPath);
          resolve(outputPath);
        }
      });
    });
  }

  // 자막 추가
  async addSubtitles(videoPath, subtitles, outputPath) {
    // ASS 자막 파일 생성
    const assContent = this.generateASSSubtitles(subtitles);
    const subtitlePath = path.join(path.dirname(outputPath), 'subtitles.ass');
    fs.writeFileSync(subtitlePath, assContent);

    return new Promise((resolve, reject) => {
      const command = `${this.ffmpegPath} -i "${videoPath}" -vf "ass='${subtitlePath}'" -c:a copy "${outputPath}" -y`;

      exec(command, (error, stdout, stderr) => {
        fs.unlinkSync(subtitlePath);
        if (error) {
          console.error('Subtitle error:', stderr);
          reject(error);
        } else {
          resolve(outputPath);
        }
      });
    });
  }

  // ASS 자막 포맷 생성
  generateASSSubtitles(subtitles) {
    const header = `[Script Info]
Title: YouTube Shorts Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

    const events = subtitles.map(sub => {
      const start = this.formatTime(sub.start);
      const end = this.formatTime(sub.end);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${sub.text}`;
    }).join('\n');

    return header + events;
  }

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(2);
    return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
  }

  // 전체 렌더링 프로세스
  async renderFullVideo(script) {
    const tempVideos = [];

    // 1. 각 씬을 개별 비디오로 렌더링
    for (const scene of script.scenes) {
      const tempVideo = `temp_scene_${scene.id}.mp4`;
      await this.renderScene(
        scene.imageUrl,
        scene.audioUrl,
        tempVideo,
        scene.duration
      );
      tempVideos.push(tempVideo);
    }

    // 2. 모든 씬 연결
    const concatenated = 'concatenated.mp4';
    await this.concatenateScenes(tempVideos, concatenated);

    // 3. 자막 추가
    const subtitles = script.scenes.map((scene, i) => ({
      start: script.scenes.slice(0, i).reduce((sum, s) => sum + s.duration, 0),
      end: script.scenes.slice(0, i + 1).reduce((sum, s) => sum + s.duration, 0),
      text: scene.script
    }));

    const finalOutput = `output_${script.id}.mp4`;
    await this.addSubtitles(concatenated, subtitles, finalOutput);

    // 4. 임시 파일 정리
    tempVideos.forEach(f => fs.unlinkSync(f));
    fs.unlinkSync(concatenated);

    return finalOutput;
  }
}

// 사용 예시
async function convertToFFmpeg(script) {
  const renderer = new FFmpegRenderer();

  try {
    console.log('Starting local rendering with ffmpeg...');
    const outputFile = await renderer.renderFullVideo(script);
    console.log('Video rendered successfully:', outputFile);
    return outputFile;
  } catch (error) {
    console.error('Rendering failed:', error);
    throw error;
  }
}

module.exports = { FFmpegRenderer, convertToFFmpeg };