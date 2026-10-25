<script module lang="ts">
  for (const src of ["/cats-motion.webp", "/poodles-motion.webp"]) {
    const image = new Image();
    image.src = src;
    image.decode().catch(() => {}); // The real image still loads if warming fails.
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { nextGesture, type Gesture } from "./pet-motion";

  let {
    skin = "cats",
    large = false,
    identity = 0,
  }: {
    skin?: "cats" | "poodles";
    large?: boolean;
    identity?: number;
  } = $props();
  let frame = $state(0);
  let gesture = $state<Gesture | "rest">("rest");
  let paused = $state(false);
  let face: HTMLSpanElement;

  onMount(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let animation: Animation | undefined;
    let previous: Gesture | undefined;
    const stop = () => {
      clearTimeout(timer);
      animation?.cancel();
      frame = 0;
      gesture = "rest";
    };
    const play = () => {
      // Only one gesture owns the transform, even if timer and animation clocks differ.
      animation?.cancel();
      const plan = nextGesture(Math.random, previous);
      previous = plan.name;
      gesture = plan.name;
      animation = face.animate(
        [
          { transform: "none" },
          {
            transform: `rotate(${plan.tilt}deg) translateY(-1%)`,
            offset: 0.45,
          },
          { transform: "none" },
        ],
        { duration: plan.frames.length * plan.frameMs, easing: "ease-in-out" },
      );
      let at = 0;
      const step = () => {
        frame = plan.frames[at++];
        if (at < plan.frames.length) timer = setTimeout(step, plan.frameMs);
        else {
          gesture = "rest";
          timer = setTimeout(play, plan.restMs);
        }
      };
      step();
    };
    const refresh = () => {
      stop();
      paused = document.hidden || reduced.matches;
      if (!paused) timer = setTimeout(play, 300 + Math.random() * 4500);
    };
    document.addEventListener("visibilitychange", refresh);
    reduced.addEventListener("change", refresh);
    refresh();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", refresh);
      reduced.removeEventListener("change", refresh);
    };
  });
</script>

<span
  class="pet"
  class:large
  class:paused
  data-pet={skin}
  data-face={identity % 4}
  data-frame={frame}
  data-gesture={gesture}
  data-paused={paused}
  aria-hidden="true"
>
  <span class="pet-face" bind:this={face}>
    <img
      src={skin === "cats" ? "/cats-motion.webp" : "/poodles-motion.webp"}
      style={`left:${-(frame % 8) * 100}%;top:${-((identity % 4) * 2 + Math.floor(frame / 8)) * 100}%`}
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
  }
  img {
    position: absolute;
    width: 800%;
    height: 800%;
    max-width: none;
  }
  .paused img {
    animation-play-state: paused;
  }
</style>
