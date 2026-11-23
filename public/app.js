'use strict';

const copy = {
  tr: {
    language: 'Dil', status: 'Hazırlanıyor · Yakında', eyebrow: 'OKUL FOTOĞRAFÇILIĞI & BASKI',
    headline: 'Her sınıfın\nbir hikâyesi var.',
    intro: 'Listeden fotoğrafa, sınıf albümünden baskıya. Okul fotoğrafçılığının tüm adımlarını bir araya getirecek yeni çalışma alanını hazırlıyoruz.',
    availability: 'MarbleOS Studio geliştirme aşamasındadır. Uygulama henüz kullanıma açık değildir.',
    featuresTitle: 'Neler hazırlıyoruz?', feature1: 'Excel’den sınıfa',
    detail1: 'Öğrenci ve öğretmen listeleri, sınıflar ve düzenli kayıtlar.',
    feature2: 'Fotoğraftan albüme', detail2: 'Fotoğraf eşleştirme, toplu düzenleme ve baskı öncesi kontrol.',
    feature3: 'Tasarımdan baskıya', detail3: 'Sınıf çizelgeleri, albümler, kimlik kartları ve baskıya hazır çıktılar.',
    footer: 'Okullar için özenle hazırlanıyor.', title: 'MarbleOS Studio — Yakında',
  },
  en: {
    language: 'Language', status: 'In the making · Coming soon', eyebrow: 'SCHOOL PHOTOGRAPHY & PRINT',
    headline: 'Every class has\na story to tell.',
    intro: 'From class lists to portraits, from school albums to print. We’re creating a new workspace to bring every step of school photography together.',
    availability: 'MarbleOS Studio is in development. The application is not available yet.',
    featuresTitle: 'What we’re working on', feature1: 'From Excel to class lists',
    detail1: 'Student and teacher lists, classes and organised records.',
    feature2: 'From portraits to albums', detail2: 'Photo matching, batch editing and checks before printing.',
    feature3: 'From design to print', detail3: 'Class charts, albums, ID cards and print-ready files.',
    footer: 'Thoughtfully made for schools.', title: 'MarbleOS Studio — Coming soon',
  },
  de: {
    language: 'Sprache', status: 'In Entwicklung · Demnächst', eyebrow: 'SCHULFOTOGRAFIE & DRUCK',
    headline: 'Jede Klasse hat\nihre Geschichte.',
    intro: 'Von Klassenlisten zu Porträts, vom Schulalbum zum Druck. Wir entwickeln einen neuen Arbeitsbereich, der alle Schritte der Schulfotografie zusammenführt.',
    availability: 'MarbleOS Studio befindet sich in Entwicklung. Die Anwendung ist noch nicht verfügbar.',
    featuresTitle: 'Woran wir arbeiten', feature1: 'Von Excel zur Klassenliste',
    detail1: 'Schüler- und Lehrerlisten, Klassen und übersichtliche Datensätze.',
    feature2: 'Vom Porträt zum Album', detail2: 'Fotozuordnung, Stapelbearbeitung und Kontrolle vor dem Druck.',
    feature3: 'Vom Entwurf zum Druck', detail3: 'Klassenübersichten, Alben, Ausweise und druckfertige Dateien.',
    footer: 'Mit Sorgfalt für Schulen entwickelt.', title: 'MarbleOS Studio — Demnächst',
  },
  es: {
    language: 'Idioma', status: 'En desarrollo · Próximamente', eyebrow: 'FOTOGRAFÍA ESCOLAR E IMPRESIÓN',
    headline: 'Cada clase tiene\nsu propia historia.',
    intro: 'De las listas de clase a los retratos, del álbum escolar a la impresión. Estamos creando un espacio que reunirá cada etapa de la fotografía escolar.',
    availability: 'MarbleOS Studio está en desarrollo. La aplicación todavía no está disponible.',
    featuresTitle: 'Lo que estamos preparando', feature1: 'De Excel a las listas de clase',
    detail1: 'Listas de alumnos y docentes, clases y registros organizados.',
    feature2: 'Del retrato al álbum', detail2: 'Asignación de fotos, edición por lotes y revisión antes de imprimir.',
    feature3: 'Del diseño a la impresión', detail3: 'Cuadros de clase, álbumes, carnés y archivos listos para imprimir.',
    footer: 'Creado con cuidado para las escuelas.', title: 'MarbleOS Studio — Próximamente',
  },
  fr: {
    language: 'Langue', status: 'En préparation · Bientôt', eyebrow: 'PHOTOGRAPHIE SCOLAIRE & IMPRESSION',
    headline: 'Chaque classe a\nson histoire.',
    intro: 'Des listes de classe aux portraits, de l’album scolaire à l’impression. Nous créons un espace qui réunira toutes les étapes de la photographie scolaire.',
    availability: 'MarbleOS Studio est en cours de développement. L’application n’est pas encore disponible.',
    featuresTitle: 'Ce que nous préparons', feature1: 'D’Excel aux listes de classe',
    detail1: 'Listes d’élèves et d’enseignants, classes et dossiers organisés.',
    feature2: 'Du portrait à l’album', detail2: 'Association des photos, retouche par lots et vérification avant impression.',
    feature3: 'De la création à l’impression', detail3: 'Tableaux de classe, albums, cartes et fichiers prêts à imprimer.',
    footer: 'Conçu avec soin pour les écoles.', title: 'MarbleOS Studio — Bientôt',
  },
};

const languagePicker = document.getElementById('language');
function setLanguage(language) {
  const selected = Object.hasOwn(copy, language) ? language : 'en';
  const text = copy[selected];
  document.documentElement.lang = selected;
  document.title = text.title;
  document.querySelector('meta[name="description"]').content = text.intro;
  document.querySelectorAll('[data-copy]').forEach((element) => {
    element.textContent = text[element.dataset.copy];
  });
  languagePicker.value = selected;
}

languagePicker.addEventListener('change', () => setLanguage(languagePicker.value));
const requestedLanguage = new URL(window.location.href).searchParams.get('lang');
const browserLanguage = navigator.language.toLowerCase().split('-')[0];
setLanguage(requestedLanguage || browserLanguage);
