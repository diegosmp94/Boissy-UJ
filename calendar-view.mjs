import {monthGrid,shiftCalendarMonth,calendarMonthTitle,parisDateKey} from './calendar-month.mjs';
import {CLUB_TEAMS,teamRoute} from './club-teams.mjs';
const make=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);
 return node;
};
const dateForKey=key=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'UTC'})
 .format(new Date(key+'T12:00:00Z'));
const timeLabel=(item)=>{
 if(item.dateOnly)return 'Heure non précisée';
 return new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})
  .format(new Date(item.time));
};
const WEEKDAYS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
/** View never touches backend, browser storage or private identity data. */
export function mountMonthCalendar(root,{now=Date.now()}={}){
 const today=parisDateKey(now);
 const [y,m]=today.split('-').map(Number);
 let current={year:y,month:m-1},selected=today,entries=[];
 const wrap=make('section','month-calendar');
 wrap.setAttribute('aria-label','Calendrier des rencontres et événements');
 const header=make('div','month-calendar-head');
 const heading=make('h2','month-calendar-title');
 heading.setAttribute('aria-live','polite');
 const controls=make('div','month-calendar-actions');
 const prev=make('button','month-calendar-nav','← Précédent');
 const currentButton=make('button','month-calendar-nav month-calendar-today','Aujourd’hui');
 const next=make('button','month-calendar-nav','Suivant →');
 for(const b of [prev,currentButton,next])b.type='button';
 controls.append(prev,currentButton,next);header.append(heading,controls);
 const legend=make('p','month-calendar-legend',
  'Doré : rencontre ou résultat provenant d’une source externe. Bleu : événement publié par le club. Cliquez sur une date pour voir les détails.');
 const board=make('div','month-calendar-board');
 const details=make('div','month-calendar-details');
 details.setAttribute('aria-live','polite');
 wrap.append(header,legend,board,details);root.append(wrap);
 const displayItem=item=>{
  const card=make('article','month-calendar-event'+(item.external?' is-external':''));
  const title=make('h4','',item.title);
  const state=item.external
   ?(item.status==='played'?'Résultat relevé · non homologué par le club':
      item.status==='unknown'?'Rencontre passée · score non communiqué':'Source externe · à confirmer')
   :item.kind==='match'?'Match publié par le club':'Événement publié par le club';
  const meta=make('p','month-calendar-meta',state+' · '+timeLabel(item)+(item.info?' · '+item.info:''));
  const desc=make('p','',item.subtitle||'');
  card.append(title,meta,desc);
  const team=CLUB_TEAMS.find(t=>t.code===item.teamCode);
  if(team){
   const profile=make('a','month-calendar-link month-calendar-profile-link',
    'Fiche '+team.name+' ↗');
   profile.href=teamRoute(team);
   card.append(profile);
  }
  if(item.href){
   const link=make('a','month-calendar-link',item.external?'Vérifier la source ↗':'Voir la rubrique ↗');
   link.href=item.href;
   if(item.external){link.target='_blank';link.rel='noopener noreferrer';}
   card.append(link);
  }
  return card;
 };
 const redraw=()=>{
  heading.textContent=calendarMonthTitle(current.year,current.month);
  board.replaceChildren();
  for(const day of WEEKDAYS)board.append(make('span','month-calendar-weekday',day));
  const cells=monthGrid(current.year,current.month,entries);
  for(const day of cells){
   const button=make('button','month-calendar-day'+(!day.inMonth?' is-outside':'')+
    (day.key===selected?' is-selected':'')+(day.key===today?' is-today':''));
   button.type='button';button.setAttribute('aria-label',
    dateForKey(day.key)+' · '+day.entries.length+' rendez-vous');
   if(day.key===selected)button.setAttribute('aria-pressed','true');
   button.append(make('span','month-calendar-number',day.day));
   if(day.entries.length){
    const icons=make('span','month-calendar-marks');
    const confirmed=day.entries.filter(x=>!x.external).length;
    const external=day.entries.filter(x=>x.external).length;
    if(confirmed)icons.append(make('span','month-calendar-mark is-club',confirmed));
    if(external)icons.append(make('span','month-calendar-mark is-source',external));
    button.append(icons);
   }
   button.addEventListener('click',()=>{
    selected=day.key;
    if(!day.inMonth){current={year:Number(day.key.slice(0,4)),month:Number(day.key.slice(5,7))-1};}
    redraw();
   });
   board.append(button);
  }
  details.replaceChildren(make('h3','',dateForKey(selected)));
  const selectedEntries=entries.filter(x=>(x.localDay||parisDateKey(x.time))===selected);
  if(!selectedEntries.length)details.append(make('p','month-calendar-empty','Aucun match ou événement référencé pour cette date.'));
  else for(const e of selectedEntries)details.append(displayItem(e));
 };
 const selectMonth=(nextMonth)=>{
  current=nextMonth;
  const key=String(current.year)+'-'+String(current.month+1).padStart(2,'0');
  selected=key+'-01';redraw();
 };
 prev.addEventListener('click',()=>selectMonth(shiftCalendarMonth(current.year,current.month,-1)));
 next.addEventListener('click',()=>selectMonth(shiftCalendarMonth(current.year,current.month,1)));
 currentButton.addEventListener('click',()=>{current={year:y,month:m-1};selected=today;redraw()});
 redraw();
 return {update(items){
  entries=Array.isArray(items)?items:[];
  redraw();
 },element:wrap};
}
