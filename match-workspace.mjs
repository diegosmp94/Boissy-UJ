import {CLUB_TEAMS} from './staff-workflows.mjs';

/** Future RPC match field validation; UI is intentionally LOCAL only. */
const MATCH_STATES=['scheduled','played','postponed','cancelled'];
const normalize=v=>String(v??'').trim();
export function validateMatchDraft(values){
  const errors=[];
  const team=CLUB_TEAMS.find(x=>x.code===values.team);
  if(!team)errors.push('Sélectionne une équipe valide.');
  const opponent=normalize(values.opponent);
  if(opponent.length<2||opponent.length>120)
    errors.push('Le nom de l’adversaire doit compter entre 2 et 120 caractères.');
  if(!values.when||Number.isNaN(Date.parse(values.when)))
    errors.push('La date de la rencontre est obligatoire.');
  if(normalize(values.venue).length>160)
    errors.push('Le lieu ne peut pas dépasser 160 caractères.');
  if(!MATCH_STATES.includes(values.status))
    errors.push('Statut de rencontre invalide.');
  if(!['manual','fff'].includes(values.source))
    errors.push('Source invalide.');
  if(values.team==='c'&&values.source==='fff')
    errors.push('Seniors C utilise uniquement une source manuelle.');
  if(values.source==='fff'&&
    (normalize(values.reference).length<1||normalize(values.reference).length>300))
    errors.push('Une référence FFF est nécessaire (300 caractères maximum).');
  if(normalize(values.reference).length>300)
    errors.push('La référence de source est trop longue.');
  if(values.season&& !/^[0-9]{4}\/[0-9]{4}$/.test(values.season))
    errors.push('La saison doit être au format AAAA/AAAA.');
  const played=values.status==='played';
  function score(v){
    if(v===null||v===undefined||v==='')return null;
    if(!/^\d+$/.test(String(v)))return null;
    const n=Number(v);
    return Number.isInteger(n)&&n>=0&&n<=99?n:null;
  }
  const homeScore=score(values.homeScore),awayScore=score(values.awayScore);
  if(played &&(homeScore===null||awayScore===null))
    errors.push('Un résultat terminé nécessite les deux scores entre 0 et 99.');
  if(!played&&(values.homeScore!==''&&values.homeScore!=null
    ||values.awayScore!==''&&values.awayScore!=null))
    errors.push('Ne renseigne pas de score avant qu’un match soit terminé.');
  return {valid:errors.length===0,errors,
    opponent,homeScore,awayScore,team};
}
const create=(tag,className='',value)=>{
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(value!=null)n.textContent=String(value);
  return n;
};
function labeled(labelText,input){
  const l=create('label','staff-label',labelText);
  l.append(input);return l;
}
function input(name,type='text',max=160){
  const n=create('input','staff-input');
  n.name=name;n.type=type;n.maxLength=max;return n;
}
function select(name,items){
  const n=create('select','staff-input');n.name=name;
  for(const [id,label] of items){
    const o=create('option','',label);o.value=id;n.append(o);
  }
  return n;
}
export function mountMatchWorkspace(root){
  root.replaceChildren();
  root.append(create('h2','','Sports Manager · fiches de match'));
  const disclaimer=create('div','staff-alert');
  disclaimer.setAttribute('role','note');
  disclaimer.append(
    create('strong','','Prévisualisation locale — aucune modification publiée'),
    create('p','','La base Supabase conserve les saisons, les rencontres et leur historique. Cet atelier ne sauvegarde aucune donnée tant que les comptes et leurs permissions n’ont pas été validés. N’entre aucune information personnelle de joueur.')
  );
  root.append(disclaimer);
  const form=create('form','staff-form');
  form.noValidate=true;
  const team=select('team',CLUB_TEAMS.map(x=>[x.code,x.name]));
  const opponent=input('opponent','text',120);
  const when=input('when','datetime-local',80);
  const venue=input('venue','text',160);
  const season=input('season','text',9);
  season.placeholder='Ex. : 2026/2027 (facultatif)';
  const status=select('status',[
    ['scheduled','À venir'],['played','Terminé'],
    ['postponed','Reporté'],['cancelled','Annulé']
  ]);
  const source=select('source',[['manual','Saisie par le club'],['fff','Référence FFF']]);
  const reference=input('reference','text',300);
  reference.placeholder='Identifiant ou lien de référence FFF';
  const goalsWrap=create('div','staff-goals');
  const homeScore=input('homeScore','number',2),awayScore=input('awayScore','number',2);
  homeScore.min='0';homeScore.max='99';homeScore.step='1';
  awayScore.min='0';awayScore.max='99';awayScore.step='1';
  goalsWrap.append(labeled('Buts domicile',homeScore),labeled('Buts extérieur',awayScore));
  const isHome=create('label','staff-checkline');
  const homeBox=input('isHome','checkbox');homeBox.checked=true;
  isHome.append(homeBox,create('span','','Boissy-UJ reçoit'));
  const visibility=create('label','staff-checkline');
  const publishBox=input('publish','checkbox');
  visibility.append(publishBox,create('span','','Simuler une publication publique (aucune mise en ligne)'));
  const sourceRef=labeled('Référence officielle, uniquement si vérifiée',reference);
  for (const el of [
    labeled('Équipe',team),
    labeled('Adversaire',opponent),
    labeled('Date et heure',when),
    labeled('Lieu (facultatif)',venue),
    labeled('Saison (facultatif)',season),
    labeled('Statut',status),
    labeled('Origine des informations',source),sourceRef,goalsWrap,isHome,visibility
  ])form.append(el);
  const submit=create('button','staff-action','Prévisualiser la rencontre');
  submit.type='submit';form.append(submit);
  const feedback=create('div','staff-feedback');
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const preview=create('article','staff-preview');
  preview.setAttribute('aria-live','polite');
  function update(){
    const played=status.value==='played';
    goalsWrap.hidden=!played;
    if(!played){homeScore.value='';awayScore.value=''}
    if(team.value==='c'&&source.value==='fff'){source.value='manual'}
    const fff=source.value==='fff';
    sourceRef.hidden=!fff;
    if(!fff)reference.value='';
    preview.replaceChildren();
    feedback.replaceChildren();
  }
  status.addEventListener('change',update);
  source.addEventListener('change',update);
  team.addEventListener('change',update);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    preview.replaceChildren();feedback.replaceChildren();
    const values={
      team:team.value,opponent:opponent.value,when:when.value,venue:venue.value,
      season:season.value,status:status.value,source:source.value,
      reference:reference.value,homeScore:homeScore.value,awayScore:awayScore.value
    };
    const result=validateMatchDraft(values);
    if(!result.valid){
      feedback.className='staff-feedback staff-feedback-error';
      const list=create('ul');
      result.errors.forEach(m=>list.append(create('li','',m)));
      feedback.append(list);
      return;
    }
    feedback.className='staff-feedback';
    const teamName=result.team.name;
    const sideA=homeBox.checked?teamName:result.opponent;
    const sideB=homeBox.checked?result.opponent:teamName;
    preview.append(create('span','staff-preview-kicker',
      publishBox.checked?'SIMULATION PUBLIQUE — NON ENREGISTRÉE':'BROUILLON LOCAL — NON ENREGISTRÉ'),
      create('h3','',sideA+' — '+sideB),
      create('p','',new Intl.DateTimeFormat('fr-FR',{
        dateStyle:'long',timeStyle:'short'
      }).format(new Date(when.value))),
      create('p','',result.homeScore!==null
        ? 'Score : '+result.homeScore+' – '+result.awayScore
        : 'Rencontre sans résultat publié'),
      create('p','',venue.value.trim()||'Lieu à confirmer'),
      create('small','',
        season.value.trim()?'Saison proposée : '+season.value.trim():'Saison non affectée'),
      create('small','',source.value==='fff'
        ?'Source FFF saisie par le club — référence à vérifier'
        :'Source manuelle du club'),
      create('small','','Aucun changement enregistré dans Supabase. Aucun score ajouté au Match Center.')
    );
  });
  root.append(form,feedback,preview);
  update();
}
