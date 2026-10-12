<script module lang="ts">
  // Decode both face sheets at startup. With decoding="sync" below, a placed
  // pet then paints in the same frame as the crosses, not after its own decode.
  for (const src of ["/cats-faces.webp", "/poodles-faces.webp"]) {
    const image = new Image();
    image.src = src;
    image.decode().catch(() => {}); // a failed preload leaves the real <img> to load it
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";

  let {
    skin = "cats",
    large = false,
    identity = 0,
  }: {
    skin?: "cats" | "poodles";
    large?: boolean;
    identity?: number;
  } = $props();
  let paused = $state(false);
  onMount(() => {
    const visibility = () => (paused = document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  });
</script>

<span
  class:large
  class:paused
  class="pet"
  data-pet={skin}
  data-face={identity % 4}
  style={`--face:${identity % 4};--glance-duration:${8 + (identity % 3)}s;--glance-delay:${-((identity * 1.7) % 8)}s`}
  aria-hidden="true"
>
  <span class="pet-face">
    <img
      src={skin === "cats" ? "/cats-faces.webp" : "/poodles-faces.webp"}
      alt=""
      decoding="sync"
      draggable="false"
    />
  </span>
</span>

<style>
  .pet {
    display: inline-block;
    flex-shrink: 0;
    width: 94%;
    height: 94%;
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 2px 1px rgb(44 35 27 / 0.16));
  }
  .large {
    width: 170px;
    height: 170px;
  }
  .pet-face {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  img {
    position: absolute;
    top: calc(var(--face) * -100%);
    left: 0;
    width: 400%;
    height: 400%;
    max-width: none;
    animation: pet-glance var(--glance-duration) steps(1, end) infinite;
    animation-delay: var(--glance-delay);
  }
  .paused img {
    animation-play-state: paused;
  }
  /* Frames are center, left, right, blink. Each pet keeps its own quiet rhythm. */
  @keyframes pet-glance {
    0%,
    18%,
    21%,
    45%,
    76%,
    85%,
    100% {
      left: 0;
    }
    19%,
    20%,
    83%,
    84% {
      left: -300%;
    }
    30%,
    44% {
      left: -100%;
    }
    62%,
    75% {
      left: -200%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    img {
      animation: none;
    }
  }
</style>
