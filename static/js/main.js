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

/* ---------- Fetch helpers con TODOS los endpoints ---------- */
async function fetchPokemon(query) {
    if (!query || isLoading) return;
    isLoading = true;
    setLoadingState(true);

    try {
        // ENDPOINT 2: Búsqueda principal del Pokémon
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

        const pokemonNameForApi = data.name.toLowerCase();

        // Usamos Promise.all para llamar a los 3 endpoints GET al mismo tiempo
        // ¡Esto hace que tu Pokedex cargue muchísimo más rápido!
        const [movesData, statsData, abilitiesData] = await Promise.all([
            fetchPokemonMoves(pokemonNameForApi),
            fetchPokemonStats(pokemonNameForApi),
            fetchPokemonAbilities(pokemonNameForApi)
        ]);

        // Agregamos toda la info extra al objeto principal
        data.moves = movesData;
        data.stats = statsData;
        data.abilities = abilitiesData;
        
        renderPokemon(data);
        
    } catch (err) {
        console.error("Error AJAX:", err);
        renderError(err.message || "No se pudo obtener la información.");
    } finally {
        setLoadingState(false);
        isLoading = false;
    }
}

// ENDPOINT 3: Obtener movimientos
async function fetchPokemonMoves(pokemonName) {
    try {
        const response = await fetch(`/api/pokemon/${pokemonName}/moves/`);
        const data = await response.json();
        return response.ok ? (data.moves || []) : [];
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        return [];
    }
}

// NUEVO ENDPOINT: Obtener Estadísticas
async function fetchPokemonStats(pokemonName) {
    try {
        const response = await fetch(`/api/pokemon/${pokemonName}/stats/`);
        const data = await response.json();
        return response.ok ? (data.stats || []) : [];
    } catch (error) {
        console.error('Error cargando stats:', error);
        return [];
    }
}

// NUEVO ENDPOINT: Obtener Habilidades
async function fetchPokemonAbilities(pokemonName) {
    try {
        const response = await fetch(`/api/pokemon/${pokemonName}/abilities/`);
        const data = await response.json();
        return response.ok ? (data.abilities || []) : [];
    } catch (error) {
        console.error('Error cargando habilidades:', error);
        return [];
    }
}

function setLoadingState(loading) {
    prevBtn.disabled = loading;
    nextBtn.disabled = loading;
    
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

    // Creamos la lista de habilidades en HTML
    const abilitiesHtml = data.abilities && data.abilities.length > 0 
        ? data.abilities.map(a => `<li>${a.name.replace(/-/g, ' ')} ${a.is_hidden ? '<strong>(Oculta)</strong>' : ''}</li>`).join('')
        : '<li>Sin habilidades</li>';

    // Creamos la lista de estadísticas en HTML
    const statsHtml = data.stats && data.stats.length > 0
        ? data.stats.map(s => `<li><strong>${s.name.toUpperCase()}:</strong> ${s.base_stat}</li>`).join('')
        : '<li>Sin estadísticas</li>';

    resultDiv.innerHTML = `
        <div class="pokemon-info">
            <h2>${data.name} (#${data.number})</h2>
            <img src="${data.sprite}" alt="${data.name}" 
                 onerror="this.src='/static/img/pokemon-placeholder.png'">
            
            <div class="basic-info">
                <p><strong>Tipo:</strong> ${data.type.toUpperCase()}</p>
                <p><strong>Altura:</strong> ${data.height / 10} m</p>
                <p><strong>Peso:</strong> ${data.weight / 10} kg</p>
            </div>

            <div class="extra-info" style="display: flex; justify-content: space-around; text-align: left; margin-top: 15px;">
                <div class="abilities-box">
                    <h3>Habilidades</h3>
                    <ul>${abilitiesHtml}</ul>
                </div>
                <div class="stats-box">
                    <h3>Stats Base</h3>
                    <ul>${statsHtml}</ul>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                ${data.moves && data.moves.length > 0 ? `
                    <button id="show-moves-btn">Ver Movimientos (${data.moves.length})</button>
                    <div id="moves-list" class="hidden"></div>
                ` : '<p>No hay movimientos disponibles</p>'}
            </div>
        </div>
    `;

    // Configurar botón de movimientos
// Configurar botón de movimientos
    const btn = document.getElementById("show-moves-btn");
    const movesDiv = document.getElementById("moves-list");

    if (btn && movesDiv) {
       btn.addEventListener("click", () => {
            if (movesDiv.classList.contains("hidden")) {
                movesDiv.innerHTML = `
                    <h3 style="text-align: center; margin-bottom: 15px; color: #333;">Movimientos por Nivel</h3>
                    
                    <div style="max-height: 280px; overflow-y: auto; background-color: #f0f0f0; border: inset 4px #a0a0a0; padding: 12px; border-radius: 5px;">
                        
                        <ul style="list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                            ${data.moves.map(m => `
                                <li style="background: white; border: 2px solid #444; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 2px 2px 0px rgba(0,0,0,0.2);">
                                    
                                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 4px;">
                                        <strong style="text-transform: capitalize; font-size: 0.95em; color: #111;">
                                            ${m.name.replace(/-/g, ' ')}
                                        </strong>
                                        <span style="background: #e3350d; color: white; padding: 2px 6px; border-radius: 12px; font-size: 0.75em; font-weight: bold;">
                                            Nv. ${m.level}
                                        </span>
                                    </div>
                                    
                                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 4px;">
                                        <span style="text-transform: capitalize; font-weight: 800; color: #555;">
                                            Tipo: ${m.type}
                                        </span>
                                        <span style="font-weight: bold; color: #666;">
                                            PP: ${m.pp}
                                        </span>
                                    </div>
                                    
                                    <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #555; background: #f8f9fa; padding: 4px; border-radius: 4px; margin-top: 2px;">
                                        <span><strong>Poder:</strong> ${m.power}</span>
                                        <span><strong>Prec:</strong> ${m.accuracy}</span>
                                    </div>
                                </li>
                            `).join("")}
                        </ul>
                        
                    </div>
                `;
                movesDiv.classList.remove("hidden");
                btn.textContent = "Ocultar Movimientos";
            } else {
                movesDiv.classList.add("hidden");
                btn.textContent = `Ver Movimientos (${data.moves.length})`;
            }
        }); 
    }

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
input.addEventListener('focus', () => {
    input.style.transform = 'scale(1.02)';
    input.style.boxShadow = '0 0 10px rgba(42, 157, 143, 0.5)';
});

input.addEventListener('blur', () => {
    input.style.transform = 'scale(1)';
    input.style.boxShadow = 'none';
});

input.addEventListener('click', function() {
    this.select();
});