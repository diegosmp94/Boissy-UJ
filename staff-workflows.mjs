/** Boissy-UJ — éditeurs de préparation, exclusivement en mémoire. */
import {mountSeasonPreview} from './season-workspace.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
// Compatibilité des ateliers déjà reliés à cet ancien module.
export {CLUB_TEAMS};
export function checkArticle(values){
  const title=String(values.title||'').trim(),excerpt=String(values.excerpt||'').trim();
  const body=String(values.body||'').trim();
  const errors=[];
  if(title.length<4||title.length>180)errors.push('Le titre doit comporter entre 4 et 180 caractères.');
  if(excerpt.length>400)errors.push('Le résumé ne peut pas dépasser 400 caractères.');
  if(!body||body.length>20000)errors.push('Le texte doit comporter entre 1 et 20 000 caractères.');
  if(!CLUB_TEAMS.some(t=>t.code===values.team))errors.push('Sélectionne une équipe existante.');
  return {valid:errors.length===0,errors,title,excerpt,body};
}
export function checkMatchNote(values){
  const errors=[];
  const opponent=String(values.opponent||'').trim();
  if(!CLUB_TEAMS.some(t=>t.code===values.team))errors.push('Sélectionne une équipe existante.');
  if(opponent.length<2||opponent.length>120)errors.push('Le nom de l’adversaire doit contenir entre 2 et 120 caractères.');
  if(!values.when || Number.isNaN(Date.parse(values.when)))errors.push('Renseigne une date de rencontre valide.');
  return {valid:errors.length===0,errors,opponent};
}
const el=(tag,cls='',value=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(value!==null)node.textContent=String(value);
  return node;
};
function field(name,tag='input',max=180){
  const control=document.createElement(tag);
  control.name=name;
  control.maxLength=max;
  control.className='staff-input';
  if(tag==='textarea')control.rows=5;
  return control;
}
function labeled(text,control){
  const label=el('label','staff-label',text);
  label.append(control);
  return label;
}
function teamPicker(){
  const picker=document.createElement('select');
  picker.className='staff-input';picker.name='team';
  for(const discipline of ['football','futsal']){
    const group=document.createElement('optgroup');
    group.label=discipline==='football'?'Football à 11':'Futsal';
    for(const team of CLUB_TEAMS.filter(t=>t.discipline===discipline)){
      const option=el('option','',team.name);
      option.value=team.code;
      group.append(option);
    }
    picker.append(group);
  }
  return picker;
}

