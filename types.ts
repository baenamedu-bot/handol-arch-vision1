export interface GenerationState {
  isGenerating: boolean;
  error: string | null;
}

export interface ImageFile {
  file: File;
  preview: string;
}

export interface HistoryItem {
  id: string;
  role: 'original' | 'generated';
  imageUrl: string; // 화면 표시 및 다운로드용 (워터마크 포함)
  rawBase64?: string; // 다음 생성 단계의 소스용 (워터마크 미포함, 생성된 이미지인 경우)
  mimeType: string; // 이미지 포맷 (image/jpeg, image/png 등)
  prompt: string; // 해당 이미지를 만들 때 사용한 프롬프트
  timestamp: number;
}

export enum ArchitecturalStyle {
  MODERN = 'Modern',
  MINIMALIST = 'Minimalist',
  HANOK = 'Hanok (Traditional Korean)',
  CLASSIC = 'Classic',
  BRUTALIST = 'Brutalist',
  ECO_FRIENDLY = 'Eco-friendly',
  FUTURISTIC = 'Futuristic'
}