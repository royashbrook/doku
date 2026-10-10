<script lang="ts">
  let {
    skin = "cats",
    large = false,
  }: { skin?: "cats" | "poodles"; large?: boolean } = $props();
</script>

<img
  class:large
  class="pet"
  src={skin === "cats" ? "/cat.webp" : "/poodle.webp"}
  alt=""
  draggable="false"
/>

<style>
  .pet {
    width: 94%;
    height: 94%;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 2px 1px rgb(44 35 27 / 0.16));
  }
  .pet.large {
    width: 170px;
    height: 170px;
  }
</style>
