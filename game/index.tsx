"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Point = { x: number; y: number };
type Phase = "intro" | "study" | "patrol" | "won" | "lost";
type Menu = "report" | "ward" | "settings" | null;
type Verdict = "hatch" | "garden" | "presence" | "safe";

const VIEW = { width: 1200, height: 675 };
const WORLD = { width: 1800, height: 1100 };
const SPAWN: Point = { x: 900, y: 870 };
const SPEED = 260;
const RADIUS = 18;
const TOTAL_WATCHES = 6;
const STUDY_SECONDS = 12;
const WATCH_SECONDS = 55;

const CHECKPOINTS = [
  { id: "lamp", name: "Lamp & Bench", x: 510, y: 390, hint: "Check the light, bench and nearby hedge." },
  { id: "hatch", name: "The Hatch", x: 900, y: 550, hint: "Check the lid, seams and anything below it." },
  { id: "pond", name: "Pond & Shrine", x: 1320, y: 700, hint: "Check the water, shrine and far tree line." },
] as const;

const trees: Point[] = [
  { x: 280, y: 245 }, { x: 720, y: 220 }, { x: 1120, y: 245 }, { x: 1510, y: 320 },
  { x: 350, y: 810 }, { x: 1500, y: 860 }, { x: 1180, y: 920 },
];

const benches = [
  { x: 590, y: 390, width: 120, height: 42 },
  { x: 1430, y: 590, width: 110, height: 40 },
];

