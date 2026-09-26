"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameWorld } from "@rarefriends/friendsdk/world-view";
import { getWorldPreset, validateWorld } from "@rarefriends/friendsdk/world";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type AnomalyKind = "safe" | "movement" | "missing" | "duplicate" | "distortion" | "hatch" | "presence";
type Phase = "intro" | "study" | "watch" | "won" | "lost";
type Menu = "report" | "ward" | "settings" | null;

const base = getWorldPreset("01-garden-oval-complete");
const spawn = [288, 192] as const;
const ROUND_SECONDS = 22;
const STUDY_SECONDS = 8;
const TOTAL_ROUNDS = 8;

const anomalyNames: Record<AnomalyKind, string> = {
  safe: "NO ANOMALY",
  movement: "MOVED OBJECT",
  missing: "MISSING OBJECT",
  duplicate: "DUPLICATE",
  distortion: "DISTORTION",
  hatch: "HATCH",
  presence: "PRESENCE",
};

const descriptions: Record<AnomalyKind, string> = {
  safe: "The garden is behaving normally.",
  movement: "Something in the garden is no longer where it belongs.",
  missing: "A familiar object has vanished.",
  duplicate: "The garden has made a copy of something.",
  distortion: "Something has changed size or shape.",
  hatch: "The hatch is not as you left it.",
  presence: "You are not alone in the garden.",
};

