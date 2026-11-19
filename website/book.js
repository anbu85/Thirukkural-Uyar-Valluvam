// The illustrated cover is a regular chapter link even without WebGL or motion.
const link=document.querySelector('.book-link');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let dispose;
async function setup(){
  if(reduced.matches||dispose)return;
  const T=await import('./three.module.min.js');
  const art=link.querySelector('img');
  await Promise.all([art.decode(),document.fonts.ready]);
  if(reduced.matches||dispose)return;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new T.Scene(), book=new T.Group();
  const camera=new T.PerspectiveCamera(30,1,.1,40);
  camera.position.set(0,0,7.9);
  const textureCanvas=document.createElement('canvas');
  textureCanvas.width=640;textureCanvas.height=860;
  const c=textureCanvas.getContext('2d');
  c.fillStyle='#30294c';c.fillRect(0,0,640,860);
  // A cloth grain and a foil-stamped frame remain sharp when the cover tilts.
  for(let y=0;y<860;y+=3){c.fillStyle=y%2?'#ffffff09':'#00000011';c.fillRect(0,y,640,1);}
  for(let x=0;x<640;x+=3){c.fillStyle=x%2?'#ffffff0a':'#0000000c';c.fillRect(x,0,1,860);}
  const hinge=c.createLinearGradient(0,0,53,0);
  for(const [t,col] of [[0,'#19152d'],[.24,'#524167'],[.52,'#30263f'],[.69,'#1d172d'],[1,'#302643']])hinge.addColorStop(t,col);
  c.fillStyle=hinge;c.fillRect(0,0,52,860);
  c.strokeStyle='#e3b779';c.lineWidth=3;c.strokeRect(57,22,560,811);c.lineWidth=1.5;c.strokeRect(64,29,546,797);
  for(const [x,y,sx,sy] of [[70,35,1,1],[604,35,-1,1],[70,820,1,-1],[604,820,-1,-1]]){
    c.save();c.translate(x,y);c.scale(sx,sy);c.beginPath();c.moveTo(0,42);c.bezierCurveTo(18,32,12,16,35,15);c.bezierCurveTo(12,13,18,5,43,0);c.moveTo(7,6);c.lineTo(14,13);c.lineTo(6,19);c.lineTo(0,12);c.closePath();c.stroke();c.restore();
  }
  c.fillStyle='#ead19b';c.textAlign='center';c.font='bold 52px "Tamil Sangam MN", "Noto Serif Tamil", serif';c.fillText('திருக்குறள்',337,123,450);
  // Arch-shaped illustration uses the app's actual first chapter watercolor.
  c.beginPath();c.moveTo(93,745);c.lineTo(93,335);c.bezierCurveTo(93,254,159,203,199,203);c.bezierCurveTo(238,163,280,160,337,139);c.bezierCurveTo(394,160,436,163,475,203);c.bezierCurveTo(515,203,581,254,581,335);c.lineTo(581,745);c.closePath();
  c.save();c.clip();c.fillStyle='#e8ccab';c.fillRect(90,138,500,610);c.drawImage(art,96,153,483,595);c.restore();c.lineWidth=5;c.strokeStyle='#c6a064';c.stroke();
  c.font='26px "Tamil Sangam MN",serif';c.fillText('உயர் வள்ளுவம்',337,798,380);
  const coverMap=new T.CanvasTexture(textureCanvas);coverMap.colorSpace=T.SRGBColorSpace;
  coverMap.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const pages=document.createElement('canvas');pages.width=128;pages.height=4;
  const pc=pages.getContext('2d');pc.fillStyle='#f1dfb4';pc.fillRect(0,0,128,4);
  for(let x=0;x<128;x+=3){pc.fillStyle=x%2?'#c6b08b':'#dfcaa3';pc.fillRect(x,0,1,4);}
  const edges=new T.CanvasTexture(pages);edges.colorSpace=T.SRGBColorSpace;
  const surface=(color,map)=>new T.MeshStandardMaterial({color,map:map||null,roughness:.94});
  const cloth=surface(0x382b47), edge=surface(0xffffff,edges), paper=surface(0xf3dfb7), front=surface(0xffffff,coverMap);
  function block(w,h,d,z,material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.z=z;book.add(mesh);}
  block(2.3,3.1,.07,-.15,cloth);
  block(2.25,3.03,.26,0,[edge,cloth,edge,edge,paper,paper]);
  block(2.3,3.1,.07,.15,[cloth,cloth,cloth,cloth,front,cloth]);
  scene.add(book,new T.AmbientLight(0xfff3de,1.7));
  const sun=new T.DirectionalLight(0xfff6e3,2.0);sun.position.set(-3,5,7);scene.add(sun);
  const fill=new T.DirectionalLight(0xffdfab,.6);fill.position.set(4,1,1);scene.add(fill);
  link.append(renderer.domElement);
  let tx=.12,ty=-.32,frame=0;
  book.rotation.set(tx,ty,-.095);
  function draw(){
    book.rotation.y+=(ty-book.rotation.y)*.14;book.rotation.x+=(tx-book.rotation.x)*.14;
    renderer.render(scene,camera);frame=0;
    if(Math.abs(ty-book.rotation.y)+Math.abs(tx-book.rotation.x)>.001)frame=requestAnimationFrame(draw);
  }
  function start(){if(!frame)frame=requestAnimationFrame(draw);}
  function resize(){const {width,height}=link.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.position.z=height<260?7.5:7.45;camera.updateProjectionMatrix();start();}
  function track(e){if(e.pointerType==='touch')return;const b=link.getBoundingClientRect();ty=-.32+((e.clientX-b.left)/b.width-.5)*.88;tx=.12+((e.clientY-b.top)/b.height-.5)*.38;start();}
  function reset(){tx=.12;ty=-.32;start();}
  let touch=null, dragged=false;
  function touchStart(e){
    dragged=false;
    if(e.pointerType==='touch')touch={x:e.clientX,y:e.clientY};
  }
  function touchMove(e){
    if(!touch)return;
    const dx=e.clientX-touch.x,dy=e.clientY-touch.y;
    if(!dragged && (Math.abs(dx)<10 || Math.abs(dx)<Math.abs(dy)*1.3))return;
    dragged=true;
    ty=-.32+Math.max(-1,Math.min(1,dx/90));
    start();
  }
  function touchEnd(){touch=null;reset();}
  function openCover(e){if(dragged && e.detail){e.preventDefault();dragged=false;}}
  link.addEventListener('pointerdown',touchStart);
  link.addEventListener('pointermove',touchMove);
  link.addEventListener('pointerup',touchEnd);
  link.addEventListener('pointercancel',touchEnd);
  link.addEventListener('click',openCover);
  link.addEventListener('pointermove',track);link.addEventListener('pointerleave',reset);
  const observer=new ResizeObserver(resize);observer.observe(link);resize();
  draw();link.classList.add('ready');
  dispose=()=>{
    link.classList.remove('ready');observer.disconnect();
    link.removeEventListener('pointermove',track);link.removeEventListener('pointerleave',reset);
    link.removeEventListener('pointerdown',touchStart);link.removeEventListener('pointermove',touchMove);
    link.removeEventListener('pointerup',touchEnd);link.removeEventListener('pointercancel',touchEnd);
    link.removeEventListener('click',openCover);
    cancelAnimationFrame(frame);book.children.forEach(m=>m.geometry.dispose());
    [cloth,edge,paper,front,coverMap,edges].forEach(o=>o.dispose());
    renderer.domElement.remove();renderer.dispose();dispose=null;
  };
  renderer.domElement.addEventListener('webglcontextlost',()=>dispose?.(),{once:true});
}
function preference(){if(reduced.matches)dispose?.();else setup().catch(()=>{});}
preference();reduced.addEventListener('change',preference);

