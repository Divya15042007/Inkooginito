export type SoundType = 'click' | 'pop' | 'draw' | 'erase' | 'timer' | 'bell' | 'victory' | 'buzz';

// Compatibility boundary: the app does not require audio hardware.
export function playSound(_type: SoundType, _enabled = true): void {}
