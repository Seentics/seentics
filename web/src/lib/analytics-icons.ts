/** Shared paths to /public images for browsers, device category, and OS. */

export function getDeviceImagePath(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('mobile') || lower.includes('phone')) return '/images/device/mobile.png';
  if (lower.includes('tablet')) return '/images/device/tablet.png';
  if (lower.includes('laptop')) return '/images/device/laptop.png';
  if (lower.includes('desktop') || lower.includes('pc')) return '/images/device/desktop.png';
  return '/images/device/unknown.png';
}

export function getOsImagePath(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('windows 11')) return '/images/os/windows-11.png';
  if (lower.includes('windows 10')) return '/images/os/windows-10.png';
  if (lower.includes('windows xp')) return '/images/os/windows-xp.png';
  if (lower.includes('windows 7')) return '/images/os/windows-7.png';
  if (lower.includes('windows 8.1')) return '/images/os/windows-8-1.png';
  if (lower.includes('windows 8')) return '/images/os/windows-8.png';
  if (lower.includes('windows vista')) return '/images/os/windows-vista.png';
  if (lower.includes('windows')) return '/images/os/windows-10.png';
  if (lower.includes('mac')) return '/images/os/mac-os.png';
  if (lower === 'ios' || lower === 'iphone os') return '/images/os/ios.png';
  if (lower.includes('android')) return '/images/os/android-os.png';
  if (lower.includes('chrome os')) return '/images/os/chrome-os.png';
  if (lower.includes('linux')) return '/images/os/linux.png';
  if (lower.includes('blackberry')) return '/images/os/blackberry-os.png';
  return '/images/os/unknown.png';
}

export function getBrowserImagePath(browser: string): string {
  const lower = browser.toLowerCase();
  if (lower.includes('brave')) return '/images/browser/brave.png';
  if (lower.includes('edge')) return '/images/browser/edge.png';
  if (lower.includes('opera mini')) return '/images/browser/opera-mini.png';
  if (lower.includes('opera')) return '/images/browser/opera.png';
  if (lower.includes('firefox')) return '/images/browser/firefox.png';
  if (lower.includes('safari')) return '/images/browser/safari.png';
  if (lower.includes('samsung')) return '/images/browser/samsung.png';
  if (lower.includes('yandex')) return '/images/browser/yandexbrowser.png';
  if (lower.includes('silk')) return '/images/browser/silk.png';
  if (lower.includes('miui')) return '/images/browser/miui.png';
  if (lower.includes('kakaotalk')) return '/images/browser/kakaotalk.png';
  if (lower.includes('instagram')) return '/images/browser/instagram.png';
  if (lower.includes('facebook')) return '/images/browser/facebook.png';
  if (lower.includes('android') && lower.includes('webview')) return '/images/browser/android-webview.png';
  if (lower.includes('chromium')) return '/images/browser/chromium-webview.png';
  if (lower.includes('chrome')) return '/images/browser/chrome.png';
  if (lower.includes('ie') || lower.includes('internet explorer')) return '/images/browser/ie.png';
  if (lower.includes('blackberry')) return '/images/browser/blackberry.png';
  if (lower.includes('curl')) return '/images/browser/curl.png';
  return '/images/browser/unknown.png';
}
