"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import type { GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendReader, spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { createFriendSoundKit, type FriendSoundKit } from "@rarefriends/friendsdk/sounds";
import "./style.css";

type Point = { x:number; y:number };
type Act = 0|1|2|3|4|5|6|7|8;
type Menu = "store"|"inventory"|"settings"|null;
type ItemKey = "ward"|"chalk"|"bell"|"fuse"|"mirror";

const VIEW={width:960,height:640};
const WORLD={width:2400,height:1600};
const START:Point={x:1180,y:1420};
const SPEED=245;
const PROFILE={token:"334137",character:"Mask",scenery:"Garden",floor:"Hatch",generation:6,seed:334137};

const Z={
  gate:{x:1180,y:1420},
  shed:{x:390,y:1260},
  lamp:{x:590,y:590},
  hatch:{x:1200,y:790},
  pond:{x:1840,y:930},
  greenhouse:{x:1850,y:500},
  shrine:{x:1660,y:280},
  grove:{x:1110,y:260},
  service:{x:2100,y:1170},
};

const ITEMS=[
  {key:"ward" as ItemKey,name:"Ward",cost:0.1,desc:"Briefly reveals the safest route."},
  {key:"chalk" as ItemKey,name:"Chalk Seal",cost:0.2,desc:"Counts as one containment seal."},
  {key:"bell" as ItemKey,name:"Bell",cost:0.4,desc:"Breaks one Mimic chase."},
  {key:"fuse" as ItemKey,name:"Emergency Fuse",cost:0.5,desc:"Restores Lamp Court instantly."},
  {key:"mirror" as ItemKey,name:"Mirror Shard",cost:0.7,desc:"Exposes the false Friend immediately."},
] as const;

const treeSeed:Point[]=[
  {x:180,y:210},{x:360,y:240},{x:610,y:210},{x:820,y:280},{x:1010,y:180},{x:1340,y:210},{x:1520,y:210},{x:2050,y:260},{x:2230,y:350},
  {x:200,y:760},{x:420,y:840},{x:760,y:980},{x:1020,y:1130},{x:1450,y:1150},{x:1740,y:1260},{x:2150,y:910},{x:2190,y:1370},{x:360,y:1450}
];

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a:Point,b:Point,r=105)=>dist(a,b)<r;

function drawFriend(ctx:CanvasRenderingContext2D,sprites:GenerationSprites,p:Point,facing:SpriteFacing,walking:boolean,frame:number,side:"left"|"right",alpha=1,corrupt=false){
  const rows=spriteFrame(sprites,facing,walking,frame,side).frame.rows;
  const scale=5,left=Math.round(p.x)-40,top=Math.round(p.y)-80;
  ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;
  if(!corrupt){
    ctx.fillStyle="rgba(235,242,231,.75)";
    rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale-2,top+y*scale-2,scale+4,scale+4)}));
  }
  ctx.fillStyle=corrupt?"#e8efe4":"#050706";
  rows.forEach((row,y)=>[...row].forEach((px,x)=>{if(px==="#")ctx.fillRect(left+x*scale,top+y*scale,scale,scale)}));
  if(corrupt){
    ctx.globalCompositeOperation="source-atop";
    ctx.fillStyle="rgba(10,15,11,.75)";ctx.fillRect(left,top,80,80);
    ctx.globalCompositeOperation="source-over";
    ctx.strokeStyle="rgba(235,242,231,.75)";ctx.lineWidth=2;ctx.strokeRect(left-4,top-5,88,88);
  }
  ctx.restore();
}

