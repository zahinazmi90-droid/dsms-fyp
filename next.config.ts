import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font data files it loads via relative fs paths at
  // runtime. Next's bundler rewrites module locations, which breaks those
  // relative paths (ENOENT for Helvetica.afm). Marking it external keeps
  // pdfkit as a plain node_modules require so its own path resolution works.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
