-- SCHEMA PENTRU BAZA DE DATE PROIECT RETETE CULINARE

CREATE TABLE utilizatori (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    parola VARCHAR(255) NOT NULL,
    tip VARCHAR(20) DEFAULT 'inregistrat' -- anonim, inregistrat, admin
);

CREATE TABLE retete (
    id SERIAL PRIMARY KEY,
    nume VARCHAR(100) NOT NULL,
    descriere TEXT,
    imagine VARCHAR(255),
    categorie VARCHAR(50),
    subcategorie VARCHAR(50),
    mod_categorizare VARCHAR(100),
    pret NUMERIC(6,2),
    timp_preparare INTEGER,
    portii INTEGER,
    data_adaugare DATE DEFAULT CURRENT_DATE,
    complexitate VARCHAR(20),
    ingrediente TEXT[],
    echipamente TEXT[],
    este_rapida BOOLEAN,
    aprecieri INTEGER DEFAULT 0,
    instructiuni TEXT
);

CREATE TABLE retete_utilizator (
    id SERIAL PRIMARY KEY,
    id_utilizator INTEGER REFERENCES utilizatori(id),
    id_reteta INTEGER REFERENCES retete(id)
); 