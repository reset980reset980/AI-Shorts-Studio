
import React from 'react';
import { Card } from '../components/Card';

interface UploadTabProps {
  addLog: (message: string, type?: 'INFO' | 'ERROR' | 'SUCCESS') => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({ addLog }) => {
  return (
    <div className="space-y-6">
      <Card title="OAuth (Desktop App) 로 토큰 발급하기">
        <ul className="list-decimal list-inside space-y-2 text-gray-400">
          <li>Google Cloud → Youtube Data API v3 사용 설정 <a href="#" className="text-blue-400 hover:underline">바로가기</a></li>
          <li>OAuth Client Desktop App 생성 <a href="#" className="text-blue-400 hover:underline">바로가기</a></li>
          <li>테스트 계정 등록 <a href="#" className="text-blue-400 hover:underline">바로가기</a></li>
          <li>다운로드 된 '클라이언트 JSON 파일'을 '클라이언트 JSON 업로드' 버튼으로 등록</li>
          <li>이후 '업로드' 또는 'Refresh Token 갱신'을 누르면 브라우저가 열리고 한번만 동의하면 자동 저장됩니다.</li>
        </ul>
        <div className="mt-6 flex space-x-2">
          <button className="px-4 py-2 font-semibold bg-green-600 hover:bg-green-700 rounded-md">클라이언트 JSON 업로드</button>
          <button className="px-4 py-2 font-semibold bg-yellow-500 hover:bg-yellow-600 text-black rounded-md">Refresh Token 갱신</button>
          <button className="px-4 py-2 font-semibold bg-red-600 hover:bg-red-700 rounded-md">전체 삭제</button>
        </div>
      </Card>
      
      <Card title="업로드 대기 영상 목록">
        <div className="text-center py-8 text-gray-500">
          업로드 대기 중인 영상이 없습니다.
        </div>
      </Card>
    </div>
  );
};
