const root = document.body.dataset.root;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const tabs = [...document.querySelectorAll('[data-tab]')];
const books = [...document.querySelectorAll('[data-book]')];
function updateBook() {
  const target = document.getElementById(location.hash.slice(1));
  const active = target?.closest('[data-book]') || books.find(b=>!b.hidden) || books[0];
  for(const book of books){
    book.hidden=book!==active;
    book.classList.toggle('is-active',!book.hidden);
  }
  for(const tab of tabs){
    if(tab.dataset.tab===active?.dataset.book) tab.setAttribute('aria-current','true');
    else tab.removeAttribute('aria-current');
  }
}
if(books.length){
  updateBook();
  for(const tab of tabs) tab.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    if(tab.hash!==location.hash)history.pushState(null,'',tab.hash);
    updateBook();
    requestAnimationFrame(updateRails);
  });
  addEventListener('hashchange',()=>{
    updateBook();
    requestAnimationFrame(()=>{updateRails();document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'});});
  });
  if(location.hash) requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'}));
}
const railUpdates=[];
function updateRails(){for(const fn of railUpdates)fn();}
for(const shelf of document.querySelectorAll('.shelf')){
  const rail=shelf.querySelector('.rail');
  const controls=shelf.querySelector('.rail-controls');
  const [prev,next]=controls.querySelectorAll('button');
  function sync(){
    if(!rail.clientWidth)return;
    const max=rail.scrollWidth-rail.clientWidth;
    controls.hidden=max<3;
    prev.disabled=rail.scrollLeft<2;
    next.disabled=rail.scrollLeft>max-2;
  }
  controls.addEventListener('click',e=>{
    const step=e.target.closest('[data-step]')?.dataset.step;
    if(step)rail.scrollBy({left:rail.clientWidth*.91*Number(step),behavior:reduced.matches?'instant':'smooth'});
  });
  rail.addEventListener('scroll',sync,{passive:true});
  new ResizeObserver(sync).observe(rail);
  railUpdates.push(sync);
}
updateRails();

const open=document.querySelector('.search-open');
const dialog=document.getElementById('search-dialog');
const input=document.getElementById('query');
const results=document.getElementById('results');
const status=document.getElementById('status');
let rows,loading;
const normalize=s=>s.normalize('NFC').toLocaleLowerCase('ta').replace(/[௦-௯]/g,d=>String(d.charCodeAt(0)-0x0be6)).trim();
function showResults(){
  results.replaceChildren();
  if(!rows)return;
  const q=normalize(input.value);
  if(!q){status.textContent='குறள் எண் அல்லது தமிழ்ச் சொல்லை உள்ளிடுக.';return;}
  const numeric=/^\d+$/.test(q);
  const matches=rows.filter(([n,chapter,text])=>numeric?n===Number(q):normalize(chapter+' '+text).includes(q));
  status.textContent=matches.length===1?'1 முடிவு':matches.length?matches.length>35?`${matches.length} முடிவுகள் · முதல் 35`:`${matches.length} முடிவுகள்`:'முடிவுகள் இல்லை';
  for(const [id,chapter,verse] of matches.slice(0,35)){
    const link=document.createElement('a'), label=document.createElement('small');
    label.textContent='குறள் '+id+' · '+chapter;
    link.href=root+'kural/'+id+'/';
    link.append(label,document.createTextNode(verse));
    results.append(link);
  }
}
async function searchOpen(){
  if(!dialog.open)dialog.showModal();
  input.focus();
  if(rows){showResults();return;}
  status.textContent='தேடல் தயாராகிறது…';
  try{
    loading??=fetch(root+'assets/search.json').then(r=>{if(!r.ok)throw Error('search');return r.json();});
    rows=await loading;
    showResults();
  }catch{
    loading=null;status.textContent='தேடலை ஏற்ற முடியவில்லை. மூடிவிட்டு மீண்டும் திறக்கவும்.';
  }
}
open.addEventListener('click',searchOpen);
dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}});
input.addEventListener('input',showResults);
input.addEventListener('keydown',event=>{const first=results.querySelector('a');if(first&&event.key==='Enter')first.click();if(first&&event.key==='ArrowDown'){event.preventDefault();first.focus();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.altKey&&!event.metaKey&&!event.ctrlKey&&!['INPUT','TEXTAREA'].includes(event.target.tagName)){event.preventDefault();searchOpen();}});

