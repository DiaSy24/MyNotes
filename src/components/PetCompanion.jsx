import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Sparkles, 
  Move, 
  Settings2, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  RotateCcw,
  Gauge,
  Monitor
} from 'lucide-react';

// 11 animation states from the 8x11 spritesheet
const ANIMATION_STATES = [
  { id: 'ready_punch', row: 0, name: 'Hazır Duruş / Yumruk', type: 'idle' },
  { id: 'earth_stomp', row: 1, name: 'Toprak Çarpması (Stomp)', type: 'action' },
  { id: 'low_crouch', row: 2, name: 'Alçak Duruş', type: 'action' },
  { id: 'taunt_laugh', row: 3, name: 'Gülme / Meydan Okuma', type: 'action' },
  { id: 'panic_scream', row: 4, name: 'Panik / Çığlık', type: 'react' },
  { id: 'guard_stance', row: 5, name: 'Savunma Duruşu', type: 'idle' },
  { id: 'meditate_breathe', row: 6, name: 'Nefes / Bekleme (Idle)', type: 'idle' },
  { id: 'rock_levitate', row: 7, name: 'Kaya Bükme / Havada Tutma', type: 'action' },
  { id: 'power_charge', row: 8, name: 'Güç Odaklama', type: 'action' },
  { id: 'earth_strike', row: 9, name: 'Sert Darbe', type: 'action' },
  { id: 'smug_glance', row: 10, name: 'Gururlu Bakış', type: 'idle' },
];

const TOTAL_COLS = 8;
const TOTAL_ROWS = 11;

// Slower, calm speed configs
const SPEED_CONFIGS = {
  ultra_slow: { label: 'Süper Yavaş', fps: 0.8 },
  very_slow: { label: 'Çok Yavaş', fps: 1.5 },
  slow: { label: 'Yavaş', fps: 2.4 },
  normal: { label: 'Normal', fps: 3.8 },
  fast: { label: 'Hızlı', fps: 5.5 }
};

// 2x smaller size options
const SIZE_CONFIGS = [
  { id: 'mini', label: 'Mini', scale: 0.70 },
  { id: 'small', label: 'Küçük', scale: 0.85 },
  { id: 'normal', label: 'Normal', scale: 1.00 },
  { id: 'large', label: 'Büyük', scale: 1.25 }
];

