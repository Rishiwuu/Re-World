/** @type {import('next').NextConfig} */
const nextConfig = {
  // ShaderGradient ships as an ESM renderer; compiling it with the app keeps
  // its WebGL imports compatible with Next 14's client bundle.
  transpilePackages: ["@shadergradient/react"],
};

export default nextConfig;
