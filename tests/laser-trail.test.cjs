const {test}=require('node:test'),assert=require('node:assert/strict'),{buildSync}=require('esbuild'),Module=require('node:module');
const loaded=new Module('laser-trail.cjs');loaded._compile(buildSync({entryPoints:['src/presentation/laser-trail.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,'laser-trail.cjs');
const {LaserTrail,laserOutline}=loaded.exports;
test('idle animation reuses immutable gesture snapshots and invalidates them on input',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(100,0,10);
 const first=trail.sample(20).strokes[0].points;assert.equal(trail.sample(30).strokes[0].points,first);
 const outline=laserOutline(first,30,trail.lifetime);assert.deepEqual(laserOutline(first,30,trail.lifetime),outline);
 trail.move(200,0,40);const next=trail.sample(50).strokes[0].points;
 assert.notEqual(next,first);assert.equal(first.length,2);assert.equal(next.length,3);
 trail.clear();assert.equal(trail.sample(60).active,false);
});
test('laser only draws while held, then fades and becomes idle',()=>{
 const trail=new LaserTrail();trail.move(10,10,0);assert.equal(trail.sample(0).active,false);
 trail.begin(0,0,0);trail.move(10,20,100);trail.end(100);trail.move(40,50,200);
 const first=trail.sample(100);assert.equal(first.strokes.length,1);assert(first.strokes[0].points.at(-1).x>8&&first.strokes[0].points.at(-1).x<=10);
 assert.equal(trail.sample(400).active,true);
 assert.equal(trail.sample(1400).active,false);assert.equal(trail.sample(1400).strokes.length,0);
});
test('a fast gesture disappears from its oldest end while its newer end remains full',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);for(let x=20;x<=400;x+=20)trail.move(x,0,1);
 const initial=trail.sample(1).strokes[0].points,firstTime=initial[0].time,lastTime=initial.at(-1).time;
 assert(lastTime-firstTime>600);
 const midway=trail.sample(1250).strokes[0].points;assert.equal(midway.at(-1).x,initial.at(-1).x);
 const outline=laserOutline(midway,1250,trail.lifetime);
 assert(outline[0].x>initial[0].x);
 assert(Math.max(...outline.filter(p=>p.x>300).map(p=>Math.abs(p.y)))>1.7);
 assert.equal(trail.sample(lastTime+trail.lifetime+1).active,false);
});
test('small pointer jitter is suppressed while real motion remains responsive',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(0.3,-0.2,1);trail.move(-0.2,0.3,2);
 assert.equal(trail.sample(2).strokes[0].points.length,1);
 trail.move(30,0,3);const end=trail.sample(3).strokes[0].points.at(-1);assert(end.x>29&&end.x<30);
});
test('release thins immediately and a new stroke can overlap it',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(400,0,100);
 const draw=at=>{const s=trail.sample(at).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime,s.progress)};
 const initial=draw(200);
 trail.end(200);assert.deepEqual(draw(200),initial);
 const width=outline=>Math.max(...outline.map(p=>Math.abs(p.y)));
 assert(width(draw(201))<width(initial));
 assert(Math.abs(width(draw(500))/width(initial)-0.5)<0.001);
 assert.equal(draw(500)[0].x,initial[0].x);
 trail.begin(800,0,550);
 assert.equal(trail.sample(600).strokes.length,2);
 assert.equal(trail.sample(800).strokes.length,1);
});

test('release keeps a moving tail in place while older ink gets thinner first',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(1000,0,1);
 const draw=at=>{const s=trail.sample(at).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime,s.progress)};
 const before=draw(1499),initial=draw(1500);
 assert(initial[0].x>before[0].x);
 trail.end(1500);
 assert.deepEqual(draw(1500),initial);
 const left=outline=>outline.slice(0,(outline.length-7)/2);
 const middle=left(draw(1800)),late=left(draw(2040));
 assert.deepEqual(middle.map(p=>p.x),left(initial).map(p=>p.x));
 assert(middle.slice(1).every(p=>p.y>0));
 assert(late.slice(1,4).every(p=>p.y===0));assert(late.at(-1).y>0);
 assert.equal(trail.sample(2100).active,false);
});
test('a sparse straight trail erases continuously between input samples',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(100,0,1);trail.move(200,0,2);trail.move(300,0,3);
 let lastX=0;
 for(let time=1210;time<=1600;time+=10){
   const sample=trail.sample(time),outline=laserOutline(sample.strokes[0].points,sample.time,trail.lifetime);
   assert(outline[0].x>lastX);assert(outline[0].x-lastX<6);lastX=outline[0].x;
 }
 // Retained controls must not keep an expired stroke animating.
 assert.equal(trail.sample(2200).active,false);
});
test('ribbon has a pointed tail, a fuller head and shrinks as it ages',()=>{
 const points=[{x:0,y:0,time:0},{x:80,y:0,time:0},{x:160,y:0,time:0}];
 const outline=laserOutline(points,0,1200),aged=laserOutline(points,1000,1200);
 assert.deepEqual(outline[0],{x:0,y:0});assert.deepEqual(outline.at(-1),{x:0,y:0});
 const widthNear=x=>Math.max(...outline.filter(p=>Math.abs(p.x-x)<4).map(p=>Math.abs(p.y)));
 assert(widthNear(10)<widthNear(80));assert(Math.max(...aged.map(p=>Math.abs(p.y)))<Math.max(...outline.map(p=>Math.abs(p.y))));
 assert(outline.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('separate strokes never acquire a connecting line',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(10,10,1);trail.end(1);trail.begin(100,100,2);trail.move(110,110,3);
 assert.equal(trail.sample(3).strokes.length,2);trail.clear();assert.equal(trail.sample(4).active,false);
});
test('long pointer bursts have bounded memory and per-frame drawing work',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);for(let i=0;i<10000;i++)trail.move(i,i,i/100);
 const points=trail.sample(100).strokes[0].points;
 assert(points.length<=512);assert.equal(points[0].x,0);
 assert(points.at(-1).time<2200);
});

test('dense held trails ramp up through both configured rates',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);
 const cutoff=time=>trail.sample(time).strokes[0].cutoff;
 for(let i=1;i<=319;i++)trail.move(i*3,0,i);
 const first=cutoff(319);
 assert.equal(cutoff(329)-first,12.5);
 for(let i=330,count=320;count<=415;i++,count++)trail.move(count*3,0,i);
 const second=cutoff(425);
 assert(Math.abs(cutoff(435)-second-16)<1e-9);
});

test('a long held stroke still recedes while the pointer stays stationary',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);
 for(let time=1;time<=4000;time++)trail.move(time*1.5,0,time);
 const tail=time=>{const s=trail.sample(time).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime)[0].x};
 const before=tail(4000),after=tail(4016);
 assert(after>before);assert(Math.abs(tail(4032)-after-(after-before))<0.5);
});

test('resuming preserves one ribbon and restores full tip width immediately after expiry',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(100,0,50);
 const initialTip=trail.sample(50).strokes[0].points.at(-1);
 assert.equal(trail.sample(1500).active,false);
 trail.move(115,0,1510);
 const draw=time=>{
  const strokes=trail.sample(time).strokes;assert.equal(strokes.length,1);
  const s=strokes[0],ribbon=laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime);
  assert(Math.max(...ribbon.map(point=>point.y))>1.79);
  return s.points;
 };
 assert.equal(draw(1510)[0].x,initialTip.x);
 trail.move(200,0,1910);assert.equal(draw(1910).length,3);
});
