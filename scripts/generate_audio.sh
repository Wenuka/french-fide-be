#!/bin/bash

# Configuration
VOICE="Thomas"
OUTPUT_DIR="/Users/wenuka/IdeaProjects/french-fide/public/audio/scenarios"
MOD_DIR="/Users/wenuka/IdeaProjects/french-fide-be"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Array of [audioId]|[text]
declare -a TEXTS=(
    "a1_audio_intro|Sujet : Voyager en train. Vous allez décrire des images et répondre à des questions."
    "a1_audio_img_desc|Nous allons parler du sujet Voyager en train. Que voyez-vous ? Où sont les personnes ?"
    "a1_audio_q_aide|Voilà la situation : Une maman, avec une poussette, demande à un jeune homme de l’aider à monter dans le train. Je vais être la maman et vous allez être le jeune homme. [[slnc 1000]] Bonjour Monsieur, est-ce que vous pouvez m'aider à monter dans le train avec la poussette, s'il vous plaît ?"
    "a1_audio_q_merci|Merci beaucoup ! C'est vraiment très gentil de votre part !"
    "a1_audio_q_dest|Je vais à Genève avec mon bébé. Et vous, vous allez où ?"
    "a1_audio_q_revoir|Au revoir et encore merci !"
    "a1_audio_vocab_gare|Nommez trois choses qu'on peut acheter ou voir dans une gare."
    "a2_audio_intro|Bonjour ! Comment allez-vous ? Est-ce que vous pouvez vous présenter en quelques mots ?"
    "a2_audio_task1_prompt|Nous allons parler du sujet appartements. Que voyez-vous ? Décrivez l’image. Selon vous, où est cette personne ? Qu’est-ce qui se passe ?"
    "a2_audio_agency_call|Simulation : Voilà la situation : Cette femme a rendez-vous pour visiter un appartement, mais elle a eu un problème avec son vélo. Elle doit annuler le rendez-vous. La femme appelle la gérance et explique la situation. Que dit la femme au téléphone ? Nous allons jouer la situation : Vous êtes cette personne et moi, je travaille pour la gérance de l'immeuble. Je décroche le téléphone : [[slnc 1000]] Immo SA, ... bonjour."
    "a2_audio_discussion_01|J'ai maintenant quelques questions supplémentaires à vous poser. Qu'est-ce qui est important pour vous dans un appartement ? ... Pourquoi ?"
    "a2_audio_discussion_02|Avez-vous ou quelqu'un que vous connaissez déjà cherché un appartement ? Comment avez-vous fait ?"
    "a2_audio_discussion_03|Qu'avez-vous fait après avoir emménagé dans votre nouvel appartement ?"
    "b1_audio_intro|Choisissez un sujet : Formation continue ou Fêtes."
    "b1_audio_choice|De quel thème voulez-vous parler ?"
    "b1_audio_formation_work|Pouvez-vous nous dire : Où travaillez-vous ? / où avez-vous travaillé ? Comment avez-vous appris ce travail ?"
    "b1_audio_formation_course|Avez-vous déjà suivi un cours de formation continue ? Racontez-nous comment c’était !"
    "b1_audio_formation_pros_cons_v2|À votre avis, quels sont les côtés positifs et négatifs de suivre une formation en plus de son travail ?"
    "b1_audio_formation_hypothetical_v2|Pourriez-vous envisager d’apprendre un nouveau métier ? Pourquoi ? Pourquoi pas ?"
    "b1_audio_fete_last|Pouvez-vous nous dire : Quelle a été la dernière fête à laquelle vous avez participé ? C’était à quelle occasion ?"
    "b1_audio_fete_important|Parlez-nous d’une fête importante pour vous. Quand a-t-elle lieu et comment la fêtez-vous ?"
    "b1_audio_fete_pros_cons|À votre avis, quels sont les points positifs et négatifs d’une fête avec beaucoup d’invités ?"
    "b1_audio_fete_tradition|Quelle fête ou tradition de votre pays aimeriez-vous voir exister aussi en Suisse et pourquoi ?"
    "a1_audio_end|L'examen est terminé. Merci beaucoup et au revoir !"
    "a2_audio_end|La première partie de l'examen est terminée. Pour la deuxième partie, je vous suggère de choisir le niveau A1 ou B1. Sur l'écran suivant, vous pourrez sélectionner le niveau que vous préférez. !"
    "b1_audio_end|L'examen est terminé. Merci beaucoup et au revoir !"
)

for item in "${TEXTS[@]}"; do
    IFS="|" read -r id text <<< "$item"
    echo "Generating: $id"
    
    # Generate temporary AIFF file
    say -v "$VOICE" "$text" -o "$OUTPUT_DIR/$id.aiff"
    
    # Convert to MP3 and remove temp file
    ffmpeg -i "$OUTPUT_DIR/$id.aiff" -y -codec:a libmp3lame -qscale:a 2 "$OUTPUT_DIR/$id.mp3" > /dev/null 2>&1
    rm "$OUTPUT_DIR/$id.aiff"
done

echo "Audio generation complete!"
