// Minimal stroke icons (24px grid, currentColor). Decorative: aria-hidden.
import type { SVGProps } from "react";

const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const make = (d: string) => {
  const Icon = (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}>
      {d.split("|").map((x, i) => (
        <path key={i} d={x} />
      ))}
    </svg>
  );
  return Icon;
};

export const IconHome = make("M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5|M9.5 21v-6h5v6");
export const IconHub = make("M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z|M12 12 21 7.5|M12 12v9.5|M12 12 3 7.5");
export const IconChat = make("M4 5h16v11H8l-4 4z|M8 9.5h8|M8 12.5h5");
export const IconModel = make("M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z|M4 21c0-4 3.6-7 8-7s8 3 8 7");
export const IconBook = make("M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z|M4 21.5V4.5|M8 7h8");
export const IconMemory = make("M9 3v3|M15 3v3|M9 18v3|M15 18v3|M3 9h3|M3 15h3|M18 9h3|M18 15h3|M6 6h12v12H6z|M10 10h4v4h-4z");
export const IconFlask = make("M9 3h6|M10 3v6L4.5 19A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3|M7 15h10");
export const IconData = make("M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z|M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6|M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6");
export const IconGauge = make("M12 21a9 9 0 1 1 9-9|M12 12l4.5-4.5|M12 12h.01");
export const IconLayers = make("M12 3 3 8l9 5 9-5z|M3 13l9 5 9-5|M3 18l9 5 9-5");
export const IconRocket = make("M5 15c-1.5 1-2 3.5-2 6 2.5 0 5-.5 6-2|M9 15l-3-3c1-4 4.5-8.5 12-9 0 7.5-5 11-9 12z|M14 9.5h.01");
export const IconWand = make("M4 20 15 9|M14 4v3|M12.5 5.5h3|M19 9v3|M17.5 10.5h3|M18 3v2|M17 4h2|M13 10l1 1");
export const IconCode = make("M8 7l-5 5 5 5|M16 7l5 5-5 5|M13.5 4l-3 16");
export const IconChart = make("M4 20V10|M10 20V4|M16 20v-7|M22 20H2");
export const IconMore = make("M5 12h.01|M12 12h.01|M19 12h.01");
export const IconSend = make("M4 12 20 4l-6 16-3-7z|M11 13l9-9");
export const IconStop = make("M7 7h10v10H7z");
export const IconRefresh = make("M20 11a8 8 0 1 0-2.3 5.7|M20 4v7h-7");
export const IconCopy = make("M9 9h11v11H9z|M5 15H4V4h11v1");
export const IconThumbUp = make("M7 10v10H4V10z|M7 10l4-7a2 2 0 0 1 2.5 2.4L12.5 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7");
export const IconThumbDown = make("M17 14V4h3v10z|M17 14l-4 7a2 2 0 0 1-2.5-2.4l1-4.6H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 4H17");
export const IconUpload = make("M12 16V4|M7 9l5-5 5 5|M4 20h16");
export const IconTrash = make("M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3");
export const IconPlus = make("M12 5v14|M5 12h14");
export const IconSun = make("M12 4V2|M12 22v-2|M4 12H2|M22 12h-2|M5 5 3.6 3.6|M20.4 20.4 19 19|M5 19l-1.4 1.4|M20.4 3.6 19 5|M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z");
export const IconMoon = make("M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z");
export const IconGlobe = make("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M3 12h18|M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z");
export const IconLogout = make("M15 4h4v16h-4|M10 8l-4 4 4 4|M6 12h10");
export const IconBrain = make("M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1 2.3A3 3 0 0 0 6 18a3 3 0 0 0 3 2V4|M15 4a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 2.8 3 3 0 0 1-1 2.3 3 3 0 0 1-1 5.7 3 3 0 0 1-3 2V4");
