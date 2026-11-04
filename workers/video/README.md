# Processeur vidéo offline MentionCheck

Exécution sur un ordinateur ou conteneur ayant FFmpeg et FFprobe installés :

    node workers/video/src/process.mjs fichier.mp4 sortie-privee
    node --test workers/video/tests/video.test.mjs

Vérification locale du conteneur, de la durée réelle (60 s), de la taille (50 Mio)
et des dimensions ; extraction de trois JPEG et une piste WAV mono 16 kHz.
Les sorties contiennent des données privées : ne pas les publier, purger après usage.
Zéro appel OpenAI / Whisper et zéro transaction réseau. Non connecté au site à ce stade.
Pour le raccorder : service isolé, limite CPU/RAM, file d'attente, stockage privé,
rétention, vérification des fichiers malveillants et choix explicite du coût IA.

## Publication atomique et sécurité locale

- Le processeur crée d'abord un dossier privé de préparation **dans le même répertoire parent** que la destination. Les JPEG, le WAV éventuel et le manifeste complet y sont écrits avant une unique opération de renommage atomique vers le dossier final.
- Le dossier final doit être inexistant. Un fichier `.lock` créé exclusivement interdit les exécutions concurrentes coopérantes ; un dossier final préexistant reste intact.
- Si FFmpeg ou FFprobe échoue, le répertoire temporaire est effacé. Les entrées symboliques et les vidéos de plus de 50 Mio sont refusées avant décodage.
- **Limites :** la sécurité face à un autre programme non coopérant manipulant simultanément le même chemin reste à assurer par les permissions du conteneur. Un arrêt brutal peut laisser un verrou ou un dossier temporaire orphelin, jamais un dossier final partiellement publié. Un nettoyage opérateur sécurisé est à prévoir dans le service isolé.
- Aucun fichier de production n'est ouvert durant les tests : les MP4 sont synthétiques, créés localement par FFmpeg.
