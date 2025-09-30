const video = document.getElementById("intro");
const pokedex = document.getElementById("pokedex-content");
const music = document.getElementById("bg-music");

const form = document.getElementById("pokemon-form");
const input = document.getElementById("pokemon-input");
const resultDiv = document.getElementById("pokemon-result");

const navArrows = document.getElementById("nav-arrows");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

let currentId = null;
let isLoading = false;

/* ---------- Intro: mostrar pokedex cuando termina el video ---------- */
pokedex.style.display = "none";
video.onended = () => {
    video.style.display = "none";
    pokedex.style.display = "flex";
};

/* Click en video: activar sonido */
video.addEventListener("click", () => {
    if (video.muted) {
        video.muted = false;
        video.play();
    }
});

/* Música en loop a los 4s */
window.addEventListener("load", () => {
    setTimeout(() => {
        music.play().catch(err => {
            console.log("Autoplay bloqueado:", err);
        });
    }, 4000);
});

/* ---------- Fetch helpers ---------- */
async function fetchPokemon(query) {
    if (!query || isLoading) return;
    isLoading = true;
    setLoadingState(true);

    const formData = new FormData();
    // El backend acepta nombre o número
    formData.append("pokemon", String(query));

    try {
        const response = await fetch("/", {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error("Respuesta no OK");
        }
        const data = await response.json();

        if (data.error) {
            renderError(data.error);
        } else {
            renderPokemon(data);
        }
    } catch (err) {
        console.error("Error AJAX:", err);
        renderError("No se pudo obtener la información.");
    } finally {
        setLoadingState(false);
        isLoading = false;
    }
}

function setLoadingState(loading) {
    // opcional: spinner, deshabilitar botones
    prevBtn.disabled = loading;
    nextBtn.disabled = loading;
}

/* ---------- Render helpers ---------- */
function renderPokemon(data) {
    currentId = parseInt(data.number, 10);

    resultDiv.innerHTML = `
        <div class="pokemon-info">
            <h2>${data.name} (#${data.number})</h2>
            <p>Tipo: ${data.type}</p>
            <p>Altura: ${data.height}</p>
            <p>Peso: ${data.weight}</p>
            <img src="${data.sprite}" alt="${data.name}">
        </div>
    `;

    // Mostrar flechas al tener un resultado válido
    navArrows.classList.remove("hidden");
    updateArrowState();
}

function renderError(msg) {
    resultDiv.innerHTML = `<p>${msg}</p>`;
    if (currentId !== null) {
        navArrows.classList.remove("hidden");
    }
}

function updateArrowState() {
    prevBtn.disabled = isLoading;
    nextBtn.disabled = isLoading;
}

prevBtn.addEventListener("click", () => {
    if (currentId && !isLoading) {
        fetchPokemon(currentId - 1);
    }
});
nextBtn.addEventListener("click", () => {
    if (currentId && !isLoading) {
        fetchPokemon(currentId + 1);
    }
});
document.addEventListener("keydown", (e) => {
    if (!pokedex || pokedex.style.display === "none") return;
    if (e.key === "ArrowLeft" && currentId && !isLoading) {
        e.preventDefault();
        fetchPokemon(currentId - 1);
    } else if (e.key === "ArrowRight" && currentId && !isLoading) {
        e.preventDefault();
        fetchPokemon(currentId + 1);
    }
});

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = (input.value || "").trim();
    if (!query) return;
    fetchPokemon(query);
});
function renderPokemon(data) {
    currentId = parseInt(data.number, 10);

    resultDiv.innerHTML = `
        <div class="pokemon-info">
            <h2>${data.name} (#${data.number})</h2>
            <p>Tipo: ${data.type}</p>
            <p>Altura: ${data.height}</p>
            <p>Peso: ${data.weight}</p>
            <img src="${data.sprite}" alt="${data.name}">
            <button id="show-moves-btn">Ver habilidades</button>
            <div id="moves-list" class="hidden"></div>
        </div>
    `;

    // Botón para mostrar habilidades
    const btn = document.getElementById("show-moves-btn");
    const movesDiv = document.getElementById("moves-list");

    btn.addEventListener("click", () => {
        if (movesDiv.classList.contains("hidden")) {
            if (data.moves && data.moves.length > 0) {
                movesDiv.innerHTML = `
                    <h3>Movimientos por nivel</h3>
                    <ul>
                        ${data.moves.map(m => `<li>Nivel ${m.level}: ${m.name}</li>`).join("")}
                    </ul>
                `;
            } else {
                movesDiv.innerHTML = "<p>No hay movimientos disponibles.</p>";
            }
            movesDiv.classList.remove("hidden");
            btn.textContent = "Ocultar habilidades";
        } else {
            movesDiv.classList.add("hidden");
            btn.textContent = "Ver habilidades";
        }
    });

    // Mostrar flechas
    navArrows.classList.remove("hidden");
    updateArrowState();
}
