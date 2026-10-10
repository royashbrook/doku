# pet artwork

Original illustrations generated with OpenAI image generation, October 2026.
No existing game's images or logos were supplied or copied.

Direction: a friendly ginger tabby and an apricot poodle, head-only, rounded
mobile-puzzle artwork, softly painted fur, warm eyes, separate non-overlapping
subjects, no letters or accessories, transparent background. A second pass
removed the background while preserving the two heads.

`scripts/make-art.mjs` takes a two-column transparent atlas, extracts and trims
each half, then generates the WebP sprites and launcher icons. The shipped
sprites are the retained source artwork for future edits.

## animated faces

The same original heads were used as style references for two new transparent
four-by-four sprite sheets, generated with the built-in image tool. The prompt
requested softly painted head-only faces, no text or accessories, fixed framing
within each row, and four columns: centered eyes, looking left, looking right,
and a smiling blink. Cats: ginger, silver tabby, tuxedo, calico. Poodles: apricot,
cream, chocolate, charcoal with a silver muzzle.

A cleanup pass requested clean transparent fur edges, removal of detached
specks, and preservation of the same identities, expressions, and framing.

`scripts/make-pet-faces.mjs <cats-atlas.png> <poodles-atlas.png>` extracts,
normalizes and packs frames with transparent padding. `public/cats-faces.webp`
and `public/poodles-faces.webp` retain all 32 poses. No source image from another
game was used. Launcher icons and existing saved progress remain unchanged.

Each colored region keeps the same face on a given puzzle, even after undo,
reload, or a skin switch. Decorative glances and blinks use staggered CSS frame
timing, pause while the document is hidden, and are disabled for reduced motion.
