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
type Phase = "intro" | "study" | "patrol" | "finale" | "won" | "lost";
type Menu = "report" | "ward" | "store" | "inventory" | "settings" | null;
type Verdict = "hatch" | "garden" | "mimic" | "safe";

const VIEW = { width: 960, height: 640 };
const WORLD = { width: 1780, height: 1160 };
const SPAWN: Point = { x: 885, y: 940 };
const SPEED = 250;
const RADIUS = 18;
const TOTAL_WATCHES = 6;

const NFT_PROFILE = { tokenId: "334137", character: "Mask", scenery: "Garden", floor: "Hatch", generation: 6, seed: 334137 } as const;
const SUPPLIES = [
  { key: "ward", name: "Ward", cost: 0.1, description: "Points toward the disturbed zone." },
  { key: "chalk", name: "Chalk Seal", cost: 0.2, description: "Absorbs one corruption mark." },
  { key: "bell", name: "Bell", cost: 0.4, description: "Repels the Mimic during a breach." },
  { key: "fuse", name: "Emergency Fuse", cost: 0.5, description: "Restores a dead safe-zone lamp." },
  { key: "mirror", name: "Mirror Shard", cost: 0.7, description: "Confirms whether a visible Friend is the Mimic." },
] as const;
const STUDY_SECONDS = 12;
const WATCH_SECONDS = 55;
const BREACH_SECONDS = 11;
const BREACH_WATCHES = new Set([1, 3, 5]);

const CHECKPOINTS = [
  { id: "lamp", name: "Lamp & Bench", x: 500, y: 420 },
  { id: "hatch", name: "The Hatch", x: 890, y: 575 },
  { id: "pond", name: "Pond & Shrine", x: 1340, y: 735 },
] as const;

const trees: Point[] = [
  { x: 250, y: 240 }, { x: 610, y: 250 }, { x: 1050, y: 230 }, { x: 1510, y: 300 },
  { x: 300, y: 840 }, { x: 690, y: 1010 }, { x: 1470, y: 940 }, { x: 1150, y: 1030 },
];
const benches = [{ x: 560, y: 410, width: 120, height: 42 }, { x: 1410, y: 610, width: 110, height: 40 }];
const pond = { x: 1210, y: 680, width: 300, height: 185 };
const hatch = { x: 820, y: 525, width: 160, height: 96 };
const obstacles = [
  ...trees.map(t => ({ x: t.x - 42, y: t.y - 34, width: 84, height: 68 })),
  ...benches,
  { x: pond.x, y: pond.y, width: pond.width, height: pond.height },
  { x: hatch.x, y: hatch.y, width: hatch.width, height: hatch.height },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;

function seedFromFriend(friendId: unknown) {
  const s = String(friendId);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function watchSequence(seed: number): Verdict[] {
  let state = seed || 1;
  const next = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pool: Verdict[] = ["hatch", "garden", "mimic", "safe", "garden", "mimic"];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function nearCheckpoint(position: Point) {
  return CHECKPOINTS.findIndex(c => distance(position, c) <= 115);
}

function walkable(p: Point) {
  if (p.x < RADIUS || p.x > WORLD.width - RADIUS || p.y < 90 || p.y > WORLD.height - RADIUS) return false;
  return !obstacles.some(box => {
    const cx = clamp(p.x, box.x, box.x + box.width);
    const cy = clamp(p.y, box.y, box.y + box.height);
    return Math.hypot(p.x - cx, p.y - cy) < RADIUS;
  });
}

function advance(position: Point, dx: number, dy: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 0; i < steps; i++) {
    const n = { x: position.x + dx / steps, y: position.y + dy / steps };
    if (walkable(n)) Object.assign(position, n);
    else {
      if (walkable({ x: n.x, y: position.y })) position.x = n.x;
      if (walkable({ x: position.x, y: n.y })) position.y = n.y;
    }
  }
}

function drawTree(ctx: CanvasRenderingContext2D, p: Point, corruption: number) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = "#111511"; ctx.fillRect(-14, -72, 28, 85);
  ctx.fillStyle = corruption >= 2 ? "#0b0e0b" : "#242b23";
  ctx.fillRect(-56, -126, 112, 56); ctx.fillRect(-40, -150, 80, 38);
  ctx.fillStyle = "#374035"; ctx.fillRect(-47, -116, 94, 18);
  if (corruption >= 2) {
    ctx.strokeStyle = "#040504"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-14, -62); ctx.lineTo(-72, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -62); ctx.lineTo(72, -4); ctx.stroke();
  }
  ctx.restore();
}

