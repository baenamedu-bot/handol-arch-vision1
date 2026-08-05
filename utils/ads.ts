/**
 * AdMob 광고 헬퍼 — 유앤미스튜디오
 *
 * 네이티브(Capacitor) 앱에서만 동작하고, 웹(Vercel)에서는 전부 no-op.
 * - 하단 상시 배너: initAds() 호출 시 게재
 * - 전면 광고: 이미지 생성 완료 3회마다 1회 (최소 간격 2분)
 */
import { isNativeApp } from './native';

const IDS = {
  android: {
    banner: 'ca-app-pub-2229314122089046/7257099480',
    interstitial: 'ca-app-pub-2229314122089046/4803426612',
  },
  ios: {
    banner: 'ca-app-pub-2229314122089046/5631478461',
    interstitial: 'ca-app-pub-2229314122089046/5228987936',
  },
};

const INTERSTITIAL_EVERY = 3;          // 생성 N회마다
const INTERSTITIAL_MIN_GAP_MS = 120_000; // 최소 간격 2분

let admob: any = null;
let platform: 'android' | 'ios' | null = null;
let genCount = 0;
let lastInterstitialAt = 0;

const getPlatform = (): 'android' | 'ios' | null => {
  const cap = (window as any).Capacitor;
  if (!cap?.getPlatform) return null;
  const p = cap.getPlatform();
  return p === 'android' || p === 'ios' ? p : null;
};

/** 앱 시작 시 1회 호출: SDK 초기화 + 동의(UMP) + 하단 상시 배너 */
export const initAds = async (): Promise<void> => {
  if (!isNativeApp()) return;
  platform = getPlatform();
  if (!platform) return;
  try {
    const mod = await import('@capacitor-community/admob');
    admob = mod;
    await mod.AdMob.initialize();

    // EEA 등 규제 지역 동의 폼 (필요한 경우에만 표시됨)
    try {
      const info = await mod.AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
        await mod.AdMob.showConsentForm();
      }
    } catch { /* 동의 실패해도 앱은 계속 */ }

    await mod.AdMob.showBanner({
      adId: IDS[platform].banner,
      adSize: mod.BannerAdSize.ADAPTIVE_BANNER,
      position: mod.BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });
    // 배너가 콘텐츠를 가리지 않도록 하단 여백 확보
    document.body.style.paddingBottom = '70px';
  } catch (e) {
    console.warn('[ads] init 실패', e);
  }
};

/** 이미지 생성 완료 시 호출: 3회마다·2분 간격으로 전면 광고 */
export const onGenerationComplete = async (): Promise<void> => {
  if (!admob || !platform) return;
  genCount += 1;
  if (genCount % INTERSTITIAL_EVERY !== 0) return;
  if (Date.now() - lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return;
  const adId = IDS[platform].interstitial;
  if (adId.includes('IOS_INTERSTITIAL')) return; // 미설정 단위는 스킵
  try {
    await admob.AdMob.prepareInterstitial({ adId });
    await admob.AdMob.showInterstitial();
    lastInterstitialAt = Date.now();
  } catch (e) {
    console.warn('[ads] interstitial 실패', e);
  }
};
