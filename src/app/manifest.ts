import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FireCert – Fire Alarm Certification",
    short_name: "FireCert",
    description: "Fire alarm certificates, servicing schedule and customer portal",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#c92a2a",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
