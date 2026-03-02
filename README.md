# Proyecto Final - Clean Code (Pokédex API)

Este repositorio contiene la entrega final para el curso de Clean Code de Mastermind. El proyecto es una aplicación web basada en Django que actúa como un wrapper y cliente interactivo de la PokeAPI externa, aplicando estrictamente los principios de código limpio, arquitectura de software y manejo de errores.

## Arquitectura y Estructura del Proyecto

El proyecto sigue el patrón arquitectónico de Django, pero adaptado para priorizar la separación de responsabilidades:

* **`views.py` (Lógica de Negocio y Controladores):** Contiene las vistas basadas en clases (CBV) que manejan las peticiones HTTP, orquestan las llamadas a la API externa y transforman los datos brutos en las estructuras de dominio necesarias.
* **`urls.py` (Enrutamiento):** Actúa exclusivamente como el mapa de la aplicación, conectando las rutas web y de la API interna con sus respectivas vistas.
* **`models.py` (Base de Datos - Sin uso):** En este proyecto, el archivo `models.py` se mantiene intencionalmente vacío. 
    * **Justificación:** La aplicación está diseñada como un intermediario (middle-tier) que consume información en tiempo real de una fuente externa (PokeAPI). Persistir estos datos en una base de datos local (SQLite/PostgreSQL) introduciría redundancia, problemas de sincronización de caché y violaría el principio de "Única Fuente de Verdad" (Single Source of Truth). Toda la persistencia es delegada al servicio externo.

## Cumplimiento de Requisitos Técnicos

### 1. Endpoints GET Integrados (Consumo de PokeAPI)
Se crearon tres endpoints específicos de tipo GET para fragmentar la carga de información y respetar el principio de Responsabilidad Única (SRP) en la entrega de datos al cliente. 

Estos endpoints están registrados en `urls.py` y su lógica reside en la parte inferior de `views.py` (implementando clases que heredan de `BasePokemonView`):

1.  **Endpoint de Movimientos:** `api/pokemon/<str:pokemon_name>/moves/`
    * Ubicación de lógica: `views.py` - Clase `PokemonMovesView`.
    * Comportamiento: Realiza un fetch a la PokeAPI, filtra los movimientos por método de aprendizaje ("level-up") e itera sobre las URLs resultantes para extraer poder y precisión.
2.  **Endpoint de Estadísticas Base:** `api/pokemon/<str:pokemon_name>/stats/`
    * Ubicación de lógica: `views.py` - Clase `PokemonStatsView`.
    * Comportamiento: Mapea la matriz de estadísticas del payload principal hacia una lista simplificada de pares clave-valor.
3.  **Endpoint de Habilidades:** `api/pokemon/<str:pokemon_name>/abilities/`
    * Ubicación de lógica: `views.py` - Clase `PokemonAbilitiesView`.
    * Comportamiento: Retorna las habilidades disponibles indicando explícitamente mediante booleanos si se trata de habilidades ocultas.

### 2. Separación de Lógica de Negocio e Integración de API
Para evitar el alto acoplamiento con la PokeAPI, se separó el código en dos capas dentro de la clase `BasePokemonView` (`views.py`):

* **Capa de Integración (Fetch):** El método `_fetch_pokemon_data(self, pokemon_name)` es el único lugar de toda la aplicación que conoce la URL base de PokeAPI y cómo ejecutar la petición HTTP.
* **Capa de Negocio (Parseo):** Métodos como `_parse_pokemon_data` y `_parse_moves` no hacen peticiones web; reciben diccionarios genéricos de Python y aplican la lógica de negocio (filtrado, ordenamiento por nivel, formateo de texto). Si en el futuro se cambia de proveedor de API, la lógica de parseo requiere modificaciones mínimas.

### 3. Manejo de Errores y Excepciones
El control de flujo mediante excepciones es uno de los pilares de este proyecto. Se evitó el uso de estructuras `if/else` anidadas para el control de errores (evitando el anti-patrón Arrow Code).

* **Excepciones Personalizadas:** En la parte superior de `views.py`, se definió una jerarquía de excepciones que heredan de una clase base `PokemonException` (e.g., `InvalidPokemonName`, `PokemonNotFound`, `ExternalAPIError`). Cada excepción conoce su propio código de estado HTTP.
* **Intercepción Global:** En lugar de envolver cada vista en bloques `try/catch`, se sobrescribió el método `dispatch` en `BasePokemonView`. Este método actúa como un middleware interno que captura cualquier `PokemonException` lanzada en las capas inferiores y la formatea estandarizadamente en una respuesta JSON segura para el cliente.

### 4. Prácticas de Clean Code Aplicadas

Durante el desarrollo se tomaron decisiones estrictas basadas en los lineamientos del código limpio:

* **Nomenclatura Clara:** Se utilizaron nombres descriptivos y no abreviados (e.g., `detailed_moves` en lugar de `dm`, `normalized_name` en lugar de `nn`). Los métodos internos se prefijan con un guion bajo (`_`) respetando la convención de encapsulamiento de Python (PEP 8).
* **Comentarios:** Se eliminaron todos los comentarios redundantes que explicaban el "qué" hace el código (ya que el código es autoexplicativo a través de sus nombres de variables y métodos). Solo se conservaron:
    * **Docstrings:** Para definir el contrato público de las clases y métodos principales.
    * **Comentarios de Intención:** Se agregó un comentario en el bucle `for move in moves[:20]:` para documentar explícitamente el por qué de la decisión técnica (evitar el rate-limiting y cuellos de botella por peticiones síncronas).
* **Funciones Pequeñas (Extract Method):** Los controladores se redujeron a un máximo de 5 líneas de código delegando el trabajo sucio a métodos de ayuda semánticos dentro de la clase base.

## Instalación y Ejecución

1. Clonar el repositorio.
2. Crear un entorno virtual: `python -m venv venv`
3. Activar el entorno virtual.
4. Instalar las dependencias (Django): `pip install -r requirements.txt`
5. Ejecutar el servidor de desarrollo: `python manage.py runserver`
6. Acceder a `http://127.0.0.1:8000/` en el navegador.

---
*Documentación generada para la entrega del proyecto final.*
