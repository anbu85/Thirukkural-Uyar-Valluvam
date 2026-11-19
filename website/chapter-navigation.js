// Keep the actual links and Tamil text in the DOM while Three.js positions them in depth.
const main = document.querySelector('main');
const library = document.querySelector('#library');
const hero = document.querySelector('.hero');
const home = new URL('./', location.href);
const libraryPaths = new Set([home.pathname, home.pathname + 'index.html']);
const homeTitle = document.title;
const skipLink = document.querySelector('.skip');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = new Map();
const animations = new Set();
let activeView;
let visit = 0;
let three;
let clearStreams;

function stopMotion() {
  clearStreams?.();
  for (const animation of animations) animation.cancel();
  animations.clear();
}
reduced.addEventListener('change', stopMotion);

function animate(element, keyframes, duration, delay = 0, easing = 'cubic-bezier(.22,.68,.16,1)') {
  const animation = element.animate(keyframes, {
    duration, delay, fill: 'both', easing
  });
  animations.add(animation);
  return animation.finished.catch(() => {});
}

function pose(x, y, z, pitch, yaw, roll = 0) {
  const object = new three.Object3D();
  object.position.set(x, y, z);
  object.rotation.set(pitch, yaw, roll);
  object.updateMatrix();
  return 'perspective(950px) matrix3d(' + object.matrix.elements.join(',') + ')';
}
const rest = 'perspective(950px) matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';

function scatter(selected) {
  const bounds = selected.getBoundingClientRect();
  const center = bounds.left + bounds.width / 2;
  const work = [];
  for (const card of library.querySelectorAll('.is-active .chapter-card')) {
    const r = card.getBoundingClientRect();
    const rail = card.parentElement.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= rail.left || r.left >= rail.right) continue;
    if (card === selected) {
      work.push(animate(card, [{transform:rest},{transform:pose(0,-8,48,-.06,0)}], 285));
    } else {
      const dx = r.left + r.width / 2 - center;
      const side = dx < 0 ? -1 : 1;
      const dy = r.top < bounds.top - 20 ? -58 : 48;
      work.push(animate(card, [
        {transform:rest,opacity:1},
        {transform:pose(side * Math.min(innerWidth * .38,390),dy,-250,-.14,side * .60,side * .08),opacity:0}
      ], 330));
    }
  }
  return Promise.all(work);
}

// Paths are in chapter coordinates, so each stream reaches its own verse at any screen width.
function drawStreams(view, flights) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = view.clientWidth;
  const height = Math.min(view.scrollHeight, Math.ceil(innerHeight * 1.5));
  const dpr = Math.min(devicePixelRatio, 1.5);
  canvas.className = 'verse-stream';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  view.append(canvas);
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  let frame;
  clearStreams = () => {
    cancelAnimationFrame(frame);
    canvas.remove();
    clearStreams = null;
  };
  const start = performance.now();
  function paint(now) {
    ctx.clearRect(0, 0, width, height);
    const elapsed = now - start;
    const emission = Math.min(1, (elapsed - 220) / 180, (flights.at(-1).delay + 180 - elapsed) / 270);
    if (emission > 0) {
      const spine = flights[0].curve.v0;
      const radius = 40;
      const glow = ctx.createRadialGradient(spine.x,spine.y,0,spine.x,spine.y,radius);
      glow.addColorStop(0,'#fff3d9');
      glow.addColorStop(.13,'#ffe5abdd');
      glow.addColorStop(.45,'#ffcbae55');
      glow.addColorStop(1,'#dcaeff00');
      ctx.globalAlpha = emission;
      ctx.fillStyle = glow;
      ctx.fillRect(spine.x-radius,spine.y-radius,radius*2,radius*2);
    }
    for (const {curve, delay, color} of flights) {
      const t = (now - start - delay) / travelTime;
      if (t <= 0 || t >= 1.27) continue;
      const head = Math.min(1, t);
      const tail = Math.max(0, t - .27);
      const p = curve.getPoint(head);
      const alpha = Math.min(1, t * 8, (1.27 - t) * 4);
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const point = curve.getPoint(tail + (head - tail) * i / 14);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      for (const [weight,opacity] of [[14,.1],[6,.22],[2.5,.55],[1,.96]]) {
        ctx.lineWidth = weight;
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * opacity;
        ctx.stroke();
      }
      const halo = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,11);
      halo.addColorStop(0,'#fff3da');
      halo.addColorStop(.24,color);
      halo.addColorStop(1,color + '00');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = halo;
      ctx.fillRect(p.x-11,p.y-11,22,22);
    }
    if (now - start < flights.at(-1).delay + travelTime * 1.27) frame = requestAnimationFrame(paint);
    else clearStreams?.();
  }
  frame = requestAnimationFrame(paint);
}

