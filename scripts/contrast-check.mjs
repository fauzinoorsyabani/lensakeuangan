const palette = {
  ink: "#050505",
  panel: "#121212",
  text: "#F5F5F5",
  muted: "#A7A7A7",
  softWhite: "#D8D8D8",
};

function hexToLinear(hex) {
  const values = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  return values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
}

function luminance(hex) {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const checks = [
  ["Text on Ink", palette.text, palette.ink],
  ["Muted on Ink", palette.muted, palette.ink],
  ["Text on Panel", palette.text, palette.panel],
  ["Muted on Panel", palette.muted, palette.panel],
  ["Soft White on Ink", palette.softWhite, palette.ink],
  ["Soft White on Panel", palette.softWhite, palette.panel],
].map(([label, foreground, background]) => ({ label, ratio: Number(contrast(foreground, background).toFixed(2)), foreground, background }));

console.table(checks);
if (checks.some((check) => check.ratio < 4.5)) process.exitCode = 1;