function drawFriend(ctx: CanvasRenderingContext2D, sprites: GenerationSprites, p: Point, facing: SpriteFacing, walking: boolean, frame: number, side: "left" | "right") {
  const rows = spriteFrame(sprites, facing, walking, frame, side).frame.rows;
  const scale = 5, left = Math.round(p.x) - 40, top = Math.round(p.y) - 78;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#dfe6dc";
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") ctx.fillRect(left + x*scale - 2, top + y*scale - 2, scale + 4, scale + 4); }));
  ctx.fillStyle = "#030403";
  rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (pixel === "#") ctx.fillRect(left + x*scale, top + y*scale, scale, scale); }));
  ctx.restore();
}

function drawHunter(ctx: CanvasRenderingContext2D, p: Point, pulse: number) {
  ctx.save(); ctx.translate(p.x, p.y);
  const jitter = pulse % 9 === 0 ? 5 : 0;
  ctx.fillStyle = "#020302";
  ctx.fillRect(-14 + jitter, -72, 28, 70);
  ctx.beginPath(); ctx.arc(jitter, -86, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef4df";
  ctx.fillRect(-10 + jitter, -90, 5, 5); ctx.fillRect(7 + jitter, -90, 5, 5);
  ctx.fillStyle = "#020302";
  ctx.fillRect(-7 + jitter, -78, 14, 4);
  ctx.strokeStyle = "#d9e2d1"; ctx.lineWidth = 2;
  ctx.strokeRect(-23 + jitter, -112, 46, 54);
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, corruption: number, verdict: Verdict, inspected: Set<string>, watch: number, breach: boolean) {
  ctx.fillStyle = corruption >= 2 ? "#060806" : "#111611"; ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.fillStyle = "#1a211a"; ctx.fillRect(100,110,WORLD.width-200,WORLD.height-210);
  ctx.strokeStyle = "#3b4639"; ctx.lineWidth = 7; ctx.strokeRect(100,110,WORLD.width-200,WORLD.height-210);

  ctx.strokeStyle = corruption >= 2 ? "#2a2f29" : "#4b5349"; ctx.lineWidth = 78; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(885,1030); ctx.lineTo(885,575); ctx.lineTo(500,420);
  ctx.moveTo(885,575); ctx.lineTo(1340,735); ctx.stroke();

  // hedges / boundaries
  ctx.fillStyle = "#252d24";
  [[170,520,230,34],[210,650,280,34],[1040,430,250,32],[1260,930,250,32],[760,250,260,30]].forEach(([x,y,w,h])=>ctx.fillRect(x,y,w,h));

  ctx.fillStyle = "#050706"; ctx.fillRect(pond.x-8,pond.y-8,pond.width+16,pond.height+16);
  ctx.fillStyle = corruption>=2 ? "#040504" : "#0e1512"; ctx.fillRect(pond.x,pond.y,pond.width,pond.height);
  ctx.strokeStyle = "#4c584a"; ctx.lineWidth=4; ctx.strokeRect(pond.x,pond.y,pond.width,pond.height);
  if (verdict==="garden" && watch%2===1) {
    ctx.fillStyle="#dbe4d4"; ctx.fillRect(pond.x+120,pond.y+72,7,7); ctx.fillRect(pond.x+155,pond.y+95,6,6);
  }

  benches.forEach((b,i)=>{
    if (verdict==="garden" && watch%2===0 && i===0) return;
    ctx.fillStyle="#0b0f0b"; ctx.fillRect(b.x,b.y,b.width,b.height);
    ctx.strokeStyle="#687365"; ctx.lineWidth=3; ctx.strokeRect(b.x,b.y,b.width,b.height);
  });

  trees.forEach((t,i)=>drawTree(ctx, verdict==="garden" && watch%3===2 && i===3 ? {x:t.x-130,y:t.y+85}:t, corruption));

  // lamp + glow
  const glow=ctx.createRadialGradient(500,340,10,500,340,150);
  glow.addColorStop(0,"rgba(225,236,216,.18)"); glow.addColorStop(1,"rgba(225,236,216,0)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(500,340,150,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#080a08"; ctx.fillRect(494,315,12,110); ctx.fillRect(475,310,50,9);
  ctx.fillStyle= breach ? "#ffffff" : "#dfe8d7"; ctx.fillRect(486,286,28,26);

  ctx.fillStyle="#111511"; ctx.fillRect(1440,760,48,72); ctx.fillStyle="#4a5547"; ctx.fillRect(1430,748,68,12);

  ctx.fillStyle="#020302"; ctx.fillRect(hatch.x-6,hatch.y-6,hatch.width+12,hatch.height+12);
  ctx.fillStyle=verdict==="hatch"?"#010201":"#171d17"; ctx.fillRect(hatch.x,hatch.y,hatch.width,hatch.height);
  ctx.strokeStyle="#a7b1a2"; ctx.lineWidth=4; ctx.strokeRect(hatch.x,hatch.y,hatch.width,hatch.height);
  if (verdict==="hatch" || breach) {
    ctx.fillStyle="#030403"; ctx.fillRect(hatch.x+14,hatch.y+17,hatch.width-28,hatch.height-30);
    ctx.fillStyle="#f2f6e5"; ctx.fillRect(hatch.x+58,hatch.y+44,7,5); ctx.fillRect(hatch.x+95,hatch.y+44,7,5);
  }

  if (verdict==="mimic" && !breach) {
    ctx.fillStyle="#010201"; ctx.fillRect(1128,330,34,90); ctx.beginPath(); ctx.arc(1145,315,22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#edf5df"; ctx.fillRect(1137,311,4,4); ctx.fillRect(1152,311,4,4);
  }

  CHECKPOINTS.forEach(c=>{
    ctx.strokeStyle=inspected.has(c.id)?"#c0cbb9":"#596653"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(c.x,c.y,36,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=inspected.has(c.id)?"#d5dfce":"#7d8976"; ctx.font="bold 14px monospace"; ctx.textAlign="center";
    ctx.fillText(inspected.has(c.id)?"CHECKED":c.name.toUpperCase(),c.x,c.y+60);
  });
}

export default function TheHatch({ friendId, client, paused }: GameComponentProps) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const position=useRef<Point>({...SPAWN});
  const hunter=useRef<Point>({x:900,y:535});
  const camera=useRef<Point>({x:0,y:0});
  const keys=useRef(new Set<string>());
  const destination=useRef<Point|null>(null);
  const sound=useRef<FriendSoundKit|null>(null);
  const breachGuard=useRef(false);

  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [phase,setPhase]=useState<Phase>("intro");
  const [menu,setMenu]=useState<Menu>(null);
  const [watch,setWatch]=useState(0);
  const [seconds,setSeconds]=useState(STUDY_SECONDS);
  const [corruption,setCorruption]=useState(0);
  const [score,setScore]=useState(0);
  const [inspected,setInspected]=useState<Set<string>>(new Set());
  const [message,setMessage]=useState("Patrol the garden. Check all three marked locations.");
  const [near,setNear]=useState(-1);
  const [wardHint,setWardHint]=useState("");
  const [busy,setBusy]=useState(false);
  const [muted,setMuted]=useState(true);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [breach,setBreach]=useState(false);
  const [breachSeconds,setBreachSeconds]=useState(BREACH_SECONDS);
  const [breachTriggered,setBreachTriggered]=useState(false);
  const [scare,setScare]=useState(false);
  const [rfSpent,setRfSpent]=useState(0);
  const [watchXp,setWatchXp]=useState(0);
  const [inventory,setInventory]=useState<Record<string,number>>({ward:0,chalk:0,bell:0,fuse:0,mirror:0});

  const sequence=useMemo(()=>watchSequence(seedFromFriend(friendId)),[friendId]);
  const verdict=phase==="patrol"?sequence[watch]:"safe";

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    const pref=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPref=()=>setReducedMotion(pref.matches); onPref(); pref.addEventListener("change",onPref);
    void Promise.all([client.read(),createFriendReader().read(friendId)])
      .then(([snap,spr])=>{setSnapshot(snap);setSprites(spr);})
      .catch(()=>setMessage("Could not load your Friend."));
    return()=>{pref.removeEventListener("change",onPref);sound.current?.dispose();};
  },[client,friendId]);

  useEffect(()=>{
    if(!["study","patrol","finale"].includes(phase)||paused||menu||seconds<=0)return;
    const t=window.setTimeout(()=>setSeconds(v=>v-1),1000); return()=>clearTimeout(t);
  },[phase,paused,menu,seconds]);

  useEffect(()=>{
    if(phase==="study"&&seconds===0){
      setPhase("patrol");setSeconds(WATCH_SECONDS);setInspected(new Set());setMessage("WATCH 1 — Inspect all 3 checkpoints, then report.");sound.current?.play("select");
    } else if(phase==="patrol"&&seconds===0) failWatch("Time expired before you filed a report.");
  },[seconds,phase]);

  useEffect(()=>{
    if(!breach||paused||menu)return;
    if(breachSeconds<=0){handleCaught("You did not reach the lamp in time.");return;}
    const t=window.setTimeout(()=>setBreachSeconds(v=>v-1),1000);return()=>clearTimeout(t);
  },[breach,breachSeconds,paused,menu]);

  useEffect(()=>{
    if(!scare)return;const t=window.setTimeout(()=>setScare(false),650);return()=>clearTimeout(t);
  },[scare]);

  useEffect(()=>{
    if(phase!=="patrol"||breach||breachTriggered||!BREACH_WATCHES.has(watch)||inspected.size<2)return;
    startBreach();
  },[phase,watch,inspected,breach,breachTriggered]);

  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext("2d");
    if(!node||!ctx||!sprites)return;
    let raf=0,prev=0; let facing:SpriteFacing="up",side:"left"|"right"="right"; let pulse=0;
    const keydown=(e:KeyboardEvent)=>{
      const k=e.key.toLowerCase();
      if(k==="e"){const i=nearCheckpoint(position.current);if(i>=0)inspectCheckpoint(i);return;}
      if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);
    };
    const keyup=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);

    const frame=(now:number)=>{
      pulse++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;
      const p=position.current,before={...p};
      if(!paused&&menu===null&&["study","patrol","finale"].includes(phase)){
        const down=(a:string,b:string)=>keys.current.has(a)||keys.current.has(b);
        let dx=Number(down("d","arrowright"))-Number(down("a","arrowleft"));
        let dy=Number(down("s","arrowdown"))-Number(down("w","arrowup"));
        let travel=SPEED*dt*(breach?1.22:1);
        if(dx||dy)destination.current=null;
        else if(destination.current){
          dx=destination.current.x-p.x;dy=destination.current.y-p.y;const d=Math.hypot(dx,dy);travel=Math.min(travel,d);
          if(d<3){destination.current=null;dx=0;dy=0;}
        }
        if(dx||dy){
          const len=Math.hypot(dx,dy);advance(p,dx/len*travel,dy/len*travel);
          facing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
          if(facing==="left"||facing==="right")side=facing;
        }

        if(breach){
          const h=hunter.current;
          const vx=p.x-h.x,vy=p.y-h.y,d=Math.max(1,Math.hypot(vx,vy));
          const hs=(150+watch*16)*dt;
          h.x+=vx/d*hs;h.y+=vy/d*hs;
          if(phase==="finale"&&distance(p,CHECKPOINTS[1])<92&&!breachGuard.current){
            breachGuard.current=true;setBreach(false);setPhase("won");setWatchXp(v=>v+150);setMessage("FINAL SEAL COMPLETE — the Hatch closes at sunrise.");sound.current?.play("reward");
          }else if(phase!=="finale"&&distance(p,CHECKPOINTS[0])<84&&!breachGuard.current){
            breachGuard.current=true;setBreach(false);setMessage("SAFE LIGHT — The thing recoils into the dark.");sound.current?.play("reward");
            window.setTimeout(()=>{breachGuard.current=false;},500);
          }else if(distance(p,h)<36&&!breachGuard.current){
            breachGuard.current=true;handleCaught("It caught you before you reached the lamp.");
            window.setTimeout(()=>{breachGuard.current=false;},500);
          }
        }
      }

      camera.current={x:Math.round(clamp(p.x-VIEW.width/2,0,WORLD.width-VIEW.width)),y:Math.round(clamp(p.y-VIEW.height/2,0,WORLD.height-VIEW.height))};
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.translate(-camera.current.x,-camera.current.y);ctx.imageSmoothingEnabled=false;
      drawWorld(ctx,corruption,verdict,inspected,watch,breach);
      if(breach)drawHunter(ctx,hunter.current,pulse);
      drawFriend(ctx,sprites,p,facing,distance(before,p)>.1,reducedMotion?0:Math.floor(now/110)%8,side);
      ctx.restore();
      const n=nearCheckpoint(p);setNear(prevNear=>prevNear===n?prevNear:n);
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);};
  },[sprites,phase,menu,paused,corruption,verdict,inspected,watch,reducedMotion,breach]);

  function startNight(){
    position.current={...SPAWN};hunter.current={x:900,y:535};
    setPhase("study");setWatch(0);setSeconds(STUDY_SECONDS);setCorruption(0);setScore(0);setInspected(new Set());
    setMessage("MEMORIZE — Mask creates the Mimic. Garden creates the map. Hatch is the objective.");setWardHint("");setBreach(false);setBreachTriggered(false);setRfSpent(0);setWatchXp(0);setInventory({ward:0,chalk:0,bell:0,fuse:0,mirror:0});
  }

  function startBreach(){
    hunter.current={x:900,y:535};setBreach(true);setBreachSeconds(BREACH_SECONDS);setBreachTriggered(true);setScare(true);
    setMessage("BREACH! RUN TO THE LAMP. Do not let it touch you.");sound.current?.play("impact");
  }

  function handleCaught(reason:string){
    setBreach(false);setScare(true);position.current={...SPAWN};destination.current=null;
    const next=corruption+1;setCorruption(next);setMessage(reason);sound.current?.play("impact");
    if(next>=3){setPhase("finale");setSeconds(30);setBreach(true);setBreachSeconds(30);hunter.current={x:900,y:535};setMessage("FINAL CONTAINMENT — reach the Hatch. Hold position and seal it before the Mimic reaches you.");}
  }

  function inspectCheckpoint(index:number){
    if(phase!=="patrol"||breach)return;
    const cp=CHECKPOINTS[index];setInspected(prev=>new Set([...prev,cp.id]));
    let text=`${cp.name}: looks normal.`;
    if(verdict==="hatch"&&cp.id==="hatch")text="THE HATCH: the seam is open. Two eyes are below the lid.";
    if(verdict==="garden"&&(cp.id==="lamp"||cp.id==="pond"))text=`${cp.name}: something here does not match your memory.`;
    if(verdict==="mimic"&&cp.id==="pond")text="POND & SHRINE: a figure is standing beyond the trees.";
    setMessage(text);sound.current?.play(verdict==="mimic"?"impact":"select");
    if(verdict==="mimic"&&cp.id==="pond")setScare(true);
  }

  function failWatch(reason:string){
    const next=corruption+1;setCorruption(next);setMessage(reason);setBreach(false);sound.current?.play("impact");
    if(next>=3){setPhase("finale");setSeconds(30);setBreach(true);setBreachSeconds(30);hunter.current={x:900,y:535};setMessage("FINAL CONTAINMENT — reach the Hatch. Hold position and seal it before the Mimic reaches you.");return;}advanceWatch();
  }

  function advanceWatch(){
    if(watch+1>=TOTAL_WATCHES){setPhase("won");setMessage("06:00 — Garden Unit 06 remains sealed.");setWatchXp(v=>v+100);sound.current?.play("reward");return;}
    const n=watch+1;setWatch(n);setSeconds(Math.max(36,WATCH_SECONDS-n*3));setInspected(new Set());setWardHint("");setBreach(false);setBreachTriggered(false);setWatchXp(v=>v+15);
    setMessage(`WATCH ${n+1} — Patrol all three checkpoints.`);
  }

  function report(choice:Verdict){
    if(phase!=="patrol"||breach)return;
    if(inspected.size<3){setMessage("Finish the patrol first: inspect all three checkpoints.");setMenu(null);return;}
    if(choice===verdict){
      setScore(s=>s+1);setWatchXp(v=>v+20);setMessage("Correct report. The garden settles.");sound.current?.play("reward");setMenu(null);window.setTimeout(advanceWatch,700);
    }else{setMenu(null);failWatch(`Wrong report. The disturbance was: ${verdict.toUpperCase()}.`);}
  }

  async function buyWard(){
    if(!snapshot||busy)return;setBusy(true);
    try{await client.buy(1n);setSnapshot(await client.read());setMessage("Ward Charge purchased (simulated RF).");sound.current?.play("purchase");}
    catch(e){setMessage(e instanceof Error?e.message:"Ward purchase failed.");}finally{setBusy(false);}
  }
  async function useWard(){
    if(!snapshot||snapshot.consumables<1n||busy||phase!=="patrol")return;setBusy(true);
    try{
      const play=(await client.play(1n))[0];await client.settle(play.id);setSnapshot(await client.read());
      const hint=verdict==="safe"?"WARD: no disturbance detected.":verdict==="hatch"?"WARD: strongest signal at THE HATCH.":verdict==="mimic"?"WARD: there are TWO Friends in the Garden.":"WARD: distortion in the GARDEN.";
      setWardHint(hint);setMessage(hint);sound.current?.play("reveal-common");
    }finally{setBusy(false);}
  }

  const checked=inspected.size,canReport=phase==="patrol"&&checked===3&&!breach;
  return <section className={`hatch-game corruption-${corruption} ${breach?"breach":""}`}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="hatch-canvas"
      onPointerDown={e=>{
        if(!["study","patrol","finale"].includes(phase)||paused||menu)return;
        const rect=e.currentTarget.getBoundingClientRect();
        destination.current={x:camera.current.x+(e.clientX-rect.left)*VIEW.width/rect.width,y:camera.current.y+(e.clientY-rect.top)*VIEW.height/rect.height};
      }}/>

    <div className="top-hud">
      <div className="hud-panel"><strong>RARE FRIENDS // THE HATCH</strong><span>Friend {String(friendId)} · Watch {Math.min(watch+1,TOTAL_WATCHES)}/{TOTAL_WATCHES}</span>
        <div className="corruption"><i className={corruption>0?"on":""}/><i className={corruption>1?"on":""}/><i className={corruption>2?"on":""}/></div></div>
      <div className="hud-panel right"><strong>{breach?`RUN ${breachSeconds}`:phase==="won"?"06:00":`00:${String(seconds).padStart(2,"0")}`}</strong><span>{checked}/3 checkpoints · {score} correct</span></div>
    </div>

    {["study","patrol","finale"].includes(phase)&&<div className="mission-panel">
      <strong>{phase==="finale"?"FINAL CONTAINMENT — REACH THE HATCH":breach?"BREACH — REACH THE LAMP":phase==="study"?"MEMORIZE THE GARDEN":"PATROL OBJECTIVE"}</strong>
      {CHECKPOINTS.map(c=><span key={c.id} className={inspected.has(c.id)?"done":""}>{inspected.has(c.id)?"✓":"□"} {c.name}</span>)}
      <small>{phase==="finale"?"The Mimic is loose. Touch the Hatch before it reaches you.":breach?"The light is safe. The thing is not.":phase==="patrol"?"Inspect all 3, then file one report.":"Learn the route before midnight."}</small>
    </div>}

    {near>=0&&phase==="patrol"&&!breach&&<button className="inspect-btn" onClick={()=>inspectCheckpoint(near)}>INSPECT · {CHECKPOINTS[near].name} <small>E</small></button>}

    {phase==="patrol"&&<div className="action-stack">
      <button disabled={breach} onClick={()=>setMenu("inventory")}>INVENTORY</button>
      <button disabled={breach} onClick={()=>setMenu("store")}>RF SUPPLIES</button>
      <button disabled={breach} onClick={()=>setMenu("ward")}>WARD · {snapshot?.consumables.toString()??"0"}</button>
      <button className="report-btn" disabled={!canReport} onClick={()=>setMenu("report")}>{breach?"RUN!":canReport?"FILE REPORT":`PATROL ${checked}/3`}</button>
    </div>}

    <div className="status-bar">{wardHint||message}</div>
    {scare&&<div className="scare-flash"><div className="scare-face"><i/><i/><b/></div></div>}

    {phase==="intro"&&<div className="overlay"><div className="story-card">
      <span>FRIEND #334137 // TRAIT-BOUND NIGHT</span><h1>THE HATCH</h1>
      <p><b>Mask</b> creates the Mimic. <b>Garden</b> creates the world. <b>Hatch</b> creates the containment objective. Seed <b>334137</b> determines the event order.</p>
      <p>This is a survival-horror prototype for all three Vibeathon goals: Character Spotlight, Token Activity, and Economy Potential.</p>
      <div className="rules-box"><b>HOW TO PLAY</b>
        <p>1. Patrol Lamp & Bench, The Hatch, and Pond & Shrine.</p>
        <p>2. Press INSPECT when you reach each marker.</p>
        <p>3. On later watches, the hatch may BREACH. Run to the lamp before the thing catches you.</p>
        <p>4. After the patrol, report HATCH, GARDEN, MIMIC, or ALL CLEAR.</p>
        <p>Three corruption marks trigger final containment.</p><p>RF supplies are simulated: each purchase models 50% burn / 50% Active Friend rewards.</p></div>
      <button onClick={startNight}>START NIGHT WATCH</button><button onClick={()=>setMenu("settings")}>SETTINGS</button>
    </div></div>}

    {(phase==="won"||phase==="lost")&&<div className="overlay end"><div className="story-card">
      <span>{phase==="won"?"SHIFT COMPLETE":"CONTAINMENT FAILURE"}</span><h1>{phase==="won"?"SUNRISE":"IT GOT OUT"}</h1><p>{message}</p>
      <p>{score} of {TOTAL_WATCHES} reports correct · Watch XP {watchXp}.</p><div className="ledger"><b>SESSION ECONOMY</b><span>RF spent {rfSpent.toFixed(2)}</span><span>Simulated burn {(rfSpent*0.5).toFixed(2)}</span><span>Active Friend rewards {(rfSpent*0.5).toFixed(2)}</span></div><button onClick={startNight}>PLAY ANOTHER SHIFT</button>
    </div></div>}

    {menu==="report"&&<GameMenu title="FILE REPORT" onClose={()=>setMenu(null)}><p>What did your patrol confirm?</p><div className="report-grid">
      <button onClick={()=>report("hatch")}><b>HATCH</b><small>The hatch opened or changed.</small></button>
      <button onClick={()=>report("garden")}><b>GARDEN</b><small>An object, tree, bench or pond changed.</small></button>
      <button onClick={()=>report("mimic")}><b>MIMIC</b><small>A false version of your Friend appeared.</small></button>
      <button onClick={()=>report("safe")}><b>ALL CLEAR</b><small>Nothing changed.</small></button>
    </div></GameMenu>}

    {menu==="store"&&<GameMenu title="RF SUPPLY CABINET" onClose={()=>setMenu(null)}><p>Prototype economy: preparation and protection consume RF; skill earns Watch XP.</p><div className="store-grid">{SUPPLIES.map(item=><button key={item.key} onClick={()=>{setInventory(v=>({...v,[item.key]:(v[item.key]??0)+1}));setRfSpent(v=>v+item.cost);setMessage(item.name+" prepared (simulated RF).");}}><b>{item.name}</b><small>{item.cost.toFixed(2)} RF · {item.description}</small></button>)}</div><p>Spent {rfSpent.toFixed(2)} RF · burn {(rfSpent*0.5).toFixed(2)} · rewards {(rfSpent*0.5).toFixed(2)}</p></GameMenu>}

    {menu==="inventory"&&<GameMenu title="INVENTORY" onClose={()=>setMenu(null)}><div className="store-grid">{SUPPLIES.map(item=><button key={item.key} disabled={!inventory[item.key]} onClick={()=>{if(!inventory[item.key])return;setInventory(v=>({...v,[item.key]:Math.max(0,(v[item.key]??0)-1)}));if(item.key==="bell"&&breach){setBreach(false);setMessage("The Bell drives the Mimic back into the dark.");}else if(item.key==="fuse"){setMessage("The Emergency Fuse stabilizes the lamp circuit.");}else if(item.key==="mirror"){setMessage("Mirror Shard: your reflection is true; the other Friend is not.");}else if(item.key==="chalk"){setMessage("Chalk Seal prepared around the Hatch.");}else{setMessage("Ward: listen for the strongest disturbance.");}}}><b>{item.name} × {inventory[item.key]??0}</b><small>{item.description}</small></button>)}</div></GameMenu>}

    {menu==="ward"&&<GameMenu title="WARD CABINET" onClose={()=>setMenu(null)}>
      <p>Ward Charges cost {snapshot?rf(client.definition.price):"0.1 RF"} simulated RF and point toward the suspicious zone.</p>
      <p>Balance: {snapshot?rf(snapshot.rfBalance):"—"} · Charges: {snapshot?.consumables.toString()??"0"}</p>
      <button disabled={busy||!snapshot||snapshot.rfBalance<client.definition.price} onClick={()=>void buyWard()}>BUY WARD</button>
      <button disabled={busy||!snapshot||snapshot.consumables<1n||phase!=="patrol"} onClick={()=>void useWard()}>USE WARD</button><p>{wardHint||"A Ward gives one directional clue."}</p>
    </GameMenu>}

    {menu==="settings"&&<GameMenu title="SETTINGS" onClose={()=>setMenu(null)}>
      <button onClick={()=>{const n=!muted;setMuted(n);sound.current?.setMuted(n);}}>{muted?"SOUND: OFF":"SOUND: ON"}</button>
      <label><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)}/> Reduce motion</label>
      <p>Wallet ownership and the canonical Rare Friend sprite are supplied by FriendSDK.</p>
    </GameMenu>}
  </section>;
}
