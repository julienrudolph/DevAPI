import {
  createDarkTheme,
  createLightTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

const relayBrand: BrandVariants = {
  10: "#07140D",
  20: "#0C2417",
  30: "#103720",
  40: "#134A2A",
  50: "#175E35",
  60: "#1B7240",
  70: "#20874C",
  80: "#269D59",
  90: "#3BAA69",
  100: "#55B77C",
  110: "#70C38F",
  120: "#8ACFA2",
  130: "#A4DBB5",
  140: "#BDE7C9",
  150: "#D6F2DD",
  160: "#EDFBF1",
};

const sharedOverrides = {
  borderRadiusMedium: "8px",
  borderRadiusLarge: "10px",
  fontFamilyBase:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const relayTheme: Theme = {
  ...createLightTheme(relayBrand),
  colorBrandForeground1: "#17643C",
  colorBrandForeground2: "#226C49",
  colorBrandBackground: "#226C49",
  colorBrandBackgroundHover: "#195C3D",
  colorBrandBackgroundPressed: "#12472F",
  colorNeutralBackground1: "#FFFFFF",
  colorNeutralBackground2: "#F9FAF8",
  colorNeutralForeground1: "#17211B",
  colorNeutralForeground2: "#536057",
  colorNeutralStroke1: "#D8DFD9",
  colorNeutralStroke2: "#E2E7E2",
  ...sharedOverrides,
};

// Fluent's computed dark palette already pulls its brand colors from the
// same relayBrand ramp and keeps AA contrast against its neutral
// backgrounds, so unlike the light theme this one is left otherwise
// un-tweaked instead of hand-picking near-duplicate overrides.
export const relayDarkTheme: Theme = {
  ...createDarkTheme(relayBrand),
  ...sharedOverrides,
};
