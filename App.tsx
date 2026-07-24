import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Download, AlertCircle, RefreshCw, History, ChevronRight, RotateCcw, CornerUpLeft, CheckCircle2, Brush, X, Key, ExternalLink, ShieldCheck, Building2, Lock } from 'lucide-react';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import MaskEditor from './components/MaskEditor';
import { ImageFile, GenerationState, HistoryItem } from './types';
import { generateArchitecturalEdit } from './services/geminiService';
import { addWatermark, fileToBase64 } from './utils/imageProcessing';
import { saveImage, shareImage, reportContent } from './utils/native';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [userApiKey, setUserApiKey] = useState<string | null>(localStorage.getItem('ARCH_VISION_KEY'));
  const [keyInputValue, setKeyInputValue] = useState('');
  const [refImage, setRefImage] = useState<ImageFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isMaskingModalOpen, setIsMaskingModalOpen] = useState(false);
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    error: null,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check for API Key source on mount
  useEffect(() => {
    const checkKey = async () => {
      // 1. Check if running in AI Studio environment
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // 2. Web environment: Check localStorage
        const savedKey = localStorage.getItem('ARCH_VISION_KEY');
        if (savedKey) {
          setUserApiKey(savedKey);
          setHasApiKey(true);
        } else {
          setHasApiKey(false);
        }
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // 키 형식 검증 없음 — Google 키 정책이 계속 바뀌므로 실제 생성 성공 여부로만 판단
  const handleSaveCustomKey = () => {
    const trimmedKey = keyInputValue.trim();
    if (!trimmedKey) {
      alert('API 키를 입력해주세요.');
      return;
    }
    localStorage.setItem('ARCH_VISION_KEY', trimmedKey);
    setUserApiKey(trimmedKey);
    setHasApiKey(true);
    setState({ ...state, error: null });
  };

  const handleLogoutKey = () => {
    if (window.confirm("설정된 API 키를 삭제하시겠습니까?")) {
      localStorage.removeItem('ARCH_VISION_KEY');
      setUserApiKey(null);
      setHasApiKey(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const activeItem = activeStepId
    ? history.find(item => item.id === activeStepId)
    : (history.length > 0 ? history[history.length - 1] : null);

  const handleInitialUpload = async (imageFile: ImageFile | null) => {
    if (imageFile) {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        role: 'original',
        imageUrl: imageFile.preview,
        prompt: '원본 이미지 업로드',
        timestamp: Date.now(),
        rawBase64: await fileToBase64(imageFile.file),
        mimeType: imageFile.file.type
      };
      setHistory([newItem]);
      setActiveStepId(newItem.id);
    } else {
      setHistory([]);
      setActiveStepId(null);
    }
  };

  const handleGenerate = async () => {
    if (!activeItem) return;
    const sourceData = activeItem.rawBase64 || activeItem.imageUrl;
    const sourceMimeType = activeItem.mimeType || 'image/png';
    setState({ isGenerating: true, error: null });
    try {
      const rawBase64 = await generateArchitecturalEdit(
        sourceData,
        sourceMimeType,
        prompt,
        userApiKey, // Pass the custom key
        refImage?.file,
        maskBase64
      );
      const watermarkedDataUrl = await addWatermark(rawBase64);
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        role: 'generated',
        imageUrl: watermarkedDataUrl,
        rawBase64: rawBase64,
        mimeType: 'image/png',
        prompt: prompt.trim() || (maskBase64 ? "(부분 수정 - 마스크 적용)" : "(추가 요청 없음 - 원본 유지)"),
        timestamp: Date.now(),
      };
      setHistory(prev => [...prev, newItem]);
      setActiveStepId(newItem.id);
      setPrompt('');
      setMaskBase64(null);
      setState({ isGenerating: false, error: null });
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message || "알 수 없는 오류가 발생했습니다.";
      if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("invalid") || errorMsg.includes("403") || errorMsg.includes("401")) {
        // 키를 자동 삭제하지 않음 — 일시적 오류일 수 있으므로 안내만 표시
        setState({
          isGenerating: false,
          error: "API 키 인증에 실패했습니다. 아래를 확인해주세요.\n① 키를 복사할 때 앞뒤 공백이 들어가지 않았는지\n② aistudio.google.com/apikey 에서 키가 살아있는지\n③ 그래도 안 되면 새 키를 발급받아 '키 삭제' 후 다시 입력해주세요.",
        });
        return;
      }
      setState({
        isGenerating: false,
        error: errorMsg,
      });
    }
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    const fileName = `Younme_ArchVision_Step${index + 1}_${Date.now()}.png`;
    try {
      const mode = await saveImage(imageUrl, fileName);
      if (mode === 'native') alert('갤러리에 저장되었습니다. (Pictures/ARCH-VISION)');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleShare = async (imageUrl: string, index: number) => {
    try {
      await shareImage(imageUrl, `Younme_ArchVision_Step${index + 1}.png`);
    } catch (e) {
      console.error(e); // 사용자가 공유 시트를 닫은 경우 포함 — 무시
    }
  };

  const handleReport = (item: HistoryItem) => {
    reportContent(`STEP 프롬프트: ${item.prompt}`);
  };

  const handleReset = () => {
    if (window.confirm("현재 작업 내역이 모두 초기화됩니다. 계속하시겠습니까?")) {
      setHistory([]);
      setActiveStepId(null);
      setPrompt('');
      setRefImage(null);
      setMaskBase64(null);
      setState({ isGenerating: false, error: null });
    }
  };

  const handleSelectStep = (id: string) => {
    setActiveStepId(id);
    setPrompt('');
    setMaskBase64(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Loading State
  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // 2. API Key Selection / Input Screen
  if (hasApiKey === false) {
    const isAiStudio = window.aistudio && typeof window.aistudio.openSelectKey === 'function';

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="bg-orange-600 p-8 text-center text-white">
            <Building2 className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2 tracking-tight">ARCH-VISION</h1>
            <p className="text-orange-100 font-light italic">Professional Architectural Evolution</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-slate-800">API 설정이 필요합니다</h2>
              <p className="text-sm text-slate-500">
                본 앱은 사용자의 개인 API 키를 사용하여 작동합니다. <br/>
                입력하신 키는 본인의 브라우저에만 암호화되어 저장됩니다.
              </p>
            </div>

            {isAiStudio ? (
              <button
                onClick={handleOpenKeySelector}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center group"
              >
                <Key className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Google AI 키 연결하기
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={keyInputValue}
                    onChange={(e) => setKeyInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomKey()}
                    placeholder="발급받은 Gemini API 키 붙여넣기"
                    className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveCustomKey}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all shadow-xl hover:-translate-y-1"
                >
                  키 저장 후 시작하기
                </button>
                <div className="space-y-2">
                  <details className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden" open>
                    <summary className="px-4 py-3 text-sm font-bold text-slate-700 cursor-pointer select-none">
                      🔑 API 키 발급 방법 (무료 · 2분)
                    </summary>
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed space-y-2">
                      <p>1. 아래 버튼으로 <b>Google AI Studio</b> 접속 후 구글 계정으로 로그인</p>
                      <p>2. <b>「API 키 만들기(Create API key)」</b> 버튼 클릭</p>
                      <p>3. 프로젝트 선택 화면이 나오면 <b>「새 프로젝트에서 키 만들기」</b> 선택</p>
                      <p>4. 생성된 키를 <b>복사</b>해서 위 입력란에 붙여넣기 → 「키 저장 후 시작하기」</p>
                      <p className="text-slate-400">※ 무료 등급으로도 사용 가능하며, 키는 비밀번호처럼 타인과 공유하지 마세요.</p>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full py-2.5 mt-1 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors"
                      >
                        Google AI Studio 키 발급 페이지 열기 <ExternalLink className="w-3 h-3 ml-1.5" />
                      </a>
                    </div>
                  </details>

                  <details className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 text-sm font-bold text-amber-800 cursor-pointer select-none">
                      ⚠️ 발급이 안 되나요? (해결 방법)
                    </summary>
                    <div className="px-4 pb-4 text-xs text-amber-900 leading-relaxed space-y-2">
                      <p>• <b>회사·학교 계정</b>(구글 워크스페이스)은 관리자가 발급을 막아둔 경우가 많습니다. → <b>개인 지메일 계정</b>으로 다시 시도해보세요.</p>
                      <p>• 버튼이 안 보이거나 오류가 뜨면, <b>제미니에게 직접 물어보는 게 가장 빠릅니다.</b> 제미니(gemini.google.com)를 열고 아래처럼 질문하세요:</p>
                      <div className="bg-white border border-amber-200 rounded-lg p-3 text-slate-700">
                        "Google AI Studio에서 Gemini API 키를 발급받으려는데 <b>[화면에 뜬 오류 메시지를 그대로 붙여넣기]</b> 라고 나와. 해결 방법을 단계별로 알려줘."
                      </div>
                      <p>• 화면 문구는 구글이 수시로 바꾸므로, 위 방법으로 물어보면 항상 최신 절차를 안내받을 수 있습니다.</p>
                    </div>
                  </details>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[11px] text-slate-500 leading-relaxed">
              <p className="flex items-start">
                <ShieldCheck className="w-4 h-4 mr-2 text-green-600 flex-shrink-0" />
                데이터는 서버에 저장되지 않으며 로컬 환경에서만 사용됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Application Screen
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Inputs & Controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 sticky top-8 z-10">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs mr-2">1</span>
                  편집 설정
                </h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={window.aistudio ? handleOpenKeySelector : handleLogoutKey}
                    className="text-[10px] text-slate-400 hover:text-orange-600 transition-colors flex items-center"
                    title="API 키 관리"
                  >
                    <Key className="w-3 h-3 mr-1" /> {window.aistudio ? '키 변경' : '키 삭제'}
                  </button>
                  {history.length > 0 && (
                    <button
                      onClick={handleReset}
                      className="text-xs text-slate-500 flex items-center hover:text-red-500 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> 초기화
                    </button>
                  )}
                </div>
              </div>

              {history.length === 0 ? (
                <ImageUploader
                  label="원본 건축 이미지 업로드"
                  subLabel="편집을 시작할 이미지를 선택하세요"
                  imageFile={null}
                  onImageSelected={handleInitialUpload}
                  required
                />
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all relative">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      현재 편집 대상 (Source)
                    </p>
                    {activeItem && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                        STEP {history.findIndex(h => h.id === activeItem.id) + 1}
                      </span>
                    )}
                  </div>
                  <div className="w-full rounded-lg overflow-hidden bg-slate-200 relative group border border-slate-300">
                    {activeItem && (
                      <>
                        <img src={activeItem.imageUrl} alt="Current Source" className="w-full h-auto object-cover" />
                        {maskBase64 && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center">
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              마스크 적용됨
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    * 위 이미지가 다음 생성의 기준이 됩니다.
                  </p>
                </div>
              )}

              <ImageUploader
                label="레퍼런스 이미지 (선택사항)"
                subLabel="스타일 참고용"
                imageFile={refImage}
                onImageSelected={setRefImage}
                heightClass="h-32"
              />

              {history.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    부분 편집 (마스킹)
                  </label>
                  <button
                    onClick={() => setIsMaskingModalOpen(true)}
                    className={`w-full py-3 px-4 rounded-xl border-2 border-dashed flex items-center justify-center transition-all group
                      ${maskBase64
                        ? 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-orange-500 hover:text-orange-600'
                      }
                    `}
                  >
                    {maskBase64 ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        <span className="font-bold">마스킹 적용 완료 (클릭하여 수정)</span>
                      </>
                    ) : (
                      <>
                        <Brush className="w-5 h-5 mr-2 text-slate-400 group-hover:text-orange-500" />
                        <span className="font-medium">🖌️ 마스킹(부분 편집) 영역 지정하기</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {history.length > 0 ? "추가 수정 요청 사항" : "초기 수정 요청 사항"}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={maskBase64
                    ? "마스킹한 영역을 어떻게 바꿀지 구체적으로 입력하세요."
                    : "내용을 입력하지 않으면 원본 형태를 그대로 유지합니다."
                  }
                  className={`w-full h-32 p-4 rounded-xl border transition-all resize-none text-slate-700 placeholder-slate-400
                    ${maskBase64
                      ? 'border-red-300 focus:border-red-500 ring-red-100 focus:ring'
                      : 'border-slate-300 focus:border-orange-500 ring-orange-200 focus:ring'
                    }
                  `}
                />
              </div>

              {state.error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start text-sm whitespace-pre-line">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  {state.error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={state.isGenerating || history.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all shadow-md
                  ${state.isGenerating || history.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : maskBase64
                      ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg'
                      : 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-lg hover:-translate-y-0.5'
                  }
                `}
              >
                {state.isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    편집 중...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    {maskBase64 ? '마스크 영역 편집' : (history.length > 0 ? '선택 이미지 편집' : '이미지 업로드 필요')}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Output & History */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center border-b border-slate-100 pb-4 mb-6">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs mr-2">2</span>
                결과물 미리보기
              </h2>
              <div className="flex items-center justify-center bg-slate-50 rounded-xl border-2 border-slate-100 min-h-[500px] relative overflow-hidden">
                {state.isGenerating ? (
                  <div className="text-center space-y-4">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">ARCH-VISION 처리중</h3>
                      <p className="text-slate-500 text-sm mt-1">
                        건축적 요소와 조명을 계산하고 있습니다...
                      </p>
                    </div>
                  </div>
                ) : activeItem ? (
                  <div className="relative w-full h-full flex flex-col">
                    <img
                      src={activeItem.imageUrl}
                      alt="Current Result"
                      className="w-full h-auto max-h-[700px] object-contain shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center text-slate-400 p-8">
                    <div className="bg-white p-6 rounded-full inline-block shadow-sm mb-4">
                      <ChevronRight className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-lg font-medium">작업을 시작해주세요</p>
                    <p className="text-sm mt-2">좌측에서 이미지를 업로드하세요.</p>
                  </div>
                )}
              </div>
            </div>

            {history.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center mb-6">
                  <History className="w-5 h-5 mr-2" />
                  작업 히스토리
                </h3>
                <div className="space-y-6">
                  {history.map((item, index) => {
                    const isActive = activeStepId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all relative
                          ${isActive
                            ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                          }`}
                      >
                        <div className="w-full md:w-48 flex-shrink-0">
                          <div className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-white">
                            <img
                              src={item.imageUrl}
                              alt={`Step ${index + 1}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => {
                                const win = window.open();
                                win?.document.write(`<img src="${item.imageUrl}" style="max-width:100%">`);
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex-grow flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${item.role === 'original' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                                STEP {index + 1}
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium text-sm">
                              {item.prompt}
                            </p>
                          </div>
                          <div className="mt-4 flex justify-between items-center pt-2 border-t border-slate-200/50">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleDownload(item.imageUrl, index)}
                                className="flex items-center text-xs text-slate-500 hover:text-slate-800"
                              >
                                <Download className="w-3.5 h-3.5 mr-1" /> 저장
                              </button>
                              <button
                                onClick={() => handleShare(item.imageUrl, index)}
                                className="flex items-center text-xs text-slate-500 hover:text-slate-800"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" /> 공유
                              </button>
                              {item.role === 'generated' && (
                                <button
                                  onClick={() => handleReport(item)}
                                  className="flex items-center text-xs text-slate-400 hover:text-red-500"
                                  title="부적절한 AI 생성 결과 신고"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> 신고
                                </button>
                              )}
                            </div>
                            {!isActive && (
                              <button
                                onClick={() => handleSelectStep(item.id)}
                                className="text-sm text-orange-600 hover:text-orange-700 font-bold flex items-center"
                              >
                                <CornerUpLeft className="w-4 h-4 mr-1.5" /> 이 단계에서 계속
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isMaskingModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">부분 편집 영역 지정</h3>
              <button onClick={() => setIsMaskingModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="flex-grow relative bg-slate-100 flex items-center justify-center overflow-hidden">
              <MaskEditor
                imageUrl={activeItem.imageUrl}
                onMaskChange={(mask) => setMaskBase64(mask)}
                onClose={() => setIsMaskingModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-400 py-8 mt-12 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">© {new Date().getFullYear()} (주)한돌건축사사무소 ARCH-VISION. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
