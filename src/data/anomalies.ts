import type { AnomalyConfig } from '../domain/types'

export const ANOMALIES: AnomalyConfig[] = [
  {
    id: 'niestabilne-pole',
    name: 'Niestabilne Pole',
    effect: 'Wszyscy gracze mają -2 sekundy na odpowiedź w tym pytaniu.',
  },
  {
    id: 'wzmocnienie-sygnalu',
    name: 'Wzmocnienie Sygnału',
    effect:
      'Maksymalny bonus za szybkość w tym pytaniu wynosi +75 pkt zamiast +50 pkt.',
  },
  {
    id: 'proba-kontrolna',
    name: 'Próba Kontrolna',
    effect: 'W tym pytaniu nie działają negatywne efekty PvP.',
  },
  {
    id: 'fluktuacja-wyniku',
    name: 'Fluktuacja Wyniku',
    effect:
      'W tym pytaniu poprawna odpowiedź daje +20% punktów, a błędna odpowiedź zabiera dodatkowe -25 pkt.',
  },
  {
    id: 'cisza-pomiarowa',
    name: 'Cisza Pomiarowa',
    effect:
      'Po tym pytaniu tabela wyników jest ukryta do rozpoczęcia następnego pytania.',
  },
  {
    id: 'przesuniecie-fazowe',
    name: 'Przesunięcie Fazowe',
    effect:
      'W tym pytaniu bonus za szybkość nie działa. Poprawna odpowiedź daje bazowo +125 pkt zamiast +100 pkt.',
  },
]
