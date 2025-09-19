import React, { useState, useEffect } from 'react';
import { Script } from '../types/Script';
import { Settings } from '../types/Settings';
import {
  loadProjects,
  loadScript,
  deleteProject,
  getFilePath
} from '../services/fileStorage';

interface EditTabProps {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
}

interface Project {
  id: string;
  title: string;
  scriptId: string;
  createdAt: string;
  status: string;
  thumbnail?: string;
}

export const EditTab: React.FC<EditTabProps> = ({ settings, updateSettings }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');

  // Load projects on mount
  useEffect(() => {
    loadProjectList();
  }, []);

  const loadProjectList = () => {
    setIsLoading(true);
    try {
      const loadedProjects = loadProjects();
      setProjects(loadedProjects);
      console.log('Loaded projects:', loadedProjects.length);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    setIsLoading(true);
    try {
      const script = loadScript(project.scriptId);
      setSelectedScript(script);
    } catch (error) {
      console.error('Failed to load script:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('정말로 이 프로젝트를 삭제하시겠습니까? 모든 관련 파일이 삭제됩니다.')) {
      try {
        deleteProject(projectId);
        loadProjectList(); // Reload the list
        if (selectedProject?.id === projectId) {
          setSelectedProject(null);
          setSelectedScript(null);
        }
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('프로젝트 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleExportProject = (project: Project) => {
    // Export project data as JSON
    const script = loadScript(project.scriptId);
    const exportData = {
      project,
      script,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.replace(/[^a-z0-9]/gi, '_')}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredProjects = projects
    .filter(p =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.includes(searchTerm)
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Project List */}
      <div className="w-1/3 border-r border-gray-700 bg-gray-900 p-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-3">프로젝트 목록</h2>

          {/* Search Bar */}
          <input
            type="text"
            placeholder="프로젝트 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 mb-3 bg-gray-800 border border-gray-700 rounded text-white"
          />

          {/* Sort Options */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1 rounded ${
                sortBy === 'date'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              날짜순
            </button>
            <button
              onClick={() => setSortBy('title')}
              className={`px-3 py-1 rounded ${
                sortBy === 'title'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              제목순
            </button>
            <button
              onClick={loadProjectList}
              className="ml-auto px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* Project Cards */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-gray-400 text-center py-4">로딩 중...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-gray-400 text-center py-4">
              저장된 프로젝트가 없습니다.
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedProject?.id === project.id
                    ? 'bg-purple-800 border border-purple-600'
                    : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                }`}
                onClick={() => handleSelectProject(project)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white text-sm">
                    {project.title}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    project.status === 'completed'
                      ? 'bg-green-600 text-white'
                      : project.status === 'processing'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {project.status === 'completed' ? '완료' :
                     project.status === 'processing' ? '처리중' : '대기'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  {formatDate(project.createdAt)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportProject(project);
                    }}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    내보내기
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Project Details */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedScript ? (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              {selectedScript.shorts_title || selectedScript.title}
            </h2>

            {selectedScript.shorts_summary && (
              <div className="mb-6 p-4 bg-gray-800 rounded">
                <h3 className="text-lg font-semibold text-white mb-2">요약</h3>
                <p className="text-gray-300">{selectedScript.shorts_summary}</p>
              </div>
            )}

            {/* Scenes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-3">씬 목록</h3>
              {selectedScript.scenes.map((scene, index) => (
                <div key={scene.id} className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-start gap-4">
                    {/* Scene Image */}
                    {scene.imageUrl && (
                      <div className="w-32 h-32 flex-shrink-0">
                        <img
                          src={scene.imageUrl}
                          alt={`Scene ${index + 1}`}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                    )}

                    {/* Scene Details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-white">
                          씬 {index + 1} ({scene.time})
                        </h4>
                        <div className="flex gap-2">
                          {scene.imageState === 'completed' && (
                            <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">
                              이미지 ✓
                            </span>
                          )}
                          {scene.audioState === 'completed' && (
                            <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                              음성 ✓
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-300 mb-2">{scene.script}</p>

                      {scene.imagePrompt && (
                        <div className="mt-2 p-2 bg-gray-900 rounded">
                          <p className="text-xs text-gray-400">
                            이미지 프롬프트: {scene.imagePrompt}
                          </p>
                        </div>
                      )}

                      {/* Audio Player */}
                      {scene.audioUrl && (
                        <div className="mt-2">
                          <audio controls className="w-full">
                            <source src={scene.audioUrl} type="audio/mpeg" />
                          </audio>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Video Section */}
            {selectedScript.status === 'completed' && selectedProject && (
              <div className="mt-6 p-4 bg-gray-800 rounded">
                <h3 className="text-lg font-semibold text-white mb-3">생성된 영상</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      const videoUrl = getFilePath('video', selectedProject.scriptId);
                      if (videoUrl) {
                        window.open(videoUrl, '_blank');
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    영상 보기
                  </button>
                  <button
                    onClick={() => {
                      const videoUrl = getFilePath('video', selectedProject.scriptId);
                      if (videoUrl) {
                        const a = document.createElement('a');
                        a.href = videoUrl;
                        a.download = `${selectedScript.shorts_title || 'video'}.mp4`;
                        a.click();
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    영상 다운로드
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-lg">
              왼쪽 목록에서 프로젝트를 선택하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
};