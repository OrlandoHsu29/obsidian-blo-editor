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
test('release completes in a fixed duration regardless of gesture length',()=>{
 for(const length of [40,400,4000]){
  const trail=new LaserTrail();trail.begin(0,0,0);trail.move(length,0,100);
  const before=trail.sample(200);trail.end(200);assert.deepEqual(trail.sample(200),before);
  trail.end(500);assert.equal(trail.sample(200+trail.releaseDelay+trail.releaseDuration*0.5).strokes[0].progress,0.5);
  assert.equal(trail.sample(200+trail.releaseDelay+trail.releaseDuration-1).active,true);assert.equal(trail.sample(200+trail.releaseDelay+trail.releaseDuration).active,false);
 }
});
test('release sweeps forward and narrows the body with the same accelerating progress',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(400,0,100);trail.end(200);
 const draw=at=>{const s=trail.sample(at).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime,s.progress)};
 const duration=trail.releaseDuration,start=200+trail.releaseDelay,initial=draw(200),middle=draw(start+duration*0.5),later=draw(start+duration*0.7);
 assert(Math.abs(middle[0].x-100)<1);assert(later[0].x>middle[0].x);
 const width=outline=>Math.max(...outline.map(p=>Math.abs(p.y)));
 assert(Math.abs(width(middle)/width(initial)-0.75)<0.001);
 assert(Math.abs(width(later)/width(initial)-0.51)<0.001);
 const next=draw(start+duration*0.7+1);assert(next[0].x>later[0].x&&next[0].x-later[0].x<1);
 trail.begin(800,0,start+duration*0.71);const strokes=trail.sample(start+duration*0.75).strokes;
 assert.equal(strokes.length,2);assert.equal(strokes[1].progress,0);assert(strokes[0].progress>0.7);
});
test('release holds the exact visible trail briefly before sweeping and thinning',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(400,0,100);trail.end(200);
 const initial=trail.sample(200).strokes;
 assert.deepEqual(trail.sample(200+trail.releaseDelay-1).strokes,initial);
 assert.deepEqual(trail.sample(200+trail.releaseDelay).strokes,initial);
 assert(trail.sample(200+trail.releaseDelay+10).strokes[0].progress>0);
});
test('release inherits an already moving tail speed without pausing or slowing down',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(1000,0,1);
 const heldX=at=>{const s=trail.sample(at).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime)[0].x};
 const before=heldX(1499),atRelease=heldX(1500),velocity=atRelease-before;
 trail.end(1500);
 const releasedX=at=>{const s=trail.sample(at).strokes[0];return laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime,s.progress,s.initialRate)[0].x};
 assert(Math.abs(releasedX(1500)-atRelease)<1e-9);
 const first=releasedX(1501),second=releasedX(1502);
 assert(first-atRelease>=velocity);assert(first-atRelease<velocity*1.02);
 assert(second-first>first-atRelease);
 const later=releasedX(1600),next=releasedX(1601);assert(next-later>second-first);
});
test('a nearly consumed held trail finishes sooner instead of dropping below its current speed',()=>{
 const trail=new LaserTrail();trail.begin(0,0,0);trail.move(1000,0,1);trail.end(3190);
 const s=trail.sample(3191).strokes[0],outline=laserOutline(s.points,s.cutoff+trail.lifetime,trail.lifetime,s.progress,s.initialRate);
 assert(outline[0].x>995.5);assert.equal(trail.sample(3200).active,false);
});
test('long and short trails sweep the same fraction in the release duration with increasing speed',()=>{
 for(const length of [40,400,4000]){
  const points=[{x:0,y:0,time:0},{x:length,y:0,time:100}];
  const at=p=>laserOutline(points,200,1200,p);
  const a=at(0.25),b=at(0.5),c=at(0.75),late=at(0.95);
  assert(Math.abs(a[0].x/length-0.0625)<1e-9);
  assert(Math.abs(b[0].x/length-0.25)<1e-9);
  assert(Math.abs(c[0].x/length-0.5625)<1e-9);
  assert(c[0].x-b[0].x>b[0].x-a[0].x);
  // Short and long strokes narrow by the same fraction, independently of arc length.
  const width=outline=>Math.max(...outline.map(p=>Math.abs(p.y)));
  assert(Math.abs(width(a)/1.8-0.9375)<1e-9);
  assert(Math.abs(width(b)/1.8-0.75)<1e-9);
  assert(Math.abs(width(c)/1.8-0.4375)<1e-9);
  assert(Math.abs(width(late)/1.8-0.0975)<1e-9);
  assert.deepEqual(at(1),[]);
 }
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
 assert.equal(trail.sample(100).strokes[0].points.length,512);
});