const pond = { x: 1210, y: 650, width: 300, height: 180 };
const hatch = { x: 860, y: 500, width: 150, height: 92 };
const obstacles = [
  ...trees.map(t => ({ x: t.x - 42, y: t.y - 34, width: 84, height: 68 })),
  ...benches.map(b => ({ ...b })),
  { x: pond.x, y: pond.y, width: pond.width, height: pond.height },
  { x: hatch.x, y: hatch.y, width: hatch.width, height: hatch.height },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

function seedFromFriend(friendId: unknown) {
  const s = String(friendId);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function watchSequence(seed: number): Verdict[] {
  let state = seed || 1;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pool: Verdict[] = ["hatch", "garden", "presence", "safe", "garden", "presence"];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function nearCheckpoint(position: Point) {
  return CHECKPOINTS.findIndex(c => distance(position, c) <= 110);
}

function walkable(p: Point) {
  if (p.x < RADIUS || p.x > WORLD.width - RADIUS || p.y < 80 || p.y > WORLD.height - RADIUS) return false;
  return !obstacles.some(box => {
    const cx = clamp(p.x, box.x, box.x + box.width);
    const cy = clamp(p.y, box.y, box.y + box.height);
    return Math.hypot(p.x - cx, p.y - cy) < RADIUS;
  });
}

function advance(position: Point, dx: number, dy: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 0; i < steps; i++) {
    const nx = { x: position.x + dx / steps, y: position.y + dy / steps };
    if (walkable(nx)) Object.assign(position, nx);
    else {
      if (walkable({ x: nx.x, y: position.y })) position.x = nx.x;
      if (walkable({ x: position.x, y: nx.y })) position.y = nx.y;
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, p: Point, corruption: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#171d18";
  ctx.fillRect(-14, -70, 28, 82);
  ctx.fillStyle = corruption >= 2 ? "#111611" : "#222a22";
  ctx.fillRect(-54, -122, 108, 52);
  ctx.fillRect(-40, -145, 80, 35);
  ctx.fillStyle = "#323b31";
  ctx.fillRect(-46, -112, 92, 18);
  if (corruption >= 2) {
    ctx.strokeStyle = "#070907";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-18, -60); ctx.lineTo(-64, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -60); ctx.lineTo(70, -6); ctx.stroke();
  }
  ctx.restore();
}

function drawFriend(ctx: CanvasRenderingContext2D, sprites: GenerationSprites, position: Point, facing: SpriteFacing, walking: boolean, frame: number, side: "left" | "right") {
  const rows = spriteFrame(sprites, facing, walking, frame, side).frame.rows;
  const scale = 5, left = Math.round(position.x) - 40, top = Math.round(position.y) - 78;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#dfe6dc";
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") ctx.fillRect(left + x * scale - 2, top + y * scale - 2, scale + 4, scale + 4); }));
  ctx.fillStyle = "#050705";
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") ctx.fillRect(left + x * scale, top + y * scale, scale, scale); }));
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, corruption: number, verdict: Verdict, inspected: Set<string>, watch: number) {
  ctx.fillStyle = corruption >= 2 ? "#080b08" : "#121712";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "#1a211a";
  ctx.fillRect(110, 120, WORLD.width - 220, WORLD.height - 220);

  ctx.strokeStyle = "#3d473b";
  ctx.lineWidth = 6;
  ctx.strokeRect(110, 120, WORLD.width - 220, WORLD.height - 220);

  // paths
  ctx.strokeStyle = corruption >= 2 ? "#2e332d" : "#4a5148";
  ctx.lineWidth = 72;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(900, 950); ctx.lineTo(900, 550); ctx.lineTo(520, 390);
  ctx.moveTo(900, 550); ctx.lineTo(1320, 700);
  ctx.stroke();

  // pond
  ctx.fillStyle = "#050807";
  ctx.fillRect(pond.x - 8, pond.y - 8, pond.width + 16, pond.height + 16);
  ctx.fillStyle = corruption >= 2 ? "#060706" : "#101714";
  ctx.fillRect(pond.x, pond.y, pond.width, pond.height);
  ctx.strokeStyle = "#4d584b";
  ctx.lineWidth = 4;
  ctx.strokeRect(pond.x, pond.y, pond.width, pond.height);
  if (verdict === "garden" && watch % 2 === 1) {
    ctx.fillStyle = "#d8e1d2";
    ctx.fillRect(pond.x + 112, pond.y + 70, 8, 8);
    ctx.fillRect(pond.x + 145, pond.y + 90, 6, 6);
  }

  benches.forEach((b, i) => {
    if (verdict === "garden" && watch % 2 === 0 && i === 0) return;
    ctx.fillStyle = "#0c100c";
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.strokeStyle = "#697264";
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.width, b.height);
  });

  trees.forEach((t, i) => {
    const moved = verdict === "garden" && watch % 3 === 2 && i === 3;
    drawTree(ctx, moved ? { x: t.x - 120, y: t.y + 80 } : t, corruption);
  });

  // lamp
  ctx.fillStyle = "#090b09";
  ctx.fillRect(470, 300, 12, 105);
  ctx.fillRect(450, 298, 52, 9);
  ctx.fillStyle = "#dfe9d6";
  ctx.fillRect(461, 278, 30, 26);

  // shrine
  ctx.fillStyle = "#111611";
  ctx.fillRect(1420, 720, 48, 70);
  ctx.fillStyle = "#475044";
  ctx.fillRect(1410, 710, 68, 12);

  // hatch
  ctx.fillStyle = "#030403";
  ctx.fillRect(hatch.x - 5, hatch.y - 5, hatch.width + 10, hatch.height + 10);
  ctx.fillStyle = verdict === "hatch" ? "#020302" : "#171d17";
  ctx.fillRect(hatch.x, hatch.y, hatch.width, hatch.height);
  ctx.strokeStyle = "#a7b0a2";
  ctx.lineWidth = 4;
  ctx.strokeRect(hatch.x, hatch.y, hatch.width, hatch.height);
  if (verdict === "hatch") {
    ctx.fillStyle = "#060706";
    ctx.fillRect(hatch.x + 14, hatch.y + 16, hatch.width - 28, hatch.height - 28);
    ctx.fillStyle = "#eef6de";
    ctx.fillRect(hatch.x + 54, hatch.y + 42, 7, 5);
    ctx.fillRect(hatch.x + 88, hatch.y + 42, 7, 5);
  }

  // presence
  if (verdict === "presence") {
    ctx.fillStyle = "#010201";
    ctx.fillRect(1135, 315, 34, 90);
    ctx.beginPath(); ctx.arc(1152, 302, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eaf3df";
    ctx.fillRect(1142, 298, 4, 4); ctx.fillRect(1158, 298, 4, 4);
  }

  // checkpoint rings
  CHECKPOINTS.forEach(c => {
    ctx.strokeStyle = inspected.has(c.id) ? "#b9c5b3" : "#556151";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = inspected.has(c.id) ? "#cfd8c9" : "#75806f";
    ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.fillText(inspected.has(c.id) ? "CHECKED" : c.name.toUpperCase(), c.x, c.y + 58);
  });

  if (corruption >= 1) {
    ctx.fillStyle = "rgba(255,255,255,.03)";
    for (let i = 0; i < 140; i++) ctx.fillRect((i * 97) % WORLD.width, (i * 61) % WORLD.height, 2, 2);
  }
}

export default function TheHatch({ friendId, client, paused }: GameComponentProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const position = useRef<Point>({ ...SPAWN });
  const camera = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const destination = useRef<Point | null>(null);
  const sound = useRef<FriendSoundKit | null>(null);

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [menu, setMenu] = useState<Menu>(null);
  const [watch, setWatch] = useState(0);
  const [seconds, setSeconds] = useState(STUDY_SECONDS);
  const [corruption, setCorruption] = useState(0);
  const [score, setScore] = useState(0);
  const [inspected, setInspected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("Patrol the garden. Check all three marked locations.");
  const [near, setNear] = useState(-1);
  const [wardHint, setWardHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sequence = useMemo(() => watchSequence(seedFromFriend(friendId)), [friendId]);
  const verdict = phase === "patrol" ? sequence[watch] : "safe";

  useEffect(() => {
    sound.current = createFriendSoundKit({ muted: true });
    const pref = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPref = () => setReducedMotion(pref.matches);
    onPref(); pref.addEventListener("change", onPref);
    void Promise.all([client.read(), createFriendReader().read(friendId)])
      .then(([snap, spr]) => { setSnapshot(snap); setSprites(spr); })
      .catch(() => setMessage("Could not load your Friend."));
    return () => { pref.removeEventListener("change", onPref); sound.current?.dispose(); };
  }, [client, friendId]);

  useEffect(() => {
    if (!["study","patrol"].includes(phase) || paused || menu || seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, paused, menu, seconds]);

  useEffect(() => {
    if (phase === "study" && seconds === 0) {
      setPhase("patrol");
      setSeconds(WATCH_SECONDS);
      setInspected(new Set());
      setMessage("WATCH 1 — Inspect all 3 checkpoints, then report.");
      sound.current?.play("select");
    } else if (phase === "patrol" && seconds === 0) {
      failWatch("Time expired before you filed a report.");
    }
  }, [seconds, phase]);

  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext("2d");
    if (!node || !ctx || !sprites) return;
    let raf = 0, prev = 0;
    let facing: SpriteFacing = "up", side: "left" | "right" = "right";
    const keydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") {
        const i = nearCheckpoint(position.current);
        if (i >= 0) inspectCheckpoint(i);
        return;
      }
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) keys.current.add(e.key.toLowerCase());
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);

    const frame = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, .05) : 0; prev = now;
      const p = position.current, before = { ...p };
      if (!paused && menu === null && ["study","patrol"].includes(phase)) {
        const down = (a:string,b:string) => keys.current.has(a)||keys.current.has(b);
        let dx = Number(down("d","arrowright")) - Number(down("a","arrowleft"));
        let dy = Number(down("s","arrowdown")) - Number(down("w","arrowup"));
        let travel = SPEED * dt;
        if (dx || dy) destination.current = null;
        else if (destination.current) {
          dx = destination.current.x - p.x; dy = destination.current.y - p.y;
          const d = Math.hypot(dx,dy); travel = Math.min(travel,d);
          if (d < 3) { destination.current = null; dx = 0; dy = 0; }
        }
        if (dx || dy) {
          const len = Math.hypot(dx,dy); advance(p, dx/len*travel, dy/len*travel);
          facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left":"right") : (dy < 0 ? "up":"down");
          if (facing === "left" || facing === "right") side = facing;
        }
      }
      camera.current = {
        x: Math.round(clamp(p.x - VIEW.width/2, 0, WORLD.width - VIEW.width)),
        y: Math.round(clamp(p.y - VIEW.height/2, 0, WORLD.height - VIEW.height)),
      };

      ctx.clearRect(0,0,VIEW.width,VIEW.height);
      ctx.save();
      ctx.translate(-camera.current.x,-camera.current.y);
      ctx.imageSmoothingEnabled = false;
      drawWorld(ctx, corruption, verdict, inspected, watch);
      drawFriend(ctx, sprites, p, facing, distance(before,p) > .1, reducedMotion ? 0 : Math.floor(now/110)%8, side);
      ctx.restore();

      const n = nearCheckpoint(p);
      setNear(prevNear => prevNear === n ? prevNear : n);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [sprites, phase, menu, paused, corruption, verdict, inspected, watch, reducedMotion]);

  function startNight() {
    position.current = { ...SPAWN };
    setPhase("study"); setWatch(0); setSeconds(STUDY_SECONDS); setCorruption(0); setScore(0); setInspected(new Set());
    setMessage("MEMORIZE — Walk the map and learn the three checkpoints."); setWardHint("");
  }

  function inspectCheckpoint(index: number) {
    if (phase !== "patrol") return;
    const cp = CHECKPOINTS[index];
    setInspected(prev => new Set([...prev, cp.id]));
    let text = `${cp.name}: looks normal.`;
    if (verdict === "hatch" && cp.id === "hatch") text = "The Hatch: the seam is open. Something is looking back.";
    if (verdict === "garden" && (cp.id === "lamp" || cp.id === "pond")) text = `${cp.name}: something here does not match your memory.`;
    if (verdict === "presence" && cp.id === "pond") text = "Pond & Shrine: a figure is standing beyond the trees.";
    setMessage(text);
    sound.current?.play("select");
  }

  function failWatch(reason: string) {
    const next = corruption + 1;
    setCorruption(next);
    setMessage(reason);
    sound.current?.play("impact");
    if (next >= 3) {
      setPhase("lost");
      return;
    }
    advanceWatch();
  }

  function advanceWatch() {
    if (watch + 1 >= TOTAL_WATCHES) {
      setPhase("won"); setMessage("06:00 — You kept the garden sealed."); sound.current?.play("reward"); return;
    }
    const n = watch + 1;
    setWatch(n); setSeconds(Math.max(36, WATCH_SECONDS - n * 3)); setInspected(new Set()); setWardHint("");
    setMessage(`WATCH ${n + 1} — Patrol all three checkpoints.`);
  }

  function report(choice: Verdict) {
    if (phase !== "patrol") return;
    if (inspected.size < 3) {
      setMessage("Finish the patrol first: inspect all three checkpoints.");
      setMenu(null);
      return;
    }
    if (choice === verdict) {
      setScore(s => s + 1);
      setMessage("Correct report. The garden settles.");
      sound.current?.play("reward");
      setMenu(null);
      window.setTimeout(advanceWatch, 700);
    } else {
      setMenu(null);
      failWatch(`Wrong report. The disturbance was: ${verdict.toUpperCase()}.`);
    }
  }

  async function buyWard() {
    if (!snapshot || busy) return;
    setBusy(true);
    try { await client.buy(1n); setSnapshot(await client.read()); setMessage("Ward Charge purchased (simulated RF)."); sound.current?.play("purchase"); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Ward purchase failed."); }
    finally { setBusy(false); }
  }

  async function useWard() {
    if (!snapshot || snapshot.consumables < 1n || busy || phase !== "patrol") return;
    setBusy(true);
    try {
      const play = (await client.play(1n))[0]; await client.settle(play.id); setSnapshot(await client.read());
      const hint = verdict === "safe" ? "WARD: no disturbance detected." :
        verdict === "hatch" ? "WARD: strongest signal at THE HATCH." :
        verdict === "presence" ? "WARD: movement beyond the POND." :
        "WARD: distortion in the GARDEN.";
      setWardHint(hint); setMessage(hint); sound.current?.play("reveal-common");
    } finally { setBusy(false); }
  }

  const checked = inspected.size;
  const canReport = phase === "patrol" && checked === 3;
  const progress = CHECKPOINTS.map(c => inspected.has(c.id));

  return <section className={`hatch-game corruption-${corruption}`}>
    <canvas
      ref={canvas}
      width={VIEW.width}
      height={VIEW.height}
      className="hatch-canvas"
      onPointerDown={e => {
        if (!["study","patrol"].includes(phase) || paused || menu) return;
        const rect = e.currentTarget.getBoundingClientRect();
        destination.current = {
          x: camera.current.x + (e.clientX - rect.left) * VIEW.width / rect.width,
          y: camera.current.y + (e.clientY - rect.top) * VIEW.height / rect.height,
        };
      }}
    />

    <div className="top-hud">
      <div className="hud-panel">
        <strong>RARE FRIENDS // THE HATCH</strong>
        <span>Friend {String(friendId)} · Watch {Math.min(watch + 1,TOTAL_WATCHES)}/{TOTAL_WATCHES}</span>
        <div className="corruption"><i className={corruption>0?"on":""}/><i className={corruption>1?"on":""}/><i className={corruption>2?"on":""}/></div>
      </div>
      <div className="hud-panel right">
        <strong>{phase === "won" ? "06:00" : `00:${String(seconds).padStart(2,"0")}`}</strong>
        <span>{checked}/3 checkpoints · {score} correct</span>
      </div>
    </div>

    {["study","patrol"].includes(phase) && <div className="mission-panel">
      <strong>{phase === "study" ? "MEMORIZE THE GARDEN" : "PATROL OBJECTIVE"}</strong>
      {CHECKPOINTS.map((c,i)=><span key={c.id} className={progress[i]?"done":""}>{progress[i]?"✓":"□"} {c.name}</span>)}
      {phase === "patrol" && <small>Inspect all 3, then file one report.</small>}
    </div>}

    {near >= 0 && phase === "patrol" && <button className="inspect-btn" onClick={()=>inspectCheckpoint(near)}>INSPECT · {CHECKPOINTS[near].name} <small>E</small></button>}

    {phase === "patrol" && <div className="action-stack">
      <button onClick={()=>setMenu("ward")}>WARD · {snapshot?.consumables.toString() ?? "0"}</button>
      <button className="report-btn" disabled={!canReport} onClick={()=>setMenu("report")}>{canReport ? "FILE REPORT" : `PATROL ${checked}/3`}</button>
    </div>}

    <div className="status-bar">{wardHint || message}</div>

    {phase === "intro" && <div className="overlay"><div className="story-card">
      <span>RARE FRIENDS ARCHIVE // SHIFT 334137</span>
      <h1>THE HATCH</h1>
      <p>This garden has three checkpoints. Every watch, patrol all three. Inspect what changed. Then file one report.</p>
      <div className="rules-box">
        <b>HOW TO PLAY</b>
        <p>1. Walk to Lamp & Bench, The Hatch, and Pond & Shrine.</p>
        <p>2. Press INSPECT at each location.</p>
        <p>3. After all 3 are checked, report HATCH, GARDEN, PRESENCE, or ALL CLEAR.</p>
        <p>Three wrong reports end the shift.</p>
      </div>
      <button onClick={startNight}>START NIGHT WATCH</button>
      <button onClick={()=>setMenu("settings")}>SETTINGS</button>
    </div></div>}

    {(phase === "won" || phase === "lost") && <div className="overlay end"><div className="story-card">
      <span>{phase === "won" ? "SHIFT COMPLETE" : "CONTAINMENT FAILURE"}</span>
      <h1>{phase === "won" ? "SUNRISE" : "IT GOT OUT"}</h1>
      <p>{message}</p>
      <p>{score} of {TOTAL_WATCHES} reports correct.</p>
      <button onClick={startNight}>PLAY ANOTHER SHIFT</button>
    </div></div>}

    {menu === "report" && <GameMenu title="FILE REPORT" onClose={()=>setMenu(null)}>
      <p>You completed the patrol. What is wrong?</p>
      <div className="report-grid">
        <button onClick={()=>report("hatch")}><b>HATCH</b><small>The hatch opened or changed.</small></button>
        <button onClick={()=>report("garden")}><b>GARDEN</b><small>An object, tree, bench or pond changed.</small></button>
        <button onClick={()=>report("presence")}><b>PRESENCE</b><small>A figure appeared in the garden.</small></button>
        <button onClick={()=>report("safe")}><b>ALL CLEAR</b><small>Nothing changed.</small></button>
      </div>
    </GameMenu>}

    {menu === "ward" && <GameMenu title="WARD CABINET" onClose={()=>setMenu(null)}>
      <p>Ward Charges are optional hints. They cost {snapshot ? rf(client.definition.price) : "0.1 RF"} simulated RF.</p>
      <p>Balance: {snapshot ? rf(snapshot.rfBalance) : "—"} · Charges: {snapshot?.consumables.toString() ?? "0"}</p>
      <button disabled={busy || !snapshot || snapshot.rfBalance < client.definition.price} onClick={()=>void buyWard()}>BUY WARD</button>
      <button disabled={busy || !snapshot || snapshot.consumables < 1n || phase !== "patrol"} onClick={()=>void useWard()}>USE WARD</button>
      <p>{wardHint || "A Ward points you toward the suspicious area."}</p>
    </GameMenu>}

    {menu === "settings" && <GameMenu title="SETTINGS" onClose={()=>setMenu(null)}>
      <button onClick={()=>{ const n=!muted; setMuted(n); sound.current?.setMuted(n); }}>{muted?"SOUND: OFF":"SOUND: ON"}</button>
      <label><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/> Reduce motion</label>
      <p>Wallet ownership and the canonical Rare Friend sprite are supplied by FriendSDK.</p>
    </GameMenu>}
  </section>;
}
