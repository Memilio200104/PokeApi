from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import urllib.request
import json


class BasePokemonView(View):
    #Vista base con funcionalidades comunes para Pokémon
    
    def _is_ajax(self, request):
        """Detecta si la petición es AJAX"""
        return (request.headers.get("x-requested-with") == "XMLHttpRequest" or 
                "application/json" in request.headers.get("accept", ""))

    def _fetch_pokemon_data(self, url):
        """Obtiene datos de la PokeAPI"""
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req).read()
        return json.loads(raw)

    def _build_pokeapi_url(self, pokemon_name):
        """Construye la URL para la PokeAPI"""
        return f'https://pokeapi.co/api/v2/pokemon/{pokemon_name}'

    def _parse_pokemon_data(self, api_response):
        """Parsea los datos básicos del Pokémon"""
        return {
            "number": str(api_response['id']),
            "name": api_response['name'].capitalize(),
            "type": api_response['types'][0]['type']['name'],
            "height": str(api_response['height']),
            "weight": str(api_response['weight']),
            "sprite": api_response['sprites']['front_default'],
        }

    def _parse_moves(self, moves_data):
        """Parsea los movimientos del Pokémon"""
        moves = []
        for move_entry in moves_data:
            move_name = move_entry["move"]["name"]
            for detail in move_entry["version_group_details"]:
                if detail["move_learn_method"]["name"] == "level-up" and detail["level_learned_at"] > 0:
                    moves.append({
                        "name": move_name,
                        "level": detail["level_learned_at"]
                    })
        return sorted(moves, key=lambda m: m["level"])

    def _json_response(self, data, status=200):
        """Devuelve una respuesta JSON estándar"""
        return JsonResponse(data, status=status)

    def _error_response(self, message, status=400):
        """Devuelve una respuesta de error estándar"""
        return self._json_response({"error": message}, status=status)


class HomeView(BasePokemonView):
    """
    - GET: Renderiza la interfaz web
    """
    def get(self, request):
        return render(request, 'home.html')


class PokemonSearchView(BasePokemonView):
    """
    Endpoint 2: Búsqueda de Pokémon
    - POST: Busca un Pokémon por nombre o ID
    """
    def post(self, request):
        pokemon_name = self._get_pokemon_name_from_request(request)
        if not pokemon_name:
            return self._error_response("Proporciona el nombre del Pokémon", 400)

        try:
            api_url = self._build_pokeapi_url(pokemon_name)
            api_response = self._fetch_pokemon_data(api_url)
            pokemon_data = self._parse_pokemon_data(api_response)
            return self._json_response(pokemon_data)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return self._error_response("Pokémon no encontrado", 404)
            return self._error_response("Error al consultar PokeAPI", 502)
        except Exception as err:
            print(f"Error al consultar PokeAPI: {err}")
            return self._error_response("Error interno del servidor", 500)

    def _get_pokemon_name_from_request(self, request):
        """Extrae y normaliza el nombre del Pokémon del request"""
        name = request.POST.get('pokemon', '').strip().lower()
        return name.replace(' ', '%20')


class PokemonMovesView(BasePokemonView):
    """
    - GET: Obtiene los movimientos de un Pokémon por nombre o ID
    """
    def get(self, request, pokemon_name):
        if not pokemon_name:
            return self._error_response("Proporciona el nombre del Pokémon", 400)

        try:
            normalized_name = pokemon_name.strip().lower().replace(' ', '%20')
            api_url = self._build_pokeapi_url(normalized_name)
            api_response = self._fetch_pokemon_data(api_url)
            
            moves = self._parse_moves(api_response['moves'])
            moves_data = {
                "name": api_response['name'].capitalize(),
                "number": str(api_response['id']),
                "moves": moves
            }
            return self._json_response(moves_data)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return self._error_response("Pokémon no encontrado", 404)
            return self._error_response("Error al consultar PokeAPI", 502)
        except Exception as err:
            print(f"Error al consultar PokeAPI: {err}")
            return self._error_response("Error interno del servidor", 500)




