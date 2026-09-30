"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";
import mainMusicUrl from "./assets/jorisvermeer-ominous-horror-game-background-418850.mp3";
import flashlightSwitchUrl from "./assets/audio/sfx_flashlight_switch.mp3";
import streetlightFlickerUrl from "./assets/audio/sfx_streetlight_flicker.mp3";
import pageFlipUrl from "./assets/audio/sfx_page_flip.mp3";
import sabotageHitUrl from "./assets/audio/sfx_sabotage_hit.mp3";
import sabotage10sUrl from "./assets/audio/sfx_sabotage_10s.mp3";

type Point={x:number;y:number};
type Role="friend"|"mimic";
type Phase="title"|"role"|"play"|"meeting"|"won"|"lost";
type ZoneKey="lamp"|"pond"|"hatch"|"shrine"|"shed"|"ward";
type Menu="store"|"inventory"|"settings"|"map"|"tutorial"|"task"|null;
type MeetingStage="report"|"testimony"|"vote";
type ShopKind="flashlight"|"battery"|"uv"|"flare"|"ward";
type SabotageKind="blackout"|"overload"|"breach"|"corruption"|"perimeter";
type ActiveSabotage={zone:ZoneKey;kind:SabotageKind;label:string;startedAt:number;deadlineAt:number;fatalText:string};
type PuzzleTargets={lamp:number[];hatch:number[];pond:number[];shrine:string[];fuse:number;ward:boolean[]};
type Personality="careful"|"nervous"|"direct"|"quiet"|"watchful";
type SettingsTab="graphics"|"audio"|"gameplay";
type GameSettings={
  graphics:"low"|"medium"|"high"|"ultra";
  fps:30|60|120;
  cameraZoom:number;
  brightness:number;
  fog:number;
  grain:number;
  master:number;
  music:number;
  ambience:number;
  sfx:number;
  reducedMotion:boolean;
  screenShake:boolean;
  hints:boolean;
};
type Agent={id:string;name:string;p:Point;alive:boolean;color:string;target:Point;speed:number;task:ZoneKey|null;cooldown:number;suspicion:number;tokenId:bigint;choreIndex:number;workUntil:number;lastZone:ZoneKey;lastAction:string;personality:Personality;reported:boolean;lastSeenName:string|null;lastSeenZone:ZoneKey;lastSeenAt:number};

const VIEW={width:960,height:640};
const WORLD={width:3000,height:2100};
const START={x:1500,y:1870};
const SPEED=245;
const PROFILE={token:"334137",character:"Mask",scenery:"Garden",floor:"Hatch",generation:6,seed:334137};
const MAIN_MUSIC_URL=mainMusicUrl;
const FLASHLIGHT_SWITCH_URL=flashlightSwitchUrl;
const STREETLIGHT_FLICKER_URL=streetlightFlickerUrl;

const ZONES:Record<ZoneKey,{name:string;p:Point;hint:string}>={
  lamp:{name:"Lamp Court",p:{x:620,y:920},hint:"Reconnect the lamp circuit and restore the street lights."},
  pond:{name:"Moon Pond",p:{x:2380,y:1280},hint:"Align the mirrors until the moon reflection reaches the ward."},
  hatch:{name:"Central Hatch",p:{x:1510,y:1040},hint:"Lock the containment bolts in the correct sequence."},
  shrine:{name:"Old Shrine",p:{x:2360,y:430},hint:"Arrange the ritual symbols in the warding order."},
  shed:{name:"Tool Shed",p:{x:430,y:1640},hint:"Choose the correct fuse and reinstall the repair kit."},
  ward:{name:"Memorial Ward",p:{x:1730,y:360},hint:"Re-anchor the boundary stones to the correct pattern."},
};
const ALL_ZONES=Object.keys(ZONES) as ZoneKey[];
const LANDMARKS=[
  {name:"North Grove",p:{x:720,y:350}},
  {name:"Broken Walk",p:{x:2440,y:1690}},
  {name:"Fog Gate",p:{x:2700,y:720}},
  {name:"Old Well",p:{x:930,y:1530}},
  {name:"South Arch",p:{x:1650,y:1920}},
] as const;
const ROAD_LIGHTS=[
  {x:1320,y:1710},{x:1410,y:1460},{x:1490,y:1240},{x:1280,y:1040},
  {x:1030,y:990},{x:820,y:950},{x:1750,y:1100},{x:1980,y:1170},
  {x:2180,y:1235},{x:1760,y:820},{x:1970,y:660},{x:2170,y:520},
] as const;
const BOT_NAMES=["Moth","Reed","Vale","Ash","Ivy"];
const NPC_TOKEN_IDS=[334130n,334131n,334132n,334133n,334134n];
const PERSONALITIES:Personality[]=["careful","nervous","direct","quiet","watchful"];
const DEFAULT_SETTINGS:GameSettings={graphics:"high",fps:60,cameraZoom:1,brightness:1,fog:55,grain:22,master:75,music:42,ambience:62,sfx:78,reducedMotion:false,screenShake:true,hints:true};
const ROUND_SECONDS=360;
const SHOP_ITEMS:{kind:ShopKind;name:string;price:string;units:number;icon:string;desc:string;use:string}[]=[
  {kind:"flashlight",name:"Field Flashlight",price:"0.10 RF",units:1,icon:"◐",desc:"Focused beam for true blackouts. Includes a full battery.",use:"Toggle with F"},
  {kind:"battery",name:"Battery Pack",price:"0.10 RF",units:1,icon:"▰",desc:"Consumable 100% flashlight recharge.",use:"Use from HUD"},
  {kind:"uv",name:"UV Trace Scanner",price:"0.20 RF",units:2,icon:"UV",desc:"Adds one ambiguous route inconsistency to meetings.",use:"Passive in meetings"},
  {kind:"flare",name:"Emergency Flare",price:"0.30 RF",units:3,icon:"✦",desc:"Temporary emergency light while the power grid is down.",use:"Use from HUD"},
  {kind:"ward",name:"Containment Ward",price:"0.10 RF",units:1,icon:"◇",desc:"Instantly cancels an active Hatch breach.",use:"Use from HUD"},
];
const TUTORIAL_STEPS=[
  {eyebrow:"01 · MOVE + EXPLORE",title:"Enter the Garden",body:"Use WASD, Arrow keys, or tap the ground. Trees, rocks and structures have collision, so follow the wet paths and learn the landmarks.",key:"WASD / TAP"},
  {eyebrow:"02 · USE THE MAP",title:"Know Where You Are",body:"Press M for the full Garden map. It shows six containment stations, roads, landmarks, completed tasks and sabotaged stations — but never reveals the Mimic.",key:"M · MAP"},
  {eyebrow:"03 · SOLVE TASKS",title:"Containment Takes Work",body:"At a station press E when the action says PUZZLE or REPAIR. Each station has a different mini-puzzle. Completed stations build your alibi and stabilize the Garden.",key:"E · PUZZLE / REPAIR"},
  {eyebrow:"04 · BUY + USE GEAR",title:"RF Night Market",body:"Press G to buy optional simulated-RF gear. Flashlight charge drains only while ON; Battery Packs refill it. Flares restore light, UV helps meetings and Wards counter Hatch sabotage.",key:"G SHOP · F LIGHT"},
  {eyebrow:"05 · SURVIVE SABOTAGE",title:"The Mimic Can Undo Progress",body:"A secure station can be sabotaged and marked unstable. Lamp Court sabotage makes street lights flicker before blackout. Return to the marked station and solve its puzzle again.",key:"WATCH THE HUD + MAP"},
  {eyebrow:"06 · REPORT THE DEAD",title:"Bodies Stay in the Garden",body:"A murdered Keeper freezes where they fell and a faint spirit remains beside the body. Stand close and press R to report. Another Keeper can discover the body first.",key:"R · REPORT"},
  {eyebrow:"07 · LISTEN + VOTE",title:"Everyone Has a Story",body:"Reports trigger cinematic statements from every survivor. Compare what they claim with system evidence and what you personally saw. The Mimic speaks too and can lie. A wrong vote does not end the round.",key:"READ · COMPARE · VOTE"},
  {eyebrow:"08 · EXPOSE THE MIMIC",title:"Survive Until Sunrise",body:"Keep the Garden stable and identify the Mimic before the team is wiped out. Winning shows a small simulated RF reward; spending is optional for the base deduction game.",key:"SURVIVE · EJECT · EARN"},
] as const;

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const choose=<T,>(items:T[])=>items[Math.floor(Math.random()*items.length)];
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a:Point,b:Point,r=95)=>dist(a,b)<r;
const randPoint=(seed:number)=>({x:180+((seed*811)%(WORLD.width-360)),y:170+((seed*557)%(WORLD.height-340))});
const TREE_POINTS=Array.from({length:38},(_,i)=>randPoint(i+13)).filter(p=>dist(p,START)>170&&ALL_ZONES.every(z=>dist(p,ZONES[z].p)>190)&&LANDMARKS.every(l=>dist(p,l.p)>120));
const ROCK_POINTS=Array.from({length:14},(_,i)=>randPoint(i+91)).filter(p=>dist(p,START)>130&&ALL_ZONES.every(z=>dist(p,ZONES[z].p)>150));
function blocked(p:Point){
  if(p.x<118||p.y<118||p.x>WORLD.width-118||p.y>WORLD.height-118)return true;
  if(TREE_POINTS.some(t=>dist(p,t)<48))return true;
  if(ROCK_POINTS.some(r=>dist(p,r)<30))return true;
  return false;
}
function moveWithCollision(p:Point,vx:number,vy:number){
  const nextX={x:clamp(p.x+vx,120,WORLD.width-120),y:p.y};
  if(!blocked(nextX))p.x=nextX.x;
  const nextY={x:p.x,y:clamp(p.y+vy,120,WORLD.height-120)};
  if(!blocked(nextY))p.y=nextY.y;
}
function advanceAgent(p:Point,vx:number,vy:number,seed:number){
  const next={...p};
  const nx={x:clamp(next.x+vx,130,WORLD.width-130),y:next.y};
  if(!blocked(nx))next.x=nx.x;
  const ny={x:next.x,y:clamp(next.y+vy,130,WORLD.height-130)};
  if(!blocked(ny))next.y=ny.y;
  if(next.x===p.x&&next.y===p.y){
    const sign=seed%2===0?1:-1;
    const side={x:clamp(p.x-vy*sign*1.4,130,WORLD.width-130),y:clamp(p.y+vx*sign*1.4,130,WORLD.height-130)};
    if(!blocked(side))return side;
  }
  return next;
}
const formatRF=(value:bigint|undefined)=>{
  if(value===undefined)return "—";
  const RF=10n**18n,whole=value/RF,frac=(value%RF)*100n/RF;
  return whole.toString()+"."+frac.toString().padStart(2,"0");
};

type HatchAudio={
  resume:()=>Promise<void>;
  set:(settings:GameSettings,muted:boolean)=>void;
  cue:(kind:"meeting"|"danger"|"task"|"vote"|"win"|"lose")=>void;
  siren:()=>void;
  sample:(kind:"flashlight"|"streetlightFlicker"|"pageFlip"|"sabotageHit"|"sabotage10s")=>void;
  dispose:()=>void;
};

function createHatchAudio():HatchAudio|null{
  if(typeof window==="undefined")return null;
  const AudioCtor=window.AudioContext||(window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  const context=AudioCtor?new AudioCtor():null;
  const sfxBus=context?.createGain()||null;
  if(sfxBus&&context)sfxBus.connect(context.destination);

  // Use native HTMLAudioElement playback for bundled music/SFX. This avoids
  // MediaElementAudioSource/CORS/autoplay routing failures inside embedded hosts.
  const track=new Audio(MAIN_MUSIC_URL);
  track.preload="auto";track.loop=true;
  const sampleEls={
    flashlight:new Audio(FLASHLIGHT_SWITCH_URL),
    streetlightFlicker:new Audio(STREETLIGHT_FLICKER_URL),
    pageFlip:new Audio(pageFlipUrl),
    sabotageHit:new Audio(sabotageHitUrl),
    sabotage10s:new Audio(sabotage10sUrl),
  };
  Object.values(sampleEls).forEach(el=>{el.preload="auto";});

  let currentSettings:GameSettings=DEFAULT_SETTINGS,currentMuted=false;
  const applyVolumes=()=>{
    const master=currentMuted?0:currentSettings.master/100;
    track.muted=currentMuted;track.volume=Math.max(0,Math.min(1,master*(currentSettings.music/100)));
    Object.values(sampleEls).forEach(el=>{el.muted=currentMuted;el.volume=Math.max(0,Math.min(1,master*(currentSettings.sfx/100)));});
    if(sfxBus&&context)sfxBus.gain.setTargetAtTime(master*(currentSettings.sfx/100),context.currentTime,.04);
  };
  const set=(settings:GameSettings,muted:boolean)=>{currentSettings=settings;currentMuted=muted;applyVolumes();};
  const cue=(kind:"meeting"|"danger"|"task"|"vote"|"win"|"lose")=>{
    if(!context||context.state!=="running"||!sfxBus)return;
    const osc=context.createOscillator(),gain=context.createGain();
    const freq={meeting:196,danger:73,task:392,vote:220,win:523.25,lose:82.5}[kind];
    osc.type=kind==="danger"||kind==="lose"?"sawtooth":"sine";osc.frequency.value=freq;
    gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(.11,context.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.32);
    osc.connect(gain).connect(sfxBus);osc.start();osc.stop(context.currentTime+.34);
  };
  const siren=()=>{
    if(!context||context.state!=="running"||!sfxBus)return;
    for(let i=0;i<6;i++){
      const osc=context.createOscillator(),gain=context.createGain(),start=context.currentTime+i*.18;
      osc.type="square";osc.frequency.value=i%2===0?520:760;
      gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(.055,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.16);
      osc.connect(gain).connect(sfxBus);osc.start(start);osc.stop(start+.17);
    }
  };
  const sample=(kind:"flashlight"|"streetlightFlicker"|"pageFlip"|"sabotageHit"|"sabotage10s")=>{
    const el=sampleEls[kind];el.pause();el.currentTime=0;void el.play().catch(()=>{});
  };
  applyVolumes();
  return {
    resume:async()=>{
      if(context?.state==="suspended")await context.resume().catch(()=>{});
      applyVolumes();
      if(track.paused){try{await track.play();}catch{}}
    },
    set,cue,siren,sample,
    dispose:()=>{try{track.pause();track.src="";Object.values(sampleEls).forEach(el=>{el.pause();el.src="";});if(context)void context.close();}catch{}}
  };
}

function FriendPortrait({sprites,name}:{sprites?:GenerationSprites;name:string}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    if(!sprites){
      const g=ctx.createRadialGradient(48,52,4,48,52,46);g.addColorStop(0,"rgba(207,222,203,.28)");g.addColorStop(1,"rgba(207,222,203,0)");ctx.fillStyle=g;ctx.fillRect(0,0,96,112);
      ctx.strokeStyle="rgba(220,232,216,.72)";ctx.lineWidth=2;ctx.strokeRect(30,20,36,66);ctx.fillStyle="#dce6d8";ctx.font="800 30px Inter,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(name.slice(0,1),48,64);return;
    }
    const rows=spriteFrame(sprites,"down",false,0,"right").frame.rows;
    const size=5,ox=Math.round((96-(rows[0]?.length||16)*size)/2),oy=18;
    rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#"){ctx.fillStyle="rgba(224,233,220,.55)";ctx.fillRect(ox+x*size-1,oy+y*size-1,size+2,size+2);}}));
    rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#"){ctx.fillStyle="#050705";ctx.fillRect(ox+x*size,oy+y*size,size,size);}}));
  },[sprites,name]);
  return <canvas ref={ref} width={96} height={112} className="friend-portrait-canvas" aria-label={name+" Rare Friend portrait"}/>;
}

