import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SoulBound",
    short_name: "SoulBound",
    description: "입장 심사를 기반으로 신뢰를 먼저 세우는 비공개 커뮤니티",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: "#D97757",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