const DIALOGUES = {
  greetings: [
    "Ben Toph! Dünyanın en iyi toprak bükücüsü!",
    "Selam! Notlarını kaya gibi sağlam tutalım!",
    "Bana kör diyebilirsin ama işleri senden iyi görürüm!",
    "Hadi bakalım, bugün ne projeler var?",
    "Kör Haydut sahalara geri döndü! Ne yapıyoruz?",
    "Ayaklarım yere bastığı sürece beni kimse durduramaz!",
    "Selam Pıtırcık Ayak! Bugün hangi dağları deviriyoruz?",
    "Toprak titreşiyor... Demek çalışma vakti geldi!",
    "Hazır mısın? Bugün hiçbir mazeret kabul etmiyorum!",
    "Metal bükmeyi icat eden kızla çalışmak üzeresin, şanslısın!",
    "Gözlerime ihtiyacım yok, notlarının ağırlığını ayaklarımla hissediyorum.",
    "Bakıyorum da bilgisayar başına geçmişsin. Hadi işe koyulalım!",
    "Kurallar umurumda değil ama bitmemiş görevlerden nefret ederim!",
    "Ben buradayım, yani artık tembellik yapamazsın.",
    "Selam! Bugün not defterini darmadağın etmeye hazır mısın?"
  ],
  idle_thoughts: [
    "Kayaları hisset... Notlarını düzenle...",
    "Biraz dinlenmek iyi ama işleri aksatma!",
    "Toprak titreşiyor... Yeni bir fikir mi var?",
    "Benim bükemeyeceğim kaya, senin çözemeyeceğin görev yok!",
    "Ekranın başında durmaktan taş kesilme, dik dur!",
    "Sorunların etrafından dolanma, içinden geç! Tıpkı bir toprak bükücü gibi!",
    "Sokka yine plan yapıyordur kesin... Boş ver, biz direkt yapalım!",
    "O notları okuyamam ama klavye vuruşlarından ne kadar hızlı olduğunu anlıyorum.",
    "Bir kaya gibi sağlam durursan hiçbir şey seni yıkamaz.",
    "Gözlerim görmüyor olabilir ama tembellik yaptığını metrelerce öteden sezerim!",
    "Su içtin mi? Toprağın kurumaması için neme ihtiyacı var!",
    "O koltuğa kök saldın sanki, azıcık esne bakalım!",
    "Katara şimdi burada olsa 'Toph, masanı topla' diye dırdır ederdi.",
    "Metal bile bükülebiliyorsa, o zor görev de çözülür. Kafana takma!",
    "Kaya gibi sert, nehir gibi sabırlı ol... gerçi nehir kısmı Aang'in lafıydı.",
    "Hepsini tek seferde bitiremezsin, parça parça ufala kayaları!",
    "Bazen sadece oturup yerin derinliklerini dinlemek gerekir.",
    "Kör olmak bazen harika; kimsenin sıkıcı yüz ifadelerini görmüyorum!",
    "Klavyeye o kadar sert basıyorsun ki yer sarsılıyor sandım.",
    "Notlarını öyle bir düzenle ki Taş Kral bile hayran kalsın.",
    "Daha ne kadar ekrana bakacaksın? Hadi harekete geç!",
    "Toprak altında elmaslar var, senin notlarında da harika fikirler olmalı.",
    "Bana öyle bakma... gerçi baksan da fark etmez, göremiyorum!",
    "Zorluklar sadece parçalanmayı bekleyen büyük kayalardır.",
    "Sıkıldım... Şuradan bir iki kaya fırlatsam uyanır mısın?",
    "En büyük güç, kendi dengeni bulmaktır. Sismik duyum bunu söyler.",
    "Ertelemek zayıflıktır! Taş gibi kararlı ol!",
    "Bugün Ba Sing Se'nin duvarları kadar aşılmaz işlerin mi var? Birlikte yıkarız!",
    "Derin bir nefes al, omuzlarını gevşet. Çalışmaya devam.",
    "Bir gün sana da sismik duyuyu öğreteceğim... gerçi önce ayakkabılarını çıkarman lazım."
  ],
  poked: [
    "Hey! Dikkat et, üzerime kaya fırlatırım!",
    "Dürtme beni, bükücülük konsantrasyonumu bozuyorsun!",
    "Ha! Bana vurabileceğini mi sandın?",
    "Daha sert dürtmen lazım, ben taş gibi sağlamım!",
    "Gözüm görmüyor olabilir ama her dokunuşunu hissediyorum!",
    "Hop hop! Toprak şampiyonuna dokunurken iki kere düşün!",
    "Beni gıdıklayamazsın, vücudum granitten farksız!",
    "Bir daha dokunursan fare imlecini toprağa gömerim!",
    "Titreşimlerini alıyorum... Yaklaşma!",
    "Ayak tabanımla yerin 50 metre altını hissediyorum, parmağını mı hissetmeyeceğim?",
    "Ne var ne? Çalışasana, bana laf atacağına!",
    "Dürtme! Büyüklere saygı... gerçi senden küçüğüm ama benden iyi bükücü yok!",
    "O parmağını taşa çarpmış gibi hissetmek istemiyorsan geri çek!",
    "Hah! Yumrukların Pıtırcık Ayak'ın rüzgarından bile zayıf!",
    "Seni sismik olarak izliyorum, hareketlerine dikkat et!",
    "Ben narin bir kız değilim, dokunmayı kes!",
    "Bak yine dürttü... Şimdi dev bir kaya fırlatacağım göreceksin!",
    "Dikkatim dağılmıyor dostum, taş gibiyim dedim ya!",
    "Hey, imlecinle burnuma dokunmaktan vazgeç!",
    "Biraz daha dürtürsen ekranında mini bir deprem başlatırım!",
    "Ben Toph Beifong'um! Kimse beni böyle rahatsız edemez!",
    "Tamam tamam, fark ettim buradasın. Şimdi işine dön!",
    "Reflekslerim bir köstebek porsuğundan bile hızlıdır!",
    "Görünüşe göre birilerinin canı dayak istiyor!",
    "Ciddiyim, parmağını kırarım!"
  ],
  dragging: [
    "Voooaahh! Yeri hissetmiyorum! Beni yere bırak!",
    "Havada toprak bükemem! İndir aşağı!",
    "Uçmak Aang'in işi, ben toprak severim!",
    "Hey hey hey! Ayaklarım yere basmalı, indir beni!",
    "Uçmaktan nefret ediyorum! Appa'nın sırtı gibi bu ne?!",
    "Yer nerede?! Yere koy beni çabuk!",
    "Gözlerim ayaklarımda benim, havada körden de beterim!",
    "Beni taşımaya gücünün yeteceğini mi sandın? Düşüreceksin şimdi!",
    "İmdat! Yerçekimi beni unuttu!",
    "Ayağımın altındaki toprağı çekip durma!",
    "Beni uçurmayı bırak, Appa mıyım ben?!",
    "Yere bastığım an sana öyle bir kaya atacağım ki!",
    "Başım döndü! İndir şu ayaklarımı!",
    "İmdat, havada savruluyorum! Bu hiç adil değil!",
    "Bırak beni, nerede duracağıma ben karar veririm!",
    "Düşüyorum sanıyorum her seferinde, yapma şunu!"
  ],
  task_done: [
    "İşte bu! Bir görevi daha ezip geçtik!",
    "Taş gibi tamamlandı! Harikasın!",
    "Kaya parçalamak kadar kolaydı değil mi?",
    "Bir sonraki hedefe geçelim!",
    "Güm! Bir görev daha yerle bir oldu!",
    "Böyle devam edersen Ateş Ulusu'nu bile tek günde devirirsin!",
    "Hah! Karşımızda hiçbir görev duramaz!",
    "Aferin sana! Şimdi bir sonrakini de parçala!",
    "Kayaları un ufak etmek gibiydi, çok tatmin edici!",
    "Görevin bittiğini ayaklarımdaki titreşimden anladım. Helal olsun!",
    "Sert vuruş! Görev anında teslim oldu!",
    "İşte benim tarzım! Hızlı, sert ve tavizsiz!",
    "Listeyi öyle bir temizliyoruz ki toprak bile rahatladı!",
    "Görüyorsun değil mi? Gerçi ben görmüyorum ama harika hissediyorum!",
    "Bir başarı daha! Kendine bir ödül ver, hak ettin!",
    "Bu görevi de tarihe gömdük. Sıradaki gelsin!",
    "Toprak Bükücüler Şampiyonu seninle gurur duyuyor!",
    "Yıkıp geçtin resmen! Böyle çalışmaya can kurban!",
    "Tam puan! Bu iş bitti, yenisine odaklan!",
    "Taşlar yerine oturdu. Harika bir iş çıkardın!"
  ]
};

