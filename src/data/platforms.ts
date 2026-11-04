export interface Platform {
  os: string;
  requires: string;
  href: string;
  file: string;
  command: string;
  output: string[];
}

const PLACEHOLDER = `${import.meta.env.BASE_URL}downloads/yien-placeholder.txt`;
const NEXT_STEP = [" ", "Open a project with: yien ~/shop"];

export const PLATFORMS: Platform[] = [
  {
    os: "macOS",
    requires: "macOS 13 or newer",
    href: PLACEHOLDER,
    file: "yien-1.4.0-macos.txt",
    command: "brew install --cask yien",
    output: [
      "==> Downloading yien-1.4.0-arm64.dmg",
      "==> Installing Cask yien",
      "yien was successfully installed!",
      ...NEXT_STEP,
    ],
  },
  {
    os: "Windows",
    requires: "Windows 10 or newer",
    href: PLACEHOLDER,
    file: "yien-1.4.0-windows.txt",
    command: "winget install yien",
    output: [
      "Found YIEN [yien.yien] Version 1.4.0",
      "Downloading yien-1.4.0-x64.msi",
      "Successfully installed",
      ...NEXT_STEP,
    ],
  },
  {
    os: "Linux",
    requires: "any distribution with Flatpak",
    href: PLACEHOLDER,
    file: "yien-1.4.0-linux.txt",
    command: "flatpak install yien",
    output: [
      "Looking for matches: sh.yien.Yien",
      "Installing sh.yien.Yien 1.4.0",
      "Installation complete.",
      ...NEXT_STEP,
    ],
  },
];

export function detectPlatform(): Platform {
  const { platform } = navigator;
  const os = /Win/.test(platform) ? "Windows" : /Linux/.test(platform) ? "Linux" : "macOS";
  return PLATFORMS.find((candidate) => candidate.os === os)!;
}
