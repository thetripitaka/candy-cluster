import {
  Container,
  Sprite,
  Texture,
  Graphics,
  Text,
  TextStyle,
  Rectangle,
} from "pixi.js";


// We import these because your cut-block calls them.
import { createSettingsMenu } from "./settingsMenu";
import { createBuyMenu } from "./buyMenu";

export function createBottomUI(ctx: {
  // required inputs
  app: any;
  root: Container;
  state: any;
  gameCore: Container;
  bgBlur: any;

  texUI: (frame: string) => Texture;
  texExtra: (frame: string) => Texture;

  fmtMoney: (v: number) => string;

  waitMs: (ms: number) => Promise<void>;
  animateMs: (ms: number, fn: (t: number) => void) => Promise<void>;
  tween: any;

  easeOutCubic: any;
  easeOutBack: any;
  easeInCubic: any;

  // callbacks the UI needs
  doSpin: () => Promise<void>;
  enterFreeSpins: (forcedCount?: number, startMult?: number) => void;

  // lets the UI report panel height back to main.ts
  setUiPanelH: (h: number) => void;
}) {
  // Pull everything into local variables so your pasted code “just works”
  const {
    app,
    root,
    state,
    gameCore,
    bgBlur,
    texUI,
    texExtra,
    fmtMoney,
    waitMs,
    animateMs,
    tween,
    easeOutCubic,
    easeOutBack,
    easeInCubic,
    doSpin,
    enterFreeSpins,
    setUiPanelH,
  } = ctx;

  // These existed in main.ts; we keep them here and return them.


// ===== PIXI UI (Bottom Control Board) =====
    const uiLayer = new Container();
    uiLayer.zIndex = 8000;          // ✅ above reel + symbols + win frames
    root.addChild(uiLayer);
    // ✅ Prevent UI flashing before splash
    uiLayer.alpha = 0;
    uiLayer.eventMode = "none";



    const uiPanel = new Container();
    uiLayer.addChild(uiPanel);

    function setScaleToHeight(c: Container, targetH: number) {
      // assumes makePngButton() added btnHeight() to the container
      const h = (c as any).btnHeight ? (c as any).btnHeight() : c.height;
      if (h <= 0) return;
      const s = targetH / h;
      c.scale.set(s);
    }






    function blurBackgroundTo(target: number, ms = 300) {
      const start = bgBlur.strength;
      tween(
        ms,
        (k) => {
          bgBlur.strength = start + (target - start) * k;
        }
      );
    }

    function fadeUiLayerTo(targetAlpha: number, ms = 250) {
      const start = uiLayer.alpha;

      // disable interaction when hidden
      if (targetAlpha === 0) {
        uiLayer.eventMode = "none";
      }

      tween(
        ms,
        (k) => {
          uiLayer.alpha = start + (targetAlpha - start) * k;
        },
        () => {
          uiLayer.alpha = targetAlpha;
          uiLayer.eventMode = targetAlpha > 0 ? "auto" : "none";
        }
      );
    }

    function fadeGameTo(targetAlpha: number, targetScale: number, ms = 300) {
      // scale/fade ONE wrapper so it scales from the center
      const startA = gameCore.alpha;
      const startS = gameCore.scale.x;

      // when hidden, don’t let anything interactive accidentally catch events
      if (targetAlpha === 0) (gameCore as any).eventMode = "none";

      tween(
        ms,
        (k) => {
          gameCore.alpha = startA + (targetAlpha - startA) * k;
          const s = startS + (targetScale - startS) * k;
          gameCore.scale.set(s);
        },
        () => {
          gameCore.alpha = targetAlpha;
          gameCore.scale.set(targetScale);
          (gameCore as any).eventMode = targetAlpha > 0 ? "auto" : "none";
        }
      );
    }

    function setUiEnabled(enabled: boolean) {
      // visually + interactively disable the whole UI layer
      uiLayer.eventMode = enabled ? "auto" : "none";
      uiLayer.cursor = enabled ? "default" : "default";
      uiLayer.alpha = enabled ? 1 : 1; // keep visible; change to 0.6 if you want dim

      // disable individual buttons (prevents edge cases where they still get events)
      spinBtnPixi?.setEnabled?.(enabled && !state.ui.spinning);
      settingsBtnPixi?.setEnabled?.(enabled);
      buyBtnPixi?.setEnabled?.(enabled);
      autoBtnPixi?.setEnabled?.(enabled);
      turboBtnPixi?.setEnabled?.(enabled);
      betDownBtnPixi?.setEnabled?.(enabled);
      betUpBtnPixi?.setEnabled?.(enabled);

      // also stop auto mode during overlays
      if (!enabled) {
        state.ui.auto = false;
        autoBtnPixi?.setOn?.(false);
      }
    }

    function lockInputForBigWin(on: boolean) {
      if (on) {
        setUiEnabled(false);
        (gameCore as any).eventMode = "none"; // already doing this, but keep it consistent
      } else {
        setUiEnabled(true);
        (gameCore as any).eventMode = "auto";
      }
    }


    function showGameCoreDelayed(
      delayMs = 300,
      fadeMs = 300,
      fromScale = 0.92
    ) {
      // start hidden
      gameCore.alpha = 0;
      gameCore.scale.set(fromScale);
      (gameCore as any).eventMode = "none";

      setTimeout(() => {
        const startA = gameCore.alpha;
        const startS = gameCore.scale.x;

        tween(
          fadeMs,
          (k) => {
            gameCore.alpha = startA + (1 - startA) * k;
            const s = startS + (1 - startS) * k;
            gameCore.scale.set(s);
          },
          () => {
            gameCore.alpha = 1;
            gameCore.scale.set(1);
            (gameCore as any).eventMode = "auto";
          }
        );
      }, delayMs);
    }


    function layoutBackgroundPivotToScreenCenter() {
      // Make scaling happen around screen center (without shifting at scale=1)
      const cx = app.screen.width / 2;
      const cy = app.screen.height / 2;

      backgroundLayer.pivot.set(cx, cy);
      backgroundLayer.position.set(cx, cy);
    }
    layoutBackgroundPivotToScreenCenter();
    window.addEventListener("resize", () => {


      layoutBackgroundPivotToScreenCenter();
    });

    let bgZoomToken = 0;

    function zoomBackgroundTo(targetScaleMul: number, ms = 500) {
      // ✅ HARD LOCK zoom during splash (Solution B)
      if (state.overlay.splash) return;

      // Ensure pivot stays correct (esp after resize)
      layoutBackgroundPivotToScreenCenter();


      const bg = backgroundLayer;
      const start = bg.scale.x;

      // cancel/ignore any previous background zoom tween
      const token = ++bgZoomToken;

      tween(
        ms,
        (k) => {
          if (token !== bgZoomToken) return; // a newer zoom started
          const e = Math.max(0, Math.min(1, k));
          const s = start + (targetScaleMul - start) * e;
          bg.scale.set(s);
        },
        () => {
          if (token !== bgZoomToken) return;
          bg.scale.set(targetScaleMul); // lock final scale, no snap
        }
      );
    }




    // Place a thing using 0..1 coords inside the panel rectangle
    function placeOnPanel(
      c: Container,
      nx: number,   // 0..1 left->right
      ny: number,   // 0..1 top->bottom
      panelW: number,
      panelH: number
    ) {
      c.x = Math.round(panelW * nx);
      c.y = Math.round(panelH * ny);
    }





    // =====================
    // MONEY FORMATTER
    // =====================
    const moneyFmt = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    });

    function fmtMoney(v: number) {
      return moneyFmt.format(v);
    }




    // =====================
    // UI PANEL TEXT STYLES (shared)
    // =====================
    const UI_TITLE_STYLE = {
      fontFamily: "Micro5",
      fill: 0xffd36a,         // gold
      fontSize: 32,
      fontWeight: "200",
      letterSpacing: 2,

    


    } as any;

    const UI_VALUE_STYLE = {
      fontFamily: "Micro5",
      fill: 0xffffff,
      fontSize: 40,
      fontWeight: "200",
      letterSpacing: 1,

      stroke: { color: 0x000000, width: 4 },


      
    } as any;


    const balanceLabel = new Text({
      text: fmtMoney(state.bank.balance),
      style: UI_VALUE_STYLE,
    });




    const balanceTitleLabel = new Text({
      text: "BALANCE",
      style: UI_TITLE_STYLE,
    });
    balanceTitleLabel.anchor.set(0.5);


    balanceTitleLabel.anchor.set(0.5);

    uiPanel.addChild(balanceTitleLabel);


    uiPanel.addChild(balanceLabel);
    // --- MULT display ---
    const multTitleLabel = new Text({
      text: "MULT",
      style: {
        fill: 0xffd36a,
        fontSize: 17,
        fontWeight: "600",
        letterSpacing: 2,
      }
    });
    multTitleLabel.anchor.set(0.5);

    const multAmountLabel = new Text({
      text: "x1",
      style: {
        fill: 0xffffff,
        fontSize: 30,
        fontWeight: "700",
      }
    });
    multAmountLabel.anchor.set(0.5);

    // container so we can position it like WIN
    const multUI = new Container();
    multUI.addChild(multTitleLabel, multAmountLabel);



    // helper
    function setMult(v: number) {
      // keep it clean (2dp only if needed)
      const isInt = Math.abs(v - Math.round(v)) < 1e-6;
      multAmountLabel.text = "x" + (isInt ? String(Math.round(v)) : v.toFixed(2));
    }

    // --- WIN display ---


    const winTitleLabel = new Text({
      text: "WIN",
      style: UI_TITLE_STYLE,
    });
    winTitleLabel.anchor.set(0.5);

    winTitleLabel.anchor.set(0.5);

    const winAmountLabel = new Text({
      text: fmtMoney(0),
      style: UI_VALUE_STYLE,
    });
    winAmountLabel.anchor.set(0.5);



    // group so we can center-align and move together
    const winUI = new Container();
    winUI.addChild(winTitleLabel, winAmountLabel);
    uiPanel.addChild(winUI);

    function setWinAmount(v: number) {
      state.bank.lastWin = v;
      winAmountLabel.text = fmtMoney(v);
    }










    // --- BET display (amount readout) ---
    const BET_TEXT_STYLE = UI_VALUE_STYLE;


    // Optional: little pill background behind the bet amount
    const betAmountBg = new Graphics();
    betAmountBg.rect(0, 0, 120, 44).fill(0x000000);
    betAmountBg.alpha = 0.35;

    const betAmountText = new Text({
        text: fmtMoney(state.bank.betLevels[state.bank.betIndex]),
      style: BET_TEXT_STYLE,
    });
    betAmountText.anchor.set(0.5);

    const betTitleLabel = new Text({
      text: "BET",
      style: UI_TITLE_STYLE,
    });
    betTitleLabel.anchor.set(0.5);


    betTitleLabel.anchor.set(0.5);
    uiPanel.addChild(betTitleLabel);


    // container so we can position/scale as a unit
    const betAmountUI = new Container();
    betAmountUI.addChild(betAmountBg, betAmountText);
    uiPanel.addChild(betAmountUI);

    function updateSpinButtonVisualState() {
      const bet = state.bank.betLevels[state.bank.betIndex];
      const inFreeSpins = state.fs.remaining > 0;
      const canAfford = inFreeSpins || state.bank.balance >= bet;

      // ✅ change look only (still clickable)
      setSpinSkinsBroke(!canAfford);

      // ✅ IMPORTANT: do NOT hide the button, do NOT disable it here.
      // Let refreshSpinAffordability() decide enabled/disabled for menus/spins.
    }



    function refreshSpinAffordability() {
      const bet = state.bank.betLevels[state.bank.betIndex];
      const canSpin = (state.fs.remaining > 0) || (state.bank.balance >= bet); // FS is free
      spinBtnPixi?.setEnabled?.(canSpin && !state.ui.spinning && !state.ui.settingsOpen && !state.ui.buyMenuOpen);
      updateSpinButtonVisualState();
    }


    function updateBetUI() {
      
      betAmountText.text = fmtMoney(state.bank.betLevels[state.bank.betIndex]);
      

      // Resize the pill bg to fit text nicely
      const padX = 28;
      const padY = 16;

      const w = Math.max(90, betAmountText.width + padX);
      const h = Math.max(40, betAmountText.height + padY);

      betAmountBg.clear();
      betAmountBg.rect(0, 0, w, h).fill(0x000000);
      betAmountBg.alpha = 0.35;

      betAmountText.x = w / 2;
      betAmountText.y = h / 2 - 6;
      
    }

    updateBetUI();



  // ---- Slider helper ----
    function makeSlider(
      iconOnUrl: string,
      iconOffUrl: string,
      initial01: number,
      onChange?: (v01: number) => void
    ) {

      const c = new Container();

      let muted = false;
    const icon = new Sprite(texUI(iconOnUrl));
    icon.anchor.set(0.5);

    // pixel icon size
    const ICON_H = 36;

    // scale using texture size (more reliable than sprite.height early-on)
    const texH = icon.texture?.height || (icon.texture as any)?.orig?.height || 1;
    const s = ICON_H / Math.max(1, texH);
    icon.scale.set(s);

    // crisp
    icon.roundPixels = true;
    // =====================
    // ICON HIT AREA (larger than sprite)
    // =====================
    const ICON_HIT_W = 64; // try 56–72
    const ICON_HIT_H = 64;

    const iconHit = new Graphics();

  // invisible but interactive hit rect
  iconHit
    .rect(
      -ICON_HIT_W / 2,
      -ICON_HIT_H / 2,
      ICON_HIT_W,
      ICON_HIT_H
    )
    .fill({ color: 0xffffff, alpha: 0.001 });


    iconHit.eventMode = "static";
    iconHit.cursor = "pointer";

    // put hit box BEHIND icon
    c.addChild(iconHit);
    c.addChild(icon);




      // ... keep your trackInactive/trackActive/knob code the same ...

    (c as any).setMuted = (m: boolean) => {
      muted = m;
      icon.texture = texUI(muted ? iconOffUrl : iconOnUrl);
    };


      


      icon.anchor.set(0.5);

      const trackActive = new Graphics();
      const trackInactive = new Graphics();
      const trackHit = new Graphics(); // invisible fat hit area for the whole line

      const capL = new Graphics();
      const capR = new Graphics();
      const knob = new Graphics();

    c.addChild(icon, trackInactive, trackActive, trackHit, capL, capR, knob);


    



      let value01 = Math.max(0, Math.min(1, initial01));
      let dragging = false;
      let boundToSettingsLayer = false;


    const sliderParts = new Set<any>();

      

    // mark slider parts as "owned" by the slider
    sliderParts.add(icon); // ✅ include icon too
    sliderParts.add(iconHit);
    sliderParts.add(trackInactive);
    sliderParts.add(trackActive);
    sliderParts.add(knob);

    (c as any).isFromSlider = (target: any) => sliderParts.has(target);
    (c as any).isDragging = () => dragging;


    // ✅ allow settings menu to bind a click handler to the icon ONLY
    (c as any).bindIconTap = (fn: () => void) => {
      // store it so layout() can rebind after it clears listeners
      (c as any)._iconTapFn = fn;

      const bind = (target: any) => {
        target.eventMode = "static";
        target.cursor = "pointer";
        target.removeAllListeners?.("pointertap");
        target.on("pointertap", (e: any) => {
          e.stopPropagation?.();
          fn();
        });
      };

      // bind to BOTH the icon and its larger hit box
      bind(icon);
      bind(iconHit);
    };



      const TRACK_X = 60; // ✅ make this accessible to redraw()

      function redraw(trackW: number) {
        const knobX = Math.round(trackW * value01);

        trackInactive.clear();
        trackInactive
          .moveTo(0, 0)
          .lineTo(trackW, 0)
          .stroke({ width: 6, color: 0xffffff, alpha: 0.25 });

        trackActive.clear();
        if (knobX > 0) {
          trackActive
            .moveTo(0, 0)
            .lineTo(knobX, 0)
            .stroke({ width: 6, color: 0xffffff, alpha: 0.95 });
            // fat invisible hitbox over the whole track
    trackHit.clear();
    trackHit
      .moveTo(0, 0)
      .lineTo(trackW, 0)
      .stroke({ width: 32, color: 0xffffff, alpha: 0.001 }); // big click area, visually invisible

        }

        capL.visible = false;
    capR.visible = false;
        capL.clear();
        capL.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });

        capR.clear();
        capR.circle(trackW, 0, 4).fill({ color: 0xffffff, alpha: 0.95 });

        knob.clear();
        knob.circle(0, 0, 14).fill({ color: 0xffffff, alpha: 1 });

        // ✅ FIX: knob must include TRACK_X offset
        knob.x = TRACK_X + knobX;
        knob.y = 0;
      }

      (c as any).layout = (x: number, y: number, trackW: number) => {
        c.x = x;
        c.y = y;

        icon.x = 0;
        icon.y = 0;

        trackInactive.roundPixels = true;
        trackActive.roundPixels = true;
        capL.roundPixels = true;
        capR.roundPixels = true;
        knob.roundPixels = true;

        trackInactive.x = TRACK_X;
        trackInactive.y = 0;

        trackActive.x = TRACK_X;
        trackActive.y = 0;

        trackHit.x = TRACK_X;
    trackHit.y = 0;


        capL.x = TRACK_X;
        capL.y = 0;

        capR.x = TRACK_X;
        capR.y = 0;

        redraw(trackW);
          






            // knob interactive
        knob.eventMode = "static";
        knob.cursor = "pointer";
    knob.removeAllListeners?.();
    trackInactive.removeAllListeners?.();
    trackActive.removeAllListeners?.();
    trackHit.removeAllListeners?.();

    // ✅ DON’T kill icon taps permanently — we’ll rebind after clearing
    icon.removeAllListeners?.("pointertap");
    iconHit.removeAllListeners?.("pointertap");

    // ✅ Rebind icon mute tap if one was provided
    const fn = (c as any)._iconTapFn as undefined | (() => void);
    if (fn) (c as any).bindIconTap(fn);


        knob.on("pointerdown", (e) => {
          dragging = true;
          (e as any).stopPropagation?.(); // ✅ already doing this
        });

        knob.on("pointertap", (e) => (e as any).stopPropagation?.());


        // click track to jump (grey OR white line)
    const bindTrackClick = (g: any) => {
      g.eventMode = "static";
      g.cursor = "pointer";

      // ⛔️ prevent row mute when clicking slider line
      g.on("pointerdown", (e: any) => e.stopPropagation?.());
      g.on("pointertap",  (e: any) => e.stopPropagation?.());

      g.on("pointertap", (e: any) => {
        e.stopPropagation?.(); // ⛔️ critical: prevents mute/unmute

        const local = g.toLocal(e.global);
        value01 = Math.max(0, Math.min(1, local.x / trackW));
        redraw(trackW);
        onChange?.(value01);
      });
    };

    // ✅ allow clicking both the inactive (grey) and active (white) parts
    bindTrackClick(trackInactive);
    bindTrackClick(trackActive);



      


        const setFromGlobalX = (globalX: number) => {
          const local = trackInactive.toLocal({ x: globalX, y: 0 } as any);
          const t = Math.max(0, Math.min(trackW, local.x));
          value01 = t / trackW;
          redraw(trackW);
          return value01;
        };

        knob.on("pointerdown", (e) => {
          dragging = true;
          (e as any).stopPropagation?.();
        });

        if (!boundToSettingsLayer) {
      boundToSettingsLayer = true;

      app.stage.on("pointermove", (e: any) => {
    if (!dragging) return;
    setFromGlobalX((e as any).global.x);
    onChange?.(value01);
  });

  const stopDrag = () => { dragging = false; };
  app.stage.on("pointerup", stopDrag);
  app.stage.on("pointerupoutside", stopDrag);

    }


    const onTrackDown = (e: any) => {
      e.stopPropagation?.();           // prevent row tap toggling mute
      dragging = true;                 // ✅ start dragging when you press on the line
      const v = setFromGlobalX(e.global.x);
      onChange?.(value01); // ✅ this is the important bit
      return value01;
    };


    // INACTIVE line
    trackInactive.eventMode = "static";
    trackInactive.cursor = "pointer";
    trackInactive.on("pointerdown", onTrackDown);
    trackInactive.on("pointertap", (e) => e.stopPropagation?.());

    // ACTIVE (white) line
    trackActive.eventMode = "static";
    trackActive.cursor = "pointer";
    trackActive.on("pointerdown", onTrackDown);
    trackActive.on("pointertap", (e) => e.stopPropagation?.());

    trackHit.eventMode = "static";
    trackHit.cursor = "pointer";
    trackHit.on("pointerdown", onTrackDown);
    trackHit.on("pointertap", (e) => e.stopPropagation?.());



      };

      (c as any).getValue = () => value01;
      (c as any).setValue = (v: number) => { value01 = Math.max(0, Math.min(1, v)); };

      return c as Container & {
        layout: (x: number, y: number, trackW: number) => void;
        getValue: () => number;
        setValue: (v: number) => void;
        setMuted: (m: boolean) => void;
      };
    }

    function makePngButton(
      upUrl: string,
      hoverUrl: string,
      downUrl: string,
      onClick: () => void
    ) {
      const c = new Container();

      const up = new Sprite(texUI(upUrl));

      const hover = new Sprite(texUI(hoverUrl));
      const down = new Sprite(texUI(downUrl));

      // Center the sprites on the container
      up.anchor.set(0.5);
      hover.anchor.set(0.5);
      down.anchor.set(0.5);

      // Only show UP initially
      hover.visible = false;
      down.visible = false;

      c.addChild(up, hover, down);

      c.eventMode = "static";
      c.cursor = "pointer";

      c.on("pointerover", () => {
        up.visible = false;
        hover.visible = true;
        down.visible = false;
      });

      c.on("pointerout", () => {
        up.visible = true;
        hover.visible = false;
        down.visible = false;
      });

      c.on("pointerdown", () => {
        up.visible = false;
        hover.visible = false;
        down.visible = true;
      });

      c.on("pointerup", () => {
        // return to hover state if still over button
        up.visible = false;
        hover.visible = true;
        down.visible = false;
      });

      c.on("pointertap", onClick);

        (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";

        // ✅ IMPORTANT: when disabling (menus open), force back to UP state
        if (!enabled) {
          up.visible = true;
          hover.visible = false;
          down.visible = false;
        }
      };

      // ✅ expose a manual reset too (useful when closing menus)
      (c as any).resetVisual = () => {
        up.visible = true;
        hover.visible = false;
        down.visible = false;
      };


      // handy size getters (so layoutUI can use width/height)
      (c as any).btnWidth = () => up.width;
      (c as any).btnHeight = () => up.height;

      return c as Container & { setEnabled: (b: boolean) => void; btnWidth: () => number; btnHeight: () => number };
    }

    function makePngToggleButton(
      offUpUrl: string,
      offHoverUrl: string,
      offDownUrl: string,
      onUpUrl: string,
      onHoverUrl: string,
      onDownUrl: string,
      initialOn: boolean,
      onToggle: (isOn: boolean) => void
    ) {
      const c = new Container();

      // OFF sprites
      const offUp = new Sprite(texUI(offUpUrl));
      const offHover = new Sprite(texUI(offHoverUrl));
      const offDown = new Sprite(texUI(offDownUrl));

      // ON sprites
      const onUp = new Sprite(texUI(onUpUrl));
      const onHover = new Sprite(texUI(onHoverUrl));
      const onDown = new Sprite(texUI(onDownUrl));

      
      const all = [offUp, offHover, offDown, onUp, onHover, onDown];
      all.forEach((s) => {
        s.anchor.set(0.5);
        c.addChild(s);
      });
    // 🔒 Force all toggle sprites to the same size (use OFF_UP as reference)
    const refW = offUp.width;
    const refH = offUp.height;

    all.forEach((s) => {
      s.width = refW;
      s.height = refH;
    });

      let isOn = initialOn;
      

      function showState(kind: "up" | "hover" | "down") {
        all.forEach((s) => (s.visible = false));

        const up = isOn ? onUp : offUp;
        const hover = isOn ? onHover : offHover;
        const down = isOn ? onDown : offDown;

        if (kind === "up") up.visible = true;
        if (kind === "hover") hover.visible = true;
        if (kind === "down") down.visible = true;
      }

      showState("up");

      c.eventMode = "static";
      c.cursor = "pointer";

      c.on("pointerover", () => showState("hover"));
      c.on("pointerout", () => showState("up"));
      c.on("pointerdown", () => showState("down"));
      c.on("pointerup", () => showState("hover"));

      c.on("pointertap", () => {
        isOn = !isOn;
        showState("hover");
        onToggle(isOn);
      });

      (c as any).setOn = (v: boolean) => {
        isOn = v;
        showState("up");
      };
      (c as any).getOn = () => isOn;

      (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";
      };

      // size getters (use OFF up as reference)
      ;(c as any).btnWidth = () => offUp.width;
      ;(c as any).btnHeight = () => offUp.height;

      return c as Container & {
        setEnabled: (b: boolean) => void;
        setOn: (v: boolean) => void;
        getOn: () => boolean;
        btnWidth: () => number;
        btnHeight: () => number;
      };
    }


    function setPngButtonSkins(
      btn: Container,
      upUrl: string,
      hoverUrl: string,
      downUrl: string
    ) {
      const kids = btn.children as Sprite[];
      const up = kids[0];
      const hover = kids[1];
      const down = kids[2];

    up.texture = texUI(upUrl);
    hover.texture = texUI(hoverUrl);
    down.texture = texUI(downUrl);


      // keep current visible state consistent
      up.visible = true;
      hover.visible = false;
      down.visible = false;

      // keep btnWidth/btnHeight accurate
      (btn as any).btnWidth = () => up.width;
      (btn as any).btnHeight = () => up.height;
    }


    function makeButton(label: string, w: number, h: number, onClick: () => void) {
      const c = new Container();

      const bg = new Graphics()
        .roundRect(0, 0, w, h, 12)
        .fill(0x1a1a1a)
        .stroke({ width: 10, color: 0x666666 });

      const t = new Text({ text: label, style: { fill: 0xffffff, fontSize: 18 } });
      t.anchor.set(0.5);
      t.x = w / 2;
      t.y = h / 2;

      c.addChild(bg, t);

      c.eventMode = "static";
      c.cursor = "pointer";
      c.on("pointertap", onClick);

      c.on("pointerover", () => { bg.alpha = 0.9; });
      c.on("pointerout",  () => { bg.alpha = 1.0; });

      (c as any).setEnabled = (enabled: boolean) => {
        c.eventMode = enabled ? "static" : "none";
        c.alpha = enabled ? 1.0 : 0.5;
        c.cursor = enabled ? "pointer" : "default";
      };
      (c as any).setLabel = (txt: string) => { t.text = txt; };

      return c as Container & { setEnabled: (b: boolean) => void; setLabel: (s: string) => void };
    }






    // --- UI PNGs ---

    const ICON_INFO = "icon_info.png";


    const SPIN_UP        = "btn_spin_up.png";
    const SPIN_HOVER     = "btn_spin_hover.png";
    const SPIN_DOWN      = "btn_spin_down.png";
    const SPIN_SPINNING  = "btn_spin_spinning.png";


    const ICON_SFX_ON  = "icon_sfx_on.png";
    const ICON_SFX_OFF = "icon_sfx_off.png";


    const ICON_MUSIC_ON  = "icon_music_on.png";
    const ICON_MUSIC_OFF = "icon_music_off.png";




    const SETTINGS_OFF_UP    = "btn_settings_off_up.png";
    const SETTINGS_OFF_HOVER = "btn_settings_off_up.png";   // same frame is fine
    const SETTINGS_OFF_DOWN  = "btn_settings_off_down.png";

    const SETTINGS_ON_UP     = "btn_settings_on_up.png";
    const SETTINGS_ON_HOVER  = "btn_settings_on_up.png";    // same frame is fine
    const SETTINGS_ON_DOWN   = "btn_settings_on_down.png";


    const AUTO_OFF_UP    = "btn_auto_off_up.png";
    const AUTO_OFF_HOVER = "btn_auto_hover.png";
    const AUTO_OFF_DOWN  = "btn_auto_down.png";

    const AUTO_ON_UP    = "btn_auto_on_up.png";
    const AUTO_ON_HOVER = "btn_auto_on_up.png";
    const AUTO_ON_DOWN  = "btn_auto_on_up.png";


    const TURBO_OFF_UP    = "btn_turbo_off_up.png";
    const TURBO_OFF_HOVER = "btn_turbo_hover.png";
    const TURBO_OFF_DOWN  = "btn_turbo_down.png";

    const TURBO_ON_UP    = "btn_turbo_on_up.png";
    const TURBO_ON_HOVER = "btn_turbo_on_up.png";
    const TURBO_ON_DOWN  = "btn_turbo_on_up.png";


    const BET_DOWN_UP    = "btn_bet_down_up.png";
    const BET_DOWN_HOVER = "btn_bet_down_hover.png";
    const BET_DOWN_DOWN  = "btn_bet_down_down.png";

    const BET_UP_UP      = "btn_bet_up_up.png";
    const BET_UP_HOVER   = "btn_bet_up_hover.png";
    const BET_UP_DOWN    = "btn_bet_up_down.png";

    // ✅ CLOSE uses existing atlas frames (these DO exist in ui.json)
    const CLOSE_UP    = "btn_settings_on_up.png";
    const CLOSE_HOVER = "btn_settings_on_up.png";
    const CLOSE_DOWN  = "btn_settings_on_down.png";



    // =====================
    // BUY MENU CARD ART (PNG)
    // =====================
    const BUY_ART_PICK_URL  = "/assets/ui/buy_art_pick.png";
    const BUY_ART_GIGA_URL  = "/assets/ui/buy_art_giga.png";
    const BUY_ART_SUPER_URL = "/assets/ui/buy_art_super.png";
    const BUY_ART_ULTRA_URL = "/assets/ui/buy_art_ultra.png";

    const BUY_HOVER_URL = "/assets/ui/btn_buy_hover.png";
    const BUY_DOWN_URL  = "/assets/ui/btn_buy_down.png";

    const BUY_UP    = "btn_buy_up.png";
    const BUY_HOVER = "btn_buy_hover.png";
    const BUY_DOWN  = "btn_buy_down.png";


    

    const BIGWIN_ITEMS_ATLAS_URL = "/assets/atlases/bigwin_items.json";
    const UI_ATLAS_URL = "/assets/atlases/ui.json";
    const UI_EXTRA_ATLAS_URL = "/assets/atlases/ui_extra.json";
  const VEHICLES_ATLAS_URL = "/assets/atlases/vehicles.json";
  const REELHOUSE_ATLAS_URL = "/assets/atlases/reelhouse.json";
  const SYMBOLS_ATLAS_URL = "/assets/atlases/symbols.json";





    // =====================
    // COIN SHOWER — SPRITESHEET (TexturePacker / Pixi atlas)
    // =====================
    const COINS_SHEET_URL = "/assets/particles/coins.json"; // ✅ leading slash

    let coinFramesCache: Texture[] | null = null;

    function getCoinFramesCached(): Texture[] {
      if (coinFramesCache) return coinFramesCache;

      const sheet = Assets.get(COINS_SHEET_URL) as any; // Pixi Spritesheet
      const texMap = sheet?.textures as Record<string, Texture> | undefined;

      if (!texMap) {
        console.warn("[COINS] Sheet not ready or missing textures:", COINS_SHEET_URL, sheet);
        coinFramesCache = [];
        return coinFramesCache;
      }

      // TexturePacker usually names them "coin_0001.png" etc or "1.png"
      // Sort in a stable numeric-ish way:
      const keys = Object.keys(texMap).sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

      coinFramesCache = keys.map((k) => texMap[k]).filter(Boolean);

      if (!coinFramesCache.length) {
        console.warn("[COINS] No frames found in sheet:", COINS_SHEET_URL, keys);
      } else {
        console.log("[COINS] Frames:", coinFramesCache.length, "from", COINS_SHEET_URL);
      }

      return coinFramesCache;
    }






  await Assets.load([
    STUDIO_LOGO_URL,
    STUDIO_LOGO_HOUSE_URL,
  ]);
  await playStudioIntroTilesReel();



    await Assets.load(
      [
        BG_BASE_URL, BG_FREE_URL,
          STUDIO_LOGO_URL,
            STUDIO_LOGO_HOUSE_URL,
        

        // ✅ Atlases
        UI_ATLAS_URL,
        BIGWIN_ITEMS_ATLAS_URL,
        COINS_SHEET_URL,
        UI_EXTRA_ATLAS_URL,
        VEHICLES_ATLAS_URL,
        REELHOUSE_ATLAS_URL,
        SYMBOLS_ATLAS_URL,

        // ✅ Still-real PNGs (not in atlases yet)
        FS_OUTRO_BG_URL,

      ],
      (p: number) => updateLoadingProgress(0.5 + p * 0.5)
    );


    const uiSheet = Assets.get(UI_ATLAS_URL) as any;

    const uiExtraSheet = Assets.get(UI_EXTRA_ATLAS_URL) as any;



    const symbolsSheet = Assets.get(SYMBOLS_ATLAS_URL) as any;

  console.log("[SYMBOLS] frames:", Object.keys(symbolsSheet.textures || {}));

  for (const tex of Object.values(symbolsSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";
  }


  function texSymbol(frame: string): Texture {
    const t = symbolsSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[SYMBOLS_ATLAS] Missing frame: ${frame}`);
    return t;
  }

  // =====================
  // SYMBOL TEXTURES (from symbols atlas)
  // =====================
  const SYMBOL_TEX: Record<SymbolId, Texture> =
    Object.fromEntries(
      (Object.keys(SYMBOL_FRAMES) as SymbolId[]).map((id) => [id, texSymbol(SYMBOL_FRAMES[id])])
    ) as Record<SymbolId, Texture>;

  buildSplashCardArtOnce();
  layoutSplash();

    // =====================
  // REELHOUSE ATLAS
  // =====================
  const reelhouseSheet = Assets.get(REELHOUSE_ATLAS_URL) as any;

  console.log("[REELHOUSE] frames:", Object.keys(reelhouseSheet.textures || {}));

  for (const tex of Object.values(reelhouseSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texReelhouse(frame: string): Texture {
    const t = reelhouseSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[REELHOUSE_ATLAS] Missing frame: ${frame}`);
    return t;
  }


    // =====================
  // VEHICLES ATLAS
  // =====================
  const vehiclesSheet = Assets.get(VEHICLES_ATLAS_URL) as any;

  console.log("[VEHICLES] frames:", Object.keys(vehiclesSheet.textures || {}));

  for (const tex of Object.values(vehiclesSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texVehicle(frame: string): Texture {
    const t = vehiclesSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[VEHICLES_ATLAS] Missing frame: ${frame}`);
    return t;
  }

  console.log("[UI_EXTRA] frames:", Object.keys(uiExtraSheet.textures || {}));

  // crisp pixels for ui_extra too
  for (const tex of Object.values(uiExtraSheet.textures)) {
    (tex as Texture).source.scaleMode = "nearest";

  }

  function texExtra(frame: string): Texture {
    if (!uiExtraSheet?.textures) {
      // UI_EXTRA atlas not loaded yet
      return Texture.WHITE;
    }
    const t = uiExtraSheet.textures?.[frame] as Texture | undefined;
    if (!t) throw new Error(`[UI_EXTRA_ATLAS] Missing frame: ${frame}`);
    return t;
  }

  gameTitle.texture = texExtra("game_title.png");

    for (const tex of Object.values(uiSheet.textures)) {
      (tex as Texture).source.scaleMode = "nearest";

    }

    function texUI(frame: string): Texture {
      const t = uiSheet.textures?.[frame] as Texture | undefined;
      if (!t) throw new Error(`[UI_ATLAS] Missing frame: ${frame}`);
      return t;
    }


    // =====================
    // BIG WIN ITEMS ATLAS (TexturePacker)
    // =====================
    const bigWinItemsSheet = Assets.get(BIGWIN_ITEMS_ATLAS_URL) as any;

    // crisp pixels
    for (const tex of Object.values(bigWinItemsSheet.textures)) {
      (tex as Texture).source.scaleMode = "nearest";

    }

    function texBigWinItem(frame: string): Texture {
      const t = bigWinItemsSheet.textures?.[frame] as Texture | undefined;
      if (!t) throw new Error(`[BIGWIN_ITEMS] Missing frame: ${frame}`);
      return t;
    }
    // ✅ warm up coin frames cache once (avoids first-use hitch)
    getCoinFramesCached();




    // =====================
    // UI PANEL BACKGROUND (CODE, replaces ui_panel.png)
    // =====================
    const panelBgG = new Graphics();
    panelBgG.zIndex = -999;          // keep behind everything inside uiPanel
    panelBgG.eventMode = "none";
    uiPanel.addChildAt(panelBgG, 0);






    


    const uiDimmer = new Graphics();
    uiDimmer.visible = false;
    uiDimmer.alpha = 0.65;

    // ✅ This blocks clicks when visible
    uiDimmer.eventMode = "static";
    uiDimmer.cursor = "default";

    uiPanel.addChild(uiDimmer);


    







    // Spin button (create AFTER load)
    const spinBtnPixi = makePngButton(
      SPIN_UP,
      SPIN_HOVER,
      SPIN_DOWN,
      () => {
        // ✅ If we're in BASE and can't afford the bet, show the BUY menu toast
        const bet = state.bank.betLevels[state.bank.betIndex];
        const inFreeSpins = state.fs.remaining > 0;

        if (!inFreeSpins && state.bank.balance < bet) {
          buyMenuApi?.showInsufficientToast?.();

          updateSpinButtonVisualState();
          return;
        }

        void doSpin();
      }
    );
    uiPanel.addChild(spinBtnPixi);

    // =====================
    // SPIN BUTTON "BROKE" SKIN SWAP
    // =====================
    let spinSkinsAreBroke = false;

    function setSpinSkinsBroke(on: boolean) {
      if (spinSkinsAreBroke === on) return;
      spinSkinsAreBroke = on;

    if (on) {
      setPngButtonSkins(spinBtnPixi, SPIN_SPINNING, SPIN_HOVER, SPIN_DOWN);
    } else {
      setPngButtonSkins(spinBtnPixi, SPIN_UP, SPIN_HOVER, SPIN_DOWN);
    }
    }

    // "Spinning" overlay (same position as spin button, no input)
    const spinningBtnPixi = new Sprite(texUI(SPIN_SPINNING));
    spinningBtnPixi.anchor.set(0.5);
    spinningBtnPixi.visible = false;
    spinningBtnPixi.eventMode = "none"; // clicking does nothing
    uiPanel.addChild(spinningBtnPixi);

    // ✅ now safe (spinningBtnPixi exists)
    refreshSpinAffordability();






  



    const settingsBtnPixi = makePngToggleButton(
      SETTINGS_OFF_UP,
      SETTINGS_OFF_HOVER,
      SETTINGS_OFF_DOWN,
      SETTINGS_ON_UP,
      SETTINGS_ON_HOVER,
      SETTINGS_ON_DOWN,
      false,
      (isOn) => {
      state.ui.settingsOpen = isOn;
      // 🔧 Nudge the ON button slightly left
    const SETTINGS_ON_OFFSET_X = -2; // tweak: -4 to -12 feels good

    settingsBtnPixi.x += isOn ? SETTINGS_ON_OFFSET_X : -SETTINGS_ON_OFFSET_X;

      uiDimmer.visible = state.ui.settingsOpen;

  if (state.ui.settingsOpen) settingsApi?.open?.();
  else settingsApi?.close?.();

      // Disable everything else
      spinBtnPixi.setEnabled(!state.ui.settingsOpen && !state.ui.spinning);
      // keep the right visual showing
    spinBtnPixi.visible = !state.ui.spinning;
    spinningBtnPixi.visible = state.ui.spinning;

      buyBtnPixi.setEnabled(!state.ui.settingsOpen);
      autoBtnPixi.setEnabled(!state.ui.settingsOpen);
      turboBtnPixi.setEnabled(!state.ui.settingsOpen);
      betDownBtnPixi.setEnabled(!state.ui.settingsOpen);
      betUpBtnPixi.setEnabled(!state.ui.settingsOpen);

      settingsBtnPixi.setEnabled(true);

      if (state.ui.settingsOpen) {
        state.ui.auto = false;
        autoBtnPixi.setOn(false);
      }
    }

    );

    // ✅ IMPORTANT: settings should be ABOVE the dimmer
    uiPanel.addChild(settingsBtnPixi);

  // =====================
  // SETTINGS MENU (external module)
  // =====================
  let sfxMuted = false;
  let musicMuted = false;
  settingsApi = createSettingsMenu({
    app,
    root,
    state,

    uiDimmer,
    settingsBtnPixi,

    // when settings closes, re-enable UI buttons
    onClosed: () => {
      spinBtnPixi.setEnabled(!state.ui.spinning);
      buyBtnPixi.setEnabled(true);
      autoBtnPixi.setEnabled(true);
      turboBtnPixi.setEnabled(true);
      betDownBtnPixi.setEnabled(true);
      betUpBtnPixi.setEnabled(true);
    },

    texUI,
    setScaleToHeight,
    makePngButton,

    ICON_INFO,
    ICON_SFX_ON,
    ICON_SFX_OFF,
    ICON_MUSIC_ON,
    ICON_MUSIC_OFF,

    CLOSE_UP,
    CLOSE_HOVER,
    CLOSE_DOWN,

  getSfxMuted: () => sfxMuted,
  setSfxMuted: (v: boolean) => { sfxMuted = v; },

  getMusicMuted: () => musicMuted,
  setMusicMuted: (v: boolean) => { musicMuted = v; },

applyAudioUI: () => {
  try {
    console.log("[AUDIO]", { sfxMuted, musicMuted });

    // ✅ If you later wire real audio objects, guard them too:
    // sfxHowler?.mute?.(sfxMuted);
    // musicHowler?.mute?.(musicMuted);

  } catch (err) {
    console.warn("[AUDIO] applyAudioUI failed (ignored):", err);
  }
},



    // IMPORTANT: for now, reuse the existing slider maker you already have
    // (If you don’t have a global makeSlider yet, tell me and I’ll guide you)
    makeSlider,

    // starting slider positions (0..1)
    getSfxValue01: () => 0.8,
    getMusicValue01: () => 0.6,
  });



    function openSettingsPanel() {
      console.log("Settings OPEN");
    }

    function closeSettingsPanel() {
      console.log("Settings CLOSED");
    }




    const buyBtnPixi = makePngButton(
      BUY_UP,
      BUY_HOVER,
      BUY_DOWN,
  () => {
    console.log("[BUY BTN] clicked");

    // close settings if open
    if (state.ui.settingsOpen) {
      state.ui.settingsOpen = false;
      settingsBtnPixi.setOn(false);
      settingsApi?.close?.();
      uiDimmer.visible = false;
    }

    buyMenuApi?.openBuy?.();
  }

    );
    uiPanel.addChild(buyBtnPixi);





    // Auto toggle button (OFF <-> ON)
    const autoBtnPixi = makePngToggleButton(
      AUTO_OFF_UP,
      AUTO_OFF_HOVER,
      AUTO_OFF_DOWN,
      AUTO_ON_UP,
      AUTO_ON_HOVER,
      AUTO_ON_DOWN,
      state.ui.auto,
      (isOn) => {
        // If turning ON auto, check funds first (BASE only)
        if (isOn) {
          const bet = state.bank.betLevels[state.bank.betIndex];
          const inFreeSpins = state.fs.remaining > 0;

          if (!inFreeSpins && state.bank.balance < bet) {
            // revert toggle back OFF
            state.ui.auto = false;
            autoBtnPixi.setOn(false);

            buyMenuApi?.showInsufficientToast?.();

            return;
          }
        }

        state.ui.auto = isOn;

        if (state.ui.auto && !state.ui.spinning && !state.overlay.fsIntro && !state.overlay.fsOutro) {
          void doSpin();
        }
      }
    );

    // ✅ ADD IT TO THE UI
    uiPanel.addChild(autoBtnPixi);

    // Turbo toggle button
    const turboBtnPixi = makePngToggleButton(
      TURBO_OFF_UP,
      TURBO_OFF_HOVER,
      TURBO_OFF_DOWN,
      TURBO_ON_UP,
      TURBO_ON_HOVER,
      TURBO_ON_DOWN,
      state.ui.turbo,
      (isOn) => {
        state.ui.turbo = isOn;
        // Optional: reference state.ui.turbo inside doSpin() to speed things up
      }
    );

    uiPanel.addChild(turboBtnPixi);








  

  





    const betDownBtnPixi = makePngButton(
    BET_DOWN_UP,
      BET_DOWN_HOVER,
      BET_DOWN_DOWN,
      () => {
        if (state.bank.betIndex > 0) {
          state.bank.betIndex--;
          updateBetUI();
    refreshSpinAffordability();
    if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.();
        }
      }
    );


    const betUpBtnPixi = makePngButton(
      BET_UP_UP,
      BET_UP_HOVER,
      BET_UP_DOWN,
      () => {
        if (state.bank.betIndex < state.bank.betLevels.length - 1) {
          state.bank.betIndex++;
          updateBetUI();
    refreshSpinAffordability();
    if (state.ui.buyMenuOpen) buyMenuApi?.layoutBuy?.();
        }
      }
    );



    // keep your betValueBtn as-is for now
   uiPanel.addChild(betDownBtnPixi, betUpBtnPixi);

buyMenuApi = createBuyMenu({
  app,
  root,
  uiLayer,
  state,

  texUI,
  texExtra,

  setScaleToHeight,
  makePngButton,
  makePngToggleButton,

  fmtMoney,
  updateBetUI,
  refreshSpinAffordability,


  onBalanceUpdated: () => {
    balanceLabel.text = fmtMoney(state.bank.balance);
  },

  spinBtnPixi,
  spinningBtnPixi,
  settingsBtnPixi,
  buyBtnPixi,
  autoBtnPixi,
  turboBtnPixi,
  betDownBtnPixi,
  betUpBtnPixi,

  enterFreeSpins,

  CLOSE_UP,
  CLOSE_HOVER,
  CLOSE_DOWN,

  BET_DOWN_UP,
  BET_DOWN_HOVER,
  BET_DOWN_DOWN,

  BET_UP_UP,
  BET_UP_HOVER,
  BET_UP_DOWN,

  waitMs,
  animateMs,
  tween,
  easeOutCubic,
  easeOutBack,
  easeInCubic,
});



    const betValueBtn = makeButton(`BET: ${state.bank.betLevels[state.bank.betIndex]}`, 160, 56, () => {
      // optional: tap cycles bet too
      state.bank.betIndex = (state.bank.betIndex + 1) % state.bank.betLevels.length;
      betValueBtn.setLabel(`BET: ${state.bank.betLevels[state.bank.betIndex]}`);
    });





    const PANEL_HEIGHT_FRAC = 0.1; // try 0.14–0.20
    let uiPanelH = 0;              // updated each layoutUI()



    function layoutUI() {
      const panelW = app.screen.width;
      const targetH = Math.round(app.screen.height * PANEL_HEIGHT_FRAC);
      setUiPanelH(targetH);

      // uiPanel container pinned to bottom
      uiPanel.x = 0;
      uiPanel.y = Math.round(app.screen.height - targetH);


      // -----------------------------
    // PANEL BG DRAW (code)
    // -----------------------------
    panelBgG.clear();

    // tuning knobs
    const PANEL_FILL = 0x000000;
    const PANEL_ALPHA = 0.38;       // matches your old "opacity rectangle" vibe
    const PANEL_OUTLINE_A = 0.35;
    const PANEL_OUTLINE_W = 2;
    const PANEL_RADIUS = 0;         // set to 18 if you want rounded

  // Pixi v8: shape -> fill -> stroke
  if (PANEL_RADIUS > 0) {
    panelBgG
      .roundRect(0, 0, panelW, targetH, PANEL_RADIUS)
      .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA })
      .stroke({ width: PANEL_OUTLINE_W, color: 0xc7c7c7, alpha: PANEL_OUTLINE_A });
  } else {
    panelBgG
      .rect(0, 0, panelW, targetH)
      .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA })
      .stroke({ width: PANEL_OUTLINE_W, color: 0xc7c7c7, alpha: PANEL_OUTLINE_A });
  }

  uiDimmer.clear();
  uiDimmer.rect(0, 0, panelW, targetH).fill(0x000000);







  const balanceCenterX = Math.round(panelW * 0.71); // tweak left/right here


  balanceLabel.x = balanceCenterX;
  balanceLabel.y = Math.round(targetH * 0.58);

  balanceTitleLabel.x = balanceCenterX;
  balanceTitleLabel.y = balanceLabel.y - 35; // spacing between title and amount

  balanceLabel.roundPixels = true;
  balanceTitleLabel.roundPixels = true;

  // Optional polish
  balanceLabel.anchor.set(0.5);

      // --- WIN UI placement ---
      // Move the whole block around with these:
      placeOnPanel(winUI, 0.5, 0.55, panelW, targetH);

      // Control spacing between WIN and amount:
      const winGap = Math.round(targetH * 0.35); // tweak this
      winTitleLabel.x = 0;
      winTitleLabel.y = -winGap;

      winAmountLabel.x = 0;
      winAmountLabel.y = 3;

      // Optional: scale block to fit panel height
      setScaleToHeight(winUI, targetH * 0.55);


      // -----------------------------
      // Buttons placed using 0..1 coords
      // -----------------------------
      placeOnPanel(spinBtnPixi, 0.86, 0.1, panelW, targetH);
      setScaleToHeight(spinBtnPixi, targetH * 1.7);

      placeOnPanel(autoBtnPixi, 0.78, 0.5, panelW, targetH);
      setScaleToHeight(autoBtnPixi, targetH * 0.78);

      placeOnPanel(turboBtnPixi, 0.935, 0.5, panelW, targetH);
      setScaleToHeight(turboBtnPixi, targetH * 0.9);

      // BET buttons
      placeOnPanel(betDownBtnPixi, 0.2, 0.7, panelW, targetH);
      setScaleToHeight(betDownBtnPixi, targetH * 0.3);

      placeOnPanel(betAmountUI, 0.215, 0.35, panelW, targetH);
      setScaleToHeight(betAmountUI, targetH * 0.32);

      placeOnPanel(betUpBtnPixi, 0.2, 0.3, panelW, targetH);
      setScaleToHeight(betUpBtnPixi, targetH * 0.3);

      placeOnPanel(buyBtnPixi, 0.14, 0.23, panelW, targetH);
      setScaleToHeight(buyBtnPixi, targetH * 1.4);

      placeOnPanel(settingsBtnPixi, 0.07, 0.54, panelW, targetH);
      setScaleToHeight(settingsBtnPixi, targetH * 0.4);

      spinningBtnPixi.x = spinBtnPixi.x;
    spinningBtnPixi.y = spinBtnPixi.y;
    spinningBtnPixi.scale.set(spinBtnPixi.scale.x, spinBtnPixi.scale.y);
    spinningBtnPixi.pivot.set(spinBtnPixi.pivot.x, spinBtnPixi.pivot.y);




      // BET title above bet amount
    betTitleLabel.x = betAmountUI.x;
    betTitleLabel.y = betAmountUI.y - betAmountUI.height * 0.3;

    betTitleLabel.x = betAmountUI.x + 46.5;  // → move right
    // betTitleLabel.x = betAmountUI.x - 10; // ← move left




    }











  // You MUST return the things main.ts still references later
  return {
    // APIs you had as globals
    settingsApi,
    buyMenuApi,

    // UI layer + helpers (main.ts uses these later)
    uiLayer,
    uiPanel,
    uiDimmer,

    spinBtnPixi,
    spinningBtnPixi,
    settingsBtnPixi,
    buyBtnPixi,
    autoBtnPixi,
    turboBtnPixi,
    betDownBtnPixi,
    betUpBtnPixi,

    // functions used elsewhere
    layoutUI,
    fadeUiLayerTo,
    fadeGameTo,
    setUiEnabled,
    lockInputForBigWin,
    refreshSpinAffordability,
    updateBetUI,
    updateSpinButtonVisualState,

    // labels / setters used outside
    balanceLabel,
    setWinAmount,
    setMult,
  };
}
