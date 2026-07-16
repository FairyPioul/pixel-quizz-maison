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

// VARIABLES DE PIXELLISATION
let imgObj = new Image(); // On crée un objet Image en mémoire
imgObj.src = "image/20220310210647_1.png"; // Ton image de départ

let echellePixellisation = 0.01; // 0.02 = l'image est dessinée à 2% de sa taille (très pixelisée)

boutonRejoindre.addEventListener('click', function() {
    monPseudo = inputPseudo.value.trim();
    if (monPseudo !== "") {
        ecranConnexion.style.display = "none";
        ecranJeu.style.display = "block";
        
        socket.emit('nouveau_joueur', { pseudo: monPseudo });
        
        // On attend que l'image soit bien chargée avant de lancer le chrono
        imgObj.onload = function() {
            démarrerChrono();
        };
        // Si l'image est déjà chargée par le navigateur
        if (imgObj.complete) démarrerChrono();
        
    } else {
        alert("S'il te plaît, entre un pseudo valide !");
    }
});

// FONCTION QUI DESSINE LES PIXELS
function dessinerImagePixelisee() {
    let w = canvas.width * echellePixellisation;
    let h = canvas.height * echellePixellisation;

    // Étape 1 : On dessine l'image en tout petit dans un coin du canvas
    ctx.drawImage(imgObj, 0, 0, w, h);

    // Étape 2 : On prend ce petit carré et on l'étire sur tout le canvas
    ctx.drawImage(canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

function démarrerChrono() {
    chrono = setInterval(function() {
        // On augmente progressivement la taille du dessin (rend l'image de moins en moins pixelisée)
        echellePixellisation = echellePixellisation + 0.001;
        
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
        boutonBuzz.innerText = "BUZZER !";
        boutonBuzz.style.backgroundColor = "red";
        boutonBuzz.disabled = false;
        démarrerChrono();
    }
});

socket.on('prochaine_image', function(data) {
    console.log("JOUEUR : Le serveur me dit de passer à l'image suivante :", data.URLImage);
    clearInterval(chrono);
    echellePixellisation = 0.02; // Réinitialise les gros pixels
    
    // ON APPLIQUE LA VRAIE IMAGE ENVOYÉE PAR LE SERVEUR :
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
        if (joueur.pseudo === monPseudo) item.style.color = "#007BFF";
        listeScoresUI.appendChild(item);
    });
});