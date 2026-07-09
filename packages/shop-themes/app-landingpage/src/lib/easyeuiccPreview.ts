import type { ThemeConfig } from '../types/theme';

export const easyEuiccPreviewConfig: ThemeConfig = {
  brand: {
    name: 'EASYEUICC',
    primaryColor: '#176bff',
    secondaryColor: '#0b4edb',
  },
  site: {
    archetype: 'app-download',
    headline: 'Download EasyEUICC',
    subheadline: 'A focused Android eUICC manager for installing, switching, and maintaining your eSIM profiles.',
    primaryCtaLabel: 'Download APK',
    androidDownloadUrl: 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk',
    appVersion: 'v1.6.2-unpriv',
    downloadChecksum: 'e1c5b71b08fa9c7aef036cf106f59fe7c49075131009ffaf8f97046896af63fc',
    downloadQrUrl: '/easyeuicc-download-qr.png',
    appScreenshotUrl: '/easyeuicc-real-empty.png',
    supportEmail: 'support@easyeuicc.cc',
  },
};
