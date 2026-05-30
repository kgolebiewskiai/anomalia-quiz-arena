import type { ModificationConfig } from '../domain/types'

export const MODIFICATIONS: ModificationConfig[] = [
  {
    id: 'prog-pewnosci',
    name: 'Próg Pewności',
    type: 'Ryzyko',
    effect:
      'Przez następne 2 pytania: poprawna odpowiedź daje +50% punktów, błędna odpowiedź zabiera dodatkowe -75 pkt.',
    duration: '2 pytania',
    flavor: '„Instytut zaleca pewność. Instytut nie refunduje pomyłek."',
  },
  {
    id: 'opozniona-reakcja',
    name: 'Opóźniona Reakcja',
    type: 'Skalowanie',
    effect:
      'Nie odpowiadasz na następne 2 pytania. Od kolejnego pytania do końca Testu Twoje poprawne odpowiedzi dają +25% punktów.',
    duration: 'Do końca Testu po zakończeniu blokady',
    flavor: '„Brak reakcji też jest reakcją. Tylko później."',
  },
  {
    id: 'redukcja-szumu',
    name: 'Redukcja Szumu',
    type: 'Podpowiedź',
    effect:
      '2 razy do końca Testu możesz usunąć jedną błędną odpowiedź. Działa tylko w pytaniach single_choice.',
    duration: 'Do wykorzystania 2 razy',
    flavor: '„Nie pokazuje prawdy. Usuwa część kłamstw."',
  },
  {
    id: 'kalibracja-odruchu',
    name: 'Kalibracja Odruchu',
    type: 'Szybkość',
    effect:
      'Do końca Testu odpowiedź w pierwszych 4 sekundach daje dodatkowe +35 pkt, jeśli jest poprawna.',
    duration: 'Do końca Testu',
    flavor: '„Odruch zatwierdzony. Rozsądek w kolejce."',
  },
  {
    id: 'bezpiecznik',
    name: 'Bezpiecznik',
    type: 'Obrona',
    effect:
      'Pierwsza błędna odpowiedź po wybraniu tej Modyfikacji nie daje bazowej kary punktowej.',
    duration: 'Do aktywacji albo do końca Testu',
    flavor: '„Pomyłka została przewidziana. To niepokojące."',
  },
  {
    id: 'reakcja-lancuchowa',
    name: 'Reakcja Łańcuchowa',
    type: 'Seria',
    effect:
      'Do końca Testu każda kolejna poprawna odpowiedź z rzędu daje narastający bonus: 2. z rzędu +20 pkt, 3. z rzędu +40 pkt, 4. i kolejne +60 pkt. Błędna odpowiedź resetuje bonus do 0.',
    duration: 'Do końca Testu',
    flavor: '„Jeden impuls to przypadek. Cztery to procedura."',
  },
  {
    id: 'akcelerator-decyzji',
    name: 'Akcelerator Decyzji',
    type: 'Ryzyko / czas',
    effect:
      'Przez następne 3 pytania: masz -3 sekundy na odpowiedź, poprawna odpowiedź daje +40% punktów.',
    duration: '3 pytania',
    flavor: '„Szybciej nie znaczy lepiej. Ale czasem wystarczy."',
  },
  {
    id: 'stabilizacja-wyniku',
    name: 'Stabilizacja Wyniku',
    type: 'Obrona',
    effect:
      'Przez następne 4 pytania błędna odpowiedź zabiera o 50 pkt mniej. Redukcja nie może zmienić kary w bonus.',
    duration: '4 pytania',
    flavor: '„Upadek kontrolowany nadal jest upadkiem."',
  },
  {
    id: 'skan-trudnosci',
    name: 'Skan Trudności',
    type: 'Informacja',
    effect:
      'Do końca Testu przed każdym pytaniem widzisz poziom trudności: łatwe / średnie / trudne.',
    duration: 'Do końca Testu',
    flavor: '„Nie mówi, co jest prawdą. Mówi, jak bardzo zaboli."',
  },
  {
    id: 'interferencja-lidera',
    name: 'Interferencja Lidera',
    type: 'PvP',
    effect: 'Gracz na 1. miejscu ma -3 sekundy na odpowiedź w następnym pytaniu.',
    duration: '1 pytanie',
    flavor: '„Zakłócenie dotyczy wyłącznie obiektu o najwyższej energii."',
  },
  {
    id: 'zaklocenie-kanalu',
    name: 'Zakłócenie Kanału',
    type: 'PvP',
    effect: 'Wybrany gracz traci 30% bonusu za szybkość w następnych 2 pytaniach.',
    duration: '2 pytania',
    flavor: '„Sygnał dotarł. Tylko nie tam, gdzie trzeba."',
  },
  {
    id: 'transfer-impulsu',
    name: 'Transfer Impulsu',
    type: 'PvP / szybkość',
    effect:
      'Przez następne 3 pytania, jeśli odpowiesz poprawnie szybciej niż aktualny lider, dostajesz dodatkowe +40 pkt.',
    duration: '3 pytania',
    flavor: '„Energia lidera została uznana za zasób wspólny."',
  },
  {
    id: 'odwrocenie-polaryzacji',
    name: 'Odwrócenie Polaryzacji',
    type: 'Obrona / PvP',
    effect:
      'Następny negatywny efekt PvP skierowany w Ciebie wraca do nadawcy. Efekt działa tylko raz.',
    duration: 'Do aktywacji albo do końca Testu',
    flavor: '„Kierunek zakłócenia został skorygowany."',
  },
  {
    id: 'druga-proba',
    name: 'Druga Próba',
    type: 'Podpowiedź',
    effect:
      'Raz do końca Testu możesz zmienić odpowiedź przed końcem czasu. Jeśli po zmianie odpowiedź jest poprawna, dostajesz tylko 50% punktów za to pytanie.',
    duration: '1 użycie',
    flavor: '„Instytut dopuszcza wahanie. Z rabatem."',
  },
  {
    id: 'petla-testowa',
    name: 'Pętla Testowa',
    type: 'Obrona / czas',
    effect:
      'Następna błędna odpowiedź nie daje bazowej kary, a w kolejnym pytaniu masz +3 sekundy.',
    duration: 'Do aktywacji albo do końca Testu',
    flavor: '„Błąd zapisano jako próbę wstępną."',
  },
  {
    id: 'odbicie-sygnalu',
    name: 'Odbicie Sygnału',
    type: 'Comeback / PvP',
    effect:
      'Po otrzymaniu negatywnego efektu PvP Twoja następna poprawna odpowiedź daje dodatkowe +75 pkt.',
    duration: 'Do aktywacji albo do końca Testu',
    flavor: '„Zakłócenie wróciło w formie danych."',
  },
  {
    id: 'kompensacja-deficytu',
    name: 'Kompensacja Deficytu',
    type: 'Comeback',
    effect:
      'Do końca Testu, jeśli jesteś w dolnej połowie tabeli, poprawna odpowiedź daje +25% punktów.',
    duration: 'Do końca Testu',
    flavor: '„Niski wynik zwiększa podatność na korektę."',
  },
  {
    id: 'proba-krytyczna',
    name: 'Próba Krytyczna',
    type: 'Ryzyko',
    effect:
      'W następnym pytaniu: poprawna odpowiedź daje dodatkowe +100 pkt, błędna odpowiedź zabiera dodatkowe -100 pkt.',
    duration: '1 pytanie',
    flavor: '„Parametry testu przekroczyły zdrowy rozsądek."',
  },
  {
    id: 'tarcza-fazowa',
    name: 'Tarcza Fazowa',
    type: 'Obrona',
    effect: 'Przez następne 2 pytania nie możesz być celem efektów PvP.',
    duration: '2 pytania',
    flavor: '„Obiekt obecny. Kontakt niemożliwy."',
  },
  {
    id: 'analiza-wstepna',
    name: 'Analiza Wstępna',
    type: 'Informacja',
    effect:
      'Przez następne 4 pytania widzisz kategorię 3 sekundy przed rozpoczęciem pytania.',
    duration: '4 pytania',
    flavor: '„Przygotowanie nie jest odpowiedzią. Ale pomaga."',
  },
  {
    id: 'wzmocnienie-sygnalu',
    name: 'Wzmocnienie Sygnału',
    type: 'Punkty',
    effect: 'Przez następne 3 pytania poprawna odpowiedź daje dodatkowe +30 pkt.',
    duration: '3 pytania',
    flavor: '„Sygnał podniesiony powyżej normy."',
  },
  {
    id: 'nadpisanie-wyniku',
    name: 'Nadpisanie Wyniku',
    type: 'Ryzyko / odroczenie',
    effect:
      'Następna poprawna odpowiedź zapisuje dodatkowe +100 pkt w buforze. Punkty zostaną wypłacone po 2 kolejnych pytaniach, jeśli w tym czasie nie odpowiesz błędnie. Błąd usuwa bufor.',
    duration: 'Do rozliczenia bufora',
    flavor: '„Wynik zostanie zatwierdzony po kontroli."',
  },
  {
    id: 'cichy-protokol',
    name: 'Cichy Protokół',
    type: 'Informacja / comeback',
    effect:
      'Przez następne 2 pytania tabela wyników jest ukryta dla wszystkich. Jeśli nie jesteś liderem, Twoja poprawna odpowiedź daje dodatkowe +40 pkt.',
    duration: '2 pytania',
    flavor: '„Brak danych zmniejsza panikę. Czasem."',
  },
  {
    id: 'rezonans-koncowy',
    name: 'Rezonans Końcowy',
    type: 'Końcówka',
    effect:
      'W pytaniach 10–12, jeśli nie jesteś na 1. miejscu, poprawna odpowiedź daje +30% punktów.',
    duration: 'Do końca Testu, działa tylko w pytaniach 10–12',
    flavor: '„Im bliżej końca, tym głośniej drga wynik."',
  },
]
