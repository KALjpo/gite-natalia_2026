// Gîte Natalia — interactions (estimation, formulaires, galerie, lightbox, menu mobile)

// Adresse qui reçoit les demandes de réservation (à mettre à jour avec la vraie adresse).
const CONTACT_EMAIL = 'poe.jerome@gmail.com';

// Tarifs cumulés pour 1 à 7 nuitées (1 à 6 personnes).
const PRICES = [90, 170, 240, 300, 350, 390, 420];

const fmt = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
const estimate = (nights) => {
  const n = parseInt(nights, 10);
  return n >= 1 && n <= PRICES.length ? fmt(PRICES[n - 1]) : 'Sur demande';
};

document.addEventListener('DOMContentLoaded', () => {
  const quick = document.getElementById('quick-form');
  const contact = document.getElementById('contact-form');
  const done = document.getElementById('form-done');
  const err = document.getElementById('form-err');

  /* ---------- Listes déroulantes nuits / voyageurs ---------- */
  document.querySelectorAll('select[data-nights]').forEach((sel) => {
    const long = sel.dataset.nights === 'long';
    PRICES.forEach((_, i) => sel.add(new Option(long ? `${i + 1} nuit${i ? 's' : ''}` : String(i + 1), String(i + 1))));
    sel.add(new Option(long ? '8 nuits et +' : '8+', '8'));
    sel.value = '1';
  });
  document.querySelectorAll('select[data-guests]').forEach((sel) => {
    const long = sel.dataset.guests === 'long';
    for (let g = 1; g <= 6; g++) sel.add(new Option(long ? `${g} personne${g > 1 ? 's' : ''}` : String(g), String(g)));
    sel.value = '2';
  });

  /* ---------- Synchronisation des deux formulaires + estimation ---------- */
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"]').forEach((d) => { d.min = today; });

  const syncedFields = ['arrival', 'nights', 'guests'];
  const refreshEstimate = () => {
    const text = estimate(contact.elements.nights.value);
    document.querySelectorAll('[data-estimate]').forEach((el) => { el.textContent = text; });
  };
  syncedFields.forEach((name) => {
    [quick, contact].forEach((form, idx) => {
      const other = idx ? quick : contact;
      form.elements[name].addEventListener('input', (e) => {
        other.elements[name].value = e.target.value;
        refreshEstimate();
      });
    });
  });
  refreshEstimate();

  quick.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => contact.elements.name.focus({ preventScroll: true }), 600);
  });

  // Bouton « tarif longue durée » : pré-remplit la durée et le message.
  document.querySelectorAll('[data-prefill="long"]').forEach((a) => a.addEventListener('click', () => {
    quick.elements.nights.value = contact.elements.nights.value = '8';
    if (!contact.elements.message.value) contact.elements.message.value = 'Bonjour, je souhaiterais un tarif pour un séjour longue durée.';
    refreshEstimate();
  }));

  /* ---------- Envoi de la demande (ouverture de la messagerie) ---------- */
  const showError = (msg, field) => {
    err.textContent = msg;
    err.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  };
  contact.addEventListener('input', (e) => {
    err.hidden = true;
    e.target.removeAttribute('aria-invalid');
  });

  contact.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = contact.elements;
    if (!f.name.value.trim()) return showError('Merci d’indiquer votre nom.', f.name);
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return showError('Merci d’indiquer une adresse email valide.', f.email);

    const nights = f.nights.value === '8' ? '8 nuits et plus' : `${f.nights.value} nuit${f.nights.value > 1 ? 's' : ''}`;
    const arrival = f.arrival.value ? new Date(f.arrival.value + 'T12:00').toLocaleDateString('fr-FR', { dateStyle: 'full' }) : 'à préciser';
    const lines = [
      `Nom : ${f.name.value.trim()}`,
      f.company.value.trim() ? `Société : ${f.company.value.trim()}` : null,
      `Email : ${f.email.value.trim()}`,
      f.phone.value.trim() ? `Téléphone : ${f.phone.value.trim()}` : null,
      '',
      `Arrivée : ${arrival}`,
      `Durée : ${nights}`,
      `Voyageurs : ${f.guests.value}`,
      `Total estimé : ${estimate(f.nights.value)}`,
      '',
      f.message.value.trim(),
    ].filter((l) => l !== null);
    const subject = `Demande de disponibilité – ${f.name.value.trim()}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

    done.querySelector('[data-done-name]').textContent = f.name.value.trim();
    done.querySelector('[data-done-email]').textContent = f.email.value.trim();
    contact.hidden = true;
    done.hidden = false;
  });

  document.getElementById('form-reset').addEventListener('click', () => {
    contact.reset();
    quick.reset();
    contact.elements.nights.value = quick.elements.nights.value = '1';
    contact.elements.guests.value = quick.elements.guests.value = '2';
    refreshEstimate();
    done.hidden = true;
    contact.hidden = false;
  });

  /* ---------- Galerie : filtres ---------- */
  const shots = [...document.querySelectorAll('.shot')];
  const visibleShots = () => shots.filter((s) => !s.hidden);
  document.querySelectorAll('.filter').forEach((btn) => btn.addEventListener('click', () => {
    const cat = btn.dataset.filter;
    document.querySelectorAll('.filter').forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    shots.forEach((s) => { s.hidden = cat !== 'all' && s.dataset.cat !== cat; });
  }));

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById('lightbox');
  const lbImg = lb.querySelector('.lightbox__img');
  const lbCap = lb.querySelector('.lightbox__caption');
  let lbIndex = -1;
  let lastFocus = null;

  const render = () => {
    const list = visibleShots();
    const shot = list[lbIndex];
    const label = shot.querySelector('span').textContent;
    lbImg.src = shot.href;
    lbImg.alt = label;
    lbCap.textContent = `${label} · ${lbIndex + 1} / ${list.length}`;
  };
  const open = (i) => {
    lastFocus = document.activeElement;
    lbIndex = i;
    render();
    lb.hidden = false;
    document.body.classList.add('no-scroll');
    lb.querySelector('.lightbox__close').focus();
  };
  const close = () => {
    lb.hidden = true;
    lbIndex = -1;
    document.body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  };
  const step = (d) => {
    const n = visibleShots().length;
    lbIndex = (lbIndex + d + n) % n;
    render();
  };

  shots.forEach((s) => s.addEventListener('click', (e) => {
    e.preventDefault();
    open(visibleShots().indexOf(s));
  }));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  lb.querySelector('.lightbox__close').addEventListener('click', close);
  lb.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
  lb.querySelector('.lightbox__next').addEventListener('click', () => step(1));
  window.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  const setMenu = (openMenu) => {
    toggle.setAttribute('aria-expanded', openMenu);
    toggle.setAttribute('aria-label', openMenu ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('is-open', openMenu);
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
});

/* ---------- Apparition des blocs au défilement ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets = document.querySelectorAll(
    '.statement p, .section .eyebrow, .section .h2, .lead, .actions, .gite__visual, .highlight, .section-head__aside, ' +
    '.amenity, .tarifs__sub, .price, .card-glass, .card-accent, .filters, .shot, .steps li, .sejour__aside > *, ' +
    '.contact__lead, .calendar, .infos, .doc-link, .form-card'
  );
  const io = new IntersectionObserver((entries) => {
    // Décalage en cascade pour les blocs qui entrent ensemble dans l'écran.
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      const el = e.target;
      const delay = Math.min(i, 6) * 70;
      io.unobserve(el);
      el.style.transitionDelay = delay + 'ms';
      el.classList.add('is-in');
      // Nettoyage : rend la main aux transitions de survol propres à chaque bloc.
      setTimeout(() => { el.classList.remove('reveal', 'is-in'); el.style.transitionDelay = ''; }, delay + 800);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
});

/* ---------- Menu fixe : fond plein dès qu'on défile ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const update = () => header.classList.toggle('is-stuck', window.scrollY > 30);
  window.addEventListener('scroll', update, { passive: true });
  update();
});

/* ---------- Calendrier des disponibilités ---------- */
// Les réservations sont lues dans assets/data/disponibilites.json (à tenir à jour à la main).
document.addEventListener('DOMContentLoaded', async () => {
  const cal = document.getElementById('calendar');
  const contact = document.getElementById('contact-form');
  if (!cal || !contact) return;

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (isoDate, n) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return iso(new Date(y, m - 1, d + n));
  };

  // Nuits occupées : de l'arrivée (incluse) au départ (exclu).
  const busy = new Set();
  try {
    const res = await fetch('assets/data/disponibilites.json', { cache: 'no-cache' });
    const data = await res.json();
    data.reservations.forEach(({ du, au }) => {
      for (let day = du; day < au; day = addDays(day, 1)) busy.add(day);
    });
  } catch (e) {
    return; // fichier absent ou invalide : le calendrier reste masqué
  }

  const title = cal.querySelector('[data-cal="title"]');
  const grid = cal.querySelector('[data-cal="days"]');
  const note = cal.querySelector('[data-cal="note"]');
  const prev = cal.querySelector('[data-cal="prev"]');
  const next = cal.querySelector('[data-cal="next"]');

  const now = new Date();
  const today = iso(now);
  const MONTHS_AHEAD = 12;
  let offset = 0; // mois affiché, compté depuis le mois en cours

  const stayNights = () => {
    const arrival = contact.elements.arrival.value;
    const n = parseInt(contact.elements.nights.value, 10) || 1;
    return arrival ? Array.from({ length: n }, (_, i) => addDays(arrival, i)) : [];
  };

  const render = () => {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const stay = stayNights();

    title.textContent = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    prev.disabled = offset === 0;
    next.disabled = offset === MONTHS_AHEAD;

    grid.textContent = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d);
      const day = iso(date);
      const isPast = day < today;
      const isBusy = busy.has(day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar__day';
      btn.textContent = d;
      btn.dataset.day = day;
      btn.disabled = isPast || isBusy;
      btn.classList.toggle('is-past', isPast);
      btn.classList.toggle('is-busy', isBusy && !isPast);
      btn.classList.toggle('is-today', day === today);
      btn.classList.toggle('is-selected', stay.includes(day));
      btn.setAttribute('aria-label', `${date.toLocaleDateString('fr-FR', { dateStyle: 'long' })}, ${isPast ? 'passé' : isBusy ? 'réservé' : 'disponible'}`);
      if (day === stay[0]) btn.setAttribute('aria-pressed', 'true');
      if (d === 1) btn.style.gridColumnStart = ((date.getDay() + 6) % 7) + 1; // semaine commençant le lundi
      grid.append(btn);
    }

    const conflict = stay.some((day) => busy.has(day));
    note.classList.toggle('is-warning', conflict);
    note.textContent = conflict
      ? 'Ces dates chevauchent une réservation : choisissez une autre période ou contactez-nous.'
      : stay.length
        ? 'Ces dates sont libres. Envoyez votre demande pour les réserver.'
        : 'Cliquez sur une date libre pour la choisir comme jour d’arrivée.';
  };

  prev.addEventListener('click', () => { offset--; render(); });
  next.addEventListener('click', () => { offset++; render(); });
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.calendar__day');
    if (!btn || btn.disabled) return;
    contact.elements.arrival.value = btn.dataset.day;
    // Déclenche la synchronisation avec le formulaire rapide et l'estimation.
    contact.elements.arrival.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Le calendrier suit les dates saisies dans l'un ou l'autre formulaire.
  document.addEventListener('input', (e) => {
    if (!['arrival', 'nights'].includes(e.target.name)) return;
    if (e.target.name === 'arrival' && e.target.value >= today) {
      const [y, m] = e.target.value.split('-').map(Number);
      offset = Math.min(MONTHS_AHEAD, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
    }
    render();
  });
  document.querySelectorAll('#form-reset, [data-prefill]').forEach((el) => el.addEventListener('click', () => setTimeout(render)));

  render();
  cal.hidden = false;
});