function drawTree(ctx:CanvasRenderingContext2D,p:Point,phase:number){
  const sway=Math.sin((p.x+p.y+phase)/140)*4;
  ctx.save();ctx.translate(p.x,p.y);
  const trunk=ctx.createLinearGradient(-20,0,20,0);trunk.addColorStop(0,"#11140f");trunk.addColorStop(.45,"#2a3026");trunk.addColorStop(1,"#0b0d0a");
  ctx.fillStyle=trunk;ctx.beginPath();ctx.moveTo(-16,18);ctx.lineTo(-11,-86);ctx.lineTo(11+sway,-92);ctx.lineTo(19,20);ctx.closePath();ctx.fill();
  const crown=ctx.createRadialGradient(sway,-125,18,sway,-125,86);crown.addColorStop(0,"#334030");crown.addColorStop(.5,"#1e291d");crown.addColorStop(1,"#0a0d0a");
  ctx.fillStyle=crown;ctx.beginPath();ctx.ellipse(sway,-125,78,58,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="rgba(152,169,145,.08)";ctx.beginPath();ctx.ellipse(sway-18,-142,36,18,-.35,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawGround(ctx:CanvasRenderingContext2D,t:number,act:Act,shift:number){
  const g=ctx.createLinearGradient(0,0,0,WORLD.height);g.addColorStop(0,"#111814");g.addColorStop(1,"#0a0f0c");ctx.fillStyle=g;ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.fillStyle="#172019";ctx.fillRect(85,85,WORLD.width-170,WORLD.height-150);
  ctx.strokeStyle="#303c32";ctx.lineWidth=8;ctx.strokeRect(85,85,WORLD.width-170,WORLD.height-150);

  const routes=[
    [Z.gate,Z.hatch],[Z.hatch,Z.lamp],[Z.hatch,Z.pond],[Z.hatch,Z.grove],[Z.pond,Z.greenhouse],[Z.pond,Z.service],[Z.grove,Z.shrine],[Z.lamp,Z.shed]
  ] as const;
  ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=76;
  for(let i=0;i<routes.length;i++){
    if(act===3&&((shift+i)%5===1||((shift+i)%7===3&&i>2)))continue;
    const [a,b]=routes[i];const pg=ctx.createLinearGradient(a.x,a.y,b.x,b.y);pg.addColorStop(0,"#454b43");pg.addColorStop(.5,"#555a51");pg.addColorStop(1,"#3d443d");
    ctx.strokeStyle=pg;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.strokeStyle="rgba(10,12,10,.34)";ctx.lineWidth=3;for(let s=0;s<7;s++){const k=(s+1)/8;ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*k-20,a.y+(b.y-a.y)*k);ctx.lineTo(a.x+(b.x-a.x)*k+20,a.y+(b.y-a.y)*k+4);ctx.stroke();}
    ctx.lineWidth=76;
  }

  for(let i=0;i<140;i++){
    const x=(i*173+PROFILE.seed*3)%WORLD.width,y=(i*307+PROFILE.seed)%WORLD.height;
    ctx.fillStyle=i%3===0?"rgba(90,112,83,.15)":"rgba(20,28,21,.28)";
    ctx.fillRect(x,y,2+(i%4),7+(i%5));
  }

  if(act>=5){ctx.fillStyle="rgba(0,0,0,.12)";for(let i=0;i<10;i++){const x=980+i*45,y=720+Math.sin((i+t/800))*24;ctx.beginPath();ctx.ellipse(x,y,70,24,.15,0,Math.PI*2);ctx.fill();}}
}

function drawLamp(ctx:CanvasRenderingContext2D,power:boolean){
  if(power){
    const glow=ctx.createRadialGradient(Z.lamp.x,Z.lamp.y-95,12,Z.lamp.x,Z.lamp.y-95,250);glow.addColorStop(0,"rgba(255,239,190,.42)");glow.addColorStop(.42,"rgba(232,222,173,.18)");glow.addColorStop(1,"rgba(232,222,173,0)");
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(Z.lamp.x,Z.lamp.y-95,250,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle="#151816";ctx.fillRect(Z.lamp.x-8,Z.lamp.y-115,16,126);ctx.fillRect(Z.lamp.x-28,Z.lamp.y-122,56,9);
  const lamp=ctx.createLinearGradient(0,Z.lamp.y-150,0,Z.lamp.y-120);lamp.addColorStop(0,power?"#fff4c7":"#32342f");lamp.addColorStop(1,power?"#d7c783":"#161917");ctx.fillStyle=lamp;ctx.fillRect(Z.lamp.x-18,Z.lamp.y-153,36,31);
}

function drawShed(ctx:CanvasRenderingContext2D){
  ctx.fillStyle="#1a1b18";ctx.fillRect(Z.shed.x-95,Z.shed.y-72,190,142);
  ctx.fillStyle="#242922";ctx.beginPath();ctx.moveTo(Z.shed.x-112,Z.shed.y-72);ctx.lineTo(Z.shed.x,Z.shed.y-132);ctx.lineTo(Z.shed.x+112,Z.shed.y-72);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#485044";ctx.lineWidth=3;ctx.strokeRect(Z.shed.x-95,Z.shed.y-72,190,142);
  ctx.fillStyle="#0b0d0c";ctx.fillRect(Z.shed.x-26,Z.shed.y-28,52,98);ctx.strokeStyle="#596357";ctx.strokeRect(Z.shed.x-26,Z.shed.y-28,52,98);
  ctx.fillStyle="#8f9c88";ctx.fillRect(Z.shed.x+14,Z.shed.y+18,5,5);
  ctx.fillStyle="#151915";ctx.fillRect(Z.shed.x-75,Z.shed.y-42,38,42);ctx.strokeStyle="#6c7868";ctx.strokeRect(Z.shed.x-75,Z.shed.y-42,38,42);
}

function drawGreenhouse(ctx:CanvasRenderingContext2D){
  const x=Z.greenhouse.x-140,y=Z.greenhouse.y-95,w=280,h=190;
  ctx.fillStyle="rgba(112,134,120,.08)";ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="rgba(151,169,155,.48)";ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);
  for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x+i*w/5,y);ctx.lineTo(x+i*w/5,y+h);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y-70);ctx.lineTo(x+w,y);ctx.stroke();
  ctx.fillStyle="rgba(219,232,221,.06)";ctx.fillRect(x+12,y+12,w-24,h-24);
}

function drawPond(ctx:CanvasRenderingContext2D,t:number,wrong:boolean){
  const x=Z.pond.x-190,y=Z.pond.y-110,w=380,h=220;
  const pg=ctx.createLinearGradient(0,y,0,y+h);pg.addColorStop(0,"#101b19");pg.addColorStop(1,"#040807");ctx.fillStyle=pg;ctx.beginPath();ctx.ellipse(Z.pond.x,Z.pond.y,190,110,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#46534c";ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle="rgba(185,205,195,.18)";ctx.lineWidth=2;for(let i=0;i<6;i++){const yy=Z.pond.y-48+i*18+Math.sin(t/500+i)*3;ctx.beginPath();ctx.moveTo(Z.pond.x-120+i*5,yy);ctx.lineTo(Z.pond.x+115-i*8,yy);ctx.stroke();}
  if(wrong){ctx.fillStyle="rgba(235,242,231,.72)";ctx.fillRect(Z.pond.x-12,Z.pond.y+18,8,8);ctx.fillRect(Z.pond.x+28,Z.pond.y+8,6,6);}
}

function drawHatch(ctx:CanvasRenderingContext2D,act:Act,seals:number,t:number){
  const x=Z.hatch.x,y=Z.hatch.y;
  ctx.save();ctx.translate(x,y);
  const ring=ctx.createRadialGradient(0,0,30,0,0,118);ring.addColorStop(0,"#060807");ring.addColorStop(.62,"#1d211e");ring.addColorStop(1,"#080a09");
  ctx.fillStyle=ring;ctx.beginPath();ctx.arc(0,0,118,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#646d63";ctx.lineWidth=9;ctx.stroke();
  ctx.strokeStyle="#303630";ctx.lineWidth=13;ctx.beginPath();ctx.arc(0,0,82,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.fillStyle="#90998c";ctx.beginPath();ctx.arc(Math.cos(a)*101,Math.sin(a)*101,5,0,Math.PI*2);ctx.fill();}
  const open=act>=5?Math.min(1,(act-4)/2):0;
  ctx.fillStyle="#010201";ctx.beginPath();ctx.ellipse(0,12,62,24+open*34,0,0,Math.PI*2);ctx.fill();
  if(act>=5){const mist=ctx.createRadialGradient(0,8,4,0,8,95);mist.addColorStop(0,"rgba(205,222,207,.13)");mist.addColorStop(1,"rgba(205,222,207,0)");ctx.fillStyle=mist;ctx.beginPath();ctx.arc(0,8,95+Math.sin(t/350)*5,0,Math.PI*2);ctx.fill();}
  if(act>=6){ctx.fillStyle="#e8efe3";ctx.fillRect(-24,6,7,5);ctx.fillRect(18,6,7,5);}
  ctx.strokeStyle="#dbe4d4";ctx.lineWidth=3;for(let i=0;i<seals;i++){ctx.beginPath();ctx.arc(0,0,126+i*13,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawShrine(ctx:CanvasRenderingContext2D){
  ctx.fillStyle="#151915";ctx.fillRect(Z.shrine.x-45,Z.shrine.y-28,90,86);ctx.fillStyle="#272e27";ctx.fillRect(Z.shrine.x-57,Z.shrine.y-42,114,18);
  ctx.fillStyle="#8c9889";ctx.font="11px ui-monospace";ctx.textAlign="center";ctx.fillText("DON'T ANSWER YOURSELF",Z.shrine.x,Z.shrine.y+14);
}

function drawWorld(ctx:CanvasRenderingContext2D,t:number,act:Act,power:boolean,shift:number,seals:number,sealSpawn:Point|null,wardUntil:number){
  drawGround(ctx,t,act,shift);
  for(let i=0;i<treeSeed.length;i++){let p=treeSeed[i];if(act===3&&i%4===0)p={x:p.x+(shift%2?120:-80),y:p.y+(shift%3===0?70:-45)};drawTree(ctx,p,t+i*37);}
  drawShed(ctx);drawLamp(ctx,power);drawGreenhouse(ctx);drawPond(ctx,t,act===2||act===6);drawShrine(ctx);drawHatch(ctx,act,seals,t);

  ctx.strokeStyle="rgba(93,105,94,.45)";ctx.lineWidth=4;ctx.strokeRect(130,130,WORLD.width-260,WORLD.height-240);
  for(let x=170;x<WORLD.width-150;x+=70){ctx.fillStyle="#1a201b";ctx.fillRect(x,125,6,52);ctx.fillRect(x,WORLD.height-177,6,52);}

  if(sealSpawn){ctx.save();ctx.translate(sealSpawn.x,sealSpawn.y);ctx.rotate(t/900);ctx.strokeStyle="#f0f5ec";ctx.lineWidth=3;ctx.strokeRect(-16,-16,32,32);ctx.rotate(Math.PI/4);ctx.strokeRect(-10,-10,20,20);ctx.restore();}
  if(wardUntil>Date.now()){ctx.strokeStyle="rgba(230,240,224,.8)";ctx.lineWidth=4;ctx.setLineDash([8,8]);const dest=act===1?Z.shed:act===2?Z.pond:act===3?Z.shrine:act===4?Z.lamp:act===5?(sealSpawn||Z.hatch):Z.hatch;ctx.beginPath();ctx.arc(dest.x,dest.y,55+Math.sin(t/180)*8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
}

function objectiveFor(act:Act){
  if(act===1)return "Find the fuse in the Tool Shed, then restore Lamp Court.";
  if(act===2)return "Use the Moon Pond to identify the false Friend.";
  if(act===3)return "Reach the Abandoned Shrine before the Garden seals the route.";
  if(act===4)return "When the Mimic looks at you, do not move. Reach Lamp Court.";
  if(act===5)return "Recover three containment seals, one at a time.";
  if(act===6)return "Expose the false Friend, then reach the Hatch.";
  return "";
}

export default function TheHatch({friendId,client,paused}:GameComponentProps){
  const canvas=useRef<HTMLCanvasElement>(null);
  const pos=useRef<Point>({...START});
  const mimic=useRef<Point>({...Z.grove});
  const keys=useRef(new Set<string>());
  const target=useRef<Point|null>(null);
  const cam=useRef<Point>({x:0,y:0});
  const sound=useRef<FriendSoundKit|null>(null);
  const facingRef=useRef<SpriteFacing>("up");
  const sideRef=useRef<"left"|"right">("right");
  const watcherRef=useRef(false);
  const identityStart=useRef<number|null>(null);

  const [sprites,setSprites]=useState<GenerationSprites|null>(null);
  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [act,setAct]=useState<Act>(0);
  const [menu,setMenu]=useState<Menu>(null);
  const [seconds,setSeconds]=useState(0);
  const [message,setMessage]=useState("Friend #334137 has been assigned to Garden Unit 06.");
  const [power,setPower]=useState(false);
  const [flashlight,setFlashlight]=useState(true);
  const [mapOpen,setMapOpen]=useState(false);
  const [fuseHeld,setFuseHeld]=useState(false);
  const [shift,setShift]=useState(0);
  const [watching,setWatching]=useState(false);
  const [chase,setChase]=useState(false);
  const [seals,setSeals]=useState(0);
  const [carriedSeal,setCarriedSeal]=useState(false);
  const [sealSpawn,setSealSpawn]=useState<Point|null>(null);
  const [identitySolved,setIdentitySolved]=useState(false);
  const [inventory,setInventory]=useState<Record<ItemKey,number>>({ward:0,chalk:0,bell:0,fuse:0,mirror:0});
  const [rfSpent,setRfSpent]=useState(0);
  const [xp,setXp]=useState(0);
  const [busy,setBusy]=useState(false);
  const [muted,setMuted]=useState(true);
  const [scare,setScare]=useState(false);
  const [wardUntil,setWardUntil]=useState(0);

  useEffect(()=>{
    sound.current=createFriendSoundKit({muted:true});
    void Promise.all([client.read(),createFriendReader().read(friendId)]).then(([s,sp])=>{setSnapshot(s);setSprites(sp);}).catch(()=>setMessage("Could not load the selected Friend."));
    return()=>sound.current?.dispose();
  },[client,friendId]);

  useEffect(()=>{
    const body=document.body;
    const previous=body.dataset.hatchMood;
    let mood="idle";
    if(act===1)mood=power?"powered":"blackout";
    else if(act===2)mood="reflection";
    else if(act===3)mood="shift";
    else if(act===4)mood=chase?"danger":"watching";
    else if(act===5)mood="breach";
    else if(act===6)mood=chase?"danger":"replacement";
    else if(act===7)mood="sunrise";
    else if(act===8)mood="failure";
    body.dataset.hatchMood=mood;
    return()=>{if(previous===undefined)delete body.dataset.hatchMood;else body.dataset.hatchMood=previous;};
  },[act,power,chase]);

  useEffect(()=>{
    if(seconds<=0||paused||menu||mapOpen||act===0||act>=7)return;
    const t=setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(t);
  },[seconds,paused,menu,mapOpen,act]);

  useEffect(()=>{if(seconds===0&&act>0&&act<7)lose("The night outlasted you.");},[seconds]);

  useEffect(()=>{
    if(act!==3)return;
    const t=setInterval(()=>{setShift(v=>v+1);setMessage("The hedges moved while you weren't looking.");sound.current?.play("impact");},5200);
    return()=>clearInterval(t);
  },[act]);

  useEffect(()=>{
    if(act!==4)return;
    const t=setInterval(()=>{const on=!watcherRef.current;watcherRef.current=on;setWatching(on);if(on){setMessage("It is looking at you.");sound.current?.play("reveal-common");}else setMessage("It looked away. Move.");},2800);
    return()=>clearInterval(t);
  },[act]);

  useEffect(()=>{if(!scare)return;const t=setTimeout(()=>setScare(false),520);return()=>clearTimeout(t)},[scare]);

  useEffect(()=>{
    const node=canvas.current,ctx=node?.getContext("2d");if(!node||!ctx||!sprites)return;
    let raf=0,prev=0,frameNo=0;
    const kd=(e:KeyboardEvent)=>{
      const k=e.key.toLowerCase();
      if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k))keys.current.add(k);
      if(k==="e")interact();
      if(k==="f")setFlashlight(v=>!v);
      if(k==="m")setMapOpen(v=>!v);
      if(k==="escape"){setMapOpen(false);setMenu(null);}
    };
    const ku=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);

    const loop=(now:number)=>{
      frameNo++;const dt=prev?Math.min((now-prev)/1000,.05):0;prev=now;
      const p=pos.current,before={...p};
      if(!paused&&!menu&&!mapOpen&&act>0&&act<7){
        let dx=0,dy=0;
        if(keys.current.has("a")||keys.current.has("arrowleft"))dx--;
        if(keys.current.has("d")||keys.current.has("arrowright"))dx++;
        if(keys.current.has("w")||keys.current.has("arrowup"))dy--;
        if(keys.current.has("s")||keys.current.has("arrowdown"))dy++;
        if(dx||dy)target.current=null;
        else if(target.current){dx=target.current.x-p.x;dy=target.current.y-p.y;if(Math.hypot(dx,dy)<7){target.current=null;dx=0;dy=0;}}
        const moving=!!(dx||dy);
        if(moving){
          const l=Math.hypot(dx,dy);p.x=clamp(p.x+dx/l*SPEED*dt,120,WORLD.width-120);p.y=clamp(p.y+dy/l*SPEED*dt,120,WORLD.height-120);
          facingRef.current=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
          if(facingRef.current==="left"||facingRef.current==="right")sideRef.current=facingRef.current;
        }

        if(act===4&&watcherRef.current&&moving&&!chase){setChase(true);setScare(true);setMessage("YOU MOVED.");sound.current?.play("impact");}
        if(act===4&&!chase&&near(p,Z.lamp,115)){setXp(v=>v+40);setMessage("The lamp blinds it.");setTimeout(()=>startAct(5),650);}

        if(chase||act===6){
          const m=mimic.current,vx=p.x-m.x,vy=p.y-m.y,d=Math.max(1,Math.hypot(vx,vy));
          const speed=(act===6?228:205)*dt;m.x+=vx/d*speed;m.y+=vy/d*speed;
          if(dist(p,m)<42)lose("The Mimic reached you.");
        }
        if(act===6&&!identitySolved){
          const aim=facingRef.current==="left"?Math.PI:facingRef.current==="right"?0:facingRef.current==="up"?-Math.PI/2:Math.PI/2;
          const vx=mimic.current.x-p.x,vy=mimic.current.y-p.y,ang=Math.atan2(vy,vx),delta=Math.abs(Math.atan2(Math.sin(ang-aim),Math.cos(ang-aim)));
          if(flashlight&&dist(p,mimic.current)<360&&delta<.34){
            if(identityStart.current==null)identityStart.current=now;
            if(now-identityStart.current>1200){setIdentitySolved(true);setMessage("Its pixels tear under the beam. That's the false Friend. RUN.");setScare(true);setChase(true);sound.current?.play("impact");}
          }else identityStart.current=null;
        }
        if(act===6&&identitySolved&&near(p,Z.hatch,108)){setAct(7);setChase(false);setXp(v=>v+200);setMessage("The final seal closes. Sunrise.");sound.current?.play("reward");}
      }

      cam.current={x:Math.round(clamp(p.x-VIEW.width/2,0,WORLD.width-VIEW.width)),y:Math.round(clamp(p.y-VIEW.height/2,0,WORLD.height-VIEW.height))};
      ctx.clearRect(0,0,VIEW.width,VIEW.height);ctx.save();ctx.translate(-cam.current.x,-cam.current.y);
      drawWorld(ctx,now,act,power,shift,seals,sealSpawn,wardUntil);

      if(act===2||act===4||act===6||chase){
        drawFriend(ctx,sprites,mimic.current,"down",false,0,"right",act===2?.68:.92,true);
      }
      if(act===6&&!identitySolved){
        drawFriend(ctx,sprites,{x:Z.pond.x-120,y:Z.pond.y-10},"down",false,0,"right",.6,true);
      }
      ctx.restore();

      // darkness + a real visible flashlight beam in screen space
      const sx=p.x-cam.current.x,sy=p.y-cam.current.y;
      ctx.save();
      ctx.fillStyle=power&&near(p,Z.lamp,260)?"rgba(0,0,0,.42)":"rgba(0,0,0,.76)";
      ctx.fillRect(0,0,VIEW.width,VIEW.height);
      if(flashlight){
        const ang=facingRef.current==="left"?Math.PI:facingRef.current==="right"?0:facingRef.current==="up"?-Math.PI/2:Math.PI/2;
        const length=445,spread=.40;
        const x1=sx+Math.cos(ang-spread)*length,y1=sy+Math.sin(ang-spread)*length;
        const x2=sx+Math.cos(ang+spread)*length,y2=sy+Math.sin(ang+spread)*length;

        // Cut the darkness away inside the beam and around the Friend.
        ctx.globalCompositeOperation="destination-out";
        const local=ctx.createRadialGradient(sx,sy,8,sx,sy,118);
        local.addColorStop(0,"rgba(0,0,0,1)");
        local.addColorStop(.72,"rgba(0,0,0,.78)");
        local.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=local;ctx.beginPath();ctx.arc(sx,sy,118,0,Math.PI*2);ctx.fill();

        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x1,y1);
        ctx.quadraticCurveTo(sx+Math.cos(ang)*length*1.08,sy+Math.sin(ang)*length*1.08,x2,y2);
        ctx.closePath();
        const reveal=ctx.createRadialGradient(sx,sy,30,sx,sy,length);
        reveal.addColorStop(0,"rgba(0,0,0,1)");
        reveal.addColorStop(.58,"rgba(0,0,0,.86)");
        reveal.addColorStop(1,"rgba(0,0,0,.14)");
        ctx.fillStyle=reveal;ctx.fill();

        // Visible warm-white flashlight light, instead of the old black wedge.
        ctx.globalCompositeOperation="screen";
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x1,y1);
        ctx.quadraticCurveTo(sx+Math.cos(ang)*length*1.08,sy+Math.sin(ang)*length*1.08,x2,y2);
        ctx.closePath();
        const beam=ctx.createRadialGradient(sx,sy,24,sx,sy,length);
        beam.addColorStop(0,"rgba(255,249,220,.32)");
        beam.addColorStop(.35,"rgba(255,246,206,.22)");
        beam.addColorStop(.78,"rgba(244,242,218,.10)");
        beam.addColorStop(1,"rgba(244,242,218,0)");
        ctx.fillStyle=beam;ctx.fill();

        const hotspot=ctx.createRadialGradient(sx,sy,4,sx,sy,72);
        hotspot.addColorStop(0,"rgba(255,252,231,.30)");
        hotspot.addColorStop(1,"rgba(255,252,231,0)");
        ctx.fillStyle=hotspot;ctx.beginPath();ctx.arc(sx,sy,72,0,Math.PI*2);ctx.fill();
        ctx.globalCompositeOperation="source-over";
      }
      if(act===4&&watching&&!chase){ctx.fillStyle="rgba(235,242,231,.08)";ctx.fillRect(0,0,VIEW.width,VIEW.height);}
      ctx.restore();

      // Keep the selected Rare Friend crisp and canonical above the lighting pass.
      ctx.save();
      ctx.translate(-cam.current.x,-cam.current.y);
      drawFriend(ctx,sprites,p,facingRef.current,dist(before,p)>.1,Math.floor(now/110)%8,sideRef.current);
      ctx.restore();

      raf=requestAnimationFrame(loop);
    };
    raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku)};
  },[sprites,act,menu,mapOpen,paused,power,shift,watching,chase,seals,sealSpawn,flashlight,identitySolved,wardUntil]);

  function startAct(next:Act){
    setAct(next);setMapOpen(false);setMenu(null);setChase(false);setWatching(false);watcherRef.current=false;identityStart.current=null;target.current=null;
    if(next===1){pos.current={...START};setSeconds(70);setPower(false);setFuseHeld(false);setMessage("BLACKOUT — the Garden has no power. Find the Tool Shed.");}
    if(next===2){pos.current={x:1540,y:1050};mimic.current={...Z.grove};setSeconds(65);setIdentitySolved(false);setMessage("THE WRONG FRIEND — something wearing your pixels is near the pond.");}
    if(next===3){pos.current={...START};setSeconds(70);setShift(0);setMessage("THE GARDEN MOVES — reach the Shrine.");}
    if(next===4){pos.current={x:1180,y:900};mimic.current={x:1180,y:560};setSeconds(55);setMessage("DON'T MOVE — when it looks at you, stop.");}
    if(next===5){pos.current={...START};setSeconds(90);setSeals(0);setCarriedSeal(false);setSealSpawn({x:Z.greenhouse.x-60,y:Z.greenhouse.y+80});setMessage("THE HATCH OPENS — retrieve the first seal.");}
    if(next===6){pos.current={x:Z.pond.x-260,y:Z.pond.y+150};mimic.current={x:Z.pond.x+170,y:Z.pond.y-120};setSeconds(55);setIdentitySolved(false);setChase(false);setMessage("REPLACEMENT — shine your flashlight on the false Friend long enough to expose it.");}
    sound.current?.play("select");
  }

  function startGame(){setRfSpent(0);setXp(0);setInventory({ward:0,chalk:0,bell:0,fuse:0,mirror:0});setFlashlight(true);startAct(1);}

  function lose(reason:string){
    if((inventory.bell||0)>0&&(chase||act===6)){setInventory(v=>({...v,bell:v.bell-1}));setChase(false);mimic.current={...Z.grove};setMessage(reason+" The Bell forces it back.");return;}
    setMessage(reason);setScare(true);setAct(8);setChase(false);sound.current?.play("impact");
  }

  function interact(){
    const p=pos.current;
    if(act===1){
      if(near(p,Z.shed,115)&&!fuseHeld){setFuseHeld(true);setMessage("Fuse acquired. Return to Lamp Court.");sound.current?.play("select");return;}
      if(near(p,Z.lamp,120)&&fuseHeld){setPower(true);setXp(v=>v+35);setMessage("Lamp Court restored.");sound.current?.play("reward");setTimeout(()=>startAct(2),750);return;}
    }
    if(act===2&&near(p,Z.pond,135)){
      setIdentitySolved(true);setXp(v=>v+35);setMessage("The reflection moves before the second Friend does. It is false.");setScare(true);sound.current?.play("reveal-common");setTimeout(()=>startAct(3),900);return;
    }
    if(act===3&&near(p,Z.shrine,125)){setXp(v=>v+40);setMessage("You reach the Shrine. Something behind you stops breathing.");sound.current?.play("reward");setTimeout(()=>startAct(4),850);return;}
    if(act===5){
      if(!carriedSeal&&sealSpawn&&near(p,sealSpawn,95)){setCarriedSeal(true);setSealSpawn(null);setMessage("Seal acquired. Carry it to the Hatch.");sound.current?.play("select");return;}
      if(carriedSeal&&near(p,Z.hatch,120)){
        const n=seals+1;setSeals(n);setCarriedSeal(false);setXp(v=>v+25);sound.current?.play("reward");
        if(n>=3){setMessage("Three seals lock into place. The Garden goes silent.");setTimeout(()=>startAct(6),900);}
        else{
          const next=n===1?{x:Z.pond.x+80,y:Z.pond.y+180}:{x:Z.grove.x-130,y:Z.grove.y+100};
          setSealSpawn(next);setMessage("Seal placed. Another containment mark has appeared.");
        }
        return;
      }
    }
  }

  async function buy(item:(typeof ITEMS)[number]){
    if(!snapshot||busy)return;setBusy(true);
    try{
      const units=Math.max(1,Math.round(item.cost/.1));await client.buy(BigInt(units));const plays=await client.play(BigInt(units));for(const p of plays)await client.settle(p.id);
      setSnapshot(await client.read());setInventory(v=>({...v,[item.key]:v[item.key]+1}));setRfSpent(v=>v+item.cost);setMessage(item.name+" prepared.");
    }catch(e){setMessage(e instanceof Error?e.message:"RF action failed.");}finally{setBusy(false);}
  }

  function useItem(key:ItemKey){
    if(inventory[key]<=0)return;
    if(key==="ward"){setInventory(v=>({...v,ward:v.ward-1}));setWardUntil(Date.now()+4500);setMessage("The Ward marks the safest route for a few seconds.");}
    if(key==="fuse"&&act===1){setInventory(v=>({...v,fuse:v.fuse-1}));setPower(true);setXp(v=>v+35);setMessage("Emergency Fuse restores Lamp Court.");setTimeout(()=>startAct(2),700);}
    if(key==="mirror"&&(act===2||act===6)){setInventory(v=>({...v,mirror:v.mirror-1}));setIdentitySolved(true);if(act===2){setMessage("Mirror Shard: the second Friend has no true reflection.");setTimeout(()=>startAct(3),750);}else{setMessage("Mirror Shard exposes the Mimic. RUN.");setChase(true);}}
    if(key==="chalk"&&act===5){setInventory(v=>({...v,chalk:v.chalk-1}));const n=Math.min(3,seals+1);setSeals(n);setMessage("Chalk Seal reinforces the Hatch.");if(n>=3)setTimeout(()=>startAct(6),750);}
    if(key==="bell"&&chase){setInventory(v=>({...v,bell:v.bell-1}));setChase(false);mimic.current={...Z.grove};setMessage("The Bell rings. The Mimic retreats into the trees.");}
    sound.current?.play("reveal-common");
  }

  const burn=(rfSpent*.5).toFixed(2),reward=(rfSpent*.5).toFixed(2);
  const actNames=["","BLACKOUT","THE WRONG FRIEND","THE GARDEN MOVES","DON'T MOVE","THE HATCH OPENS","REPLACEMENT","SUNRISE","REPLACED"];

  return <section className={"hatch-game act-"+act+(chase?" chase":"")}>
    <canvas ref={canvas} width={VIEW.width} height={VIEW.height} className="hatch-canvas" onPointerDown={e=>{
      if(act===0||act>=7||paused||menu||mapOpen)return;
      const r=e.currentTarget.getBoundingClientRect();target.current={x:cam.current.x+(e.clientX-r.left)*VIEW.width/r.width,y:cam.current.y+(e.clientY-r.top)*VIEW.height/r.height};
    }}/>

    {act>0&&act<7&&<>
      <div className="act-hud"><span>ACT {act}/6</span><b>{actNames[act]}</b><small>{objectiveFor(act)}</small></div>
      <div className="time-hud"><b>{String(seconds).padStart(2,"0")}</b><span>XP {xp}</span></div>
      <div className="tool-hud"><button className={flashlight?"active":""} onClick={()=>setFlashlight(v=>!v)}>F · FLASHLIGHT</button><button onClick={()=>setMapOpen(v=>!v)}>M · MAP</button></div>
      <div className="action-hud"><button onClick={()=>setMenu("inventory")}>INVENTORY</button><button onClick={()=>setMenu("store")}>RF SUPPLIES</button></div>
      <button className="interact" onClick={interact}>E · INTERACT</button>
      {act===4&&<div className={"watcher "+(watching?"danger":"")}><b>{watching?"DON'T MOVE":"MOVE"}</b><span>{watching?"It is looking at you.":"It looked away."}</span></div>}
      {act===5&&<div className="seal-hud">SEALS {seals}/3 {carriedSeal?"· CARRYING":""}</div>}
    </>}

    <div className="status">{message}</div>

    {mapOpen&&act>0&&act<7&&<div className="map-screen" onClick={()=>setMapOpen(false)}>
      <div className="map-paper">
        <span>GARDEN UNIT 06 // MAINTENANCE PLAN</span>
        <h2>THE HATCH</h2>
        <div className={"map-grid corrupt-"+Math.min(3,Math.floor(act/2))}>
          <i className="m-gate">START GATE</i><i className="m-shed">TOOL SHED</i><i className="m-lamp">LAMP COURT</i><i className="m-hatch">CENTRAL HATCH</i><i className="m-pond">MOON POND</i><i className="m-green">GREENHOUSE</i><i className="m-grove">MASK GROVE</i><i className="m-shrine">SHRINE</i>
          <b style={{left:(pos.current.x/WORLD.width*100)+"%",top:(pos.current.y/WORLD.height*100)+"%"}}>YOU</b>
          {act>=4&&<em style={{left:((pos.current.x+170)/WORLD.width*100)+"%",top:((pos.current.y-90)/WORLD.height*100)+"%"}}>YOU</em>}
        </div>
        <small>Routes are approximate. If the map disagrees with the Garden, trust neither.</small>
      </div>
    </div>}

    {scare&&<div className="flash"><div className="glitch-friend">334137</div></div>}

    {act===0&&<div className="overlay title-screen"><div className="title-card">
      <span>RARE FRIENDS PRESENTS</span><h1>THE HATCH</h1><p>A trait-bound psychological survival horror experience.</p>
      <div className="identity"><b>FRIEND #334137</b><small>MASK / GARDEN / HATCH / GEN 6</small></div>
      <p className="premise">Your Friend is the only pixelated thing here. Something under the Garden has learned its shape.</p>
      <div className="title-actions"><button onClick={startGame}>BEGIN NIGHT</button><button onClick={()=>setMenu("settings")}>SETTINGS</button></div>
      <small className="controls">WASD / ARROWS · E INTERACT · F FLASHLIGHT · M MAP · CLICK/TAP TO MOVE</small>
    </div></div>}

    {act===7&&<div className="overlay"><div className="end-card"><span>GOOD ENDING</span><h1>SUNRISE</h1><p>The Hatch closes. Morning reaches the Garden. Across the pond, your reflection stays behind.</p><div className="ledger"><b>SESSION</b><span>RF spent {rfSpent.toFixed(2)}</span><span>Simulated burn {burn}</span><span>Active Friend rewards {reward}</span><span>Watch XP {xp}</span></div><button onClick={startGame}>PLAY ANOTHER NIGHT</button></div></div>}
    {act===8&&<div className="overlay"><div className="end-card bad"><span>BAD ENDING</span><h1>REPLACED</h1><p>{message}</p><p>The Garden becomes quiet. Friend #334137 stands at the gate again — but its footsteps are half a second late.</p><button onClick={startGame}>TRY AGAIN</button></div></div>}

    {menu==="store"&&<GameMenu title="RF SUPPLY CABINET" onClose={()=>setMenu(null)}><p>Optional tactical preparation. Base game remains completable without RF.</p><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={busy} onClick={()=>void buy(i)}><b>{i.name}</b><small>{i.cost.toFixed(2)} RF · {i.desc}</small></button>)}</div><p>Simulated session: spent {rfSpent.toFixed(2)} RF · burn {burn} · rewards {reward}</p></GameMenu>}
    {menu==="inventory"&&<GameMenu title="INVENTORY" onClose={()=>setMenu(null)}><div className="grid">{ITEMS.map(i=><button key={i.key} disabled={!inventory[i.key]} onClick={()=>useItem(i.key)}><b>{i.name} × {inventory[i.key]}</b><small>{i.desc}</small></button>)}</div></GameMenu>}
    {menu==="settings"&&<GameMenu title="SETTINGS" onClose={()=>setMenu(null)}><button onClick={()=>{const n=!muted;setMuted(n);sound.current?.setMuted(n);}}>{muted?"SOUND: OFF":"SOUND: ON"}</button><p>The canonical Rare Friend sprite is preserved. The surrounding Garden, lighting and horror presentation are custom.</p></GameMenu>}
  </section>;
}
