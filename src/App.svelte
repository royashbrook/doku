<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    IconArrowLeft,
    IconArrowRight,
    IconCalendar,
    IconCheck,
    IconHelp,
    IconPaw,
    IconPlayerPlayFilled,
    IconRefresh,
    IconSettings,
    IconShare,
    IconSparkles,
    IconArrowBackUp as IconUndo,
    IconX,
    IconQuestionMark,
    IconHeart,
    IconDownload,
    IconMoon,
    IconSun,
  } from "@tabler/icons-svelte";
  import Pet from "./lib/Pet.svelte";
  import rawBoards from "./lib/boards.json";
  import { blocked, conflict, dailyIndex, hint, won } from "./lib/puzzle.ts";
  import { paint, palette } from "./lib/colors.ts";
  import type { Cell, Hint, Puzzle } from "./lib/puzzle.ts";
  import { load, parseSave, store } from "./lib/storage.ts";
  import type { Save } from "./lib/storage.ts";
  import { startPwa, initialPwaState } from "./lib/pwa.ts";

  const puzzles = rawBoards as Puzzle[],
    sizes = puzzles.map((p) => p.size);
  const loaded = load(sizes);
  let save = $state<Save>(loaded.save),
    warning = $state(loaded.warning),
    writesBlocked = loaded.blocked;
  let screen = $state<"home" | "play" | "levels" | "looks">("home");
  let index = $state(loaded.save.current),
    cells = $state<Cell[]>([]),
    history = $state<Cell[][]>([]);
  let clue = $state<Hint | null>(null),
    message = $state("");
  let daily = $state(false),
    finished = $state(false);
  let drag: {
    pointer: number;
    start: number;
    x: number;
    y: number;
    drawing: boolean;
    value: Cell;
    board: HTMLElement;
  } | null = null;
  let panel = $state(""),
    dialog: HTMLDialogElement,
    transfer = $state(""),
    pendingImport = $state<Save | null>(null);
  let pwa = $state(initialPwaState()),
    updater: ReturnType<typeof startPwa> | undefined;
  let group = $state(5);
  const puzzle = $derived(puzzles[index]);
  const colors = $derived(paint(puzzle, palette).map((pick) => palette[pick]));
  const excluded = $derived(blocked(puzzle, cells));
  const pets = $derived(cells.filter((v) => v === 2).length);
  const regionPets = $derived(
    Array.from({ length: puzzle.size }, (_, region) =>
      cells.findIndex((v, at) => v === 2 && puzzle.regions[at] === region),
    ),
  );
  const conflictCells = $derived(
    new Set(
      cells.flatMap((v, i) =>
        v === 2 &&
        cells.some(
          (other, j) => j !== i && other === 2 && conflict(puzzle, i, j),
        )
          ? [i]
          : [],
      ),
    ),
  );
  const day = () => new Date().toLocaleDateString("en-CA");
  function persist() {
    if (screen === "play") save.boards[index] = [...cells];
    if (!writesBlocked && !store(save))
      warning =
        "Progress is not being saved on this device. You can copy a save code from More.";
  }
  function play(at = save.current, isDaily = false) {
    index = at;
    daily = isDaily;
    cells = [
      ...(save.boards[at] ?? Array<Cell>(puzzles[at].size ** 2).fill(0)),
    ];
    history = [];
    clue = null;
    message = "";
    finished = won(puzzles[at], cells);
    screen = "play";
    panel = "";
    if (!isDaily) save.current = at;
    persist();
    if (finished) panel = "win";
  }
  function edit(at: number, value: Cell) {
    if (finished || cells[at] === value) return;
    history = [...history.slice(-99), [...cells]];
    cells[at] = value;
    clue = null;
    message = conflictCells.size
      ? "One per row, column and region. Give each pet some space."
      : "";
    finished = won(puzzle, cells);
    if (finished && !save.completed.includes(index)) save.completed.push(index);
    persist();
    if (finished) panel = "win";
  }
  function tap(at: number) {
    edit(at, ((cells[at] + 1) % 4) as Cell);
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    cells = previous;
    history = history.slice(0, -1);
    finished = false;
    clue = null;
    message = "";
    persist();
  }
  function reset() {
    history = [...history.slice(-99), [...cells]];
    cells = Array<Cell>(puzzle.size ** 2).fill(0);
    clue = null;
    message = "";
    finished = false;
    panel = "";
    persist();
  }
  function next() {
    const nextIndex = (index + 1) % puzzles.length;
    play(nextIndex);
  }
  function setSkin(skin: Save["skin"]) {
    save.skin = skin;
    persist();
  }
  function toggleTheme() {
    save.theme = save.theme === "day" ? "night" : "day";
    persist();
  }
  function getHint() {
    clue = hint(puzzle, cells);
  }
  async function share() {
    const url = new URL(location.origin);
    url.searchParams.set("puzzle", String(index + 1));
    try {
      if (navigator.share)
        await navigator.share({
          title: "doku",
          text: "Try this pet puzzle.",
          url: url.href,
        });
      else {
        await navigator.clipboard.writeText(url.href);
        message = "Puzzle link copied.";
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      transfer = url.href;
      panel = "share";
    }
  }
  function exportSave() {
    transfer = JSON.stringify(save);
    panel = "transfer";
  }
  function previewImport() {
    try {
      pendingImport = parseSave(transfer, sizes);
      panel = "import";
      message = "";
    } catch (error) {
      message =
        error instanceof Error ? error.message : "Could not read this save.";
    }
  }
  function importSave() {
    if (!pendingImport) return;
    // Replacement is explicit, and a failed write never claims an imported save is durable.
    if (!store(pendingImport)) {
      message =
        "Could not save the import. Your current progress is unchanged.";
      return;
    }
    save = pendingImport;
    pendingImport = null;
    writesBlocked = false;
    warning = "";
    screen = "home";
    panel = "";
    message = "";
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(transfer);
      message = "Copied.";
    } catch {
      message =
        "Select the code and copy it. Clipboard access is unavailable here.";
    }
  }
  function navigate(to: typeof screen) {
    persist();
    screen = to;
    panel = "";
    message = "";
  }
  function keys(event: KeyboardEvent, at: number) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -puzzle.size,
      ArrowDown: puzzle.size,
    };
    if (event.key in offsets) {
      event.preventDefault();
      const to = Math.max(
        0,
        Math.min(cells.length - 1, at + offsets[event.key]),
      );
      document.getElementById("cell-" + to)?.focus();
    }
  }
  function startDrag(event: PointerEvent, at: number) {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    event.preventDefault();
    const button = event.currentTarget as HTMLElement;
    button.setPointerCapture(event.pointerId);
    drag = {
      pointer: event.pointerId,
      start: at,
      x: event.clientX,
      y: event.clientY,
      drawing: false,
      value: cells[at] === 1 ? 0 : 1,
      board: button.closest<HTMLElement>(".board")!,
    };
  }
  function dragMove(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    // Native move events can skip squares during a fast swipe.
    const steps = Math.ceil(
      Math.max(Math.abs(dx), Math.abs(dy)) /
        (drag.board.getBoundingClientRect().width / puzzle.size / 2),
    );
    for (let step = 1; step <= steps; step++) {
      const element = document
        .elementFromPoint(
          drag.x + (dx * step) / steps,
          drag.y + (dy * step) / steps,
        )
        ?.closest<HTMLElement>("[data-cell]");
      if (!element || !drag.board.contains(element)) continue;
      const at = Number(element.dataset.cell);
      if (!drag.drawing && at !== drag.start) {
        drag.drawing = true;
        if (cells[drag.start] !== 2) edit(drag.start, drag.value);
      }
      if (drag.drawing && cells[at] !== 2) edit(at, drag.value);
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  }
  function finishDrag(event: PointerEvent) {
    if (!drag || drag.pointer !== event.pointerId) return;
    dragMove(event);
    const stroke = drag;
    drag = null;
    const released = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-cell]");
    if (!stroke.drawing && released?.dataset.cell === String(stroke.start))
      tap(stroke.start);
  }
  function cancelDrag(event: PointerEvent) {
    if (drag?.pointer === event.pointerId) drag = null;
  }
  function modalKeys(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const controls = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) return;
    // Chromium otherwise takes one Tab through the document body at the boundary.
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  $effect(() => {
    document.documentElement.dataset.theme = save.theme;
  });
  $effect(() => {
    if (panel) {
      void tick().then(() => {
        if (panel && dialog && !dialog.open) dialog.showModal();
      });
    } else if (dialog?.open) dialog.close();
  });
  onMount(() => {
    updater = startPwa((state) => (pwa = state), persist);
    const requested = Number(new URL(location.href).searchParams.get("puzzle"));
    if (
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= puzzles.length
    )
      play(requested - 1);
    const stopDrag = () => {
      drag = null;
    };
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", cancelDrag);
    window.addEventListener("blur", stopDrag);
    window.addEventListener("pagehide", persist);
    return () => {
      updater?.destroy();
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      window.removeEventListener("blur", stopDrag);
      window.removeEventListener("pagehide", persist);
    };
  });
