import { supabaseConfig } from "./auth-config.mjs";
import {authRedirectUrl,authCallbackError,hasAuthCallback,validateAuthInput} from "./auth-flow.mjs";
import {mountMemberRoleRequests} from './role-workflow.mjs';
import {mountAdminRoleModeration} from './admin-role-moderation.mjs';
import {mountAuthenticatedClubIdentityEditor} from './club-editor.mjs';
import {mountAuthenticatedTeamPeopleEditor} from './team-person-editor.mjs';

let clientPromise;
let mounted = null;
let generation = 0;
let recoveryMode = false;
const RECOVERY_KEY = 'boissy-uj-recovery-requested';
const getRecoveryIntent=()=>{try{return window.sessionStorage.getItem(RECOVERY_KEY)==='1';}catch{return false;}};
const setRecoveryIntent=value=>{try{if(value)window.sessionStorage.setItem(RECOVERY_KEY,'1');else window.sessionStorage.removeItem(RECOVERY_KEY);}catch{}};

function safeMessage(error) {
  if (!error) return "";
  const code = String(error.code || "").toLowerCase();
  if (["invalid_credentials", "invalid_grant"].includes(code)) return "Adresse e-mail ou mot de passe incorrect.";
  if (code === "email_not_confirmed") return "Vérifie ton adresse e-mail avant de te connecter.";
  if (code.includes("rate_limit") || code.includes("over_request")) return "Trop de tentatives : réessaie plus tard.";
  if (code === "weak_password") return "Choisis un mot de passe plus robuste.";
  if (code === "email_address_invalid") return "Cette adresse e-mail n’est pas valide.";
  if (code === "email_provider_disabled" || code === "signup_disabled") return "Les inscriptions par e-mail sont momentanément indisponibles.";
  if (code === "over_email_send_rate_limit") return "Limite d’envois atteinte. Réessaie plus tard.";
  if (code === "email_exists" || code === "user_already_exists") return "Cette adresse est déjà associée à un compte. Essaie la connexion.";
  return "L'opération n'a pas pu aboutir. Vérifie les informations et réessaie.";
}

async function client() {
  if (!supabaseConfig.enabled) throw new Error("L'authentification est temporairement désactivée.");
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
      }))
      .catch(error => { clientPromise = null; throw error; });
  }
  return clientPromise;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function field(labelText, name, type, autocomplete, required = true) {
  const wrap = el("label", "auth-field");
  wrap.append(el("span", "", labelText));
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  input.autocomplete = autocomplete;
  input.required = required;
  input.maxLength = type === "password" ? 128 : 160;
  if (type === "password") input.minLength = 8;
  if (type === "email") input.inputMode = "email";
  wrap.append(input);
  return wrap;
}

function button(label, className = "auth-submit", type = "submit") {
  const b = el("button", className, label);
  b.type = type;
  return b;
}

function alertFor(root, message, isError = false) {
  const area = root.querySelector("[data-auth-status]");
  if (!area) return;
  area.textContent = message;
  area.dataset.error = String(isError);
}

