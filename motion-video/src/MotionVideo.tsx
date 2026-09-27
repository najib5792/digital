import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import {useEffect, useState} from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// Palette: picks up the dusty pink of the hijab, pushed to TikTok-bold contrast.
const C = {
  pink: '#FF3D7F',
  yellow: '#FFE14D',
  plum: '#2B0F2E',
  white: '#FFFFFF',
  black: '#111111',
};

const FONT = "'Montserrat', sans-serif";

// Beat timings (frames @24fps), aligned to the speaker's pauses.
const BEATS = {
  hook: [0, 51],
  tips: [53, 105],
  shock: [108, 156],
  must: [158, 195],
  cta: [197, 240],
} as const;

const boldText: React.CSSProperties = {
  fontFamily: FONT,
  fontWeight: 900,
  color: C.white,
  textTransform: 'uppercase',
  WebkitTextStroke: `14px ${C.black}`,
  paintOrder: 'stroke fill',
  letterSpacing: -1,
  lineHeight: 1,
  textShadow: '0 10px 0 rgba(0,0,0,0.35)',
};

const useFontsReady = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    document.fonts.ready.then(() => continueRender(handle));
  }, [handle]);
};

const pop = (frame: number, fps: number, delay = 0, damping = 9) =>
  spring({frame: frame - delay, fps, config: {damping, stiffness: 180, mass: 0.6}});

// Fade + shrink out over the last `len` frames of a beat.
const exitOut = (frame: number, dur: number, len = 5) =>
  interpolate(frame, [dur - len, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });

/* ---------------- Background ---------------- */

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  // Intro settle + punch-ins on each beat so the talking head never feels static.
  const scale = interpolate(
    frame,
    [0, 12, BEATS.shock[0], BEATS.shock[0] + 4, BEATS.must[0], BEATS.must[0] + 5, BEATS.cta[0], BEATS.cta[0] + 8],
    [1.14, 1.0, 1.0, 1.08, 1.08, 1.03, 1.03, 1.0],
    {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}
  );
  // Small shake on the "shock" slam.
  const s = frame - BEATS.shock[0];
  const shake = s >= 0 && s < 8 ? Math.sin(s * 2.4) * (8 - s) * 1.6 : 0;

  return (
    <AbsoluteFill style={{backgroundColor: C.black, overflow: 'hidden'}}>
      <OffthreadVideo
        src={staticFile('input.mp4')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${shake}px, ${shake * 0.5}px)`,
        }}
      />
      {/* Vignette + top/bottom gradients so text reads over the room */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------------- Intro wipe ---------------- */

const IntroWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const bars = [C.yellow, C.pink, C.plum];
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {bars.map((color, i) => {
        const x = interpolate(frame, [i * 2, i * 2 + 10], [0, 140], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
        return (
          <AbsoluteFill
            key={color}
            style={{
              backgroundColor: color,
              transform: `translateX(${x}%) skewX(-12deg) scaleX(1.3)`,
              zIndex: 3 - i,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------------- Decorations ---------------- */

const Sparkle: React.FC<{x: number; y: number; size: number; color: string; delay: number}> = ({
  x,
  y,
  size,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = pop(frame, fps, delay, 12);
  const twinkle = 0.85 + Math.sin((frame + delay * 3) / 5) * 0.15;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${s * twinkle}) rotate(${frame * 2 + delay * 10}deg)`,
      }}
    >
      <path
        d="M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0Z"
        fill={color}
        stroke={C.black}
        strokeWidth={5}
      />
    </svg>
  );
};

const Bursts: React.FC<{color?: string; size?: number}> = ({color = C.yellow, size = 520}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 9], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const opacity = interpolate(frame, [6, 12], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rays = 12;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-100 -100 200 200"
      style={{position: 'absolute', left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2, opacity}}
    >
      {new Array(rays).fill(0).map((_, i) => {
        const a = (i / rays) * Math.PI * 2;
        const r1 = 40 + t * 30;
        const r2 = 55 + t * 42;
        return (
          <line
            key={i}
            x1={Math.cos(a) * r1}
            y1={Math.sin(a) * r1}
            x2={Math.cos(a) * r2}
            y2={Math.sin(a) * r2}
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames - 1], [0, 100]);
  return (
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 14, backgroundColor: 'rgba(255,255,255,0.25)'}}>
      <div style={{width: `${w}%`, height: '100%', background: `linear-gradient(90deg, ${C.pink}, ${C.yellow})`}} />
    </div>
  );
};

/* ---------------- Beat 1: Hook ---------------- */

