import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("the original music master is audible, bounded and has a quiet loop join", () => {
  const dir = mkdtempSync(join(tmpdir(), "doku-music-check-"));
  try {
    const file = join(dir, "theme.wav");
    const run = spawnSync(process.execPath, ["music/render-theme.mjs", file], {
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    const meta = JSON.parse(run.stdout);
    const wav = readFileSync(file);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), meta.sampleRate);
    assert.equal(wav.length, 44 + Math.round(meta.duration * meta.sampleRate) * 4);
    assert.equal(meta.duration, (meta.bars * 4 * 60) / meta.tempo);
    assert.ok(meta.duration >= 60 && meta.duration <= 180);
    let peak = 0, energy = 0;
    for (let at = 44; at < wav.length; at += 2) {
      const sample = wav.readInt16LE(at) / 32768;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / ((wav.length - 44) / 2));
    assert.ok(peak > 0.1 && peak < 0.8, `peak ${peak}`);
    assert.ok(rms > 0.03 && rms < 0.25, `rms ${rms}`);
    for (const channel of [0, 1]) {
      const first = wav.readInt16LE(44 + channel * 2) / 32768;
      const last = wav.readInt16LE(wav.length - 4 + channel * 2) / 32768;
      assert.ok(Math.abs(first - last) < 0.002, "loop join has no large sample step");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
