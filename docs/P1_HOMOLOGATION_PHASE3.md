# Phase 3 — Bilan technique d'homologation

Date : 22 octobre 2026.

## Changements vérifiés

Les migrations 202610220007 et 202610220008 sont appliquées sur Supabase. Le rôle authenticated peut mettre à jour uniquement display_name dans public.profiles. Lors d'un INSERT, il peut renseigner uniquement id et display_name. Les autres champs de profil et les dates ne sont pas modifiables directement par ce rôle.

La vérification SQL a également confirmé : 18 tables publiques avec RLS, aucune RPC privilégiée exécutable par anon, aucun droit d'écriture direct des comptes membres sur les tables de rôles et de demandes d'élévation.

L'audit de reprise est prêt dans scripts/db-recovery-verification.sql. Son exécution sur la base source a réussi, mais aucun export ni aucune restauration vers une base isolée ne sont encore réalisés. Le protocole de reprise est dans docs/P1_RECOVERY_PLAYBOOK.md.

## Auth et responsabilités

L'organisation Supabase est actuellement sur le plan Free. La protection contre les mots de passe compromis est réservée à Pro ou supérieur selon la documentation Supabase. Elle n'est pas activée et aucun changement de forfait n'a été effectué.

## Validations restantes

Le club doit fournir des comptes habilités distincts pour tester les rôles cumulés, un environnement de reprise séparé pour tester la restauration et une validation des mentions légales et de la confidentialité. Le test d'accessibilité sur Safari avec VoiceOver et Android avec TalkBack reste à exécuter sur appareils réels.

**Le site n'est pas encore homologué pour une ouverture générale et conserve son noindex.**