const Word: React.FC<{text: string; delay: number; highlight?: string; size: number; tilt?: number}> = ({
  text,
  delay,
  highlight,
  size,
  tilt = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = pop(frame, fps, delay);
  const bar = interpolate(frame, [delay + 3, delay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        margin: '0 14px',
        transform: `scale(${s}) rotate(${(1 - s) * -20 + tilt}deg)`,
        opacity: s > 0.01 ? 1 : 0,
      }}
    >
      {highlight ? (
        <span
          style={{
            position: 'absolute',
            left: -18,
            right: -18,
            top: '8%',
            bottom: '2%',
            backgroundColor: highlight,
            border: `8px solid ${C.black}`,
            borderRadius: 18,
            transform: `scaleX(${bar}) rotate(-2deg)`,
            transformOrigin: 'left center',
          }}
        />
      ) : null}
      <span style={{...boldText, fontSize: size, position: 'relative'}}>{text}</span>
    </span>
  );
};

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = BEATS.hook[1] - BEATS.hook[0];
  const out = exitOut(frame, dur);
  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 70, opacity: out, transform: `translateY(${(1 - out) * -60}px)`}}>
      <div style={{textAlign: 'center'}}>
        <div>
          <Word text="Korang" delay={6} size={112} />
          <Word text="kena" delay={11} size={112} />
        </div>
        <div style={{marginTop: 14}}>
          <Word text="tahu" delay={16} size={132} highlight={C.pink} tilt={-3} />
          <Word text="ni!" delay={22} size={132} />
        </div>
      </div>
      <Sparkle x={40} y={250} size={80} color={C.yellow} delay={18} />
      <Sparkle x={960} y={40} size={64} color={C.pink} delay={24} />
      <Sparkle x={950} y={290} size={46} color={C.white} delay={28} />
    </AbsoluteFill>
  );
};

/* ---------------- Beat 2: Tips sticker ---------------- */

const Bulb: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <path
      d="M32 6c-11 0-19 8-19 18 0 7 4 11 7 15 2 2 3 5 3 8h18c0-3 1-6 3-8 3-4 7-8 7-15 0-10-8-18-19-18z"
      fill={C.yellow}
      stroke={C.black}
      strokeWidth={4}
    />
    <rect x={23} y={49} width={18} height={9} rx={3} fill={C.white} stroke={C.black} strokeWidth={4} />
  </svg>
);

const Tips: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dur = BEATS.tips[1] - BEATS.tips[0];
  const s = pop(frame, fps, 0, 8);
  const wiggle = Math.sin(frame / 4) * 2.5;
  const out = exitOut(frame, dur);
  const sub = pop(frame, fps, 8, 12);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380, opacity: out}}>
      <div style={{position: 'relative', transform: `scale(${s * (0.6 + 0.4 * out)}) rotate(${-6 + wiggle}deg)`}}>
        <Bursts color={C.yellow} size={760} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            backgroundColor: C.pink,
            border: `10px solid ${C.black}`,
            borderRadius: 999,
            padding: '26px 60px 26px 36px',
            boxShadow: `14px 14px 0 ${C.black}`,
          }}
        >
          <Bulb size={120} />
          <span style={{...boldText, fontSize: 110, WebkitTextStroke: `12px ${C.black}`}}>Tips Penting</span>
        </div>
      </div>
      <div
        style={{
          marginTop: 50,
          transform: `translateY(${(1 - sub) * 60}px) rotate(3deg)`,
          opacity: sub,
          backgroundColor: C.yellow,
          border: `8px solid ${C.black}`,
          borderRadius: 16,
          padding: '12px 34px',
        }}
      >
        <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 64, color: C.black, textTransform: 'uppercase'}}>
          Dengar sampai habis!
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Beat 3: Shock slam ---------------- */

const Slam: React.FC<{text: string; delay: number; size: number; color: string}> = ({text, delay, size, color}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const scale = interpolate(t, [0, 1], [3.2, 1]);
  return (
    <div style={{transform: `scale(${scale})`, opacity: t, textAlign: 'center'}}>
      <span style={{...boldText, fontSize: size, color, WebkitTextStroke: `16px ${C.black}`}}>{text}</span>
    </div>
  );
};

const Shock: React.FC = () => {
  const frame = useCurrentFrame();
  const dur = BEATS.shock[1] - BEATS.shock[0];
  const out = exitOut(frame, dur);
  const flash = interpolate(frame, [0, 2, 6], [0, 0.55, 0], {extrapolateRight: 'clamp'});
  return (
    <>
      <AbsoluteFill style={{backgroundColor: C.white, opacity: flash}} />
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380, opacity: out, transform: `scale(${0.8 + 0.2 * out})`}}>
        <div style={{position: 'relative', transform: 'rotate(-4deg)'}}>
          <Sequence from={0} layout="none">
            <Bursts color={C.pink} size={900} />
          </Sequence>
          <Slam text="Ramai" delay={0} size={170} color={C.white} />
          <div style={{height: 14}} />
          <Slam text="tak sedar!" delay={6} size={150} color={C.yellow} />
        </div>
        <Sparkle x={70} y={1560} size={80} color={C.pink} delay={10} />
        <Sparkle x={940} y={1080} size={70} color={C.yellow} delay={14} />
      </AbsoluteFill>
    </>
  );
};

