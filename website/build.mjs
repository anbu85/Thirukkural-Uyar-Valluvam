import { readFileSync as read, writeFileSync as write, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from './vendor/marked.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const out = resolve(process.argv[2] || join(repo, '_site'));
const heroCover = 'assets/thiruvalluvar-hero.webp';
const books = JSON.parse(read(join(here, 'catalog.json'), 'utf8'));
const load = path => read(join(repo, path), 'utf8').replace(/\r\n?/g, '\n');
const esc = str => String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const plain = str => str.replace(/[*_\x60]/g,'').trim();
const pad = (n, len=2) => String(n).padStart(len,'0');
const grammar = readdirSync(join(repo,'குறளில் இலக்கணம்')).filter(f=>f.endsWith('.md')).sort().map(f=>f.slice(0,-3));
const groupNotes = new Map();
const groupSources = new Map();
const search = [];
const routes = new Set();
mkdirSync(out,{recursive:true});
cpSync(join(here,'assets'),join(out,'assets'),{recursive:true});
const assetURLs = {};
for (const file of ['style.css','reader.js','book.js','chapter-navigation.js']){
  const content=read(join(here,file));
  write(join(out,'assets',file),content);
  assetURLs[file]='assets/'+file+'?v='+createHash('sha256').update(content).digest('hex').slice(0,12);
}
for (const file of ['three.module.min.js','three-LICENSE.txt']) cpSync(join(here,'vendor',file),join(out,'assets',file));
function splitSections(raw) {
  return [...raw.matchAll(/^##[ \t]+(.+?)[ \t]*\n([\s\S]*?)(?=^##[ \t]+|(?![\s\S]))/gm)]
    .map(m=>({name:m[1].trim(),body:m[2].trim()})).filter(s=>s.body && plain(s.body));
}
for(const name of readdirSync(join(repo,'இயல்')).filter(n=>/^\d+\.md$/.test(n))){
  const fields=splitSections(load('இயல்/'+name));
  const heading=fields.find(s=>s.name==='இயல்')?.body || '';
  const group=books.flatMap(b=>b.groups).find(g=>heading.includes(g.name));
  if(group){groupNotes.set(group.id,fields);groupSources.set(Number(name.slice(0,-3)),group.id);}
}
const icons={book:'M3 5c3-1 6-.7 9 1.4 3-2.1 6-2.4 9-1.4v14c-3-1.1-6-.9-9 1.1-3-2-6-2.2-9-1.1z M12 6.4v13.7',search:'M20 20l-4.5-4.5 M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0',right:'M5 12h14m-6-6 6 6-6 6',left:'M19 12H5m6-6-6 6 6 6',chev:'m9 5 7 7-7 7',close:'m6 6 12 12M18 6 6 18',expand:'m8 10 4 4 4-4'};
const icon=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
const slug = s=>plain(s).toLowerCase().replace(/[^\p{L}\p{M}\p{N} -]/gu,'').trim().replace(/\s+/g,'-');
function nativeLink(href,root){
  let decoded;
  try{decoded=decodeURI(href);}catch{return '';}
  if (href.startsWith('#')) return href;
  const external=/^https?:\/\//i.test(href);
  if(external && !/^https?:\/\/(?:github\.com|raw\.githubusercontent\.com)\/(?:anbarasu0504\/UyarValluvam|anbu85\/Thirukkural-Uyar-Valluvam)(?:\/|$)/i.test(decoded)) return href;
  const [path,fragment]=decoded.split('#');
  const m=path.match(/(?:^|\/)(குறள்|அதிகாரம்|பால்|இயல்)\/0*(\d+)\.md$/);
  let route;
  if(m){
    const n=Number(m[2]);
    if(m[1]==='குறள்' && n>=1 && n<=1330)route='kural/'+n+'/';
    if(m[1]==='அதிகாரம்' && n>=1 && n<=133)route='chapter/'+n+'/intro/';
    if(m[1]==='பால்' && n>=1 && n<=3)route='intro/book-'+n+'/';
    if(m[1]==='இயல்' && groupSources.has(n))route='intro/group-'+groupSources.get(n)+'/';
  }
  const g=grammar.findIndex(x=>path.endsWith('/'+x+'.md')||path.endsWith(x+'.md'));
  if(path.includes('குறளில் இலக்கணம்')&&g>=0)route='grammar/'+(g+1)+'/';
  if(route){
    // Two historical links to Kural 1 use a different spelling from their headings.
    const aliases={'இரு-பெயரொட்டுப்-பண்புத்தொகை':'இருபெயரொட்டுப்-பண்புத்தொகை','vaaku-thathuvam':'vaakku-thathuvam'};
    const anchor=route==='kural/1/' ? aliases[fragment] || fragment : fragment;
    return root+route+(anchor?'#'+anchor:'');
  }
  return external?href:'';
}
function youtubeEmbedURL(href) {
  if (!/^https?:\/\//i.test(href)) return;
  let url;
  try { url = new URL(href); } catch { return; }
  let id;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1);
  } else if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return;
  const embed = new URL('https://www.youtube-nocookie.com/embed/' + id);
  embed.searchParams.set('playsinline','1');
  const time = url.searchParams.get('t') || url.searchParams.get('start') || new URLSearchParams(url.hash.slice(1)).get('t') || '';
  const units = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  const start = units ? Number(units[1] || 0)*3600 + Number(units[2] || 0)*60 + Number(units[3] || 0) : /^\d+$/.test(time) ? Number(time) : 0;
  if (Number.isSafeInteger(start) && start > 0) embed.searchParams.set('start',String(start));
  return embed.href;
}
function markdown(source,root,videoContext) {
  let videoNumber = 0;
  const parser=new Marked({gfm:true,renderer:{
    html(t){return esc(t.text);},
    link(t){
      const addr=nativeLink(t.href,root);
      const embed=youtubeEmbedURL(addr);
      if (embed) {
        const title=esc(`${videoContext} · காணொளி ${++videoNumber}`);
        const label=t.text === t.href ? 'YouTube-இல் காண்க' : this.parser.parseInline(t.tokens);
        return `<span class="couplet-video"><iframe src="${esc(embed)}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><a href="${esc(addr)}">${label}</a></span>`;
      }
      const body=this.parser.parseInline(t.tokens);
      return addr?`<a href="${esc(addr)}">${body}</a>`:body;
    },
    image(t){const path=nativeLink(t.href,root);return path?`<a href="${esc(path)}">${esc(t.text||'படம்')}</a>`:esc(t.text);},
    heading(t){const label=this.parser.parseInline(t.tokens);return `<h${t.depth} id="${esc(slug(t.text))}">${label}</h${t.depth}>`;}
  }});
  return parser.parse(source);
}
function sectionsHTML(fields, root, pageTitle, skip=[]){
  return fields.filter(s=>!skip.includes(s.name)).map(s=>`<section class="note" id="${esc(slug(s.name))}"><h2>${esc(s.name)}</h2><div class="prose">${markdown(s.body,root,`${pageTitle} · ${s.name}`)}</div></section>`).join('');
}
function render(path,title,body){
  if(routes.has(path))throw Error('Duplicate route '+path);
  routes.add(path);
  const root=path?'../'.repeat(path.split('/').length):'./';
  const content=body(root);
  const coverPreload = path === '' ? `<link rel="preload" as="image" type="image/webp" href="${heroCover}" fetchpriority="high">` : '';
  const html=`<!doctype html><html lang="ta"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#15132b"><title>${esc(title)} · உயர் வள்ளுவம்</title>${coverPreload}<link rel="stylesheet" href="${root}${assetURLs['style.css']}"><script type="module" src="${root}${assetURLs['reader.js']}"></script></head><body data-root="${root}"><a class="skip" href="#main">உள்ளடக்கத்திற்குச் செல்க</a><header class="mast"><div class="bar"><a class="brand" href="${root}">${icon('book',30)} உயர் வள்ளுவம்</a><nav aria-label="முதன்மை"><a class="library-link" href="${root}#library">திருக்குறள்</a><button class="search-open" aria-label="குறள் தேடல்">${icon('search',17)} தேடல்</button></nav></div></header><main id="main">${content}</main><footer><a href="${root}">உயர் வள்ளுவம்</a><span>கற்க கசடற அறக்கட்டளை</span></footer><dialog id="search-dialog"><div class="search-head"><label for="query">குறள் தேடல்</label><button aria-label="மூடு" class="icon-button" data-close>${icon('close')}</button></div><div class="input-wrap">${icon('search')}<input type="search" id="query" placeholder="குறள் எண், சொல் அல்லது அதிகாரம்" autocomplete="off"></div><p role="status" id="status"></p><div id="results"></div></dialog></body></html>`;
  const folder=join(out,path);mkdirSync(folder,{recursive:true});write(join(folder,'index.html'),html);
}
function crumbs(root,book,group,chapter){
  const parts=[[root+'#library','திருக்குறள்'],[root+'#book-'+book.id,book.name]];
  if(group)parts.push([root+'#group-'+group.id,group.name]);
  if(chapter)parts.push([root+'chapter/'+chapter.id+'/',chapter.name]);
  return `<nav class="crumb" aria-label="வாசிப்புப் பாதை">${parts.map(([link,name])=>`<a href="${link}">${esc(name)}</a>`).join(icon('chev',12))}</nav>`;
}
const verseMarkup=lines=>lines.map(line=>`<span>${esc(line)}</span>`).join('');
const introLink=(href,title='முன்னுரை')=>`<a class="intro-link" href="${href}">${icon('book',16)} ${title} ${icon('chev',13)}</a>`;
function giltCover(root, image, label, lazy) {
  return `<span class="cover-face">
    <span class="miniature"><img ${lazy ? 'loading="lazy"' : ''} src="${image}" alt=""></span>
    <img class="cover-plate" src="${root}assets/chapter-kolam.webp" width="600" height="800" alt="">
    <b class="cover-number">${label}</b>
  </span>`;
}
function chapterBook(chapter, root, firstVerse) {
  const open = Boolean(firstVerse);
  const image = root + 'assets/chapters/' + chapter.id + '.webp';
  const number = pad(chapter.id, 2);
  return `<span class="volume${open ? ' volume-open' : ''}" aria-hidden="true">
    <span class="page-block">${open ? `<span class="manuscript"><i>✦</i>${verseMarkup(firstVerse)}</span>` : ''}</span>
    <span class="front-cover">${giltCover(root,image,number,!open)}<span class="inside-cover">${open ? `<img src="${image}" alt="">` : ''}</span></span>
  </span>`;
}
function neighbor(root,id,step){
  const target=id+step;
  if(target<1||target>1330)return '';
  return `<a href="${root}kural/${target}/" rel="${step<0?'prev':'next'}">${step<0?icon('left',16):''} குறள் ${target} ${step>0?icon('right',16):''}</a>`;
}
function intro(path,label,fields,crumb,back,backLabel,skip){
  render(path,label+' · முன்னுரை',root=>`<div class="reading">${crumb(root)}<div class="overline">முன்னுரை</div><h1>${esc(label)}</h1>${sectionsHTML(fields,root,label,skip)}<a class="text-link" href="${root}${back}">${icon('left')} ${esc(backLabel)}</a></div>`);
}
for(const book of books){
  intro('intro/book-'+book.id,book.name,splitSections(load('பால்/'+book.id+'.md')),r=>crumbs(r,book),'#book-'+book.id,book.name,['எண்','பால்']);
  for(const group of book.groups){
    if(groupNotes.has(group.id)) intro('intro/group-'+group.id,group.name,groupNotes.get(group.id),r=>crumbs(r,book,group),'#group-'+group.id,group.name,['எண்','இயல்']);
    for(const ch of group.chapters){
      const chapterPath='chapter/'+ch.id, first=ch.id*10-9;
      const fields=splitSections(load('அதிகாரம்/'+pad(ch.id,3)+'.md'));
      intro(chapterPath+'/intro',ch.name,fields,r=>crumbs(r,book,group,ch),chapterPath+'/',ch.name,['அதிகாரம் எண்','எண்']);
      const verses=Array.from({length:10},(_,i)=>{
        const id=first+i;
        const fields=splitSections(load('குறள்/'+pad(id,4)+'.md'));
        const lines=fields.find(s=>s.name==='குறள்')?.body.split('\n').map(plain).filter(Boolean);
        if(lines?.length!==2)throw Error('Check verse '+id);
        search.push([id,ch.name,lines.join(' ')]);
        return {id,fields,lines};
      });
      render(chapterPath,ch.name,root=>`<div class="reading wide chapter-view">${crumbs(root,book,group)}<div class="chapter-intro"><div><div class="overline">அதிகாரம் ${ch.id} · குறள் ${first}–${first+9}</div><h1>${esc(ch.name)}</h1>${introLink('intro/')}</div><div class="lectern">${chapterBook(ch,root,verses[0].lines)}</div></div><h2 class="list-title">குறள்கள்</h2><div class="verse-list">${verses.map(v=>`<a href="${root}kural/${v.id}/"><small>${pad(v.id,3)}</small><div class="verse">${verseMarkup(v.lines)}</div>${icon('chev',18)}</a>`).join('')}</div></div>`);
      for(const v of verses){
        render('kural/'+v.id,'குறள் '+v.id+' · '+ch.name,root=>`<div class="reading wide">${crumbs(root,book,group,ch)}<div class="reader-layout"><aside><p>${esc(ch.name)}</p><nav aria-label="இந்த அதிகாரத்தின் குறள்கள்">${verses.map(other=>`<a ${v.id===other.id?'aria-current="page"':''} href="${root}kural/${other.id}/">குறள் ${other.id}</a>`).join('')}</nav></aside><article><div class="verse-heading"><h1>குறள் ${v.id}</h1><nav aria-label="குறள் வழிசெலுத்தல்">${neighbor(root,v.id,-1)}${neighbor(root,v.id,1)}</nav></div><div class="verse main-verse">${verseMarkup(v.lines)}</div>${sectionsHTML(v.fields,root,`குறள் ${v.id}`,['குறள் எண்','குறள்','எண்'])}<nav class="neighbors">${neighbor(root,v.id,-1)}${neighbor(root,v.id,1)}</nav></article></div></div>`);
      }
    }
  }
}
grammar.forEach((g,i)=>render('grammar/'+(i+1),g,root=>`<div class="reading"><a class="text-link" href="${root}#grammar">${icon('left')} குறளில் இலக்கணம்</a><h1>${esc(g)}</h1><div class="prose">${markdown(load('குறளில் இலக்கணம்/'+g+'.md'),root,g)}</div></div>`));
if(search.length!==1330||new Set(search.map(v=>v[0])).size!==1330)throw Error('Incomplete collection');
search.sort((a,b)=>a[0]-b[0]);
write(join(out,'assets/search.json'),JSON.stringify(search));
const tabs=books.map(b=>`<a href="#book-${b.id}" data-tab="${b.id}"><span>${esc(b.name)}</span></a>`).join('');
function shelf(group) {
  return `<section class="shelf" id="group-${group.id}"><div class="shelf-head"><h3>${esc(group.name)}</h3><span class="range">அதிகாரம் ${group.chapters[0].id}–${group.chapters.at(-1).id}</span>${groupNotes.has(group.id)?introLink('intro/group-'+group.id+'/','இயல் முன்னுரை'):''}<div class="rail-controls"><button class="round" data-step="-1" aria-label="முந்தைய அதிகாரங்கள்">${icon('left',15)}</button><button class="round" data-step="1" aria-label="அடுத்த அதிகாரங்கள்">${icon('right',15)}</button></div></div><div class="rail" tabindex="0" aria-label="${esc(group.name)} அதிகாரங்கள்">${group.chapters.map(c=>`<a href="chapter/${c.id}/" class="chapter-card"><div class="art"><span class="chapter-aura" aria-hidden="true"></span>${chapterBook(c,'')}</div><div class="card-foot"><small>${pad(c.id,2)}</small><strong>${esc(c.name)}</strong>${icon('chev',15)}</div></a>`).join('')}</div></section>`;
}
const teacherIntro = `<div class="teacher-intro">
  <figure class="teacher-profile">
    <img class="teacher-portrait" src="assets/ilangai-jeyaraj-portrait.webp" width="520" height="520" alt="கம்பவாரிதி இலங்கை ஜெயராஜ் ஐயா">
    <figcaption class="teacher-credit">
      <span>கம்பவாரிதி</span>
      <strong>திரு. இலங்கை ஜெயராஜ் ஐயா</strong>
      <span>அவர்கள் நடத்தும் திருக்குறள் வகுப்புகள்</span>
    </figcaption>
  </figure>
</div>`;
const coverPreview = read(join(here,'assets/thiruvalluvar-hero-preview.webp')).toString('base64');
const heroScene = `<div class="hero-scene"><div class="hero-painting">
  <div class="pedestal-surface" aria-hidden="true">
    <svg class="book-shadow" viewBox="-100 -100 200 200" focusable="false">
      <defs>
        <polygon id="book-footprint" points="-70.56,0.81 -128.37,20.48 -24.06,22.41 33.75,2.73"/>
        <filter id="shadow-soft" x="-40%" y="-170%" width="180%" height="440%"><feGaussianBlur stdDeviation="6 3"/></filter>
        <filter id="shadow-core" x="-40%" y="-140%" width="180%" height="380%"><feGaussianBlur stdDeviation="3 1.6"/></filter>
      </defs>
      <use href="#book-footprint" opacity=".32" filter="url(#shadow-soft)"/>
      <use href="#book-footprint" opacity=".43" filter="url(#shadow-core)"/>
    </svg>
  </div>
  <div class="stage"><div class="book-aura" aria-hidden="true"><canvas></canvas><canvas></canvas></div><a class="book-link" href="chapter/1/" aria-label="கடவுள் வாழ்த்து அதிகாரத்தைத் திறக்க"><span class="flat-book" role="img" aria-label="அமர்ந்த திருவள்ளுவரின் பொற்சிலையுடன் திருக்குறள் நூல் அட்டை" style="background-image:url('data:image/webp;base64,${coverPreview}')"><img src="${heroCover}" fetchpriority="high" loading="eager" width="720" height="960" alt=""></span></a></div>
</div></div>`;
render('','திருக்குறள்',()=>`<section class="hero">${heroScene}<div class="hero-inner">${teacherIntro}</div></section><section id="library" class="catalog"><h1 class="catalog-title">திருக்குறள்</h1><nav class="book-tabs" aria-label="பால் தேர்வு">${tabs}</nav>${books.map(b=>`<section id="book-${b.id}" data-book="${b.id}" class="book-section"><div class="book-meta"><h2>${b.name}</h2>${introLink('intro/book-'+b.id+'/','பால் முன்னுரை')}</div>${b.groups.map(shelf).join('')}</section>`).join('')}<section id="grammar" class="grammar"><h2>குறளில் இலக்கணம்</h2>${grammar.map((label,i)=>`<a href="grammar/${i+1}/">${esc(label)} ${icon('chev',13)}</a>`).join('')}</section></section><script type="module" src="${assetURLs['book.js']}"></script><script type="module" src="${assetURLs['chapter-navigation.js']}"></script>`);
write(join(out,'.nojekyll'),'');
console.log(`Built ${routes.size} HTML pages, ${books.length} books, ${search.length} couplets.`);

