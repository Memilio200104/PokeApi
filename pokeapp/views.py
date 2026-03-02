import json
import logging
import urllib.request
import urllib.error
from django.shortcuts import render
from django.http import JsonResponse
from django.views import View

logger = logging.getLogger(__name__)

class PokemonException(Exception):
    """Clase base para errores controlados de la API de Pokémon."""
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code

class InvalidPokemonName(PokemonException):
    def __init__(self):
        super().__init__("Proporciona un nombre o ID de Pokémon válido.", 400)

class PokemonNotFound(PokemonException):
    def __init__(self):
        super().__init__("Pokémon no encontrado en la base de datos.", 404)

class ExternalAPIError(PokemonException):
    def __init__(self):
        super().__init__("Error de comunicación con el servidor externo.", 502)


class BasePokemonView(View):
    """Vista base con la lógica común de peticiones y control global de errores."""
    
    def dispatch(self, request, *args, **kwargs):
        """Punto de entrada global: intercepta y formatea todas las excepciones HTTP y de aplicación."""
        try:
            return super().dispatch(request, *args, **kwargs)
        except PokemonException as e:
            return self._error_response(str(e), e.status_code)
        except Exception as e:
            logger.error(f"Error crítico del servidor: {e}", exc_info=True)
            return self._error_response("Error interno del servidor", 500)

    def _normalize_name(self, name):
        if not name:
            raise InvalidPokemonName()
        return str(name).strip().lower().replace(' ', '%20')

    def _fetch_pokemon_data(self, pokemon_name):
        normalized_name = self._normalize_name(pokemon_name)
        url = f'https://pokeapi.co/api/v2/pokemon/{normalized_name}'
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            raw = urllib.request.urlopen(req).read()
            return json.loads(raw)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                raise PokemonNotFound()
            logger.error(f"HTTPError PokeAPI: {err.code}")
            raise ExternalAPIError()
        except Exception as err:
            logger.error(f"Error inesperado PokeAPI: {err}")
            raise ExternalAPIError()

    def _parse_pokemon_data(self, api_response):
        """Extrae los atributos principales del payload completo del Pokémon."""
        return {
            "number": str(api_response['id']),
            "name": api_response['name'].capitalize(),
            "type": api_response['types'][0]['type']['name'],
            "height": api_response['height'],
            "weight": api_response['weight'],
            "sprite": api_response['sprites']['front_default'],
        }

    def _parse_moves(self, moves_data):
        """Filtra y detalla los movimientos aprendidos por nivel."""
        moves = []
        for move_entry in moves_data:
            move_name = move_entry["move"]["name"]
            move_url = move_entry["move"]["url"]
            
            for detail in move_entry["version_group_details"]:
                if detail["move_learn_method"]["name"] == "level-up" and detail["level_learned_at"] > 0:
                    moves.append({
                        "name": move_name,
                        "url": move_url,
                        "level": detail["level_learned_at"]
                    })
                    break 
        
        moves = sorted(moves, key=lambda m: m["level"])
        
        detailed_moves = []
        # Límite técnico: Restringimos a 20 iteraciones para evitar un cuello de botella en 
        # las peticiones HTTP secuenciales y prevenir el bloqueo por rate-limit de la PokeAPI.
        for move in moves[:20]:
            try:
                req = urllib.request.Request(move["url"], headers={'User-Agent': 'Mozilla/5.0'})
                raw = urllib.request.urlopen(req).read()
                move_details = json.loads(raw)
                
                detailed_moves.append({
                    "name": move["name"],
                    "level": move["level"],
                    "type": move_details["type"]["name"],
                    "power": move_details.get("power") or "--",
                    "accuracy": move_details.get("accuracy") or "--",
                    "pp": move_details.get("pp") or "--"
                })
            except Exception as e:
                logger.warning(f"No se pudo obtener detalle del movimiento {move['name']}: {e}")
                
        return detailed_moves

    def _json_response(self, data, status=200):
        return JsonResponse(data, status=status)

    def _error_response(self, message, status=400):
        return self._json_response({"error": True, "message": message}, status=status)


class HomeView(BasePokemonView):
    """Renderiza la interfaz web principal de la Pokedex."""
    def get(self, request):
        return render(request, 'home.html')

class PokemonSearchView(BasePokemonView):
    """Endpoint API (POST) para buscar la información básica de un Pokémon."""
    def post(self, request):
        name = request.POST.get('pokemon', '')
        api_response = self._fetch_pokemon_data(name)
        pokemon_data = self._parse_pokemon_data(api_response)
        return self._json_response(pokemon_data)

class PokemonMovesView(BasePokemonView):
    """Endpoint API (GET) para obtener el listado detallado de movimientos."""
    def get(self, request, pokemon_name):
        api_response = self._fetch_pokemon_data(pokemon_name)
        moves = self._parse_moves(api_response['moves'])
        
        return self._json_response({
            "name": api_response['name'].capitalize(),
            "number": str(api_response['id']),
            "moves": moves
        })

class PokemonStatsView(BasePokemonView):
    """Endpoint API (GET) para obtener las estadísticas base."""
    def get(self, request, pokemon_name):
        api_response = self._fetch_pokemon_data(pokemon_name)
        stats = [{"name": s['stat']['name'], "base_stat": s['base_stat']} 
                 for s in api_response.get('stats', [])]
            
        return self._json_response({
            "name": api_response['name'].capitalize(),
            "number": str(api_response['id']),
            "stats": stats
        })

class PokemonAbilitiesView(BasePokemonView):
    """Endpoint API (GET) para listar las habilidades y su estado (oculta o normal)."""
    def get(self, request, pokemon_name):
        api_response = self._fetch_pokemon_data(pokemon_name)
        abilities = [{"name": a['ability']['name'], "is_hidden": a['is_hidden']} 
                     for a in api_response.get('abilities', [])]
            
        return self._json_response({
            "name": api_response['name'].capitalize(),
            "number": str(api_response['id']),
            "abilities": abilities
        })