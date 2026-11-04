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