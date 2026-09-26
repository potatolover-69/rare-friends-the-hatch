"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Point = { x:number; y:number };
type Phase = "intro"|"prep"|"night"|"finale"|"won"|"lost";
type Threat = "garden"|"hatch"|"mimic"|"power"|"clear";
type Menu = "store"|"report"|"inventory"|"settings"|null;

const VIEW={width:960,height:640};
const WORLD={width:2100,height:1380};
const START={x:1050,y:1190};
const SPEED=235;
const TOTAL_ROUNDS=6;
const ROUND_SECONDS=65;
const PROFILE={token:"334137",character:"Mask",scenery:"Garden",floor:"Hatch",generation:6,seed:334137};

const ZONES=[
  {id:"lamp",name:"Lamp Court",x:520,y:460},
  {id:"hatch",name:"Central Hatch",x:1050,y:650},
  {id:"pond",name:"Moon Pond",x:1570,y:760},
  {id:"grove",name:"Mask Grove",x:1310,y:320},
] as const;

const ITEMS=[
  {key:"ward",name:"Ward",cost:0.1,desc:"Reveals the disturbed zone."},
  {key:"chalk",name:"Chalk Seal",cost:0.2,desc:"Absorbs one corruption mark."},
  {key:"bell",name:"Bell",cost:0.4,desc:"Repels the Mimic during a chase."},
  {key:"fuse",name:"Fuse",cost:0.5,desc:"Restores the lamp during a blackout."},
  {key:"mirror",name:"Mirror Shard",cost:0.7,desc:"Confirms whether a second Friend is false."},
] as const;

const trees:Point[]=[
  {x:240,y:250},{x:510,y:220},{x:820,y:250},{x:1370,y:210},{x:1710,y:280},{x:1870,y:540},
  {x:260,y:880},{x:480,y:1080},{x:790,y:980},{x:1440,y:1100},{x:1790,y:1030},{x:1180,y:350},
];
const hedges=[{x:180,y:600,w:360,h:36},{x:660,y:410,w:280,h:34},{x:1180,y:520,w:250,h:34},{x:1510,y:980,w:320,h:34},{x:760,y:1120,w:360,h:34}];
const pond={x:1460,y:690,w:300,h:185};
const hatch={x:970,y:590,w:160,h:100};
const shed={x:300,y:980,w:170,h:120};

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

function seedSequence(friendId:unknown){
  let h=2166136261;
  for(const c of String(friendId)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  h^=PROFILE.seed;
  const pool:Threat[]=["garden","hatch","mimic","power","clear","mimic"];
  const rnd=()=>((h=(Math.imul(h,1664525)+1013904223)>>>0)/4294967296);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool;
}

function drawFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,p:Point,facing:SpriteFacing,walking:boolean,frame:number,side:"left"|"right"){
  const rows=spriteFrame(sprites,facing,walking,frame,side).frame.rows;
  const scale=5,left=Math.round(p.x)-40,top=Math.round(p.y)-80;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#dfe6dc";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale-2,top+y*scale-2,scale+4,scale+4)}));
  ctx.fillStyle="#030403";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  ctx.restore();
}

function drawMimic(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,p:Point,t:number){
  const rows=spriteFrame(sprites,"down",false,0,"right").frame.rows;
  const scale=5,j=(t%11===0?7:0),left=Math.round(p.x)-40+j,top=Math.round(p.y)-80;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=.88;
  ctx.fillStyle="#e6ece1";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  ctx.fillStyle="#060806";ctx.fillRect(left+15,top+12,18,12);ctx.fillRect(left+48,top+24,12,18);
  ctx.strokeStyle="#f0f5ea";ctx.lineWidth=2;ctx.strokeRect(left-4,top-5,88,88);
  ctx.restore();
}

function drawTree(ctx:CanvasRenderingContext2D,p:Point,corruption:number){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle="#111511";ctx.fillRect(-13,-70,26,84);
  ctx.fillStyle=corruption>=2?"#090c09":"#222a21";ctx.fillRect(-52,-124,104,54);ctx.fillRect(-38,-148,76,34);
  if(corruption>=2){ctx.strokeStyle="#030403";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-12,-60);ctx.lineTo(-70,6);ctx.stroke();ctx.beginPath();ctx.moveTo(12,-60);ctx.lineTo(68,-7);ctx.stroke();}
  ctx.restore();
}

