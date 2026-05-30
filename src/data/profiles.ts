import type { ProfileConfig } from '../domain/types'

export const PROFILES: ProfileConfig[] = [
  {
    id: 'chronotyp',
    name: 'Chronotyp',
    style: 'czas',
    passive: 'Masz +1 sekundę na każde pytanie.',
    active:
      'Raz na Test dodaj sobie +4 sekundy do aktualnego pytania. Możesz użyć przed udzieleniem odpowiedzi.',
    flavor: '„Czas nie płynie szybciej. Ty płyniesz wolniej."',
  },
  {
    id: 'katalizator',
    name: 'Katalizator',
    style: 'modyfikacje',
    passive:
      'Pierwsza poprawna odpowiedź po wybraniu każdej Modyfikacji daje dodatkowe +40 pkt.',
    active:
      'Raz na Test, jeśli masz co najmniej jedną aktywną Modyfikację, Twoja następna poprawna odpowiedź daje dodatkowe +60 pkt.',
    flavor: '„Reakcja zaczyna się dopiero po kontakcie z decyzją."',
  },
  {
    id: 'stabilizator',
    name: 'Stabilizator',
    style: 'obrona',
    passive: 'Pierwsze 2 błędne odpowiedzi w Teście mają karę zmniejszoną o 50%.',
    active:
      'Raz na Test anuluj bazową karę za błędną odpowiedź w aktualnym pytaniu. Nie anuluje dodatkowych kar z Modyfikacji.',
    flavor: '„Nie zapobiega błędom. Zmniejsza rozmiar krateru."',
  },
  {
    id: 'spektrometr',
    name: 'Spektrometr',
    style: 'informacja',
    passive: 'Przed każdym pytaniem widzisz kategorię 2 sekundy wcześniej niż inni gracze.',
    active:
      '2 razy na Test zobacz poziom trudności aktualnego pytania przed odpowiedzią.',
    flavor: '„Nie zna odpowiedzi. Zna kształt problemu."',
  },
  {
    id: 'replikant',
    name: 'Replikant',
    style: 'kopiowanie',
    passive: 'Po każdej rundzie draftu widzisz, którą Modyfikację wybrał aktualny lider.',
    active:
      'Raz na Test skopiuj aktywną Modyfikację wybranego gracza. Skopiowana Modyfikacja ma 50% wartości punktowych/procentowych. Czas działania bez zmian.',
    flavor: '„Oryginał był tylko pierwszą wersją."',
  },
  {
    id: 'operator-pola',
    name: 'Operator Pola',
    style: 'anty-pvp',
    passive:
      'Negatywne efekty PvP skierowane w Ciebie trwają o 1 pytanie krócej. Minimum to 1 pytanie.',
    active:
      'Raz na Test zablokuj jeden negatywny efekt PvP skierowany w Ciebie. Możesz użyć po zobaczeniu efektu.',
    flavor: '„Pole nie jest bezpieczne. Jest kontrolowane."',
  },
  {
    id: 'synapsa',
    name: 'Synapsa',
    style: 'seria',
    passive: 'Za każdą serię 3 poprawnych odpowiedzi z rzędu dostajesz dodatkowe +60 pkt.',
    active:
      'Raz na Test zabezpiecz aktualną serię. Następna błędna odpowiedź nie resetuje serii.',
    flavor: '„Jedna odpowiedź to impuls. Trzy to wzorzec."',
  },
  {
    id: 'null',
    name: 'Null',
    style: 'reset',
    passive: 'Raz na Test pierwsza błędna odpowiedź nie daje bazowej kary punktowej.',
    active:
      'Raz na Test usuń jeden aktywny negatywny efekt PvP. Nie usuwa kosztów Modyfikacji wybranych przez Ciebie.',
    flavor: '„Brak sygnału też jest wynikiem."',
  },
  {
    id: 'wektor',
    name: 'Wektor',
    style: 'szybkość',
    passive:
      'Odpowiedź w pierwszych 4 sekundach daje dodatkowe +25 pkt, jeśli jest poprawna.',
    active:
      'Raz na Test podwój swój bonus za szybkość w aktualnym pytaniu. Maksymalny dodatkowy zysk z tej aktywnej umiejętności: +50 pkt.',
    flavor: '„Kierunek jest ważny. Prędkość też."',
  },
  {
    id: 'archiwista',
    name: 'Archiwista',
    style: 'kategorie',
    passive:
      'Jeśli dwa pytania z rzędu są z tej samej kategorii, poprawna odpowiedź w drugim pytaniu daje dodatkowe +50 pkt.',
    active:
      'Raz na Test przed pytaniem wybierz jedną z dwóch kategorii. Następne pytanie będzie z wybranej kategorii dla wszystkich graczy.',
    flavor: '„Wszystko już gdzieś było. Trzeba tylko wiedzieć gdzie."',
  },
  {
    id: 'fraktal',
    name: 'Fraktal',
    style: 'comeback',
    passive:
      'Jeśli jesteś w dolnej połowie tabeli, poprawna odpowiedź daje dodatkowe +30 pkt.',
    active:
      'Raz na Test, jeśli jesteś na ostatnim miejscu, następna poprawna odpowiedź daje dodatkowe +100 pkt.',
    flavor: '„Każda porażka zawiera mniejszą wersję powrotu."',
  },
  {
    id: 'obserwator',
    name: 'Obserwator',
    style: 'informacja',
    passive: 'Po 5 sekundach pytania widzisz, ilu graczy już odpowiedziało.',
    active:
      'Raz na Test po 6 sekundach pytania zobacz, ile osób wybrało każdą odpowiedź. Twoje punkty za to pytanie są zmniejszone o 30%.',
    flavor: '„Pomiar zmienia wynik. Czasem warto."',
  },
  {
    id: 'przekaznik',
    name: 'Przekaźnik',
    style: 'wydłużanie',
    passive:
      'Pierwsza Modyfikacja czasowa, którą wybierzesz, trwa o 1 pytanie dłużej.',
    active:
      'Raz na Test wydłuż aktualnie aktywną Modyfikację czasową o 1 pytanie. Nie działa na Modyfikacje jednorazowe.',
    flavor: '„Sygnał nie ginie. Zmienia nośnik."',
  },
  {
    id: 'horyzont',
    name: 'Horyzont',
    style: 'końcówka',
    passive: 'W pytaniach 10–12 Twoje poprawne odpowiedzi dają +20% punktów.',
    active:
      'Raz na Test przed pytaniem 10, 11 albo 12 zwiększ swój bonus końcowy do +40% na jedno pytanie.',
    flavor: '„Najważniejsze dane pojawiają się przy granicy."',
  },
  {
    id: 'izolator',
    name: 'Izolator',
    style: 'odporność',
    passive: 'Pierwszy negatywny efekt PvP w Teście nie działa na Ciebie.',
    active:
      'Raz na Test przez następne 2 pytania nie możesz być celem efektów PvP.',
    flavor: '„Próbka została odseparowana od chaosu."',
  },
]
