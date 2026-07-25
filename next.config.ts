import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // 开发时少占内存：不生成生产优化相关开销；按需编译页面
  onDemandEntries: {
    maxInactiveAge: 15_000,
    pagesBufferLength: 1,
  },
  webpack: (config, { dev }) => {
    // 开发模式下关闭持久化 cache，减轻 webpack 内存占用导致的 OOM
    if (dev) {
      config.cache = false;
      config.optimization = {
        ...config.optimization,
        // 开发不必拆很多 chunk，降低峰值内存
        splitChunks: false,
        removeAvailableModules: false,
        removeEmptyChunks: false,
      };
      config.performance = { ...config.performance, hints: false };
    }
    return config;
  },
  // 某些资源使用相对路径 `css/...`，在 `/zh/...` 下会解析成 `/zh/css/...` 而 404。
  // 将带 locale 前缀的静态 css 请求转发到 `public/css/...`。
  async rewrites() {
    return [
      { source: "/en/css/:path*", destination: "/css/:path*" },
      { source: "/zh/css/:path*", destination: "/css/:path*" },
    ];
  },
};

export default withNextIntl(nextConfig);
