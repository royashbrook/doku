// A Little Room, an original doku theme. The score and voices stay editable.
// Render offline, not on a player's phone. No recordings or external samples.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const tempo = 80;
export const bars = 32;
export const sampleRate = 44100;
export const duration = bars * 4 * 60 / tempo;
const beat = 60 / tempo;
const frames = Math.round(duration * sampleRate);
const left = new Float32Array(frames), right = new Float32Array(frames);
let seed = 351031;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const frequency = note => {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
  const midi = (Number(octave) + 1) * 12 + {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter] + Number(!!sharp);
  return 440 * 2 ** ((midi - 69) / 12);
};

function note(voice, pitch, startBeat, length, gain, pan = 0) {
  const hz = frequency(pitch), start = Math.round(startBeat * beat * sampleRate);
  const held = length * beat, tail = voice === 'pad' ? 1.5 : 2;
  const seconds = held + tail, count = Math.ceil(seconds * sampleRate);
  const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
  const phase = random() * 0.3;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate, w = 2 * Math.PI * hz * t;
    const release = Math.exp(-Math.max(0, t - held) * (voice === 'pad' ? 3 : 7));
    const fade = Math.min(1, (seconds - t) / 0.03);
    let value;
    if (voice === 'felt') {
      value = Math.sin(w + 0.48 * Math.exp(-t * 10) * Math.sin(2 * w)) * Math.exp(-t * 1.5)
        + 0.30 * Math.sin(2.001 * w) * Math.exp(-t * 3.1)
        + 0.12 * Math.sin(3.003 * w) * Math.exp(-t * 4.8)
        + 0.035 * Math.sin(6.01 * w) * Math.exp(-t * 12);
      value *= 1 - Math.exp(-t * 550);
    } else if (voice === 'pluck') {
      value = 0;
      for (let h = 1; h <= 7; h++)
        value += Math.sin(h * w + phase) * Math.sin(h * Math.PI * .22) / h ** 1.3 * Math.exp(-t * (1.9 + h * .48));
      value *= 1 - Math.exp(-t * 650);
    } else if (voice === 'bell') {
      value = Math.sin(w) * Math.exp(-t * 2.2)
        + .35 * Math.sin(2.76 * w) * Math.exp(-t * 4.8)
        + .10 * Math.sin(5.40 * w) * Math.exp(-t * 8);
      value *= 1 - Math.exp(-t * 900);
    } else if (voice === 'bass') {
      value = (Math.sin(w) + .17 * Math.sin(2 * w) + .035 * Math.sin(3 * w))
        * (1 - Math.exp(-t * 80)) * Math.exp(-t * 1.35);
    } else {
      value = (Math.sin(w) + .12 * Math.sin(w * 2.0006) + .045 * Math.sin(w * 3.001))
        * (1 - Math.exp(-t * 30)) * Math.exp(-t * .44);
    }
    const at = (start + i) % frames;
    value *= gain * release * fade;
    left[at] += value * l;
    right[at] += value * r;
  }
}

function percussion(kind, startBeat, gain, pan) {
  const start = Math.round(startBeat * beat * sampleRate);
  const count = Math.ceil(sampleRate * .18);
  let previous = 0, smooth = 0;
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate, noise = random() * 2 - 1;
    smooth += (noise - smooth) * .11;
    let value;
    if (kind === 'brush') value = (noise - previous) * Math.exp(-t * 65) * .4;
    else if (kind === 'wood') value = (Math.sin(2 * Math.PI * 1180 * t) * .65 + smooth * .35) * Math.exp(-t * 125);
    else value = Math.sin(2 * Math.PI * (48 * t + .8 * (1 - Math.exp(-t * 35)))) * Math.exp(-t * 32);
    previous = noise;
    value *= gain * Math.min(1, t * 1800);
    const at = (start + i) % frames;
    left[at] += value * Math.sqrt((1 - pan) / 2);
    right[at] += value * Math.sqrt((1 + pan) / 2);
  }
}

