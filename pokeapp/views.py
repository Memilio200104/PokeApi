from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
import urllib.request
import json


class HomeView(View):
    """
    Vista principal de la Pokédex:
    - GET: Renderiza la plantilla inicial.
    - POST: Devuelve datos de Pokémon 
    """
    def get(self, request):
        #Carga inicial de la página (vacía).
        return render(request, 'home.html')

    def post(self, request):
        pokemon_name = self._get_pokemon_name_from_request(request)
        if not pokemon_name:
            error = {"error": "Proporciona el nombre del Pokémon"}
            return self._json_or_html(request, context={}, json_payload=error, status=400)

        try:
            api_url = self._build_pokeapi_url(pokemon_name)
            api_response = self._fetch_pokemon_data(api_url)
            pokemon_data = self._parse_pokemon_data(api_response)
            return self._json_or_html(request, context=pokemon_data, json_payload=pokemon_data)
        except Exception as err:
            # Aviso de consecuencia: si la API falla, devolvemos error controlado.
            print(f"Error al consultar PokeAPI: {err}")
            error = {"error": "No se pudo obtener la información del Pokémon"}
            return self._json_or_html(request, context={}, json_payload=error, status=502)

    def is_ajax(self, request):
        #Detecta si la petición es AJAX (fetch/XHR).
        return request.headers.get("x-requested-with") == "XMLHttpRequest" or \
               "application/json" in (request.headers.get("accept", ""))

    def json_or_html(self, request, *, context, json_payload, status=200):
        #Devuelve JSON si la petición es AJAX,
        #de lo contrario, renderiza la plantilla con contexto.
        if self._is_ajax(request):
            return JsonResponse(json_payload, status=status)
        return render(request, 'home.html', context, status=status)

    def get_pokemon_name_from_request(self, request):
        #Normaliza el nombre como lo espera la API (minúsculas y %20 para espacios).
        name = request.POST.get('pokemon', '').strip().lower()
        return name.replace(' ', '%20')

    def build_pokeapi_url(self, pokemon_name):
        return f'https://pokeapi.co/api/v2/pokemon/{pokemon_name}'

    def fetch_pokemon_data(self, url):
        req = urllib.request.Request(url, headers={'User-Agent': 'charizard'})
        raw = urllib.request.urlopen(req).read()
        return json.loads(raw)

    def parse_pokemon_data(self, api_response):
        return {
            "number": str(api_response['id']),
            "name": api_response['name'].capitalize(),
            "type": api_response['types'][0]['type']['name'],
            "height": str(api_response['height']),
            "weight": str(api_response['weight']),
            "sprite": api_response['sprites']['front_default'],
            "moves": self._parse_moves(api_response['moves']),
        }

    def parse_moves(self, moves_data):
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
