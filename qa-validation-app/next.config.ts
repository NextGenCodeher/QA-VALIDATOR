import type { NextConfig } from "next";

const configOptions: any = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
};

const nextConfig: NextConfig = configOptions;

export default nextConfig;