export default function PetCompanion({ isDesktopWindow = false }) {
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem('pet_toph_visible') !== 'false';
  });

  // Default scale: 1.0 (~95x100 px - 2x smaller than previous 185px)
  const [scale, setScale] = useState(() => {
    const saved = parseFloat(localStorage.getItem('pet_toph_scale_v4'));
    if (saved && saved >= 0.5 && saved <= 1.8) return saved;
    return 1.00;
  });

  const [speedMode, setSpeedMode] = useState(() => {
    const saved = localStorage.getItem('pet_toph_speed');
    if (saved && SPEED_CONFIGS[saved]) return saved;
    return 'slow';
  });

  const [selectedAnimMode, setSelectedAnimMode] = useState(() => {
    return localStorage.getItem('pet_toph_anim_mode') || 'random';
  });

  const [showSpeech, setShowSpeech] = useState(() => {
    return localStorage.getItem('pet_toph_speech') !== 'false';
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('pet_toph_sound') === 'true';
  });

  const [isDesktopPetActive, setIsDesktopPetActive] = useState(false);

  const [position, setPosition] = useState(() => {
    if (isDesktopWindow) {
      return { x: 30, y: 35 }; // Centered in the desktop transparent window
    }
    try {
      const saved = localStorage.getItem('pet_toph_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 150, y: window.innerHeight - 165 };
  });

  const [currentState, setCurrentState] = useState(() => {
    const savedMode = localStorage.getItem('pet_toph_anim_mode') || 'random';
    if (savedMode !== 'random') {
      const found = ANIMATION_STATES.find(s => s.id === savedMode);
      if (found) return found;
    }
    return ANIMATION_STATES[6]; // default: meditate_breathe
  });

  // Keeps a saved (or dragged) position inside the current viewport. Needed
  // because pet_toph_pos may have been saved on a different, larger monitor
  // (e.g. an external display) — without this the pet re-opens off-screen
  // when the app is later used on the laptop's own smaller screen.
  const clampToViewport = useCallback((pos, currentScale) => {
    const dw = Math.round(95 * currentScale);
    const dh = Math.round(100 * currentScale);
    const maxX = Math.max(10, window.innerWidth - dw - 10);
    const maxY = Math.max(10, window.innerHeight - dh - 10);
    return {
      x: Math.max(10, Math.min(pos.x, maxX)),
      y: Math.max(10, Math.min(pos.y, maxY))
    };
  }, []);

  useEffect(() => {
    if (isDesktopWindow) return;
    setPosition(prev => clampToViewport(prev, scale));

    const handleResize = () => {
      setPosition(prev => clampToViewport(prev, scale));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // Re-clamp whenever the pet's own size (scale) changes too, not just on resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktopWindow, scale, clampToViewport]);

  const [isLockedAction, setIsLockedAction] = useState(false);
  const [currentDialogue, setCurrentDialogue] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);

  const canvasRef = useRef(null);
  const spriteImgRef = useRef(null);
  const animationFrameRef = useRef(null);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const speechTimeoutRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, startPosX: 0, startPosY: 0, lastScreenX: 0, lastScreenY: 0 });
  const dragMovedRef = useRef(false);
  const containerRef = useRef(null);

  // Helper for Electron IPC
  const getElectron = () => {
    try {
      if (window.require) return window.require('electron');
    } catch {}
    return null;
  };

  // Listen for desktop pet status in Electron main app
  useEffect(() => {
    const electron = getElectron();
    if (electron && electron.ipcRenderer && !isDesktopWindow) {
      const handleStatus = (_event, active) => {
        setIsDesktopPetActive(active);
      };
      electron.ipcRenderer.on('desktop-pet-status', handleStatus);
      return () => {
        electron.ipcRenderer.removeListener('desktop-pet-status', handleStatus);
      };
    }
  }, [isDesktopWindow]);

  // Play subtle sound effect
  const playSoundEffect = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'stomp' || type === 'strike') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'levitate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'poke') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch {}
  }, [soundEnabled]);

  // Show a speech bubble
  const triggerSpeech = useCallback((text, duration = 4000) => {
    if (!showSpeech) return;
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
    setCurrentDialogue(text);
    speechTimeoutRef.current = setTimeout(() => {
      setCurrentDialogue(null);
    }, duration);
  }, [showSpeech]);

  // Load high-definition WebP sprite
  useEffect(() => {
    const img = new Image();
    img.src = '/pet-toph.webp';
    img.onerror = () => {
      img.src = './pet-toph.webp';
    };
    img.onload = () => {
      spriteImgRef.current = img;
    };
  }, []);

  // Main Canvas Render Loop (2x smaller display size with high definition WebP)
  useEffect(() => {
    let isRunning = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 2x smaller base size (~95x100px)
    const baseW = 95;
    const baseH = 100;
    const dw = Math.round(baseW * scale);
    const dh = Math.round(baseH * scale);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dw * dpr;
    canvas.height = dh * dpr;

    const currentFps = SPEED_CONFIGS[speedMode]?.fps || 2.4;
    const frameInterval = 1000 / currentFps;

    const render = (timestamp) => {
      if (!isRunning) return;

      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameInterval) {
        lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);
        frameIndexRef.current = (frameIndexRef.current + 1) % TOTAL_COLS;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const img = spriteImgRef.current;
      if (img && img.naturalWidth > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const sw = img.naturalWidth / TOTAL_COLS;
        const sh = img.naturalHeight / TOTAL_ROWS;

        const currentFrame = frameIndexRef.current;
        const row = currentState.row;

        const sx = currentFrame * sw;
        const sy = row * sh;

        if (facingLeft) {
          ctx.translate(dw, 0);
          ctx.scale(-1, 1);
        }

        // Shadow under feet
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(dw / 2, dh - 6 * scale, 22 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw image directly at native quality
        ctx.drawImage(
          img,
          sx, sy, sw, sh,
          0, 0, dw, dh
        );

        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentState, scale, facingLeft, speedMode]);

  // Autonomous Random State Transitions Engine
  useEffect(() => {
    if (!isVisible || isLockedAction || isDragging || selectedAnimMode !== 'random') return;

    const intervalTime = Math.floor(Math.random() * 7000) + 9000;

    const timer = setTimeout(() => {
      const rand = Math.random();

      if (rand < 0.40) {
        const actionStates = ANIMATION_STATES.filter(s => s.type === 'action');
        const chosen = actionStates[Math.floor(Math.random() * actionStates.length)];
        setCurrentState(chosen);

        if (chosen.id === 'rock_levitate') playSoundEffect('levitate');
        if (chosen.id === 'earth_stomp') playSoundEffect('stomp');
        if (chosen.id === 'earth_strike') playSoundEffect('strike');

        const actionDuration = Math.floor(Math.random() * 2500) + 4000;
        setTimeout(() => {
          if (!isDragging && selectedAnimMode === 'random') {
            const idleStates = ANIMATION_STATES.filter(s => s.type === 'idle');
            setCurrentState(idleStates[Math.floor(Math.random() * idleStates.length)]);
          }
        }, actionDuration);

      } else if (rand < 0.75) {
        const idleStates = ANIMATION_STATES.filter(s => s.type === 'idle');
        const chosen = idleStates[Math.floor(Math.random() * idleStates.length)];
        setCurrentState(chosen);

        if (Math.random() < 0.3) {
          setFacingLeft(prev => !prev);
        }

        if (Math.random() < 0.35 && !currentDialogue) {
          const quote = DIALOGUES.idle_thoughts[Math.floor(Math.random() * DIALOGUES.idle_thoughts.length)];
          triggerSpeech(quote, 4500);
        }
      }
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [isVisible, currentState, isLockedAction, isDragging, selectedAnimMode, currentDialogue, triggerSpeech, playSoundEffect]);

  // Handle note completion or app toast events
  useEffect(() => {
    const handleAppEvent = (e) => {
      const msg = e.detail?.message || '';
      if (msg.includes('tamamlandı') || msg.includes('kaydedildi') || msg.includes('güncellendi')) {
        setIsLockedAction(true);
        setCurrentState(ANIMATION_STATES[7]); // Rock levitation
        playSoundEffect('levitate');
        
        const cheer = DIALOGUES.task_done[Math.floor(Math.random() * DIALOGUES.task_done.length)];
        triggerSpeech(cheer, 4000);

        setTimeout(() => {
          setCurrentState(ANIMATION_STATES[10]); // Smug glance
          setTimeout(() => {
            setIsLockedAction(false);
            if (selectedAnimMode === 'random') {
              setCurrentState(ANIMATION_STATES[6]);
            } else {
              const fixed = ANIMATION_STATES.find(s => s.id === selectedAnimMode);
              if (fixed) setCurrentState(fixed);
            }
          }, 3000);
        }, 4000);
      }
    };

    window.addEventListener('app_toast_notify', handleAppEvent);
    return () => window.removeEventListener('app_toast_notify', handleAppEvent);
  }, [selectedAnimMode, triggerSpeech, playSoundEffect]);

  // External Toggle Event Listeners (e.g. from Sidebar)
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible(prev => !prev);
    };
    const handleShow = () => {
      setIsVisible(true);
    };
    window.addEventListener('toggle_toph_pet', handleToggle);
    window.addEventListener('show_toph_pet', handleShow);
    return () => {
      window.removeEventListener('toggle_toph_pet', handleToggle);
      window.removeEventListener('show_toph_pet', handleShow);
    };
  }, []);

  // Initial greeting speech
  useEffect(() => {
    if (isVisible && showSpeech) {
      const timer = setTimeout(() => {
        const greet = DIALOGUES.greetings[Math.floor(Math.random() * DIALOGUES.greetings.length)];
        triggerSpeech(greet, 5000);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Save persistent state
  useEffect(() => {
    localStorage.setItem('pet_toph_visible', isVisible);
    localStorage.setItem('pet_toph_scale_v4', scale);
    localStorage.setItem('pet_toph_speed', speedMode);
    localStorage.setItem('pet_toph_anim_mode', selectedAnimMode);
    localStorage.setItem('pet_toph_speech', showSpeech);
    localStorage.setItem('pet_toph_sound', soundEnabled);
    if (!isDesktopWindow) {
      localStorage.setItem('pet_toph_pos', JSON.stringify(position));
    }
  }, [isVisible, scale, speedMode, selectedAnimMode, showSpeech, soundEnabled, position, isDesktopWindow]);

  // Click / Poke interaction
  const handlePoke = (e) => {
    e.stopPropagation();
    if (isDragging || dragMovedRef.current) return;

    playSoundEffect('poke');

    const reactions = [
      { state: ANIMATION_STATES[7], sound: 'levitate' },
      { state: ANIMATION_STATES[3], sound: null },
      { state: ANIMATION_STATES[9], sound: 'strike' },
      { state: ANIMATION_STATES[1], sound: 'stomp' },
      { state: ANIMATION_STATES[10], sound: null },
    ];
    const chosen = reactions[Math.floor(Math.random() * reactions.length)];
    
    setIsLockedAction(true);
    setCurrentState(chosen.state);
    if (chosen.sound) playSoundEffect(chosen.sound);

    const quote = DIALOGUES.poked[Math.floor(Math.random() * DIALOGUES.poked.length)];
    triggerSpeech(quote, 3500);

    setTimeout(() => {
      setIsLockedAction(false);
      if (selectedAnimMode === 'random') {
        setCurrentState(ANIMATION_STATES[6]);
      } else {
        const fixed = ANIMATION_STATES.find(s => s.id === selectedAnimMode);
        if (fixed) setCurrentState(fixed);
      }
    }, 3500);
  };

  // --- Desktop overlay click-through -------------------------------------
  // The overlay window is bigger than the pet sprite, so it must ignore
  // mouse events over its empty transparent area but not over the pet.
  // Rather than toggling this from mouseenter/mouseleave (which gets stuck
  // "interactive" whenever the hovered element — a speech bubble or the
  // settings menu — unmounts out from under the cursor, since no
  // mouseleave fires for that), we recompute it from scratch on every
  // forwarded mousemove by checking what's actually under the cursor. This
  // can never get permanently stuck.
  const ignoreMouseRef = useRef(true);
  const isDraggingRef = useRef(false);
  const isMenuOpenRef = useRef(false);

  useEffect(() => { isMenuOpenRef.current = isMenuOpen; }, [isMenuOpen]);

  useEffect(() => {
    if (!isDesktopWindow) return;
    const electron = getElectron();
    if (!electron || !electron.ipcRenderer) return;

    const setIgnore = (ignore) => {
      if (ignoreMouseRef.current === ignore) return;
      ignoreMouseRef.current = ignore;
      electron.ipcRenderer.send('set-pet-ignore-mouse-events', ignore, { forward: true });
    };

    const handleMove = (e) => {
      if (isDraggingRef.current || isMenuOpenRef.current) {
        setIgnore(false);
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const overPet = !!(el && el.closest && el.closest('.pet-companion-container'));
      setIgnore(!overPet);
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [isDesktopWindow]);

  // Shrink/grow the transparent overlay window to fit its actual visible
  // content (sprite + open speech bubble / settings menu), so the
  // click-through dead zone around the pet stays small instead of being a
  // fixed 320x380 rectangle regardless of what's shown.
  useEffect(() => {
    if (!isDesktopWindow) return;
    const electron = getElectron();
    if (!electron || !electron.ipcRenderer) return;

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const rects = [container.getBoundingClientRect()];
      container.querySelectorAll('.pet-speech-bubble, .pet-controls-menu, .pet-action-bar').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push(r);
      });
      const top = Math.min(...rects.map((r) => r.top));
      const left = Math.min(...rects.map((r) => r.left));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const right = Math.max(...rects.map((r) => r.right));

      const margin = 24;
      electron.ipcRenderer.send('resize-pet-window', {
        width: Math.ceil(right - left) + margin * 2,
        height: Math.ceil(bottom - top) + margin * 2
      });
    };

    // Let the CSS transition (menu slide-in, speech bubble pop-in) settle first.
    const timer = setTimeout(measure, 260);
    return () => clearTimeout(timer);
  }, [isDesktopWindow, isMenuOpen, currentDialogue, scale]);

  // Drag handlers (supports in-app translate & drift-free Windows desktop dragging)
  const handleMouseDown = (e) => {
    if (e.target.closest('.pet-controls-menu') || e.target.closest('.pet-action-btn')) return;

    setIsDragging(true);
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };

    const electron = getElectron();
    if (isDesktopWindow && electron && electron.ipcRenderer) {
      electron.ipcRenderer.send('pet-drag-start');
    }

    const onMouseMove = (moveEvent) => {
      const dist = Math.hypot(moveEvent.clientX - dragStartRef.current.x, moveEvent.clientY - dragStartRef.current.y);
      if (dist > 3 && !dragMovedRef.current) {
        dragMovedRef.current = true;
        // Panic animation while actually dragging
        setCurrentState(ANIMATION_STATES[4]);
        if (Math.random() < 0.5) {
          const scream = DIALOGUES.dragging[Math.floor(Math.random() * DIALOGUES.dragging.length)];
          triggerSpeech(scream, 2500);
        }
      }

      if (!isDesktopWindow) {
        const dx = moveEvent.clientX - dragStartRef.current.x;
        const dy = moveEvent.clientY - dragStartRef.current.y;

        const newX = Math.max(10, Math.min(window.innerWidth - 110, dragStartRef.current.startPosX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 120, dragStartRef.current.startPosY + dy));

        setPosition({ x: newX, y: newY });
      }
      // In desktop-window mode the main process tracks the cursor on its
      // own timer (started by 'pet-drag-start') — nothing to send here.
    };

    const onMouseUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);

      const electron = getElectron();
      if (isDesktopWindow && electron && electron.ipcRenderer) {
        electron.ipcRenderer.send('pet-drag-end');
      }

      if (dragMovedRef.current) {
        // Landing stomp
        setCurrentState(ANIMATION_STATES[1]);
        playSoundEffect('stomp');
        setTimeout(() => {
          if (selectedAnimMode === 'random') {
            setCurrentState(ANIMATION_STATES[6]);
          } else {
            const fixed = ANIMATION_STATES.find(s => s.id === selectedAnimMode);
            if (fixed) setCurrentState(fixed);
          }
        }, 1800);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseUp);
  };

  // Quick corner placement
  const handleMoveCorner = (corner) => {
    const margin = 20;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dw = Math.round(95 * scale);
    const dh = Math.round(100 * scale);
    if (corner === 'bottom-right') setPosition({ x: w - dw - margin, y: h - dh - margin });
    if (corner === 'bottom-left') setPosition({ x: margin, y: h - dh - margin });
    if (corner === 'top-right') setPosition({ x: w - dw - margin, y: margin + 20 });
    if (corner === 'top-left') setPosition({ x: margin, y: margin + 20 });
  };

  // Toggle Always-on-top Desktop Pet Overlay in Electron
  const toggleDesktopOverlay = () => {
    const electron = getElectron();
    if (!electron || !electron.ipcRenderer) {
      triggerSpeech("Masaüstü modu için Electron masaüstü uygulamasını kullanın!", 3500);
      return;
    }

    if (isDesktopWindow) {
      electron.ipcRenderer.send('close-desktop-pet');
    } else {
      if (isDesktopPetActive) {
        electron.ipcRenderer.send('close-desktop-pet');
        setIsDesktopPetActive(false);
      } else {
        electron.ipcRenderer.send('open-desktop-pet');
        setIsDesktopPetActive(true);
        triggerSpeech("Toph artık tüm uygulamaların üzerinde!", 3500);
      }
    }
  };

  // Select animation mode (Random vs Fixed state)
  const handleAnimationChange = (e) => {
    const value = e.target.value;
    setSelectedAnimMode(value);
    if (value === 'random') {
      setCurrentState(ANIMATION_STATES[6]);
      triggerSpeech("Rastgele mod devrede! Toprak gibi serbestçe hareket edeceğim!", 3000);
    } else {
      const found = ANIMATION_STATES.find(s => s.id === value);
      if (found) {
        setCurrentState(found);
        if (found.id === 'rock_levitate') playSoundEffect('levitate');
        if (found.id === 'earth_stomp') playSoundEffect('stomp');
        if (found.id === 'earth_strike') playSoundEffect('strike');
      }
    }
  };

  const displayW = Math.round(95 * scale);
  const displayH = Math.round(100 * scale);

  // If in main window and desktop pet is already active, hide in-app pet to avoid duplicate
  if (!isDesktopWindow && isDesktopPetActive) {
    return (
      <button 
        className="pet-summon-pill active-desktop"
        onClick={toggleDesktopOverlay}
        title="Toph Masaüstünde Açık (Kapatmak için tıkla)"
      >
        <span className="pet-summon-icon">🖥️</span>
        <span className="pet-summon-label">Masaüstü Toph Aktif</span>
      </button>
    );
  }

  if (!isVisible && !isDesktopWindow) {
    return (
      <button 
        className="pet-summon-pill"
        onClick={() => setIsVisible(true)}
        title="Toph'u Ekrana Ekle (Pet Companion)"
      >
        <span className="pet-summon-icon">🥋</span>
        <span className="pet-summon-label">Toph'u Göster</span>
      </button>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`pet-companion-container ${isDesktopWindow ? 'is-desktop-window' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={isDesktopWindow ? {} : {
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Speech Bubble */}
      {showSpeech && currentDialogue && (
        <div className="pet-speech-bubble">
          <div className="pet-speech-header">
            <span className="pet-name">Toph</span>
            <span className="pet-badge">Toprak Bükücü</span>
          </div>
          <p className="pet-speech-text">{currentDialogue}</p>
          <div className="pet-speech-arrow" />
        </div>
      )}

      {/* Floating Sprite Canvas (Compact 2x Smaller HD Size) */}
      <div 
        className="pet-sprite-wrapper"
        onClick={handlePoke}
        title="Toph Beifong - Tıkla veya Sürükle!"
        style={{ width: `${displayW}px`, height: `${displayH}px` }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            width: `${displayW}px`, 
            height: `${displayH}px`,
            display: 'block'
          }} 
        />
      </div>

      {/* Hover Action Bar */}
      <div className="pet-action-bar">
        <button 
          className="pet-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            setFacingLeft(prev => !prev);
          }}
          title="Yönü Çevir"
        >
          <Move size={12} />
        </button>

        <button 
          className="pet-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(prev => !prev);
          }}
          title="Pet Ayarları"
        >
          <Settings2 size={12} />
        </button>

        <button 
          className="pet-action-btn close"
          onClick={(e) => {
            e.stopPropagation();
            if (isDesktopWindow) {
              const electron = getElectron();
              if (electron) electron.ipcRenderer.send('close-desktop-pet');
            } else {
              setIsVisible(false);
            }
          }}
          title="Kapat"
        >
          <X size={12} />
        </button>
      </div>

      {/* Settings & State Picker Menu */}
      {isMenuOpen && (
        <div 
          className="pet-controls-menu"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="pet-menu-header">
            <div className="pet-menu-title">
              <Sparkles size={14} className="pet-icon-sparkle" />
              <span>Toph Companion</span>
            </div>
            <button 
              className="pet-menu-close"
              onClick={() => setIsMenuOpen(false)}
            >
              <X size={12} />
            </button>
          </div>

          <div className="pet-menu-body">
            {/* Masaüstü Modu Butonu (Tüm Uygulamaların Üzerinde) */}
            <div className="pet-menu-section">
              <button 
                className={`pet-desktop-mode-btn ${isDesktopWindow || isDesktopPetActive ? 'active' : ''}`}
                onClick={toggleDesktopOverlay}
              >
                <Monitor size={14} />
                <span>{isDesktopWindow || isDesktopPetActive ? 'Masaüstü Modunu Kapat' : 'Tüm Uygulamaların Üzerinde Göster'}</span>
              </button>
            </div>

            {/* Hareket / Animasyon Durumu */}
            <div className="pet-menu-section">
              <label className="pet-menu-label">Hareket / Animasyon</label>
              <select 
                className="pet-menu-select"
                value={selectedAnimMode}
                onChange={handleAnimationChange}
              >
                <option value="random">🎲 Rastgele (Otomatik Geçiş)</option>
                <optgroup label="Sabit Hareketler">
                  {ANIMATION_STATES.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {idx + 1}. {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Animasyon Hızı */}
            <div className="pet-menu-section">
              <label className="pet-menu-label">
                <span className="flex items-center gap-1">
                  <Gauge size={11} /> Animasyon Hızı
                </span>
              </label>
              <div className="pet-size-buttons speed-grid">
                {Object.entries(SPEED_CONFIGS).map(([key, cfg]) => (
                  <button 
                    key={key}
                    className={`pet-size-btn ${speedMode === key ? 'active' : ''}`}
                    onClick={() => setSpeedMode(key)}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Boyut Seçimi (2x Küçültülmüş Seçenekler) */}
            <div className="pet-menu-section">
              <label className="pet-menu-label">Boyut</label>
              <div className="pet-size-buttons four-cols">
                {SIZE_CONFIGS.map(cfg => (
                  <button 
                    key={cfg.id}
                    className={`pet-size-btn ${scale === cfg.scale ? 'active' : ''}`}
                    onClick={() => setScale(cfg.scale)}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ekranda Hızlı Konumlandırma */}
            {!isDesktopWindow && (
              <div className="pet-menu-section">
                <label className="pet-menu-label">Ekranda Konumlandır</label>
                <div className="pet-size-buttons four-cols">
                  <button 
                    className="pet-size-btn"
                    onClick={() => handleMoveCorner('top-left')}
                    title="Sol Üst Köşe"
                  >
                    Sol Üst
                  </button>
                  <button 
                    className="pet-size-btn"
                    onClick={() => handleMoveCorner('top-right')}
                    title="Sağ Üst Köşe"
                  >
                    Sağ Üst
                  </button>
                  <button 
                    className="pet-size-btn"
                    onClick={() => handleMoveCorner('bottom-left')}
                    title="Sol Alt Köşe"
                  >
                    Sol Alt
                  </button>
                  <button 
                    className="pet-size-btn"
                    onClick={() => handleMoveCorner('bottom-right')}
                    title="Sağ Alt Köşe"
                  >
                    Sağ Alt
                  </button>
                </div>
              </div>
            )}

            {/* Feature Toggles */}
            <div className="pet-menu-toggles">
              <button 
                className={`pet-toggle-row ${showSpeech ? 'active' : ''}`}
                onClick={() => setShowSpeech(prev => !prev)}
              >
                <MessageSquare size={13} />
                <span>Konuşma Baloncukları</span>
                <span className="toggle-status">{showSpeech ? 'Açık' : 'Kapalı'}</span>
              </button>

              <button 
                className={`pet-toggle-row ${soundEnabled ? 'active' : ''}`}
                onClick={() => setSoundEnabled(prev => !prev)}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>Ses Efektleri</span>
                <span className="toggle-status">{soundEnabled ? 'Açık' : 'Kapalı'}</span>
              </button>

              {!isDesktopWindow && (
                <button 
                  className="pet-toggle-row reset"
                  onClick={() => handleMoveCorner('bottom-right')}
                >
                  <RotateCcw size={13} />
                  <span>Pozisyonu Sıfırla</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
