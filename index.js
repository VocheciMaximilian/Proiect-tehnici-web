const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Globale
const obGlobal = { obErori: null };

// Inițializare erori
function initErori() {
    const eroriRaw = fs.readFileSync(path.join(__dirname, 'erori.json'), 'utf-8');
    const conf = JSON.parse(eroriRaw);
    const baza = conf.cale_baza;
    const rezultat = {};
    conf.info_erori.forEach(e => {
        rezultat[e.identificator] = {
            status: e.status,
            titlu: e.titlu,
            text: e.text,
            imagine: path.join(baza, e.imagine)
        };
    });
    obGlobal.obErori = {
        default: {
            titlu: conf.eroare_default.titlu,
            text: conf.eroare_default.text,
            imagine: path.join(baza, conf.eroare_default.imagine)
        },
        info: rezultat
    };
}
initErori();

// Creare foldere temp dacă nu există
const vect_foldere = ['temp'];
vect_foldere.forEach(f => {
    const full = path.join(__dirname, f);
    if (!fs.existsSync(full)) fs.mkdirSync(full);
});

// Setare view engine si directoare EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Folder static
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// Detectare acces folder /resurse -> 403
app.get('/resurse/*', (req, res, next) => {
    if (req.path.endsWith('/')) return afisareEroare(res, 403);
    next();
});

// Cereri *.ejs -> 400
app.get('/*.ejs', (req, res) => {
    afisareEroare(res, 400);
});

// Favicon
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'images', 'chef-hat.png'));
});

// Pagina principala pe multiple cai
app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index', {
        ip: req.ip
    });
});

// Rute dinamice pentru orice pagina
app.get('/*', (req, res) => {
    const page = req.path.slice(1);
    res.render(`pagini/${page}`, { ip: req.ip }, (err, html) => {
        if (err) {
            if (err.message.startsWith('Failed to lookup view')) {
                return afisareEroare(res, 404);
            }
            return afisareEroare(res);
        }
        res.send(html);
    });
});

// Funcție afișare eroare
function afisareEroare(res, identificator = 0, titluArg, textArg, imgArg) {
    const conf = obGlobal.obErori;
    let e = conf.info[identificator];
    let statusCode = 200;
    let titlu, text, imagine;

    if (!e) {
        e = conf.default;
    }
    if (identificator && e) {
        statusCode = e.status ? identificator : 200;
    }
    titlu = titluArg || e.titlu;
    text = textArg || e.text;
    imagine = imgArg || e.imagine;

    res.status(statusCode).render('pagini/error', {
        titlu,
        text,
        imagine
    });
}

app.listen(PORT, () => {
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log('__dirname:', __dirname);
    console.log('__filename:', __filename);
    console.log('process.cwd():', process.cwd());
});