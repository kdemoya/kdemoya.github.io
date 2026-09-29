// Shared by the live particle field and scripts/render-portrait.mjs.
// Stable marks give the resting portrait a sketch texture without idle motion.
(() => {
  const noise = (index) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  window.PORTRAIT_STYLE = {
    dotOpacity: 0.8,
    trailOpacity: 0.46,
    softOpacity: 0.1,
    strokeWidth: 0.00175,
    softWidth: 0.0058,
    sample(x, y, index, alpha = 1) {
      const grain = noise(index + 8101);
      const variation = noise(index + 9109);
      const coverage = Math.sqrt(alpha);
      const angle =
        0.65 +
        Math.sin(y * 10 + x * 5) * 0.45 +
        (noise(index + 10103) - 0.5) * 0.65;
      const length =
        (0.009 +
          Math.pow(noise(index + 11113), 1.7) * 0.024 +
          (index % 7 === 0 ? 0.012 : 0)) *
        coverage;
      const bend = (variation - 0.5) * length * 0.4;
      // Y distances account for the portrait's 4:5 aspect ratio.
      return {
        x: x + Math.sin(y * 26 + x * 7) * 0.0035 + (grain - 0.5) * 0.01,
        y: y + Math.cos(x * 19 - y * 9) * 0.002 + (variation - 0.5) * 0.008,
        radiusScale: 0.48 + noise(index + 12109) * 0.3,
        tailX: Math.cos(angle) * length,
        tailY: Math.sin(angle) * length * 0.8,
        bendX: -Math.sin(angle) * bend,
        bendY: Math.cos(angle) * bend * 0.8,
      };
    },
  };
})();
