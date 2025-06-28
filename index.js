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
    user: 'postgres', // modifica dupa caz
    host: 'localhost',
    database: 'retete_db',
    password: '1406', // modifica dupa caz
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
        titluPagina: "Acasă",
        ip: req.ip,
        galerie_gatit: { galerie: filteredGalerie }
    });
});

// Ruta pentru listare retete
app.get('/retete', async (req, res) => {
    try {
        // Preluare categorii distincte pentru dropdown
        const categoriiResult = await pool.query('SELECT DISTINCT categorie FROM retete');
        const categorii = categoriiResult.rows.map(row => row.categorie);

        // Filtrare si sortare
        let query = 'SELECT id, nume, descriere, imagine, categorie, timp_preparare, complexitate, pret, data_adaugare, este_rapida, ingrediente FROM retete';
        let where = [];
        let values = [];
        let order = '';

        // Filtrare dupa categorie
        if (req.query.categorie && req.query.categorie !== '') {
            where.push('categorie = $' + (values.length + 1));
            values.push(req.query.categorie);
        }

        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }

        // Sortare
        if (req.query.sort) {
            switch (req.query.sort) {
                case 'pret_asc':
                    order = ' ORDER BY pret ASC';
                    break;
                case 'pret_desc':
                    order = ' ORDER BY pret DESC';
                    break;
                case 'timp_asc':
                    order = ' ORDER BY timp_preparare ASC';
                    break;
                case 'timp_desc':
                    order = ' ORDER BY timp_preparare DESC';
                    break;
                case 'nume_asc':
                    order = ' ORDER BY nume ASC';
                    break;
                case 'nume_desc':
                    order = ' ORDER BY nume DESC';
                    break;
            }
        }

        query += order;

        // Paginare
        const pagina = parseInt(req.query.pagina) || 1;
        const retetePerPagina = 6;
        const offset = (pagina - 1) * retetePerPagina;

        // Query pentru numarul total de retete
        let countQuery = 'SELECT COUNT(*) FROM retete';
        if (where.length > 0) {
            countQuery += ' WHERE ' + where.join(' AND ');
        }
        const countResult = await pool.query(countQuery, values);
        const totalRetete = parseInt(countResult.rows[0].count);
        const nrPagini = Math.ceil(totalRetete / retetePerPagina);

        // Query final cu paginare
        query += ` LIMIT ${retetePerPagina} OFFSET ${offset}`;
        const result = await pool.query(query, values);
        const retete = result.rows;

        // Calculare retetele cele mai ieftine din fiecare categorie
        const celeMaiIeftine = {};
        for (const categorie of categorii) {
            const ieftinResult = await pool.query(
                'SELECT id, pret FROM retete WHERE categorie = $1 ORDER BY pret ASC LIMIT 1',
                [categorie]
            );
            if (ieftinResult.rows.length > 0) {
                celeMaiIeftine[categorie] = ieftinResult.rows[0];
            }
        }

        res.render('pagini/retete', {
            titluPagina: "Rețete",
            retete,
            categorii,
            categorieSelectata: req.query.categorie || '',
            sort: req.query.sort || '',
            paginaCurenta: pagina,
            nrPagini,
            celeMaiIeftine
        });
    } catch (err) {
        console.error('Eroare la preluarea retetelor:', err);
        afisareEroare(res, 500);
    }
});

// Ruta pentru pagina individuala reteta
app.get('/reteta/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM retete WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return afisareEroare(res, 404);
        }
        res.render('pagini/reteta', { 
            titluPagina: "Detalii rețetă",
            reteta: result.rows[0] 
        });
    } catch (err) {
        console.error('Eroare la preluarea retetei:', err);
        afisareEroare(res, 500);
    }
});

// Ruta pentru pagina despre
app.get('/despre', (req, res) => {
    res.render('pagini/despre', { titluPagina: "Despre" });
});

// Ruta pentru fragmentul orar
app.get('/fragmente/orar', (req, res) => {
    res.render('fragmente/orar', { titluPagina: "Orar" });
});

// Ruta pentru pagina video-vtt
app.get('/video-vtt', (req, res) => {
    res.render('pagini/video-vtt', { titluPagina: "Video" });
});

// Ruta pentru erori 404
app.use((req, res) => {
    afisareEroare(res, 404);
});

// Functie pentru afisarea erorilor
function afisareEroare(res, identificator = 0, titluArg, textArg, imgArg) {
    let titlu, text, img;
    
    if (identificator === 0) {
        // Eroare default
        titlu = obGlobal.obErori.default.titlu;
        text = obGlobal.obErori.default.text;
        img = obGlobal.obErori.default.imagine;
    } else {
        // Eroare specifica
        const eroare = obGlobal.obErori.info[identificator];
        if (eroare) {
            titlu = titluArg || eroare.titlu;
            text = textArg || eroare.text;
            img = imgArg || eroare.imagine;
        } else {
            // Eroare necunoscuta
            titlu = titluArg || 'Eroare necunoscuta';
            text = textArg || 'A aparut o eroare neasteptata.';
            img = imgArg || obGlobal.obErori.default.imagine;
        }
    }
    
    res.status(identificator || 500).render('pagini/error', {
        titlu,
        text,
        imagine: img
    });
}

// Initializare si pornire server
async function startServer() {
    try {
        // Compilare initiala SCSS
        await initialCompileScss();
        
        // Setup watcher pentru SCSS
        setupScssWatcher();
        
        // Pornire server
        app.listen(PORT, () => {
            console.log(`Serverul ruleaza pe portul ${PORT}`);
            console.log(`Acceseaza: http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Eroare la pornirea serverului:', err);
        process.exit(1);
    }
}

startServer();