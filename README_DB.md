# Instrucțiuni pentru baza de date PostgreSQL

1. Asigură-te că ai PostgreSQL instalat pe sistemul tău.
2. Deschide un terminal și conectează-te la baza ta de date (sau creează una nouă):
   ```sh
   createdb retete_db
   psql -d retete_db
   ```
3. Rulează scriptul de creare a tabelelor:
   ```sh
   \i schema.sql
   ```
4. Tabelele `utilizatori`, `retete` și `retete_utilizator` vor fi create.
5. Poți adăuga date folosind comenzi INSERT sau poți cere exemple de inserare.

Dacă ai nevoie de extindere cu tabele pentru ingrediente/echipamente separate, vezi comentariile din schema.sql sau cere ajutor suplimentar! 