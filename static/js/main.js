class PokemonError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
    }
}

class ValidationError extends PokemonError {
    constructor(message) { super(message, 400); }
}

class NotFoundError extends PokemonError {
    constructor(message) { super(message, 404); }
}

class ServerError extends PokemonError {
    constructor(message) { super(message, 500); }
}

const CONFIG = {
    MUSIC_DELAY_MS: 4000,
    ENDPOINTS: {
        SEARCH: "/api/pokemon/search/",
        MOVES: (name) => `/api/pokemon/${name}/moves/`,
        STATS: (name) => `/api/pokemon/${name}/stats/`,
        ABILITIES: (name) => `/api/pokemon/${name}/abilities/`
    }
};

const DOM = {
    video: document.getElementById("intro"),
    pokedex: document.getElementById("pokedex-content"),
    music: document.getElementById("bg-music"),
    form: document.getElementById("pokemon-form"),
    input: document.getElementById("pokemon-input"),
    resultDiv: document.getElementById("pokemon-result"),
    navArrows: document.getElementById("nav-arrows"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    csrfToken: document.querySelector('input[name="csrfmiddlewaretoken"]')
};

const STATE = {
    currentId: null,
    isLoading: false
};

/**
 * Procesa la respuesta de la API y lanza excepciones específicas según el código HTTP.
 * @param {Response} response - El objeto de respuesta nativo de Fetch.
 * @returns {Promise<Object>} El payload JSON parseado.
 */
async function handleApiResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
        const errorMsg = data.message || "Error desconocido de red.";
        switch (response.status) {
            case 400: throw new ValidationError(errorMsg);
            case 404: throw new NotFoundError(errorMsg);
            default: throw new ServerError(errorMsg);
        }
    }
    return data;
}

/**
 * Envoltorio para Fetch que integra la validación automática de respuestas.
 * @param {string} url - Ruta del endpoint.
 * @param {Object} [options={}] - Configuraciones de Fetch (method, headers, body).
 */
async function fetchWithValidation(url, options = {}) {
    const response = await fetch(url, options);
    return handleApiResponse(response);
}

/**
 * Orquesta la búsqueda y recopilación de todos los datos de un Pokémon.
 * @param {string|number} query - El nombre o ID del Pokémon a buscar.
 */
async function fetchPokemon(query) {
    if (!query || STATE.isLoading) return;
    setLoadingState(true);

    try {
        const formData = new FormData();
        formData.append("pokemon", String(query));

        const mainData = await fetchWithValidation(CONFIG.ENDPOINTS.SEARCH, {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": DOM.csrfToken ? DOM.csrfToken.value : ""
            },
            body: formData
        });

        const apiName = mainData.name.toLowerCase();

        // Los .catch silenciosos aseguran que si un endpoint secundario falla (ej. stats),
        // el front-end no se bloquee y aún pueda renderizar la información básica del Pokémon.
        const [movesData, statsData, abilitiesData] = await Promise.all([
            fetchWithValidation(CONFIG.ENDPOINTS.MOVES(apiName)).catch(() => ({ moves: [] })),
            fetchWithValidation(CONFIG.ENDPOINTS.STATS(apiName)).catch(() => ({ stats: [] })),
            fetchWithValidation(CONFIG.ENDPOINTS.ABILITIES(apiName)).catch(() => ({ abilities: [] }))
        ]);

        const completeData = {
            ...mainData,
            moves: movesData.moves || [],
            stats: statsData.stats || [],
            abilities: abilitiesData.abilities || []
        };

        renderPokemon(completeData);

    } catch (error) {
        handlePokemonError(error);
    } finally {
        setLoadingState(false);
    }
}

function handlePokemonError(error) {
    console.error(`[${error.name}]`, error.message);
    
    if (error instanceof ValidationError) {
        renderError(`Atención: ${error.message}`);
    } else if (error instanceof NotFoundError) {
        renderError(`Sin resultados: ${error.message}`);
    } else {
        renderError("Ocurrió un problema de comunicación con el servidor.");
    }
}

/**
 * Construye e inyecta en el DOM la interfaz principal del Pokémon consultado.
 * @param {Object} data - Objeto unificado con la información base, habilidades, stats y movimientos.
 */
function renderPokemon(data) {
    STATE.currentId = parseInt(data.number, 10);

    const abilitiesHtml = buildListHtml(data.abilities, a => 
        `${a.name.replace(/-/g, ' ')} ${a.is_hidden ? '<strong>(Oculta)</strong>' : ''}`
    , "Sin habilidades");

    const statsHtml = buildListHtml(data.stats, s => 
        `<strong>${s.name.toUpperCase()}:</strong> ${s.base_stat}`
    , "Sin estadísticas");

    DOM.resultDiv.innerHTML = `
        <div class="pokemon-info">
            <h2>${data.name} (#${data.number})</h2>
            <img src="${data.sprite}" alt="${data.name}" onerror="this.src='/static/img/pokemon-placeholder.png'">
            
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
            
            <div style="margin-top: 15px;" id="moves-container"></div>
        </div>
    `;

    setupMovesToggle(data.moves);
    DOM.navArrows.classList.remove("hidden");
    updateArrowState();
}

