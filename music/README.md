# a little room

An original listening draft for doku. Not connected to the game yet.

80 bpm, D major, 32 bars, 96 seconds. A soft felt-key melody, warm plucked
strings, rounded bass and a small brushed rhythm. The rising A-D-F# hop and
its E-D answer return between quieter phrases. A higher middle section gives
the theme some movement without a big change in energy.

The composition, synthesized instruments and recording were made for this
project. No third-party recordings, samples or borrowed game melodies.
Copyright 2026 Roy Ashbrook. Released under the project's MIT license.

## render

Node alone renders the uncompressed, circular master:

```sh
node music/render-theme.mjs /tmp/a-little-room.wav
```

The optional output argument defaults to `a-little-room.wav`. The renderer
prints duration, level and the boundary's sample difference. Its fixed seed
keeps instrument variation repeatable. It runs offline, never on a player's phone.

The listening draft adds fades, rather than making the listener hear a hard
start or an endless loop. Generate it with ffmpeg:

```sh
ffmpeg -i /tmp/a-little-room.wav \
  -af 'afade=t=in:d=0.6,afade=t=out:st=93:d=3' \
  -codec:a libmp3lame -q:a 2 \
  -metadata title='A Little Room' -metadata artist='Roy Ashbrook' \
  music/a-little-room-preview.mp3
```

The preview is not the eventual loop asset. It is here to judge the tune before
adding playback controls. That integration remains tracked under issue 35.
