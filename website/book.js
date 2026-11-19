// The illustrated cover is a regular chapter link even without WebGL or motion.
const link=document.querySelector('.book-link');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');

// Reuse a tapered brush for each colour while the individual shafts move in waves.
function rayBrush(colour) {
  const brush = document.createElement('canvas');
  brush.width = 160;
  brush.height = 32;
  const ctx = brush.getContext('2d');
  if (!ctx) return null;
  const light = ctx.createLinearGradient(0,0,brush.width,0);
  light.addColorStop(0,'#fff5ff00');
  light.addColorStop(.26,'#fff5fff0');
  light.addColorStop(.58,colour + 'ae');
  light.addColorStop(1,colour + '00');
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.quadraticCurveTo(55,5,160,16);
  ctx.quadraticCurveTo(50,26,0,32);
  ctx.fill();
  return brush;
}

function setupShimmer() {
  const aura = document.querySelector('.book-aura');
  const colours = ['#75e2ff','#bea7ff','#ffb5e0'].map(rayBrush);
  let seed = 4019;
  function random() {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const layers = Array.from(aura.querySelectorAll('canvas'), (canvas,layer) => {
    canvas.width = 640;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    const count = layer === 0 ? 31 : 87;
    const rays = Array.from({length:count}, (_,i) => {
      const angle = 2 * Math.PI * (i + random() * .88) / count;
      const x = Math.cos(angle), y = Math.sin(angle);
      const edge = Math.min(82 / Math.abs(x),111 / Math.abs(y));
      return {
        angle, x, y, root:edge * .64, length:edge * .36 + 30 + random() * 92,
        width:layer === 0 ? 15 + random() * 22 : 2 + random() * 7,
        phase:random() * Math.PI * 2,
        brush:colours[x < -.2 && y > -.55 ? 0 : y < -.35 ? 1 : 2]
      };
    });
    return {ctx,rays,strength:layer === 0 ? .48 : 1};
  });
  if (colours.includes(null) || layers.some(layer => !layer.ctx)) return;
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  let visible = true, frame = 0, lastPaint = null, time = 0;

  function paint() {
    for (const {ctx,rays,strength} of layers) {
      ctx.resetTransform();
      ctx.clearRect(0,0,640,560);
      ctx.globalCompositeOperation = 'lighter';
      for (const ray of rays) {
        // A crest travels around the cover while neighbouring rays flicker out of phase.
        const crest = Math.sin(time * 2.7 - ray.angle * 3);
        const ripple = .60 * crest + .40 * Math.sin(time * 4.1 + ray.phase);
        const facing = pointerX * ray.x + pointerY * ray.y;
        const lean = pointerY * ray.x - pointerX * ray.y;
        const angle = ray.angle + ripple * .047 + lean * .085;
        const x = Math.cos(angle), y = Math.sin(angle);
        const length = ray.length * (1.04 + .27 * ripple + .12 * facing);
        ctx.setTransform(x,y,-y,x,320 + pointerX * 4,280 + pointerY * 4);
        ctx.globalAlpha = Math.min(1,strength * (.72 + .28 * ripple + .22 * Math.max(0,facing)));
        ctx.drawImage(ray.brush,ray.root,-ray.width / 2,length,ray.width);
      }
    }
  }

  function tick(now) {
    const elapsed = lastPaint === null ? 34 : now - lastPaint;
    if (elapsed >= 32) {
      lastPaint = now;
      const dt = Math.min(elapsed / 1000,.08);
      time += dt;
      const ease = 1 - Math.exp(-dt * 8);
      pointerX += (targetX - pointerX) * ease;
      pointerY += (targetY - pointerY) * ease;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    lastPaint = null;
    if (reduced.matches || !visible || document.hidden) {
      targetX = targetY = pointerX = pointerY = 0;
      if (reduced.matches) { time = 0; paint(); }
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function track(event) {
    if (event.pointerType === 'touch' || reduced.matches) return;
    const rect = link.getBoundingClientRect();
    const limit = value => Math.max(-1,Math.min(1,value));
    targetX = limit((event.clientX - rect.left - rect.width / 2) / (rect.height * .36));
    targetY = limit((event.clientY - rect.top - rect.height / 2) / (rect.height * .45));
  }
  function release() { targetX = targetY = 0; }
  link.addEventListener('pointermove',track);
  link.addEventListener('pointerleave',release);
  link.addEventListener('pointercancel',release);
  reduced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      aura.classList.toggle('out-of-view',!visible);
      sync();
    });
    observer.observe(link);
  }
  sync();
}
setupShimmer();

let dispose;
async function setup(){
  if(reduced.matches||dispose)return;
  const T=await import('./three.module.min.js');
  const coverImage=link.querySelector('.flat-book');
  await coverImage.decode();
  if(reduced.matches||dispose)return;
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new T.Scene(), book=new T.Group();
  const camera=new T.PerspectiveCamera(30,1,.1,40);
  camera.position.set(0,0,7.5);
  // Upload at the artwork's native size, independent of the CSS-scaled fallback.
  const coverCanvas=document.createElement('canvas');
  coverCanvas.width=coverImage.naturalWidth;
  coverCanvas.height=coverImage.naturalHeight;
  coverCanvas.getContext('2d').drawImage(coverImage,0,0);
  const cover=new T.CanvasTexture(coverCanvas);
  cover.colorSpace=T.SRGBColorSpace;
  cover.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const pages=document.createElement('canvas');pages.width=128;pages.height=4;
  const pc=pages.getContext('2d');pc.fillStyle='#e5c07e';pc.fillRect(0,0,128,4);
  for(let x=0;x<128;x+=3){pc.fillStyle=x%2?'#b7894a':'#ffe7ad';pc.fillRect(x,0,1,4);}
  const edges=new T.CanvasTexture(pages);edges.colorSpace=T.SRGBColorSpace;
  const surface=(color,map)=>new T.MeshStandardMaterial({color,map:map||null,roughness:.94});
  const binding=new T.MeshStandardMaterial({color:0xb18448,metalness:.36,roughness:.49});
  const edge=surface(0xffffff,edges), paper=surface(0xf3dfb7);
  const front=new T.MeshStandardMaterial({map:cover,metalness:.32,roughness:.54,bumpMap:cover,bumpScale:.012});
  function block(w,h,d,z,material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.z=z;book.add(mesh);}
  block(2.3,3.1,.07,-.15,binding);
  block(2.25,3.03,.26,0,[edge,binding,edge,edge,paper,paper]);
  block(2.3,3.1,.07,.15,[binding,binding,binding,binding,front,binding]);
  scene.add(book,new T.AmbientLight(0xfff3de,1.7));
  const sun=new T.DirectionalLight(0xfff1cd,2.0);sun.position.set(3.6,7,-7.5);scene.add(sun);
  const fill=new T.DirectionalLight(0xffe9d9,1.55);fill.position.set(2,3,7);scene.add(fill);
  link.append(renderer.domElement);
  const footprint=document.getElementById('book-footprint');
  const corners=[[-1.15,-1.55],[-1.15,1.55],[1.15,1.55],[1.15,-1.55]].map(([x,y])=>new T.Vector3(x,y,0));
  const point=new T.Vector3();
  // Match the book's displayed scale in the 200-unit shadow viewBox.
  const scale=200*.9/(2*camera.position.z*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
  const heightOverStone=200*(.96-.5)/scale;
  // The painted circular stone appears as an ellipse seen from a low angle.
  const surfaceSlope=(.061*819)/(.221*1920);
  function projectShadow(){
    const outline=corners.map(corner=>{
      point.copy(corner).applyQuaternion(book.quaternion);
      const distance=(point.y+heightOverStone)/sun.position.y;
      const x=(point.x-distance*sun.position.x)*scale;
      const y=(point.z-distance*sun.position.z)*scale*surfaceSlope;
      return x.toFixed(2)+','+y.toFixed(2);
    });
    footprint.setAttribute('points',outline.join(' '));
  }
  const restingShadow=footprint.getAttribute('points');
  let tx=.12,ty=-.32,frame=0;
  book.rotation.set(tx,ty,-.095);
  function draw(){
    book.rotation.y+=(ty-book.rotation.y)*.14;book.rotation.x+=(tx-book.rotation.x)*.14;
    projectShadow();renderer.render(scene,camera);frame=0;
    if(Math.abs(ty-book.rotation.y)+Math.abs(tx-book.rotation.x)>.001)frame=requestAnimationFrame(draw);
  }
  function start(){if(!frame)frame=requestAnimationFrame(draw);}
  function resize(){const {width,height}=link.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();start();}
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
    footprint.setAttribute('points',restingShadow);
    link.removeEventListener('pointermove',track);link.removeEventListener('pointerleave',reset);
    link.removeEventListener('pointerdown',touchStart);link.removeEventListener('pointermove',touchMove);
    link.removeEventListener('pointerup',touchEnd);link.removeEventListener('pointercancel',touchEnd);
    link.removeEventListener('click',openCover);
    cancelAnimationFrame(frame);book.children.forEach(m=>m.geometry.dispose());
    [binding,edge,paper,front,cover,edges].forEach(o=>o.dispose());
    renderer.domElement.remove();renderer.dispose();dispose=null;
  };
  renderer.domElement.addEventListener('webglcontextlost',()=>dispose?.(),{once:true});
}
function preference(){if(reduced.matches)dispose?.();else setup().catch(()=>{});}
preference();reduced.addEventListener('change',preference);

