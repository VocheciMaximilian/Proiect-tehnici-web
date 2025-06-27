const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');

const app = express();
const PORT = process.env.PORT || 8080;

// Globale
const obGlobal = { obErori: null };
const galerieData = JSON.parse(fs.readFileSync(path.join(__dirname, 'galerie_data.json'), 'utf8'));

global.folderScss = path.join(__dirname, 'Resurse', 'Stiluri');
global.folderCss = path.join(__dirname, 'Resurse', 'Stiluri');
global.folderBackup = path.join(global.folderCss, 'backup');

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

// Creare foldere temp
const vect_foldere = ['temp'];
vect_foldere.forEach(f => {
    const full = path.join(__dirname, f);
    if (!fs.existsSync(full)) fs.mkdirSync(full);
});
if (!fs.existsSync(global.folderBackup)) {
    fs.mkdirSync(global.folderBackup, { recursive: true });
    console.log(`[SASS] Created backup folder: ${global.folderBackup}`);
}


// b
async function compileazaScss(caleScss, caleCss) {
    const scssFileName = path.basename(caleScss, '.scss');
    const cssOutputFileName = path.basename(caleCss);

    // c. Salvare backup
    if (fs.existsSync(caleCss)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${scssFileName}_${timestamp}.css`;
        const backupPath = path.join(global.folderBackup, backupFileName);

        try {
            fs.copyFileSync(caleCss, backupPath);
            console.log(`[SASS] Backup created for ${cssOutputFileName}: ${backupFileName}`);
        } catch (err) {
            console.error(`[SASS ERROR] Failed to create backup for ${cssOutputFileName}:`, err);
        }
    }
    //compilare
    try {
        const result = await sass.compileAsync(caleScss, {
            style: 'expanded'
        });
        fs.writeFileSync(caleCss, result.css.toString());
        console.log(`[SASS] Compiled: ${caleScss} -> ${caleCss}`);
    } catch (err) {
        console.error(`[SASS ERROR] Failed to compile ${caleScss}:`, err.message);
    }
}

// d
async function initialCompileScss() {
    console.log('[SASS] Starting initial compilation...');
    const scssFiles = fs.readdirSync(global.folderScss).filter(file => file.endsWith('.scss'));
    for (const file of scssFiles) {
        const scssPath = path.join(global.folderScss, file);
        const cssPath = path.join(global.folderCss, path.basename(file, '.scss') + '.css');
        await compileazaScss(scssPath, cssPath);
    }
    console.log('[SASS] Initial compilation finished.');
}

// e
function setupScssWatcher() {
    console.log(`[SASS] Watching for changes in: ${global.folderScss}`);
    fs.watch(global.folderScss, async (eventType, filename) => {
        if (filename && filename.endsWith('.scss')) {
            const scssPath = path.join(global.folderScss, filename);
            const cssPath = path.join(global.folderCss, path.basename(filename, '.scss') + '.css');

            // Verifică dacă fișierul SCSS există (nu a fost șters)
            if (fs.existsSync(scssPath)) {
                console.log(`[SASS] Change detected (${eventType}): ${filename}`);
                await compileazaScss(scssPath, cssPath);
            } else if (eventType === 'rename') { // Poate indica o ștergere sau redenumire
                // Dacă fișierul SCSS a fost șters, poți șterge și CSS-ul corespunzător
                const cssToDelete = path.join(global.folderCss, path.basename(filename, '.scss') + '.css');
                if (fs.existsSync(cssToDelete)) {
                    try {
                        fs.unlinkSync(cssToDelete);
                        console.log(`[SASS] Deleted corresponding CSS file: ${cssToDelete}`);
                    } catch (err) {
                        console.error(`[SASS ERROR] Failed to delete CSS file ${cssToDelete}:`, err);
                    }
                }
            }
        }
    });
}

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
        ip: req.ip,
        galerie_gatit: galerieData.galerie_gatit
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