# pet animation art

The cat and poodle sheets are original illustrations generated with the built-in
OpenAI image-generation tool for this game. The original four-face sheets at
commit48b950e were the identity and style references. No third-party game art is used.

Each shipped sheet has64 cells:8 columns by8 rows, two rows per face,16 poses per
face. Faces are orange tabby, silver tabby, tuxedo and calico for cats; apricot,
cream, chocolate and charcoal for poodles. Files are1536 square WebP with alpha.
Each192px cell includes8px of transparent packing margin. Four-times as many
drawn frames per face does not mean four-times the animation frame rate.

## prompt set

The generation prompt requested the exact existing identities, plush detailed fur,
fixed head scale and nose anchor, an exact8x8 transparent atlas, no labels or props,
and two rows per identity. Sixteen frames in reading order:

0. neutral forward
1. eyelids halfway closing
2. closed blink
3. eyelids halfway reopening
4. slight left glance
5. full left glance
6. up-left glance
7. neutral return
8. slight right glance
9. full right glance
10. up-right glance
11. neutral return
12. left curious expression
13. right curious expression
14. small yawn
15. full gentle yawn

A cat correction prompt replaced accidental calico heads in the tuxedo's second
row, preserving the grid and other identities. Ear gestures requested in the
drafts are subtle; the runtime calls these expressions curious rather than
claiming articulated ears. These are drawn transitions, not a skeletal rig.

`node scripts/pack-pet-motion.mjs <cats.png> <poodles.png>` isolates64 opaque head
silhouettes rather than trusting exact grid alignment, sorts them by row/column,
uses a constant canvas scale per identity and adds transparent margins. A first
fixed-grid packing cut the neutral cat's chin despite passing edge-alpha checks.
Visual inspection caught it. The packer does not draw new facial features.
The chosen, metadata-stripped PNG sources are retained in `art/cats-motion.png`
and `art/poodles-motion.png` so the shipped atlases can be repacked later.
The runtime chooses short frame sequences with fresh per-instance randomness,
rests between them and holds neutral while hidden or reduced motion is enabled.

The new runtime uses `/cats-motion.webp` and `/poodles-motion.webp`. The original
four-pose `/cats-faces.webp` and `/poodles-faces.webp` remain unchanged for older
open pages. A new layout must not replace bytes under the legacy layout's URL:
the worker can claim a held client while that client still runs its old module.
