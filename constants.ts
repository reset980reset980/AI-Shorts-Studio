
import type { Tab, Script } from './types';

export const TABS: Tab[] = ['대본입력', '유튜브채널', '영상편집', '유튜브 업로드', '내정보'];

export const MOCK_SCRIPT: Script = {
  // FIX: Added missing 'id' property to satisfy the Script interface.
  id: 'mock-script-1',
  channel: 'UNKNOWN',
  title: '얼굴에 복이 갔드는 상, 궁금하신가요',
  shorts_title: '얼굴에 복이 깃드는 상? 진짜 있는 걸까? 내 얼굴은?',
  shorts_summary: '복이 깃드는 얼굴은 특별한 게 아니었다. 온화한 미소와 밝은 기운, 결국 마음가짐이 얼굴을 만들고 운명을 바꾼다는 이야기.',
  scenes: [
    {
      id: 1,
      time: '00:00 - 00:15',
      script: '얼굴에 복이 깃드는 상, 그거 정말 궁금하지 않아? 나만 그런가',
      imagePrompt: 'anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 | 늦은 밤, 스마트폰 화면을 응시하는 여성의 클로즈업. 화면에는 ‘얼굴에 복이 깃드는 상’이라는 문구가 흐릿하게 보인다. 어두운 방 안, 스마트폰 불빛만이 얼굴을 비춘다. 약간 의심스러운 표정.',
      imageState: 'pending',
      audioState: 'pending',
    },
    {
      id: 2,
      time: '00:15 - 00:30',
      script: '솔직히 나, 관상 이런 거 잘 안 믿었거든. 그냥 재미로 보는 정도?',
      imagePrompt: 'anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 | 카페에 앉아 커피를 마시는 여성. 테이블 위에 놓인 관상 관련 책이 보인다. 창밖을 바라보며 생각에 잠긴 모습. 약간은 회의적인 표정.',
      imageState: 'pending',
      audioState: 'pending',
    },
    {
      id: 3,
      time: '00:30 - 00:45',
      script: '근데 어느 날, ‘온화한 미소와 밝은 기운이 복을 불러들인다’는 글귀를 봤어.',
      imagePrompt: 'anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 | 햇살 좋은 도서관 창가에 앉아 책을 읽는 여성의 오버숄더 샷. 책 페이지에는 ‘온화한 미소와 밝은 기운이 복을 불러들인다’라는 문장이 강조되어 있다. 따뜻한 햇살과 조명 아래, 여성은 문장을 주의 깊게 읽고 있다.',
      imageState: 'pending',
      audioState: 'pending',
    },
     {
      id: 4,
      time: '00:45 - 01:00',
      script: '그때 깨달았지. 결국 복을 부르는 건, 내 마음가짐이라는 걸.',
      imagePrompt: 'anime style digital painting, soft realistic illustration, 텍스트는 제외해. | 그림설명 | 거울을 보며 활짝 웃는 여성. 이전보다 훨씬 밝고 긍정적인 표정이다. 배경은 밝고 따뜻한 분위기의 방. 자신감과 희망이 느껴지는 미소.',
      imageState: 'pending',
      audioState: 'pending',
    }
  ],
  status: 'pending',
};