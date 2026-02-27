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

/* ---------- Fetch helpers con 3 endpoints ---------- */
async function fetchPokemon(query) {
    if (!query || isLoading) return;
    isLoading = true;
    setLoadingState(true);

    try {
        // ENDPOINT 2: Búsqueda de Pokémon
        const formData = new FormData();
        formData.append("pokemon", String(query));

        const response = await fetch("/api/pokemon/search/", {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": getCSRFToken()
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Respuesta no OK");
        }

        // ENDPOINT 3: Cargar movimientos por separado
        const movesData = await fetchPokemonMoves(data.name.toLowerCase());
        data.moves = movesData;
        
        renderPokemon(data);
        
    } catch (err) {
        console.error("Error AJAX:", err);
        renderError(err.message || "No se pudo obtener la información.");
    } finally {
        setLoadingState(false);
        isLoading = false;
    }
}

// ENDPOINT 3: Obtener movimientos del Pokémon
async function fetchPokemonMoves(pokemonName) {
    try {
        const response = await fetch(`/api/pokemon/${pokemonName}/moves/`);
        const data = await response.json();
        
        if (response.ok) {
            return data.moves || [];
        } else {
            console.error('Error cargando movimientos:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function setLoadingState(loading) {
    prevBtn.disabled = loading;
    nextBtn.disabled = loading;
    
    // Mostrar/ocultar loading state en el input
    if (loading) {
        input.disabled = true;
        form.querySelector('button').textContent = 'Buscando...';
    } else {
        input.disabled = false;
        form.querySelector('button').textContent = 'Buscar';
    }
}

/* ---------- Render helpers ---------- */
function renderPokemon(data) {
    currentId = parseInt(data.number, 10);

    resultDiv.innerHTML = `
        <div class="pokemon-info">
            <h2>${data.name} (#${data.number})</h2>
            <p><strong>Tipo:</strong> ${data.type.toUpperCase()}</p>
            <p><strong>Altura:</strong> ${data.height / 10} m</p>
            <p><strong>Peso:</strong> ${data.weight / 10} kg</p>
            <img src="${data.sprite}" alt="${data.name}" 
                 onerror="this.src='/static/img/pokemon-placeholder.png'">
            
            ${data.moves && data.moves.length > 0 ? `
                <button id="show-moves-btn">Ver Habilidades (${data.moves.length})</button>
                <div id="moves-list" class="hidden"></div>
            ` : '<p>No hay movimientos disponibles</p>'}
        </div>
    `;

    // Configurar botón de movimientos si existe
    const btn = document.getElementById("show-moves-btn");
    const movesDiv = document.getElementById("moves-list");

    if (btn && movesDiv) {
        btn.addEventListener("click", () => {
            if (movesDiv.classList.contains("hidden")) {
                const movesToShow = data.moves.slice(0, 15); // Mostrar primeros 15
                movesDiv.innerHTML = `
                    <h3>Movimientos por Nivel</h3>
                    <ul>
                        ${movesToShow.map(m => 
                            `<li><strong>Nv. ${m.level}</strong> - ${m.name.replace(/-/g, ' ')}</li>`
                        ).join("")}
                        ${data.moves.length > 15 ? `<li><em>... y ${data.moves.length - 15} movimientos más</em></li>` : ''}
                    </ul>
                `;
                movesDiv.classList.remove("hidden");
                btn.textContent = "Ocultar Habilidades";
            } else {
                movesDiv.classList.add("hidden");
                btn.textContent = `Ver Habilidades (${data.moves.length})`;
            }
        });
    }

    // Mostrar flechas al tener un resultado válido
    navArrows.classList.remove("hidden");
    updateArrowState();
}

function renderError(msg) {
    resultDiv.innerHTML = `
        <div class="pokemon-info">
            <p class="error">${msg}</p>
        </div>
    `;
    navArrows.classList.add("hidden");
}

function updateArrowState() {
    prevBtn.disabled = isLoading || currentId <= 1;
    // Nota: Para nextBtn podrías agregar un límite máximo si lo conoces
    nextBtn.disabled = isLoading;
}

/* ---------- Event Listeners ---------- */
prevBtn.addEventListener("click", () => {
    if (currentId && currentId > 1 && !isLoading) {
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
    
    if (e.key === "ArrowLeft" && currentId && currentId > 1 && !isLoading) {
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

/* ---------- Utilidades ---------- */
function getCSRFToken() {
    return document.querySelector('input[name="csrfmiddlewaretoken"]').value;
}

/* ---------- Efectos visuales adicionales ---------- */
// Efecto de escritura en el input (opcional)
input.addEventListener('focus', () => {
    input.style.transform = 'scale(1.02)';
    input.style.boxShadow = '0 0 10px rgba(42, 157, 143, 0.5)';
});

input.addEventListener('blur', () => {
    input.style.transform = 'scale(1)';
    input.style.boxShadow = 'none';
});

// Auto-seleccionar texto al hacer clic en el input
input.addEventListener('click', function() {
    this.select();
}); 


