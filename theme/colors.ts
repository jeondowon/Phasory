// PHASE color tokens — PHASE-SPEC.md §2.2. Single source of truth for color.
// Orange is the only warm hue; everything else is neutral gray / slate.

export const colors = {
  // Accent (orange)
  accent: '#D97757',
  accentText: '#b8512f', // active pad title ("Rain")
  accentMuted: '#a86b52', // "PLAYING" / "RECORDING" / trim time labels
  accentDark: '#1a1006', // glyphs/labels on an orange fill
  accentTint: '#fbe9df', // active pad background

  // Categories / secondary
  slate: '#5e7185', // ambient / texture, slider fills, slate pins
  slateWave: '#6e7f93', // waveform bars (memory, slate pins)
  bone: '#9a9a98', // percussive, knobs, bone pins (neutral gray)

  // Surfaces
  screenBg: '#FAFAF8',
  stageBg: '#e8e8e6',
  bezel: '#d7d7d4',
  surface: '#F0F0EE', // pads / cards / waveform card
  surfaceRecessed: '#EBEBE9', // memory text field

  // Map
  mapLand: '#ededeb',
  mapPark: '#e6e8e5',
  mapBlock: '#e5e5e3',
  mapWater: '#dde3e9',
  mapCoast: '#cdd4db',
  mapRoad: '#fafaf8',

  // Text
  text: '#26262a',
  textField: '#36363a',
  textSecondary: '#555558',
  textMuted: '#6d6d70',
  textFaint: '#8c8c8f',
  textFainter: '#a3a3a6',
  textDisabled: '#bdbdbf',

  waveDark: '#5a5a58', // record selection bars

  // Pin placeholder photo layers
  pinPhoto: ['#cfd1d3', '#c6c8ca', '#a9abad', '#b9bbbd'] as const,
  pinWaveBg: '#e7ebf0',

  // Alpha tokens (used verbatim — §2.2)
  hairline: 'rgba(0,0,0,0.08)', // cards
  hairlineField: 'rgba(0,0,0,0.1)', // fields
  hairlineDash: 'rgba(0,0,0,0.16)', // dashed empty pads / photo slot
  hairlineDashSoft: 'rgba(0,0,0,0.13)',
  hairlineBtn: 'rgba(0,0,0,0.14)',
  keychip: 'rgba(0,0,0,0.15)',
  track: 'rgba(0,0,0,0.08)',
  bankInactive: 'rgba(0,0,0,0.18)',
  tabDivider: 'rgba(0,0,0,0.06)',
  ring: 'rgba(0,0,0,0.06)', // orbit static rings

  // Orange alphas
  accentBorder: 'rgba(217,119,87,0.5)',
  accentBorder55: 'rgba(217,119,87,0.55)',
  accentBorder6: 'rgba(217,119,87,0.6)',
  accentFill08: 'rgba(217,119,87,0.08)',
  accentTrack: 'rgba(217,119,87,0.18)',
  accentWave: 'rgba(217,119,87,0.07)',
  accentGlow: 'rgba(217,119,87,0.4)',
} as const;
