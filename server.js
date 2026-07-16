const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');

app.use(express.static(__dirname));

// Configuration de Multer : où ranger l'image et comment la nommer
const stockage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'image/'); // Vos images iront dans ton dossier "image"
    },
    filename: function (req, file, cb) {
        // On donne un nom unique basé sur l'heure pour éviter les doublons
        cb(null, 'quiz-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: stockage });

let mancheActive = true;
let pseudoDuBuzzer = "";

// Liste dynamique des images disponibles (on commence avec ton image actuelle)
let listeImagesServeur = ["image/20220310210647_1.png"];
let indexImageActuelle = 0;

// Route HTTP POST pour recevoir le fichier depuis l'admin
app.post('/upload', upload.single('imageQuiz'), (req, res) => {
    if (req.file) {
        // On ajoute le chemin de la nouvelle image dans notre liste globale
        const cheminImage = 'image/' + req.file.filename;
        listeImagesServeur.push(cheminImage);
        console.log(`-> SERVEUR : Nouvelle image ajoutée : ${cheminImage}`);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

let pseudoDuBuzzer = "";
let indexImageActuelle = 0;

let listeJoueurs = []; 

io.on('connection', (socket) => {
    console.log('Un utilisateur s’est connecté');

    // 1. Quand un joueur entre son pseudo, on l'ajoute à la liste commune
    socket.on('nouveau_joueur', (data) => {
        let joueurExiste = listeJoueurs.find(j => j.id === socket.id);
        if (!joueurExiste) {
            listeJoueurs.push({ id: socket.id, pseudo: data.pseudo, score: 0 });
        }
        // On envoie le classement mis à jour à TOUT LE MONDE
        io.emit('mise_a_jour_leaderboard', listeJoueurs);
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
            io.emit('reponse_validee', { action: 'reveler', gagnant: pseudoDuBuzzer, points: data.pointsAAccorder });
        } else {
            mancheActive = true;
            io.emit('reponse_validee', { action: 'relancer' });
        }
    });

    socket.on('admin_next', () => {
        mancheActive = true;
        pseudoDuBuzzer = "";
        
        // On passe à l'image suivante dans la liste du serveur
        indexImageActuelle++;
        if (indexImageActuelle >= listeImagesServeur.length) {
            indexImageActuelle = 0; // On boucle si on arrive au bout
        }

        const prochaineImage = listeImagesServeur[indexImageActuelle];
        console.log(`-> SERVEUR : Lancement de la prochaine image : ${prochaineImage}`);
        
        // On envoie le lien de l'image précise à afficher chez les joueurs !
        io.emit('prochaine_image', { URLImage: prochaineImage });
    });
});
// On récupère le port donné par internet, ou 3000 si on joue en local
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log('Serveur démarré sur le port ' + PORT);
});
