/** Individual Boissy UJ public player card.
 * Supports a neutral preview and already published, consent-reviewed club data.
 * Birth dates, portraits and player-level statistics do not exist in the
 * current authorized public catalogue: these fields must NEVER be invented.
 */
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS,teamRoute,disciplineLabel} from './club-teams.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';

const REST=supabaseConfig.url+'/rest/v1/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isPublicPlayerId(value){
 return typeof value==='string'&&UUID.test(value);
}
export function playerPublicRoute(id){
 if(!isPublicPlayerId(id))throw new Error('Identifiant de fiche invalide');
 return '#/joueurs/'+id.toLowerCase();
}
const make=(tag,cls='',text=null)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==null)e.textContent=String(text);
 return e;
};
const link=(label,href,cls='player-profile-link')=>{
 const a=make('a',cls,label);a.href=href;return a;
};
async function getRows(table,params,signal,fetcher){
 const response=await fetcher(REST+table+'?'+new URLSearchParams(params),{
  method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
 });
 if(!response.ok)throw new Error('La fiche publique ne peut pas être consultée.');
 const data=await response.json();
 if(!Array.isArray(data))throw new Error('Format de fiche incorrect.');
 return data;
}
/** Only public-allowed, club-published player identities; never auth.users/profiles. */
export async function loadPublishedPlayerProfile(id,{signal,fetcher=fetch}={}){
 if(!isPublicPlayerId(id))throw new Error('Identifiant de fiche invalide');
 const people=await getRows('team_public_people',{
  select:'id,team_id,display_name,person_kind,role_label,shirt_number,biography,published,consent_confirmed',
  id:'eq.'+id,person_kind:'eq.player',published:'eq.true',consent_confirmed:'eq.true',limit:'1'
 },signal,fetcher);
 const person=people.find(p=>p.id===id&&p.person_kind==='player'
  &&p.published===true&&p.consent_confirmed===true);
 if(!person)return null;
 if(typeof person.team_id!=='string')return null;
 const teams=await getRows('club_teams',{
  select:'id,code,discipline',id:'eq.'+person.team_id,limit:'1'
 },signal,fetcher);
 const remote=teams.find(t=>t.id===person.team_id);
 const team=remote&&CLUB_TEAMS.find(t=>t.code===remote.code
  &&t.discipline===remote.discipline);
 if(!team)return null;
 return {person,team};
}
function fact(label,value){
 const item=make('div','player-profile-fact');
 item.append(make('dt','',label),make('dd','',value));
 return item;
}
export function renderPublicPlayerProfile(root,entry=null,{preview=false}={}){
 root.replaceChildren();
 const person=entry?.person||null,team=entry?.team||null;
 const nav=make('nav','player-profile-breadcrumb');
 nav.setAttribute('aria-label','Fil d’Ariane');
 nav.append(link('Équipes','#/equipes'),make('span','','›'));
 if(team)nav.append(link(team.name,teamRoute(team)),make('span','','›'));
 nav.append(make('span','','Fiche joueur'));
 root.append(nav);

 const badge=make('p','player-profile-eyebrow',preview?'APERÇU DU MODÈLE · AUCUN JOUEUR RÉEL':'FICHE PUBLIÉE PAR LE CLUB');
 const hero=make('section','player-profile-hero');
 hero.setAttribute('aria-label','Présentation du joueur');
 const portrait=make('div','player-profile-portrait');
 portrait.setAttribute('role','img');
 portrait.setAttribute('aria-label','Photographie non publiée : emplacement réservé');
 const placeholder=make('div','player-profile-portrait-icon');
 placeholder.setAttribute('aria-hidden','true');
 // Neutral identity-free portrait silhouette, not a fabricated football player.
 const circle=make('span','player-profile-avatar-head');
 const shoulders=make('span','player-profile-avatar-shoulders');
 placeholder.append(circle,shoulders);
 portrait.append(placeholder,make('span','player-profile-portrait-text','PHOTO DU JOUEUR'));
 const copy=make('div','player-profile-hero-copy');
 copy.append(badge,make('h2','',person?.display_name||'Fiche joueur'),
  make('p','player-profile-subtitle',
    team?team.name+' · '+disciplineLabel(team.discipline):'Boissy UJ · Profil de présentation'));
 const chips=make('div','player-profile-chips');
 chips.append(make('span','',person?.role_label||'Poste à renseigner'),
  make('span','',team?.division||'Équipe à renseigner'));
 copy.append(chips);
 const number=make('div','player-profile-number');
 number.setAttribute('aria-label','Numéro de maillot');
 number.append(make('small','','N° MAILLOT'),
  make('strong','',person?.shirt_number??'—'));
 hero.append(portrait,copy,number);
 root.append(hero);

 if(preview){
  const note=make('p','player-profile-preview-note',
   'Ceci est une maquette fonctionnelle : aucune identité, photographie, donnée d’âge ou statistique personnelle n’est inventée. Les informations seront visibles uniquement après validation du club et des autorisations nécessaires.');
  note.setAttribute('role','status');
  root.append(note);
 }
 const facts=make('section','player-profile-panel');
 facts.append(make('h3','','Informations sportives'));
 const dl=make('dl','player-profile-facts');
 dl.append(
  fact('Âge','Non publié'),
  fact('Poste',person?.role_label||'À renseigner'),
  fact('Équipe',team?.name||'À renseigner'),
  fact('Discipline',team?disciplineLabel(team.discipline):'À renseigner'),
  fact('Numéro',person?.shirt_number??'Non publié'),
  fact('Saison','À confirmer')
 );
 facts.append(dl);
 root.append(facts);

 const stats=make('section','player-profile-panel');
 stats.append(make('h3','','Statistiques individuelles'));
 const metrics=make('div','player-profile-stats');
 for(const label of ['Matchs joués','Buts','Passes décisives','Minutes jouées']){
  const stat=make('div','player-profile-stat');
  stat.append(make('strong','','—'),make('span','',label));
  metrics.append(stat);
 }
 stats.append(metrics,make('p','player-profile-data-note',
  'Aucune statistique individuelle validée n’est actuellement publiée. Le tiret indique une donnée indisponible, et non zéro.'));
 root.append(stats);

 const biography=make('section','player-profile-panel');
 biography.append(make('h3','','Présentation et parcours'),
  make('p','player-profile-biography',person?.biography?.trim()||
   'Présentation sportive à compléter et à autoriser avant publication.'));
 root.append(biography);

 const actions=make('nav','player-profile-actions');
 actions.setAttribute('aria-label','Navigation depuis la fiche joueur');
 actions.append(link('← Toutes les équipes','#/equipes'));
 if(team)actions.append(link('Effectif '+team.name+' ↗',teamRoute(team)));
 root.append(actions);
}
let controller=null,sequence=0;
export function unmountPublicPlayerProfile(){
 sequence++;controller?.abort();controller=null;
}
export async function mountPublicPlayerProfile(id=null){
 unmountPublicPlayerProfile();
 const root=document.getElementById('player-profile-public-root');
 if(!root)return;
 if(id===null){renderPublicPlayerProfile(root,null,{preview:true});return;}
 const current=sequence;
 const abort=new AbortController();controller=abort;
 const deadline=boundedPublicRequest(abort.signal);
 root.replaceChildren(make('p','player-profile-preview-note','Vérification des informations publiques du joueur…'));
 try{
  const entry=await loadPublishedPlayerProfile(id,{signal:deadline.signal});
  if(abort.signal.aborted||current!==sequence||!root.isConnected)return;
  if(!entry){
   root.replaceChildren(make('p','player-profile-preview-note',
    'Aucune fiche joueur publique et autorisée ne correspond à ce lien. Elle peut avoir été retirée par le club.'));
   root.append(link('← Retour aux équipes','#/equipes'));return;
  }
  renderPublicPlayerProfile(root,entry);
 }catch{
  if(abort.signal.aborted||current!==sequence||!root.isConnected)return;
  root.replaceChildren(make('p','player-profile-preview-note',
   'Fiche temporairement indisponible. Aucune information personnelle non validée n’est affichée.'));
  root.append(link('← Retour aux équipes','#/equipes'));
 }finally{deadline.dispose();}
}
