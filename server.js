const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');
const fs = require('fs');

app.use(express.static(__dirname));

// Vérifie si le dossier 'image' existe sur Render, sinon le crée
const dossierUpload = path.join(__dirname, 'image');
if (!fs.existsSync(dossierUpload)) {
    fs.mkdirSync(dossierUpload, { recursive: true });
}

// Configuration de Multer
const stockage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dossierUpload);
    },
    filename: function (req, file, cb) {
        cb(null, 'quiz-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: stockage });

// ========================================================
// VARIABLES GLOBALES
// ========================================================
let mancheActive = true;
let pseudoDuBuzzer = "";
let indexImageActuelle = 0;
let listeJoueurs = []; 

// Liste dynamique des images disponibles
let listeImagesServeur = ["image/20220310210647_1.png"];

// Route HTTP POST pour téléverser une image
app.post('/upload', upload.single('imageQuiz'), (req, res) => {
    if (req.file) {
        const cheminImage = 'image/' + req.file.filename;
        listeImagesServeur.push(cheminImage);
        console.log(`-> SERVEUR : Nouvelle image ajoutée : ${cheminImage}`);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// ========================================================
// GESTION DES SOCKETS (CONNEXIONS TEMPS RÉEL)
// ========================================================
io.on('connection', (socket) => {
    console.log('Un utilisateur s’est connecté');

    // On envoie le classement actuel dès qu'un client se connecte
    socket.emit('mise_a_jour_leaderboard', listeJoueurs);

    // GESTION DE LA RECONNEXION INTELLIGENTE
    socket.on('nouveau_joueur', (data) => {
        let ancienJoueur = listeJoueurs.find(j => j.pseudo === data.pseudo);

        if (ancienJoueur) {
            // Reconnexion : mise à jour du socket.id
            ancienJoueur.id = socket.id;
            console.log(`🔄 Reconnexion : ${data.pseudo} (${ancienJoueur.score} pts).`);
        } else {
            // Nouveau joueur
            listeJoueurs.push({ id: socket.id, pseudo: data.pseudo, score: 0 });
            console.log(`🆕 Nouveau joueur : ${data.pseudo}`);
        }

        io.emit('mise_a_jour_leaderboard', listeJoueurs);
    });

    // REMISE À ZÉRO DE LA PARTIE (BIEN PLACÉ ICI DÉSORMAIS)
    socket.on('admin_reset_partie', () => {
        listeJoueurs = []; // On vide la liste des joueurs
        pseudoDuBuzzer = "";
        mancheActive = true;
        
        console.log("🧹 SERVEUR : Partie remise à zéro par l'Admin !");
        
        // On diffuse la liste vide à TOUT LE MONDE
        io.emit('mise_a_jour_leaderboard', listeJoueurs);
    });

    socket.on('changement_reglages', (data) => {
        socket.broadcast.emit('maj_reglages_joueurs', data);
    });

    socket.on('clic_buzz', (data) => {
        if (mancheActive) {
            mancheActive = false;
            pseudoDuBuzzer = data.pseudo;
            io.emit('bloquer_jeu', { quiAByzze: pseudoDuBuzzer });
        }
    });

    socket.on('admin_decision', (data) => {
        if (data.juste) {
            let joueurGagnant = listeJoueurs.find(j => j.pseudo === pseudoDuBuzzer);
            if (joueurGagnant) {
                joueurGagnant.score += data.pointsAAccorder;
            }
            
            io.emit('reponse_validee', { action: 'reveler', gagnant: pseudoDuBuzzer, points: data.pointsAAccorder });
            io.emit('mise_a_jour_leaderboard', listeJoueurs);
        } else {
            const joueurEnFaute = pseudoDuBuzzer;
            mancheActive = true;
            pseudoDuBuzzer = "";

            // Cooldown de 2s chez le perdant
            io.emit('reponse_validee', { action: 'relancer', perdant: joueurEnFaute });
        }
    });

    socket.on('admin_next', () => {
        mancheActive = true;
        pseudoDuBuzzer = "";
        
        indexImageActuelle++;
        if (indexImageActuelle >= listeImagesServeur.length) {
            indexImageActuelle = 0;
        }

        const prochaineImage = listeImagesServeur[indexImageActuelle];
        console.log(`-> SERVEUR : Lancement de l'image suivante : ${prochaineImage}`);
        
        io.emit('prochaine_image', { URLImage: prochaineImage });
    });
});

// Port dynamique pour Render
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log('Serveur démarré sur le port ' + PORT);
});