</script>

<div class="app" class:playing={screen === "play"}>
  <header>
    {#if screen === "play"}
      <button
        class="icon-button"
        aria-label="Back to home"
        onclick={() => navigate("home")}><IconArrowLeft size={24} /></button
      >
      <div class="play-title">
        <strong>{daily ? "daily puzzle" : `puzzle ${index + 1}`}</strong><span
          >{puzzle.difficulty} · {puzzle.size} × {puzzle.size}</span
        >
      </div>
    {:else}
      <button
        class="wordmark"
        aria-label="doku home"
        onclick={() => navigate("home")}>doku<span>.</span></button
      >
    {/if}
    <div class="header-right">
      <span class="version">v{__APP_VERSION__}</span><button
        class="icon-button"
        aria-label="How to play"
        onclick={() => (panel = "help")}><IconHelp size={23} /></button
      >
    </div>
  </header>
  {#if warning}<p class="storage-warning" role="status">{warning}</p>{/if}
  {#if pwa.notice}
    <aside class="update-banner" aria-live="polite">
      <span>A fresh doku is ready.</span><button
        onclick={() => updater?.apply()}
        disabled={pwa.applying}>{pwa.applying ? "Updating…" : "Update"}</button
      ><button
        class="icon-button"
        aria-label="Update later"
        onclick={() => updater?.later()}><IconX size={18} /></button
      >
    </aside>
  {/if}

  <main class:home={screen === "home"}>
    {#if screen === "home"}
      <section class="welcome">
        <div class="pet-pair">
          <div class="pet-bubble cat-bubble"><Pet skin="cats" large /></div>
          <div class="pet-bubble dog-bubble"><Pet skin="poodles" large /></div>
          <span class="little-cross" aria-hidden="true">+</span>
        </div>
        <h1>a little room<br />for every pet.</h1>
        <p>
          One in each row, column and color.<br />A little space between
          neighbors.
        </p>
        <button class="primary play-button" onclick={() => play()}
          ><IconPlayerPlayFilled size={21} />{save.boards[save.current]?.some(
            (v) => v !== 0,
          )
            ? "keep playing"
            : "let’s play"}<IconArrowRight size={22} /></button
        >
        <span class="progress-note"
          >{save.completed.length
            ? `${save.completed.length} puzzles made cozy`
            : `${puzzles.length} puzzles. all yours.`}</span
        >
      </section>
      <button
        class="daily-card"
        onclick={() => play(dailyIndex(day(), puzzles.length), true)}
        ><span class="daily-symbol"><IconCalendar size={30} /></span><span
          ><strong>a puzzle for today</strong><small
            >same puzzle, everyone’s own little way</small
          ></span
        ><IconArrowRight size={23} /></button
      >
      <div class="home-links">
        <button onclick={() => navigate("levels")}
          >all puzzles <IconArrowRight size={18} /></button
        ><button onclick={() => (panel = "help")}
          >how to play <IconHelp size={18} /></button
        >
      </div>
    {:else if screen === "play"}
      <section class="game-area" aria-label="Puzzle">
        <div class="game-top">
          <ul
            class="region-row"
            style={`--size:${puzzle.size}`}
            hidden={!!(pwa.notice || warning)}
            aria-label="Colors"
          >
            {#each regionPets as at, region}
              <li
                style={`--region:${colors[region]}`}
                aria-label={`Region ${region + 1}: ${at < 0 ? "empty" : save.skin === "cats" ? "cat" : "poodle"}`}
              >
                {#if at >= 0}<Pet
                    skin={save.skin}
                    identity={index + region}
                  />{:else if save.labels}{region + 1}{/if}
              </li>
            {/each}
          </ul>
          <span
            ><IconPaw size={19} />
            {pets} / {puzzle.size}
            {save.skin === "cats" ? "cats" : "poodles"}</span
          ><button
            class="icon-button"
            aria-label="Share this puzzle"
            onclick={share}><IconShare size={21} /></button
          >
        </div>
        <div class="board-wrap">
          <div
            class="board"
            style={`--size:${puzzle.size}`}
            onpointermove={dragMove}
            role="group"
            aria-label={`${puzzle.size} by ${puzzle.size} board`}
          >
            {#each cells as cell, at}
              {@const row = Math.floor(at / puzzle.size)}
              {@const col = at % puzzle.size}
              {@const region = puzzle.regions[at]}
              <button
                id={"cell-" + at}
                data-cell={at}
                class="cell"
                class:pet-cell={cell === 2}
                class:crossed={cell === 1 ||
                  (cell === 0 && save.autoCross && excluded.has(at))}
                class:bad={conflictCells.has(at)}
                class:hinted={clue?.index === at}
                style={`--region:${colors[region]}`}
                aria-label={`Row ${row + 1}, column ${col + 1}, region ${region + 1}: ${cell === 2 ? (save.skin === "cats" ? "cat" : "poodle") : cell === 1 ? "crossed out" : cell === 3 ? "maybe" : save.autoCross && excluded.has(at) ? "ruled out by a pet" : "empty"}`}
                aria-pressed={cell === 2}
                disabled={finished}
                onclick={(event) => {
                  // Pointer gestures finish on release. Keyboard and assistive clicks have no pointer.
                  if (event.detail === 0) tap(at);
                }}
                onpointerdown={(event) => startDrag(event, at)}
                onlostpointercapture={cancelDrag}
                onkeydown={(event) => keys(event, at)}
              >
                {#if cell === 2}<Pet
                    skin={save.skin}
                    identity={index + region}
                  />{:else if cell === 1 || (cell === 0 && save.autoCross && excluded.has(at))}<IconX
                    class="cross-edge"
                    size={18}
                    viewBox="2 2 20 20"
                    stroke={5.6}
                  /><IconX
                    class="cross"
                    size={18}
                    viewBox="2 2 20 20"
                    stroke={4.4}
                  />{:else if cell === 3}<IconQuestionMark
                    class="maybe-edge"
                    size={18}
                    stroke={4}
                  /><IconQuestionMark class="maybe" size={18} stroke={3} />{/if}
                {#if save.labels}<span class="region-label">{region + 1}</span
                  >{/if}
              </button>
            {/each}
          </div>
        </div>
        <div class="hint-line" aria-live="polite">
          {#if clue}<p>{clue.text}</p>{:else if message}<p>
              {message}
            </p>{:else}<p>
              tap: cross, pet, maybe, clear. slide to cross out.
            </p>{/if}
        </div>
        <div class="game-tools">
          <button onclick={undo} disabled={!history.length}
            ><IconUndo size={23} /><span>undo</span></button
          ><button onclick={getHint} disabled={finished}
            ><IconSparkles size={23} /><span>hint</span></button
          ><button onclick={() => (panel = "reset")}
            ><IconRefresh size={23} /><span>reset</span></button
          ><button onclick={() => navigate("looks")}
            ><IconPaw size={23} /><span>looks</span></button
          >
        </div>
      </section>
    {:else if screen === "levels"}
      <section class="scroll-page">
        <h1>find your cozy.</h1>
        <p class="subhead">a little room. or a lot. choose your board size.</p>
        <div class="difficulty-tabs">
          {#each [...new Set(sizes)] as size}<button
              class:active={group === size}
              aria-pressed={group === size}
              onclick={() => (group = size)}>{size} × {size}</button
            >{/each}
        </div>
        <div class="level-grid">
          {#each puzzles as board, at}{#if board.size === group}<button
                class:done={save.completed.includes(at)}
                onclick={() => play(at)}
                aria-label={`Puzzle ${at + 1}${save.completed.includes(at) ? ", completed" : ""}`}
                ><span>{at + 1}</span
                >{#if save.completed.includes(at)}<IconCheck
                    size={18}
                  />{:else}<small>{board.size} × {board.size}</small
                  >{/if}</button
              >{/if}{/each}
        </div>
      </section>
    {:else if screen === "looks"}
      <section class="scroll-page looks">
        <h1>your kind of company.</h1>
        <p class="subhead">same puzzle. different little faces.</p>
        <div class="skin-choices">
          {#each ["cats", "poodles"] as skin}<button
              class:selected={save.skin === skin}
              aria-pressed={save.skin === skin}
              onclick={() => setSkin(skin as Save["skin"])}
              ><Pet skin={skin as Save["skin"]} large /><strong>{skin}</strong
              ><span
                >{skin === "cats"
                  ? "a little independent."
                  : "a little curly."}</span
              >{#if save.skin === skin}<IconCheck size={23} />{/if}</button
            >{/each}
        </div>
        <button class="primary" onclick={() => play(index, daily)}
          >back to the puzzle <IconArrowRight size={20} /></button
        >
      </section>
    {/if}
  </main>
  {#if screen !== "play"}
    <nav aria-label="Main navigation">
      <button onclick={() => play()}
        ><IconPlayerPlayFilled size={24} /><span>play</span></button
      ><button onclick={() => play(dailyIndex(day(), puzzles.length), true)}
        ><IconCalendar size={24} /><span>daily</span></button
      ><button
        class:active={screen === "looks"}
        onclick={() => navigate("looks")}
        ><IconPaw size={24} /><span>looks</span></button
      ><button onclick={() => (panel = "more")}
        ><IconSettings size={24} /><span>more</span></button
      >
    </nav>
  {/if}
</div>

<dialog
  bind:this={dialog}
  class:win-dialog={panel === "win"}
  onkeydown={modalKeys}
  onclose={() => (panel = "")}
  oncancel={() => (panel = "")}
>
  <div class="dialog-heading">
    <h2>
      {(
        {
          help: "a home for every pet",
          more: "make yourself at home",
          reset: "start this puzzle again?",
          about: "doku.",
          transfer: "take your progress with you",
          import: "use this saved progress?",
          install: "keep doku close",
          share: "send this puzzle",
          win: "everyone’s home.",
        } as Record<string, string>
      )[panel]}
    </h2>
    <button class="icon-button" aria-label="Close" onclick={() => (panel = "")}
      ><IconX size={23} /></button
    >
  </div>
  {#if panel === "win"}
    <div class="win">
      <span class="win-pets"><Pet skin={save.skin} /></span>
      <p>nicely done. a little more room?</p>
      <button class="primary" onclick={next}
        >next puzzle <IconArrowRight size={20} /></button
      ><button class="text-button" onclick={() => navigate("levels")}
        >choose a puzzle</button
      >
    </div>
  {:else if panel === "help"}
    <div class="how-pet"><Pet skin={save.skin} /></div>
    <ol class="rules">
      <li><strong>one per row.</strong> and one per column.</li>
      <li>
        <strong>one per color region.</strong> the dark lines show each region.
      </li>
      <li>
        <strong>give them space.</strong> no touching, even corner to corner.
      </li>
    </ol>
    <p>
      Tap once to cross out, again for a pet, again for maybe, and again to
      clear. Slide across squares to cross them out. Start on a cross to erase
      crosses. Sliding leaves placed pets alone. Undo and hints are always free.
    </p>
    <button class="primary" onclick={() => (panel = "")}
      >got it <IconCheck size={20} /></button
    >
  {:else if panel === "more"}
    <div class="settings">
      <button onclick={toggleTheme}
        >{#if save.theme === "day"}<IconMoon size={23} />{:else}<IconSun
            size={23}
          />{/if}<span
          >{save.theme === "day" ? "evening colors" : "daylight colors"}</span
        ></button
      ><label
        ><span
          >region numbers<small>tell the colors apart another way</small></span
        ><input
          type="checkbox"
          bind:checked={save.labels}
          onchange={persist}
        /></label
      ><label
        ><span
          >automatic crosses<small>mark squares ruled out by placed pets</small
          ></span
        ><input
          type="checkbox"
          bind:checked={save.autoCross}
          onchange={persist}
        /></label
      ><button onclick={exportSave}
        ><IconShare size={23} /><span>move saved progress</span></button
      >{#if pwa.installable}<button
          onclick={() => {
            void updater?.install();
            panel = pwa.installHint ? "install" : "";
          }}><IconDownload size={23} /><span>add to home screen</span></button
        >{/if}<button onclick={() => (panel = "about")}
        ><IconHelp size={23} /><span>about doku</span></button
      ><button onclick={() => void updater?.check()} disabled={pwa.checking}
        ><IconRefresh size={23} /><span
          >{pwa.checking ? "checking…" : "check for updates"}</span
        ></button
      >
    </div>
    <p class="status" aria-live="polite">{pwa.status}</p>
  {:else if panel === "reset"}
    <p>
      Your crossed squares and pets will be cleared. Your completed puzzles stay
      saved.
    </p>
    <div class="dialog-actions">
      <button onclick={() => (panel = "")}>keep playing</button><button
        class="primary"
        onclick={reset}>start again</button
      >
    </div>
  {:else if panel === "about"}
    <p>A calm logic puzzle. Make a little room for every cat or poodle.</p>
    <p>
      Inspired by region-placement puzzles such as Meowdoku. Original boards and
      pet art.
    </p>
    <p class="ethos">
      no ads, no lives, no timers, nothing to buy, no accounts, no cookies,
      nothing sold or shared.
    </p>
    <div class="maker">
      <IconHeart size={18} style="color:var(--mark-heart)" /><span
        >made with love by <a
          href="https://royashbrook.com"
          target="_blank"
          rel="noopener">roy</a
        >
        +
        <a href="https://royashbrook.com/agents" target="_blank" rel="noopener"
          >ai</a
        >
        ·
        <a
          href="https://github.com/sponsors/royashbrook"
          target="_blank"
          rel="noopener">sponsor me</a
        ></span
      >
    </div>
    <p class="build">
      v{__APP_VERSION__} · {__BUILD_ID__}<br />source {__SOURCE__.slice(0, 12)}
    </p>
    <a class="license-link" href="/licenses.md" target="_blank" rel="noopener"
      >code & art notices</a
    >
  {:else if panel === "transfer" || panel === "share"}
    <p>
      {panel === "share"
        ? "Send this link. It opens the same puzzle."
        : "Copy this code to your new phone or shortcut. Or paste a doku save code below to import it."}
    </p>
    <textarea
      aria-label="Save code or puzzle link"
      bind:value={transfer}
      maxlength="100000"
      spellcheck="false"></textarea>
    <p aria-live="polite">{message}</p>
    <div class="dialog-actions">
      <button onclick={copyCode}>copy</button>{#if panel === "transfer"}<button
          class="primary"
          onclick={previewImport}>import code</button
        >{/if}
    </div>
  {:else if panel === "import"}
    <p>
      This code contains {pendingImport?.completed.length} completed puzzles. Importing
      replaces progress and settings on this device.
    </p>
    <p aria-live="polite">{message}</p>
    <div class="dialog-actions">
      <button
        onclick={() => {
          pendingImport = null;
          panel = "transfer";
        }}>cancel</button
      ><button class="primary" onclick={importSave}>use this progress</button>
    </div>
  {:else if panel === "install"}
    <p>
      In Safari, open the Share menu. Choose <strong>Add to Home Screen</strong
      >, then <strong>Add</strong>.
    </p>
    <p>Your puzzles stay here, ready for offline play.</p>
  {/if}
</dialog>
