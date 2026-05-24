// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Metro web does not apply axios's package.json "browser" field like webpack does,
// so the Node http adapter (follow-redirects) gets bundled and crashes in the browser.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'axios') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('axios/dist/browser/axios.cjs'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
