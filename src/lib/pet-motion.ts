export const gestures = {
  blink: [0, 1, 2, 3, 0],
  left: [0, 4, 5, 6, 5, 4, 7, 0],
  right: [0, 8, 9, 10, 9, 8, 11, 0],
  curious: [0, 12, 13, 12, 0],
  yawn: [0, 14, 15, 15, 14, 0],
} as const;
export type Gesture = keyof typeof gestures;

export function nextGesture(random = Math.random, previous?: Gesture) {
  const choices = (Object.keys(gestures) as Gesture[]).filter(
    (name) => name !== previous,
  );
  const name = choices[Math.floor(random() * choices.length)];
  return {
    name,
    frames: gestures[name],
    frameMs: name === "blink" ? 65 + random() * 35 : 95 + random() * 55,
    restMs: 2200 + random() * 6500,
    tilt: (random() - 0.5) * 7,
  };
}