function seedFromFriend(friendId: unknown) {
  const s = String(friendId);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeSequence(seed: number): AnomalyKind[] {
  let state = seed || 1;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pool: AnomalyKind[] = ["movement", "missing", "duplicate", "distortion", "hatch", "presence", "safe", "presence"];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function anomalousWorld(kind: AnomalyKind) {
  const props = base.props.map((p) => ({ ...p }));
  if (kind === "movement" && props[0]) {
    props[0] = { ...props[0], x: props[0].x + 72, y: props[0].y - 18 };
  } else if (kind === "missing" && props.length > 2) {
    props.splice(1, 1);
  } else if (kind === "duplicate" && props[1]) {
    props.push({ ...props[1], x: props[1].x + 86, y: props[1].y + 34 });
  } else if (kind === "distortion" && props[2]) {
    props[2] = { ...props[2], scale: (props[2].scale ?? 1) * 1.85 };
  }
  return validateWorld({ ...base, props, actors: [] });
}

const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

export default function TheHatch({ friendId, client, paused }: GameComponentProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [corruption, setCorruption] = useState(0);
  const [score, setScore] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [message, setMessage] = useState("The garden is quiet.");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [wardSignal, setWardSignal] = useState("");
  const [shock, setShock] = useState(false);
  const sound = useRef<FriendSoundKit | null>(null);
  const lock = useRef(false);

  const sequence = useMemo(() => makeSequence(seedFromFriend(friendId)), [friendId]);
  const anomaly = phase === "watch" ? sequence[round] : "safe";
  const world = useMemo(() => anomalousWorld(anomaly), [anomaly]);

  useEffect(() => {
    sound.current = createFriendSoundKit({ muted: true });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMedia = () => setReducedMotion(media.matches);
    onMedia();
    media.addEventListener("change", onMedia);
    void client.read().then(setSnapshot).catch(() => setMessage("Could not load the simulated preview economy."));
    return () => {
      media.removeEventListener("change", onMedia);
      sound.current?.dispose();
      sound.current = null;
    };
  }, [client, friendId]);

  useEffect(() => {
    if (!["study", "watch"].includes(phase) || paused || menu || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, paused, menu, seconds]);

  useEffect(() => {
    if (phase === "study" && seconds === 0) {
      setPhase("watch");
      setSeconds(ROUND_SECONDS);
      setMessage("WATCH 1/8 — Something may have changed.");
      setToast("MIDNIGHT");
      sound.current?.play("select");
      return;
    }
    if (phase === "watch" && seconds === 0) resolveReport("timeout");
  }, [seconds, phase]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 1500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!shock) return;
    const t = window.setTimeout(() => setShock(false), 850);
    return () => window.clearTimeout(t);
  }, [shock]);

  async function refresh() {
    setSnapshot(await client.read());
  }

  async function runAction(work: () => Promise<void>) {
    if (lock.current || paused) return;
    lock.current = true;
    setBusy(true);
    void sound.current?.unlock();
    try {
      await work();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The preview action failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function beginNight() {
    setPhase("study");
    setRound(0);
    setSeconds(STUDY_SECONDS);
    setCorruption(0);
    setScore(0);
    setWardSignal("");
    setShock(false);
    setMessage("MEMORIZE THE GARDEN — Learn what normal looks like.");
    void sound.current?.unlock();
    sound.current?.play("select");
  }

  function nextRound(nextCorruption: number, nextScore: number) {
    if (nextCorruption >= 3) {
      setPhase("lost");
      setMenu(null);
      setMessage("The hatch learned your name.");
      setShock(true);
      sound.current?.play("impact");
      return;
    }
    if (round + 1 >= TOTAL_ROUNDS) {
      setPhase("won");
      setMenu(null);
      setMessage("06:00 — The knocking stops. You kept the garden sealed.");
      sound.current?.play("reward");
      return;
    }
    const next = round + 1;
    setRound(next);
    setSeconds(Math.max(12, ROUND_SECONDS - Math.floor(next / 2)));
    setWardSignal("");
    setMenu(null);
    setMessage(`WATCH ${next + 1}/8 — Remember the garden. Trust what you saw.`);
  }

  function resolveReport(choice: AnomalyKind | "timeout") {
    if (phase !== "watch") return;
    const correct = choice === anomaly;
    const nextCorruption = correct ? corruption : corruption + 1;
    const nextScore = correct ? score + 1 : score;
    setCorruption(nextCorruption);
    setScore(nextScore);
    if (correct) {
      setToast("CORRECT");
      setMessage(`Confirmed: ${anomalyNames[anomaly]}. The hatch settles.`);
      sound.current?.play("reward");
    } else {
      setToast(choice === "timeout" ? "TOO LATE" : "WRONG");
      setMessage(choice === "timeout" ? "You waited too long. Something moved below you." : `Wrong report. It was: ${anomalyNames[anomaly]}.`);
      setShock(true);
      sound.current?.play("impact");
    }
    window.setTimeout(() => nextRound(nextCorruption, nextScore), 1300);
  }

  async function buyWard() {
    await runAction(async () => {
      await client.buy(1n);
      setMessage("A simulated Ward Charge was added to your Friend.");
      sound.current?.play("purchase");
    });
  }

  async function useWard() {
    if (!snapshot || snapshot.consumables < 1n) {
      setMessage("No Ward Charges. Buy one first.");
      setMenu("ward");
      return;
    }
    await runAction(async () => {
      const play = (await client.play(1n))[0];
      await client.settle(play.id);
      setWardSignal(anomaly === "safe" ? "WARD SIGNAL: QUIET — no anomaly is present." : "WARD SIGNAL: DISTURBANCE — an anomaly is present.");
      setMessage("The ward burns cold in your hand.");
      sound.current?.play("reveal-common");
    });
  }

  if (!snapshot) {
    return <section className="hatch-game"><div className="hatch-intro"><div className="hatch-intro-panel"><h1>THE HATCH</h1><p>{message}</p></div></div></section>;
  }

  const canAct = phase === "watch" && !busy && !paused;
  const corruptionClass = corruption >= 3 ? "corrupt-3" : corruption >= 2 ? "corrupt-2" : corruption >= 1 ? "corrupt-1" : "";
  const stateLabel = corruption >= 2 ? "CONTAINMENT UNSTABLE" : corruption === 1 ? "DISTURBANCE DETECTED" : "CALM WATCH";
  return <section className={`hatch-game ${corruptionClass} ${shock ? "shock" : ""} ${reducedMotion ? "reduced" : ""}`} aria-label="Rare Friends: The Hatch">
    <div className="hatch-world" inert={Boolean(menu) || paused || !["study","watch"].includes(phase) || undefined}>
      <GameWorld
        world={world}
        spawn={spawn}
        interactions={[]}
        friendId={friendId}
        paused={Boolean(menu) || paused || !["study","watch"].includes(phase)}
        reducedMotion={reducedMotion}
      />
      <div className="moon" aria-hidden="true" />
      <div className="lamp-glow" aria-hidden="true" />
      <div className="fog fog-a" aria-hidden="true" />
      <div className="fog fog-b" aria-hidden="true" />
      <div className={`central-hatch ${anomaly === "hatch" || corruption >= 1 ? "ajar" : ""} ${corruption >= 2 ? "open" : ""}`} aria-hidden="true">
        <span className="hatch-eye left" /><span className="hatch-eye right" />
      </div>
      {anomaly === "presence" && <div className="presence-figure" aria-label="A figure is watching the garden"><span /><span /></div>}
      {corruption >= 1 && <div className="static-layer" aria-hidden="true" />}
      {corruption >= 2 && <div className="corrupt-duplicate" aria-hidden="true"><i /><i /><b /></div>}
      {corruption >= 2 && <div className="tendril t1" aria-hidden="true" />}
      {corruption >= 2 && <div className="tendril t2" aria-hidden="true" />}
    </div>

    <div className="hatch-hud">
      <div className="hatch-card hatch-card-left">
        <div className="hatch-title">RARE FRIENDS // NIGHT WATCH</div>
        <div className="hatch-sub">Friend {String(friendId)} · seed-bound shift</div>
        <div className="hatch-state">{stateLabel}</div>
        <div className="hatch-meter" aria-label={`Corruption ${corruption} of 3`}>
          {[0,1,2].map((i) => <i key={i} className={`hatch-mark ${i < corruption ? "on" : ""}`} />)}
        </div>
      </div>
      <div className="hatch-card hatch-card-right">
        <div className="hatch-clock">{phase === "study" ? `00:${String(seconds).padStart(2,"0")}` : phase === "watch" ? `00:${String(seconds).padStart(2,"0")}` : phase === "won" ? "06:00" : "00:00"}</div>
        <div className="hatch-sub">{phase === "study" ? "MEMORIZE" : phase === "watch" ? `WATCH ${round + 1}/${TOTAL_ROUNDS} · ${score} correct` : `${score}/${TOTAL_ROUNDS} reports correct`}</div>
      </div>
    </div>

    {phase === "watch" && <div className="hatch-actions">
      <button className="hatch-btn" disabled={!canAct} onClick={() => setMenu("ward")}>WARD · {snapshot.consumables.toString()}</button>
      <button className="hatch-btn danger" disabled={!canAct} onClick={() => setMenu("report")}>REPORT</button>
    </div>}

    <div className="hatch-status" role="status">{wardSignal || message}</div>
    <div className="hatch-help">WASD / arrows · tap to walk · inspect the whole garden</div>
    {toast && <div className="hatch-toast">{toast}</div>}

    {phase === "intro" && <div className="hatch-intro">
      <div className="hatch-intro-panel">
        <div className="hatch-sub">RARE FRIENDS ARCHIVE // SHIFT 334137</div>
        <h1>THE HATCH</h1>
        <p>Your Friend has been assigned to a quiet garden until sunrise. Study it. Walk it. Remember where everything belongs.</p>
        <div className="hatch-rule">ONE RULE: if the garden changes, report what changed. If nothing changed, report NO ANOMALY. Three mistakes open the hatch.</div>
        <p>Every selected Rare Friend receives a different anomaly order seeded from its token identity. Ward Charges cost simulated RF and can tell you whether a disturbance exists.</p>
        <button className="hatch-btn" onClick={beginNight}>BEGIN NIGHT WATCH</button>
        <button className="hatch-btn" onClick={() => setMenu("settings")}>SETTINGS</button>
      </div>
    </div>}

    {(phase === "won" || phase === "lost") && <div className="hatch-intro">
      <div className="hatch-intro-panel">
        <div className="hatch-sub">{phase === "won" ? "SHIFT COMPLETE" : "CONTAINMENT FAILURE"}</div>
        <h1>{phase === "won" ? "SUNRISE" : "IT GOT OUT"}</h1>
        <p>{message}</p>
        <p>You identified <strong>{score}</strong> of {TOTAL_ROUNDS} watches correctly.</p>
        <button className="hatch-btn" onClick={beginNight}>PLAY ANOTHER SHIFT</button>
      </div>
    </div>}

    {menu === "report" && <GameMenu title="REPORT ANOMALY" onClose={() => setMenu(null)}>
      <p>Choose exactly what changed. A false report counts as corruption.</p>
      <div className="report-grid">
        {(["movement","missing","duplicate","distortion","hatch","presence","safe"] as AnomalyKind[]).map((kind) =>
          <button key={kind} className="hatch-btn" disabled={busy || paused} onClick={() => { setMenu(null); resolveReport(kind); }}>
            {anomalyNames[kind]}
          </button>
        )}
      </div>
    </GameMenu>}

    {menu === "ward" && <GameMenu title="WARD CABINET" onClose={() => setMenu(null)}>
      <p>A Ward Charge costs <strong>{rf(client.definition.price)}</strong>. It never pays a reward. It only tells you whether the current watch contains an anomaly.</p>
      <p>Simulated balance: <strong>{rf(snapshot.rfBalance)}</strong> · Charges: <strong>{snapshot.consumables.toString()}</strong></p>
      <button className="hatch-btn" disabled={busy || paused || snapshot.rfBalance < client.definition.price} onClick={() => void buyWard()}>BUY WARD · {rf(client.definition.price)}</button>
      <button className="hatch-btn" disabled={busy || paused || snapshot.consumables < 1n || phase !== "watch"} onClick={() => void useWard()}>BURN ONE WARD</button>
      <p>{wardSignal || "The economy is simulated for the Vibeathon preview. No real RF transaction is sent."}</p>
    </GameMenu>}

    {menu === "settings" && <GameMenu title="SETTINGS" onClose={() => setMenu(null)}>
      <button className="hatch-btn" aria-pressed={!muted} onClick={() => {
        const next = !muted;
        setMuted(next);
        sound.current?.setMuted(next);
        if (!next) void sound.current?.unlock();
      }}>{muted ? "SOUND: OFF" : "SOUND: ON"}</button>
      <label><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /> Reduce motion</label>
      <p>Wallet connection, ownership verification and the canonical Friend sprite are provided by FriendSDK v0.1.2.</p>
    </GameMenu>}
  </section>;
}
