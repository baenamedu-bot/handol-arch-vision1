import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from "../utils/imageProcessing";

const ARCH_VISION_SYSTEM_PROMPT = `
당신은 전문 건축 이미지 편집 AI인 "ARCH-VISION"입니다.
(주)한돌건축사사무소를 위해 일합니다.

## 핵심 편집 원칙 (엄수)
1. 사용자가 요청한 수정 사항 외의 모든 부분은 **원본 그대로 유지**해야 합니다. (매우 중요)
2. 원본 이미지의 전체적인 구도, 카메라 앵글, 주변 환경은 절대 변경하지 마세요.
3. 건축적 비례와 원근법을 정확히 유지하세요. 이미지의 비율(Aspect Ratio)을 임의로 변경하지 마세요.
4. 요청된 변경 사항에 대해서만 자연스러운 조명과 그림자를 적용하여 사실적으로 합성하세요.
5. **사용자의 요청이 없거나 빈 프롬프트인 경우, 원본 이미지의 형태와 구조를 100% 동일하게 유지하며 출력해야 합니다.**

## 역할
사용자가 제공한 건축 이미지를 바탕으로 요청된 재료, 스타일, 분위기만을 부분적으로 수정하여 새로운 이미지를 생성합니다.

Return ONLY the generated image.
`;

/**
 * sourceInput can be a File object (first upload) or a raw base64 string (subsequent edits).
 */
export const generateArchitecturalEdit = async (
  sourceInput: File | string,
  sourceMimeType: string,
  prompt: string,
  userApiKey?: string | null,
  referenceFile?: File,
  maskBase64?: string | null
): Promise<string> => {
  // Use user-provided key if available, otherwise fallback to process.env.API_KEY
  const apiKey = userApiKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API 키가 설정되지 않았습니다. 설정에서 키를 입력해주세요.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    let sourceBase64: string;
    let finalSourceMimeType = sourceMimeType;

    if (sourceInput instanceof File) {
      sourceBase64 = await fileToBase64(sourceInput);
      finalSourceMimeType = sourceInput.type;
    } else {
      if (sourceInput.startsWith('data:')) {
        const matches = sourceInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (matches && matches[1]) {
          finalSourceMimeType = matches[1];
        }
        sourceBase64 = sourceInput.split(',')[1];
      } else {
        sourceBase64 = sourceInput;
      }
    }
    
    const parts: any[] = [];

    parts.push({
      inlineData: {
        mimeType: finalSourceMimeType || 'image/png',
        data: sourceBase64,
      },
    });

    let effectivePrompt = prompt.trim();
    if (!effectivePrompt) {
      effectivePrompt = "별도의 수정 요청이 없습니다. 원본 이미지의 건축적 형태, 비율, 구도, 재료를 100% 동일하게 유지하면서 고화질로 렌더링하세요. 구조적인 변경을 절대 하지 마세요.";
    }

    let promptText = `${ARCH_VISION_SYSTEM_PROMPT}\n\n사용자 요청: ${effectivePrompt}`;
    
    if (referenceFile) {
      const refBase64 = await fileToBase64(referenceFile);
      parts.push({
        inlineData: {
          mimeType: referenceFile.type,
          data: refBase64,
        },
      });
      promptText += "\n\n[참고 이미지 지침]\n위의 두 번째 이미지를 레퍼런스로 참고하여, 해당 이미지의 분위기나 재질감을 원본 이미지에 반영하되, 원본의 건축적 형태는 유지하세요.";
    }

    if (maskBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: maskBase64
        }
      });
      promptText += "\n\n[마스크 지침 (중요)]\n마지막으로 제공된 흑백 이미지는 **편집 마스크(Mask)**입니다.\n- **흰색 영역**: 사용자의 요청사항을 반영하여 적극적으로 수정해야 하는 부분입니다.\n- **검은색 영역**: 절대 변경하지 말고 원본 그대로 픽셀 단위로 보존해야 하는 부분입니다.\n이 마스크를 엄격히 준수하여 인페인팅(Inpainting) 작업을 수행하세요.";
    }

    parts.push({
      text: promptText,
    });

    /**
     * 이미지 모델 우선순위 (2026-05-28 GA 기준)
     * 1순위: gemini-3.1-flash-image (Nano Banana 2, 정식 버전)
     * 2순위: gemini-2.5-flash-image (구모델 폴백 — 종료 시 자동 스킵됨)
     * 모델이 종료/미지원이면 다음 모델로 자동 전환하므로
     * Google이 모델을 바꿔도 앱이 즉시 멈추지 않습니다.
     */
    const IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

    let response: any = null;
    let lastError: any = null;

    for (const model of IMAGE_MODELS) {
      try {
        // Gemini 3.x: 해상도 2K 지정 (기본값 1K는 건축 시안용으로 부족)
        // 주의: responseModalities에 TEXT가 섞이면 해상도 설정이 무시되는
        //       알려진 이슈가 있어 IMAGE 단독으로 지정
        const isGen3 = model.startsWith('gemini-3');
        const config = isGen3
          ? {
              responseModalities: ['IMAGE'],
              imageConfig: { imageSize: '2K' },
            }
          : undefined;

        response = await ai.models.generateContent({
          model,
          contents: {
            parts: parts,
          },
          ...(config ? { config } : {}),
        });
        break; // 성공하면 중단
      } catch (err: any) {
        const msg = (err?.message || '').toLowerCase();
        // 모델이 없거나 지원 종료된 경우에만 다음 모델로 폴백
        if (msg.includes('not found') || msg.includes('not_found') || msg.includes('404') || msg.includes('deprecated') || msg.includes('not supported')) {
          lastError = err;
          continue;
        }
        throw err; // 키 오류·쿼터 초과 등은 그대로 전달
      }
    }

    if (!response) {
      throw lastError || new Error('사용 가능한 이미지 생성 모델을 찾지 못했습니다.');
    }

    let generatedImageBase64 = '';
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!generatedImageBase64) {
      throw new Error("이미지를 생성하지 못했습니다.");
    }

    return generatedImageBase64;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};