"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Point={x:number;y:number};
type Role="friend"|"mimic";
type Phase="title"|"role"|"play"|"meeting"|"won"|"lost";
type ZoneKey="lamp"|"pond"|"hatch"|"shrine";
type Menu="store"|"inventory"|"settings"|null;
type Agent={id:string;name:string;p:Point;alive:boolean;color:string;target:Point;speed:number;task:ZoneKey|null;cooldown:number;suspicion:number};

const VIEW={width:960,height:640};
const WORLD={width:2100,height:1420};
const START={x:1050,y:1240};
const SPEED=245;
const PROFILE={token:"334137",character:"Mask",scenery:"Garden",floor:"Hatch",generation:6,seed:334137};

const ZONES:Record<ZoneKey,{name:string;p:Point;hint:string}>={
  lamp:{name:"Lamp Court",p:{x:480,y:520},hint:"Restore the courtyard lights."},
  pond:{name:"Moon Pond",p:{x:1580,y:790},hint:"Calibrate the reflection ward."},
  hatch:{name:"Central Hatch",p:{x:1040,y:710},hint:"Reinforce the containment bolts."},
  shrine:{name:"Old Shrine",p:{x:1510,y:300},hint:"Record the night seal."},
};
const ALL_ZONES=Object.keys(ZONES) as ZoneKey[];
const BOT_NAMES=["Moth","Reed","Vale","Ash","Ivy"];

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a:Point,b:Point,r=95)=>dist(a,b)<r;
const randPoint=(seed:number)=>({x:220+((seed*811)%1660),y:190+((seed*557)%990)});

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
  ctx.lineCap="round";ctx.strokeStyle="#303832";ctx.lineWidth=92;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.strokeStyle="#4d554e";ctx.lineWidth=72;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  const count=Math.max(2,Math.floor(len/72));
  for(let i=1;i<count;i++){
    const k=i/count;
    const wob=Math.sin((i+seed)*2.17)*15;
    const cx=a.x+dx*k+nx*wob,cy=a.y+dy*k+ny*wob;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.atan2(dy,dx)+Math.sin(i*.8)*.08);
    const w=48+(i%3)*9,h=29+(i%2)*7;
    const rg=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);rg.addColorStop(0,"#5d655d");rg.addColorStop(.55,"#424943");rg.addColorStop(1,"#2a302b");
    ctx.fillStyle=rg;ctx.fillRect(-w/2,-h/2,w,h);
    ctx.strokeStyle="rgba(8,10,8,.5)";ctx.lineWidth=2;ctx.strokeRect(-w/2,-h/2,w,h);
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
  for(let i=0;i<6;i++){
    const ox=Math.sin(seed+i*2.3)*26,oy=Math.cos(seed*.7+i)*10;
    const rg=ctx.createRadialGradient(ox-6,oy-5,2,ox,oy,28);rg.addColorStop(0,"#33402f");rg.addColorStop(1,"#0d120e");
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(ox,oy,28,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

function drawLampCourt(ctx:CanvasRenderingContext2D,lights:boolean,t:number){
  const p=ZONES.lamp.p;
  ctx.save();
  if(lights){
    const flicker=.92+Math.sin(t/170)*.035+Math.sin(t/73)*.018;
    const glow=ctx.createRadialGradient(p.x,p.y-92,12,p.x,p.y-92,300);
    glow.addColorStop(0,"rgba(255,239,184,"+(.46*flicker)+")");
    glow.addColorStop(.35,"rgba(244,221,151,"+(.20*flicker)+")");
    glow.addColorStop(1,"rgba(244,221,151,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y-92,300,0,Math.PI*2);ctx.fill();
    for(let i=0;i<8;i++){
      const a=t/900+i*2.1,r=36+(i%4)*12;ctx.fillStyle="rgba(246,231,177,.28)";
      ctx.fillRect(p.x+Math.cos(a)*r,p.y-100+Math.sin(a*1.7)*24,2,2);
    }
  }
  const metal=ctx.createLinearGradient(p.x-12,0,p.x+12,0);metal.addColorStop(0,"#090b0a");metal.addColorStop(.5,"#343934");metal.addColorStop(1,"#0a0c0b");
  ctx.fillStyle=metal;ctx.fillRect(p.x-8,p.y-126,16,138);ctx.fillRect(p.x-31,p.y-132,62,10);
  ctx.fillStyle=lights?"#fff0bb":"#292d29";ctx.fillRect(p.x-19,p.y-168,38,34);
  ctx.strokeStyle="#555e55";ctx.strokeRect(p.x-19,p.y-168,38,34);
  ctx.restore();
}

function drawPond(ctx:CanvasRenderingContext2D,t:number){
  const p=ZONES.pond.p;
  ctx.save();
  const rim=ctx.createRadialGradient(p.x,p.y,95,p.x,p.y,205);rim.addColorStop(0,"#0b1412");rim.addColorStop(1,"#202a23");
  ctx.fillStyle=rim;ctx.beginPath();ctx.ellipse(p.x,p.y,205,125,0,0,Math.PI*2);ctx.fill();
  const water=ctx.createLinearGradient(0,p.y-110,0,p.y+110);water.addColorStop(0,"#13201f");water.addColorStop(.45,"#08110f");water.addColorStop(1,"#020706");
  ctx.fillStyle=water;ctx.beginPath();ctx.ellipse(p.x,p.y,182,105,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(187,211,199,.17)";ctx.lineWidth=2;
  for(let i=0;i<8;i++){const yy=p.y-62+i*17+Math.sin(t/520+i)*4;ctx.beginPath();ctx.moveTo(p.x-118+i*4,yy);ctx.bezierCurveTo(p.x-45,yy-4,p.x+45,yy+4,p.x+118-i*5,yy);ctx.stroke();}
  const moon=ctx.createRadialGradient(p.x-48,p.y-28,2,p.x-48,p.y-28,48);moon.addColorStop(0,"rgba(210,224,217,.18)");moon.addColorStop(1,"rgba(210,224,217,0)");
  ctx.fillStyle=moon;ctx.beginPath();ctx.arc(p.x-48,p.y-28,48,0,Math.PI*2);ctx.fill();
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

function drawWorld(ctx:CanvasRenderingContext2D,t:number,lights:boolean,hatchPanic:boolean,bodies:Agent[]){
  const bg=ctx.createLinearGradient(0,0,0,WORLD.height);bg.addColorStop(0,"#0d1512");bg.addColorStop(.58,"#111a14");bg.addColorStop(1,"#060a08");ctx.fillStyle=bg;ctx.fillRect(0,0,WORLD.width,WORLD.height);

  ctx.fillStyle="#152018";ctx.fillRect(80,80,WORLD.width-160,WORLD.height-140);
  for(let i=0;i<280;i++){
    const x=100+((i*193+PROFILE.seed)%1900),y=100+((i*317+PROFILE.seed*3)%1190);
    const h=5+(i%7);ctx.strokeStyle=i%4===0?"rgba(111,136,104,.20)":"rgba(54,77,57,.24)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(i)*2,y-h);ctx.stroke();
  }

  const paths=[[START,ZONES.hatch.p],[ZONES.hatch.p,ZONES.lamp.p],[ZONES.hatch.p,ZONES.pond.p],[ZONES.hatch.p,ZONES.shrine.p]] as const;
  paths.forEach((p,i)=>drawStonePath(ctx,p[0],p[1],i+PROFILE.seed));

  ctx.strokeStyle="#2f3931";ctx.lineWidth=5;ctx.strokeRect(86,86,WORLD.width-172,WORLD.height-152);
  for(let x=105;x<WORLD.width-95;x+=52){ctx.fillStyle="#151b17";ctx.fillRect(x,80,4,50);ctx.fillRect(x,WORLD.height-118,4,48);}

  for(let i=0;i<24;i++){const p=randPoint(i+13);drawTree(ctx,p,t,i+3);}
  for(let i=0;i<18;i++){drawBush(ctx,{x:170+((i*229)%1740),y:180+((i*401)%1010)},i+11);}

  drawLampCourt(ctx,lights,t);
  drawPond(ctx,t);
  drawShrine(ctx);
  drawHatch(ctx,hatchPanic,t);

  ctx.fillStyle="rgba(190,205,195,.035)";
  for(let i=0;i<18;i++){const x=820+((i*83)%480),y=800+((i*137)%420);ctx.beginPath();ctx.ellipse(x,y,28+(i%4)*7,5+(i%3),0,0,Math.PI*2);ctx.fill();}

  for(const b of bodies){
    const blood=ctx.createRadialGradient(b.p.x,b.p.y+7,3,b.p.x,b.p.y+7,44);blood.addColorStop(0,"rgba(113,11,16,.62)");blood.addColorStop(1,"rgba(113,11,16,0)");
    ctx.fillStyle=blood;ctx.beginPath();ctx.ellipse(b.p.x,b.p.y+8,45,20,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(b.p.x,b.p.y);ctx.rotate(-.7);ctx.fillStyle="#262a25";ctx.fillRect(-28,-8,56,16);ctx.fillStyle="#5e645c";ctx.beginPath();ctx.arc(-31,0,10,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  for(let i=0;i<8;i++){
    const x=((t*.018+i*330)%2600)-250,y=180+i*145;
    const fog=ctx.createRadialGradient(x,y,10,x,y,180);fog.addColorStop(0,"rgba(190,205,195,.035)");fog.addColorStop(1,"rgba(190,205,195,0)");
    ctx.fillStyle=fog;ctx.beginPath();ctx.ellipse(x,y,220,70,0,0,Math.PI*2);ctx.fill();
  }
}

function shuffle<T>(arr:T[],seed:number){const a=[...arr];let s=seed>>>0;for(let i=a.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

export default function TheHatch({friendId,client,paused}:GameComponentProps){
  const canvas=useRef<HTMLCanvasElement>(null);
  const pos=useRef<Point>({...START});
  const cam=useRef<Point>({x:0,y:0});
  const keys=useRef(new Set<string>());
  const destination=useRef<Point|null>(null);
  const sound=useRef<FriendSoundKit|null>(null);
  const facing=useRef<SpriteFacing>("up");
  const side=useRef<"left"|"right">("right");
  const lastKill=useRef(0);
  const lastSabotage=useRef(0);
  const agentsRef=useRef<Agent[]>([]);
  const frameSync=useRef(0);

  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [phase,setPhase]=useState<Phase>("title");
  const [role,setRole]=useState<Role>("friend");
  const [menu,setMenu]=useState<Menu>(null);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [tasks,setTasks]=useState<Record<ZoneKey,boolean>>({lamp:false,pond:false,hatch:false,shrine:false});
  const [lights,setLights]=useState(true);
  const [hatchPanic,setHatchPanic]=useState(false);
  const [meetingReason,setMeetingReason]=useState("");
  const [emergencyLeft,setEmergencyLeft]=useState(1);
  const [message,setMessage]=useState("A social-deduction horror night in Garden Unit 06.");
  const [timer,setTimer]=useState(240);
  const [killCooldown,setKillCooldown]=useState(0);
  const [shiftCooldown,setShiftCooldown]=useState(0);
  const [disguise,setDisguise]=useState<string|null>(null);
  const [votes,setVotes]=useState<Record<string,number>>({});
  const [rfSpent,setRfSpent]=useState(0);
  const [inventory,setInventory]=useState({ward:0,bell:0});
  const [busy,setBusy]=useState(false);
  const [muted,setMuted]=useState(true);
  const [evidence,setEvidence]=useState<string[]>(["No evidence yet. Watch who follows victims and who is near sabotaged systems."]);

  const aliveAgents=agents.filter(a=>a.alive);
  const bodies=agents.filter(a=>!a.alive);
  const tasksDone=Object.values(tasks).filter(Boolean).length;
  const nearestAlive=aliveAgents.reduce<Agent|null>((best,a)=>!best||dist(pos.current,a.p)<dist(pos.current,best.p)?a:best,null);

  function updateAgents(updater:(xs:Agent[])=>Agent[]){
    const next=updater(agentsRef.current);
    agentsRef.current=next;
    setAgents(next);
  }

  useEffect(()=>{agentsRef.current=agents;},[agents]);

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    void Promise.all([client.read(),createFriendReader().read(friendId)]).then(([s,sp])=>{setSnapshot(s);setSprites(sp);}).catch(()=>setMessage("Could not load your Friend."));
    return()=>sound.current?.dispose();
  },[client,friendId]);

  useEffect(()=>{
    if(phase!=="play"||paused||menu)return;
    const t=setTimeout(()=>setTimer(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(t);
  },[phase,paused,menu,timer]);

  useEffect(()=>{if(phase==="play"&&timer===0)finish(role==="friend"?"lost":"won","06:00 — the Hatch opens before containment finishes.");},[timer,phase,role]);

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
    const kd=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);if(k==="e")interact();if(k==="r")reportBody();};
    const ku=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);

    const loop=(now:number)=>{
      frameNo++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;
      const p=pos.current,before={...p};

      if(phase==="play"&&!paused&&!menu){
        let dx=0,dy=0;if(keys.current.has("a")||keys.current.has("arrowleft"))dx--;if(keys.current.has("d")||keys.current.has("arrowright"))dx++;if(keys.current.has("w")||keys.current.has("arrowup"))dy--;if(keys.current.has("s")||keys.current.has("arrowdown"))dy++;
        if(dx||dy)destination.current=null;else if(destination.current){dx=destination.current.x-p.x;dy=destination.current.y-p.y;if(Math.hypot(dx,dy)<7){destination.current=null;dx=0;dy=0;}}
        if(dx||dy){const l=Math.hypot(dx,dy);p.x=clamp(p.x+dx/l*SPEED*dt,120,WORLD.width-120);p.y=clamp(p.y+dy/l*SPEED*dt,120,WORLD.height-120);facing.current=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");if(facing.current==="left"||facing.current==="right")side.current=facing.current;}

        // Move AI in a ref so React does not tear down the animation loop every frame.
        const moved=agentsRef.current.map((a,i)=>{
          if(!a.alive)return a;
          let target=a.target;
          if(dist(a.p,target)<28)target=randPoint(Math.floor(now/1000)+i*19+PROFILE.seed);
          const vx=target.x-a.p.x,vy=target.y-a.p.y,d=Math.max(1,Math.hypot(vx,vy));
          return {...a,target,p:{x:clamp(a.p.x+vx/d*a.speed*dt,140,WORLD.width-140),y:clamp(a.p.y+vy/d*a.speed*dt,140,WORLD.height-140)}};
        });
        agentsRef.current=moved;
        frameSync.current++;
        if(frameSync.current%8===0)setAgents([...moved]);

        // Hidden saboteur behavior. It kills isolated teammates and causes crises.
        if(role==="friend"){
          const currentAgents=agentsRef.current;
          const mimic=currentAgents.find(a=>a.id==="mimic");
          if(mimic?.alive){
            if(now-lastSabotage.current>15000){
              lastSabotage.current=now;
              const cutLights=Math.random()>.5;
              if(cutLights)setLights(false);else setHatchPanic(true);
              setEvidence(prev=>[...prev.slice(-3),cutLights?"The saboteur cut power. Check who was roaming near Lamp Court.":"The Hatch was sabotaged. Check who was near Central Hatch."]);
              setMessage(cutLights?"The lights just died. Find the saboteur before someone dies.":"Hatch pressure spike — sabotage detected.");
            }
            if(now-lastKill.current>10000){
              const victims=currentAgents.filter(a=>a.alive&&a.id!=="mimic"&&dist(a.p,mimic.p)<175);
              const victim=victims[0];
              if(victim){
                const witnesses=currentAgents.filter(a=>a.alive&&a.id!==mimic.id&&a.id!==victim.id&&dist(a.p,mimic.p)<250);
                if(witnesses.length===0){
                  lastKill.current=now;
                  const next=currentAgents.map(a=>a.id===victim.id?{...a,alive:false}:a);
                  agentsRef.current=next;setAgents(next);
                  setEvidence(prev=>[...prev.slice(-3),victim.name+" was last seen near "+mimic.name+"."]);
                  setMessage(victim.name+" was killed. Find the body and call a meeting.");
                  sound.current?.play("impact");
                }
              }
            }
          }
        }
      }

      cam.current={x:Math.round(clamp(p.x-VIEW.width/2,0,WORLD.width-VIEW.width)),y:Math.round(clamp(p.y-VIEW.height/2,0,WORLD.height-VIEW.height))};
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.translate(-cam.current.x,-cam.current.y);
      const renderAgents=agentsRef.current;
      drawWorld(ctx,now,lights,hatchPanic,renderAgents.filter(a=>!a.alive));
      renderAgents.forEach(a=>drawKeeper(ctx,a,now));
      ctx.restore();

      // Screen-space mist and drifting particles.
      ctx.save();
      for(let i=0;i<24;i++){
        const px=(i*137+(now*.012*(1+i%3)))%VIEW.width;
        const py=(i*89+(now*.006*(1+i%2)))%VIEW.height;
        ctx.fillStyle=i%5===0?"rgba(223,231,221,.08)":"rgba(174,191,176,.045)";
        ctx.fillRect(px,py,1+(i%2),1+(i%3));
      }
      const fog1=ctx.createRadialGradient(160,540,20,160,540,280);fog1.addColorStop(0,"rgba(185,198,187,.055)");fog1.addColorStop(1,"rgba(185,198,187,0)");ctx.fillStyle=fog1;ctx.fillRect(0,300,420,340);
      ctx.restore();

      // Horror lighting first, then canonical Friend so it can never be erased.
      ctx.save();ctx.fillStyle=lights?"rgba(0,0,0,.48)":"rgba(0,0,0,.72)";ctx.fillRect(0,0,VIEW.width,VIEW.height);
      const sx=p.x-cam.current.x,sy=p.y-cam.current.y;ctx.globalCompositeOperation="destination-out";const rg=ctx.createRadialGradient(sx,sy,20,sx,sy,230);rg.addColorStop(0,"rgba(0,0,0,1)");rg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=rg;ctx.beginPath();ctx.arc(sx,sy,230,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(-cam.current.x,-cam.current.y);drawFriend(ctx,sprites,p,facing.current,dist(before,p)>.1,Math.floor(now/110)%8,side.current);ctx.restore();

      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku)};
  },[sprites,phase,paused,menu,role,lights,hatchPanic]);

  function start(){
    const chosen:Role="friend";
    setRole(chosen);setPhase("role");setTimer(240);setLights(true);setHatchPanic(false);setTasks({lamp:false,pond:false,hatch:false,shrine:false});setEmergencyLeft(1);setKillCooldown(12);setShiftCooldown(10);setDisguise(null);setVotes({});
    pos.current={...START};
    const bots=BOT_NAMES.map((name,i):Agent=>({id:"bot"+i,name,p:randPoint(i*31+7),alive:true,color:["#526858","#6b5f52","#4b606a","#6a4f55","#596149"][i],target:randPoint(i*47+21),speed:70+i*4,task:ALL_ZONES[i%4],cooldown:0,suspicion:0}));
    if(chosen==="friend"){const culprit=PROFILE.seed%BOT_NAMES.length;bots[culprit]={...bots[culprit],id:"mimic",name:bots[culprit].name};}
    agentsRef.current=bots;setAgents(bots);setEvidence(["One of these five Keepers is the saboteur. Watch their routes, find bodies, and call meetings."]);
    setMessage("You are a FRIEND. Complete containment tasks, but your real goal is to identify and eject the hidden saboteur.");
    setTimeout(()=>setPhase("play"),2200);
  }

  function interact(){
    if(phase!=="play")return;
    if(role==="friend"){
      const zone=ALL_ZONES.find(z=>near(pos.current,ZONES[z].p,125));
      if(zone&&!tasks[zone]){
        setTasks(v=>({...v,[zone]:true}));setMessage(ZONES[zone].name+" secured. "+(tasksDone+1)+"/4 tasks complete.");sound.current?.play("reward");
        if(tasksDone+1>=4)setMessage("Containment tasks complete. Now identify and eject the saboteur before sunrise.");
        return;
      }
      if(!lights&&near(pos.current,ZONES.lamp.p,130)){setLights(true);setMessage("Lamp Court restored.");return;}
      if(hatchPanic&&near(pos.current,ZONES.hatch.p,140)){setHatchPanic(false);setMessage("Hatch sabotage contained.");return;}
      reportBody();
    }else{
      const target=nearestAlive;
      if(target&&near(pos.current,target.p,90)&&killCooldown===0){updateAgents(xs=>xs.map(a=>a.id===target.id?{...a,alive:false}:a));setKillCooldown(18);setMessage("No one saw "+target.name+" disappear.");sound.current?.play("impact");checkMimicWin();return;}
    }
  }

  function reportBody(){
    if(phase!=="play")return;
    const body=bodies.find(b=>near(pos.current,b.p,115));
    if(body){openMeeting(body.name+" was found in the Garden.");return;}
    setMessage("No body nearby.");
  }

  function emergency(){
    if(phase!=="play"||emergencyLeft<=0)return;
    setEmergencyLeft(0);openMeeting("Emergency bell called at Lamp Court.");
  }

  function openMeeting(reason:string){setMeetingReason(reason);setPhase("meeting");setVotes({});setMessage("Discuss the evidence, then vote for the saboteur.");sound.current?.play("select");}

  function vote(id:string){
    const candidates=agentsRef.current.filter(a=>a.alive);
    const tally:Record<string,number>={[id]:1};
    for(const voter of candidates){
      if(Math.random()<.18)continue;
      const pool=candidates.filter(c=>c.id!==voter.id);
      const culprit=agentsRef.current.find(a=>a.id==="mimic");
      const pick=(voter.id!=="mimic"&&Math.random()<.45&&culprit)?culprit:pool[Math.floor(Math.random()*pool.length)];
      if(pick)tally[pick.id]=(tally[pick.id]||0)+1;
    }
    setVotes(tally);
    const top=Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
    const ejected=top?agentsRef.current.find(a=>a.id===top[0]):null;
    setTimeout(()=>{
      if(!ejected){setPhase("play");return;}
      updateAgents(xs=>xs.map(a=>a.id===ejected.id?{...a,alive:false}:a));
      if(role==="friend"&&ejected.id==="mimic"){finish("won",ejected.name+" was the Mimic. The remaining Keepers seal the Hatch.");return;}
      if(role==="mimic"&&ejected.id==="mimic"){finish("lost","The Keepers identified you before the Hatch opened.");return;}
      setMessage(ejected.name+" was expelled. The night continues.");
      setPhase("play");checkMimicWin();
    },900);
  }

  function sabotage(kind:"lights"|"hatch"){
    if(role!=="mimic"||phase!=="play"||shiftCooldown>0)return;
    setShiftCooldown(12);
    if(kind==="lights"){setLights(false);setMessage("You killed the lights. Move before they restore them.");}
    else{setHatchPanic(true);setMessage("You destabilized the Hatch. Everyone will have to respond.");}
    sound.current?.play("impact");
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

  function finish(result:"won"|"lost",text:string){setPhase(result);setMessage(text);sound.current?.play(result==="won"?"reward":"impact");}

  async function buyWard(){
    if(!snapshot||busy)return;setBusy(true);
    try{await client.buy(1n);const plays=await client.play(1n);for(const p of plays)await client.settle(p.id);setSnapshot(await client.read());setInventory(v=>({...v,ward:v.ward+1}));setRfSpent(v=>v+.1);setMessage("Ward prepared for this night.");}
    catch(e){setMessage(e instanceof Error?e.message:"RF action failed.");}finally{setBusy(false);}
  }

  const minute=Math.floor((240-timer)/40);const clock=["12:00","1:00","2:00","3:00","4:00","5:00","6:00"][Math.min(6,minute)];
  const roleLabel=role==="friend"?"FRIEND":"MIMIC";

  return <section className={"deduction-game "+(!lights?"blackout ":"")+(hatchPanic?"breach ":"")}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="game-canvas" onPointerDown={e=>{
      if(phase!=="play"||paused||menu)return;const r=e.currentTarget.getBoundingClientRect();destination.current={x:cam.current.x+(e.clientX-r.left)*VIEW.width/r.width,y:cam.current.y+(e.clientY-r.top)*VIEW.height/r.height};
    }}/>

    {phase==="play"&&<>
      <div className="hud mission"><span>{roleLabel} // {clock}</span><b>{role==="friend"?"KEEP THE HATCH SEALED":"BECOME ONE OF THEM"}</b><small>{role==="friend"?tasksDone+"/4 tasks · identify the saboteur":aliveAgents.length+" Keepers remain"}</small></div>
      <div className="hud statusbox"><b>{lights?"LIGHTS ONLINE":"BLACKOUT"}</b><span>{hatchPanic?"HATCH SABOTAGED":"Containment stable"}</span></div>
      {role==="friend"&&<div className="task-list">{ALL_ZONES.map(z=><span key={z} className={tasks[z]?"done":""}>{tasks[z]?"✓":"□"} {ZONES[z].name}</span>)}</div>}
      <div className="bottom-actions">
        <button onClick={interact}>{role==="mimic"?"KILL / USE":"USE"} <small>E</small></button>
        <button onClick={reportBody}>REPORT <small>R</small></button>
        <button disabled={emergencyLeft<=0} onClick={emergency}>MEETING {emergencyLeft}</button>
        <button onClick={()=>setMenu("inventory")}>ITEMS</button>
      </div>
      {role==="mimic"&&<div className="mimic-actions"><button disabled={shiftCooldown>0} onClick={()=>sabotage("lights")}>CUT LIGHTS {shiftCooldown||""}</button><button disabled={shiftCooldown>0} onClick={()=>sabotage("hatch")}>HATCH SABOTAGE</button><button disabled={shiftCooldown>0||!nearestAlive} onClick={shapeshift}>MASK SHIFT</button><span>KILL CD {killCooldown}s {disguise?"· AS "+disguise:""}</span></div>}
      <div className="message">{message}</div>
    </>}

    {phase==="title"&&<div className="overlay"><div className="title-card"><span>RARE FRIENDS SOCIAL HORROR</span><h1>THE HATCH</h1><p>One of the Keepers is a hidden saboteur. It will kill the team unless you identify it in a meeting.</p><div className="pitch"><b>MASK</b><span>The Mimic can copy identities.</span><b>GARDEN</b><span>A realistic night map built around your NFT.</span><b>HATCH</b><span>Keep it sealed until sunrise.</span></div><button onClick={start}>START DEDUCTION NIGHT</button><button onClick={()=>setMenu("settings")}>SETTINGS</button><small>WASD / arrows · E use · R report · click/tap to move</small></div></div>}

    {phase==="role"&&<div className={"overlay role-card "+role}><div><span>YOUR ROLE</span><h1>{role==="friend"?"FRIEND":"THE MIMIC"}</h1><p>{message}</p></div></div>}

    {phase==="meeting"&&<div className="overlay meeting"><div className="meeting-card"><span>GARDEN MEETING</span><h2>{meetingReason}</h2><p>Who doesn't belong here?</p><div className="evidence"><b>EVIDENCE</b>{evidence.map((e,i)=><span key={i}>• {e}</span>)}</div><div className="vote-grid">{agents.filter(a=>a.alive).map(a=><button key={a.id} onClick={()=>vote(a.id)}><b>{a.name}</b><small>{votes[a.id]?votes[a.id]+" votes":"VOTE"}</small></button>)}</div><button className="skip" onClick={()=>setPhase("play")}>SKIP VOTE</button></div></div>}

    {(phase==="won"||phase==="lost")&&<div className="overlay"><div className={"end-card "+phase}><span>{phase==="won"?"NIGHT SURVIVED":"CONTAINMENT FAILED"}</span><h1>{phase==="won"?"SUNRISE":"REPLACED"}</h1><p>{message}</p><div className="ledger"><span>Role {roleLabel}</span><span>Tasks {tasksDone}/4</span><span>RF spent {rfSpent.toFixed(2)}</span><span>Friend #334137</span></div><button onClick={start}>PLAY AGAIN</button></div></div>}

    {menu==="inventory"&&<GameMenu title="NIGHT ITEMS" onClose={()=>setMenu(null)}><div className="item-menu"><button disabled={busy} onClick={()=>void buyWard()}><b>Ward · 0.10 RF</b><small>Simulated RF prep item for future deduction tools.</small></button><span>Ward × {inventory.ward}</span></div></GameMenu>}
    {menu==="settings"&&<GameMenu title="SETTINGS" onClose={()=>setMenu(null)}><button onClick={()=>{const n=!muted;setMuted(n);sound.current?.setMuted(n);}}>{muted?"SOUND: OFF":"SOUND: ON"}</button><p>This build is a playable social-deduction practice lobby with AI Keepers. Real online lobbies need a multiplayer backend.</p></GameMenu>}
  </section>;
}
