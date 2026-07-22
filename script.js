const socket = io(); 
console.log("Le script du JOUEUR est bien chargé !");

const ecranConnexion = document.getElementById('ecran-connexion');
const ecranJeu = document.getElementById('ecran-jeu');
const boutonRejoindre = document.getElementById('bouton-rejoindre');
const inputPseudo = document.getElementById('input-pseudo');
const boutonBuzz = document.getElementById('bouton-buzz');
const affichageScore = document.getElementById('affichage-score');
const listeScoresUI = document.getElementById('liste-scores');

// On récupère le canvas et son contexte de dessin
const canvas = document.getElementById('canvas-jeu');
const ctx = canvas.getContext('2d');

let monPseudo = "";
let monScore = 0; 
let chrono;

// ========================================================
// VARIABLES DE PIXELLISATION DYNAMIQUE (GÉRÉES PAR L'ADMIN)
// ========================================================
let imgObj = new Image(); 
imgObj.src = "image/20220310210647_1.png"; // Image de départ par défaut

let echellePixellisation = 0.02; 
let vitesseDepixellisation = 0.005; // Taux ajouté toutes les 100ms
let pixelDepart = 0.02;            // Valeur initiale de la manche

// ========================================================
// RECONNEXION AUTOMATIQUE (LOCALSTORAGE)
// ========================================================
const pseudoSauvegarde = localStorage.getItem('pixel_quiz_pseudo');

if (pseudoSauvegarde) {
    monPseudo = pseudoSauvegarde;
    ecranConnexion.style.display = "none";
    ecranJeu.style.display = "block";
    
    // Signale au serveur la reconnexion du joueur
    socket.emit('nouveau_joueur', { pseudo: monPseudo });
    
    if (imgObj.complete) démarrerChrono();
    imgObj.onload = function() { démarrerChrono(); };
}

boutonRejoindre.addEventListener('click', function() {
    monPseudo = inputPseudo.value.trim();
    if (monPseudo !== "") {
        // Enregistre le pseudo dans le navigateur
        localStorage.setItem('pixel_quiz_pseudo', monPseudo);

        ecranConnexion.style.display = "none";
        ecranJeu.style.display = "block";
        
        socket.emit('nouveau_joueur', { pseudo: monPseudo });
        
        imgObj.onload = function() { démarrerChrono(); };
        if (imgObj.complete) démarrerChrono();
    } else {
        alert("S'il te plaît, entre un pseudo valide !");
    }
});

// FONCTION QUI DESSINE LES PIXELS
function dessinerImagePixelisee() {
    let w = canvas.width * echellePixellisation;
    let h = canvas.height * echellePixellisation;

    // Étape 1 : Dessin miniature dans le coin
    ctx.drawImage(imgObj, 0, 0, w, h);

    // Étape 2 : Étirement sur l'ensemble du canvas
    ctx.drawImage(canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

function démarrerChrono() {
    clearInterval(chrono);
    chrono = setInterval(function() {
        // Augmentation progressive selon le réglage de l'admin
        echellePixellisation = echellePixellisation + vitesseDepixellisation;
        
        dessinerImagePixelisee();

        if (echellePixellisation >= 1) {
            clearInterval(chrono);
            ctx.drawImage(imgObj, 0, 0, canvas.width, canvas.height); // Image nette parfaite
        }
    }, 100); // S'exécute toutes les 100ms
}

boutonBuzz.addEventListener('click', function() {
    socket.emit('clic_buzz', { pseudo: monPseudo });
});

socket.on('bloquer_jeu', function(data) {
    clearInterval(chrono);
    boutonBuzz.innerText = data.quiAByzze + " A BUZZÉ !";
    boutonBuzz.style.backgroundColor = "orange";
    boutonBuzz.disabled = true;
});

socket.on('reponse_validee', function(data) {
    if (data.action === 'reveler') {
        clearInterval(chrono);
        echellePixellisation = 1;
        ctx.drawImage(imgObj, 0, 0, canvas.width, canvas.height); // On révèle l'image nette
        
        if (data.gagnant === monPseudo) {
            monScore = monScore + data.points; 
            affichageScore.innerText = "Mon Score : " + monScore + " points";
            boutonBuzz.innerText = "BRAVO ! +" + data.points + " PTS";
            boutonBuzz.style.backgroundColor = "green";
        } else {
            boutonBuzz.innerText = data.gagnant + " gagne +" + data.points + " pts";
            boutonBuzz.style.backgroundColor = "#555";
        }
    } else if (data.action === 'relancer') {
        // GESTION DE LA PÉNALITÉ SI LE JOUEUR S'EST TROMPÉ
        if (data.perdant === monPseudo) {
            boutonBuzz.disabled = true;
            boutonBuzz.style.backgroundColor = "#777";
            
            let tempsRestant = 2;
            boutonBuzz.innerText = "PÉNALITÉ... (" + tempsRestant + "s)";
            
            let compteurPenalite = setInterval(() => {
                tempsRestant--;
                if (tempsRestant > 0) {
                    boutonBuzz.innerText = "PÉNALITÉ... (" + tempsRestant + "s)";
                } else {
                    clearInterval(compteurPenalite);
                    boutonBuzz.innerText = "BUZZER !";
                    boutonBuzz.style.backgroundColor = "red";
                    boutonBuzz.disabled = false;
                }
            }, 1000);
        } else {
            boutonBuzz.innerText = "BUZZER !";
            boutonBuzz.style.backgroundColor = "red";
            boutonBuzz.disabled = false;
        }

        démarrerChrono();
    }
});

socket.on('prochaine_image', function(data) {
    console.log("JOUEUR : Le serveur me dit de passer à l'image suivante :", data.URLImage);
    clearInterval(chrono);
    
    // Reprend la valeur définie par l'admin au lieu d'un chiffre fixe
    echellePixellisation = pixelDepart; 
    
    // Application de la nouvelle image
    imgObj.src = data.URLImage; 
    
    boutonBuzz.innerText = "BUZZER !";
    boutonBuzz.style.backgroundColor = "red";
    boutonBuzz.disabled = false;
    
    imgObj.onload = function() {
        démarrerChrono();
    };
});

socket.on('mise_a_jour_leaderboard', function(tableauJoueurs) {
    listeScoresUI.innerHTML = "";
    tableauJoueurs.sort((a, b) => b.score - a.score);
    tableauJoueurs.forEach((joueur, index) => {
        const item = document.createElement('li');
        item.style.padding = "5px 0";
        item.style.borderBottom = "1px solid #eee";
        item.innerHTML = "<strong>#" + (index + 1) + "</strong>. " + joueur.pseudo + " : " + joueur.score + " pts";
        if (joueur.pseudo === monPseudo) {
            item.style.color = "#007BFF";
            monScore = joueur.score; // Synchronise le score actuel
            affichageScore.innerText = "Mon Score : " + monScore + " points";
        }
        listeScoresUI.appendChild(item);
    });
});

// ========================================================
// RECEPTION DES RÉGLAGES DE L'ADMIN EN TEMPS RÉEL
// ========================================================
socket.on('maj_reglages_joueurs', function(data) {
    pixelDepart = data.pixelDepart;
    vitesseDepixellisation = data.vitesse;
    console.log("🛠️ Configuration reçue : Départ à", pixelDepart, " Vitesse à", vitesseDepixellisation);
});