function TutorialScene({step,sprites,friendId}:{step:number;sprites:GenerationSprites|null;friendId:bigint}){
  if(step===0)return <div className="manual-demo movement-demo"><div className="manual-friend"><FriendPortrait sprites={sprites||undefined} name={"Friend #"+friendId.toString()}/><small>YOU</small></div><div className="key-cluster"><i>W</i><i>A</i><i>S</i><i>D</i></div><div className="trail"><i/><i/><i/><i/></div></div>;
  if(step===1)return <div className="manual-demo map-demo"><svg viewBox="0 0 340 170" aria-hidden="true"><path d="M35 140 L120 92 L175 110 L245 54 L310 76"/><path d="M120 92 L76 38 M175 110 L228 142"/><circle cx="35" cy="140" r="6"/><circle cx="120" cy="92" r="7"/><circle cx="175" cy="110" r="7"/><circle cx="245" cy="54" r="7"/><circle cx="310" cy="76" r="7"/></svg><span className="map-you">YOU</span><b>KEEPERS ARE NOT SHOWN</b></div>;
  if(step===2)return <div className="manual-demo puzzle-demo"><div className="relay-strip">{[1,2,3,4].map((n,i)=><i key={n} style={{"--d":(i*.28)+"s"} as CSSProperties}>{n}</i>)}</div><small>WATCH THE SIGNAL · REPEAT IT</small></div>;
  if(step===3)return <div className="manual-demo gear-demo">{SHOP_ITEMS.slice(0,4).map(item=><div key={item.kind}><i>{item.icon}</i><span>{item.name}</span><small>{item.price}</small></div>)}</div>;
  if(step===4)return <div className="manual-demo sabotage-demo"><div className="mini-lamp"/><div className="mini-alert"><span>GRID OVERLOAD</span><b>00:38</b><i/></div><small>IGNORE IT → ROUND LOST</small></div>;
  if(step===5)return <div className="manual-demo report-demo"><div className="body-mark"><i/><i/></div><div className="ghost-mark"/><kbd>R</kbd><span>REPORT</span></div>;
  if(step===6)return <div className="manual-demo testimony-demo"><div><b>MOTH</b><span>“I crossed Lamp Court before the alarm.”</span></div><div><b>ASH</b><span>“I saw someone double back near the pond.”</span></div><small>CLUES NARROW THE FIELD — THEY DO NOT NAME THE MIMIC</small></div>;
  return <div className="manual-demo win-demo"><div className="sun-mark"/><div className="seal-mark">✓</div><b>6/6 STATIONS</b><span>MIMIC EXPOSED</span><small>MAKE IT TO SUNRISE</small></div>;
}

function drawFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,p:Point,facing:SpriteFacing,walking:boolean,frame:number,side:"left"|"right"){
  const rows=spriteFrame(sprites,facing,walking,frame,side).frame.rows;
  const scale=5,left=Math.round(p.x)-40,top=Math.round(p.y)-80;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="rgba(235,242,231,.72)";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale-2,top+y*scale-2,scale+4,scale+4)}));
  ctx.fillStyle="#030403";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  ctx.restore();
}

function drawNpcFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,a:Agent,t:number){
  const dx=a.target.x-a.p.x,dy=a.target.y-a.p.y;
  const facing:SpriteFacing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
  const side=facing==="left"?"left":"right";
  const rows=spriteFrame(sprites,facing,a.workUntil<=t,Math.floor(t/120)%8,side).frame.rows;
  const scale=4,left=Math.round(a.p.x)-32,top=Math.round(a.p.y)-62;
  ctx.save();ctx.imageSmoothingEnabled=false;
  const shadow=ctx.createRadialGradient(a.p.x,a.p.y+4,2,a.p.x,a.p.y+4,28);shadow.addColorStop(0,"rgba(0,0,0,.55)");shadow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(a.p.x,a.p.y+5,28,10,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="rgba(236,242,232,.68)";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale-1,top+y*scale-1,scale+2,scale+2)}));
  ctx.fillStyle="#050605";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  ctx.fillStyle="#e8eee5";ctx.font="700 9px ui-monospace";ctx.textAlign="center";ctx.shadowColor="#000";ctx.shadowBlur=4;
  ctx.fillText(a.name+" · #"+a.tokenId.toString(),a.p.x,a.p.y+27);
  if(a.workUntil>t){ctx.fillStyle="rgba(232,239,228,.72)";ctx.font="700 8px ui-monospace";ctx.fillText("WORKING",a.p.x,a.p.y+39);}
  ctx.restore();
}

function drawDeadNpcFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,a:Agent,t:number){
  const rows=spriteFrame(sprites,"down",false,0,"right").frame.rows;
  const scale=4,reported=a.reported;
  ctx.save();
  const blood=ctx.createRadialGradient(a.p.x,a.p.y+10,3,a.p.x,a.p.y+10,42);
  blood.addColorStop(0,reported?"rgba(82,13,17,.34)":"rgba(125,12,19,.62)");blood.addColorStop(1,"rgba(95,10,15,0)");
  ctx.fillStyle=blood;ctx.beginPath();ctx.ellipse(a.p.x,a.p.y+10,45,18,0,0,Math.PI*2);ctx.fill();
  ctx.translate(a.p.x,a.p.y+7);ctx.rotate(Number(a.tokenId%2n)===0?-.95:.95);ctx.globalAlpha=reported?.62:.96;ctx.imageSmoothingEnabled=false;
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#"){ctx.fillStyle="rgba(229,236,226,.58)";ctx.fillRect(-32+x*scale-1,-58+y*scale-1,scale+2,scale+2);}}));
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#"){ctx.fillStyle="#050605";ctx.fillRect(-32+x*scale,-58+y*scale,scale,scale);}}));
  ctx.restore();

  // A faint spirit remains beside the body as a readable death state.
  const gy=a.p.y-70+Math.sin(t/360+Number(a.tokenId%7n)) * 5,gx=a.p.x+34;
  ctx.save();ctx.globalAlpha=reported?.12:.24;ctx.imageSmoothingEnabled=false;
  const glow=ctx.createRadialGradient(gx,gy,2,gx,gy,42);glow.addColorStop(0,"rgba(215,235,223,.22)");glow.addColorStop(1,"rgba(215,235,223,0)");
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(gx,gy,42,0,Math.PI*2);ctx.fill();
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#"){ctx.fillStyle="#dce9df";ctx.fillRect(gx-32+x*scale,gy-38+y*scale,scale,scale);}}));
  ctx.restore();
  ctx.save();ctx.font="700 9px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="rgba(224,231,221,.72)";ctx.fillText(a.name+" · DEAD",a.p.x,a.p.y+38);ctx.restore();
}

function drawDeadKeeper(ctx:CanvasRenderingContext2D,a:Agent,t:number){
  ctx.save();
  ctx.fillStyle=a.reported?"rgba(92,14,18,.25)":"rgba(125,13,20,.5)";ctx.beginPath();ctx.ellipse(a.p.x,a.p.y+8,42,17,0,0,Math.PI*2);ctx.fill();
  ctx.translate(a.p.x,a.p.y);ctx.rotate(-.9);ctx.globalAlpha=a.reported?.58:.94;ctx.fillStyle="#2b302b";ctx.fillRect(-30,-9,60,18);ctx.fillStyle="#6d746b";ctx.beginPath();ctx.arc(-34,0,10,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=a.reported?.10:.22;ctx.translate(a.p.x+28,a.p.y-58+Math.sin(t/380)*5);ctx.fillStyle="#cad8cc";ctx.beginPath();ctx.arc(0,-20,10,0,Math.PI*2);ctx.fill();ctx.fillRect(-10,-10,20,32);ctx.restore();
  ctx.save();ctx.font="700 9px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="#dce4d9";ctx.fillText(a.name+" · DEAD",a.p.x,a.p.y+34);ctx.restore();
}

function drawChoreEffect(ctx:CanvasRenderingContext2D,a:Agent,t:number){
  if(a.workUntil<=t||!a.alive)return;
  const zone=ALL_ZONES.reduce((best,z)=>dist(a.p,ZONES[z].p)<dist(a.p,ZONES[best].p)?z:best,ALL_ZONES[0]);
  ctx.save();ctx.translate(a.p.x,a.p.y);
  const pulse=.55+Math.sin(t/110)*.25;
  if(zone==="lamp"){
    ctx.strokeStyle="rgba(255,231,158,"+pulse+")";ctx.lineWidth=2;
    for(let i=0;i<4;i++){const x=-18+i*12,y=-34-Math.sin(t/80+i)*8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4,y-7);ctx.stroke();}
  }else if(zone==="pond"){
    ctx.strokeStyle="rgba(181,215,210,"+(.35+pulse*.25)+")";ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(0,5,24+Math.sin(t/140)*6,8+Math.sin(t/140)*2,0,0,Math.PI*2);ctx.stroke();
  }else if(zone==="hatch"){
    ctx.strokeStyle="rgba(205,214,202,"+pulse+")";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,-20,13,t/180,t/180+Math.PI*1.45);ctx.stroke();
    ctx.fillStyle="rgba(216,225,211,.75)";ctx.fillRect(9,-33,4,17);
  }else{
    ctx.strokeStyle="rgba(208,220,203,"+pulse+")";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-16,-20);ctx.lineTo(0,-38);ctx.lineTo(16,-20);ctx.lineTo(0,-8);ctx.closePath();ctx.stroke();
  }
  ctx.restore();
}

