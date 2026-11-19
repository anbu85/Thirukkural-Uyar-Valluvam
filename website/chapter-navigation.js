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

function stopMotion() {
  for (const animation of animations) animation.cancel();
  animations.clear();
}
reduced.addEventListener('change', stopMotion);

function animate(element, keyframes, duration, delay = 0) {
  const animation = element.animate(keyframes, {
    duration, delay, fill: 'both', easing: 'cubic-bezier(.22,.68,.16,1)'
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

function assemble(view, sourceArt) {
  const work = [];
  if (sourceArt) {
    const image = view.querySelector('.chapter-intro img');
    const dest = image.getBoundingClientRect();
    const scale = Math.min(2.1, sourceArt.width / dest.width);
    const x = sourceArt.left + sourceArt.width / 2 - dest.left - dest.width / 2;
    const y = sourceArt.top + sourceArt.height / 2 - dest.top - dest.height / 2;
    work.push(animate(image, [
      {transform:pose(x,y,0,0,-.16) + ' scale(' + scale + ')'}, {transform:rest}
    ], 495));
  }
  const rows = view.querySelectorAll('.verse-list > a');
  rows.forEach((row,index) => {
    const side = index % 2 ? 1 : -1;
    work.push(animate(row, [
      {transform:pose(side * Math.min(innerWidth * .18,160),65,-245,-.38,side * .35,side * .035),opacity:0},
      {transform:rest,opacity:1}
    ], 510, index * 30));
  });
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
    const art = selected?.querySelector('.art')?.getBoundingClientRect();
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
    if (canAnimate && !reduced.matches) await assemble(activeView, art);
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