function buildListHtml(items, formatter, emptyMessage) {
    if (!items || items.length === 0) return `<li>${emptyMessage}</li>`;
    return items.map(item => `<li>${formatter(item)}</li>`).join('');
}

function setupMovesToggle(moves) {
    const container = document.getElementById("moves-container");
    if (!moves || moves.length === 0) {
        container.innerHTML = '<p>No hay movimientos disponibles</p>';
        return;
    }

    container.innerHTML = `
        <button id="show-moves-btn">Ver Movimientos (${moves.length})</button>
        <div id="moves-list" class="hidden"></div>
    `;

    const btn = document.getElementById("show-moves-btn");
    const movesDiv = document.getElementById("moves-list");

    btn.addEventListener("click", () => {
        const isHidden = movesDiv.classList.contains("hidden");
        if (isHidden) {
            movesDiv.innerHTML = generateMovesGridHtml(moves);
            movesDiv.classList.remove("hidden");
            btn.textContent = "Ocultar Movimientos";
        } else {
            movesDiv.classList.add("hidden");
            btn.textContent = `Ver Movimientos (${moves.length})`;
        }
    });
}

function generateMovesGridHtml(moves) {
    const listItems = moves.map(m => `
        <li style="background: white; border: 2px solid #444; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 2px 2px 0px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 4px;">
                <strong style="text-transform: capitalize; font-size: 0.95em; color: #111;">${m.name.replace(/-/g, ' ')}</strong>
                <span style="background: #e3350d; color: white; padding: 2px 6px; border-radius: 12px; font-size: 0.75em; font-weight: bold;">Nv. ${m.level}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 4px;">
                <span style="text-transform: capitalize; font-weight: 800; color: #555;">Tipo: ${m.type}</span>
                <span style="font-weight: bold; color: #666;">PP: ${m.pp}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: #555; background: #f8f9fa; padding: 4px; border-radius: 4px; margin-top: 2px;">
                <span><strong>Poder:</strong> ${m.power}</span>
                <span><strong>Prec:</strong> ${m.accuracy}</span>
            </div>
        </li>
    `).join("");

    return `
        <h3 style="text-align: center; margin-bottom: 15px; color: #333;">Movimientos por Nivel</h3>
        <div style="max-height: 280px; overflow-y: auto; background-color: #f0f0f0; border: inset 4px #a0a0a0; padding: 12px; border-radius: 5px;">
            <ul style="list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                ${listItems}
            </ul>
        </div>
    `;
}

function renderError(msg) {
    DOM.resultDiv.innerHTML = `<div class="pokemon-info"><p class="error">${msg}</p></div>`;
    DOM.navArrows.classList.add("hidden");
}

function setLoadingState(loading) {
    STATE.isLoading = loading;
    DOM.prevBtn.disabled = loading;
    DOM.nextBtn.disabled = loading;
    DOM.input.disabled = loading;
    const btn = DOM.form.querySelector('button');
    if (btn) btn.textContent = loading ? 'Buscando...' : 'Buscar';
}

function updateArrowState() {
    DOM.prevBtn.disabled = STATE.isLoading || STATE.currentId <= 1;
    DOM.nextBtn.disabled = STATE.isLoading;
}

function initializeEvents() {
    if (DOM.pokedex) DOM.pokedex.style.display = "none";
    
    if (DOM.video) {
        DOM.video.onended = () => {
            DOM.video.style.display = "none";
            DOM.pokedex.style.display = "flex";
        };

        DOM.video.addEventListener("click", () => {
            if (DOM.video.muted) {
                DOM.video.muted = false;
                DOM.video.play();
            }
        });
    }

    window.addEventListener("load", () => {
        setTimeout(() => {
            if (DOM.music) {
                DOM.music.play().catch(err => console.log("Autoplay bloqueado:", err));
            }
        }, CONFIG.MUSIC_DELAY_MS);
    });

    if (DOM.prevBtn) {
        DOM.prevBtn.addEventListener("click", () => {
            if (STATE.currentId > 1 && !STATE.isLoading) fetchPokemon(STATE.currentId - 1);
        });
    }

    if (DOM.nextBtn) {
        DOM.nextBtn.addEventListener("click", () => {
            if (STATE.currentId && !STATE.isLoading) fetchPokemon(STATE.currentId + 1);
        });
    }

    document.addEventListener("keydown", (e) => {
        if (!DOM.pokedex || DOM.pokedex.style.display === "none" || STATE.isLoading) return;
        if (e.key === "ArrowLeft" && STATE.currentId > 1) fetchPokemon(STATE.currentId - 1);
        if (e.key === "ArrowRight" && STATE.currentId) fetchPokemon(STATE.currentId + 1);
    });

    if (DOM.form) {
        DOM.form.addEventListener("submit", (e) => {
            e.preventDefault();
            const query = (DOM.input.value || "").trim();
            fetchPokemon(query);
        });
    }

    if (DOM.input) {
        DOM.input.addEventListener('focus', () => {
            DOM.input.style.transform = 'scale(1.02)';
            DOM.input.style.boxShadow = '0 0 10px rgba(42, 157, 143, 0.5)';
        });

        DOM.input.addEventListener('blur', () => {
            DOM.input.style.transform = 'scale(1)';
            DOM.input.style.boxShadow = 'none';
        });

        DOM.input.addEventListener('click', function() {
            this.select();
        });
    }
}

initializeEvents();