function drawKeeper(ctx:CanvasRenderingContext2D,a:Agent,t:number){
  ctx.save();ctx.translate(a.p.x,a.p.y);
  const bob=Math.sin(t/360+a.p.x*.013)*1.8;
  const lean=Math.sin(t/900+a.p.y*.01)*.035;

  const sh=ctx.createRadialGradient(0,10,2,0,10,34);
  sh.addColorStop(0,"rgba(0,0,0,.58)");sh.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=sh;ctx.beginPath();ctx.ellipse(0,10,34,13,0,0,Math.PI*2);ctx.fill();

  ctx.rotate(lean);
  if(a.alive){
    const coat=ctx.createLinearGradient(-22,-55,22,8);
    coat.addColorStop(0,"#111511");coat.addColorStop(.45,a.color);coat.addColorStop(1,"#0b0d0b");
    ctx.fillStyle=coat;ctx.beginPath();
    ctx.moveTo(-18,bob-45);ctx.quadraticCurveTo(-27,bob-18,-24,bob+3);
    ctx.lineTo(24,bob+3);ctx.quadraticCurveTo(28,bob-18,18,bob-45);
    ctx.quadraticCurveTo(0,bob-61,-18,bob-45);ctx.closePath();ctx.fill();

    ctx.fillStyle="rgba(210,219,207,.12)";
    ctx.beginPath();ctx.ellipse(0,bob-39,19,8,0,0,Math.PI*2);ctx.fill();

    const skin=ctx.createRadialGradient(-4,bob-58,2,0,bob-55,15);
    skin.addColorStop(0,"#d7d8cd");skin.addColorStop(1,"#7c8277");
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,bob-55,12,14,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#090b09";ctx.fillRect(-7,bob-58,3,3);ctx.fillRect(4,bob-58,3,3);
    ctx.fillStyle="rgba(30,32,29,.7)";ctx.fillRect(-4,bob-49,8,2);

    ctx.strokeStyle="rgba(238,242,235,.16)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,bob-55,12,-2.6,-.7);ctx.stroke();
  }else{
    ctx.rotate(-.8);
    ctx.fillStyle="#262a25";ctx.beginPath();ctx.ellipse(0,-13,32,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#4a5149";ctx.beginPath();ctx.arc(-17,-17,10,0,Math.PI*2);ctx.fill();
  }

  ctx.restore();
  ctx.fillStyle="#eef2eb";ctx.font="700 10px ui-monospace";ctx.textAlign="center";ctx.shadowColor="rgba(0,0,0,.85)";ctx.shadowBlur=4;
  ctx.fillText(a.name,0,a.alive?29:24);
  ctx.restore();
}

function drawStonePath(ctx:CanvasRenderingContext2D,a:Point,b:Point,seed:number){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
  // muddy verge
  ctx.lineCap="round";ctx.strokeStyle="rgba(17,24,18,.92)";ctx.lineWidth=116;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  // damp compacted soil
  const soil=ctx.createLinearGradient(a.x,a.y,b.x,b.y);soil.addColorStop(0,"#333a34");soil.addColorStop(.5,"#454b44");soil.addColorStop(1,"#2e352f");
  ctx.strokeStyle=soil;ctx.lineWidth=88;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.strokeStyle="rgba(147,159,146,.10)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x+nx*28,a.y+ny*28);ctx.lineTo(b.x+nx*28,b.y+ny*28);ctx.stroke();

  const count=Math.max(2,Math.floor(len/76));
  for(let i=1;i<count;i++){
    const k=i/count,wob=Math.sin((i+seed)*2.17)*15,cx=a.x+dx*k+nx*wob,cy=a.y+dy*k+ny*wob;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.atan2(dy,dx)+Math.sin(i*.8)*.08);
    const w=46+(i%3)*10,h=28+(i%2)*8;
    const rg=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);rg.addColorStop(0,"#666d65");rg.addColorStop(.48,"#444b45");rg.addColorStop(1,"#292f2a");
    ctx.fillStyle=rg;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,5);ctx.fill();
    ctx.strokeStyle="rgba(5,8,6,.55)";ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle="rgba(196,205,195,.10)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w*.32,-h*.22);ctx.lineTo(w*.2,h*.18);ctx.stroke();
    if(i%4===0){ctx.fillStyle="rgba(132,156,148,.12)";ctx.beginPath();ctx.ellipse(0,h*.18,w*.28,3,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}

function drawTree(ctx:CanvasRenderingContext2D,p:Point,t:number,seed:number){
  ctx.save();ctx.translate(p.x,p.y);
  const sway=Math.sin(t/1400+seed)*4;
  const shadow=ctx.createRadialGradient(0,5,4,0,5,68);shadow.addColorStop(0,"rgba(0,0,0,.52)");shadow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(0,8,70,26,0,0,Math.PI*2);ctx.fill();

  const trunk=ctx.createLinearGradient(-24,0,24,0);trunk.addColorStop(0,"#0b0e0b");trunk.addColorStop(.45,"#2b2f28");trunk.addColorStop(.72,"#191d18");trunk.addColorStop(1,"#080a08");
  ctx.fillStyle=trunk;ctx.beginPath();ctx.moveTo(-18,18);ctx.bezierCurveTo(-12,-24,-18,-72,-8,-112);ctx.lineTo(10+sway,-115);ctx.bezierCurveTo(14,-72,10,-25,20,18);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#121612";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-4,-72);ctx.lineTo(-48+sway,-113);ctx.moveTo(6,-85);ctx.lineTo(52+sway,-128);ctx.stroke();

  for(let i=0;i<7;i++){
    const ox=Math.sin(seed*1.7+i*2.1)*48+sway,oy=-118+Math.cos(seed+i*1.9)*28;
    const r=38+(i%3)*9;
    const crown=ctx.createRadialGradient(ox-12,oy-10,4,ox,oy,r);crown.addColorStop(0,"#354132");crown.addColorStop(.48,"#1d281e");crown.addColorStop(1,"#090d0a");
    ctx.fillStyle=crown;ctx.beginPath();ctx.arc(ox,oy,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawBush(ctx:CanvasRenderingContext2D,p:Point,seed:number){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(0,12,58,20,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<9;i++){
    const ox=Math.sin(seed+i*2.3)*32,oy=Math.cos(seed*.7+i)*14-8,r=22+(i%4)*7;
    const rg=ctx.createRadialGradient(ox-7,oy-7,2,ox,oy,r);rg.addColorStop(0,"#46533f");rg.addColorStop(.42,"#2a382b");rg.addColorStop(1,"#0b110d");
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(ox,oy,r,0,Math.PI*2);ctx.fill();
    if(i%2===0){ctx.strokeStyle="rgba(121,148,114,.18)";ctx.lineWidth=1;for(let j=0;j<3;j++){const a=(j*2.1+i);ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+Math.cos(a)*r*.7,oy+Math.sin(a)*r*.45);ctx.stroke();}}
  }
  ctx.restore();
}

function drawStreetLamp(ctx:CanvasRenderingContext2D,p:Point,lights:boolean,flickering:boolean,t:number,seed:number){
  ctx.save();
  const flicker=flickering?(Math.sin(t*.055+seed*3)>0?.95:.08):1;
  if(lights||flickering){
    const power=(lights?1:.65)*flicker;
    const cone=ctx.createLinearGradient(p.x,p.y-118,p.x,p.y+125);
    cone.addColorStop(0,"rgba(255,236,174,"+(.22*power)+")");cone.addColorStop(1,"rgba(255,236,174,0)");
    ctx.fillStyle=cone;ctx.beginPath();ctx.moveTo(p.x-13,p.y-116);ctx.lineTo(p.x-78,p.y+95);ctx.lineTo(p.x+78,p.y+95);ctx.closePath();ctx.fill();
    const halo=ctx.createRadialGradient(p.x,p.y-120,4,p.x,p.y-120,110);
    halo.addColorStop(0,"rgba(255,242,194,"+(.48*power)+")");halo.addColorStop(.35,"rgba(245,223,162,"+(.16*power)+")");halo.addColorStop(1,"rgba(245,223,162,0)");
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y-120,110,0,Math.PI*2);ctx.fill();
  }
  const post=ctx.createLinearGradient(p.x-10,0,p.x+10,0);post.addColorStop(0,"#080b09");post.addColorStop(.5,"#3b433d");post.addColorStop(1,"#0a0c0a");
  ctx.fillStyle=post;ctx.fillRect(p.x-5,p.y-113,10,120);ctx.fillRect(p.x-22,p.y-128,44,7);
  ctx.fillStyle=(lights||flickering)?"#f4e5b7":"#171b18";ctx.fillRect(p.x-14,p.y-142,28,20);
  ctx.strokeStyle="#657066";ctx.lineWidth=2;ctx.strokeRect(p.x-14,p.y-142,28,20);
  ctx.fillStyle="rgba(0,0,0,.34)";ctx.beginPath();ctx.ellipse(p.x,p.y+7,26,8,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawLampCourt(ctx:CanvasRenderingContext2D,lights:boolean,flickering:boolean,t:number){
  const p=ZONES.lamp.p;
  const lamps=[{x:p.x-135,y:p.y-45},{x:p.x+135,y:p.y-45},{x:p.x-120,y:p.y+125},{x:p.x+120,y:p.y+125}];
  ctx.save();
  const court=ctx.createRadialGradient(p.x,p.y,30,p.x,p.y,240);court.addColorStop(0,"rgba(58,66,57,.42)");court.addColorStop(1,"rgba(18,25,19,0)");
  ctx.fillStyle=court;ctx.beginPath();ctx.ellipse(p.x,p.y+45,225,170,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(101,113,100,.23)";ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y+25,170,118,0,0,Math.PI*2);ctx.stroke();
  lamps.forEach((lp,i)=>drawStreetLamp(ctx,lp,lights,flickering,t,i));
  ctx.fillStyle="#5a6359";ctx.fillRect(p.x-50,p.y+34,100,5);
  ctx.font="800 11px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="rgba(214,224,210,.72)";ctx.fillText("LAMP COURT",p.x,p.y+65);
  ctx.restore();
}

function drawPond(ctx:CanvasRenderingContext2D,t:number){
  const p=ZONES.pond.p;
  ctx.save();
  const bank=ctx.createRadialGradient(p.x,p.y,130,p.x,p.y,245);bank.addColorStop(0,"#162019");bank.addColorStop(.62,"#263229");bank.addColorStop(1,"rgba(15,21,17,0)");
  ctx.fillStyle=bank;ctx.beginPath();ctx.ellipse(p.x,p.y,245,154,-.04,0,Math.PI*2);ctx.fill();

  const water=ctx.createLinearGradient(p.x,p.y-125,p.x,p.y+125);water.addColorStop(0,"#1b302f");water.addColorStop(.32,"#102321");water.addColorStop(.7,"#071311");water.addColorStop(1,"#020807");
  ctx.fillStyle=water;ctx.beginPath();ctx.ellipse(p.x,p.y,205,118,-.04,0,Math.PI*2);ctx.fill();

  // Layered moon reflection: broken streaks move with the water instead of a flat glow.
  for(let i=0;i<12;i++){
    const wave=Math.sin(t/430+i*.78)*7;
    const yy=p.y-74+i*13;
    const half=18+i*5+Math.sin(t/620+i)*6;
    ctx.strokeStyle="rgba(211,225,217,"+(0.055+i*.006)+")";ctx.lineWidth=i%3===0?3:1.5;
    ctx.beginPath();ctx.moveTo(p.x-half+wave,yy);ctx.bezierCurveTo(p.x-half*.25,yy-3,p.x+half*.25,yy+3,p.x+half-wave,yy);ctx.stroke();
  }
  const moon=ctx.createRadialGradient(p.x,p.y-48,4,p.x,p.y-48,62);moon.addColorStop(0,"rgba(235,241,224,.30)");moon.addColorStop(.4,"rgba(207,224,213,.10)");moon.addColorStop(1,"rgba(207,224,213,0)");
  ctx.fillStyle=moon;ctx.beginPath();ctx.ellipse(p.x,p.y-48,66,35,0,0,Math.PI*2);ctx.fill();

  // Random-looking ripple rings.
  for(let i=0;i<4;i++){
    const phase=(t/900+i*.31)%1,r=12+phase*70;
    ctx.strokeStyle="rgba(158,190,181,"+(0.12*(1-phase))+")";ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(p.x-80+i*52,p.y+22+(i%2)*18,r,r*.34,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.font="800 11px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="rgba(215,227,218,.76)";ctx.fillText("MOON POND",p.x,p.y+155);
  ctx.restore();
}

function drawShrine(ctx:CanvasRenderingContext2D){
  const p=ZONES.shrine.p;ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle="rgba(0,0,0,.38)";ctx.beginPath();ctx.ellipse(0,52,72,18,0,0,Math.PI*2);ctx.fill();
  const stone=ctx.createLinearGradient(-55,-60,55,60);stone.addColorStop(0,"#3f4740");stone.addColorStop(.5,"#1b201c");stone.addColorStop(1,"#0d100e");
  ctx.fillStyle=stone;ctx.fillRect(-54,-46,108,96);ctx.fillStyle="#4b544b";ctx.fillRect(-66,-58,132,17);
  ctx.strokeStyle="#70786e";ctx.lineWidth=2;ctx.strokeRect(-54,-46,108,96);
  ctx.fillStyle="#8d988b";ctx.font="700 9px ui-monospace";ctx.textAlign="center";ctx.fillText("KEEP THE HATCH SHUT",0,-4);
  ctx.fillStyle="rgba(214,223,211,.08)";ctx.fillRect(-34,12,68,3);
  ctx.restore();
}

function drawHatch(ctx:CanvasRenderingContext2D,hatchPanic:boolean,t:number){
  const p=ZONES.hatch.p;ctx.save();ctx.translate(p.x,p.y);
  const ground=ctx.createRadialGradient(0,0,60,0,0,170);ground.addColorStop(0,hatchPanic?"rgba(105,18,20,.25)":"rgba(0,0,0,.42)");ground.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=ground;ctx.beginPath();ctx.arc(0,0,170,0,Math.PI*2);ctx.fill();

  const metal=ctx.createRadialGradient(-32,-35,12,0,0,125);metal.addColorStop(0,"#4b514b");metal.addColorStop(.35,"#292e2a");metal.addColorStop(.72,"#151916");metal.addColorStop(1,"#080a09");
  ctx.fillStyle=metal;ctx.beginPath();ctx.arc(0,0,120,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=hatchPanic?"#9e5c60":"#687269";ctx.lineWidth=9;ctx.stroke();
  ctx.strokeStyle="#0a0c0a";ctx.lineWidth=15;ctx.beginPath();ctx.arc(0,0,84,0,Math.PI*2);ctx.stroke();

  for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.fillStyle="#8a9388";ctx.beginPath();ctx.arc(Math.cos(a)*101,Math.sin(a)*101,5,0,Math.PI*2);ctx.fill();}
  for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);ctx.fillStyle="#232824";ctx.fillRect(72,-13,55,26);ctx.strokeStyle="#596159";ctx.strokeRect(72,-13,55,26);ctx.restore();}

  if(hatchPanic){
    const pulse=.35+Math.sin(t/170)*.1;
    ctx.fillStyle="#010201";ctx.beginPath();ctx.ellipse(0,9,60,29,0,0,Math.PI*2);ctx.fill();
    const red=ctx.createRadialGradient(0,9,2,0,9,84);red.addColorStop(0,"rgba(170,34,38,"+pulse+")");red.addColorStop(1,"rgba(170,34,38,0)");
    ctx.fillStyle=red;ctx.beginPath();ctx.arc(0,9,84,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d6b7b7";ctx.fillRect(-25,4,7,4);ctx.fillRect(18,4,7,4);
  }else{
    ctx.fillStyle="#101411";ctx.beginPath();ctx.ellipse(0,4,55,20,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawLandmarks(ctx:CanvasRenderingContext2D){
  for(const l of LANDMARKS){
    ctx.save();ctx.translate(l.p.x,l.p.y);
    ctx.fillStyle="rgba(0,0,0,.34)";ctx.beginPath();ctx.ellipse(0,22,58,18,0,0,Math.PI*2);ctx.fill();
    if(l.name==="Tool Shed"){ctx.fillStyle="#202720";ctx.fillRect(-48,-50,96,72);ctx.fillStyle="#0e120f";ctx.fillRect(-16,-20,32,42);ctx.strokeStyle="#596458";ctx.strokeRect(-48,-50,96,72);}
    else if(l.name==="Fog Gate"){ctx.strokeStyle="#505a50";ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-48,24);ctx.lineTo(-48,-72);ctx.lineTo(48,-72);ctx.lineTo(48,24);ctx.stroke();}
    else if(l.name==="Memorial Corner"){ctx.fillStyle="#333a34";ctx.fillRect(-34,-35,68,58);ctx.fillStyle="#778176";ctx.fillRect(-25,-26,50,5);}
    else if(l.name==="Broken Walk"){ctx.fillStyle="#404840";for(let i=-2;i<=2;i++)ctx.fillRect(i*34-14,(i%2)*8,28,14);}
    else {ctx.fillStyle="#263127";ctx.beginPath();ctx.arc(0,-18,44,0,Math.PI*2);ctx.fill();}
    ctx.font="700 10px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="rgba(208,219,205,.58)";ctx.fillText(l.name,0,48);ctx.restore();
  }
}

function drawWetReflections(ctx:CanvasRenderingContext2D,lights:boolean,lightsFlickering:boolean,t:number){
  const reflect=[...ROAD_LIGHTS,{x:ZONES.lamp.p.x-135,y:ZONES.lamp.p.y-45},{x:ZONES.lamp.p.x+135,y:ZONES.lamp.p.y-45}];
  for(let i=0;i<reflect.length;i++){
    const p=reflect[i],flicker=lightsFlickering?(Math.sin(t*.055+(i+20)*3)>0?.9:.04):1;
    const power=(lights?1:lightsFlickering?.6:0)*flicker;
    if(power<=.02)continue;
    ctx.save();
    ctx.globalAlpha=.16*power;
    const rg=ctx.createLinearGradient(p.x,p.y+5,p.x,p.y+150);rg.addColorStop(0,"rgba(255,226,157,.8)");rg.addColorStop(1,"rgba(255,226,157,0)");
    ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(p.x,p.y+44,22,76,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.11*power;ctx.strokeStyle="#f6e7bc";ctx.lineWidth=1;
    for(let j=0;j<4;j++){const y=p.y+32+j*18+Math.sin(t/350+j+i)*3;ctx.beginPath();ctx.moveTo(p.x-19+j*2,y);ctx.lineTo(p.x+19-j*2,y);ctx.stroke();}
    ctx.restore();
  }
}

function drawRainScreen(ctx:CanvasRenderingContext2D,t:number,quality:GameSettings["graphics"]){
  const drops=quality==="low"?28:quality==="medium"?46:quality==="high"?68:92;
  ctx.save();ctx.lineWidth=1;
  for(let i=0;i<drops;i++){
    const seed=i*977+PROFILE.seed;
    const x=((seed+(t*.26)*(1+(i%3)*.18))%(VIEW.width+140))-70;
    const y=((seed*1.73+(t*.58)*(1+(i%4)*.11))%(VIEW.height+120))-80;
    const len=8+(i%7)*2;
    ctx.strokeStyle=i%6===0?"rgba(210,224,218,.17)":"rgba(184,204,196,.10)";
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4-len*.12,y+len);ctx.stroke();
  }
  for(let i=0;i<6;i++){
    const phase=(t/880+i*.19)%1,x=(i*173+91)%VIEW.width,y=470+(i*47)%150,r=2+phase*11;
    ctx.strokeStyle="rgba(191,211,203,"+(0.10*(1-phase))+")";ctx.beginPath();ctx.ellipse(x,y,r,r*.3,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}

function drawTaskStructures(ctx:CanvasRenderingContext2D){
  const shed=ZONES.shed.p;
  ctx.save();ctx.translate(shed.x,shed.y);
  const wood=ctx.createLinearGradient(-75,-60,75,60);wood.addColorStop(0,"#384037");wood.addColorStop(.45,"#202820");wood.addColorStop(1,"#111713");
  ctx.fillStyle="rgba(0,0,0,.38)";ctx.beginPath();ctx.ellipse(0,56,95,22,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=wood;ctx.fillRect(-72,-58,144,112);ctx.fillStyle="#111713";ctx.fillRect(-22,-5,44,59);
  ctx.fillStyle="#252e26";ctx.beginPath();ctx.moveTo(-88,-58);ctx.lineTo(0,-105);ctx.lineTo(88,-58);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#647064";ctx.strokeRect(-72,-58,144,112);
  ctx.font="800 11px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="#c2cec0";ctx.fillText("TOOL SHED",0,78);ctx.restore();

  const ward=ZONES.ward.p;
  ctx.save();ctx.translate(ward.x,ward.y);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.45,x=Math.cos(a)*72,y=Math.sin(a)*44;ctx.fillStyle="#303a32";ctx.beginPath();ctx.roundRect(x-16,y-26,32,52,7);ctx.fill();ctx.strokeStyle="rgba(145,164,143,.42)";ctx.stroke();ctx.fillStyle="rgba(198,215,195,.12)";ctx.fillRect(x-2,y-18,4,35);}
  ctx.strokeStyle="rgba(145,169,143,.18)";ctx.beginPath();ctx.ellipse(0,0,102,70,0,0,Math.PI*2);ctx.stroke();
  ctx.font="800 11px Inter,Segoe UI,sans-serif";ctx.textAlign="center";ctx.fillStyle="#c0ccc0";ctx.fillText("MEMORIAL WARD",0,96);ctx.restore();
}

function drawZoneWorldLabels(ctx:CanvasRenderingContext2D){
  for(const z of ALL_ZONES){
    const p=ZONES[z].p;
    ctx.save();ctx.font="800 12px Inter,Segoe UI,sans-serif";ctx.textAlign="center";
    const w=Math.max(100,ctx.measureText(ZONES[z].name.toUpperCase()).width+28);
    ctx.fillStyle="rgba(2,7,4,.68)";ctx.fillRect(p.x-w/2,p.y-205,w,25);
    ctx.strokeStyle="rgba(172,191,168,.22)";ctx.strokeRect(p.x-w/2,p.y-205,w,25);
    ctx.fillStyle="rgba(224,234,220,.84)";ctx.fillText(ZONES[z].name.toUpperCase(),p.x,p.y-188);ctx.restore();
  }
}

function drawWatchingEyes(ctx:CanvasRenderingContext2D,t:number){
  const cycle=t%11500;
  if(cycle<7600||cycle>8650)return;
  const index=Math.floor(t/11500)%Math.max(1,TREE_POINTS.length);
  const tree=TREE_POINTS[index]||{x:900,y:900};
  const alpha=Math.sin(((cycle-7600)/1050)*Math.PI)*.8;
  ctx.save();ctx.translate(tree.x+38,tree.y-82);
  const glow=ctx.createRadialGradient(0,0,1,0,0,28);glow.addColorStop(0,"rgba(213,225,194,"+(alpha*.2)+")");glow.addColorStop(1,"rgba(213,225,194,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="rgba(229,237,199,"+alpha+")";ctx.beginPath();ctx.ellipse(-7,0,3.2,1.8,0,0,Math.PI*2);ctx.ellipse(7,0,3.2,1.8,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawWorld(ctx:CanvasRenderingContext2D,t:number,lights:boolean,lightsFlickering:boolean,hatchPanic:boolean,bodies:Agent[],quality:GameSettings["graphics"]){
  const bg=ctx.createLinearGradient(0,0,0,WORLD.height);bg.addColorStop(0,"#0d1512");bg.addColorStop(.58,"#111a14");bg.addColorStop(1,"#060a08");ctx.fillStyle=bg;ctx.fillRect(0,0,WORLD.width,WORLD.height);

  const lawn=ctx.createLinearGradient(0,80,WORLD.width,WORLD.height);lawn.addColorStop(0,"#19241b");lawn.addColorStop(.5,"#101a13");lawn.addColorStop(1,"#0b120e");ctx.fillStyle=lawn;ctx.fillRect(80,80,WORLD.width-160,WORLD.height-140);
  // damp soil patches and shallow puddles break up the flat lawn
  for(let i=0;i<42;i++){const x=160+((i*419)% (WORLD.width-320)),y=150+((i*271)%(WORLD.height-300));ctx.fillStyle=i%3===0?"rgba(7,16,13,.32)":"rgba(32,46,34,.22)";ctx.beginPath();ctx.ellipse(x,y,30+(i%5)*9,10+(i%4)*4,(i%7)*.13,0,Math.PI*2);ctx.fill();}
  const detail=quality==="low"?.42:quality==="medium"?.68:quality==="high"?1:1.28;
  for(let i=0;i<Math.floor(280*detail);i++){
    const x=100+((i*193+PROFILE.seed)%(WORLD.width-200)),y=100+((i*317+PROFILE.seed*3)%(WORLD.height-200));
    const h=5+(i%7);ctx.strokeStyle=i%4===0?"rgba(111,136,104,.20)":"rgba(54,77,57,.24)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(i)*2,y-h);ctx.stroke();
  }

  const paths=[
    [START,ZONES.hatch.p],[ZONES.hatch.p,ZONES.lamp.p],[ZONES.hatch.p,ZONES.pond.p],[ZONES.hatch.p,ZONES.shrine.p],
    [ZONES.lamp.p,ZONES.shed.p],[ZONES.shrine.p,ZONES.ward.p],[ZONES.lamp.p,LANDMARKS[0].p],
    [ZONES.pond.p,LANDMARKS[1].p],[ZONES.pond.p,LANDMARKS[2].p],[START,LANDMARKS[4].p]
  ] as const;
  paths.forEach((p,i)=>drawStonePath(ctx,p[0],p[1],i+PROFILE.seed));

  ctx.strokeStyle="#2f3931";ctx.lineWidth=5;ctx.strokeRect(86,86,WORLD.width-172,WORLD.height-152);
  for(let x=105;x<WORLD.width-95;x+=52){ctx.fillStyle="#151b17";ctx.fillRect(x,80,4,50);ctx.fillRect(x,WORLD.height-118,4,48);}

  TREE_POINTS.forEach((p,i)=>drawTree(ctx,p,t,i+3));
  for(let i=0;i<Math.floor(24*detail);i++){drawBush(ctx,{x:170+((i*229)%(WORLD.width-340)),y:180+((i*401)%(WORLD.height-360))},i+11);}
  for(const r of ROCK_POINTS){ctx.fillStyle="#293029";ctx.beginPath();ctx.ellipse(r.x,r.y,31,20,.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#454e45";ctx.stroke();}
  drawLandmarks(ctx);
  drawTaskStructures(ctx);
  ROAD_LIGHTS.forEach((lp,i)=>drawStreetLamp(ctx,lp,lights,lightsFlickering,t,i+20));
  drawWetReflections(ctx,lights,lightsFlickering,t);

  drawLampCourt(ctx,lights,lightsFlickering,t);
  drawPond(ctx,t);
  drawShrine(ctx);
  drawHatch(ctx,hatchPanic,t);
  drawZoneWorldLabels(ctx);
  if(!lights)drawWatchingEyes(ctx,t);

  ctx.fillStyle="rgba(190,205,195,.035)";
  for(let i=0;i<18;i++){const x=820+((i*83)%480),y=800+((i*137)%420);ctx.beginPath();ctx.ellipse(x,y,28+(i%4)*7,5+(i%3),0,0,Math.PI*2);ctx.fill();}

  for(const b of bodies){
    const blood=ctx.createRadialGradient(b.p.x,b.p.y+7,3,b.p.x,b.p.y+7,44);blood.addColorStop(0,"rgba(113,11,16,.62)");blood.addColorStop(1,"rgba(113,11,16,0)");
    ctx.fillStyle=blood;ctx.beginPath();ctx.ellipse(b.p.x,b.p.y+8,45,20,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(b.p.x,b.p.y);ctx.rotate(-.7);ctx.fillStyle="#262a25";ctx.fillRect(-28,-8,56,16);ctx.fillStyle="#5e645c";ctx.beginPath();ctx.arc(-31,0,10,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  for(let i=0;i<Math.max(2,Math.floor(8*detail));i++){
    const x=((t*.018+i*430)%(WORLD.width+500))-250,y=180+(i*225)%(WORLD.height-260);
    const fog=ctx.createRadialGradient(x,y,10,x,y,180);fog.addColorStop(0,"rgba(190,205,195,.035)");fog.addColorStop(1,"rgba(190,205,195,0)");
    ctx.fillStyle=fog;ctx.beginPath();ctx.ellipse(x,y,220,70,0,0,Math.PI*2);ctx.fill();
  }
}

function shuffle<T>(arr:T[],seed:number){const a=[...arr];let s=seed>>>0;for(let i=a.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function makePuzzleTargets(seed:number):PuzzleTargets{
  const lamp=shuffle([1,2,3,4],seed+11),hatch=shuffle([1,2,3,4],seed+29);
  const pond=[0,1,2].map((_,i)=>(seed+i*7)%4);
  const shrine=shuffle(["MOON","MASK","SEED","HATCH"],seed+47);
  const fuse=[15,20,30][Math.abs(seed)%3];
  const ward=[0,1,2,3].map(i=>((seed>>(i+1))&1)===1);
  if(ward.filter(Boolean).length<2){ward[0]=true;ward[2]=true;}
  return {lamp,hatch,pond,shrine,fuse,ward};
}
function sabotageMeta(zone:ZoneKey){
  if(zone==="lamp")return {kind:"blackout" as const,label:"GRID OVERLOAD",seconds:45,fatalText:"The Lamp Court relay exploded in the blackout. Garden containment failed."};
  if(zone==="shed")return {kind:"overload" as const,label:"GENERATOR OVERLOAD",seconds:42,fatalText:"The Tool Shed service circuit blew before anyone isolated it. The Garden went dead."};
  if(zone==="hatch")return {kind:"breach" as const,label:"HATCH BREACH",seconds:40,fatalText:"The Central Hatch breached before the bolts were restored."};
  if(zone==="pond")return {kind:"corruption" as const,label:"REFLECTION COLLAPSE",seconds:52,fatalText:"Moon Pond's reflection ward collapsed and containment failed."};
  if(zone==="shrine")return {kind:"corruption" as const,label:"SHRINE CORRUPTION",seconds:50,fatalText:"The Old Shrine ward decayed past recovery."};
  return {kind:"perimeter" as const,label:"PERIMETER FAILURE",seconds:48,fatalText:"The Memorial Ward failed and the perimeter opened."};
}

export default function TheHatch({friendId,client,paused}:GameComponentProps){
  const canvas=useRef<HTMLCanvasElement>(null);
  const pos=useRef<Point>({...START});
  const cam=useRef<Point>({x:0,y:0});
  const keys=useRef(new Set<string>());
  const destination=useRef<Point|null>(null);
  const sound=useRef<FriendSoundKit|null>(null);
  const hatchAudio=useRef<HatchAudio|null>(null);
  const shakeUntil=useRef(0);
  const lastFrameDraw=useRef(0);
  const facing=useRef<SpriteFacing>("up");
  const side=useRef<"left"|"right">("right");
  const lastKill=useRef(0);
  const lastAutoReport=useRef(0);
  const agentsRef=useRef<Agent[]>([]);
  const frameSync=useRef(0);
  const roundDeadlineRef=useRef(0);
  const roundEndedRef=useRef(false);
  const roundSeedRef=useRef(Math.floor(Math.random()*0x7fffffff));
  const nextSabotageAtRef=useRef(0);
  const sabotageHistoryRef=useRef<ZoneKey[]>([]);
  const sabotageRef=useRef<ActiveSabotage|null>(null);
  const sabotageWarningPlayedRef=useRef(0);
  const mimicCaughtRef=useRef(false);
  const puzzleTargetsRef=useRef<PuzzleTargets>(makePuzzleTargets(PROFILE.seed));

  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [npcSprites,setNpcSprites]=useState<Record<string,GenerationSprites>>({});
  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [phase,setPhase]=useState<Phase>("title");
  const [role,setRole]=useState<Role>("friend");
  const [menu,setMenu]=useState<Menu>(null);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [tasks,setTasks]=useState<Record<ZoneKey,boolean>>({lamp:false,pond:false,hatch:false,shrine:false,shed:false,ward:false});
  const [unstableTasks,setUnstableTasks]=useState<Record<ZoneKey,boolean>>({lamp:false,pond:false,hatch:false,shrine:false,shed:false,ward:false});
  const tasksRef=useRef(tasks);
  const [lastSabotagedZone,setLastSabotagedZone]=useState<ZoneKey|null>(null);
  const [activeSabotage,setActiveSabotage]=useState<ActiveSabotage|null>(null);
  const [sabotageSeconds,setSabotageSeconds]=useState(0);
  const [mimicCaught,setMimicCaught]=useState(false);
  const [milestone,setMilestone]=useState<string|null>(null);
  const [lights,setLights]=useState(true);
  const [hatchPanic,setHatchPanic]=useState(false);
  const [meetingReason,setMeetingReason]=useState("");
  const [meetingStage,setMeetingStage]=useState<MeetingStage>("report");
  const [speakerIndex,setSpeakerIndex]=useState(0);
  const [emergencyLeft,setEmergencyLeft]=useState(1);
  const [message,setMessage]=useState("A social-deduction horror night in Garden Unit 06.");
  const [timer,setTimer]=useState(360);
  const [killCooldown,setKillCooldown]=useState(0);
  const [shiftCooldown,setShiftCooldown]=useState(0);
  const [disguise,setDisguise]=useState<string|null>(null);
  const [votes,setVotes]=useState<Record<string,number>>({});
  const [rfSpent,setRfSpent]=useState(0);
  const [rfEarned,setRfEarned]=useState(0);
  const [inventory,setInventory]=useState({flashlight:0,battery:0,uv:0,flare:0,ward:0});
  const [flashlightOn,setFlashlightOn]=useState(false);
  const [flashlightBattery,setFlashlightBattery]=useState(0);
  const [toastOpen,setToastOpen]=useState(false);
  const [tutorialStep,setTutorialStep]=useState(0);
  const [tutorialSeen,setTutorialSeen]=useState(false);
  const [rewardDisplay,setRewardDisplay]=useState(0);
  const [activePuzzle,setActivePuzzle]=useState<ZoneKey|null>(null);
  const [puzzleSequence,setPuzzleSequence]=useState<number[]>([]);
  const [mirrorAngles,setMirrorAngles]=useState<number[]>([0,0,0]);
  const [shrineSymbols,setShrineSymbols]=useState<string[]>([]);
  const [fuseChoice,setFuseChoice]=useState<number|null>(null);
  const [wardStones,setWardStones]=useState<boolean[]>([false,false,false,false]);
  const [puzzleError,setPuzzleError]=useState("");
  const [lightsFlickering,setLightsFlickering]=useState(false);
  const [testimony,setTestimony]=useState<{name:string;text:string}[]>([]);
  const [busy,setBusy]=useState(false);
  const [muted,setMuted]=useState(false);
  const [settings,setSettings]=useState<GameSettings>(DEFAULT_SETTINGS);
  const [settingsTab,setSettingsTab]=useState<SettingsTab>("graphics");
  const [roundNotes,setRoundNotes]=useState<string[]>([]);
  const [evidence,setEvidence]=useState<string[]>(["No evidence yet. Watch who follows victims and who is near sabotaged systems."]);

  const aliveAgents=agents.filter(a=>a.alive);
  const bodies=agents.filter(a=>!a.alive);
  const tasksDone=Object.values(tasks).filter(Boolean).length;
  const nearestAlive=aliveAgents.reduce<Agent|null>((best,a)=>!best||dist(pos.current,a.p)<dist(pos.current,best.p)?a:best,null);
  const nearbyBody=bodies.find(b=>!b.reported&&near(pos.current,b.p,115));
  const nearbyZone=ALL_ZONES.find(z=>near(pos.current,ZONES[z].p,125));
  const contextAction=nearbyBody?"REPORT "+nearbyBody.name:nearbyZone&&!tasks[nearbyZone]?(unstableTasks[nearbyZone]?"REPAIR · ":"PUZZLE · ")+ZONES[nearbyZone].name:!lights&&near(pos.current,ZONES.lamp.p,130)?"RESTORE LIGHTS":hatchPanic&&near(pos.current,ZONES.hatch.p,140)?"STABILIZE HATCH":"INTERACT";
  const currentZone=ALL_ZONES.find(z=>near(pos.current,ZONES[z].p,230))||null;

  function updateAgents(updater:(xs:Agent[])=>Agent[]){
    const next=updater(agentsRef.current);
    agentsRef.current=next;
    setAgents(next);
  }

  useEffect(()=>{agentsRef.current=agents;},[agents]);
  useEffect(()=>{tasksRef.current=tasks;},[tasks]);
  useEffect(()=>{sabotageRef.current=activeSabotage;},[activeSabotage]);
  useEffect(()=>{mimicCaughtRef.current=mimicCaught;},[mimicCaught]);

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    hatchAudio.current=createHatchAudio();
    void Promise.all([client.read(),createFriendReader().read(friendId)]).then(([s,sp])=>{setSnapshot(s);setSprites(sp);}).catch(()=>setMessage("Could not load your Friend."));
    const reader=createFriendReader();
    void Promise.allSettled(NPC_TOKEN_IDS.map(id=>reader.read(id))).then(results=>{
      const loaded:Record<string,GenerationSprites>={};
      results.forEach((r,i)=>{if(r.status==="fulfilled")loaded[String(NPC_TOKEN_IDS[i])]=r.value;});
      setNpcSprites(loaded);
    });
    return()=>{sound.current?.dispose();hatchAudio.current?.dispose();};
  },[client,friendId]);

  useEffect(()=>{
    hatchAudio.current?.set(settings,muted);
    sound.current?.setMuted(muted||settings.master===0||settings.sfx===0);
  },[settings,muted]);

  useEffect(()=>{
    if(phase==="title"||phase==="won"||phase==="lost"){setToastOpen(false);return;}
    setToastOpen(true);
    const t=setTimeout(()=>setToastOpen(false),3200);
    return()=>clearTimeout(t);
  },[message,phase]);

  useEffect(()=>{
    if((phase!=="play"&&phase!=="meeting")||!flashlightOn)return;
    const t=setInterval(()=>setFlashlightBattery(v=>{
      if(v<=.3){
        setFlashlightOn(false);
        setMessage("Flashlight battery depleted. Open the Night Market and use a Battery Pack.");
        return 0;
      }
      return Math.max(0,v-.3);
    }),250);
    return()=>clearInterval(t);
  },[phase,flashlightOn]);

  useEffect(()=>{
    if(phase!=="won"){setRewardDisplay(0);return;}
    const target=rfEarned;
    if(target<=0)return;
    let value=0;
    const t=setInterval(()=>{
      value=Math.min(target,value+.01);
      setRewardDisplay(Number(value.toFixed(2)));
      if(value>=target)clearInterval(t);
    },45);
    return()=>clearInterval(t);
  },[phase,rfEarned]);

  useEffect(()=>{
    if(!["role","play","meeting"].includes(phase))return;
    const tick=()=>{
      if(!roundDeadlineRef.current||roundEndedRef.current)return;
      const left=Math.max(0,Math.ceil((roundDeadlineRef.current-Date.now())/1000));
      setTimer(left);
      if(left<=0){
        const done=Object.values(tasksRef.current).every(Boolean);
        const caught=mimicCaughtRef.current;
        if(done&&caught)finish("won","Sunrise. Containment held and the Mimic was identified.");
        else if(!done&&!caught)finish("lost","06:00 — containment is incomplete and the Mimic is still hidden. The night is lost.");
        else if(!done)finish("lost","06:00 — the Mimic was found, but unfinished containment stations failed at sunrise.");
        else finish("lost","06:00 — every station is secure, but the Mimic is still among the Keepers.");
      }
    };
    tick();
    const id=window.setInterval(tick,250);
    const resume=()=>tick();
    window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);
    return()=>{window.clearInterval(id);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);};
  },[phase]);

  useEffect(()=>{
    if(!activeSabotage||roundEndedRef.current)return;
    const tick=()=>{
      const left=Math.max(0,Math.ceil((activeSabotage.deadlineAt-Date.now())/1000));
      setSabotageSeconds(left);
      if(left<=10&&left>0&&sabotageWarningPlayedRef.current!==activeSabotage.deadlineAt){
        sabotageWarningPlayedRef.current=activeSabotage.deadlineAt;
        hatchAudio.current?.sample("sabotage10s");
      }
      if(left<=0&&!roundEndedRef.current)finish("lost",activeSabotage.fatalText);
    };
    tick();
    const id=window.setInterval(tick,200);
    const resume=()=>tick();
    window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);
    return()=>{window.clearInterval(id);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);};
  },[activeSabotage]);

  useEffect(()=>{
    if(phase!=="play")return;
    const t=setInterval(()=>{setKillCooldown(v=>Math.max(0,v-1));setShiftCooldown(v=>Math.max(0,v-1));},1000);return()=>clearInterval(t);
  },[phase]);

  useEffect(()=>{
    const body=document.body;const prev=body.dataset.hatchMood;
    body.dataset.hatchMood=phase==="meeting"?"meeting":phase==="lost"?"failure":phase==="won"?"sunrise":!lights?"blackout":hatchPanic?"breach":"social";
    return()=>{if(prev===undefined)delete body.dataset.hatchMood;else body.dataset.hatchMood=prev;};
  },[phase,lights,hatchPanic]);

  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext("2d");if(!node||!ctx||!sprites)return;
    let raf=0,prev=0,frameNo=0;
    const kd=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);if(k==="e")interact();if(k==="r")reportBody();if(k==="f")toggleFlashlight();if(k==="g"&&phase==="play")setMenu("inventory");if(k==="m"&&phase==="play")setMenu(v=>v==="map"?null:"map");if(k==="escape")setMenu(v=>v?null:"settings");};
    const ku=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);

    const loop=(now:number)=>{
      const frameInterval=1000/settings.fps;
      if(now-lastFrameDraw.current<frameInterval*.88){raf=requestAnimationFrame(loop);return;}
      lastFrameDraw.current=now;
      frameNo++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;
      const p=pos.current,before={...p};

      if(phase==="play"&&!paused&&!menu){
        let dx=0,dy=0;if(keys.current.has("a")||keys.current.has("arrowleft"))dx--;if(keys.current.has("d")||keys.current.has("arrowright"))dx++;if(keys.current.has("w")||keys.current.has("arrowup"))dy--;if(keys.current.has("s")||keys.current.has("arrowdown"))dy++;
        if(dx||dy)destination.current=null;else if(destination.current){dx=destination.current.x-p.x;dy=destination.current.y-p.y;if(Math.hypot(dx,dy)<7){destination.current=null;dx=0;dy=0;}}
        if(dx||dy){const l=Math.hypot(dx,dy);moveWithCollision(p,dx/l*SPEED*dt,dy/l*SPEED*dt);facing.current=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");if(facing.current==="left"||facing.current==="right")side.current=facing.current;}

        // Keepers do visible chores, remember nearby Friends, and build believable alibis.
        const current=agentsRef.current;
        const moved=current.map((a,i)=>{
          if(!a.alive)return a;
          const isMimic=a.id==="mimic";
          const zoneOrder=ALL_ZONES;
          let choreIndex=a.choreIndex;
          let zone=zoneOrder[choreIndex%zoneOrder.length];
          let target=ZONES[zone].p;
          let workUntil=a.workUntil;
          let lastZone=a.lastZone;
          let lastAction=a.lastAction;
          let lastSeenName=a.lastSeenName,lastSeenZone=a.lastSeenZone,lastSeenAt=a.lastSeenAt;

          const nearby=current.filter(x=>x.alive&&x.id!==a.id&&dist(a.p,x.p)<235).sort((x,y)=>dist(a.p,x.p)-dist(a.p,y.p))[0];
          if(nearby){lastSeenName=nearby.name;lastSeenZone=zone;lastSeenAt=now;}

          // Mimic spends most of the round looking legitimate. Detours are short and context-aware.
          const detourWindow=Math.floor((now+i*613)/5200)%7;
          const detour=isMimic&&(detourWindow===3||detourWindow===6)&&workUntil===0;
          if(detour){
            const nearestInnocent=current.filter(x=>x.alive&&x.id!=="mimic").sort((x,y)=>dist(a.p,x.p)-dist(a.p,y.p))[0];
            const lure=nearestInnocent&&dist(a.p,nearestInnocent.p)>260?nearestInnocent.p:randPoint(Math.floor(now/1700)+i*41+PROFILE.seed);
            target={x:clamp(lure.x+((i%2)?110:-110),160,WORLD.width-160),y:clamp(lure.y+((i%3)-1)*100,160,WORLD.height-160)};
            lastAction="crossing the Garden between chores";
          }

          const atWork=near(a.p,target,48);
          if(atWork&&!detour){
            if(workUntil===0)workUntil=now+2400+(i%3)*850;
            if(now<workUntil)return {...a,target,workUntil,lastZone:zone,lastAction:"working at "+ZONES[zone].name,lastSeenName,lastSeenZone,lastSeenAt};
            choreIndex=(choreIndex+1)%zoneOrder.length;
            const finished=zoneOrder[(choreIndex+zoneOrder.length-1)%zoneOrder.length];
            zone=zoneOrder[choreIndex];target=ZONES[zone].p;workUntil=0;lastZone=finished;lastAction="finished "+ZONES[finished].name+" chore";
          }

          const vx=target.x-a.p.x,vy=target.y-a.p.y,d=Math.max(1,Math.hypot(vx,vy));
          const nextP=advanceAgent(a.p,vx/d*a.speed*dt,vy/d*a.speed*dt,i+a.choreIndex);
          return {...a,target,choreIndex,workUntil,lastZone,lastAction,lastSeenName,lastSeenZone,lastSeenAt,p:nextP};
        });
        agentsRef.current=moved;
        frameSync.current++;
        if(frameSync.current%8===0)setAgents([...moved]);

        // Hidden Mimic: patient, plausible, and not automatically exposed by evidence.
        if(role==="friend"){
          const currentAgents=agentsRef.current;
          const mimic=currentAgents.find(a=>a.id==="mimic");
          if(mimic?.alive){
            if(!sabotageRef.current&&Date.now()>=nextSabotageAtRef.current){
              const recent=new Set(sabotageHistoryRef.current);
              let pool=ALL_ZONES.filter(z=>!recent.has(z));
              if(!pool.length)pool=[...ALL_ZONES];
              const sabotageZone=choose(pool);
              triggerSabotage(sabotageZone);
              agentsRef.current=agentsRef.current.map(a=>a.alive&&dist(a.p,ZONES[sabotageZone].p)<280?{...a,suspicion:a.suspicion+.45}:a);
            }
            if(now-lastKill.current>12500){
              const victims=currentAgents.filter(a=>a.alive&&a.id!=="mimic"&&dist(a.p,mimic.p)<115);
              const victim=victims[0];
              if(victim){
                const witnesses=currentAgents.filter(a=>a.alive&&a.id!==mimic.id&&a.id!==victim.id&&dist(a.p,mimic.p)<235);
                if(witnesses.length===0){
                  lastKill.current=now;
                  const killZone=ALL_ZONES.reduce((best,z)=>dist(mimic.p,ZONES[z].p)<dist(mimic.p,ZONES[best].p)?z:best,ALL_ZONES[0]);
                  const next=currentAgents.map(a=>{
                    if(a.id===victim.id)return {...a,alive:false,reported:false,lastAction:"killed near "+ZONES[killZone].name};
                    if(a.id==="mimic"){
                      const escape=ALL_ZONES[(a.choreIndex+2)%ALL_ZONES.length];
                      return {...a,target:ZONES[escape].p,choreIndex:(a.choreIndex+2)%ALL_ZONES.length,lastZone:escape,lastAction:"claims to be heading to "+ZONES[escape].name};
                    }
                    return a;
                  });
                  const suspicious=next.map(a=>a.alive&&a.id!=="mimic"&&dist(a.p,victim.p)<320?{...a,suspicion:a.suspicion+.6}:a);
                  agentsRef.current=suspicious;setAgents(suspicious);
                  const decoys=suspicious.filter(a=>a.alive&&a.id!=="mimic"),decoy=decoys.length?choose(decoys):null;
                  const pair=decoy?shuffle([mimic.name,decoy.name],Math.floor(Math.random()*0x7fffffff)):[mimic.name,"another Keeper"];
                  const clue=choose([
                    "Wet route traces overlap between "+pair[0]+" and "+pair[1]+" near "+ZONES[killZone].name+".",
                    "The victim's final route ping narrows the scene to "+pair[0]+" or "+pair[1]+", but the timestamp is incomplete.",
                    "A lamp sensor registered two silhouettes leaving the sector: "+pair[0]+" and "+pair[1]+". It cannot tell which left first.",
                    "One set of footprints doubles back toward "+ZONES[killZone].name+". Both "+pair[0]+" and "+pair[1]+" used that path tonight."
                  ]);
                  setEvidence(prev=>[...prev.slice(-4),victim.name+" was found near "+ZONES[killZone].name+". No direct witness saw the attack.","Scene clue: "+clue]);
                  setRoundNotes(prev=>[...prev.slice(-8),victim.name+" went down near "+ZONES[killZone].name+"."]);
                  setMessage(victim.name+" is down. A Keeper may discover the body and call a meeting.");
                  if(settings.screenShake&&!settings.reducedMotion)shakeUntil.current=now+520;
                  sound.current?.play("impact");hatchAudio.current?.cue("danger");
                }
              }
            }

            // AI Keepers can discover and report bodies themselves.
            const corpse=agentsRef.current.find(a=>!a.alive&&!a.reported);
            const reporter=agentsRef.current.find(a=>a.alive&&a.id!=="mimic"&&corpse&&dist(a.p,corpse.p)<95);
            if(corpse&&reporter&&now-lastAutoReport.current>6000){
              lastAutoReport.current=now;
              updateAgents(xs=>xs.map(a=>a===corpse?{...a,reported:true}:a));
              openMeeting(reporter.name+" reported "+corpse.name+"'s body.");
            }
          }
        }
      }

      const zoom=settings.cameraZoom;
      const visibleW=VIEW.width/zoom,visibleH=VIEW.height/zoom;
      cam.current={x:Math.round(clamp(p.x-visibleW/2,0,WORLD.width-visibleW)),y:Math.round(clamp(p.y-visibleH/2,0,WORLD.height-visibleH))};
      const shaking=settings.screenShake&&!settings.reducedMotion&&now<shakeUntil.current;
      const shakeX=shaking?Math.sin(now*.11)*5:0,shakeY=shaking?Math.cos(now*.13)*4:0;
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cam.current.x+shakeX/zoom,-cam.current.y+shakeY/zoom);
      const renderAgents=agentsRef.current;
      drawWorld(ctx,settings.reducedMotion?0:now,lights,lightsFlickering,hatchPanic,[],settings.graphics);
      renderAgents.forEach(a=>{
        const sp=npcSprites[String(a.tokenId)];
        if(a.alive){if(sp)drawNpcFriend(ctx,sp,a,now);else drawKeeper(ctx,a,now);drawChoreEffect(ctx,a,now);}
        else if(a.lastAction!=="expelled by vote"){if(sp)drawDeadNpcFriend(ctx,sp,a,now);else drawDeadKeeper(ctx,a,now);}
      });
      ctx.restore();
      drawRainScreen(ctx,now,settings.graphics);

      // Screen-space mist and drifting particles.
      ctx.save();
      const particleCount=settings.graphics==="low"?6:settings.graphics==="medium"?12:settings.graphics==="high"?20:28;
      for(let i=0;i<particleCount;i++){
        const px=(i*137+(now*.012*(1+i%3)))%VIEW.width;
        const py=(i*89+(now*.006*(1+i%2)))%VIEW.height;
        ctx.fillStyle=i%5===0?"rgba(223,231,221,.08)":"rgba(174,191,176,.045)";
        ctx.fillRect(px,py,1+(i%2),1+(i%3));
      }
      const fogAlpha=(settings.fog/100)*.08;
      const fog1=ctx.createRadialGradient(160,540,20,160,540,280);fog1.addColorStop(0,"rgba(185,198,187,"+fogAlpha+")");fog1.addColorStop(1,"rgba(185,198,187,0)");ctx.fillStyle=fog1;ctx.fillRect(0,300,420,340);
      ctx.restore();

      // Lighting pass. Normal nights stay readable; a sabotaged grid becomes almost completely black.
      const sx=(p.x-cam.current.x)*zoom,sy=(p.y-cam.current.y)*zoom;
      if(lights){
        ctx.save();
        const flicker=lightsFlickering?(Math.sin(now*.055)>.1?.22:.64):.18;
        ctx.fillStyle="rgba(2,8,5,"+flicker+")";ctx.fillRect(0,0,VIEW.width,VIEW.height);
        const moon=ctx.createLinearGradient(0,0,VIEW.width,VIEW.height);moon.addColorStop(0,"rgba(174,196,187,.10)");moon.addColorStop(.55,"rgba(76,102,92,.02)");moon.addColorStop(1,"rgba(0,0,0,.10)");ctx.fillStyle=moon;ctx.fillRect(0,0,VIEW.width,VIEW.height);
        ctx.restore();
      }else{
        ctx.save();ctx.fillStyle="rgba(0,0,0,.965)";ctx.fillRect(0,0,VIEW.width,VIEW.height);ctx.restore();

        if(inventory.flashlight>0&&flashlightOn&&flashlightBattery>0){
          const dir=facing.current==="right"?0:facing.current==="left"?Math.PI:facing.current==="down"?Math.PI/2:-Math.PI/2;
          const length=430,spread=.42;
          ctx.save();
          ctx.beginPath();ctx.moveTo(sx,sy);ctx.arc(sx,sy,length,dir-spread,dir+spread);ctx.closePath();ctx.clip();
          ctx.scale(zoom,zoom);ctx.translate(-cam.current.x+shakeX/zoom,-cam.current.y+shakeY/zoom);
          drawWorld(ctx,settings.reducedMotion?0:now,false,false,hatchPanic,[],settings.graphics);
          renderAgents.forEach(a=>{const sp=npcSprites[String(a.tokenId)];if(a.alive){if(sp)drawNpcFriend(ctx,sp,a,now);else drawKeeper(ctx,a,now);drawChoreEffect(ctx,a,now);}else if(a.lastAction!=="expelled by vote"){if(sp)drawDeadNpcFriend(ctx,sp,a,now);else drawDeadKeeper(ctx,a,now);}});
          ctx.restore();

          ctx.save();ctx.beginPath();ctx.moveTo(sx,sy);ctx.arc(sx,sy,length,dir-spread,dir+spread);ctx.closePath();ctx.clip();
          const beam=ctx.createRadialGradient(sx,sy,8,sx+Math.cos(dir)*170,sy+Math.sin(dir)*170,length);
          beam.addColorStop(0,"rgba(255,246,211,.20)");beam.addColorStop(.58,"rgba(255,237,188,.08)");beam.addColorStop(1,"rgba(255,237,188,0)");
          ctx.fillStyle=beam;ctx.fillRect(0,0,VIEW.width,VIEW.height);ctx.restore();
        }

        // Rare eyes remain visible even when the environment is otherwise unreadable.
        const eyeCycle=now%12800;
        if(eyeCycle>9200&&eyeCycle<10150){
          const eyeTree=TREE_POINTS[Math.floor(now/12800)%TREE_POINTS.length],ex=(eyeTree.x-cam.current.x)*zoom,ey=(eyeTree.y-95-cam.current.y)*zoom;
          if(ex>-20&&ex<VIEW.width+20&&ey>-20&&ey<VIEW.height+20){
            const alpha=Math.sin(((eyeCycle-9200)/950)*Math.PI)*.92;
            ctx.save();ctx.fillStyle="rgba(226,235,195,"+alpha+")";ctx.shadowColor="rgba(218,232,184,.8)";ctx.shadowBlur=12;
            ctx.beginPath();ctx.ellipse(ex-7,ey,3.2,1.7,0,0,Math.PI*2);ctx.ellipse(ex+7,ey,3.2,1.7,0,0,Math.PI*2);ctx.fill();ctx.restore();
          }
        }
      }
      if(lights&&inventory.flashlight>0&&flashlightOn&&flashlightBattery>0){
        const dir=facing.current==="right"?0:facing.current==="left"?Math.PI:facing.current==="down"?Math.PI/2:-Math.PI/2;
        const length=360,spread=.36;
        ctx.save();ctx.globalCompositeOperation="screen";
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.arc(sx,sy,length,dir-spread,dir+spread);ctx.closePath();ctx.clip();
        const beam=ctx.createRadialGradient(sx,sy,5,sx+Math.cos(dir)*145,sy+Math.sin(dir)*145,length);
        beam.addColorStop(0,"rgba(255,249,220,.34)");beam.addColorStop(.45,"rgba(255,240,190,.18)");beam.addColorStop(1,"rgba(255,230,165,0)");
        ctx.fillStyle=beam;ctx.fillRect(0,0,VIEW.width,VIEW.height);ctx.restore();
      }
      ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cam.current.x+shakeX/zoom,-cam.current.y+shakeY/zoom);drawFriend(ctx,sprites,p,facing.current,dist(before,p)>.1,Math.floor(now/110)%8,side.current);ctx.restore();

      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku)};
  },[sprites,npcSprites,phase,paused,menu,role,lights,lightsFlickering,hatchPanic,inventory.flashlight,flashlightOn,settings]);

  function start(){
    void hatchAudio.current?.resume();
    const chosen:Role="friend";
    const emptyTasks:Record<ZoneKey,boolean>={lamp:false,pond:false,hatch:false,shrine:false,shed:false,ward:false};
    const seed=Math.floor(Math.random()*0x7fffffff);
    roundSeedRef.current=seed;puzzleTargetsRef.current=makePuzzleTargets(seed);
    roundEndedRef.current=false;roundDeadlineRef.current=Date.now()+ROUND_SECONDS*1000;
    lastKill.current=performance.now();lastAutoReport.current=0;
    nextSabotageAtRef.current=Date.now()+24000+Math.floor(Math.random()*15000);
    sabotageHistoryRef.current=[];sabotageRef.current=null;mimicCaughtRef.current=false;
    setRole(chosen);setPhase("role");setTimer(ROUND_SECONDS);setLights(true);setLightsFlickering(false);setHatchPanic(false);
    tasksRef.current=emptyTasks;setTasks(emptyTasks);setUnstableTasks(emptyTasks);setLastSabotagedZone(null);setActiveSabotage(null);setSabotageSeconds(0);setMimicCaught(false);setMilestone(null);
    setEmergencyLeft(1);setKillCooldown(12);setShiftCooldown(10);setDisguise(null);setVotes({});
    pos.current={...START};
    const bots=BOT_NAMES.map((name,i):Agent=>({id:"bot"+i,name,p:randPoint(seed+i*31+7),alive:true,color:["#526858","#6b5f52","#4b606a","#6a4f55","#596149"][i],target:ZONES[ALL_ZONES[i%ALL_ZONES.length]].p,speed:74+i*3,task:ALL_ZONES[i%ALL_ZONES.length],cooldown:0,suspicion:0,tokenId:NPC_TOKEN_IDS[i],choreIndex:i%ALL_ZONES.length,workUntil:0,lastZone:ALL_ZONES[i%ALL_ZONES.length],lastAction:"heading to "+ZONES[ALL_ZONES[i%ALL_ZONES.length]].name,personality:PERSONALITIES[i],reported:false,lastSeenName:null,lastSeenZone:ALL_ZONES[i%ALL_ZONES.length],lastSeenAt:0}));
    if(chosen==="friend"){const culprit=Math.floor(Math.random()*BOT_NAMES.length);bots[culprit]={...bots[culprit],id:"mimic"};}
    agentsRef.current=bots;setAgents(bots);
    setEvidence(["One of these five Friend Keepers is the Mimic. Evidence is intentionally incomplete — compare routes, timing and contradictions."]);
    setTestimony([]);setRoundNotes(["Night began. Five Keepers entered the Garden."]);setRfEarned(0);setRewardDisplay(0);setFlashlightOn(false);
    setInventory(v=>v.flashlight>0?v:{...v,flashlight:1});setFlashlightBattery(v=>v>0?v:30);
    setMessage("You are a FRIEND. Secure all six stations and identify the Mimic before sunrise. The clock never pauses.");
    setTimeout(()=>{if(!roundEndedRef.current){setPhase("play");if(!tutorialSeen){setTutorialStep(0);setMenu("tutorial");}}},2200);
  }

  function rerollPuzzle(zone:ZoneKey){
    const fresh=makePuzzleTargets((roundSeedRef.current+Date.now())>>>0),current=puzzleTargetsRef.current;
    if(zone==="lamp")puzzleTargetsRef.current={...current,lamp:fresh.lamp};
    else if(zone==="hatch")puzzleTargetsRef.current={...current,hatch:fresh.hatch};
    else if(zone==="pond")puzzleTargetsRef.current={...current,pond:fresh.pond};
    else if(zone==="shrine")puzzleTargetsRef.current={...current,shrine:fresh.shrine};
    else if(zone==="shed")puzzleTargetsRef.current={...current,fuse:fresh.fuse};
    else puzzleTargetsRef.current={...current,ward:fresh.ward};
  }

  function clearSabotage(zone:ZoneKey){
    const active=sabotageRef.current;
    if(!active||active.zone!==zone)return;
    sabotageRef.current=null;setActiveSabotage(null);setSabotageSeconds(0);setLastSabotagedZone(null);
    nextSabotageAtRef.current=Date.now()+22000+Math.floor(Math.random()*18000);
  }

  function triggerSabotage(zone:ZoneKey){
    if(sabotageRef.current||roundEndedRef.current||mimicCaughtRef.current)return;
    const meta=sabotageMeta(zone),now=Date.now();
    const active:ActiveSabotage={zone,kind:meta.kind,label:meta.label,startedAt:now,deadlineAt:now+meta.seconds*1000,fatalText:meta.fatalText};
    sabotageRef.current=active;sabotageWarningPlayedRef.current=0;setActiveSabotage(active);setSabotageSeconds(meta.seconds);setLastSabotagedZone(zone);
    void hatchAudio.current?.resume().then(()=>hatchAudio.current?.sample("sabotageHit"));
    const nextTasks={...tasksRef.current,[zone]:false};tasksRef.current=nextTasks;setTasks(nextTasks);
    setUnstableTasks(v=>({...v,[zone]:true}));rerollPuzzle(zone);
    sabotageHistoryRef.current=[...sabotageHistoryRef.current.slice(-1),zone];
    if(zone==="lamp"){
      setLightsFlickering(true);setMessage("GRID OVERLOAD — street lights are flickering. Repair Lamp Court before the relay explodes.");
      void hatchAudio.current?.resume().then(()=>hatchAudio.current?.sample("streetlightFlicker"));
      window.setTimeout(()=>{if(sabotageRef.current?.zone==="lamp"){setLightsFlickering(false);setLights(false);setMessage("BLACKOUT — visibility is nearly zero. Repair Lamp Court or use a flashlight.");}},2800);
    }else if(zone==="shed"){
      setLightsFlickering(true);setMessage("GENERATOR OVERLOAD — isolate the Tool Shed circuit before it blows.");
      window.setTimeout(()=>{if(sabotageRef.current?.zone==="shed")setLightsFlickering(false);},1100);
    }else if(zone==="hatch"){
      setHatchPanic(true);setMessage("HATCH BREACH — reseal Central Hatch before containment fails.");
    }else{
      setMessage(meta.label+" — "+ZONES[zone].name+" is unstable. Repair it before the countdown reaches zero.");
    }
    setEvidence(prev=>[...prev.slice(-4),"Sabotage log: "+ZONES[zone].name+" failed. More than one Keeper crossed that route, so the log is not a direct identification."]);
    setRoundNotes(prev=>[...prev.slice(-8),ZONES[zone].name+" sabotaged — "+meta.seconds+" seconds to repair."]);
    if(settings.screenShake&&!settings.reducedMotion)shakeUntil.current=performance.now()+500;
    sound.current?.play("impact");hatchAudio.current?.cue("danger");
  }

  function toggleFlashlight(){
    if(inventory.flashlight<=0||flashlightBattery<=0)return;
    void hatchAudio.current?.resume().then(()=>hatchAudio.current?.sample("flashlight"));
    setFlashlightOn(v=>!v);
  }

  function interact(){
    if(phase!=="play")return;
    if(role==="friend"){
      const zone=ALL_ZONES.find(z=>near(pos.current,ZONES[z].p,125));
      if(zone&&!tasks[zone]){openTaskPuzzle(zone);return;}
      if(!lights&&near(pos.current,ZONES.lamp.p,130)){setLights(true);setMessage("Lamp Court restored.");return;}
      if(hatchPanic&&near(pos.current,ZONES.hatch.p,140)){setHatchPanic(false);setMessage("Hatch sabotage contained.");return;}
      reportBody();
    }else{
      const target=nearestAlive;
      if(target&&near(pos.current,target.p,90)&&killCooldown===0){updateAgents(xs=>xs.map(a=>a.id===target.id?{...a,alive:false}:a));setKillCooldown(18);setMessage("No one saw "+target.name+" disappear.");sound.current?.play("impact");checkMimicWin();return;}
    }
  }

  function openTaskPuzzle(zone:ZoneKey){
    setActivePuzzle(zone);setPuzzleSequence([]);setMirrorAngles([0,0,0]);setShrineSymbols([]);setFuseChoice(null);setWardStones([false,false,false,false]);setPuzzleError("");setMenu("task");
  }

  function completeTask(zone:ZoneKey){
    const nextTasks={...tasksRef.current,[zone]:true};tasksRef.current=nextTasks;setTasks(nextTasks);
    setUnstableTasks(v=>({...v,[zone]:false}));clearSabotage(zone);setMenu(null);setActivePuzzle(null);
    const nextCount=Object.values(nextTasks).filter(Boolean).length,allDone=nextCount===ALL_ZONES.length;
    setRoundNotes(prev=>[...prev.slice(-8),"You completed "+ZONES[zone].name+"."]);
    sound.current?.play("reward");hatchAudio.current?.cue("task");
    if(zone==="lamp"){setLights(true);setLightsFlickering(false);}
    if(zone==="hatch")setHatchPanic(false);
    setMilestone(allDone?"ALL STATIONS SECURE":"TASK SECURED · "+ZONES[zone].name.toUpperCase());
    window.setTimeout(()=>setMilestone(null),2200);
    if(allDone&&mimicCaughtRef.current){finish("won","Containment complete. The Mimic was identified and every station is secure.");return;}
    if(allDone)setMessage("Containment complete — excellent work. One objective remains: identify the Mimic before sunrise.");
    else setMessage(ZONES[zone].name+" stabilized. "+nextCount+"/"+ALL_ZONES.length+" stations secure.");
  }

  function sequencePress(value:number){
    if(!activePuzzle)return;
    const target=activePuzzle==="lamp"?puzzleTargetsRef.current.lamp:puzzleTargetsRef.current.hatch;
    const nextIndex=puzzleSequence.length;
    if(value!==target[nextIndex]){setPuzzleSequence([]);setPuzzleError("The signal drops. Watch the diagnostic pulse and try the sequence again.");hatchAudio.current?.cue("danger");return;}
    const next=[...puzzleSequence,value];setPuzzleSequence(next);setPuzzleError("");
    if(next.length===target.length)completeTask(activePuzzle);
  }

  function checkPond(){
    const target=puzzleTargetsRef.current.pond;
    if(mirrorAngles.every((a,i)=>a===target[i]))completeTask("pond");
    else{setPuzzleError("The reflected beams still miss the seal. Read the faint target marks around the basin.");hatchAudio.current?.cue("danger");}
  }

  function symbolPress(symbol:string){
    const target=puzzleTargetsRef.current.shrine,next=[...shrineSymbols,symbol];
    if(symbol!==target[shrineSymbols.length]){setShrineSymbols([]);setPuzzleError("The candles gutter. Watch their pulse order before trying again.");hatchAudio.current?.cue("danger");return;}
    setShrineSymbols(next);setPuzzleError("");
    if(next.length===target.length)completeTask("shrine");
  }

  function installFuse(){
    if(fuseChoice===puzzleTargetsRef.current.fuse)completeTask("shed");
    else{setPuzzleError("The breaker trips. Re-read the load meter and choose the smallest fuse rated above the measured draw.");hatchAudio.current?.cue("danger");}
  }

  function checkWard(){
    const target=puzzleTargetsRef.current.ward;
    if(wardStones.every((v,i)=>v===target[i]))completeTask("ward");
    else{setPuzzleError("The stones answer with the wrong resonance. Match the weathered plaque's light/dark glyphs.");hatchAudio.current?.cue("danger");}
  }

  function reportBody(){
    if(phase!=="play")return;
    const body=agentsRef.current.find(b=>!b.alive&&!b.reported&&near(pos.current,b.p,115));
    if(body){updateAgents(xs=>xs.map(a=>a===body?{...a,reported:true}:a));openMeeting(body.name+" was found in the Garden.");return;}
    setMessage("No body nearby.");
  }

  function emergency(){
    if(phase!=="play"||emergencyLeft<=0)return;
    setEmergencyLeft(0);openMeeting("Emergency bell called at Lamp Court.");
  }

  function openMeeting(reason:string){
    const alive=agentsRef.current.filter(a=>a.alive),mimic=alive.find(a=>a.id==="mimic");
    const cadence=[
      "I stayed on the marked route unless the alarm forced me off it.",
      "I stopped once because I heard the relay buzzing.",
      "I crossed the center path, then returned to my station.",
      "I avoided the dark path and kept close to the lamps.",
      "I lost sight of everyone for a few seconds near the trees.",
      "I checked the map before heading back to my next chore.",
      "I heard footsteps behind me, but I never got a clean look.",
      "I saw movement near the path but couldn't tell which Friend it was."
    ];
    const honestOpeners:Record<Personality,string[]>={
      careful:["I kept track of my route.","I tried to remember the order of every stop.","I was checking who crossed my path."],
      nervous:["I was already nervous before the report.","The blackout threw me off.","I kept looking over my shoulder."],
      direct:["Here's exactly what I did.","My route was simple.","I'll keep this short."],
      quiet:["I stayed mostly alone.","I didn't talk to anyone.","I kept to the edge of the Garden."],
      watchful:["I watched the crossroads while I worked.","I paid attention to movement between stations.","I was watching the paths more than the task."]
    };
    const mimicOpeners=[
      "I was where I was supposed to be.",
      "I finished my route and only moved when the alarm started.",
      "I don't know why anyone would put me near the scene.",
      "I was working when everything went wrong.",
      "I can account for most of my route."
    ];
    const lines=alive.map(a=>{
      const recent=a.lastSeenName&&performance.now()-a.lastSeenAt<22000;
      const truthfulPlace=a.lastAction.includes("working")?a.lastAction:"I "+a.lastAction;
      if(a.id==="mimic"){
        const lieOptions=ALL_ZONES.filter(z=>z!==a.lastZone),lieZone=choose(lieOptions.length?lieOptions:ALL_ZONES);
        const suspects=alive.filter(x=>x.id!==a.id),blame=suspects.length?[...suspects].sort((x,y)=>y.suspicion-x.suspicion)[Math.floor(Math.random()*Math.min(2,suspects.length))]:null;
        return {name:a.name,text:choose(mimicOpeners)+" I was around "+ZONES[lieZone].name+". "+choose([
          blame?"I remember "+blame.name+" changing direction after the alarm.":"I didn't see anyone clearly.",
          blame?"If you're checking routes, ask "+blame.name+" why they crossed mine.":"The dark made the route impossible to read.",
          blame?blame.name+" was the last Friend I noticed nearby.":"I only heard footsteps.",
          "The lights changed while I was between stations."
        ])};
      }
      const memory=recent?choose([
        " I remember "+a.lastSeenName+" near "+ZONES[a.lastSeenZone].name+".",
        " The last Friend I clearly saw was "+a.lastSeenName+" around "+ZONES[a.lastSeenZone].name+".",
        " I crossed paths with "+a.lastSeenName+" near "+ZONES[a.lastSeenZone].name+", but that was before the report."
      ]):choose([
        " I don't have a clean visual on another Keeper.",
        " I was alone long enough that I can't give you a useful witness.",
        " I heard movement, but I can't honestly attach a name to it."
      ]);
      return {name:a.name,text:choose(honestOpeners[a.personality])+" "+truthfulPlace+"."+memory+" "+choose(cadence)};
    });
    if(mimic&&inventory.uv>0)lines.push({name:"UV Scanner",text:choose([
      "One recent route ping conflicts with one testimony, but the scanner cannot identify which speaker is wrong.",
      "UV residue shows that one Keeper doubled back through a station they did not mention.",
      "A partial trace disagrees with one alibi. The identity field is corrupted."
    ])});
    setTestimony(lines);setMeetingReason(reason);setMeetingStage("report");setSpeakerIndex(0);setPhase("meeting");setVotes({});
    setMessage("REPORT ALERT — read the statements at your own pace, then decide whether to vote or skip.");
    setRoundNotes(prev=>[...prev.slice(-8),reason]);sound.current?.play("select");hatchAudio.current?.cue("meeting");hatchAudio.current?.siren();
  }

  function vote(id:string){
    const candidates=agentsRef.current.filter(a=>a.alive),tally:Record<string,number>={[id]:1};
    for(const voter of candidates){
      if(Math.random()<.16)continue;
      const pool=candidates.filter(c=>c.id!==voter.id);if(!pool.length)continue;
      const ranked=[...pool].sort((a,b)=>{
        const memoryA=(voter.lastSeenName===a.name?1.1:0)+a.suspicion, memoryB=(voter.lastSeenName===b.name?1.1:0)+b.suspicion;
        const noiseA=((Number(a.tokenId%17n)+voter.choreIndex)%7)*.08,noiseB=((Number(b.tokenId%17n)+voter.choreIndex)%7)*.08;
        return (memoryB+noiseB)-(memoryA+noiseA);
      });
      let pick=ranked[0];
      if(voter.id==="mimic"){const innocents=ranked.filter(a=>a.id!=="mimic");pick=innocents[0]||pick;}
      else if(Math.random()<.32)pick=ranked[Math.min(ranked.length-1,1)];
      if(pick)tally[pick.id]=(tally[pick.id]||0)+1;
    }
    setVotes(tally);hatchAudio.current?.cue("vote");
    const ordered=Object.entries(tally).sort((a,b)=>b[1]-a[1]),top=ordered[0],second=ordered[1],tied=top&&second&&top[1]===second[1];
    const accused=!tied&&top?agentsRef.current.find(a=>a.id===top[0]):null;
    window.setTimeout(()=>{
      if(!accused){setMessage("Vote tied. Nobody was detained. The Mimic is still among the Keepers.");setRoundNotes(prev=>[...prev.slice(-8),"Meeting ended in a tie."]);setPhase("play");return;}
      if(role==="friend"&&accused.id==="mimic"){
        mimicCaughtRef.current=true;setMimicCaught(true);
        updateAgents(xs=>xs.map(a=>a.id==="mimic"?{...a,alive:false,reported:true,lastAction:"detained after the vote"}:a));
        setMilestone("MIMIC EXPOSED");window.setTimeout(()=>setMilestone(null),2500);
        const done=Object.values(tasksRef.current).every(Boolean);
        if(done&&!sabotageRef.current){finish("won",accused.name+" was the Mimic. All containment stations are secure.");return;}
        setMessage(accused.name+" was the Mimic. Correct vote — now finish every containment station before sunrise.");
        setRoundNotes(prev=>[...prev.slice(-8),accused.name+" was correctly identified as the Mimic."]);
        setPhase("play");return;
      }
      if(role==="mimic"&&accused.id==="mimic"){finish("lost","The Keepers identified you before the Hatch opened.");return;}
      setRoundNotes(prev=>[...prev.slice(-8),accused.name+" was accused, but the evidence was wrong."]);
      setEvidence(prev=>[...prev.slice(-4),"Vote result: "+accused.name+" was cleared. The Mimic is still among the Keepers."]);
      setMessage(accused.name+" was not the Mimic. Nothing ends — the Mimic is still among the Keepers.");
      setPhase("play");
    },950);
  }

  function sabotage(kind:"lights"|"hatch"){
    if(role!=="mimic"||phase!=="play"||shiftCooldown>0||sabotageRef.current)return;
    setShiftCooldown(12);triggerSabotage(kind==="lights"?"lamp":"hatch");
  }

  function shapeshift(){
    if(role!=="mimic"||shiftCooldown>0||!nearestAlive)return;
    setShiftCooldown(15);setDisguise(nearestAlive.name);setMessage("MASK SHIFT — you are copying "+nearestAlive.name+" for 8 seconds.");setTimeout(()=>setDisguise(null),8000);
  }

  function checkMimicWin(){
    setTimeout(()=>{
      const alive=agentsRef.current.filter(a=>a.alive).length;
      if(role==="mimic"&&alive<=2)finish("won","Only one Keeper remains. The Mimic owns the Garden.");
      if(role==="friend"&&alive<=2)finish("lost","The Mimic outnumbers the remaining Keepers.");
    },50);
  }

  function finish(result:"won"|"lost",text:string){
    if(roundEndedRef.current)return;roundEndedRef.current=true;setMenu(null);setFlashlightOn(false);
    if(result==="won"){const complete=Object.values(tasksRef.current).every(Boolean),reward=complete?.20:.15;setRfEarned(reward);text+=" Prototype economy reward: +"+reward.toFixed(2)+" RF (simulated).";}
    setRoundNotes(prev=>[...prev.slice(-8),result==="won"?"Both objectives completed before sunrise.":"The night ended in failure."]);
    setPhase(result);setMessage(text);sound.current?.play(result==="won"?"reward":"impact");hatchAudio.current?.cue(result==="won"?"win":"lose");
  }

  async function buyItem(kind:ShopKind,units:number){
    if(!snapshot||busy)return;setBusy(true);
    try{
      await client.buy(BigInt(units));
      const plays=await client.play(BigInt(units));
      for(const p of plays)await client.settle(p.id);
      setSnapshot(await client.read());
      setInventory(v=>({...v,[kind]:v[kind]+1}));
      setRfSpent(v=>v+units*.1);
      if(kind==="flashlight"){setFlashlightBattery(100);setFlashlightOn(true);}
      setMessage((kind==="flashlight"?"Flashlight":kind==="battery"?"Battery Pack":kind==="uv"?"UV Scanner":kind==="flare"?"Emergency Flare":"Ward")+" acquired. RF spend is tracked as the prototype token sink.");
    }catch(e){setMessage(e instanceof Error?e.message:"RF action failed.");}finally{setBusy(false);}
  }

  function useBattery(){
    if(inventory.battery<=0||phase!=="play")return;
    setInventory(v=>({...v,battery:v.battery-1}));setFlashlightBattery(100);setFlashlightOn(true);setMessage("Battery Pack installed. Flashlight charge restored to 100%.");
    hatchAudio.current?.cue("task");
  }

  function useFlare(){
    if(inventory.flare<=0||phase!=="play")return;
    setInventory(v=>({...v,flare:v.flare-1}));setLightsFlickering(false);setLights(true);
    setMessage("Emergency Flare burning — temporary light for 12 seconds. It does NOT repair the sabotaged circuit.");
    sound.current?.play("reward");
    window.setTimeout(()=>{if(sabotageRef.current?.zone==="lamp")setLights(false);},12000);
  }

  function useWard(){
    if(inventory.ward<=0||phase!=="play")return;
    if(sabotageRef.current?.zone!=="hatch"){setMessage("The Ward only cancels an active Central Hatch breach.");return;}
    setInventory(v=>({...v,ward:v.ward-1}));
    const nextTasks={...tasksRef.current,hatch:true};tasksRef.current=nextTasks;setTasks(nextTasks);setUnstableTasks(v=>({...v,hatch:false}));
    setHatchPanic(false);clearSabotage("hatch");setMessage("Containment Ward consumed — the Hatch breach is sealed instantly.");
    sound.current?.play("reward");
    if(Object.values(nextTasks).every(Boolean)&&mimicCaughtRef.current)finish("won","Containment complete. The Mimic was identified and every station is secure.");
  }

  const minute=Math.floor((ROUND_SECONDS-timer)/60);const clock=["12:00","1:00","2:00","3:00","4:00","5:00","6:00"][Math.min(6,minute)];
  const countdown=Math.floor(timer/60)+":"+String(timer%60).padStart(2,"0");
  const roleLabel=role==="friend"?"FRIEND":"MIMIC";

  const sectionStyle={"--game-brightness":String(settings.brightness),"--grain-opacity":String(settings.grain/100)} as CSSProperties;
  return <section style={sectionStyle} data-quality={settings.graphics} className={"deduction-game "+(!lights?"blackout ":"")+(hatchPanic?"breach ":"")+(settings.reducedMotion?" reduced-motion":"")}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="game-canvas" onPointerDown={e=>{
      if(phase!=="play"||paused||menu)return;const r=e.currentTarget.getBoundingClientRect();destination.current={x:cam.current.x+((e.clientX-r.left)*VIEW.width/r.width)/settings.cameraZoom,y:cam.current.y+((e.clientY-r.top)*VIEW.height/r.height)/settings.cameraZoom};
    }}/>
    {(phase==="play"||phase==="meeting")&&<div className={"round-clock-global "+(timer<=60?"urgent":"")}><span>ROUND CLOCK</span><b>{countdown}</b><small>never pauses</small></div>}
    {activeSabotage&&(phase==="play"||phase==="meeting")&&<div className={"sabotage-countdown sabotage-"+activeSabotage.kind}><span>ACTIVE SABOTAGE</span><b>{activeSabotage.label}</b><em>{ZONES[activeSabotage.zone].name} · {sabotageSeconds}s</em><small>Repair before zero or the round ends — meetings do not pause it.</small><i style={{width:Math.max(0,Math.min(100,(sabotageSeconds/Math.max(1,(activeSabotage.deadlineAt-activeSabotage.startedAt)/1000))*100))+"%"}}/></div>}

    {phase==="play"&&<>
      <div className="hud mission"><span>{roleLabel} // {clock} · {countdown} LEFT</span><b>{role==="friend"?"SECURE THE GARDEN + EXPOSE THE MIMIC":"BECOME ONE OF THEM"}</b><small>{role==="friend"?tasksDone+"/"+ALL_ZONES.length+" stations · "+(mimicCaught?"Mimic caught":"Mimic unknown"):aliveAgents.length+" Keepers remain"}</small></div>
      <div className={"hud statusbox "+(lastSabotagedZone?"danger":"")}><b>{lightsFlickering?"VOLTAGE FAILURE":lights?"LIGHTS ONLINE":"BLACKOUT"}</b><span>{lastSabotagedZone?ZONES[lastSabotagedZone].name+" · REDO REQUIRED":hatchPanic?"HATCH SABOTAGED":"Containment stable"}</span></div>
      {milestone&&<div className="milestone-pop"><b>{milestone}</b><span>{mimicCaughtRef.current&&Object.values(tasksRef.current).every(Boolean)?"Both objectives complete.":"Keep moving — the round clock is still running."}</span></div>}
      <div className="economy-hud"><b>{snapshot?.mode==="chain"?"FRIEND WALLET":"PREVIEW"} RF {formatRF(snapshot?.rfBalance)}</b><span>Spent {rfSpent.toFixed(2)} · Win +0.15–0.20* simulated</span></div>
      <div className="friend-badge"><b>FRIEND #{friendId.toString()}</b><span>{PROFILE.character} · {PROFILE.scenery} · {PROFILE.floor} · Gen {PROFILE.generation}</span></div>
      {currentZone&&<div className="zone-banner" key={currentZone}><b>{ZONES[currentZone].name.toUpperCase()}</b><span>{tasks[currentZone]?"SECURE":unstableTasks[currentZone]?"SABOTAGED · REPAIR REQUIRED":ZONES[currentZone].hint}</span></div>}
      <div className="utility-fabs"><button onClick={()=>setMenu("map")} aria-label="Map">MAP</button><button onClick={()=>{setTutorialStep(0);setMenu("tutorial");}} aria-label="How to play">?</button><button onClick={()=>setMenu("settings")} aria-label="Settings">⚙</button></div>
      {settings.hints&&role==="friend"&&<div className="hint-chip">{tasksDone<ALL_ZONES.length?"NEXT · "+ZONES[ALL_ZONES.find(z=>!tasks[z])||"hatch"].name:"Watch routes · compare testimony · eject the Mimic"}</div>}
      {role==="friend"&&<div className="task-list">{ALL_ZONES.map(z=><span key={z} className={tasks[z]?"done":unstableTasks[z]?"unstable":""}>{tasks[z]?"✓":unstableTasks[z]?"!":"□"} {ZONES[z].name}</span>)}</div>}
      <div className="minimap" onClick={()=>setMenu("map")} role="button" aria-label="Open Garden map"><b>GARDEN MAP · M</b><div className="mini-field">
        {ALL_ZONES.map(z=><i key={z} className={"mini-zone "+(tasks[z]?"done":unstableTasks[z]?"unstable":"")} style={{left:(ZONES[z].p.x/WORLD.width*100)+"%",top:(ZONES[z].p.y/WORLD.height*100)+"%"}} title={ZONES[z].name}/>)}
        <i className="mini-player" style={{left:(pos.current.x/WORLD.width*100)+"%",top:(pos.current.y/WORLD.height*100)+"%"}}/>
      </div></div>
      {inventory.flashlight>0&&<div className={"battery-meter "+(flashlightBattery<20?"low":"")}><span>FLASHLIGHT</span><div><i style={{width:flashlightBattery+"%"}}/></div><b>{Math.round(flashlightBattery)}%</b></div>}
      <div className="bottom-actions">
        <button className={contextAction!=="INTERACT"?"context-ready":""} onClick={interact}>{role==="mimic"?"KILL / USE":contextAction} <small>E</small></button>
        <button onClick={reportBody}>REPORT <small>R</small></button>
        <button disabled={emergencyLeft<=0} onClick={emergency}>MEETING {emergencyLeft}</button>
        <button onClick={()=>setMenu("inventory")}>SHOP <small>G</small></button><button onClick={()=>setMenu("map")}>MAP <small>M</small></button>{inventory.flashlight>0&&<button disabled={flashlightBattery<=0} onClick={toggleFlashlight}>LIGHT {flashlightOn?"ON":"OFF"} <small>F</small></button>}{inventory.battery>0&&<button onClick={useBattery}>BATTERY ×{inventory.battery}</button>}{inventory.flare>0&&<button onClick={useFlare}>FLARE ×{inventory.flare}</button>}{inventory.ward>0&&<button onClick={useWard}>WARD ×{inventory.ward}</button>}
      </div>
      {role==="mimic"&&<div className="mimic-actions"><button disabled={shiftCooldown>0} onClick={()=>sabotage("lights")}>CUT LIGHTS {shiftCooldown||""}</button><button disabled={shiftCooldown>0} onClick={()=>sabotage("hatch")}>HATCH SABOTAGE</button><button disabled={shiftCooldown>0||!nearestAlive} onClick={shapeshift}>MASK SHIFT</button><span>KILL CD {killCooldown}s {disguise?"· AS "+disguise:""}</span></div>}
      {toastOpen&&<div className="message toast-message">{message}</div>}
    </>}

    {phase==="title"&&<div className="overlay"><div className="title-card"><span>RARE FRIENDS SOCIAL HORROR · FRIEND #{friendId.toString()}</span><h1>THE HATCH</h1><p>One of the Keepers is a hidden Mimic. It will kill the team unless you identify it in a meeting.</p><div className="pitch"><b>MASK</b><span>The Mimic can copy identities.</span><b>GARDEN</b><span>A realistic night map built around your NFT.</span><b>HATCH</b><span>Keep it sealed until sunrise.</span></div><button onClick={start}>START DEDUCTION NIGHT</button><button onClick={()=>{setTutorialStep(0);setMenu("tutorial");}}>HOW TO PLAY</button><button onClick={()=>setMenu("settings")}>SETTINGS</button><small>WASD / arrows · E use · R report · F light · M map · G shop</small></div></div>}

    {phase==="role"&&<div className={"overlay role-card "+role}><div><span>YOUR ROLE</span><h1>{role==="friend"?"FRIEND":"THE MIMIC"}</h1><p>{message}</p></div></div>}

    {phase==="meeting"&&<div className={"overlay meeting meeting-"+meetingStage}>
      {meetingStage==="report"&&<div className="report-cinematic"><div className="siren-wash"><i/><i/></div><div className="report-pulse"/><span>REPORT ALERT</span><h2>{meetingReason}</h2><p>All surviving Keepers are being called in. The round timer and any sabotage countdown are still running.</p><b className="meeting-clock">{countdown} REMAINING</b><button className="begin-statements" onClick={()=>{setSpeakerIndex(0);setMeetingStage("testimony");}}>BEGIN STATEMENTS</button></div>}
      {meetingStage==="testimony"&&testimony[speakerIndex]&&<div className="speaker-cinematic" key={speakerIndex}>
        <div className="speaker-camera"><div className="camera-scan"/><small>KEEPER STATEMENT {speakerIndex+1}/{testimony.length}</small>{(()=>{const speaker=agents.find(a=>a.name===testimony[speakerIndex].name);return speaker?<FriendPortrait sprites={npcSprites[String(speaker.tokenId)]} name={speaker.name}/>:<div className="speaker-silhouette">{testimony[speakerIndex].name==="UV Scanner"?"UV":testimony[speakerIndex].name.slice(0,1)}</div>;})()}<b>{testimony[speakerIndex].name}</b>{agents.find(a=>a.name===testimony[speakerIndex].name)&&<em>Friend #{agents.find(a=>a.name===testimony[speakerIndex].name)?.tokenId.toString()}</em>}</div>
        <div className="speaker-dialogue"><span>LIVE TESTIMONY</span><p>“{testimony[speakerIndex].text}”</p><div className="speech-wave">{Array.from({length:18},(_,i)=><i key={i} style={{height:(6+((i*13+speakerIndex*7)%22))+"px"}}/>)}</div></div>
        <div className="cinematic-controls">{speakerIndex<testimony.length-1?<button onClick={()=>setSpeakerIndex(v=>Math.min(testimony.length-1,v+1))}>NEXT STATEMENT</button>:<button onClick={()=>setMeetingStage("vote")}>PROCEED TO VOTE</button>}<button onClick={()=>setMeetingStage("vote")}>SKIP TO VOTE</button></div>
      </div>}
      {meetingStage==="vote"&&<div className="meeting-card"><span>GARDEN MEETING · {countdown} LEFT</span><h2>{meetingReason}</h2><p>Who doesn't belong here? Evidence narrows possibilities, but never names the killer for you.</p><div className="meeting-guide"><span>1 · READ REPORTS</span><span>2 · CHECK EVIDENCE</span><span>3 · VOTE OR SKIP</span></div><div className="testimony"><b>KEEPER REPORTS</b>{testimony.map((t,i)=><div key={i}><strong>{t.name}</strong><span>{t.text}</span></div>)}</div><div className="evidence"><b>SYSTEM EVIDENCE</b>{evidence.map((e,i)=><span key={i}>• {e}</span>)}</div><div className="vote-grid">{agents.filter(a=>a.alive).map(a=><button key={a.id} onClick={()=>vote(a.id)}><b>{a.name}</b><small>{votes[a.id]?votes[a.id]+" votes":"VOTE"}</small></button>)}</div><button className="skip" onClick={()=>{setMessage("No one was ejected. The Mimic is still among the Keepers.");setPhase("play");}}>SKIP VOTE</button></div>}
    </div>}

    {(phase==="won"||phase==="lost")&&<div className={"overlay end-overlay "+phase}>{phase==="won"&&<><div className="sunrise-rays"/><div className="victory-particles">{Array.from({length:18},(_,i)=><i key={i} style={{left:(8+(i*17)%88)+"%",animationDelay:(i*.08)+"s"}}/> )}</div></>}<div className={"end-card "+phase}><span>{phase==="won"?"NIGHT SURVIVED":"CONTAINMENT FAILED"}</span><h1>{phase==="won"?"SUNRISE":"REPLACED"}</h1>{phase==="won"&&<div className="reward-pop"><small>SIMULATED RF REWARD</small><b>+{rewardDisplay.toFixed(2)} RF</b><em>Containment payout concept · no live reward distribution</em></div>}<p>{message}</p><div className="ledger"><span>Role {roleLabel}</span><span>Tasks {tasksDone}/{ALL_ZONES.length}</span><span>RF spent {rfSpent.toFixed(2)}</span><span>RF earned {rfEarned.toFixed(2)}*</span><span>Mimic {agents.find(a=>a.id==="mimic")?.name||"Unknown"}</span><span>*MVP reward simulated</span></div><div className="round-recap"><b>NIGHT LOG</b>{roundNotes.slice(-5).map((n,i)=><span key={i}>• {n}</span>)}</div><button onClick={start}>PLAY AGAIN</button></div></div>}

    {menu==="task"&&activePuzzle&&<div className="task-overlay" role="dialog" aria-modal="true" aria-label={ZONES[activePuzzle].name+" task"}><div className={"task-puzzle task-"+activePuzzle}>
      <div className="task-puzzle-head"><div><span>CONTAINMENT TASK</span><h2>{ZONES[activePuzzle].name}</h2><p>{ZONES[activePuzzle].hint}</p></div><button onClick={()=>{setMenu(null);setActivePuzzle(null);}}>×</button></div>
      {unstableTasks[activePuzzle]&&<div className="sabotage-warning">SABOTAGED · THIS STATION WAS PREVIOUSLY SECURE. COMPLETE THE PUZZLE AGAIN.</div>}
      {activePuzzle==="lamp"&&<div className="circuit-puzzle"><div className="puzzle-instructions"><b>RESTORE THE CIRCUIT</b><span>The diagnostic LEDs pulse the safe relay order. Watch once, remember it, then reproduce the sequence before the overload timer expires.</span></div><div className="circuit-board diagnostic">{[1,2,3,4].map(n=><button key={n} style={{"--pulse-delay":(puzzleTargetsRef.current.lamp.indexOf(n)*.55)+"s"} as CSSProperties} className={(puzzleSequence.includes(n)?"used ":"")+"pulse-clue"} onClick={()=>sequencePress(n)}><i/><b>{n}</b></button>)}</div><div className="sequence-readout">{puzzleSequence.length?puzzleSequence.join(" → "):"WATCH THE RELAY PULSE"}</div></div>}
      {activePuzzle==="pond"&&<div className="pond-puzzle"><div className="puzzle-instructions"><b>ALIGN THE MOON REFLECTION</b><span>The stone rim carries three faint direction marks. Match the mirrors to those marks; the water itself is your feedback.</span></div><div className="moon-disc"/><div className="mirror-row">{mirrorAngles.map((a,i)=><button key={i} onClick={()=>setMirrorAngles(v=>v.map((x,j)=>j===i?(x+1)%4:x))}><span>MIRROR {i+1}</span><b>{["↑","→","↓","←"][a]}</b><i style={{transform:"rotate("+(a*90)+"deg)"}}/></button>)}</div><div className="pond-target visual">{puzzleTargetsRef.current.pond.map((a,i)=><i key={i}>{["↑","→","↓","←"][a]}</i>)}</div><button className="solve-task" onClick={checkPond}>TEST REFLECTION</button></div>}
      {activePuzzle==="hatch"&&<div className="hatch-puzzle"><div className="puzzle-instructions"><b>LOCK THE CONTAINMENT BOLTS</b><span>The bolt heads flash their safe order for a moment. Memorize the glints and lock them before the seal gives way.</span></div><div className="bolt-ring diagnostic">{[{n:1,l:"N"},{n:2,l:"E"},{n:3,l:"S"},{n:4,l:"W"}].map(x=><button key={x.n} style={{"--pulse-delay":(puzzleTargetsRef.current.hatch.indexOf(x.n)*.55)+"s"} as CSSProperties} className={(puzzleSequence.includes(x.n)?"locked ":"")+"pulse-clue"} onClick={()=>sequencePress(x.n)}>{x.l}</button>)}<i>HATCH</i></div><div className="sequence-readout">{puzzleSequence.length?puzzleSequence.map(n=>["","N","E","S","W"][n]).join(" → "):"WATCH THE BOLT GLINTS"}</div></div>}
      {activePuzzle==="shrine"&&<div className="shrine-puzzle"><div className="puzzle-instructions"><b>ARRANGE THE OFFERING</b><span>The four candles flare in ritual order. Watch the light, then repeat the symbols without breaking the sequence.</span></div><div className="symbol-row diagnostic">{["MOON","MASK","SEED","HATCH"].map(symbol=><button key={symbol} style={{"--pulse-delay":(puzzleTargetsRef.current.shrine.indexOf(symbol)*.55)+"s"} as CSSProperties} className="pulse-clue" onClick={()=>symbolPress(symbol)}>{symbol}</button>)}</div><div className="altar-slots">{[0,1,2,3].map(i=><i key={i}>{shrineSymbols[i]||"·"}</i>)}</div></div>}
      {activePuzzle==="shed"&&<div className="shed-puzzle"><div className="puzzle-instructions"><b>ISOLATE THE SERVICE CIRCUIT</b><span>Load meter reads {Math.max(8,puzzleTargetsRef.current.fuse-3)}A. Choose the smallest fuse rated safely above that draw. A wrong fuse trips the breaker.</span></div><div className="load-meter"><i style={{width:(puzzleTargetsRef.current.fuse/30*100)+"%"}}/><b>{Math.max(8,puzzleTargetsRef.current.fuse-3)}A LIVE LOAD</b></div><div className="fuse-row">{[15,20,30].map(n=><button key={n} className={fuseChoice===n?"selected":""} onClick={()=>setFuseChoice(n)}><i/><b>{n}A</b></button>)}</div><button className="solve-task" disabled={fuseChoice===null} onClick={installFuse}>ISOLATE + INSTALL</button></div>}
      {activePuzzle==="ward"&&<div className="ward-puzzle"><div className="puzzle-instructions"><b>RE-ANCHOR THE BOUNDARY</b><span>The weathered plaque shows light and dark glyphs. Recreate that pattern on the four memorial stones.</span></div><div className="ward-plaque">{puzzleTargetsRef.current.ward.map((on,i)=><i key={i} className={on?"lit":""}>{["I","II","III","IV"][i]}</i>)}</div><div className="ward-stones">{wardStones.map((on,i)=><button key={i} className={on?"on":""} onClick={()=>setWardStones(v=>v.map((x,j)=>j===i?!x:x))}><i/><b>{["I","II","III","IV"][i]}</b></button>)}</div><button className="solve-task" onClick={checkWard}>TEST BOUNDARY</button></div>}
      {puzzleError&&<div className="puzzle-error">{puzzleError}</div>}
      <div className="task-puzzle-foot"><span>Tasks require attention — sabotage can destabilize a completed station.</span><button onClick={()=>{setMenu(null);setActivePuzzle(null);}}>LEAVE TASK</button></div>
    </div></div>}

    {menu==="inventory"&&<div className="shop-overlay" role="dialog" aria-modal="true" aria-label="RF Night Market"><section className="night-market">
      <header className="market-head"><div><span>GARDEN SUPPLY TERMINAL · MVP ECONOMY</span><h2>RF NIGHT MARKET</h2><p>Optional gear only. The deduction round can be completed without purchases.</p></div><button onClick={()=>setMenu(null)}>×</button></header>
      <div className="market-wallet"><div><small>{snapshot?.mode==="chain"?"FRIEND WALLET":"LOCAL PREVIEW"}</small><b>{formatRF(snapshot?.rfBalance)} RF</b></div><div><small>ROUND SPEND</small><b>{rfSpent.toFixed(2)} RF</b></div><div><small>WIN CONCEPT</small><b>+0.15–0.20 RF*</b></div></div>
      {activeSabotage&&<div className="market-danger"><b>{activeSabotage.label}</b><span>{ZONES[activeSabotage.zone].name} fails in {sabotageSeconds}s — shopping does not pause it.</span></div>}
      <div className="market-note"><b>HOW IT WORKS</b><span>Buy gear → return to the Garden → use its HUD action. Every Keeper starts with a weak 30% emergency flashlight charge; Night Market batteries and replacements extend it. Active sabotage timers keep running while this shop is open.</span></div>
      <div className="market-grid">{SHOP_ITEMS.map(item=><button key={item.kind} className="market-item" disabled={busy} onClick={()=>void buyItem(item.kind,item.units)}>
        <i>{item.icon}</i><div><small>{item.use}</small><b>{item.name}</b><p>{item.desc}</p></div><strong>{item.price}</strong>
      </button>)}</div>
      <footer className="market-inventory"><span>LIGHT ×{inventory.flashlight}</span><span>BATTERY ×{inventory.battery}</span><span>UV ×{inventory.uv}</span><span>FLARE ×{inventory.flare}</span><span>WARD ×{inventory.ward}</span><span>CHARGE {Math.round(flashlightBattery)}%</span><em>* simulated MVP reward/sink concept</em></footer>
    </section></div>}

    {menu==="map"&&<div className="map-overlay" role="dialog" aria-modal="true" aria-label="Garden map"><div className="map-panel">
      <div className="map-head"><div><span>GARDEN UNIT 06</span><h2>FIELD MAP</h2></div><button onClick={()=>setMenu(null)}>×</button></div>
      <p>Core chores are marked with diamonds. Explore named landmarks to learn routes and catch contradictions. Keepers are intentionally hidden from the map.</p>
      <div className="full-map-field">
        <svg className="map-routes" viewBox="0 0 3000 2100" preserveAspectRatio="none" aria-hidden="true"><path d="M1500 1870 L1510 1040 L620 920 M1510 1040 L2380 1280 M1510 1040 L2360 430 M620 920 L430 1640 M2360 430 L1730 360 M2380 1280 L2440 1690"/><ellipse cx="2380" cy="1280" rx="210" ry="120"/><circle cx="720" cy="350" r="145"/></svg>
        {ALL_ZONES.map(z=><div key={z} className={"map-marker zone "+(tasks[z]?"done":unstableTasks[z]?"unstable":"")} style={{left:(ZONES[z].p.x/WORLD.width*100)+"%",top:(ZONES[z].p.y/WORLD.height*100)+"%"}}><i/><span>{ZONES[z].name}{tasks[z]?" ✓":unstableTasks[z]?" · SABOTAGED":""}</span></div>)}
        {LANDMARKS.map(l=><div key={l.name} className="map-marker landmark" style={{left:(l.p.x/WORLD.width*100)+"%",top:(l.p.y/WORLD.height*100)+"%"}}><i/><span>{l.name}</span></div>)}
        <div className="map-marker player" style={{left:(pos.current.x/WORLD.width*100)+"%",top:(pos.current.y/WORLD.height*100)+"%"}}><i/><span>YOU</span></div>
      </div>
      <div className="map-legend"><span><i className="you"/>You</span><span><i className="task"/>Chore</span><span><i className="place"/>Landmark</span></div>
      <button className="map-close" onClick={()=>setMenu(null)}>RETURN TO GARDEN · M</button>
    </div></div>}

    {menu==="tutorial"&&<div className="tutorial-overlay field-manual-overlay" role="dialog" aria-modal="true" aria-label="Keeper field manual">
      <div className="field-manual" key={tutorialStep}>
        <header className="manual-header"><div><span>KEEPER FIELD MANUAL</span><b>GARDEN UNIT 06 · NIGHT PROTOCOL</b></div><em>FRIEND #{friendId.toString()}</em><button onClick={()=>{setTutorialSeen(true);setMenu(null);}} aria-label="Close field manual">×</button></header>
        <aside className="manual-index">{TUTORIAL_STEPS.map((step,i)=><button key={step.title} className={i===tutorialStep?"active":i<tutorialStep?"done":""} onClick={()=>setTutorialStep(i)}><i>{String(i+1).padStart(2,"0")}</i><span>{step.title}</span></button>)}</aside>
        <main className="manual-page">
          <div className="manual-kicker"><span>{TUTORIAL_STEPS[tutorialStep].eyebrow}</span><em>{tutorialStep+1} / {TUTORIAL_STEPS.length}</em></div>
          <h2>{TUTORIAL_STEPS[tutorialStep].title}</h2>
          <p>{TUTORIAL_STEPS[tutorialStep].body}</p>
          <TutorialScene step={tutorialStep} sprites={sprites} friendId={friendId}/>
          <div className="manual-control"><span>CONTROL</span><kbd>{TUTORIAL_STEPS[tutorialStep].key}</kbd></div>
          <footer className="manual-actions"><button disabled={tutorialStep===0} onClick={()=>setTutorialStep(v=>Math.max(0,v-1))}>← PREVIOUS</button><span>Page {String(tutorialStep+1).padStart(2,"0")}</span>{tutorialStep<TUTORIAL_STEPS.length-1?<button className="primary" onClick={()=>{hatchAudio.current?.sample("pageFlip");setTutorialStep(v=>Math.min(TUTORIAL_STEPS.length-1,v+1));}}>NEXT PAGE →</button>:<button className="primary" onClick={()=>{setTutorialSeen(true);setMenu(null);setMessage("Field manual closed. Survive the night.");}}>ENTER GARDEN →</button>}</footer>
        </main>
      </div>
    </div>}

    {menu==="settings"&&<div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <aside className="settings-panel">
        <div className="settings-head"><div><span>GARDEN CONTROL</span><h2>SETTINGS</h2></div><button onClick={()=>setMenu(null)} aria-label="Close settings">×</button></div>
        <nav className="settings-tabs">{(["graphics","audio","gameplay"] as SettingsTab[]).map(tab=><button key={tab} className={settingsTab===tab?"active":""} onClick={()=>setSettingsTab(tab)}>{tab}</button>)}</nav>

        {settingsTab==="graphics"&&<div className="settings-page">
          <label><span>Graphics preset <b>{settings.graphics.toUpperCase()}</b></span><select value={settings.graphics} onChange={e=>setSettings(v=>({...v,graphics:e.target.value as GameSettings["graphics"]}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="ultra">Ultra</option></select></label>
          <label><span>FPS cap <b>{settings.fps}</b></span><select value={settings.fps} onChange={e=>setSettings(v=>({...v,fps:Number(e.target.value) as GameSettings["fps"]}))}><option value="30">30 FPS</option><option value="60">60 FPS</option><option value="120">120 FPS</option></select></label>
          <label><span>Camera zoom <b>{settings.cameraZoom.toFixed(2)}×</b></span><input type="range" min="0.85" max="1.25" step="0.05" value={settings.cameraZoom} onChange={e=>setSettings(v=>({...v,cameraZoom:Number(e.target.value)}))}/></label>
          <label><span>Brightness <b>{Math.round(settings.brightness*100)}%</b></span><input type="range" min="0.78" max="1.25" step="0.01" value={settings.brightness} onChange={e=>setSettings(v=>({...v,brightness:Number(e.target.value)}))}/></label>
          <label><span>Fog density <b>{settings.fog}%</b></span><input type="range" min="0" max="100" value={settings.fog} onChange={e=>setSettings(v=>({...v,fog:Number(e.target.value)}))}/></label>
          <label><span>Film grain <b>{settings.grain}%</b></span><input type="range" min="0" max="55" value={settings.grain} onChange={e=>setSettings(v=>({...v,grain:Number(e.target.value)}))}/></label>
          <div className="toggle-row"><span>Screen shake<small>Sabotage and report impact</small></span><button className={settings.screenShake?"on":""} onClick={()=>setSettings(v=>({...v,screenShake:!v.screenShake}))}>{settings.screenShake?"ON":"OFF"}</button></div>
          <div className="toggle-row"><span>Reduced motion<small>Stops sway, shake and UI drift</small></span><button className={settings.reducedMotion?"on":""} onClick={()=>setSettings(v=>({...v,reducedMotion:!v.reducedMotion}))}>{settings.reducedMotion?"ON":"OFF"}</button></div>
        </div>}

        {settingsTab==="audio"&&<div className="settings-page">
          <div className="toggle-row"><span>Mute all<small>FriendSDK + procedural ambience</small></span><button className={muted?"on":""} onClick={()=>{setMuted(v=>!v);void hatchAudio.current?.resume();}}>{muted?"MUTED":"LIVE"}</button></div>
          {([["master","Master"],["music","Music"],["ambience","Ambience"],["sfx","SFX"]] as const).map(([key,label])=><label key={key}><span>{label} <b>{settings[key]}%</b></span><input type="range" min="0" max="100" value={settings[key]} onChange={e=>{void hatchAudio.current?.resume();setSettings(v=>({...v,[key]:Number(e.target.value)}));}}/></label>)}
          <p className="settings-note">Audio starts after a user gesture. The low Garden drone is synthesized in-browser; no external music file is required.</p>
        </div>}

        {settingsTab==="gameplay"&&<div className="settings-page">
          <div className="toggle-row"><span>Objective hints<small>Shows the next chore until containment is complete</small></span><button className={settings.hints?"on":""} onClick={()=>setSettings(v=>({...v,hints:!v.hints}))}>{settings.hints?"ON":"OFF"}</button></div>
          <div className="control-grid"><span>Move</span><b>WASD / Arrows / Tap</b><span>Interact</span><b>E</b><span>Report</span><b>R</b><span>Flashlight</span><b>F</b><span>Full map</span><b>M</b><span>Night Market</span><b>G</b><span>Settings</span><b>Esc</b></div>
          <button className="reset-settings" onClick={()=>{setTutorialStep(0);setMenu("tutorial");}}>REPLAY HOW TO PLAY</button>
          <button className="reset-settings" onClick={()=>setSettings(DEFAULT_SETTINGS)}>RESET TO COMPETITIVE DEFAULTS</button>
          <p className="settings-note">The base deduction game stays playable without buying RF gear. Shop costs and victory rewards are simulated MVP economy concepts.</p>
        </div>}
      </aside>
    </div>}
  </section>;
}
