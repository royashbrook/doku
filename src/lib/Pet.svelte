<script module lang="ts">
  // Warm both face sheets at startup, so the first placed pet has less decode
  // work left. decoding="sync" below is a hint toward the same end.
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
  // Offset by identity and species so even the two default home pets have different habits.
  const personality = $derived(
    Math.abs(Math.trunc(identity)) * 37 + (skin === "poodles" ? 13 : 0),
  );
  const habit = $derived(["peek", "nod", "listen", "settle"][personality % 4]);
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
  data-habit={habit}
  style={`--face:${identity % 4};--glance-duration:${9.1 + (personality % 17) * 0.43}s;--glance-delay:${-((personality * 1.31) % 11)}s;--idle-duration:${12.7 + (personality % 23) * 0.61}s;--idle-delay:${-((personality * 2.17) % 19)}s;--glance-direction:${personality % 2 ? "reverse" : "normal"}`}
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
    transform-origin: 50% 85%;
    animation: pet-peek var(--idle-duration) ease-in-out infinite;
    animation-delay: var(--idle-delay);
  }
  .pet[data-habit="nod"] .pet-face {
    animation-name: pet-nod;
  }
  .pet[data-habit="listen"] .pet-face {
    animation-name: pet-listen;
  }
  .pet[data-habit="settle"] .pet-face {
    animation-name: pet-settle;
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
    animation-direction: var(--glance-direction);
  }
  .paused img,
  .paused .pet-face {
    animation-play-state: paused;
  }
  /* Most of each cycle is still. Short, different gestures feel less like a dance. */
  @keyframes pet-peek {
    0%,
    68%,
    92%,
    100% {
      transform: none;
    }
    76% {
      transform: rotate(-5deg) translateY(-1%);
    }
    84% {
      transform: rotate(-3deg);
    }
  }
  @keyframes pet-nod {
    0%,
    72%,
    94%,
    100% {
      transform: none;
    }
    79% {
      transform: translateY(2%) scaleY(0.98);
    }
    86% {
      transform: translateY(-1%);
    }
  }
  @keyframes pet-listen {
    0%,
    60%,
    95%,
    100% {
      transform: none;
    }
    70% {
      transform: rotate(6deg) translateY(-2%);
    }
    81% {
      transform: rotate(4deg);
    }
    89% {
      transform: rotate(-2deg);
    }
  }
  @keyframes pet-settle {
    0%,
    76%,
    96%,
    100% {
      transform: none;
    }
    84% {
      transform: translateY(1%) scale(1.015, 0.985);
    }
    91% {
      transform: none;
    }
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
    img,
    .pet-face {
      animation: none;
    }
  }
</style>