/* ---------------- Beat 4: Must try + animated check ---------------- */

const Check: React.FC<{size: number}> = ({size}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const circle = pop(frame, fps, 0, 10);
  const draw = interpolate(frame, [5, 14], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{transform: `scale(${circle})`}}>
      <circle cx={50} cy={50} r={44} fill="#2BD96B" stroke={C.black} strokeWidth={7} />
      <path
        d="M28 52 L44 67 L73 36"
        fill="none"
        stroke={C.white}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={draw}
      />
    </svg>
  );
};

const Must: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dur = BEATS.must[1] - BEATS.must[0];
  const out = exitOut(frame, dur);
  const slide = pop(frame, fps, 2, 11);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 380, opacity: out}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        <Check size={190} />
        <div style={{transform: `translateX(${(1 - slide) * 400}px) rotate(-3deg)`, opacity: slide}}>
          <div
            style={{
              backgroundColor: C.white,
              border: `10px solid ${C.black}`,
              borderRadius: 24,
              padding: '14px 36px',
              boxShadow: `12px 12px 0 ${C.pink}`,
            }}
          >
            <span style={{fontFamily: FONT, fontWeight: 900, fontSize: 118, color: C.black, textTransform: 'uppercase'}}>
              Wajib
            </span>
          </div>
          <div style={{marginTop: -8, marginLeft: 40}}>
            <span style={{...boldText, fontSize: 140, color: C.pink}}>Cuba!</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Beat 5: CTA ---------------- */

const Bell: React.FC<{size: number}> = ({size}) => {
  const frame = useCurrentFrame();
  const ring = Math.sin(frame / 1.6) * 18 * Math.max(0, 1 - ((frame % 24) / 12));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{transform: `rotate(${ring}deg)`, transformOrigin: '50% 10%'}}>
      <path
        d="M32 6c-10 0-17 8-17 18v12l-6 8h46l-6-8V24c0-10-7-18-17-18z"
        fill={C.yellow}
        stroke={C.black}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx={32} cy={52} r={7} fill={C.yellow} stroke={C.black} strokeWidth={4} />
    </svg>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const panel = pop(frame, fps, 0, 13);
  const line1 = pop(frame, fps, 5, 9);
  const line2 = pop(frame, fps, 10, 12);
  const arrowBob = Math.sin(frame / 3) * 14;
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 170}}>
      <div
        style={{
          position: 'relative',
          width: 920,
          transform: `translateY(${(1 - panel) * 700}px) rotate(-2deg)`,
          backgroundColor: C.plum,
          border: `10px solid ${C.black}`,
          borderRadius: 40,
          padding: '44px 40px 40px',
          boxShadow: `16px 16px 0 ${C.pink}`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -70,
            right: 40,
            transform: `scale(${line1})`,
          }}
        >
          <div
            style={{
              backgroundColor: C.white,
              border: `8px solid ${C.black}`,
              borderRadius: 999,
              width: 140,
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={96} />
          </div>
        </div>
        <div style={{transform: `scale(${line1})`}}>
          <span style={{...boldText, fontSize: 104, WebkitTextStroke: `12px ${C.black}`}}>
            Simpan <span style={{color: C.yellow}}>&amp;</span> Follow
          </span>
        </div>
        <div style={{marginTop: 22, opacity: line2, transform: `translateY(${(1 - line2) * 30}px)`}}>
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 54,
              color: C.plum,
              backgroundColor: C.yellow,
              padding: '6px 26px',
              borderRadius: 12,
              textTransform: 'uppercase',
            }}
          >
            untuk tips seterusnya
          </span>
        </div>
      </div>
      <svg
        width={110}
        height={110}
        viewBox="0 0 64 64"
        style={{marginTop: 26, transform: `translateY(${arrowBob}px)`, opacity: line2}}
      >
        <path d="M32 58 L8 30 H22 V6 H42 V30 H56 Z" fill={C.pink} stroke={C.black} strokeWidth={4} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};

/* ---------------- Composition ---------------- */

const beat = (key: keyof typeof BEATS) => ({from: BEATS[key][0], durationInFrames: BEATS[key][1] - BEATS[key][0]});

export const MotionVideo: React.FC = () => {
  useFontsReady();
  return (
    <AbsoluteFill>
      <Background />
      <Sequence {...beat('hook')}>
        <Hook />
      </Sequence>
      <Sequence {...beat('tips')}>
        <Tips />
      </Sequence>
      <Sequence {...beat('shock')}>
        <Shock />
      </Sequence>
      <Sequence {...beat('must')}>
        <Must />
      </Sequence>
      <Sequence {...beat('cta')}>
        <Cta />
      </Sequence>
      <ProgressBar />
      <Sequence durationInFrames={16}>
        <IntroWipe />
      </Sequence>
    </AbsoluteFill>
  );
};
