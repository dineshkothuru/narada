import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Narada — order at your table",
    short_name: "Narada",
    description: "Scan, browse the menu, and talk to Narada to order.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f4",
    theme_color: "#1c1c1c",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