function note(root){
  const warning=el('div','staff-alert');
  warning.setAttribute('role','note');
  warning.append(
    el('strong','','Simulation locale — aucune modification enregistrée'),
    el('p','','Les informations saisies restent dans cet onglet et disparaissent lors du changement de module ou de l’actualisation. N’y saisis pas de coordonnées ni d’informations personnelles de joueurs.')
  );
  root.append(warning);
}
function createButton(text){
  const button=el('button','staff-action',text);
  button.type='submit';return button;
}
function showErrors(root,errors){
  root.replaceChildren();
  root.setAttribute('role','status');
  if(errors.length){
    root.className='staff-feedback staff-feedback-error';
    const list=el('ul');
    errors.forEach(message=>list.append(el('li','',message)));
    root.append(list);
  }else root.className='staff-feedback';
}
export function mountTeamWorkspace(root){
  root.replaceChildren();
  root.append(el('h2','','Gestion des équipes · prototype'));
  note(root);
  const selector=labeled('Équipe',teamPicker());
  const division=el('p','staff-team-division');
  const boxes=el('div','staff-step-grid');
  const steps=[
    ['Effectif et licences','Réservé aux personnes habilitées. Aucun joueur ni numéro de licence n’est chargé.'],
    ['Convocations','Réponses Oui / Non / Incertain prévues, avec protection des données.'],
    ['Match Center','Fiches de match, score et statistiques à vérifier avant publication.'],
    ['Gestion des saisons','Reconduction assistée à déclencher par un administrateur.']
  ];
  for(const [name,desc] of steps){
    const card=el('div','staff-step');
    card.append(el('strong','',name),el('p','',desc));boxes.append(card);
  }
  const form=el('form','staff-form');
  form.noValidate=true;
  form.append(el('h3','','Préparer une fiche de rencontre'));
  const opponent=field('opponent','input',120);
  const when=field('when','input',80);when.type='datetime-local';
  const home=el('label','staff-checkline');
  const check=document.createElement('input');check.type='checkbox';check.name='isHome';check.checked=true;
  home.append(check,el('span','','Boissy-UJ joue à domicile'));
  form.append(labeled('Adversaire',opponent),labeled('Date et heure prévues',when),home,createButton('Prévisualiser la fiche'));
  const feedback=el('div','staff-feedback');feedback.setAttribute('aria-live','polite');
  const preview=el('div','staff-preview');preview.setAttribute('aria-live','polite');
  const selection=selector.querySelector('select');
  function updateTeam(){
    const team=CLUB_TEAMS.find(t=>t.code===selection.value);
    division.textContent=team.name+' · '+team.division+' · source '+team.source;
    preview.replaceChildren();
    feedback.replaceChildren();
  }
  selection.addEventListener('change',updateTeam);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const values={team:selection.value,opponent:opponent.value,when:when.value};
    const review=checkMatchNote(values);
    showErrors(feedback,review.errors);
    preview.replaceChildren();
    if(!review.valid)return;
    const team=CLUB_TEAMS.find(t=>t.code===values.team);
    preview.append(el('strong','','Fiche de match · aperçu non publié'),
      el('p','',check.checked?team.name+' — '+review.opponent:review.opponent+' — '+team.name),
      el('p','',new Intl.DateTimeFormat('fr-FR',{
        dateStyle:'full',timeStyle:'short',timeZone:'Europe/Paris'
      }).format(new Date(values.when))),
      el('small','','Aucune rencontre créée dans Supabase.'));
  });
  root.append(selector,division,boxes,form,feedback,preview);
  mountSeasonPreview(root);
  updateTeam();
}
export function mountMediaWorkspace(root){
  root.replaceChildren();
  root.append(el('h2','','Atelier de rédaction · prototype'));
  note(root);
  const form=el('form','staff-form');
  const team=teamPicker(),title=field('title','input',180),
    excerpt=field('excerpt','textarea',400),body=field('body','textarea',20000);
  body.rows=7;excerpt.rows=3;
  form.append(labeled('Équipe concernée',team),labeled('Titre de l’article',title),
    labeled('Résumé',excerpt),labeled('Texte de l’article',body));
  const rights=el('label','staff-checkline');
  const attestation=document.createElement('input');attestation.type='checkbox';
  rights.append(attestation,el('span','','Les contenus et éventuelles mentions de personnes ont été vérifiés (simulation uniquement).'));
  form.append(rights,createButton('Prévisualiser le brouillon'));
  const feedback=el('div','staff-feedback');feedback.setAttribute('aria-live','polite');
  const preview=el('article','staff-preview');preview.setAttribute('aria-live','polite');
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const values={team:team.value,title:title.value,excerpt:excerpt.value,body:body.value};
    const review=checkArticle(values);
    showErrors(feedback,review.errors);
    preview.replaceChildren();
    if(!review.valid)return;
    const selected=CLUB_TEAMS.find(t=>t.code===values.team);
    preview.append(el('span','staff-preview-kicker','BROUILLON LOCAL · '+selected.name),
      el('h3','',review.title));
    if(review.excerpt)preview.append(el('p','staff-preview-lead',review.excerpt));
    preview.append(el('p','staff-preview-body',review.body),
      el('small','',attestation.checked
        ? 'Déclaration de vérification cochée — ne constitue pas une validation juridique.'
        : 'Vérification des droits à effectuer avant toute publication.'),
      el('small','','Aucun article enregistré ni publié.'));
  });
  root.append(form,feedback,preview);
}
