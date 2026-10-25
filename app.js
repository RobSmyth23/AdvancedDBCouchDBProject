
"use strict";

// Local PouchDB database in the browser
const db = new PouchDB("movies_a");

const remoteDB = new PouchDB(
    "http://admin:mtu12345@127.0.0.1:5984/movies_a"
);

// HTML elements
const form = document.getElementById("movie-form");
const movieList = document.getElementById("movie-list");
const status = document.getElementById("status");
const editId = document.getElementById("edit-id");
const submitButton = document.getElementById("submit-button");
const cancelButton = document.getElementById("cancel-button");

// Display all movies saved locally
async function displayMovies() {
    const result = await db.allDocs({
        include_docs: true
    });

    movieList.replaceChildren();

    result.rows.forEach(function (row) {
        const movie = row.doc;
        const item = document.createElement("li");
        const details = document.createElement("div");

        details.textContent =
            movie.title + " (" + (movie.year || "Year unknown") + ")" +
            " | Actors: " + (movie.actors || []).join(", ") +
            " | Genres: " + (movie.genres || []).join(", ");

        // Edit button
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.type = "button";

        editButton.addEventListener("click", function () {
            editId.value = movie._id;

            document.getElementById("title").value =
                movie.title || "";

            document.getElementById("year").value =
                movie.year || "";

            document.getElementById("actors").value =
                (movie.actors || []).join(", ");

            document.getElementById("genres").value =
                (movie.genres || []).join(", ");

            submitButton.textContent = "Save Changes";
            cancelButton.hidden = false;

            status.textContent = "Editing: " + movie.title;

            document.getElementById("title").focus();
            form.scrollIntoView({ behavior: "smooth" });
        });

        // Delete button
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";

        deleteButton.addEventListener("click", async function () {
            try {
                await db.remove(movie);
await displayMovies();

alert("Movie deleted successfully!");

status.textContent =
    "Movie deleted locally. Sync will update CouchDB.";

                if (editId.value === movie._id) {
                    resetForm();
                }
            } catch (error) {
                console.error("Delete error:", error);
                status.textContent =
                    "Delete failed: " + error.message;
            }
        });

        item.append(details, editButton, deleteButton);
        movieList.appendChild(item);
    });
}

// Clear the form and exit edit mode
function resetForm() {
    form.reset();
    editId.value = "";
    submitButton.textContent = "Add Movie";
    cancelButton.hidden = true;
}

// Cancel editing
cancelButton.addEventListener("click", function () {
    resetForm();
    status.textContent = "Edit cancelled.";
});

// Add a new movie or update an existing one
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const title = document.getElementById("title").value.trim();
    const yearValue = document.getElementById("year").value;
    const actorsValue = document.getElementById("actors").value;
    const genresValue = document.getElementById("genres").value;

    const year = Number(yearValue);

    // Basic validation
    if (!title || !yearValue || !actorsValue.trim() ||
        !genresValue.trim()) {
        status.textContent = "Please fill in all fields.";
        return;
    }

    if (!Number.isInteger(year) || year < 1888 || year > 2100) {
        status.textContent = "Please enter a valid release year.";
        return;
    }

    const actors = actorsValue
        .split(",")
        .map(actor => actor.trim())
        .filter(Boolean);

    const genres = genresValue
        .split(",")
        .map(genre => genre.trim())
        .filter(Boolean);

    try {
        let movie;

        if (editId.value) {
            // Get the existing document and its latest revision
            const existingMovie = await db.get(editId.value);

            movie = {
                ...existingMovie,
                title: title,
                year: year,
                actors: actors,
                genres: genres
            };
        } else {
            // Create a new document with a unique ID
            movie = {
                _id: new Date().toISOString() + "-" +
                    Math.random().toString(16).slice(2),
                title: title,
                year: year,
                actors: actors,
                genres: genres
            };
        }

        await db.put(movie);

        const wasEditing = Boolean(editId.value);

        resetForm();
        await displayMovies();

        if (wasEditing) {
            alert("Movie edited successfully!");
            status.textContent =
                "Movie updated locally. Sync will update CouchDB.";
        } else {
            alert("Movie added successfully!");
            status.textContent =
                "Movie saved locally. Sync will update CouchDB.";
        }

    } catch (error) {
        console.error("Save error:", error);
        status.textContent = "Save failed: " + error.message;
    }
});

// Synchronize local PouchDB with remote CouchDB

const offlineBtn = document.getElementById("offline-btn");
const syncStatus = document.getElementById("sync-status");

let isOffline = false;
let syncHandler = null;

function goOnline() {
    if (syncHandler) {
        syncHandler.cancel();
    }

    isOffline = false;
    offlineBtn.textContent = "Go Offline";
    syncStatus.textContent = "Connecting to CouchDB...";

    syncHandler = db.sync(remoteDB, {
        live: true,
        retry: true
    })
        .on("change", function (info) {
            syncStatus.textContent =
                "Syncing changes with CouchDB...";
            console.log("Sync changes:", info);
        })
        .on("paused", function () {
            syncStatus.textContent =
                "Online... sync is up to date.";
        })
        .on("active", function () {
            syncStatus.textContent =
                "Syncing with CouchDB...";
        })
        .on("error", function (err) {
            syncStatus.textContent =
                "Sync error: " + err.message;
            console.error(err);
        });
}

function goOffline() {
    isOffline = true;

    if (syncHandler) {
        syncHandler.cancel();
        syncHandler = null;
    }

    offlineBtn.textContent = "Go Online & Sync";
    syncStatus.textContent =
        "Offline from CouchDB...changes saved locally only. Must go online to sync changes!";
}

offlineBtn.addEventListener("click", function () {
    if (isOffline) {
        goOnline();
    } else {
        goOffline();
    }
});

// Start syncing when the app opens
goOnline();


sync.on("change", async function () {
    console.log("Database synchronized.");

    try {
        await displayMovies();
    } catch (error) {
        console.error("Save error:", error);

        if (error.status === 409 || error.name === "conflict") {
            alert(
                "Conflict detected! This movie was changed elsewhere. " +
                "Please reload the latest version before editing again."
            );

            status.textContent =
                "Conflict detected. Reload the latest movie version.";
        } else {
            status.textContent = "Save failed: " + error.message;
            alert("Could not save movie: " + error.message);
        }
    }
});

sync.on("active", function () {
    status.textContent = "Synchronizing with CouchDB...";
});

sync.on("paused", function (error) {
    if (error) {
        status.textContent =
            "Sync waiting for connection. Changes remain local.";
    } else {
        status.textContent =
            "Sync idle. Local changes are saved.";
    }
});

sync.on("error", function (error) {
    console.error("Synchronization error:", error);

    status.textContent =
        "Sync error: " + error.message +
        ". Local storage is still available.";
});

// Load existing local movies when the app starts
displayMovies()
    .then(function () {
        status.textContent = "Movie library ready.";
    })
    .catch(function (error) {
        console.error("Database error:", error);
        status.textContent =
            "Database error: " + error.message;
    });



remoteDB.info()
    .then(function (info) {
        alert("REMOTE COUCHDB CONNECTION OK: " + info.db_name);
    })
    .catch(function (error) {
        alert("REMOTE COUCHDB CONNECTION FAILED: " + error.message);
    });
