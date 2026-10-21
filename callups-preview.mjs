/** Convocations: public design-only demonstration, no identity or stored response. */
import {CLUB_TEAMS} from './staff-workflows.mjs';

export const CALLUP_STATES=Object.freeze([
  {code:'invited',label:'En attente',description:'Le joueur reçoit une invitation privée.'},
  {code:'confirmed',label:'Présent',description:'Le joueur confirme sa disponibilité.'},
  {code:'declined',label:'Absent',description:'Le joueur signale son indisponibilité.'},
  {code:'unsure',label:'Incertain',description:'Le joueur doit confirmer sa disponibilité.'}
]);
export function makeCallupPreview({team='a',response='invited'}={}){
  const selected=CLUB_TEAMS.find(x=>x.code===team);
  const state=CALLUP_STATES.find(x=>x.code===response);
  if(!selected||!state)return {valid:false};
  return {valid:true,team:selected.name,response:state.label,description:state.description};
}
const el=(tag,cls='',content=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(content!==null)node.textContent=String(content);
  return node;
};
export function mountCallupsPreview(parent){
  const root=el('section','callups-preview');
  root.setAttribute('aria-label','Prévisualisation des convocations');
  root.append(el('h2','','Convocations & disponibilités'));
  const banner=el('p','callups-alert','Aucune convocation réelle n’est visible dans cet aperçu public. Les invitations et les réponses restent privées et nécessiteront une connexion sécurisée.');
  root.append(banner);
  const steps=el('ol','callups-steps');
  for(const name of [
    'L’éducateur habilité sélectionne une rencontre et ses joueurs autorisés.',
    'Chaque joueur voit uniquement ses propres convocations dans son espace.',
    'Le joueur peut répondre Présent, Absent ou Incertain ; l’historique est conservé.'
  ]) steps.append(el('li','',name));
  root.append(steps);
  const form=el('form','staff-form');
  form.noValidate=true;
  const teamLabel=el('label','staff-label','Équipe — démonstration');
  const team=el('select','staff-input');
  for(const entry of CLUB_TEAMS){
    const option=el('option','',entry.name);option.value=entry.code;team.append(option);
  }
  teamLabel.append(team);
  const statusLabel=el('label','staff-label','Réponse — démonstration');
  const response=el('select','staff-input');
  for(const state of CALLUP_STATES){
    const option=el('option','',state.label);option.value=state.code;response.append(option);
  }
  statusLabel.append(response);
  const action=el('button','staff-action','Prévisualiser le statut');
  action.type='submit';
  form.append(teamLabel,statusLabel,action);
  const output=el('div','staff-preview');
  output.setAttribute('aria-live','polite');
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const result=makeCallupPreview({team:team.value,response:response.value});
    output.replaceChildren();
    if(!result.valid)return;
    output.append(el('span','staff-preview-kicker','EXEMPLE DE FLUX · AUCUNE INVITATION CRÉÉE'),
      el('h3','',result.team),
      el('strong','callups-preview-status',result.response),
      el('p','',result.description),
      el('small','','Aucun joueur, prénom, téléphone ou statut réel n’est enregistré.'));
  });
  root.append(form,output);
  parent.append(root);
}
