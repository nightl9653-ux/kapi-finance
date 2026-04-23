import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