function drawWorld(ctx:CanvasRenderingContext2D,threat:Threat,round:number,corruption:number,visited:Set<string>,power:boolean){
  ctx.fillStyle=corruption>=2?"#050705":"#0e130f";ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.fillStyle="#182018";ctx.fillRect(90,100,WORLD.width-180,WORLD.height-190);
  ctx.strokeStyle="#3a4538";ctx.lineWidth=8;ctx.strokeRect(90,100,WORLD.width-180,WORLD.height-190);

  ctx.strokeStyle=corruption>=2?"#252b24":"#464f44";ctx.lineWidth=82;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(1050,1280);ctx.lineTo(1050,650);ctx.lineTo(520,460);
  ctx.moveTo(1050,650);ctx.lineTo(1570,760);ctx.moveTo(1050,650);ctx.lineTo(1310,320);ctx.stroke();

  ctx.fillStyle="#242d23";for(const h of hedges)ctx.fillRect(h.x,h.y,h.w,h.h);
  for(let i=0;i<trees.length;i++){let p=trees[i];if(threat==="garden"&&round%2===0&&i===4)p={x:p.x-150,y:p.y+90};drawTree(ctx,p,corruption);}

  ctx.fillStyle="#050706";ctx.fillRect(pond.x-8,pond.y-8,pond.w+16,pond.h+16);
  ctx.fillStyle=threat==="garden"&&round%2===1?"#020302":"#0c1411";ctx.fillRect(pond.x,pond.y,pond.w,pond.h);
  ctx.strokeStyle="#4a5648";ctx.lineWidth=4;ctx.strokeRect(pond.x,pond.y,pond.w,pond.h);

  ctx.fillStyle="#0b0f0b";ctx.fillRect(shed.x,shed.y,shed.w,shed.h);ctx.strokeStyle="#596557";ctx.strokeRect(shed.x,shed.y,shed.w,shed.h);
  ctx.fillStyle="#cfd8c8";ctx.font="bold 13px monospace";ctx.fillText("FUSE SHED",shed.x+42,shed.y+66);

  if(power){
    const g=ctx.createRadialGradient(520,380,10,520,380,190);g.addColorStop(0,"rgba(225,235,217,.22)");g.addColorStop(1,"rgba(225,235,217,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(520,380,190,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle="#080a08";ctx.fillRect(514,350,12,115);ctx.fillRect(494,345,52,9);
  ctx.fillStyle=power?"#e2ebda":"#242824";ctx.fillRect(506,320,28,26);

  ctx.fillStyle="#020302";ctx.fillRect(hatch.x-7,hatch.y-7,hatch.w+14,hatch.h+14);
  ctx.fillStyle=threat==="hatch"?"#010201":"#171d17";ctx.fillRect(hatch.x,hatch.y,hatch.w,hatch.h);
  ctx.strokeStyle="#a6b09f";ctx.lineWidth=4;ctx.strokeRect(hatch.x,hatch.y,hatch.w,hatch.h);
  if(threat==="hatch"){ctx.fillStyle="#020302";ctx.fillRect(hatch.x+16,hatch.y+18,hatch.w-32,hatch.h-32);ctx.fillStyle="#eef5e4";ctx.fillRect(hatch.x+58,hatch.y+45,7,5);ctx.fillRect(hatch.x+97,hatch.y+45,7,5);}

  if(threat==="mimic"){
    ctx.fillStyle="#010201";ctx.fillRect(1288,300,34,92);ctx.beginPath();ctx.arc(1305,285,22,0,Math.PI*2);ctx.fill();ctx.fillStyle="#edf5df";ctx.fillRect(1297,281,4,4);ctx.fillRect(1312,281,4,4);
  }

  for(const z of ZONES){ctx.strokeStyle=visited.has(z.id)?"#d0dac9":"#596653";ctx.lineWidth=3;ctx.beginPath();ctx.arc(z.x,z.y,38,0,Math.PI*2);ctx.stroke();ctx.fillStyle=visited.has(z.id)?"#dce5d5":"#7a8773";ctx.font="bold 14px monospace";ctx.textAlign="center";ctx.fillText(visited.has(z.id)?"CHECKED":z.name.toUpperCase(),z.x,z.y+62);}
}

function walkable(p:Point){
  if(p.x<30||p.y<100||p.x>WORLD.width-30||p.y>WORLD.height-30)return false;
  for(const t of trees)if(dist(p,t)<55)return false;
  if(p.x>pond.x-25&&p.x<pond.x+pond.w+25&&p.y>pond.y-25&&p.y<pond.y+pond.h+25)return false;
  if(p.x>hatch.x-25&&p.x<hatch.x+hatch.w+25&&p.y>hatch.y-25&&p.y<hatch.y+hatch.h+25)return false;
  return true;
}

function move(p:Point,dx:number,dy:number){
  const n={x:p.x+dx,y:p.y+dy};if(walkable(n)){p.x=n.x;p.y=n.y;return;}
  if(walkable({x:n.x,y:p.y}))p.x=n.x;if(walkable({x:p.x,y:n.y}))p.y=n.y;
}

export default function TheHatch({friendId,client,paused}:GameComponentProps){
  const canvas=useRef<HTMLCanvasElement>(null);
  const pos=useRef<Point>({...START});
  const cam=useRef<Point>({x:0,y:0});
  const mimic=useRef<Point>({x:1310,y:320});
  const path=useRef<Point[]>([]);
  const keys=useRef(new Set<string>());
  const target=useRef<Point|null>(null);
  const sound=useRef<FriendSoundKit|null>(null);

  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [phase,setPhase]=useState<Phase>("intro");
  const [menu,setMenu]=useState<Menu>(null);
  const [round,setRound]=useState(0);
  const [seconds,setSeconds]=useState(ROUND_SECONDS);
  const [corruption,setCorruption]=useState(0);
  const [visited,setVisited]=useState<Set<string>>(new Set());
  const [message,setMessage]=useState("Your Friend's traits define this night.");
  const [near,setNear]=useState(-1);
  const [chase,setChase]=useState(false);
  const [power,setPower]=useState(true);
  const [freeze,setFreeze]=useState(0);
  const [rfSpent,setRfSpent]=useState(0);
  const [xp,setXp]=useState(0);
  const [inventory,setInventory]=useState<Record<string,number>>({ward:0,chalk:0,bell:0,fuse:0,mirror:0});
  const [muted,setMuted]=useState(true);
  const [scare,setScare]=useState(false);
  const [busy,setBusy]=useState(false);

  const seq=useMemo(()=>seedSequence(friendId),[friendId]);
  const threat=phase==="night"||phase==="finale"?seq[Math.min(round,seq.length-1)]:"clear";

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    void Promise.all([client.read(),createFriendReader().read(friendId)]).then(([s,sp])=>{setSnapshot(s);setSprites(sp);}).catch(()=>setMessage("Could not load your Friend."));
    return()=>sound.current?.dispose();
  },[client,friendId]);

  useEffect(()=>{
    if(phase!=="night"||paused||menu||seconds<=0)return;
    const t=setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(t);
  },[phase,paused,menu,seconds]);

  useEffect(()=>{if(phase==="night"&&seconds===0)fail("You ran out of time.");},[phase,seconds]);
  useEffect(()=>{if(!scare)return;const t=setTimeout(()=>setScare(false),650);return()=>clearTimeout(t)},[scare]);

  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext("2d");if(!node||!ctx||!sprites)return;
    let raf=0,prev=0,tick=0;let facing:SpriteFacing="up",side:"left"|"right"="right";
    const kd=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);if(k==="e")inspect();};
    const ku=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);

    const frame=(now:number)=>{
      tick++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;const p=pos.current,before={...p};
      if(!paused&&!menu&&["prep","night","finale"].includes(phase)){
        let dx=0,dy=0;
        if(keys.current.has("a")||keys.current.has("arrowleft"))dx--;
        if(keys.current.has("d")||keys.current.has("arrowright"))dx++;
        if(keys.current.has("w")||keys.current.has("arrowup"))dy--;
        if(keys.current.has("s")||keys.current.has("arrowdown"))dy++;
        if(dx||dy)target.current=null;
        else if(target.current){dx=target.current.x-p.x;dy=target.current.y-p.y;if(Math.hypot(dx,dy)<5){target.current=null;dx=0;dy=0;}}
        if(dx||dy){const l=Math.hypot(dx,dy);move(p,dx/l*SPEED*dt,dy/l*SPEED*dt);facing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");if(facing==="left"||facing==="right")side=facing;path.current.push({...p});if(path.current.length>180)path.current.shift();}
        if(threat==="mimic"&&path.current.length>45){
          const dest=path.current[Math.max(0,path.current.length-45)],m=mimic.current,vx=dest.x-m.x,vy=dest.y-m.y,d=Math.max(1,Math.hypot(vx,vy));m.x+=vx/d*(chase?200:92)*dt;m.y+=vy/d*(chase?200:92)*dt;
          if(chase&&dist(p,m)<42)fail("The Mimic caught you.");
        }
        if(chase&&dist(p,ZONES[0])<85){setChase(false);setPower(true);setMessage("The lamp burns white. The Mimic retreats.");sound.current?.play("reward");}
        if(phase==="finale"&&dist(p,ZONES[1])<95){setPhase("won");setChase(false);setXp(v=>v+150);setMessage("The final seal closes. Sunrise.");sound.current?.play("reward");}
        if(threat==="mimic"&&!chase&&round>=2&&visited.size>=2){setChase(true);setScare(true);setMessage("MASK BREACH — RUN TO THE LAMP.");sound.current?.play("impact");}
      }

      cam.current={x:Math.round(clamp(p.x-VIEW.width/2,0,WORLD.width-VIEW.width)),y:Math.round(clamp(p.y-VIEW.height/2,0,WORLD.height-VIEW.height))};
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.translate(-cam.current.x,-cam.current.y);drawWorld(ctx,threat,round,corruption,visited,power);
      if(threat==="mimic"&&(phase==="night"||phase==="finale"))drawMimic(ctx,sprites,mimic.current,tick);
      drawFriend(ctx,sprites,p,facing,dist(before,p)>.1,Math.floor(now/110)%8,side);ctx.restore();

      let nearest=-1,bd=9999;ZONES.forEach((z,i)=>{const d=dist(p,z);if(d<115&&d<bd){nearest=i;bd=d}});setNear(n=>n===nearest?n:nearest);
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku)};
  },[sprites,phase,menu,paused,threat,round,corruption,visited,chase,power]);

  function start(){
    pos.current={...START};mimic.current={x:1310,y:320};path.current=[];setPhase("prep");setRound(0);setSeconds(ROUND_SECONDS);setCorruption(0);setVisited(new Set());setMessage("PREP — learn the Garden before midnight.");setChase(false);setPower(true);setRfSpent(0);setXp(0);setInventory({ward:0,chalk:0,bell:0,fuse:0,mirror:0});
    setTimeout(()=>{setPhase("night");setMessage("WATCH 1 — inspect every zone, survive the threat, then report.");},900);
  }

  function inspect(){
    if(phase!=="night"||near<0||chase)return;
    const z=ZONES[near];setVisited(v=>new Set([...v,z.id]));
    let text=`${z.name}: normal.`;
    if(threat==="hatch"&&z.id==="hatch")text="The Hatch opens inward. Two eyes are below.";
    if(threat==="garden"&&(z.id==="pond"||z.id==="grove"))text=`${z.name}: the geometry is wrong.`;
    if(threat==="mimic"&&z.id==="grove"){text="A second Mask Friend is copying you.";setScare(true);}
    if(threat==="power"&&z.id==="lamp"){text="The lamp circuit is dead. The fuse shed was tampered with.";setPower(false);}
    if(threat==="clear")text=`${z.name}: exactly as remembered.`;
    setMessage(text);sound.current?.play("select");
  }

  function fail(reason:string){
    if(phase==="lost"||phase==="won")return;
    let next=corruption+1;
    if((inventory.chalk||0)>0){setInventory(v=>({...v,chalk:v.chalk-1}));next=corruption;setMessage(reason+" Chalk Seal absorbed the corruption.");}
    else setMessage(reason);
    setCorruption(next);setScare(true);setChase(false);sound.current?.play("impact");
    if(next>=3){setPhase("finale");setChase(true);setMessage("FINAL CONTAINMENT — reach the Central Hatch before the Mimic.");}
    else nextRound();
  }

  function nextRound(){
    if(round+1>=TOTAL_ROUNDS){setPhase("won");setMessage("06:00 — Garden Unit 06 remains sealed.");setXp(v=>v+100);return;}
    setRound(r=>r+1);setSeconds(Math.max(40,ROUND_SECONDS-(round+1)*4));setVisited(new Set());setChase(false);setPower(true);setXp(v=>v+20);setMessage(`WATCH ${round+2} — the Garden remembers.`);
  }

  function report(choice:Threat){
    if(visited.size<ZONES.length){setMessage("Inspect all four zones first.");setMenu(null);return;}
    if(choice===threat){setXp(v=>v+25);setMessage("Correct report. Containment stabilizes.");setMenu(null);sound.current?.play("reward");setTimeout(nextRound,600);}
    else{setMenu(null);fail(`Wrong report. The disturbance was ${threat.toUpperCase()}.`);}
  }

  async function buy(item:(typeof ITEMS)[number]){
    if(!snapshot||busy)return;setBusy(true);
    try{
      const units=Math.max(1,Math.round(item.cost/.1));
      await client.buy(BigInt(units));const plays=await client.play(BigInt(units));for(const p of plays)await client.settle(p.id);
      setSnapshot(await client.read());setInventory(v=>({...v,[item.key]:(v[item.key]||0)+1}));setRfSpent(v=>v+item.cost);setMessage(item.name+" prepared.");sound.current?.play("purchase");
    }catch(e){setMessage(e instanceof Error?e.message:"RF action failed.");}finally{setBusy(false);}
  }

  function use(key:string){
    if(!(inventory[key]>0))return;
    setInventory(v=>({...v,[key]:v[key]-1}));
    if(key==="ward")setMessage(threat==="clear"?"WARD: no disturbance.":threat==="mimic"?"WARD: two Friends detected.":threat==="hatch"?"WARD: pressure below the Hatch.":threat==="power"?"WARD: lamp circuit compromised.":"WARD: Garden geometry unstable.");
    if(key==="bell"&&chase){setChase(false);setMessage("The Bell rings. The Mimic recoils.");}
    if(key==="fuse"&&!power){setPower(true);setMessage("The emergency fuse restores the lamp.");}
    if(key==="mirror")setMessage(threat==="mimic"?"The second Friend has no true reflection.":"Your reflection is alone.");
    if(key==="chalk")setMessage("Chalk Seal armed for the next mistake.");
    sound.current?.play("reveal-common");
  }

  const burn=(rfSpent/2).toFixed(2),reward=(rfSpent/2).toFixed(2);
  return <section className={`hatch-game c${corruption} ${chase?"chase":""}`}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="hatch-canvas" onPointerDown={e=>{
      if(!["prep","night","finale"].includes(phase)||paused||menu)return;
      const r=e.currentTarget.getBoundingClientRect();target.current={x:cam.current.x+(e.clientX-r.left)*VIEW.width/r.width,y:cam.current.y+(e.clientY-r.top)*VIEW.height/r.height};
    }}/>
    <div className="hud top-left"><b>RARE FRIENDS // THE HATCH</b><span>MASK · GARDEN · HATCH · GEN 6</span><span>Friend #{PROFILE.token}</span><div className="marks"><i className={corruption>0?"on":""}/><i className={corruption>1?"on":""}/><i className={corruption>2?"on":""}/></div></div>
    <div className="hud top-right"><b>{phase==="finale"?"FINAL":`00:${String(seconds).padStart(2,"0")}`}</b><span>WATCH {Math.min(round+1,TOTAL_ROUNDS)}/{TOTAL_ROUNDS}</span><span>XP {xp}</span></div>

    {["prep","night","finale"].includes(phase)&&<div className="objectives"><b>{phase==="finale"?"FINAL CONTAINMENT":chase?"RUN TO THE LAMP":"NIGHT PATROL"}</b>{ZONES.map(z=><span key={z.id} className={visited.has(z.id)?"done":""}>{visited.has(z.id)?"✓":"□"} {z.name}</span>)}</div>}

    {near>=0&&phase==="night"&&!chase&&<button className="interact" onClick={inspect}>INSPECT · {ZONES[near].name} <small>E</small></button>}
    {phase==="night"&&<div className="actions"><button onClick={()=>setMenu("inventory")}>INVENTORY</button><button onClick={()=>setMenu("store")}>RF SUPPLIES</button><button disabled={visited.size<ZONES.length||chase} onClick={()=>setMenu("report")}>FILE REPORT</button></div>}
    <div className="status">{message}</div>
    {scare&&<div className="flash"><div className="face"><i/><i/><b/></div></div>}

    {phase==="intro"&&<div className="overlay"><div className="card">
      <span>FRIEND #334137 // TRAIT-BOUND HORROR</span><h1>THE HATCH</h1>
      <p>This game is generated from the NFT: <b>Mask</b> creates the Mimic, <b>Garden</b> creates the map, <b>Hatch</b> creates the containment objective, and seed <b>334137</b> determines the night.</p>
      <div className="rules"><b>HOW TO PLAY</b><p>Patrol all four zones.</p><p>Inspect what changed.</p><p>Survive the Mimic when it breaches.</p><p>File one report before time runs out.</p><p>Three corruption marks trigger final containment.</p></div>
      <button onClick={start}>BEGIN NIGHT</button><button onClick={()=>setMenu("settings")}>SETTINGS</button>
    </div></div>}

    {(phase==="won"||phase==="lost")&&<div className="overlay"><div className="card"><span>{phase==="won"?"SHIFT COMPLETE":"CONTAINMENT FAILURE"}</span><h1>{phase==="won"?"SUNRISE":"REPLACED"}</h1><p>{message}</p><div className="ledger"><b>SESSION ECONOMY</b><span>RF spent {rfSpent.toFixed(2)}</span><span>Simulated burn {burn}</span><span>Active Friend rewards {reward}</span><span>Watch XP {xp}</span></div><button onClick={start}>PLAY AGAIN</button></div></div>}

    {menu==="report"&&<GameMenu title="FILE REPORT" onClose={()=>setMenu(null)}><div className="grid">{(["hatch","garden","mimic","power","clear"] as Threat[]).map(t=><button key={t} onClick={()=>report(t)}><b>{t==="clear"?"ALL CLEAR":t.toUpperCase()}</b></button>)}</div></GameMenu>}
    {menu==="store"&&<GameMenu title="RF SUPPLY CABINET" onClose={()=>setMenu(null)}><p>Simulated RF: 50% burn / 50% Active Friend reward flow.</p><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={busy} onClick={()=>void buy(i)}><b>{i.name}</b><small>{i.cost.toFixed(2)} RF · {i.desc}</small></button>)}</div><p>Spent {rfSpent.toFixed(2)} RF · burn {burn} · rewards {reward}</p></GameMenu>}
    {menu==="inventory"&&<GameMenu title="INVENTORY" onClose={()=>setMenu(null)}><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={!inventory[i.key]} onClick={()=>use(i.key)}><b>{i.name} × {inventory[i.key]||0}</b><small>{i.desc}</small></button>)}</div></GameMenu>}
    {menu==="settings"&&<GameMenu title="SETTINGS" onClose={()=>setMenu(null)}><button onClick={()=>{const n=!muted;setMuted(n);sound.current?.setMuted(n);}}>{muted?"SOUND: OFF":"SOUND: ON"}</button><p>FriendSDK supplies wallet ownership and the canonical Friend sprite.</p></GameMenu>}
  </section>;
}