function authCard(root, mode = "login") {
  root.replaceChildren();
  const title = {
    login: "Se connecter", register: "Créer un compte supporter",
    reset: "Réinitialiser son mot de passe", newPassword: "Choisir un nouveau mot de passe"
  }[mode];
  const head = el("div", "auth-head");
  head.append(el("span", "tiny-label", "COMPTE BOISSY-UJ"), el("h2", "", title));
  const status = el("div", "auth-status");
  status.dataset.authStatus = "";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const form = el("form", "auth-form");
  form.dataset.authMode = mode;
  form.noValidate = false;
  if (mode === "register"){
    const name=field("Nom d'affichage", "display_name", "text", "nickname");
    name.querySelector('input').minLength=2;
    form.append(name);
  }
  if (mode !== "newPassword") form.append(field("Adresse e-mail", "email", "email", "email"));
  if (["login", "register", "newPassword"].includes(mode)) form.append(field(mode === "newPassword" ? "Nouveau mot de passe (8 caractères minimum)" : "Mot de passe (8 caractères minimum)", "password", "password", mode === "register" || mode === "newPassword" ? "new-password" : "current-password"));
  form.append(button({
    login: "Connexion", register: "Créer le compte",
    reset: "Envoyer le lien de récupération", newPassword: "Mettre à jour le mot de passe"
  }[mode]));
  const actions = el("div", "auth-links");
  if (mode !== "login" && mode !== "newPassword") actions.append(button("Retour à la connexion", "auth-text-button", "button"));
  if (mode === "login") {
    actions.append(button("S'inscrire", "auth-text-button", "button"));
    actions.append(button("Mot de passe oublié", "auth-text-button", "button"));
  }
  root.append(head, status, form, actions, el("p", "auth-footnote", "Préversion : confirmation par e-mail et liens de récupération sous réserve de la configuration Supabase. Aucun paiement actif."));
  const switches = actions.querySelectorAll("button");
  switches.forEach(b => b.addEventListener("click", () => {
    const value = b.textContent;
    if (value === "S'inscrire") authCard(root, "register");
    else if (value === "Mot de passe oublié") authCard(root, "reset");
    else authCard(root, "login");
  }));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    alertFor(root, "Opération en cours…");
    const formData = new FormData(form);
    const review=validateAuthInput(mode,{
      email:formData.get("email"),password:formData.get("password"),
      displayName:formData.get("display_name")
    });
    if(!review.valid){
      alertFor(root,review.errors[0],true);
      submit.disabled=false;return;
    }
    const {email,password}=review;
    try {
      const api = await client();
      let result;
      // Callback volontairement SANS hash : Supabase renvoie ?code=... avant le router.
      const redirectTo = authRedirectUrl(window.location);
      if (mode === "login") {setRecoveryIntent(false);result = await api.auth.signInWithPassword({ email, password });}
      if (mode === "register") {
        setRecoveryIntent(false);
        result = await api.auth.signUp({ email, password, options: {
          data: { display_name: review.displayName }, emailRedirectTo: redirectTo
        } });
      }
      if (mode === "reset") {
        setRecoveryIntent(true);
        result = await api.auth.resetPasswordForEmail(email,{redirectTo});
      }
      if (mode === "newPassword") result = await api.auth.updateUser({ password });
      form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
      if (result?.error) {
        if(mode==='reset')setRecoveryIntent(false);
        alertFor(root, safeMessage(result.error), true);
        return;
      }
      if (mode === "register") {
        alertFor(root, "Demande reçue. Si une confirmation est nécessaire, consulte les messages de ta boîte e-mail.");
      } else if (mode === "reset") {
        alertFor(root, "Si cette adresse possède un compte, un lien de récupération sera envoyé.");
      } else if (mode === "newPassword") {
        recoveryMode = false;setRecoveryIntent(false);
        alertFor(root, "Mot de passe mis à jour.");
        await showSession(root, api);
      } else {
        await showSession(root, api);
      }
    } catch (error) {
      if(mode==='reset')setRecoveryIntent(false);
      alertFor(root, safeMessage(error), true);
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  });
}

async function showSession(root, api) {
  const { data: { user }, error } = await api.auth.getUser();
  if (error || !user) { authCard(root, "login"); return; }
  const [profileResult, rolesResult] = await Promise.all([
    api.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    api.from("user_roles").select("role").eq("user_id", user.id)
  ]);
  if (!root.isConnected) return;
  root.replaceChildren();
  const account = el("div", "auth-signed-in");
  account.append(el("span", "tiny-label", "MON ESPACE PERSONNEL"));
  account.append(el("h2", "", profileResult.data?.display_name || "Bienvenue au club"));
  account.append(el("p", "auth-email", user.email || ""));
  const roles = (rolesResult.data || []).map(x => x.role);
  const roleNames = { supporter: "Supporter", player: "Joueur", coach: "Éducateur", admin: "Administrateur" };
  account.append(el("p", "auth-role-summary", "Rôles : " + (roles.length ? roles.map(x => roleNames[x] || x).join(", ") : "en cours de chargement")));
  if (profileResult.error || rolesResult.error) account.append(el("p", "auth-warning", "Impossible de vérifier toutes les informations du profil pour le moment."));
  if (roles.includes("admin")) account.append(el("p", "auth-warning",
    supabaseConfig.adminEnabled
      ?"Les fonctions administratives exigent un second facteur MFA AAL2 ; le simple rôle admin ne donne pas accès aux opérations protégées."
      :"La connexion est disponible, mais les outils administrateurs restent temporairement désactivés avant leur recette MFA."));
  account.append(el("p", "auth-footnote", "Aucun abonnement premium n'est actif par défaut. Les autorisations sont contrôlées par Supabase."));
  const signOut = button("Se déconnecter", "auth-submit", "button");
  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    const { error: signOutError } = await api.auth.signOut();
    if (signOutError) {
      signOut.disabled = false;
      account.append(el("p", "auth-warning", safeMessage(signOutError)));
    } else {recoveryMode=false;setRecoveryIntent(false);authCard(root, "login");}
  });
  account.append(signOut);
  root.append(account);
  void mountMemberRoleRequests(account,api,user.id);
  void mountAdminRoleModeration(account,api,user.id);
  // L'éditeur réel est monté uniquement après vérification MFA AAL2 et rôle admin ; RPC = autorité finale.
  void mountAuthenticatedClubIdentityEditor(account,api,user.id);
  void mountAuthenticatedTeamPeopleEditor(account,api,user.id);
}

