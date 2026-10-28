(() => {
  'use strict';
  const hero = document.querySelector('#hero');
  const video = document.querySelector('#cat-video');
  const slider = document.querySelector('#look');
  const toggle = document.querySelector('#motion-toggle');
  const motionLabel = document.querySelector('#motion-label');
  const status = document.querySelector('#media-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // This monotonic part of the supplied film turns left -> front -> right.
  // Do not scrub the returning half: it would reverse the mouse direction.
  const timeline = { left: 0, center: 1, right: 1.625 };
  const sensitivity = 0.8;
  let targetTime = timeline.center, displayTime = timeline.center, paused = false;
  let previousX = null;
  let ready = false, seeking = false, raf = 0, previousTime = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const frameTime = x => x <= 0.5
    ? timeline.left + x * 2 * (timeline.center - timeline.left)
    : timeline.center + (x - 0.5) * 2 * (timeline.right - timeline.center);

  function updateLabel(value) {
    slider?.setAttribute('aria-valuetext', value < 0.4 ? 'W lewo' : value > 0.6 ? 'W prawo' : 'Na wprost');
  }
  const positionForTime = time => time <= timeline.center
    ? (time - timeline.left) / (timeline.center - timeline.left) / 2
    : 0.5 + (time - timeline.center) / (timeline.right - timeline.center) / 2;
  function updateControl() {
    if (!slider) return;
    const value = clamp(positionForTime(targetTime));
    slider.value = String(Math.round(value * 100));
    updateLabel(value);
  }
  function render(now) {
    raf = 0;
    if (!ready || document.hidden) return;
    // Embedded WebViews can finish decoding without delivering seeked.
    // Consult the media element before keeping a completed seek locked.
    if (seeking && !video.seeking && video.readyState >= 2) seeking = false;
    const elapsed = Math.min(64, now - (previousTime || now - 16));
    previousTime = now;
    displayTime += (targetTime - displayTime) * (reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 55));
    if (Math.abs(targetTime - displayTime) < 0.001) displayTime = targetTime;
    // Keep only one decode in flight; new mouse targets never queue stale seeks.
    if (!seeking && Math.abs(video.currentTime - displayTime) > 1 / 48) {
      seeking = true;
      video.currentTime = displayTime;
    }
    if (Math.abs(targetTime - displayTime) > 0.001) schedule();
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(render); }
  function seekTo(time) {
    targetTime = Math.max(timeline.left, Math.min(timeline.right, time));
    updateControl();
    schedule();
  }
  function aim(value, manual = false) {
    if (paused && !manual) return;
    seekTo(frameTime(clamp(value)));
  }
  function initializeVideo() {
    if (ready || video.readyState < 1 || !Number.isFinite(video.duration)) return;
    ready = true;
    video.muted = true;
    video.pause();
    if (Math.abs(video.currentTime - targetTime) > 0.001) {
      seeking = true;
      video.currentTime = targetTime;
    }
    schedule();
  }
  for (const event of ['loadedmetadata', 'loadeddata', 'canplay']) {
    video.addEventListener(event, () => { initializeVideo(); schedule(); });
  }
  video.addEventListener('seeked', () => {
    seeking = false;
    schedule();
  });
  // A cached film may already have fired every readiness event before defer runs.
  initializeVideo();
  video.addEventListener('error', () => {
    status.textContent = 'Film jest niedostępny. Wyświetlamy zdjęcie kota.';
    if (slider) slider.disabled = true;
    if (toggle) toggle.disabled = true;
  });
  window.addEventListener('mousemove', event => {
    const rect = hero.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientY > rect.bottom) { previousX = null; return; }
    const lastX = previousX;
    previousX = event.clientX;
    if (lastX === null || paused || event.target.closest('input, dialog, .motion-toggle')) return;
    const delta = event.clientX - lastX;
    const duration = Number.isFinite(video.duration) ? video.duration : 3.25;
    seekTo(targetTime + delta / window.innerWidth * sensitivity * duration);
  }, { passive: true });
  hero.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch' || event.target.closest('input, dialog, .motion-toggle')) return;
    const rect = hero.getBoundingClientRect();
    aim((event.clientX - rect.left) / rect.width);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { previousX = null; });
  window.addEventListener('blur', () => { previousX = null; });
  slider?.addEventListener('input', () => aim(Number(slider.value) / 100, true));
  function showMotionState() {
    if (!toggle || !motionLabel) return;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Włącz podążanie kota za kursorem' : 'Zatrzymaj ruch kota');
    motionLabel.textContent = paused ? 'Włącz ruch' : 'Zatrzymaj ruch';
  }
  function setPaused(value) {
    paused = value;
    previousX = null;
    if (paused) { video.pause(); targetTime = displayTime = video.currentTime; updateControl(); }
    showMotionState();
  }
  toggle?.addEventListener('click', () => setPaused(!paused));
  document.addEventListener('visibilitychange', () => {
    previousTime = 0;
    previousX = null;
    if (!document.hidden) schedule();
  });
  showMotionState();

  const dialog = document.querySelector('#info-dialog');
  const content = document.querySelector('#panel-content');
  const panels = {
    visit: `<p class="panel-eyebrow">Wpadnij na pierwsze mruczenie</p><h2 id="panel-title">Najpierw poznanie.<br>Potem wspólny dom.</h2><p class="panel-lead">W naszym przykładowym schronisku spotkanie zaczyna się od spokojnej rozmowy. Poznajemy Twój rytm dnia i pomagamy znaleźć kota, który odnajdzie się w Twoim domu.</p><ol class="panel-steps"><li><div><h3>Umówmy dogodną chwilę</h3><p>Wtorek–niedziela, 11:00–17:00. Poniedziałki zostawiamy na koci odpoczynek. Wolontariusze spotykają się w soboty o 10:00.</p></div></li><li><div><h3>Tu byłoby nasze schronisko</h3><p>ul. Mrucząca 12, 00-000 Kocie Miasteczko<br>hello@kociewzgorze.example · 000 123 456</p></div></li></ol><p class="demo-panel-note">To fikcyjny szablon prezentacyjny. Te dane nie służą do umawiania rzeczywistych spotkań.</p>`,
    volunteer: `<p class="panel-eyebrow">Wolontariat na Wzgórzu</p><h2 id="panel-title">Masz chwilę?<br>To już bardzo dużo.</h2><p class="panel-lead">W tej przykładowej historii wolontariusze są codzienną częścią Kociego Wzgórza. Nie trzeba umieć wszystkiego. Wystarczy uważność i regularna obecność.</p><ol class="panel-steps"><li><div><h3>Sobotnia kawa i poznanie</h3><p>Nową grupę witamy w soboty o 10:00. Przedstawiamy zespół, pokazujemy schronisko i opowiadamy o potrzebach kotów.</p></div></li><li><div><h3>Znajdź swoje zadanie</h3><p>Zabawa i oswajanie, porządkowanie darów, zdjęcia do ogłoszeń albo pomoc przy wydarzeniach — dobieramy rolę do Twoich możliwości.</p></div></li><li><div><h3>Mały rytuał, duża zmiana</h3><p>Przykładowy dyżur trwa 2 godziny tygodniowo. Stałe twarze pomagają kotom poczuć się bezpiecznie.</p></div></li></ol><button class="panel-button" data-panel="visit">Poznaj przykładowy kontakt <span aria-hidden="true">+</span></button>`,
    needs: `<p class="panel-eyebrow">Przykładowa lista potrzeb</p><h2 id="panel-title">Dobre rzeczy.<br>W dobrym miejscu.</h2><p class="panel-lead">Tak mogłaby wyglądać aktualna lista darów dla Kociego Wzgórza. Dzięki niej odwiedzający od razu wiedzą, co przyda się najbardziej.</p><ol class="panel-steps"><li><div><h3>Mokra karma — 40 puszek</h3><p>Przykładowe zapotrzebowanie na nadchodzący tydzień. Chętnie także porcje dla kociąt.</p></div></li><li><div><h3>Żwirek bezzapachowy — 8 worków</h3><p>Zapasy do codziennej opieki. W szablonie tę listę można później aktualizować według potrzeb prawdziwego schroniska.</p></div></li><li><div><h3>Duże podkłady i czyste ręczniki</h3><p>Przykładowo 3 opakowania podkładów, bawełniane ręczniki i koce bez luźnych nitek.</p></div></li></ol><p class="demo-panel-note">Lista demonstracyjna. Strona nie prowadzi rzeczywistej zbiórki.</p><button class="panel-button" data-panel="visit">Zobacz godziny odwiedzin <span aria-hidden="true">+</span></button>`,
    foster: `<p class="panel-eyebrow">Dom tymczasowy</p><h2 id="panel-title">Przystanek,<br>który zmienia wszystko.</h2><p class="panel-lead">Nie każdy może zaoferować dom na zawsze. Czasem spokojny pokój na kilka tygodni jest początkiem zupełnie nowej kociej historii.</p><ol class="panel-steps"><li><div><h3>Poznajmy Twoje możliwości</h3><p>W przykładowym programie rozmawiamy o domownikach, innych zwierzętach i czasie, jaki możesz poświęcić.</p></div></li><li><div><h3>Dobierzmy małego lokatora</h3><p>Spokojny senior czy kociak potrzebujący oswojenia? Szukamy dopasowania, które będzie dobre dla obu stron.</p></div></li><li><div><h3>Zostańmy w kontakcie</h3><p>Ten szablon zakłada opiekuna ze strony schroniska i regularne rozmowy aż do znalezienia docelowego domu.</p></div></li></ol><button class="panel-button" data-panel="visit">Porozmawiajmy o szczegółach <span aria-hidden="true">+</span></button>`,
    adopt: `<p class="panel-eyebrow">Nowy rozdział, razem</p><h2 id="panel-title">Dom zaczyna się<br>od spotkania.</h2><p class="panel-lead">Adopcja to początek wspólnej historii. Zanim zaprosisz kota do swojego życia, daj sobie chwilę na dobre przygotowanie.</p><ol class="panel-steps"><li><div><h3>Poznaj, zanim pokochasz</h3><p>Spokojny kanapowiec czy ciekawski odkrywca? Charakter i potrzeby kota są ważniejsze niż pierwsze wrażenie.</p></div></li><li><div><h3>Zrób miejsce w swoim świecie</h3><p>Pomyśl o codziennej opiece, czasie na oswojenie i pozostałych domownikach. Przyjaźń potrzebuje cierpliwości.</p></div></li><li><div><h3>Przygotuj bezpieczny dom</h3><p>Zabezpiecz okna i balkon. Przygotuj transporter, kuwetę, drapak i cichy kąt na pierwsze dni.</p></div></li></ol><button class="panel-button" data-panel="help">Poznaj inne sposoby pomocy <span aria-hidden="true">↗</span></button>`,
    about: `<p class="panel-eyebrow">Poznaj Kocie Wzgórze</p><h2 id="panel-title">Małe miejsce.<br>Wielkie znaczenie.</h2><p class="panel-lead">Kocie Wzgórze to opowieść o drugich szansach. O własnym kocu, spokojnym śnie i człowieku, do którego można się przytulić.</p><p class="panel-lead">Bo za każdym spojrzeniem jest ktoś, kto chce być zauważony. A za każdą adopcją — miejsce na zupełnie nową przyjaźń.</p><ol class="panel-steps"><li><div><h3>Każdy kot jest osobną historią</h3><p>Warto dać sobie czas, żeby ją poznać.</p></div></li><li><div><h3>Pomoc ma wiele dobrych form</h3><p>Dom, wspólnie spędzony czas, potrzebne rzeczy. Każdy gest może być początkiem zmiany.</p></div></li></ol><button class="panel-button" data-panel="adopt">Pomyśl o adopcji <span aria-hidden="true">↗</span></button>`,
    help: `<p class="panel-eyebrow">Każdy gest ma znaczenie</p><h2 id="panel-title">Pomóż tak,<br>jak potrafisz.</h2><p class="panel-lead">Nie musisz od razu adoptować, żeby zmienić czyjś świat. Wybierz sposób pomocy, na który masz dziś przestrzeń.</p><ol class="panel-steps"><li><div><h3>Podaruj swój czas</h3><p>Zapytaj schronisko o wolontariat. Wspólna zabawa, oswajanie i codzienna opieka zaczynają się od obecności.</p></div></li><li><div><h3>Podaruj potrzebne rzeczy</h3><p>Przed zakupem karmy, żwirku czy akcesoriów sprawdź aktualne potrzeby schroniska. Dzięki temu pomoc trafi dokładnie tam, gdzie trzeba.</p></div></li><li><div><h3>Pomóż znaleźć dom</h3><p>Udostępnij ogłoszenie adopcyjne wśród znajomych. Czasem jeden dobry kontakt zmienia całe kocie życie.</p></div></li></ol><button class="panel-button" data-panel="adopt">A może jednak wspólny dom? <span aria-hidden="true">↗</span></button>`
  };
  const cats = {
    luna: { name: 'Luna', meta: '2 lata · kotka · spokojna przytulanka', intro: 'Najpierw sprawdzi, czy Twój koc jest wystarczająco miękki. Potem położy się tuż obok i już nigdzie się nie spieszy.', home: 'Spokojny dom z ciepłym parapetem i czasem na łagodne poznanie. Luna najlepiej odnajduje się przy cierpliwych opiekunach.', ritual: 'Wieczorne czytanie, ciche mruczenie i drzemka dokładnie tam, gdzie chcesz właśnie usiąść.' },
    feliks: { name: 'Feliks', meta: '4 lata · kocur · łagodny obserwator', intro: 'Rudy gospodarz każdego parapetu. Na początku zachowuje dystans, ale dobra zabawa i cierpliwość szybko zamieniają go w wiernego towarzysza.', home: 'Dom, w którym nikt nie wymaga przyjaźni od pierwszej minuty. Feliks lubi swój rytm, punkty obserwacyjne i przewidywalną codzienność.', ritual: 'Kontrola ptaków za oknem i wspólna poranna kawa — oczywiście w roli nadzorcy.' },
    mila: { name: 'Mila', meta: '8 miesięcy · kotka · mała odkrywczyni', intro: 'W jej kalendarzu nie ma miejsca na nudę. Każdy karton jest wyprawą, a każda wędka — najważniejszą sprawą dnia.', home: 'Ciekawy świata opiekun, który lubi codzienną zabawę. Mila potrzebuje bezpiecznej przestrzeni i ujścia dla swojej kocięcej energii.', ritual: 'Dwa energiczne okrążenia po zabawie, a potem nagła i bardzo głęboka drzemka.' }
  };
  function catPanel(id) {
    const cat = cats[id];
    return `<p class="panel-eyebrow">${cat.meta}</p><h2 id="panel-title">Cześć, jestem<br>${cat.name}.</h2><img class="profile-photo" src="assets/kot-${id}.jpg" alt="${cat.name} — przykładowy profil adopcyjny"><p class="panel-lead">${cat.intro}</p><ol class="panel-steps"><li><div><h3>Takiego domu szukam</h3><p>${cat.home}</p></div></li><li><div><h3>Mój mały rytuał</h3><p>${cat.ritual}</p></div></li></ol><button class="panel-button" data-panel="visit">Poznajmy się bliżej <span aria-hidden="true">+</span></button><p class="demo-panel-note">Profil i historia są fikcyjne, przygotowane do prezentacji szablonu.</p>`;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-panel], [data-cat]');
    if (!button) return;
    const panel = button.dataset.cat ? (cats[button.dataset.cat] && catPanel(button.dataset.cat)) : panels[button.dataset.panel];
    if (!panel) return;
    content.innerHTML = panel;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('.close-dialog').focus();
  });
  document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
})();