// The little rising hop and its downward answer are the tune's calling card.
export const theme = [
  [[.5,'A4',.25],[1,'D5',.4],[1.5,'F#5',.7],[2.5,'E5',.3],[3,'D5',.7]],
  [[.25,'C#5',.45],[1,'E5',.45],[2,'B4',1.2]],
  [],
  [[.5,'A4',.25],[1,'B4',.45],[2,'D5',1.25]],
  [[.5,'G4',.3],[1,'B4',.4],[1.5,'D5',.75],[2.75,'F#5',.6]],
  [[.25,'E5',.45],[1,'D5',.4],[1.75,'C#5',.8],[3,'B4',.6]],
  [[.5,'A4',.25],[1,'D5',.4],[1.5,'F#5',.6],[2.5,'E5',.35],[3,'D5',.7]],
  [[.25,'C#5',.4],[1.25,'B4',.35],[2,'A4',.8]],
];
const answer = [
  [[.5,'F#5',.5],[1.5,'E5',.4],[2.5,'D5',.8]],
  [[1,'G5',.6],[2,'F#5',.4],[3,'E5',.5]],
  [[.5,'E5',.3],[1,'C#5',.5],[2,'B4',1]],
  [],
  [[.5,'D5',.25],[1,'F#5',.4],[1.75,'A5',.6],[3,'G5',.6]],
  [[.5,'F#5',.5],[1.5,'E5',.4],[2.5,'C#5',.9]],
  [[1,'B4',.4],[2,'D5',1]],
  [[.5,'E5',.4],[1.5,'C#5',.4],[2.5,'A4',.7]],
];
const chords = [
  ['D2',['D3','A3','C#4','E4','F#4']],
  ['C#2',['C#3','A3','B3','C#4','E4']],
  ['B1',['B2','F#3','A3','C#4','D4']],
  ['G2',['G3','B3','D4','F#4','A4']],
  ['E2',['E3','G3','B3','D4','F#4']],
  ['A1',['A2','G3','B3','D4','F#4']],
  ['F#2',['F#3','A3','C#4','E4','F#4']],
  ['A1',['A2','G3','B3','C#4','F#4']],
];
const bridge = [chords[2],chords[4],chords[5],chords[0],chords[3],chords[6],chords[4],chords[7]];

for (let bar = 0; bar < bars; bar++) {
  const section = Math.floor(bar / 8), position = bar % 8;
  const [root, chord] = (section === 1 ? bridge : chords)[position];
  const at = bar * 4;
  const piano = section === 1 ? answer : theme;
  for (const [j, pitch] of chord.entries())
    note('pad', pitch, at + j * .035, 2.8, .029, (j - 2) * .19);
  note('bass', root, at, 1.45, .14);
  if (bar % 4 !== 3) note('bass', root, at + 2.5, .7, .076);
  for (const [when, pitch, length] of piano[position])
    note('felt', pitch, at + when, length, section === 2 ? .144 : .155, .04 * Math.sin(bar));
  if (bar % 2 === 0)
    for (const [j, when] of [1.75, 3.25].entries())
      note('pluck', chord[2 + j], at + when, .55, .09, j === 0 ? -.28 : .28);
  if ([2, 11, 18, 26, 30].includes(bar)) {
    note('bell', position === 2 ? 'A5' : 'E6', at + 2.75, .45, .042, .35);
    note('bell', position === 2 ? 'F#5' : 'C#6', at + 3.5, .4, .035, -.28);
  }
  if (bar >= 2 && bar < 30) {
    for (let j = 0; j < 4; j++)
      percussion('brush', at + j + .55 + (j % 2 ? .035 : 0), .018, j % 2 ? .32 : -.3);
    percussion('wood', at + 1, .018, -.12);
    percussion('wood', at + 3.035, .014, .12);
    percussion('kick', at, .043, 0);
  }
}

// Circular reflections include the previous pass's tail at the loop boundary.
const dryL = left.slice(), dryR = right.slice();
for (const [j, seconds] of [.071,.113,.173,.239,.317,.419,.557,.701,.887,1.103,1.327,1.579].entries()) {
  const delay = Math.round(seconds * sampleRate), gain = .09 * Math.exp(-j * .19);
  for (let i = 0; i < frames; i++) {
    const at = (i + delay) % frames;
    left[at] += (j % 2 ? dryR[i] : dryL[i]) * gain;
    right[at] += (j % 2 ? dryL[i] : dryR[i]) * gain;
  }
}
let peak = 0, meanL = 0, meanR = 0;
for (let i = 0; i < frames; i++) { meanL += left[i]; meanR += right[i]; }
meanL /= frames; meanR /= frames;
for (let i = 0; i < frames; i++) {
  left[i] = Math.tanh((left[i] - meanL) * 1.1);
  right[i] = Math.tanh((right[i] - meanR) * 1.1);
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const master = .72 / peak;
const wav = Buffer.alloc(44 + frames * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(frames * 4, 40);
let sum = 0;
for (let i = 0; i < frames; i++) {
  const l = left[i] * master, r = right[i] * master;
  if (!Number.isFinite(l + r)) throw new Error(`Non-finite sample at ${i}`);
  wav.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  sum += (l * l + r * r) / 2;
}
const output = resolve(process.argv[2] ?? 'a-little-room.wav');
writeFileSync(output, wav);
console.log(JSON.stringify({output,tempo,bars,duration,sampleRate,peakDb:20*Math.log10(.72),rmsDb:20*Math.log10(Math.sqrt(sum/frames)),loopJoinDelta:Math.max(Math.abs(left[0]-left.at(-1)),Math.abs(right[0]-right.at(-1)))*master,seed:351031}));