export function authMarkup() {
  return `<div class="auth-layout"><div class="account-mark"><img src="./assets/ecusson-boissy-uj.webp" alt="Écusson Boissy-UJ" width="122" height="122" /><span>VOTRE CLUB.<br>VOTRE ESPACE.</span></div><div class="detail-card auth-card" data-auth-root><div class="auth-loading" role="status">Chargement de votre espace sécurisé…</div></div></div>`;
}

export async function mountAuth() {
  generation+=1;
  const turn=generation;
  if(mounted?.subscription)mounted.subscription.unsubscribe();
  mounted=null;
  const root=document.querySelector('[data-auth-root]');
  if(!root)return;
  if(!supabaseConfig.enabled){
    root.replaceChildren(
      el('span','tiny-label','PRÉVERSION BOISSY-UJ'),
      el('h2','','Mon espace arrive bientôt'),
      el('p','auth-footnote','Les inscriptions et connexions ouvriront après validation de la configuration des e-mails et des tests de sécurité.')
    );
    return;
  }
  const callbackError=authCallbackError(window.location.search);
  const isCallback=hasAuthCallback(window.location.search);
  const recoveryExpected=isCallback&&getRecoveryIntent();
  root.replaceChildren(el('p','auth-loading','Vérification de la session sécurisée…'));
  try{
    const api=await client();
    if(turn!==generation||!root.isConnected)return;
    // Abonnement AVANT getSession : PASSWORD_RECOVERY peut surgir pendant l’échange PKCE.
    const {data:{subscription}}=api.auth.onAuthStateChange((event)=>{
      if(turn!==generation||!root.isConnected)return;
      if(event==='PASSWORD_RECOVERY')recoveryMode=true;
      if(event==='SIGNED_OUT'){recoveryMode=false;setRecoveryIntent(false);}
      if(!['PASSWORD_RECOVERY','SIGNED_IN','SIGNED_OUT'].includes(event))return;
      // Pas d'await Supabase dans le callback auth : évite un deadlock de session.
      window.setTimeout(()=>{
        if(turn!==generation||!root.isConnected)return;
        if(event==='SIGNED_OUT')authCard(root,'login');
        else if(recoveryMode)authCard(root,'newPassword');
        else void showSession(root,api);
      },0);
    });
    mounted={subscription};
    const {data:{session},error}=await api.auth.getSession();
    if(turn!==generation||!root.isConnected)return;
    if(error)throw error;
    if(recoveryExpected&&session)recoveryMode=true;
    if(recoveryMode&&session)authCard(root,'newPassword');
    else if(session)await showSession(root,api);
    else authCard(root,'login');
    if(callbackError){
      if(!session)alertFor(root,callbackError,true);
      else root.prepend(el('p','auth-warning',callbackError));
    }
  }catch{
    if(turn!==generation||!root.isConnected)return;
    if(mounted?.subscription)mounted.subscription.unsubscribe();
    mounted=null;
    root.replaceChildren(el('h2','','Service temporairement indisponible'),
      el('p','auth-warning','La connexion nécessite le service Supabase. Réessaie dans quelques instants.'));
    const retry=button('Réessayer','auth-submit','button');
    retry.addEventListener('click',()=>{void mountAuth();});
    root.append(retry);
  }
}

export function unmountAuth(){
  generation += 1;
  if (mounted?.subscription) mounted.subscription.unsubscribe();
  mounted = null;
}
