/**
 * İZOLE SİSTEM KATMANI: MerbleOS Orijinal Pencere ve Dock Fiziği (src/system/motion/macosMotion.ts)
 * - MerbleOS `src/lib/motion/macos-motion.ts` ile birebir aynı yay ve eğri parametreleri.
 * Dosya Sınırı Kuralı: .ts dosyaları <= 250 satır.
 */

/** Standart yumuşak duruş (scroll, reveal, 220ms focus settle) */
export const easeAppleOut = [0.16, 1, 0.3, 1] as const;

/** Apple tarzı dock süzülüşü açılış eğrisi (logaritmik rahatlama) */
export const easeAppleGenieOpen = [0.16, 1, 0.3, 1] as const;

/** Apple tarzı dock süzülüşü kapanış eğrisi (hızlı çekiş, dock içine net oturma) */
export const easeAppleGenieClose = [0.32, 0, 0.1, 1] as const;

/**
 * Apple macOS Fluid System Pencere Fiziği (Doğal, çevik ve tok duruş).
 * Büyütme (maximize) ve Akıllı Bölme (layoutBounds) geçişlerinde kullanılır.
 */
export const springWindowFluid = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 36,
  mass: 0.7,
  restDelta: 0.5,
  restSpeed: 1,
};

/** Pencere geri yükleme (restore / unmaximize / bölme sıfırlama) kıvrak yay fiziği */
export const springWindowRestore = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 38,
  mass: 0.68,
  restDelta: 0.5,
  restSpeed: 1,
};

/** Dock ikon — tık / hover yay fiziği */
export const springDockIcon = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 28,
};

/** Dock büyüteç boyutu yay — akıcı takip, düşük salınım */
export const springDockMagnify = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 40,
  mass: 0.12,
};

export const transitionDockTooltip = {
  duration: 0.15,
};

export const transitionDockActiveDot = {
  type: 'spring' as const,
  bounce: 0.2,
  duration: 0.5,
};

/**
 * Dock "landing bounce" — pencere ikona inince ikon hafif sıçrar.
 */
export const dockLandingBounceKeyframes = [0, -14, 2, -4, 0] as const;
export const dockLandingBounceTimes = [0, 0.28, 0.6, 0.82, 1] as const;
export const dockLandingBounceDurationS = 0.56;

/**
 * Butondan açılan form kartı (Apple App Store / macOS sheet yay fiziği).
 * Kritik sönümlü (zeta ≈ 1.10): hedefi aşmaz, son pikselde takılmaz.
 */
export const springOriginSheet = {
  type: 'spring' as const,
  stiffness: 330,
  damping: 34,
  mass: 0.72,
  restDelta: 0.5,
  restSpeed: 1,
};

/** Apple macOS / iOS sheet kapanış eğrisi: yumuşak kalkış, butona pürüzsüz oturuş. */
export const easeOriginSheetClose = [0.32, 0.72, 0, 1] as const;
