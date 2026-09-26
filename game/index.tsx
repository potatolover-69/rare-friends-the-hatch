"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Point = { x:number; y:number };
type Menu = "store"|"inventory"|"settings"|null;
type Act = 0|1|2|3|4|5|6|7;

const VIEW={width:960,height:640};
const WORLD={width:2200,height:1450};
const START:Point={x:1080,y:1230};
const SPEED=250;
const PROFILE={token:"334137",character:"Mask",scenery:"Garden",floor:"Hatch",generation:6,seed:334137};

const Z={
  gate:{x:1080,y:1260},
  lamp:{x:480,y:500},
  shed:{x:320,y:1120},
  hatch:{x:1080,y:720},
  pond:{x:1640,y:820},
  grove:{x:1380,y:330},
  shrine:{x:1750,y:420},
};

const ITEMS=[
  {key:"ward",name:"Ward",cost:0.1,desc:"Highlights your current objective."},
  {key:"chalk",name:"Chalk Seal",cost:0.2,desc:"Adds one free seal during the Hatch act."},
  {key:"bell",name:"Bell",cost:0.4,desc:"Breaks one Mimic chase."},
  {key:"fuse",name:"Emergency Fuse",cost:0.5,desc:"Instantly restores the Lamp Court."},
  {key:"mirror",name:"Mirror Shard",cost:0.7,desc:"Reveals the false Friend in the identity act."},
] as const;

const trees:Point[]=[
  {x:230,y:260},{x:520,y:240},{x:810,y:260},{x:1260,y:220},{x:1510,y:250},{x:1860,y:290},
  {x:250,y:790},{x:520,y:960},{x:780,y:1080},{x:1440,y:1130},{x:1770,y:1050},{x:2010,y:760},
  {x:1240,y:360},{x:1450,y:360},
];

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

function drawFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,p:Point,facing:SpriteFacing,walking:boolean,frame:number,side:"left"|"right",alpha=1){
  const rows=spriteFrame(sprites,facing,walking,frame,side).frame.rows;
  const scale=5,left=Math.round(p.x)-40,top=Math.round(p.y)-80;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#e3eadf";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale-2,top+y*scale-2,scale+4,scale+4)}));
  ctx.fillStyle="#030403";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  ctx.restore();
}

