export interface RuntimeBuildInfo {
  appVersion: string;
  gitSha: string;
}

export function getRuntimeBuildInfo(): RuntimeBuildInfo {
  if (process.env.NODE_ENV !== 'production') {
    return { appVersion: 'development', gitSha: 'development' };
  }
  return {
    appVersion: process.env.APP_VERSION || 'development',
    gitSha: process.env.BUILD_SHA || 'development',
  };
}
