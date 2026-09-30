/* Cap 100 — connexion à ton projet Firebase (comptes + synchronisation + communauté).
   Colle ici les valeurs « apiKey » et « projectId » données par la console Firebase
   (Paramètres du projet → Général → Vos applications → Config).
   Ces deux valeurs ne sont pas secrètes : ce sont les règles de sécurité Firestore qui protègent les données.
   Laisse-les vides pour utiliser l'application sans compte (tout reste sur l'appareil). */
window.CAP_CLOUD = {
  apiKey: '',
  projectId: '',
  adminEmail: '' // ton adresse de compte : permet de retirer une recette de la communauté (même valeur que dans firestore.rules)
};
