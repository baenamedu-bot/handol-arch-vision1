/**
 * 네이티브(안드로이드 앱) 연동 헬퍼 — 유앤미스튜디오
 *
 * npm 의존성 없이 window.Capacitor 존재 여부만 감지합니다.
 * - 웹 브라우저: 기존 방식(<a download>)으로 폴백 → Vercel 배포 영향 없음
 * - Capacitor 앱: WebView에 주입된 브릿지로 갤러리 저장 / 네이티브 공유
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: any;
    };
  }
}

export const isNativeApp = (): boolean =>
  !!(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());

/** 생성 이미지를 갤러리(Pictures/ARCH-VISION)에 저장. 웹에서는 다운로드로 폴백 */
export const saveImage = async (dataUrl: string, fileName: string): Promise<'native' | 'web'> => {
  if (!isNativeApp()) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return 'web';
  }
  const { Filesystem } = window.Capacitor!.Plugins;
  const base64 = dataUrl.split(',')[1];
  try {
    if (Filesystem.requestPermissions) {
      await Filesystem.requestPermissions().catch(() => {});
    }
    await Filesystem.writeFile({
      path: `Pictures/ARCH-VISION/${fileName}`,
      data: base64,
      directory: 'EXTERNAL_STORAGE',
      recursive: true,
    });
    return 'native';
  } catch {
    // Android 11+ 스코프드 스토리지에서는 공용 경로 직접 쓰기가 막힘 → 공유 시트로 폴백
    await shareImage(dataUrl, fileName);
    return 'native';
  }
};

/** 네이티브 공유 시트. 웹에서는 Web Share API → 저장 순 폴백 */
export const shareImage = async (dataUrl: string, fileName: string): Promise<void> => {
  if (isNativeApp()) {
    const { Filesystem, Share } = window.Capacitor!.Plugins;
    const base64 = dataUrl.split(',')[1];
    const saved = await Filesystem.writeFile({
      path: `share_${Date.now()}.png`,
      data: base64,
      directory: 'CACHE',
    });
    await Share.share({ title: 'ARCH-VISION · 유앤미스튜디오', files: [saved.uri] });
    return;
  }
  if (navigator.share && navigator.canShare) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'ARCH-VISION · 유앤미스튜디오', files: [file] });
      return;
    }
  }
  await saveImage(dataUrl, fileName);
};

/**
 * AI 생성 콘텐츠 인앱 신고 (Google Play AI-Generated Content 정책 필수 기능)
 * 결과물마다 신고 버튼에 연결됩니다.
 */
export const reportContent = (context: string = ''): void => {
  const subject = encodeURIComponent('[ARCH-VISION] 부적절한 AI 생성 콘텐츠 신고');
  const body = encodeURIComponent(
    '신고 사유를 적어주세요:\n\n\n─────────────\n' +
    `생성 정보: ${context}\n일시: ${new Date().toLocaleString('ko-KR')}`
  );
  window.location.href = `mailto:mybestlife@younme.ai.kr?subject=${subject}&body=${body}`;
};
