from django.urls import path
from . import views

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('api/pokemon/search/', views.PokemonSearchView.as_view(), name='pokemon_search'),
    path('api/pokemon/<str:pokemon_name>/moves/', views.PokemonMovesView.as_view(), name='pokemon_moves'),
]