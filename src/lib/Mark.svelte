<script module lang="ts">
  import {
    IconBoltFilled,
    IconCircleFilled,
    IconCloudFilled,
    IconCloverFilled,
    IconCrownFilled,
    IconDiamondFilled,
    IconDropletFilled,
    IconFlowerFilled,
    IconHeartFilled,
    IconLeafFilled,
    IconMoonFilled,
    IconMushroomFilled,
    IconSquareRoundedFilled,
    IconStarFilled,
    IconSunFilled,
    IconTriangleFilled,
  } from "@tabler/icons-svelte";

  // One faint shape per palette colour, so a colour reads by its mark too.
  export const marks = [
    ["heart", IconHeartFilled],
    ["star", IconStarFilled],
    ["moon", IconMoonFilled],
    ["sun", IconSunFilled],
    ["cloud", IconCloudFilled],
    ["drop", IconDropletFilled],
    ["leaf", IconLeafFilled],
    ["flower", IconFlowerFilled],
    ["bolt", IconBoltFilled],
    ["clover", IconCloverFilled],
    ["crown", IconCrownFilled],
    ["mushroom", IconMushroomFilled],
    ["circle", IconCircleFilled],
    ["triangle", IconTriangleFilled],
    ["square", IconSquareRoundedFilled],
    ["diamond", IconDiamondFilled],
  ] as const;
</script>

<script lang="ts">
  let { color }: { color: number } = $props();
  const [name, Shape] = $derived(marks[color]);
</script>

<Shape class="mark" data-mark={name} size={18} aria-hidden="true" />