function drawWorld(ctx:CanvasRenderingContext2D,act:Act,power:boolean,shift:number,seals:number,carried:boolean){
  const dark=act>=4;
  ctx.fillStyle=dark?"#050705":"#0d120e";ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.fillStyle="#182018";ctx.fillRect(80,90,WORLD.width-160,WORLD.height-170);
  ctx.strokeStyle="#394438";ctx.lineWidth=8;ctx.strokeRect(80,90,WORLD.width-160,WORLD.height-170);

  ctx.strokeStyle=shift%2?"#343b32":"#475044";ctx.lineWidth=86;ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(Z.gate.x,Z.gate.y);ctx.lineTo(Z.hatch.x,Z.hatch.y);
  ctx.moveTo(Z.hatch.x,Z.hatch.y);ctx.lineTo(Z.lamp.x,Z.lamp.y);
  ctx.moveTo(Z.hatch.x,Z.hatch.y);ctx.lineTo(Z.pond.x,Z.pond.y);
  ctx.moveTo(Z.hatch.x,Z.hatch.y);ctx.lineTo(Z.grove.x,Z.grove.y);
  if(shift%3!==1)ctx.moveTo(Z.pond.x,Z.pond.y),ctx.lineTo(Z.shrine.x,Z.shrine.y);
  if(shift%3!==2)ctx.moveTo(Z.lamp.x,Z.lamp.y),ctx.lineTo(Z.shed.x,Z.shed.y);
  ctx.stroke();

  for(let i=0;i<trees.length;i++){
    let p=trees[i];
    if(act===3&&i%4===0)p={x:p.x+(shift%2?120:-80),y:p.y+(shift%3===0?80:-60)};
    ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle="#101510";ctx.fillRect(-13,-70,26,84);ctx.fillStyle=dark?"#0a0d0a":"#222a21";ctx.fillRect(-55,-125,110,55);ctx.fillRect(-38,-150,76,35);ctx.restore();
  }

  ctx.fillStyle="#070a08";ctx.fillRect(1510,745,300,175);ctx.strokeStyle="#4b5649";ctx.lineWidth=4;ctx.strokeRect(1510,745,300,175);
  if(act===2){ctx.fillStyle="#dfe8d8";ctx.fillRect(1630,815,8,8);ctx.fillRect(1660,835,6,6);}

  ctx.fillStyle="#0b0f0b";ctx.fillRect(250,1060,170,120);ctx.strokeStyle="#596557";ctx.strokeRect(250,1060,170,120);
  ctx.fillStyle="#d7dfd1";ctx.font="bold 13px monospace";ctx.fillText("FUSE SHED",286,1128);

  if(power){
    const g=ctx.createRadialGradient(Z.lamp.x,420,10,Z.lamp.x,420,190);g.addColorStop(0,"rgba(230,240,222,.24)");g.addColorStop(1,"rgba(230,240,222,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(Z.lamp.x,420,190,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle="#080a08";ctx.fillRect(474,390,12,115);ctx.fillRect(454,385,52,9);ctx.fillStyle=power?"#e2ebda":"#242824";ctx.fillRect(466,360,28,26);

  ctx.fillStyle="#020302";ctx.fillRect(995,655,170,110);ctx.strokeStyle="#a7b1a2";ctx.lineWidth=4;ctx.strokeRect(1002,662,156,96);
  if(act>=5){ctx.fillStyle="#000";ctx.fillRect(1018,678,124,64);ctx.fillStyle="#eef5e4";ctx.fillRect(1055,705,7,5);ctx.fillRect(1092,705,7,5);}
  if(seals>0){ctx.strokeStyle="#dce5d6";ctx.lineWidth=4;for(let i=0;i<seals;i++){ctx.beginPath();ctx.arc(Z.hatch.x,Z.hatch.y,48+i*14,0,Math.PI*2);ctx.stroke();}}

  ctx.fillStyle="#111511";ctx.fillRect(1724,390,52,80);ctx.fillStyle="#4a5547";ctx.fillRect(1713,378,74,12);
  if(carried){ctx.fillStyle="#f0f5ea";ctx.fillRect(1070,1190,20,20);}
}

export default function TheHatch({friendId,client,paused}:GameComponentProps){
  const canvas=useRef<HTMLCanvasElement>(null);
  const pos=useRef<Point>({...START});
  const mimic=useRef<Point>({x:Z.grove.x,y:Z.grove.y});
  const keys=useRef(new Set<string>());
  const target=useRef<Point|null>(null);
  const cam=useRef<Point>({x:0,y:0});
  const sound=useRef<FriendSoundKit|null>(null);

  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [menu,setMenu]=useState<Menu>(null);
  const [act,setAct]=useState<Act>(0);
  const [seconds,setSeconds]=useState(0);
  const [message,setMessage]=useState("Your NFT creates the horror rules.");
  const [power,setPower]=useState(false);
  const [fuseHeld,setFuseHeld]=useState(false);
  const [mirrorSolved,setMirrorSolved]=useState(false);
  const [shift,setShift]=useState(0);
  const [freeze,setFreeze]=useState(0);
  const [chase,setChase]=useState(false);
  const [seals,setSeals]=useState(0);
  const [carriedSeal,setCarriedSeal]=useState(false);
  const [sealSpawn,setSealSpawn]=useState<Point>({x:560,y:900});
  const [rfSpent,setRfSpent]=useState(0);
  const [xp,setXp]=useState(0);
  const [inventory,setInventory]=useState<Record<string,number>>({ward:0,chalk:0,bell:0,fuse:0,mirror:0});
  const [scare,setScare]=useState(false);
  const [muted,setMuted]=useState(true);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    void Promise.all([client.read(),createFriendReader().read(friendId)]).then(([s,sp])=>{setSnapshot(s);setSprites(sp);}).catch(()=>setMessage("Could not load your Friend."));
    return()=>sound.current?.dispose();
  },[client,friendId]);

  useEffect(()=>{
    if(seconds<=0||paused||menu||act===0||act===7)return;
    const t=setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(t);
  },[seconds,paused,menu,act]);

  useEffect(()=>{if(seconds===0&&act>0&&act<7)fail("Time ran out.");},[seconds]);
  useEffect(()=>{if(!scare)return;const t=setTimeout(()=>setScare(false),650);return()=>clearTimeout(t)},[scare]);

  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext("2d");if(!node||!ctx||!sprites)return;
    let raf=0,prev=0,frameNo=0;let facing:SpriteFacing="up",side:"left"|"right"="right";
    const kd=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);if(k==="e")interact();};
    const ku=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);

    const loop=(now:number)=>{
      frameNo++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;const p=pos.current,before={...p};
      if(!paused&&!menu&&act>0&&act<7){
        let dx=0,dy=0;
        if(keys.current.has("a")||keys.current.has("arrowleft"))dx--;
        if(keys.current.has("d")||keys.current.has("arrowright"))dx++;
        if(keys.current.has("w")||keys.current.has("arrowup"))dy--;
        if(keys.current.has("s")||keys.current.has("arrowdown"))dy++;
        if(dx||dy)target.current=null;
        else if(target.current){dx=target.current.x-p.x;dy=target.current.y-p.y;if(Math.hypot(dx,dy)<5){target.current=null;dx=0;dy=0;}}
        const moving=!!(dx||dy);
        if(moving){
          const l=Math.hypot(dx,dy);p.x=clamp(p.x+dx/l*SPEED*dt,100,WORLD.width-100);p.y=clamp(p.y+dy/l*SPEED*dt,110,WORLD.height-100);
          facing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");if(facing==="left"||facing==="right")side=facing;
        }

        if(act===4){
          if(moving){setFreeze(0);if(dist(p,mimic.current)<260){setChase(true);setMessage("YOU MOVED WHILE IT WATCHED.");}}
          else setFreeze(v=>Math.min(100,v+dt*20));
          if(freeze>=100){setChase(false);setMessage("It loses interest.");setTimeout(()=>startAct(5),700);}
        }

        if(chase||act===6){
          const m=mimic.current,vx=p.x-m.x,vy=p.y-m.y,d=Math.max(1,Math.hypot(vx,vy));const ms=(act===6?220:195)*dt;m.x+=vx/d*ms;m.y+=vy/d*ms;
          if(dist(p,m)<42)fail("The Mimic caught you.");
        }

        if(act===6&&dist(p,Z.hatch)<95&&seals>=3){setAct(7);setChase(false);setXp(v=>v+200);setMessage("The final seal closes. Sunrise.");sound.current?.play("reward");}
      }

      cam.current={x:Math.round(clamp(p.x-VIEW.width/2,0,WORLD.width-VIEW.width)),y:Math.round(clamp(p.y-VIEW.height/2,0,WORLD.height-VIEW.height))};
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.translate(-cam.current.x,-cam.current.y);drawWorld(ctx,act,power,shift,seals,carriedSeal);
      if((act===2&&!mirrorSolved)||act===4||chase||act===6)drawMimic(ctx,sprites,mimic.current,frameNo);
      drawFriend(ctx,sprites,p,facing,dist(before,p)>.1,Math.floor(now/110)%8,side);
      if(act===5&&!carriedSeal&&seals<3){ctx.fillStyle="#eef5e7";ctx.fillRect(sealSpawn.x-10,sealSpawn.y-10,20,20);ctx.strokeStyle="#aeb9a8";ctx.strokeRect(sealSpawn.x-16,sealSpawn.y-16,32,32);}
      ctx.restore();raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku)};
  },[sprites,act,menu,paused,power,shift,freeze,chase,seals,carriedSeal,sealSpawn,mirrorSolved]);

  function startAct(next:Act){
    setAct(next);target.current=null;setScare(false);setChase(false);
    if(next===1){pos.current={...START};setSeconds(55);setPower(false);setFuseHeld(false);setMessage("ACT I — BLACKOUT. Find the fuse in the shed and restore Lamp Court.");}
    if(next===2){pos.current={...Z.pond};mimic.current={x:Z.grove.x,y:Z.grove.y};setSeconds(55);setMirrorSolved(false);setMessage("ACT II — THE WRONG FRIEND. Use the pond or a Mirror Shard to identify the fake.");}
    if(next===3){pos.current={...START};setSeconds(60);setShift(0);setMessage("ACT III — GARDEN SHIFT. Reach the Shrine while paths keep changing.");}
    if(next===4){pos.current={x:1100,y:860};mimic.current={x:1100,y:540};setSeconds(45);setFreeze(0);setMessage("ACT IV — DON'T MOVE. Stay still while the Mimic watches.");}
    if(next===5){pos.current={...START};setSeconds(75);setSeals(0);setCarriedSeal(false);setSealSpawn({x:540,y:900});setMessage("ACT V — THE HATCH OPENS. Recover three seals, one at a time.");}
    if(next===6){pos.current={...START};mimic.current={x:Z.grove.x,y:Z.grove.y};setSeconds(45);setChase(true);setMessage("ACT VI — REPLACEMENT. Reach the sealed Hatch before your double catches you.");}
    sound.current?.play("select");
  }

  function startGame(){setRfSpent(0);setXp(0);setInventory({ward:0,chalk:0,bell:0,fuse:0,mirror:0});startAct(1);}

  function fail(reason:string){
    setScare(true);sound.current?.play("impact");
    if((inventory.bell||0)>0&&(chase||act===6)){setInventory(v=>({...v,bell:v.bell-1}));setChase(false);setMessage(reason+" The Bell repels it once.");return;}
    setMessage(reason);setAct(0);setTimeout(()=>setMessage("The Garden reset. Begin another night when ready."),700);
  }

  function interact(){
    const p=pos.current;
    if(act===1){
      if(dist(p,Z.shed)<100&&!fuseHeld){setFuseHeld(true);setMessage("Fuse acquired. Get back to Lamp Court.");return;}
      if(dist(p,Z.lamp)<110&&fuseHeld){setPower(true);setXp(v=>v+25);setMessage("Power restored.");setTimeout(()=>startAct(2),700);return;}
    }
    if(act===2){
      if(dist(p,Z.pond)<115){
        if((inventory.mirror||0)>0){setInventory(v=>({...v,mirror:v.mirror-1}));setMirrorSolved(true);setXp(v=>v+25);setMessage("Mirror Shard: the Friend in Mask Grove has no true reflection.");setTimeout(()=>startAct(3),850);}
        else {setMirrorSolved(true);setXp(v=>v+25);setMessage("The pond reflection moves before the Mimic does. You found the fake.");setTimeout(()=>startAct(3),850);}
      }
    }
    if(act===3&&dist(p,Z.shrine)<120){setXp(v=>v+30);setMessage("You reach the Shrine before the Garden closes.");setTimeout(()=>startAct(4),800);}
    if(act===5){
      if(!carriedSeal&&seals<3&&dist(p,sealSpawn)<90){setCarriedSeal(true);setMessage("Seal acquired. Return to the Hatch.");return;}
      if(carriedSeal&&dist(p,Z.hatch)<105){const next=seals+1;setSeals(next);setCarriedSeal(false);setXp(v=>v+15);if(next>=3){setMessage("Three seals placed.");setTimeout(()=>startAct(6),800);}else{const spots=[{x:1580,y:970},{x:690,y:420},{x:1750,y:450}];setSealSpawn(spots[next]);setMessage("Seal placed. Find the next one.");}return;}
    }
  }

  useEffect(()=>{
    if(act!==3)return;
    const t=setInterval(()=>setShift(v=>v+1),5500);return()=>clearInterval(t);
  },[act]);

  async function buy(item:(typeof ITEMS)[number]){
    if(!snapshot||busy)return;setBusy(true);
    try{const units=Math.max(1,Math.round(item.cost/.1));await client.buy(BigInt(units));const plays=await client.play(BigInt(units));for(const p of plays)await client.settle(p.id);setSnapshot(await client.read());setInventory(v=>({...v,[item.key]:(v[item.key]||0)+1}));setRfSpent(v=>v+item.cost);setMessage(item.name+" prepared.");}
    catch(e){setMessage(e instanceof Error?e.message:"RF action failed.");}finally{setBusy(false);}
  }

  function useItem(key:string){
    if(!(inventory[key]>0))return;
    if(key==="ward"){setInventory(v=>({...v,ward:v.ward-1}));const hints=["Fuse Shed → Lamp Court","Moon Pond reveals the fake","Shrine is northeast","Do not move","Carry seals to the Hatch","Run straight for the Hatch"];setMessage("WARD: "+(hints[Math.max(0,act-1)]||"Stay alive."));}
    if(key==="fuse"&&act===1){setInventory(v=>({...v,fuse:v.fuse-1}));setPower(true);setXp(v=>v+25);setMessage("Emergency Fuse restores Lamp Court.");setTimeout(()=>startAct(2),700);}
    if(key==="chalk"&&act===5){setInventory(v=>({...v,chalk:v.chalk-1}));setSeals(v=>Math.min(3,v+1));setMessage("Chalk Seal counts as one containment seal.");}
    if(key==="mirror"&&act===2){setInventory(v=>({...v,mirror:v.mirror-1}));setMirrorSolved(true);setMessage("Mirror Shard marks the false Friend.");setTimeout(()=>startAct(3),700);}
    if(key==="bell"&&chase){setInventory(v=>({...v,bell:v.bell-1}));setChase(false);setMessage("Bell: the Mimic recoils.");}
  }

  const burn=(rfSpent*.5).toFixed(2),reward=(rfSpent*.5).toFixed(2);
  const actNames=["INTRO","BLACKOUT","WRONG FRIEND","GARDEN SHIFT","DON'T MOVE","THE HATCH OPENS","REPLACEMENT","SUNRISE"];

  return <section className={`hatch-game act-${act} ${chase?"chase":""}`}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="hatch-canvas" onPointerDown={e=>{
      if(act===0||act===7||paused||menu)return;const r=e.currentTarget.getBoundingClientRect();target.current={x:cam.current.x+(e.clientX-r.left)*VIEW.width/r.width,y:cam.current.y+(e.clientY-r.top)*VIEW.height/r.height};
    }}/>

    <div className="hud top-left"><b>RARE FRIENDS // THE HATCH</b><span>MASK → MIMIC · GARDEN → WORLD · HATCH → OBJECTIVE</span><span>Friend #{PROFILE.token}</span></div>
    {act>0&&act<7&&<div className="hud top-right"><b>{String(seconds).padStart(2,"0")}</b><span>ACT {act}/6</span><span>{actNames[act]}</span><span>XP {xp}</span></div>}
    {act>0&&act<7&&<div className="objective"><b>{actNames[act]}</b><span>{message}</span>{act===4&&<div className="meter"><i style={{width:`${freeze}%`}}/></div>}{act===5&&<span>SEALS {seals}/3 {carriedSeal?"· CARRYING ONE":""}</span>}</div>}

    {act>0&&act<7&&<div className="actions"><button onClick={()=>setMenu("inventory")}>INVENTORY</button><button onClick={()=>setMenu("store")}>RF SUPPLIES</button></div>}
    {act>0&&act<7&&<button className="interact" onClick={interact}>INTERACT <small>E</small></button>}
    <div className="status">{message}</div>

    {scare&&<div className="flash"><div className="face"><i/><i/><b/></div></div>}

    {act===0&&<div className="overlay"><div className="card">
      <span>FRIEND #334137 // TRAIT-BOUND SURVIVAL HORROR</span><h1>THE HATCH</h1>
      <p>No more repeated patrol/report loop. Every act plays differently.</p>
      <div className="act-list">
        <span>I · BLACKOUT — repair power</span><span>II · WRONG FRIEND — identify your Mimic</span><span>III · GARDEN SHIFT — navigate a changing map</span><span>IV · DON'T MOVE — movement-based stealth</span><span>V · THE HATCH OPENS — carry three seals</span><span>VI · REPLACEMENT — final chase</span>
      </div>
      <p><b>Mask</b> creates the Mimic. <b>Garden</b> creates the shifting world. <b>Hatch</b> creates containment. Seed <b>334137</b> defines the scenario.</p>
      <button onClick={startGame}>BEGIN NIGHT</button><button onClick={()=>setMenu("settings")}>SETTINGS</button>
    </div></div>}

    {act===7&&<div className="overlay"><div className="card"><span>SHIFT COMPLETE</span><h1>SUNRISE</h1><p>The Garden survives. Your reflection doesn't leave with you.</p><div className="ledger"><b>SESSION ECONOMY</b><span>RF spent {rfSpent.toFixed(2)}</span><span>Simulated burn {burn}</span><span>Active Friend rewards {reward}</span><span>Watch XP {xp}</span></div><button onClick={startGame}>PLAY ANOTHER NIGHT</button></div></div>}

    {menu==="store"&&<GameMenu title="RF SUPPLY CABINET" onClose={()=>setMenu(null)}><p>Optional tactical tools. Simulated: 50% burn / 50% Active Friend rewards.</p><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={busy} onClick={()=>void buy(i)}><b>{i.name}</b><small>{i.cost.toFixed(2)} RF · {i.desc}</small></button>)}</div><p>Spent {rfSpent.toFixed(2)} RF · burn {burn} · rewards {reward}</p></GameMenu>}
    {menu==="inventory"&&<GameMenu title="INVENTORY" onClose={()=>setMenu(null)}><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={!inventory[i.key]} onClick={()=>useItem(i.key)}><b>{i.name} × {inventory[i.key]||0}</b><small>{i.desc}</small></button>)}</div></GameMenu>}
    {menu==="settings"&&<GameMenu title="SETTINGS" onClose={()=>setMenu(null)}><button onClick={()=>{const n=!muted;setMuted(n);sound.current?.setMuted(n);}}>{muted?"SOUND: OFF":"SOUND: ON"}</button><p>FriendSDK keeps the canonical Rare Friend sprite and wallet ownership flow.</p></GameMenu>}
  </section>;
}
