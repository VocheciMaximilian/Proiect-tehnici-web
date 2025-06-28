const express = require('express');
const path = require('path');
const fs = require('fs');
const sass = require('sass');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8080;

// Variabile globale
const obGlobal = { obErori: null };
const galerieData = JSON.parse(fs.readFileSync(path.join(__dirname, 'galerie_data.json'), 'utf8'));

global.folderScss = path.join(__dirname, 'Resurse', 'Stiluri');
global.folderCss = path.join(__dirname, 'Resurse', 'Stiluri');
global.folderBackup = path.join(global.folderCss, 'backup');

const pool = new Pool({
    user: 'postgres', // modifică după caz
    host: 'localhost',
    database: 'retete_db',
    password: '1406', // modifică după caz
    port: 5432
});

// Initializare erori
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

// Creare foldere temporare
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
    console.log(`[SASS DEBUG] Attempting to compile: ${caleScss}`); // Mesaj de depanare
    const scssFileName = path.basename(caleScss, '.scss');
    const cssOutputFileName = path.basename(caleCss);

    // c. Salvare backup
    if (fs.existsSync(caleCss)) {
        console.log(`[SASS DEBUG] CSS file exists for backup: ${caleCss}`); // Mesaj de depanare
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `${scssFileName}_${timestamp}.css`;
        const backupPath = path.join(global.folderBackup, backupFileName);

        try {
            fs.copyFileSync(caleCss, backupPath);
            console.log(`[SASS] Backup created for ${cssOutputFileName}: ${backupFileName}`);
        } catch (err) {
            console.error(`[SASS ERROR] Failed to create backup for ${cssOutputFileName}:`, err);
        }
    } else {
        console.log(`[SASS DEBUG] CSS file does NOT exist for backup: ${caleCss}. Skipping backup.`); // Mesaj de depanare
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
    console.log(`[SASS DEBUG] Found SCSS files: ${scssFiles.join(', ')}`); // Mesaj de depanare
    if (scssFiles.length === 0) {
        console.log('[SASS DEBUG] No SCSS files found to compile.');
    }
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

            // Verifica daca fisierul SCSS exista (nu a fost sters)
            if (fs.existsSync(scssPath)) {
                console.log(`[SASS] Change detected (${eventType}): ${filename}`);
                await compileazaScss(scssPath, cssPath);
            } else if (eventType === 'rename') { // Poate indica o stergere sau redenumire
                // Daca fisierul SCSS a fost sters, poti sterge si CSS-ul corespunzator
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
    const galerie = galerieData.galerie_gatit.galerie;
    const currentHour = new Date().getHours();
    const filteredGalerie = galerie.filter(imagine =>
        imagine.intervale_ore.some(([start, end]) => currentHour >= start && currentHour < end)
    );
    res.render('pagini/index', {
        ip: req.ip,
        galerie_gatit: { galerie: filteredGalerie }
    });
});

// Ruta pentru listare rețete
app.get('/retete', async (req, res) => {
    try {
        // Preluare categorii distincte pentru dropdown
        const categoriiResult = await pool.query('SELECT DISTINCT categorie FROM retete');
        const categorii = categoriiResult.rows.map(row => row.categorie);

        // Filtrare și sortare
        let query = 'SELECT id, nume, descriere, imagine, categorie, timp_preparare, complexitate, pret, data_adaugare, este_rapida, ingrediente FROM retete';
        let where = [];
        let values = [];
        let order = '';

        // Filtrare după categorie
        if (req.query.categorie && req.query.categorie !== '') {
            where.push('categorie = $' + (values.length + 1));
            values.push(req.query.categorie);
        }

        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }

        // Sortare
        if (req.query.sort === 'pret' || req.query.sort === 'timp_preparare' || req.query.sort === 'nume') {
            order = ' ORDER BY ' + req.query.sort;
        }
        query += order;

        const result = await pool.query(query, values);
        // Calculează pretMin și pretMax din rezultatele rețetelor
        let pretMin = null, pretMax = null;
        let ingredienteUnice = [];
        if (result.rows.length > 0) {
            const preturi = result.rows.map(r => Number(r.pret));
            pretMin = Math.min(...preturi);
            pretMax = Math.max(...preturi);
            // Extrage toate ingredientele într-un array flat
            let toateIngrediente = [];
            result.rows.forEach(r => {
                if (Array.isArray(r.ingrediente)) {
                    toateIngrediente.push(...r.ingrediente);
                } else if (typeof r.ingrediente === 'string') {
                    toateIngrediente.push(r.ingrediente);
                }
            });
            // Elimină duplicatele
            ingredienteUnice = [...new Set(toateIngrediente)].sort();
        }

        // --- PAGINARE ---
        const K = 6; // număr de rețete pe pagină
        const pagina = parseInt(req.query.pagina) || 1;
        const N = result.rows.length;
        const nrPagini = Math.ceil(N / K);
        const start = (pagina - 1) * K;
        const end = Math.min(start + K, N);
        const retetePagina = result.rows.slice(start, end);
        // --- END PAGINARE ---

        res.render('pagini/retete', {
            retete: retetePagina,
            titluPagina: 'Rețete',
            categorii,
            categorieSelectata: req.query.categorie || '',
            sort: req.query.sort || '',
            pretMin,
            pretMax,
            ingredienteUnice,
            paginaCurenta: pagina,
            nrPagini
        });
    } catch (err) {
        res.status(500).send('Eroare la preluarea rețetelor');
    }
});

// Ruta pentru detalii rețetă
app.get('/reteta/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM retete WHERE id = $1', [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).send('Rețetă inexistentă');
        const reteta = result.rows[0];
        // Alege 3 imagini random din folderul Resurse/images
        const imgDir = path.join(__dirname, 'Resurse', 'images');
        let toateImaginile = fs.readdirSync(imgDir)
            .filter(f => f.match(/\.(jpg|jpeg|png)$/i))
            .map(f => 'Resurse/images/' + f);
        // Elimină duplicate și imaginea principală dacă vrei
        let imagini = [reteta.imagine];
        let rest = toateImaginile.filter(img => img !== reteta.imagine);
        while (imagini.length < 3 && rest.length > 0) {
            let idx = Math.floor(Math.random() * rest.length);
            imagini.push(rest[idx]);
            rest.splice(idx, 1);
        }
        res.render('pagini/reteta', { reteta, imagini, titluPagina: reteta.nume });
    } catch (err) {
        res.status(500).send('Eroare la preluarea rețetei');
    }
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

// Functie afisare eroare
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
    initialCompileScss();
    setupScssWatcher();
    console.log(`Serverul rulează pe http://localhost:${PORT}`);
    console.log('__dirname:', __dirname);
    console.log('__filename:', __filename);
    console.log('process.cwd():', process.cwd());
});