const travelTime = 570;
function assemble(view, sourceBook) {
  const work = [];
  const book = view.querySelector('.volume-open');
  const cover = book.querySelector('.front-cover');
  const viewBox = view.getBoundingClientRect();
  const dest = book.getBoundingClientRect();
  const settled = getComputedStyle(book).transform;
  if (sourceBook) {
    const dx = sourceBook.left + sourceBook.width / 2 - dest.left - dest.width / 2;
    const dy = sourceBook.top + sourceBook.height / 2 - dest.top - dest.height / 2;
    const scale = Math.max(.5,Math.min(2,sourceBook.width / dest.width));
    work.push(animate(book, [
      {transform:'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ') ' + settled},
      {transform:settled}
    ], 385));
  }
  work.push(animate(cover,[{transform:'rotateY(0deg)'},{transform:'rotateY(-150deg)'}], 510, 150));

  const start = new three.Vector2(dest.left - viewBox.left + dest.width * .12, dest.top - viewBox.top + dest.height * .45);
  const flights = [];
  view.querySelectorAll('.verse-list > a').forEach((row,index) => {
    const rect = row.getBoundingClientRect();
    const end = new three.Vector2(rect.left - viewBox.left + rect.width * .5, rect.top - viewBox.top + rect.height * .5);
    const fan = (index % 2 ? 1 : -1) * Math.min(80,viewBox.width * .13);
    const crest = new three.Vector2(start.x + fan, start.y - 72);
    const approach = new three.Vector2(end.x + fan * .8, end.y - Math.min(155,rect.top - dest.top));
    const curve = new three.CubicBezierCurve(start,crest,approach,end);
    const delay = 355 + index * 56;
    flights.push({curve,delay,color:index % 3 === 1 ? '#b9dcff' : '#ffd39c'});
    const frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const point = curve.getPoint(t);
      const scale = .065 + .935 * t * t;
      frames.push({
        offset:t,
        transform:pose(point.x - end.x,point.y - end.y,0,(1-t)*-.28,(1-t)*.22) + ' scale(' + scale + ')',
        opacity:Math.max(0,(t - .18) / .82)
      });
    }
    work.push(animate(row,frames,travelTime,delay,'linear'));
  });
  drawStreams(view,flights);
  return Promise.all(work);
}

async function loadChapter(url) {
  if (chapters.has(url)) return chapters.get(url);
  const response = await fetch(url);
  if (!response.ok) throw Error('Chapter unavailable');
  const page = new DOMParser().parseFromString(await response.text(), 'text/html');
  const node = page.querySelector('main > .chapter-view');
  if (!node || node.querySelectorAll('.verse-list > a').length !== 10) throw Error('Incomplete chapter');
  // The fetched chapter uses paths relative to its own canonical URL.
  for (const el of node.querySelectorAll('[href], [src]')) {
    const attribute = el.hasAttribute('href') ? 'href' : 'src';
    el.setAttribute(attribute, new URL(el.getAttribute(attribute), url).href);
  }
  const chapter = {node, title:page.title};
  chapters.set(url, chapter);
  return chapter;
}

// The retained library, header, search and footer continue to resolve home-relative links.
const base = document.createElement('base');
base.href = home.href;
document.head.prepend(base);

async function showChapter(url, selected) {
  const ticket = ++visit;
  const shelfY = scrollY;
  stopMotion();
  main.setAttribute('aria-busy','true');
  try {
    const [chapter, engine] = await Promise.all([
      loadChapter(url),
      reduced.matches ? null : import('./three.module.min.js').catch(() => null)
    ]);
    if (ticket !== visit) return;
    three = engine;
    const canAnimate = Boolean(selected && three && !reduced.matches && Element.prototype.animate);
    const source = selected?.querySelector('.volume, .flat-book');
    const sourceBook = source?.getBoundingClientRect();
    if (canAnimate) await scatter(selected);
    if (ticket !== visit) return;
    if (selected) {
      history.replaceState({...history.state, shelfY, shelfCard:selected.getAttribute('href'),
        shelfCover:selected.classList.contains('book-link')}, '');
      history.pushState({readerChapter:url}, '', url);
    }
    stopMotion();
    hero.hidden = library.hidden = true;
    activeView?.remove();
    activeView = chapter.node;
    main.append(activeView);
    document.title = chapter.title;
    skipLink.href = url + '#main';
    window.scrollTo({top:0,behavior:'instant'});
    const heading = activeView.querySelector('h1');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    main.removeAttribute('aria-busy');
    if (canAnimate && !reduced.matches) await assemble(activeView, sourceBook);
  } catch {
    if (ticket === visit) location.assign(url);
  } finally {
    if (ticket === visit) {
      stopMotion();
      main.removeAttribute('aria-busy');
    }
  }
}

function showLibrary(saved) {
  const ticket = ++visit;
  stopMotion();
  main.removeAttribute('aria-busy');
  activeView?.remove();
  activeView = null;
  hero.hidden = library.hidden = false;
  skipLink.href = '#main';
  document.title = homeTitle;
  window.dispatchEvent(new Event('libraryshown'));
  if (saved?.shelfCard) {
    const links = saved.shelfCover ? [hero.querySelector('.book-link')] : library.querySelectorAll('.chapter-card');
    const selected = Array.from(links).find(a => a.getAttribute('href') === saved.shelfCard);
    // History traversal can focus a URL fragment after popstate has finished.
    requestAnimationFrame(() => {
      if (ticket !== visit) return;
      selected?.focus({preventScroll:true});
      window.scrollTo({top:saved.shelfY,behavior:'instant'});
    });
  } else {
    const target = document.getElementById(location.hash.slice(1)) || document.querySelector('.brand');
    target.tabIndex = -1;
    target.focus({preventScroll:true});
    if (location.hash) target.scrollIntoView({behavior:'instant'});
    else window.scrollTo({top:0,behavior:'instant'});
    if (target.matches('a')) target.removeAttribute('tabindex');
  }
}

// Returning from a full-page couplet may rebuild the library from its saved history entry.
if (history.state?.shelfCard) showLibrary(history.state);

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
      event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  if (!activeView && link.matches('.chapter-card, .book-link')) {
    event.preventDefault();
    showChapter(link.href, link);
  } else if (activeView && libraryPaths.has(link.pathname) && link.origin === home.origin) {
    event.preventDefault();
    history.pushState(null, '', link.href);
    showLibrary();
  }
});
window.addEventListener('popstate', () => {
  if (libraryPaths.has(location.pathname)) {
    if (activeView || main.hasAttribute('aria-busy')) showLibrary(history.state);
  } else if (history.state?.readerChapter && !activeView) {
    showChapter(history.state.readerChapter);
  }
});
