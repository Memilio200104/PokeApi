from django.urls import path
from . import views

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('api/pokemon/search/', views.PokemonSearchView.as_view(), name='pokemon_search'),
    path('api/pokemon/<str:pokemon_name>/moves/', views.PokemonMovesView.as_view(), name='pokemon_moves'),
    path('api/pokemon/<str:pokemon_name>/stats/', views.PokemonStatsView.as_view(), name='pokemon_stats'),
    path('api/pokemon/<str:pokemon_name>/abilities/', views.PokemonAbilitiesView.as_view(), name='pokemon_abilities'),
]