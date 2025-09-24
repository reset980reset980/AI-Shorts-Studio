// 브라우저 콘솔에서 실행할 스크립트
// localhost:5173에서 개발자 도구 콘솔에 붙여넣고 실행

// localStorage 정리 및 짬뽕 스크립트 동기화
(function() {
  // 기존 localStorage 정리
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('ai_shorts_studio') ||
      key.startsWith('script_') ||
      key.startsWith('project_')
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log('Removed:', key);
  });

  // 짬뽕 스크립트 데이터 설정
  const jjamppongScript = {
    "channel": "UNKNOWN",
    "title": "짬뽕 끓이기",
    "shorts_title": "내 인생 최고의 짬뽕, 그 숨겨진 비밀",
    "shorts_summary": "짬뽕을 만들던 중 예상치 못한 난관에 부딪혔지만, 놀라운 반전과 함께 인생 최고의 맛을 찾아낸 나의 좌충우돌 요리 여정.",
    "scenes": [
      {
        "id": 1,
        "time": "00:00 - 00:15",
        "script": "오늘따라 짬뽕이 너무 당겼어. 직접 만들어보기로 했지.",
        "imagePrompt": "anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 : 밝은 주방에서 행복한 표정으로 짬뽕을 상상하며 활짝 웃는 젊은이의 모습. 머리 위로는 김이 나는 짬뽕 한 그릇이 떠오른다.",
        "imageState": "done",
        "imageUrl": "D:\\ai-shorts-studio\\AI-Shorts-Studio\\data\\images\\1758675938779\\scene_1.jpg",
        "audioState": "done",
        "audioUrl": "D:\\ai-shorts-studio\\AI-Shorts-Studio\\data\\audio\\1758675938779\\scene_1.mp3",
        "duration": 10
      },
      // ... 다른 씬들도 추가 (간략화)
    ],
    "id": "1758675938779",
    "status": "pending"
  };

  // localStorage에 저장
  localStorage.setItem('ai_shorts_studio_scripts', JSON.stringify([jjamppongScript]));

  // 프로젝트 데이터도 동기화
  const project = {
    "id": "1758675938779",
    "title": "짬뽕 끓이기",
    "scriptId": "1758675938779",
    "createdAt": new Date().toISOString(),
    "status": "pending"
  };
  localStorage.setItem('project_1758675938779', JSON.stringify(project));

  console.log('✅ localStorage 동기화 완료!');
  console.log('페이지를 새로고침(F5)하면 짬뽕 스크립트가 보입니다.');

  // 자동 새로고침 (선택사항)
  // location.reload();
})();